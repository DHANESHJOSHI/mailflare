export interface StorageItem {
	key: string;
	size: number;
	httpMetadata?: { contentType?: string };
	customMetadata?: Record<string, string>;
	writeHttpMetadata(headers: Headers): void;
	arrayBuffer(): Promise<ArrayBuffer>;
	text(): Promise<string>;
	body: ReadableStream<Uint8Array>;
}

export interface StorageService {
	get(
		key: string,
		options?: { range?: { offset?: number; length?: number } },
	): Promise<StorageItem | null>;
	put(
		key: string,
		value: ArrayBuffer | Uint8Array | string | ReadableStream | Blob,
		options?: {
			httpMetadata?: { contentType?: string };
			customMetadata?: Record<string, string>;
		},
	): Promise<{ key: string; size: number }>;
	delete(key: string | string[]): Promise<void>;
}

const CHUNK_SIZE = 512 * 1024; // 512 KiB per chunk, well within D1's 1 MiB limit

export function getStorage(env: any): StorageService {
	if (env.BUCKET && typeof env.BUCKET.get === "function") {
		return {
			async get(key, options) {
				const obj = await env.BUCKET.get(key, options);
				if (!obj) return null;
				return {
					key: obj.key,
					size: obj.size,
					httpMetadata: obj.httpMetadata,
					customMetadata: obj.customMetadata,
					writeHttpMetadata(headers: Headers) {
						obj.writeHttpMetadata(headers);
					},
					arrayBuffer: () => obj.arrayBuffer() as Promise<ArrayBuffer>,
					text: () => obj.text(),
					get body() {
						return obj.body as ReadableStream<Uint8Array>;
					},
				};
			},
			async put(key, value, options) {
				const obj = await env.BUCKET.put(key, value, options);
				return { key, size: obj?.size ?? 0 };
			},
			async delete(key) {
				if (Array.isArray(key)) {
					await env.BUCKET.delete(key);
				} else {
					await env.BUCKET.delete(key);
				}
			},
		};
	}

	// Fallback to D1 storage_objects table (100% Free, no R2 subscription needed)
	return {
		async get(key, options): Promise<StorageItem | null> {
			if (!env.DB) throw new Error("env.DB is not configured");

			let query = "SELECT chunk_index, total_chunks, data, content_type, custom_metadata, size FROM storage_objects WHERE key = ?";
			if (options?.range && (options.range.offset ?? 0) === 0 && (options.range.length ?? 0) <= CHUNK_SIZE) {
				query += " AND chunk_index = 0";
			}
			query += " ORDER BY chunk_index ASC";

			const result = await env.DB.prepare(query).bind(key).all();
			const rows = result.results as Array<{
				chunk_index: number;
				total_chunks: number;
				data: ArrayBuffer | Uint8Array | number[];
				content_type: string | null;
				custom_metadata: string | null;
				size: number;
			}>;

			if (!rows || rows.length === 0) return null;

			const first = rows[0];
			const size = first.size;
			const contentType = first.content_type ?? undefined;
			let customMetadata: Record<string, string> | undefined;
			if (first.custom_metadata) {
				try {
					customMetadata = JSON.parse(first.custom_metadata);
				} catch {
					// ignore
				}
			}

			const toUint8Array = (raw: any): Uint8Array => {
				if (raw instanceof Uint8Array) return raw;
				if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
				if (Array.isArray(raw)) return new Uint8Array(raw);
				if (raw?.buffer instanceof ArrayBuffer) return new Uint8Array(raw.buffer, raw.byteOffset ?? 0, raw.byteLength ?? raw.length);
				return new Uint8Array();
			};

			let combined: Uint8Array;
			if (rows.length === 1) {
				combined = toUint8Array(rows[0].data);
			} else {
				const chunks = rows.map((r) => toUint8Array(r.data));
				const totalLen = chunks.reduce((acc, c) => acc + c.byteLength, 0);
				combined = new Uint8Array(totalLen);
				let off = 0;
				for (const chunk of chunks) {
					combined.set(chunk, off);
					off += chunk.byteLength;
				}
			}

			return {
				key,
				size,
				httpMetadata: contentType ? { contentType } : undefined,
				customMetadata,
				writeHttpMetadata(headers: Headers) {
					if (contentType) {
						headers.set("Content-Type", contentType);
					}
				},
				async arrayBuffer(): Promise<ArrayBuffer> {
					const copy = new Uint8Array(combined.byteLength);
					copy.set(combined);
					return copy.buffer;
				},
				async text(): Promise<string> {
					return new TextDecoder().decode(combined);
				},
				get body(): ReadableStream<Uint8Array> {
					return new ReadableStream<Uint8Array>({
						start(controller) {
							controller.enqueue(combined);
							controller.close();
						},
					});
				},
			};
		},

		async put(key, value, options) {
			if (!env.DB) throw new Error("env.DB is not configured");

			let buffer: Uint8Array;
			if (typeof value === "string") {
				buffer = new TextEncoder().encode(value);
			} else if (value instanceof Uint8Array) {
				buffer = value;
			} else if (value instanceof ArrayBuffer) {
				buffer = new Uint8Array(value);
			} else if (value instanceof Blob) {
				buffer = new Uint8Array(await value.arrayBuffer());
			} else if (value && typeof (value as any).getReader === "function") {
				const reader = (value as ReadableStream<Uint8Array>).getReader();
				const chunks: Uint8Array[] = [];
				while (true) {
					const { done, value: chunk } = await reader.read();
					if (done) break;
					if (chunk) chunks.push(chunk);
				}
				const totalLen = chunks.reduce((acc, c) => acc + c.byteLength, 0);
				buffer = new Uint8Array(totalLen);
				let off = 0;
				for (const chunk of chunks) {
					buffer.set(chunk, off);
					off += chunk.byteLength;
				}
			} else {
				buffer = new Uint8Array();
			}

			const size = buffer.byteLength;
			const totalChunks = Math.max(1, Math.ceil(size / CHUNK_SIZE));
			const contentType = options?.httpMetadata?.contentType ?? null;
			const customMetadataStr = options?.customMetadata ? JSON.stringify(options.customMetadata) : null;
			const now = Math.floor(Date.now() / 1000);

			const statements: any[] = [
				env.DB.prepare("DELETE FROM storage_objects WHERE key = ?").bind(key),
			];

			for (let i = 0; i < totalChunks; i++) {
				const start = i * CHUNK_SIZE;
				const end = Math.min(start + CHUNK_SIZE, size);
				const chunkData = buffer.subarray(start, end);
				const arrayBuf = chunkData.buffer.slice(
					chunkData.byteOffset,
					chunkData.byteOffset + chunkData.byteLength,
				);

				statements.push(
					env.DB.prepare(
						"INSERT INTO storage_objects (key, chunk_index, total_chunks, data, content_type, custom_metadata, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
					).bind(key, i, totalChunks, arrayBuf, contentType, customMetadataStr, size, now),
				);
			}

			await env.DB.batch(statements);
			return { key, size };
		},

		async delete(key) {
			if (!env.DB) return;
			if (Array.isArray(key)) {
				if (key.length === 0) return;
				const statements = key.map((k) =>
					env.DB.prepare("DELETE FROM storage_objects WHERE key = ?").bind(k),
				);
				await env.DB.batch(statements);
			} else {
				await env.DB.prepare("DELETE FROM storage_objects WHERE key = ?").bind(key).run();
			}
		},
	};
}
