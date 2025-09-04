import { Textarea } from "@/components/ui/textarea";
import { useShirtData } from "@/context/useShirtData";
import { useEffect, useRef, useState } from "react";

interface PromptInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  fullPrompt?: string; // The complete prompt including system prompt and enhancements
  activeThemes?: string[];
  onThemeRemove?: (theme: string) => void;
  onImagePaste?: (base64: string) => void;
}

export function PromptInput({
  value,
  onChange,
  onKeyDown,
  placeholder = "Describe your shirt design...",
  fullPrompt,
  activeThemes = [],
  onThemeRemove,
  onImagePaste,
}: PromptInputProps) {
  const { user } = useShirtData();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);

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

  // Handle paste events to capture images
  const handlePaste = async (e: React.ClipboardEvent) => {
    if (!user || !onImagePaste) return;

    const items = e.clipboardData.items;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();

        if (file) {
          try {
            const base64 = await fileToBase64(file);
            onImagePaste(base64);
          } catch (error) {
            console.error("Failed to process pasted image:", error);
          }
        }
        break;
      }
    }
  };

  // Auto-focus the textarea when component mounts and user is authenticated
  useEffect(() => {
    if (user && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [user]);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = "auto";
      // Set height to scrollHeight, with min height of 8rem (128px)
      const newHeight = Math.max(128, textarea.scrollHeight);
      textarea.style.height = `${newHeight}px`;
    }
  }, [value]);

  return (
    <div className="relative">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          className="bg-muted/50 min-h-32 w-full resize-none overflow-hidden rounded-lg border-0 p-4 text-base shadow-none transition-shadow duration-200 focus:ring-0 sm:text-xl"
          disabled={!user}
        />

        {/* Active Theme Chips - Desktop */}
        {activeThemes.length > 0 && user && (
          <>
            {/* Desktop: Show individual theme chips */}
            <div className="absolute bottom-3 left-3 hidden flex-wrap gap-1 sm:flex">
              {activeThemes.slice(0, 3).map(theme => (
                <button
                  key={theme}
                  onClick={() => onThemeRemove?.(theme)}
                  className="border-primary bg-primary/10 text-primary hover:border-primary hover:bg-primary/20 rounded-lg border px-2 py-1 text-xs font-medium transition-all duration-200 hover:shadow-md"
                >
                  {theme}
                </button>
              ))}
              {activeThemes.length > 3 && (
                <div className="border-primary bg-primary/10 text-primary rounded-lg border px-2 py-1 text-xs font-medium">
                  +{activeThemes.length - 3} more
                </div>
              )}
            </div>

            {/* Mobile: Show simple +n indicator */}
            <div className="absolute right-3 bottom-3 sm:hidden">
              <span className="text-primary text-xs font-medium">
                +{activeThemes.length}
              </span>
            </div>
          </>
        )}

        {/* Full Prompt Tooltip - Triggered by +n indicator */}
        {fullPrompt && user && activeThemes.length > 0 && (
          <div className="absolute right-3 bottom-3">
            <div className="relative">
              <button
                type="button"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={() => setShowTooltip(!showTooltip)}
                className="text-primary hover:text-primary/80 text-xs font-medium transition-colors sm:hidden"
              >
                +{activeThemes.length}
              </button>

              {showTooltip && (
                <div className="fixed inset-x-4 top-4 z-50 sm:absolute sm:inset-x-auto sm:right-0 sm:bottom-8 sm:w-96">
                  <div className="bg-background text-foreground max-h-64 overflow-y-auto rounded-lg border p-3 text-xs shadow-xl">
                    <div className="mb-2 font-semibold">
                      Full Prompt Preview:
                    </div>
                    <div className="break-words whitespace-pre-wrap">
                      {fullPrompt}
                    </div>
                    {/* Arrow pointing down - only on desktop */}
                    <div className="bg-background absolute right-4 -bottom-1 hidden h-2 w-2 rotate-45 border sm:block"></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
