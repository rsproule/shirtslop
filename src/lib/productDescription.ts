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
 * Get shirt style details for product descriptions
 */
const getShirtDetails = (shirtStyle: ShirtStyle): string => {
  if (shirtStyle === "street") {
    return `Printed on Shaka Wear Max Heavyweight 7.5 oz tees — thick, oversized streetwear fit.`;
  }
  return `Printed on 100% ring-spun cotton Comfort Colors tees — soft-washed, garment-dyed, relaxed fit.`;
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

  const shirtDetails = getShirtDetails(shirtStyle);

  return `
Created on <a href="https://shirtslop.com" target="_blank" rel="noopener noreferrer">shirtslop.com</a>
<br><br>${shirtDetails}
${designText ? `<br><br>Design Evolution:<br>${designText}` : ""}
${creator ? `<br><br>by: ${creator.name || creator.email}` : ""}
${creator?.id ? `<br><br><span style="color: #888;">[${creator.id}]</span>` : ""}
`;
};
