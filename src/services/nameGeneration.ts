import { useEchoOpenAI } from "@merit-systems/echo-react-sdk";

export interface NameGenerationService {
  generateName: (prompt: string) => Promise<string>;
}

// Hook for name generation service
export function useNameGeneration(): NameGenerationService {
  const { openai } = useEchoOpenAI();

  const generateName = async (prompt: string): Promise<string> => {
    try {
      // Fallback to truncated prompt if anything goes wrong
      const fallbackName =
        prompt.length > 30
          ? prompt.substring(0, 30).trim() + "..."
          : prompt.trim();

      // Create a concise name generation prompt with strict character limit
      const namePrompt = `Generate a short, creative product name (MAX 30 characters) for this design: "${prompt}"

Requirements:
- Maximum 30 characters total
- 2-4 words max
- No quotes, punctuation, or branding
- Focus on the design concept, not the product type

Examples:
- "Create a dragon breathing fire" → "Dragon Fire" (11 chars)
- "Make a cute cat with sunglasses" → "Cool Cat" (8 chars)
- "Minimalist geometric pattern" → "Geometric Minimal" (17 chars)
- "Sunset over mountains" → "Mountain Sunset" (15 chars)

Just return the name, nothing else:`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Use smaller, faster model for name generation
        messages: [
          {
            role: "user",
            content: namePrompt,
          },
        ],
        max_tokens: 20,
        temperature: 0.7,
      });

      const generatedName = response.choices[0]?.message?.content?.trim();

      if (generatedName && generatedName.length > 0) {
        // Clean up the generated name (remove quotes, extra punctuation)
        let cleanName = generatedName
          .replace(/^["']|["']$/g, "") // Remove surrounding quotes
          .replace(/[.!?]+$/, "") // Remove trailing punctuation
          .trim();

        // Enforce 30 character limit
        if (cleanName.length > 30) {
          cleanName = cleanName.substring(0, 30).trim();
          // Remove incomplete word at the end
          const lastSpace = cleanName.lastIndexOf(" ");
          if (lastSpace > 15) {
            // Only trim if we have substantial content left
            cleanName = cleanName.substring(0, lastSpace);
          }
        }

        return cleanName.length > 0 ? cleanName : fallbackName;
      }

      return fallbackName;
    } catch (error) {
      console.warn("Name generation failed, using fallback:", error);
      // Return truncated prompt as fallback
      return prompt.length > 30
        ? prompt.substring(0, 30).trim() + "..."
        : prompt.trim();
    }
  };

  return { generateName };
}

// Standalone function for name generation (non-React)
export async function generateProductName(
  prompt: string,
  openaiApiKey?: string,
): Promise<string> {
  try {
    // Fallback to truncated prompt if anything goes wrong
    const fallbackName =
      prompt.length > 30
        ? prompt.substring(0, 30).trim() + "..."
        : prompt.trim();

    // If no API key, return fallback
    if (!openaiApiKey) {
      return fallbackName;
    }

    // Create a concise name generation prompt with strict character limit
    const namePrompt = `Generate a short, creative product name (MAX 30 characters) for this design: "${prompt}"

Requirements:
- Maximum 30 characters total
- 2-4 words max
- No quotes, punctuation, or branding
- Focus on the design concept, not the product type

Examples:
- "Create a dragon breathing fire" → "Dragon Fire" (11 chars)
- "Make a cute cat with sunglasses" → "Cool Cat" (8 chars)
- "Minimalist geometric pattern" → "Geometric Minimal" (17 chars)
- "Sunset over mountains" → "Mountain Sunset" (15 chars)

Just return the name, nothing else:`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: namePrompt }],
        max_tokens: 20,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedName = data.choices[0]?.message?.content?.trim();

    if (generatedName && generatedName.length > 0) {
      // Clean up the generated name
      let cleanName = generatedName
        .replace(/^["']|["']$/g, "") // Remove surrounding quotes
        .replace(/[.!?]+$/, "") // Remove trailing punctuation
        .trim();

      // Enforce 30 character limit
      if (cleanName.length > 30) {
        cleanName = cleanName.substring(0, 30).trim();
        // Remove incomplete word at the end
        const lastSpace = cleanName.lastIndexOf(" ");
        if (lastSpace > 15) {
          // Only trim if we have substantial content left
          cleanName = cleanName.substring(0, lastSpace);
        }
      }

      return cleanName.length > 0 ? cleanName : fallbackName;
    }

    return fallbackName;
  } catch (error) {
    console.warn("Name generation failed, using fallback:", error);
    return prompt.length > 30
      ? prompt.substring(0, 30).trim() + "..."
      : prompt.trim();
  }
}

// Utility function to create a DesignConfig ID
export function generateDesignId(): string {
  return `design_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// Create a unique identifier that can be embedded in product title
export function createProductIdentifier(imageHash: string): string {
  // Take first 8 chars of hash for uniqueness while keeping title short
  return imageHash.substring(0, 8);
}
