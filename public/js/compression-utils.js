import pako from 'pako';

export class CompressionUtils {
  static async decompressGzip(compressedData) {
    try {
      return pako.inflate(compressedData);
    } catch (err) {
      if (typeof DecompressionStream === 'function') {
        const ds = new DecompressionStream('gzip');
        const decompressedStream = new Response(new Blob([compressedData])).body.pipeThrough(ds);
        const buffer = await new Response(decompressedStream).arrayBuffer();
        return new Uint8Array(buffer);
      } else {
        console.warn('no decompression method available');
        return compressedData;
      }
    }
  }
} 