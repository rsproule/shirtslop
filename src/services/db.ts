import Dexie, { type EntityTable } from "dexie";

export const ImageLifecycleState = {
  DRAFTED: "drafted", // Generated locally, not uploaded anywhere
  UPLOADING: "uploading", // Currently being uploaded to Printify
  UPLOADED: "uploaded", // Uploaded to Printify, not yet published
  PUBLISHING: "publishing", // Currently being published to Shopify
  PUBLISHED: "published", // Successfully published to Shopify
  FAILED: "failed", // Publishing failed, can retry
} as const;

export type ImageLifecycleState =
  (typeof ImageLifecycleState)[keyof typeof ImageLifecycleState];

// Core design entity - one per design concept
export interface ShirtDesign {
  designId: string; // UUID - PRIMARY KEY
  originalPrompt: string; // The first prompt that created this design
  generatedTitle?: string; // LLM-generated short title/summary
  createdAt: string; // When this design was first created
  updatedAt: string; // When this design was last modified
  currentVersion: number; // Current/latest version number
  lifecycle: ImageLifecycleState; // Current lifecycle state

  // External platform tracking (for the current version)
  printifyImageId?: string; // Printify uploaded image ID
  printifyProductId?: string; // Printify product ID
  shopifyProductId?: string; // Shopify product ID
  shopifyUrl?: string; // Direct Shopify store link
}

// Individual version of a design - one per generated image
export interface ShirtVersion {
  hash: string; // SHA-256 hash of the image - PRIMARY KEY
  designId: string; // Links to ShirtDesign.designId
  versionNumber: number; // Version number (1, 2, 3, etc.)
  prompt: string; // Prompt used for this specific version
  imageUrl: string; // Base64 data URL of the image
  responseId?: string; // OpenAI response ID for this version
  createdAt: string; // When this version was created
  quality: string; // Quality setting used ("low", "medium", "high")
  parentHash?: string; // Hash of the version this was based on (for edits)
  isLatestVersion: boolean; // True for the most recent version

  // Full prompt evolution chain for product descriptions
  promptChain?: string[]; // Array of all prompts from original to this version

  // Generation metadata for this specific version
  generationParams?: {
    model: string;
    quality: string;
    partialImages: number;
  };
}

// Simple table to track all published products by hash
export interface PublishedProduct {
  hash: string; // SHA-256 hash of the image - PRIMARY KEY
  productName: string; // Name of the published product
  printifyProductId: string; // Printify product ID
  shopifyUrl: string; // Direct Shopify store URL
  publishedAt: string; // When it was published
  createdBy?: string; // User ID who published it (optional)
}

export interface ShirtHistoryItem {
  hash: string; // SHA-256 hash as PRIMARY KEY - KEEP existing system
  originalPrompt: string; // Full original user prompt
  generatedTitle?: string; // LLM-generated short title/summary
  imageUrl: string; // Base64 data URL of the image
  createdAt: string; // ISO timestamp of creation
  updatedAt: string; // ISO timestamp of last update
  lifecycle: ImageLifecycleState; // Current lifecycle state

  // NEW: Versioning support (backwards compatible)
  designId?: string; // UUID linking related versions together
  versionNumber?: number; // Version number (1, 2, 3, etc.)
  isLatestVersion?: boolean; // True for the most recent version of a design
  parentHash?: string; // Hash of the image this was based on (for edits)
  versionCount?: number; // Total number of versions for this design (for UI display)

  // External platform tracking
  printifyImageId?: string; // Printify uploaded image ID
  printifyProductId?: string; // Printify product ID
  shopifyProductId?: string; // Shopify product ID
  shopifyUrl?: string; // Direct Shopify store link

  // Generation metadata
  responseId?: string; // OpenAI response ID for editing
  generationParams?: {
    model: string;
    resolution: string;
    style?: string;
  };

  // Prompt evolution tracking
  promptChain?: string[]; // Full prompt chain from original to this version

  // Publishing metadata
  publishedAt?: string;
  publishError?: string; // Last publishing error if any

  // Legacy fields for backward compatibility
  id?: string; // Will be same as hash
  prompt?: string; // Will be same as originalPrompt
  generatedAt?: string; // Will be same as createdAt
  timestamp?: number; // Will be derived from createdAt
  productName?: string; // Will be same as generatedTitle
  isPublished?: boolean; // Will be derived from lifecycle state
}

export interface PromptHistoryItem {
  id: string;
  text: string;
  timestamp: string;
}

const db = new Dexie("InstashirtDB") as Dexie & {
  // Legacy table (will be migrated)
  shirtHistory: EntityTable<ShirtHistoryItem, "hash">;
  promptHistory: EntityTable<PromptHistoryItem, "id">;

  // New proper schema
  designs: EntityTable<ShirtDesign, "designId">;
  versions: EntityTable<ShirtVersion, "hash">;

  // Simple published products tracking
  publishedProducts: EntityTable<PublishedProduct, "hash">;
};

db.version(1).stores({
  shirtHistory: "id, timestamp", // Legacy schema
  promptHistory: "id, timestamp",
});

// Version 2: Migration to hash-based primary key
db.version(2).stores({
  shirtHistory:
    "hash, createdAt, lifecycle, printifyProductId, shopifyProductId",
  promptHistory: "id, timestamp",
});

