// Note: createProductIdentifier is used by the main service, not directly here

import type { ShirtStyle } from "./types";
// Shirt configuration presets
interface ShirtConfig {
  name: string;
  blueprint_id: number;
  print_provider_id: number;
  position_suffix: string;
  variants: number[];
  price: number;
  scale: number;
  x: number;
  y: number;
}

const SHIRT_CONFIGS: Record<ShirtStyle, ShirtConfig> = {
  street: {
    // Original ShirtSlop shirt from commit aeeffe3: Shaka Wear SHGDD.
    name: "Shaka Wear Unisex Garment-Dyed Drop-Shoulder T-Shirt",
    blueprint_id: 1723,
    print_provider_id: 74,
    position_suffix: "_dtg",
    price: 3500,
    // Original optimized Shaka payload from commit aeeffe3 (matched the bash setup).
    scale: 0.6,
    x: 0.5,
    y: 0.5,
    variants: [
      118073, 118074, 118075, 118081, 118082, 118083, 118089, 118090, 118091,
      118102, 118106, 118107,
    ],
  },
  standard: {
    name: "Comfort Colors T-Shirt",
    blueprint_id: 706,
    print_provider_id: 99,
    position_suffix: "",
    price: 2500,
    scale: 0.625,
    x: 0.5,
    y: 0.5,
    variants: [
      78994, 73199, 78993, 78962, 78991, 78964, 78961, 78963, 73203, 78992,
      73211, 73207, 78965, 73215, 78995,
    ],
  },
};

interface CreateProductVariant {
  id: number;
  price: number; // Price in cents
  is_enabled: boolean;
}

export interface CreateProductPayload {
  title: string;
  description: string;
  blueprint_id: number;
  print_provider_id: number;
  variants: CreateProductVariant[];
  print_areas: Array<{
    variant_ids: number[];
    placeholders: Array<{
      position: string;
      images: Array<{
        id: string;
        x: number;
        y: number;
        scale: number;
        angle: number;
      }>;
    }>;
  }>;
}

/**
 * Product configuration and payload building utilities
 * Handles product descriptions, configurations, and API payload creation
 */
export class ProductBuilder {
  /**
   * Create standardized product description with branding
   */
  static createDescription(
    identifier: string,
    customDescription?: string,
    shirtStyle: ShirtStyle = "standard",
  ): string {
    if (customDescription) return customDescription;

    if (shirtStyle === "street") {
      return `Created on <a href="https://shirtslop.com" target="_blank">https://shirtslop.com</a>\n\nShirtSlop Tees\nSo Soft. So Shirt. So Slop.\n\nAt ShirtSlop, we take your ideas, inside jokes, and designs — and print them on Shaka Wear heavyweight tees.\n\nProduct Details:\n– Printed on Shaka Wear Max Heavyweight 7.5 oz tees\n– 100% cotton, extra thick and durable\n– Oversized streetwear fit\n– Double-stitched for durability\n– Unisex sizing: comfortable, built for slopping\n\nID: ${identifier}`;
    }

    return `Created on <a href="https://shirtslop.com" target="_blank">https://shirtslop.com</a>\n\nShirtSlop Tees\nSo Soft. So Shirt. So Slop.\n\nAt ShirtSlop, we take your ideas, inside jokes, and designs — and print them on Comfort Colors tees.\n\nProduct Details:\n– Printed on 100% ring-spun cotton Comfort Colors tees\n– Pre-shrunk, soft-washed, garment-dyed fabric\n– Relaxed fit with vintage fade\n– Double-stitched for durability\n– Unisex sizing: comfortable, built for slopping\n\nID: ${identifier}`;
  }

  /**
   * Create complete product payload for Printify API
   */
  static createProductPayload(
    productName: string,
    description: string,
    uploadedImageId: string,
    placement: "front" | "back" = "front",
    shirtStyle: ShirtStyle = "standard",
  ): CreateProductPayload {
    const shirtConfig = SHIRT_CONFIGS[shirtStyle];

    console.log("Creating product with shirtConfig", shirtConfig);
    console.log("Placement:", placement);

    // Determine the actual position to send to Printify
    // The Shaka Wear drop-shoulder blueprint uses DTG-specific positions.
    const positionSuffix = shirtConfig.position_suffix;
    let printPosition: string;
    let printScale: number;
    let printX: number;
    let printY: number;

    switch (placement) {
      case "back":
        printPosition = `back${positionSuffix}`;
        printScale = shirtConfig.scale;
        printX = shirtConfig.x;
        printY = shirtConfig.y;
        break;
      case "front":
      default:
        printPosition = `front${positionSuffix}`;
        printScale = shirtConfig.scale;
        printX = shirtConfig.x;
        printY = shirtConfig.y;
        break;
    }

    return {
      title: productName,
      description,
      blueprint_id: shirtConfig.blueprint_id,
      print_provider_id: shirtConfig.print_provider_id,
      variants: shirtConfig.variants.map(variantId => ({
        id: variantId,
        price: shirtConfig.price,
        is_enabled: true,
      })),
      print_areas: [
        {
          variant_ids: shirtConfig.variants,
          placeholders: [
            {
              position: printPosition,
              images: [
                {
                  id: uploadedImageId,
                  x: printX,
                  y: printY,
                  scale: printScale,
                  angle: 0,
                },
              ],
            },
          ],
        },
      ],
    };
  }

  /**
   * Get available shirt configurations
   */
  static getShirtConfigs(): Record<ShirtStyle, ShirtConfig> {
    return SHIRT_CONFIGS;
  }

  /**
   * Get shirt configuration by style
   */
  static getShirtConfig(style: ShirtStyle): ShirtConfig {
    return SHIRT_CONFIGS[style];
  }

  /**
   * Get display information for a shirt style
   */
  static getShirtStyleInfo(style: ShirtStyle): {
    displayName: string;
    price: number;
    priceFormatted: string;
  } {
    const config = this.getShirtConfig(style);
    return {
      displayName: style === "street" ? "Street Style" : "Standard",
      price: config.price,
      priceFormatted: `$${(config.price / 100).toFixed(2)}`,
    };
  }
}
