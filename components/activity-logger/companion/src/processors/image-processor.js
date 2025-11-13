/**
 * Image Processor
 * Handles image processing operations using Sharp
 * - Thumbnail generation
 * - Metadata extraction
 * - Perceptual hashing for similarity detection
 * - Image optimization
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class ImageProcessor {
  constructor(options = {}) {
    this.thumbnailDir = options.thumbnailDir || path.join(__dirname, '../../data/thumbnails');
    this.maxThumbnailSize = options.maxThumbnailSize || { width: 300, height: 200 };
    this.thumbnailQuality = options.thumbnailQuality || 80;
    this.thumbnailFormat = options.thumbnailFormat || 'webp';

    // Ensure thumbnail directory exists
    if (!fs.existsSync(this.thumbnailDir)) {
      fs.mkdirSync(this.thumbnailDir, { recursive: true });
    }
  }

  /**
   * Generate thumbnail for an image
   */
  async generateThumbnail(imagePath, options = {}) {
    const {
      width = this.maxThumbnailSize.width,
      height = this.maxThumbnailSize.height,
      quality = this.thumbnailQuality,
      format = this.thumbnailFormat
    } = options;

    try {
      const fileName = path.basename(imagePath, path.extname(imagePath));
      const hash = crypto.createHash('md5').update(imagePath).digest('hex').substring(0, 8);
      const thumbnailPath = path.join(
        this.thumbnailDir,
        `${fileName}_${hash}_thumb.${format}`
      );

      // Check if thumbnail already exists
      if (fs.existsSync(thumbnailPath)) {
        return {
          success: true,
          thumbnailPath,
          cached: true
        };
      }

      await sharp(imagePath)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality })
        .toFile(thumbnailPath);

      return {
        success: true,
        thumbnailPath,
        cached: false
      };
    } catch (error) {
      console.error('[IMAGE] Error generating thumbnail:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract image metadata
   */
  async extractMetadata(imagePath) {
    try {
      const stats = fs.statSync(imagePath);
      const metadata = await sharp(imagePath).metadata();

      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: stats.size,
        hasAlpha: metadata.hasAlpha || false,
        colorSpace: metadata.space,
        channels: metadata.channels,
        density: metadata.density,
        orientation: metadata.orientation,
        exif: metadata.exif ? 'present' : null
      };
    } catch (error) {
      console.error('[IMAGE] Error extracting metadata:', error.message);
      return null;
    }
  }

  /**
   * Compute perceptual hash for similarity detection
   * Uses difference hash (dHash) algorithm
   */
  async computePerceptualHash(imagePath) {
    try {
      // Resize to 9x8 for dHash (8x8 + 1 for comparison)
      const buffer = await sharp(imagePath)
        .resize(9, 8, { fit: 'fill' })
        .greyscale()
        .raw()
        .toBuffer();

      // Compute difference hash
      let hash = 0n;
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const left = buffer[row * 9 + col];
          const right = buffer[row * 9 + col + 1];
          hash = (hash << 1n) | (left < right ? 1n : 0n);
        }
      }

      return hash.toString(16).padStart(16, '0');
    } catch (error) {
      console.error('[IMAGE] Error computing perceptual hash:', error.message);
      return null;
    }
  }

  /**
   * Compare two images using perceptual hash
   * Returns similarity score (0-1, where 1 is identical)
   */
  async compareImages(imagePath1, imagePath2) {
    try {
      const hash1 = await this.computePerceptualHash(imagePath1);
      const hash2 = await this.computePerceptualHash(imagePath2);

      if (!hash1 || !hash2) {
        return null;
      }

      const distance = this.hammingDistance(hash1, hash2);
      const maxDistance = 64; // 8x8 = 64 bits
      const similarity = 1 - (distance / maxDistance);

      return {
        similarity: Math.max(0, similarity),
        distance,
        hash1,
        hash2
      };
    } catch (error) {
      console.error('[IMAGE] Error comparing images:', error.message);
      return null;
    }
  }

  /**
   * Compare two perceptual hashes
   */
  hammingDistance(hash1, hash2) {
    const bin1 = BigInt('0x' + hash1);
    const bin2 = BigInt('0x' + hash2);
    const diff = bin1 ^ bin2;
    
    let distance = 0;
    let temp = diff;
    while (temp > 0n) {
      distance += Number(temp & 1n);
      temp = temp >> 1n;
    }
    
    return distance;
  }

  /**
   * Optimize image (convert to WebP with compression)
   */
  async optimizeImage(imagePath, outputPath = null) {
    try {
      const fileName = path.basename(imagePath, path.extname(imagePath));
      const output = outputPath || path.join(
        path.dirname(imagePath),
        `${fileName}_optimized.webp`
      );

      await sharp(imagePath)
        .webp({ quality: 85, effort: 6 })
        .toFile(output);

      const originalSize = fs.statSync(imagePath).size;
      const optimizedSize = fs.statSync(output).size;
      const savings = ((originalSize - optimizedSize) / originalSize) * 100;

      return {
        success: true,
        outputPath: output,
        originalSize,
        optimizedSize,
        savings: savings.toFixed(2)
      };
    } catch (error) {
      console.error('[IMAGE] Error optimizing image:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process image and return all metadata
   */
  async processImage(imagePath, options = {}) {
    const {
      generateThumbnail = true,
      extractMetadata = true,
      computeHash = true
    } = options;

    const result = {
      path: imagePath,
      success: false
    };

    try {
      if (extractMetadata) {
        result.metadata = await this.extractMetadata(imagePath);
      }

      if (generateThumbnail) {
        result.thumbnail = await this.generateThumbnail(imagePath);
      }

      if (computeHash) {
        result.perceptualHash = await this.computePerceptualHash(imagePath);
      }

      result.success = true;
      return result;
    } catch (error) {
      console.error('[IMAGE] Error processing image:', error.message);
      result.error = error.message;
      return result;
    }
  }
}

module.exports = ImageProcessor;

