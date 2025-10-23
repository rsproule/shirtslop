import type { EchoUser } from "@merit-systems/echo-react-sdk";
import type { ShirtStyle } from "@/services/printify/types";

/**
 * Format a prompt chain into a numbered list for product descriptions
 */
export const formatPromptChain = (promptChain: string[]): string => {
  if (!promptChain || promptChain.length === 0) return "";

  if (promptChain.length === 1) {
    // Single prompt - use original format
    return `<em>"${promptChain[0]}"</em>`;
  }

  // Multiple prompts - show evolution
  const formattedSteps = promptChain
    .map((prompt, index) => {
      if (index === 0) {
        return `1. <em>"${prompt}"</em>`;
      } else {
        return `${index + 1}. <em>"${prompt}"</em>`;
      }
    })
    .join("<br>");

  return formattedSteps;
};

/**
 * Get shirt-specific product details text
 */
const getShirtDetails = (shirtStyle: ShirtStyle): string => {
  if (shirtStyle === "street") {
    return `Product Details:
 Printed on Shaka Wear heavyweight tees
– 7.5 oz, 100% cotton
– Oversized, boxy streetwear fit
– Extra thick, durable fabric
– Pre-shrunk for lasting quality
– Unisex sizing: built for the streets`;
  } else {
    return `Product Details:
 Printed on 100% ring-spun cotton Comfort Colors tees
– Pre-shrunk, soft-washed, garment-dyed fabric
– Relaxed fit with vintage fade
– Double-stitched for durability
– Unisex sizing: comfortable, built for slopping`;
  }
};

export const PRODUCT_DESCRIPTION_TEMPLATE = (
  creator: EchoUser | null,
  prompt?: string,
  promptChain?: string[],
  shirtStyle: ShirtStyle = "standard",
) => {
  // Use prompt chain if available, otherwise fall back to single prompt
  const designText =
    promptChain && promptChain.length > 0
      ? formatPromptChain(promptChain)
      : prompt
        ? `<em>"${prompt}"</em>`
        : "";

  const shirtTypeName = shirtStyle === "street" ? "streetwear" : "Comfort Colors";
  const shirtDetails = getShirtDetails(shirtStyle);

  return `
Created on <a href="https://shirtslop.com" target="_blank" rel="noopener noreferrer">shirtslop.com</a>

ShirtSlop Tees
So Soft. So Shirt. So Slop.

At ShirtSlop, we take your ideas, inside jokes, and designs — and print them on ${shirtTypeName} tees.

${shirtDetails}
${designText ? `<br><br>Design Evolution:<br>${designText}` : ""}
${creator ? `<br><br>by: ${creator.name || creator.email}` : ""}
${creator?.id ? `<br><br><span style="color: #888;">[${creator.id}]</span>` : ""}
`;
};
