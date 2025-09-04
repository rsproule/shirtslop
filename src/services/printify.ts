import { generateImageHash } from "./imageHash";
import { createProductIdentifier } from "./nameGeneration";
import { ImageProcessor } from "./printify/ImageProcessor";
import {
  ProductBuilder,
  type CreateProductPayload,
} from "./printify/ProductBuilder";
import { ShirtDatabase } from "./printify/ShirtDatabase";
import type {
  PrintifyImage,
  PrintifyProduct,
  ShirtCreationResult,
} from "./printify/types";

class PrintifyService {
  constructor() {
    // All API calls go through our server-side /api/printify endpoint
    // No need for credentials on the client-side
  }

  private async makeRequest<T>(
    action: string,
    body?: unknown,
    method: string = "POST",
  ): Promise<T> {
    const baseUrl = import.meta.env.DEV ? "http://localhost:3000" : "";
    const url = `${baseUrl}/api/printify?action=${action}`;

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async uploadImage(imageBlob: Blob): Promise<PrintifyImage> {
    // Try uploading with different compression levels
    const qualityLevels = [1.0, 0.9, 0.75]; // 100%, 90%, 75%

    for (let i = 0; i < qualityLevels.length; i++) {
      const quality = qualityLevels[i];

      try {
        let processedBlob = imageBlob;

        // If image is larger than 2MB or not the first attempt, compress it
        if (imageBlob.size > 2 * 1024 * 1024 || i > 0) {
          console.log(
            `🗜️ Compressing image from ${(imageBlob.size / 1024 / 1024).toFixed(2)}MB at ${quality * 100}% quality`,
          );
          processedBlob = await ImageProcessor.compressImage(
            imageBlob,
            quality,
          );
          console.log(
            `✅ Compressed to ${(processedBlob.size / 1024 / 1024).toFixed(2)}MB`,
          );
        }

        const result = await this.uploadImageToAPI(processedBlob);
        return result; // Success, return the result
      } catch (error) {
        const isLastAttempt = i === qualityLevels.length - 1;
        const is413Error =
          error instanceof Error && error.message.includes("413");

        if (is413Error && !isLastAttempt) {
          console.log(
            `⚠️ Upload failed with 413 at ${quality * 100}% quality, trying lower quality...`,
          );
          continue; // Try next quality level
        } else {
          // Either not a 413 error, or this was the last attempt
          throw error;
        }
      }
    }

    throw new Error(
      "Failed to upload image after trying all compression levels",
    );
  }

  private async uploadImageToAPI(processedBlob: Blob): Promise<PrintifyImage> {
    return new Promise<PrintifyImage>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string;
          const uploadResult = await this.makeRequest<PrintifyImage>("upload", {
            imageUrl: dataUrl,
          });
          resolve(uploadResult);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = reject;
      reader.readAsDataURL(processedBlob);
    });
  }

  async createProduct(payload: CreateProductPayload): Promise<PrintifyProduct> {
    return this.makeRequest<PrintifyProduct>("create-product", payload);
  }

  async publishProduct(productId: string): Promise<void> {
    await this.makeRequest("publish", { productId });
  }

  async getProduct(productId: string): Promise<PrintifyProduct> {
    const baseUrl = import.meta.env.DEV ? "http://localhost:3000" : "";
    const url = `${baseUrl}/api/printify?action=get-product&productId=${productId}`;
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Step-based shirt creation workflow
  private async processImageAndCreateHash(
    imageUrl: string,
  ): Promise<{ imageBlob: Blob; imageHash: string }> {
    console.log("📷 Step 1: Processing image...");
    const imageBlob = await ImageProcessor.fetchImageAsBlob(imageUrl);
    const imageHash = await generateImageHash(imageBlob);
    console.log("🔑 Generated image hash:", imageHash);
    return { imageBlob, imageHash };
  }

  private async uploadImageToService(imageBlob: Blob): Promise<PrintifyImage> {
    console.log("⬆️ Step 2: Uploading image to Printify...");
    const uploadedImage = await this.uploadImage(imageBlob);
    console.log("✅ Image uploaded successfully, ID:", uploadedImage.id);
    return uploadedImage;
  }

  private async createAndPublishProduct(
    productName: string,
    description: string,
    uploadedImageId: string,
    imageHash: string,
    placement: "front" | "back" = "front",
  ): Promise<PrintifyProduct> {
    console.log("🏭 Step 3: Creating product on Printify...");
    const identifier = createProductIdentifier(imageHash);
    const productDescription = ProductBuilder.createDescription(
      identifier,
      description,
    );
    const payload = ProductBuilder.createProductPayload(
      productName,
      productDescription,
      uploadedImageId,
      placement,
    );

    const product = await this.createProduct(payload);
    console.log("✅ Product created successfully, ID:", product);

    console.log("🛒 Step 4: Publishing to Shopify...");
    await this.publishProduct(product.id);
    console.log("✅ Product published to Shopify");

    return product;
  }

  private async waitForSyncAndGetUpdatedProduct(
    productId: string,
  ): Promise<PrintifyProduct> {
    console.log("⏳ Step 5: Polling for Shopify sync...");

    const maxAttempts = 30; // Maximum 30 seconds
    const pollInterval = 1500; // 1 second between attempts

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(
        `🔄 Attempt ${attempt}/${maxAttempts}: Checking product sync status...`,
      );

      try {
        const updatedProduct = await this.getProduct(productId);
        const shopifyUrl = updatedProduct.external?.handle;

        if (shopifyUrl) {
          console.log(
            `✅ Shopify sync complete! URL available after ${attempt} seconds`,
          );
          console.log("🛒 Shopify product URL:", shopifyUrl);
          console.log(
            "📊 Product variants count:",
            updatedProduct.variants?.length || 0,
          );
          return updatedProduct;
        }

        console.log(
          `⏳ External URL not ready yet, waiting ${pollInterval / 1000}s...`,
        );
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.warn(`⚠️ Attempt ${attempt} failed:`, error);
        if (attempt === maxAttempts) {
          throw new Error(
            `Failed to get updated product after ${maxAttempts} attempts: ${error}`,
          );
        }
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error(
      `Shopify sync timeout: External URL not available after ${maxAttempts} seconds`,
    );
  }

  async createShirtFromDesign(
    imageUrl: string,
    prompt: string,
    productName: string,
    description: string = "",
    placement: "front" | "back" = "front",
    onStatusUpdate?: (
      status:
        | "processing"
        | "uploading"
        | "creating"
        | "publishing"
        | "syncing",
    ) => void,
  ): Promise<ShirtCreationResult> {
    console.log("🚀 Starting shirt creation process...");
    console.log("📝 Original prompt:", prompt);
    console.log("📍 Placement:", placement);

    try {
      // Step 1: Process image and generate hash
      onStatusUpdate?.("processing");
      const { imageBlob, imageHash } =
        await this.processImageAndCreateHash(imageUrl);

      // Store draft record
      await ShirtDatabase.createDraftRecord(
        imageHash,
        prompt,
        imageUrl,
        productName,
      );
      console.log("🏷️ Using product name:", productName);

      // Step 2: Upload image
      onStatusUpdate?.("uploading");
      const uploadedImage = await this.uploadImageToService(imageBlob);

      // Step 3: Create and publish product
      onStatusUpdate?.("creating");
      const product = await this.createAndPublishProduct(
        productName,
        description,
        uploadedImage.id,
        imageHash,
        placement,
      );

      // Step 4: Wait for sync and get updated details
      onStatusUpdate?.("syncing");
      const updatedProduct = await this.waitForSyncAndGetUpdatedProduct(
        product.id,
      );

      // Update database with published status
      const shopifyUrl = updatedProduct.external?.handle;
      await ShirtDatabase.updatePublishedRecord(
        imageHash,
        product.id,
        shopifyUrl,
      );

      console.log("🎉 Shirt creation process completed successfully!");

      return {
        product: updatedProduct,
        variants: updatedProduct.variants || [],
        options: updatedProduct.options || [],
        imageHash,
      };
    } catch (error) {
      console.error("❌ Failed to create shirt:", error);
      throw new Error(
        `Failed to create shirt: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

export const printifyService = new PrintifyService();
