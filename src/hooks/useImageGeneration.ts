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
import { upload } from "@vercel/blob/client";

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

  // Upload image to Vercel Blob and return public URL
  const uploadImageToBlob = async (
    dataUrl: string,
    imageHash: string,
  ): Promise<string> => {
    try {
      console.log("☁️ Uploading image to Vercel Blob...");

      // Convert data URL to File
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], "design.png", { type: "image/png" });

      // Upload to Blob with deterministic path based on hash
      const blobPath = `designs/${imageHash}.png`;
      const baseUrl = import.meta.env.DEV ? "http://localhost:3000" : "";
      const handleUploadUrl = `${baseUrl}/api/blob/upload`;

      const { url } = await upload(blobPath, file, {
        access: "public",
        contentType: "image/png",
        handleUploadUrl,
      });

      console.log("✅ Image uploaded to Blob:", url);
      return url;
    } catch (error) {
      console.error("❌ Failed to upload image to Blob:", error);
      throw error;
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
          image_url: `data:image/png;base64,${base64Image}`,
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

      const processor = new ImageGenerationStreamProcessor({
        onResponseId: id => {
          console.log("🆔 Setting responseId in useImageGeneration:", id);
          responseId = id;
        },
        onPartialImage: (imageUrl, partialIndex) => {
          console.log(`🖼️ Partial image received - Index: ${partialIndex}`);

          const shirtData: ShirtData = {
            prompt,
            imageUrl,
            generatedAt: new Date().toISOString(),
            isPartial: true,
            partialIndex,
            responseId,
            designId,
          };

          setShirtData(shirtData);

          // Navigate on first partial image
          if (!hasNavigated) {
            navigate("/view");
            hasNavigated = true;
          }
        },
        onResponseCompleted: () => {
          // Stream completed - onFinalImage handles the final image processing
          // This is just a signal that the stream is done
        },
        onFinalImage: async imageUrl => {
          console.log("🎯 Final image received - uploading to Blob");

          try {
            // Upload image to Vercel Blob
            const imageHash = await generateDataUrlHash(imageUrl);
            const blobUrl = await uploadImageToBlob(imageUrl, imageHash);

            const finalData: ShirtData = {
              prompt,
              imageUrl: blobUrl, // Use Blob URL instead of data URL
              generatedAt: new Date().toISOString(),
              responseId,
              isPartial: false,
              partialIndex: -1,
              designId,
            };

            // Update shirt data with final image (this renders it on the shirt)
            setShirtData(finalData);
            setIsLoading(false);

            // Generate title and save to history after rendering
            generateSmartTitle(prompt, blobUrl);

            if (onShirtComplete) {
              try {
                await onShirtComplete(finalData);
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
          } catch (error) {
            console.error("Failed to upload image to Blob:", error);
            // Fallback to using data URL if Blob upload fails
            const finalData: ShirtData = {
              prompt,
              imageUrl,
              generatedAt: new Date().toISOString(),
              responseId,
              isPartial: false,
              partialIndex: -1,
              designId,
            };
            setShirtData(finalData);
            setIsLoading(false);
            handleError(
              "Failed to upload image to storage. Using temporary URL.",
              error,
            );
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
