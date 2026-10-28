/** Save a blob as a file via a temporary <a download> */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Revoke later: some browsers start the download asynchronously
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** gzip-compress bytes or text with the browser's native CompressionStream */
export async function compress(data: string, format: CompressionFormat = 'gzip'): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export class TooLargeError extends Error {}

/** Decompress to text; throws once the output passes `maxBytes` (guards against decompression bombs) */
export async function decompress(data: BufferSource | Blob, format: CompressionFormat = 'gzip', maxBytes = Infinity): Promise<string> {
  const reader = (data instanceof Blob ? data : new Blob([data])).stream().pipeThrough(new DecompressionStream(format)).getReader();
  const decoder = new TextDecoder();
  let text = '', size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new TooLargeError('Data is too large');
    }
    text += decoder.decode(value, { stream: true });
  }
}
