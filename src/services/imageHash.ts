// Utility functions for image hashing and tracking

/**
 * Generate a SHA-256 hash from image blob content
 */
export async function generateImageHash(imageBlob: Blob): Promise<string> {
  const arrayBuffer = await imageBlob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

/**
 * Generate a hash from a data URL or regular URL (including Blob URLs)
 */
export async function generateDataUrlHash(imageUrl: string): Promise<string> {
  // Check if it's a data URL (data:image/png;base64,...)
  if (imageUrl.startsWith("data:")) {
    // Extract base64 data from data URL
    const base64Data = imageUrl.split(",")[1];
    const binaryData = atob(base64Data);
    const uint8Array = new Uint8Array(binaryData.length);

    for (let i = 0; i < binaryData.length; i++) {
      uint8Array[i] = binaryData.charCodeAt(i);
    }

    const hashBuffer = await crypto.subtle.digest("SHA-256", uint8Array);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    return hashHex;
  }

  // For regular URLs (including Blob URLs), fetch and hash the blob
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  return generateImageHash(blob);
}

import { db, ImageLifecycleState } from "./db";

/**
 * Get published product info from database
 */
export async function getPublishedProduct(imageHash: string): Promise<{
  productName: string;
  prompt: string;
  printifyProductId: string;
  shopifyUrl?: string;
  publishedAt: string;
} | null> {
  try {
    const item = await db.shirtHistory.get(imageHash);

    if (
      item &&
      item.lifecycle === ImageLifecycleState.PUBLISHED &&
      item.printifyProductId
    ) {
      return {
        productName: item.generatedTitle || item.productName || "Untitled",
        prompt: item.originalPrompt || item.prompt || "",
        printifyProductId: item.printifyProductId,
        shopifyUrl: item.shopifyUrl,
        publishedAt:
          item.publishedAt || item.createdAt || item.generatedAt || "",
      };
    }

    return null;
  } catch (error) {
    console.warn("Failed to get published product:", error);
    return null;
  }
}

/**
 * Check if an image has already been published
 */
export async function isImagePublished(imageHash: string): Promise<boolean> {
  const publishedProduct = await getPublishedProduct(imageHash);
  return publishedProduct !== null;
}

/**
 * Get image record by hash
 */
export async function getImageRecord(imageHash: string) {
  try {
    return await db.shirtHistory.get(imageHash);
  } catch (error) {
    console.warn("Failed to get image record:", error);
    return null;
  }
}

/**
 * Check if an image exists in database (regardless of publish status)
 */
export async function imageExists(imageHash: string): Promise<boolean> {
  try {
    const item = await db.shirtHistory.get(imageHash);
    return item !== undefined;
  } catch (error) {
    console.warn("Failed to check if image exists:", error);
    return false;
  }
}
