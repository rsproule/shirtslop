import type { EchoUser } from "@merit-systems/echo-react-sdk";

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

export const PRODUCT_DESCRIPTION_TEMPLATE = (
  creator: EchoUser | null,
  prompt?: string,
  promptChain?: string[],
) => {
  // Use prompt chain if available, otherwise fall back to single prompt
  const designText =
    promptChain && promptChain.length > 0
      ? formatPromptChain(promptChain)
      : prompt
        ? `<em>"${prompt}"</em>`
        : "";

  return `
Created on <a href="https://shirtslop.com" target="_blank" rel="noopener noreferrer">shirtslop.com</a>
${designText ? `<br><br>Design Evolution:<br>${designText}` : ""}
${creator ? `<br><br>by: ${creator.name || creator.email}` : ""}
${creator?.id ? `<br><br><span style="color: #888;">[${creator.id}]</span>` : ""}
`;
};
