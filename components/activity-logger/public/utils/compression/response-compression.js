/**
 * Response Compression Utilities
 * Compresses/decompresses large API responses to reduce network overhead
 */

class ResponseCompressor {
  constructor() {
    this.supportsCompression = this.checkCompressionSupport();
  }

  /**
   * Check if browser supports compression APIs
   */
  checkCompressionSupport() {
    return typeof CompressionStream !== 'undefined' && 
           typeof DecompressionStream !== 'undefined';
  }

  /**
   * Compress data using CompressionStream API
   */
  async compress(data, format = 'gzip') {
    if (!this.supportsCompression) {
      // Fallback: return data as-is if compression not supported
      return data;
    }

    try {
      const encoder = new TextEncoder();
      const dataStream = encoder.encode(JSON.stringify(data));
      
      const compressionStream = new CompressionStream(format);
      const writer = compressionStream.writable.getWriter();
      const reader = compressionStream.readable.getReader();
      
      // Write data to compression stream
      writer.write(dataStream);
      writer.close();
      
      // Read compressed chunks
      const chunks = [];
      let done = false;
      
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          chunks.push(value);
        }
      }
      
      // Combine chunks into single Uint8Array
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const compressed = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        compressed.set(chunk, offset);
        offset += chunk.length;
      }
      
      return compressed;
    } catch (error) {
      console.warn('[COMPRESSION] Compression failed, returning uncompressed data:', error);
      return data;
    }
  }

  /**
   * Decompress data using DecompressionStream API
   */
  async decompress(compressedData, format = 'gzip') {
    if (!this.supportsCompression) {
      // Fallback: assume data is already decompressed
      return compressedData;
    }

    try {
      const decompressionStream = new DecompressionStream(format);
      const writer = decompressionStream.writable.getWriter();
      const reader = decompressionStream.readable.getReader();
      
      // Write compressed data to decompression stream
      writer.write(compressedData);
      writer.close();
      
      // Read decompressed chunks
      const chunks = [];
      let done = false;
      
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          chunks.push(value);
        }
      }
      
      // Combine chunks and decode
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const decompressed = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        decompressed.set(chunk, offset);
        offset += chunk.length;
      }
      
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(decompressed);
      return JSON.parse(jsonString);
    } catch (error) {
      console.warn('[COMPRESSION] Decompression failed:', error);
      // Try parsing as JSON directly (might be uncompressed)
      try {
        return JSON.parse(compressedData);
      } catch {
        return compressedData;
      }
    }
  }

  /**
   * Compress and encode to base64 for storage/transmission
   */
  async compressToBase64(data, format = 'gzip') {
    const compressed = await this.compress(data, format);
    if (compressed instanceof Uint8Array) {
      // Convert to base64
      const binary = String.fromCharCode.apply(null, compressed);
      return btoa(binary);
    }
    return data;
  }

  /**
   * Decompress from base64
   */
  async decompressFromBase64(base64Data, format = 'gzip') {
    try {
      // Convert from base64
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return await this.decompress(bytes, format);
    } catch (error) {
      console.warn('[COMPRESSION] Base64 decompression failed:', error);
      // Try parsing as JSON directly
      try {
        return JSON.parse(base64Data);
      } catch {
        return base64Data;
      }
    }
  }

  /**
   * Check if data should be compressed (based on size)
   */
  shouldCompress(data, threshold = 10240) { // 10KB default threshold
    const size = typeof data === 'string' 
      ? new Blob([data]).size 
      : JSON.stringify(data).length;
    return size > threshold;
  }
}

/**
 * Enhanced API Client with compression support
 */
class CompressedAPIClient {
  constructor(apiClient, compressor) {
    this.apiClient = apiClient;
    this.compressor = compressor || new ResponseCompressor();
  }

  /**
   * Get with automatic compression/decompression
   */
  async get(endpoint, options = {}) {
    const { compress = false, decompress = true, ...apiOptions } = options;
    
    // Add Accept-Encoding header if compression is supported
    if (compress && this.compressor.supportsCompression) {
      apiOptions.headers = {
        ...apiOptions.headers,
        'Accept-Encoding': 'gzip, deflate, br'
      };
    }
    
    const response = await this.apiClient.get(endpoint, apiOptions);
    
    // Decompress if needed (browser usually handles this automatically)
    if (decompress && response && typeof response === 'object') {
      // Check if response indicates compression
      if (response._compressed) {
        return await this.compressor.decompressFromBase64(response.data);
      }
    }
    
    return response;
  }

  /**
   * Post with automatic compression
   */
  async post(endpoint, data, options = {}) {
    const { compress = true, ...apiOptions } = options;
    
    let payload = data;
    
    // Compress large payloads
    if (compress && this.compressor.shouldCompress(data)) {
      const compressed = await this.compressor.compressToBase64(data);
      payload = {
        _compressed: true,
        format: 'gzip',
        data: compressed
      };
      
      apiOptions.headers = {
        ...apiOptions.headers,
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip'
      };
    }
    
    return await this.apiClient.post(endpoint, payload, apiOptions);
  }
}

// Export
window.ResponseCompressor = ResponseCompressor;
window.CompressedAPIClient = CompressedAPIClient;

// Create global instance
window.responseCompressor = new ResponseCompressor();





