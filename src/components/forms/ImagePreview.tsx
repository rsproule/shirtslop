import { Button } from "@/components/ui/button";
import { ImageUp, X } from "lucide-react";
import { useRef } from "react";

interface ImagePreviewProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  isAuthenticated: boolean;
}

export function ImagePreview({
  images,
  onImagesChange,
  isAuthenticated,
}: ImagePreviewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper function to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Extract base64 data without the data URL prefix
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle file upload
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      const newImages: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith("image/")) {
          const base64 = await fileToBase64(file);
          newImages.push(base64);
        }
      }

      if (newImages.length > 0) {
        onImagesChange([...images, ...newImages]);
      }
    } catch (error) {
      console.error("Failed to process uploaded images:", error);
    }

    // Reset the input value so the same file can be uploaded again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle image removal
  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  // Handle paste events to capture images
  const handlePaste = async (e: React.ClipboardEvent) => {
    if (!isAuthenticated) return;

    const items = e.clipboardData.items;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();

        if (file) {
          try {
            const base64 = await fileToBase64(file);
            onImagesChange([...images, base64]);
          } catch (error) {
            console.error("Failed to process pasted image:", error);
          }
        }
        break;
      }
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      onPaste={handlePaste}
      tabIndex={0} // Make div focusable for paste events
    >
      {/* Upload Button */}
      <Button
        onClick={() => fileInputRef.current?.click()}
        variant="outline"
        size="sm"
        className="border-muted-foreground/30 hover:border-muted-foreground/50 bg-muted/20 hover:bg-muted/30 h-8 w-8 border-2 border-dashed p-0 transition-colors"
        title="Upload images (or paste)"
      >
        <ImageUp className="text-muted-foreground h-3 w-3" />
      </Button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Image Previews */}
      {images.map((image, index) => (
        <div key={index} className="group relative">
          <div className="border-muted-foreground/20 bg-muted/10 h-8 w-8 overflow-hidden rounded border">
            <img
              src={`data:image/jpeg;base64,${image}`}
              alt={`Preview ${index + 1}`}
              className="h-full w-full object-cover"
            />
          </div>
          {/* Remove button */}
          <Button
            onClick={() => removeImage(index)}
            variant="ghost"
            size="sm"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 absolute -top-1 -right-1 h-4 w-4 rounded-full p-0 opacity-0 transition-opacity group-hover:opacity-100"
            title="Remove image"
          >
            <X className="h-2 w-2" />
          </Button>
        </div>
      ))}

      {/* Helper text */}
      {images.length === 0 && (
        <div className="text-muted-foreground ml-2 hidden text-xs sm:block">
          Upload images or paste
        </div>
      )}
    </div>
  );
}