// Version 3: Add versioning support (backwards compatible)
db.version(3)
  .stores({
    shirtHistory:
      "hash, createdAt, lifecycle, printifyProductId, shopifyProductId, designId, versionNumber, isLatestVersion",
    promptHistory: "id, timestamp",
  })
  .upgrade(async tx => {
    // Add versioning fields to existing items
    const items = await tx.table("shirtHistory").toArray();

    for (const item of items) {
      if (!item.designId) {
        // Generate UUID for existing items and mark as version 1
        const designId = crypto.randomUUID();

        await tx.table("shirtHistory").update(item.hash, {
          designId: designId,
          versionNumber: 1,
          isLatestVersion: true,
          parentHash: undefined,
        });
      }
    }
  });

// Keep the existing version 2 migration
db.version(2).upgrade(async tx => {
  // Migrate existing data to use hash as primary key
  const oldItems = await tx.table("shirtHistory").toArray();

  for (const item of oldItems) {
    if (item.id && item.imageUrl && item.prompt) {
      try {
        // Generate hash from existing image URL
        const { generateDataUrlHash } = await import("./imageHash");
        const hash = await generateDataUrlHash(item.imageUrl);

        // Create new item with hash-based structure
        const newItem: ShirtHistoryItem = {
          hash,
          originalPrompt: item.prompt,
          imageUrl: item.imageUrl,
          createdAt: item.generatedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lifecycle: item.isPublished
            ? ImageLifecycleState.PUBLISHED
            : ImageLifecycleState.DRAFTED,
          printifyProductId: item.printifyProductId,
          shopifyUrl: item.shopifyUrl,
          generatedTitle: item.productName,
          publishedAt: item.publishedAt,

          // Legacy compatibility fields
          id: hash,
          prompt: item.prompt,
          generatedAt: item.generatedAt,
          timestamp: item.timestamp,
          productName: item.productName,
          isPublished: item.isPublished,
        };

        // Add the migrated item (will replace due to same hash)
        await tx.table("shirtHistory").put(newItem);
      } catch (error) {
        console.warn(`Failed to migrate item ${item.id}:`, error);
      }
    }
  }
});

// Version 4: Create proper design/version schema and migrate from legacy
db.version(4)
  .stores({
    shirtHistory:
      "hash, createdAt, lifecycle, printifyProductId, shopifyProductId, designId, versionNumber, isLatestVersion", // Keep legacy for compatibility
    promptHistory: "id, timestamp",
    // New proper tables
    designs: "designId, createdAt, updatedAt, lifecycle", // Designs table
    versions:
      "hash, designId, versionNumber, createdAt, isLatestVersion, promptChain", // Versions table
  })
  .upgrade(async tx => {
    console.log("🏗️ Creating new design/version schema and migrating data...");

    // Get all existing shirt history items with designId
    const legacyItems = await tx.table("shirtHistory").toArray();
    console.log(
      `Found ${legacyItems.length} legacy items to migrate to new schema`,
    );

    const designsMap = new Map<string, ShirtDesign>();
    const versionsArray: ShirtVersion[] = [];

    for (const item of legacyItems) {
      if (!item.designId) {
        console.warn("Skipping item without designId:", item.hash);
        continue;
      }

      // Create or update design
      if (!designsMap.has(item.designId)) {
        const design: ShirtDesign = {
          designId: item.designId,
          originalPrompt: item.originalPrompt,
          generatedTitle: item.generatedTitle,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          currentVersion: 1, // Will be updated later
          lifecycle: item.lifecycle,
          printifyImageId: item.printifyImageId,
          printifyProductId: item.printifyProductId,
          shopifyProductId: item.shopifyProductId,
          shopifyUrl: item.shopifyUrl,
        };
        designsMap.set(item.designId, design);
      }

      // Create version
      const version: ShirtVersion = {
        hash: item.hash,
        designId: item.designId,
        versionNumber: item.versionNumber || 1,
        prompt: item.prompt || item.originalPrompt,
        imageUrl: item.imageUrl,
        responseId: item.responseId,
        createdAt: item.createdAt,
        quality: "high", // Default since we don't have this data
        parentHash: item.parentHash,
        isLatestVersion: item.isLatestVersion || false,
        promptChain: [item.prompt || item.originalPrompt], // Initialize with single prompt
        generationParams: item.generationParams,
      };
      versionsArray.push(version);
    }

    // Update currentVersion for each design
    for (const [designId, design] of designsMap.entries()) {
      const designVersions = versionsArray.filter(v => v.designId === designId);
      design.currentVersion = Math.max(
        ...designVersions.map(v => v.versionNumber),
      );

      // Update the latest version timestamp
      const latestVersion = designVersions.find(
        v => v.versionNumber === design.currentVersion,
      );
      if (latestVersion) {
        design.updatedAt = latestVersion.createdAt;
      }
    }

    // Save to new tables
    console.log(
      `Creating ${designsMap.size} designs and ${versionsArray.length} versions`,
    );

    for (const design of designsMap.values()) {
      await tx.table("designs").put(design);
    }

    for (const version of versionsArray) {
      await tx.table("versions").put(version);
    }

    console.log("✅ Migration to new schema completed");
  });

// Version 5: Add simple published products tracking
db.version(5).stores({
  shirtHistory:
    "hash, createdAt, lifecycle, printifyProductId, shopifyProductId, designId, versionNumber, isLatestVersion", // Keep legacy
  promptHistory: "id, timestamp",
  designs: "designId, createdAt, updatedAt, lifecycle", // Designs table
  versions:
    "hash, designId, versionNumber, createdAt, isLatestVersion, promptChain", // Versions table
  publishedProducts: "hash, publishedAt, printifyProductId", // Simple published tracking
});

export { db };
