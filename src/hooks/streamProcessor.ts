import type { Stream } from "openai/core/streaming.mjs";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";

interface StreamCallbacks {
  onResponseId?: (responseId: string) => void;
  onPartialImage?: (imageUrl: string, partialIndex: number) => void;
  onFinalImage?: (imageUrl: string) => void;
  onResponseCompleted?: () => void;
  onError?: (error: string) => void;
}

export class ImageGenerationStreamProcessor {
  private responseId: string | undefined;
  private callbacks: StreamCallbacks;

  constructor(callbacks: StreamCallbacks) {
    this.callbacks = callbacks;
  }

  getResponseId(): string | undefined {
    return this.responseId;
  }

  async processStream(
    stream: Stream<ResponseStreamEvent>,
  ): Promise<string | undefined> {
    try {
      for await (const event of stream) {
        await this.processEvent(event);
      }
      return this.responseId;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Stream processing failed";
      this.callbacks.onError?.(errorMessage);
      throw error;
    }
  }

  private async processEvent(event: ResponseStreamEvent): Promise<void> {
    console.log("📡 Stream event type:", event.type);

    // Debug raw event for image generation events
    if (event.type.includes("image_generation_call")) {
      console.log("📡 Raw event data:", event);
    }

    // Capture response ID from completed event
    if (
      event.type === "response.completed" &&
      "response" in event &&
      event.response?.id
    ) {
      this.responseId = event.response.id;
      console.log("🆔 Captured response ID:", this.responseId);
      console.log("✅ Response completed - triggering final completion");
      this.callbacks.onResponseId?.(this.responseId);

      // Trigger completion since response is done
      this.callbacks.onResponseCompleted?.();
      return;
    }

    // Handle errors
    if (event.type === "error" && "error" in event) {
      const errorMessage = event.message || "Stream error occurred";
      throw new Error(errorMessage);
    }

    // Handle response-level errors
    if (event.type === "response.failed" && "response" in event) {
      const errorMessage =
        event.response?.error?.message || "Response error occurred";
      throw new Error(errorMessage);
    }

    // Handle partial images
    if (event.type === "response.image_generation_call.partial_image") {
      console.log("📡 Stream event: partial_image");
      // The actual structure will be revealed by the raw event data logging above
      // For now, let's handle it based on the OpenAI structure
      if ("partial_image_b64" in event && "partial_image_index" in event) {
        const imageBase64 = event.partial_image_b64;
        const partialIndex = event.partial_image_index ?? 0;
        console.log(`📡 Partial image - Index: ${partialIndex}`);
        console.log(`📡 Has image data: ${!!imageBase64}`);
        console.log(`📡 Image data length: ${imageBase64?.length || 0}`);
        if (imageBase64) {
          const imageUrl = `data:image/png;base64,${imageBase64}`;
          this.callbacks.onPartialImage?.(imageUrl, partialIndex);
        } else {
          console.warn(`⚠️ Partial image ${partialIndex} has no image data`);
        }
      }
    }

    // Handle final image from output_item.done event
    if (event.type === "response.output_item.done" && "item" in event) {
      const item = (event as { item?: { type?: string; result?: string } })
        .item;
      if (
        item?.type === "image_generation_call" &&
        item?.result &&
        typeof item.result === "string"
      ) {
        const imageUrl = `data:image/png;base64,${item.result}`;
        this.callbacks.onFinalImage?.(imageUrl);
      }
    }
  }
}
