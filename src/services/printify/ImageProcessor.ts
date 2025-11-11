/**
 * Image processing utilities for Printify integration
 * Handles image fetching, compression, and optimization
 */
export class ImageProcessor {
  /**
   * Fetch an image from URL and convert to Blob
   */
  static async fetchImageAsBlob(imageUrl: string): Promise<Blob> {
    console.log("📷 Fetching image from URL...");
    const imageResponse = await fetch(imageUrl);
    console.log(
      "✅ Image fetched, size:",
      imageResponse.headers.get("content-length"),
      "bytes",
    );

    const imageBlob = await imageResponse.blob();
    console.log("🔄 Converting to blob, size:", imageBlob.size, "bytes");
    return imageBlob;
  }

  /**
   * Compress image blob with specified quality
   * Maintains aspect ratio while reducing file size
   */
  static async compressImage(blob: Blob, quality: number = 0.9): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        const maxWidth = 800;
        const maxHeight = 1200;
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          compressedBlob => {
            if (compressedBlob) {
              resolve(compressedBlob);
            } else {
              reject(new Error("Failed to compress image"));
            }
          },
          "image/png",
          quality,
        );
      };

      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  }
}
