import { useShirtData } from "@/context/useShirtData";
import { ImageGenerationStreamProcessor } from "@/hooks/streamProcessor";
import { useShirtHistory } from "@/hooks/useShirtHistory";
import { generateDataUrlHash } from "@/services/imageHash";
import { useNameGeneration } from "@/services/nameGeneration";
import type { ShirtData } from "@/types";
import { useEchoOpenAI } from "@merit-systems/echo-react-sdk";
import type { Stream } from "openai/core/streaming.mjs";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import { useNavigate } from "react-router-dom";

type Quality = "high" | "medium" | "low";

const QUALITY_LEVELS: Record<
  Quality,
  {
    model: string;
    partial_images: number;
    quality: string;
  }
> = {
  high: {
    model: "gpt-5",
    partial_images: 3,
    quality: "high",
  },
  medium: {
    model: "gpt-4o",
    partial_images: 3,
    quality: "medium",
  },
  low: {
    model: "gpt-4o",
    partial_images: 3,
    quality: "low",
  },
};

export function useImageGeneration(
  onShirtComplete?: (shirtData: ShirtData) => void,
  onError?: (error: string) => void,
) {
  const { openai } = useEchoOpenAI();
  const navigate = useNavigate();
  const { setShirtData, setIsLoading, setShowInsufficientBalanceModal } =
    useShirtData();
  const { generateName } = useNameGeneration();
  const { updateExternalIds, getDesignIdByHash } = useShirtHistory();

  // Update ShirtData context with designId after saving to database
  const updateDesignIdInContext = async (shirtData: ShirtData) => {
    if (!shirtData.imageUrl) return;

    try {
      const hash = await generateDataUrlHash(shirtData.imageUrl);
      const designId = await getDesignIdByHash(hash);

      if (designId) {
        console.log("🔄 Updating context with designId:", designId);
        const updatedShirtData = { ...shirtData, designId };
        setShirtData(updatedShirtData);
      }
    } catch (error) {
      console.error("Failed to update designId in context:", error);
    }
  };

  // Generate smart title in background
  const generateSmartTitle = async (prompt: string, imageUrl: string) => {
    try {
      const imageHash = await generateDataUrlHash(imageUrl);
      const generatedTitle = await generateName(prompt);
      await updateExternalIds(imageHash, { generatedTitle });
      console.log("✨ Generated smart title:", generatedTitle);
    } catch (error) {
      console.warn("Failed to generate smart title:", error);
    }
  };

  // Handle errors consistently
  const handleError = (error: string, originalError?: unknown) => {
    console.error("Image generation error:", originalError || error);
    setIsLoading(false);
    setShirtData(null);

    if (window.location.pathname === "/view") {
      navigate("/");
    }

    if (onError) {
      onError(error);
    } else {
      alert(error);
    }
  };

  // Create stream request configuration
  const createStreamRequest = (
    prompt: string,
    base64Images?: string[],
    quality: Quality = "high",
    editResponseId?: string,
  ) => {
    const imagePrompt = `Generate an image for: ${prompt}.
     
    IMPORTANT: DO NOT INCLUDE AN IMAGE ON A SHIRT. JUST INCLUDE THE IMAGE`;

    let input: unknown;

    if (base64Images && base64Images.length > 0) {
      // Image input mode
      const content = [
        {
          type: "input_text",
          text: imagePrompt,
        },
        ...base64Images.map(base64Image => ({
          type: "input_image",
          image_url: `data:image/jpeg;base64,${base64Image}`,
        })),
      ];

      input = [
        {
          role: "user",
          content,
        },
      ];
    } else {
      // Text-only mode
      input = imagePrompt;
    }

    return {
      model: QUALITY_LEVELS[quality].model,
      input: input as string,
      stream: true,
      previous_response_id: editResponseId,
      tools: [
        {
          type: "image_generation" as const,
          quality: QUALITY_LEVELS[quality].quality,
          size: "1024x1536",
          partial_images: QUALITY_LEVELS[quality].partial_images,
          moderation: "low",
          input_fidelity:
            base64Images && base64Images.length > 0 ? "high" : "low",
        },
      ],
    } as unknown; // Type assertion for custom Echo API format
  };

  // Core image generation logic
  const performImageGeneration = async (
    prompt: string,
    base64Images?: string[],
    quality?: Quality,
    editResponseId?: string,
    designId?: string,
  ) => {
    setIsLoading(true);

    try {
      const requestConfig = createStreamRequest(
        prompt,
        base64Images,
        quality,
        editResponseId,
      );
      const stream = await openai.responses.create(
        requestConfig as Parameters<typeof openai.responses.create>[0],
      );

      let hasNavigated = false;
      let responseId: string | undefined;
      let lastPartialImage:
        | { imageUrl: string; partialIndex: number }
        | undefined;

      const processor = new ImageGenerationStreamProcessor({
        onResponseId: id => {
          console.log("🆔 Setting responseId in useImageGeneration:", id);
          responseId = id;
        },
        onPartialImage: (imageUrl, partialIndex) => {
          console.log(`🖼️ Partial image received - Index: ${partialIndex}`);

          // Store the last partial image
          lastPartialImage = { imageUrl, partialIndex };

          const shirtData: ShirtData = {
            prompt,
            imageUrl,
            generatedAt: new Date().toISOString(),
            isPartial: true, // Always partial until response.completed
            partialIndex,
            responseId,
            designId, // Pass along the designId for versioning
          };

          setShirtData(shirtData);

          // Navigate on first partial image
          if (!hasNavigated) {
            navigate("/view");
            hasNavigated = true;
          }
        },
        onResponseCompleted: async () => {
          console.log(
            "🎯 Response completed - finalizing with last partial image",
          );
          console.log("🆔 ResponseId available in completion:", responseId);

          if (lastPartialImage) {
            const finalData: ShirtData = {
              prompt,
              imageUrl: lastPartialImage.imageUrl,
              generatedAt: new Date().toISOString(),
              isPartial: false,
              partialIndex: -1,
              responseId,
              designId, // Pass along the designId for versioning
            };

            console.log("🎯 Final data being sent to onShirtComplete:", {
              prompt: finalData.prompt,
              responseId: finalData.responseId,
              isPartial: finalData.isPartial,
            });

            setShirtData(finalData);
            setIsLoading(false);
            generateSmartTitle(prompt, lastPartialImage.imageUrl);

            // Call the completion callback, which will save to history
            // Wait for saving to complete before updating context
            if (onShirtComplete) {
              try {
                console.log("📁 Calling onShirtComplete with finalData:", {
                  prompt: finalData.prompt,
                  responseId: finalData.responseId,
                  designId: finalData.designId,
                  isPartial: finalData.isPartial,
                });
                await onShirtComplete(finalData);
                console.log("📁 onShirtComplete finished successfully");

                // After saving, update the context with designId if it's a new design
                if (!designId) {
                  console.log(
                    "📁 Updating context with designId for new design",
                  );
                  await updateDesignIdInContext(finalData);
                }
              } catch (error) {
                console.error("Failed to save shirt or update context:", error);
              }
            } else {
              console.warn("📁 No onShirtComplete callback provided");
            }
          } else {
            console.warn(
              "⚠️ Response completed but no partial images received",
            );
          }
        },
        onFinalImage: async imageUrl => {
          console.log("🎯 Final image received via onFinalImage callback");
          const finalData: ShirtData = {
            prompt,
            imageUrl,
            generatedAt: new Date().toISOString(),
            responseId,
            isPartial: false,
            partialIndex: -1,
            designId, // Pass along the designId for versioning
          };

          setShirtData(finalData);
          setIsLoading(false);
          generateSmartTitle(prompt, imageUrl);

          // Call the completion callback, which will save to history
          // Wait for saving to complete before updating context
          if (onShirtComplete) {
            try {
              await onShirtComplete(finalData);

              // After saving, update the context with designId if it's a new design
              if (!designId) {
                await updateDesignIdInContext(finalData);
              }
            } catch (error) {
              console.error("Failed to save shirt or update context:", error);
            }
          }

          if (!hasNavigated) {
            navigate("/view");
          }
        },
        onError: error => {
          handleError(error);
        },
      });

      await processor.processStream(
        stream as unknown as Stream<ResponseStreamEvent>, // this is rancid horrible garbage
      );
    } catch (apiError: unknown) {
      let errorMessage = "Failed to start image generation. Please try again.";

      const error = apiError as {
        message?: string;
        error?: { message?: string };
        status?: number;
      };

      if (error?.status === 401) {
        errorMessage = "Authentication failed. Please try logging in again.";
      } else if (error?.status === 429) {
        errorMessage = "Too many requests. Please wait a moment and try again.";
      } else if (error?.status === 402) {
        setShowInsufficientBalanceModal(true);
        setIsLoading(false);
        return;
      } else if (error?.message || error?.error?.message) {
        errorMessage = error.message || error?.error?.message || errorMessage;
      }

      handleError(errorMessage, apiError);
    }
  };

  // Public API
  const generateImage = async (
    prompt: string,
    base64Images?: string[],
    quality?: Quality,
  ) => {
    return performImageGeneration(prompt, base64Images, quality);
  };

  const editImage = async (
    newPrompt: string,
    originalResponseId: string,
    quality: Quality = "high",
    designId?: string,
  ) => {
    return performImageGeneration(
      newPrompt,
      undefined,
      quality,
      originalResponseId,
      designId,
    );
  };

  const generateDebugImage = (prompt: string) => {
    const shirtData: ShirtData = {
      prompt: prompt || "Debug: Gorilla image for testing",
      imageUrl: "/gorilla.jpg",
      generatedAt: new Date().toISOString(),
    };

    setShirtData(shirtData);
    onShirtComplete?.(shirtData);
    navigate("/view");
  };

  return { generateImage, editImage, generateDebugImage };
}
