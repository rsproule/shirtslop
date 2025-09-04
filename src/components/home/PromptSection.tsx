import { ImagePreview } from "@/components/forms/ImagePreview";
import { PromptHistory } from "@/components/forms/PromptHistory";
import { PromptInput } from "@/components/forms/PromptInput";
import {
  QualitySelector,
  type Quality,
} from "@/components/forms/QualitySelector";
import { PulsatingButton } from "@/components/magicui/pulsating-button";
import { Button } from "@/components/ui/button";
import { FavoritesDisplay } from "@/components/ui/FavoritesDisplay";
import { ThemeButtons } from "@/components/ui/theme-buttons";
import { useShirtData } from "@/context/useShirtData";
import { useFavoriteThemes } from "@/hooks/useFavoriteThemes";
import { useThemeSuggestions } from "@/hooks/useThemeSuggestions";
import { SHOPIFY_URL } from "@/lib/utils";
import { StoreIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface PromptSectionProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  onGenerate: (
    enhancedPrompt?: string,
    base64Images?: string[],
    quality?: Quality,
  ) => void;
  onSelectFromHistory: (prompt: string) => void;
  createFullPrompt: (userPrompt: string, themes: string[]) => string;
}

export function PromptSection({
  prompt,
  setPrompt,
  onGenerate,
  onSelectFromHistory,
  createFullPrompt,
}: PromptSectionProps) {
  const { signIn, user } = useShirtData();
  const { selectedThemes, toggleTheme, enhancePromptWithThemes } =
    useThemeSuggestions();
  const { addToFavorites } = useFavoriteThemes();
  const [images, setImages] = useState<string[]>([]);
  const [quality, setQuality] = useState<Quality>("high");

  // Load quality preference from localStorage on mount
  useEffect(() => {
    const savedQuality = localStorage.getItem("imageQuality") as Quality;
    if (savedQuality && ["low", "medium", "high"].includes(savedQuality)) {
      setQuality(savedQuality);
    }
  }, []);

  // Save quality preference to localStorage when it changes
  const handleQualityChange = (newQuality: Quality) => {
    setQuality(newQuality);
    localStorage.setItem("imageQuality", newQuality);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setPrompt(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd+Enter or Ctrl+Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleGenerate = () => {
    if (!user) {
      alert("Please sign in to generate shirt designs");
      return;
    }

    // Add selected themes to favorites when used
    selectedThemes.forEach(theme => addToFavorites(theme));

    // Enhance prompt with selected themes before calling onGenerate
    const enhancedPrompt = enhancePromptWithThemes(prompt, selectedThemes);
    onGenerate(enhancedPrompt, images.length > 0 ? images : undefined, quality);
  };

  const handleSelectFromHistory = (selectedPrompt: string) => {
    setPrompt(selectedPrompt);
    onSelectFromHistory(selectedPrompt);
  };

  const handleThemeSelect = (theme: string) => {
    toggleTheme(theme);
  };

  const handleImagePaste = (base64: string) => {
    setImages([...images, base64]);
  };

  const fullPromptPreview = createFullPrompt(prompt, selectedThemes);

  return (
    <div className="mx-auto mt-8 w-full max-w-[520px] px-4 sm:max-w-3xl sm:px-8 lg:max-w-7xl">
      {/* Chat UI Container - with blur overlay when not authenticated */}
      <div className="relative">
        {/* Main Chat UI */}
        <div className={`${!user ? "pointer-events-none blur-sm" : ""}`}>
          {/* Top Section */}
          <div className="mb-1 flex items-start justify-between">
            {/* Favorites Display - Top Left */}
            <div className="flex-1">
              <FavoritesDisplay
                onThemeSelect={handleThemeSelect}
                activeThemes={selectedThemes}
              />
            </div>
            {/* History Button - Top Right */}
            <div className="flex-shrink-0">
              <PromptHistory onSelectPrompt={handleSelectFromHistory} />
            </div>
          </div>

          <PromptInput
            value={prompt}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            fullPrompt={fullPromptPreview}
            activeThemes={selectedThemes}
            onThemeRemove={handleThemeSelect}
            onImagePaste={handleImagePaste}
          />

          {/* Bottom Section with Image Preview and Action Buttons */}
          <div className="mt-4 flex items-center justify-between">
            {/* Image Preview - Left Side */}
            <div className="flex-shrink-0">
              <ImagePreview
                images={images}
                onImagesChange={setImages}
                isAuthenticated={!!user}
              />
            </div>

            {/* Generate Button and Quality Selector - Far Right */}
            <div className="flex flex-shrink-0 items-center gap-2">
              <QualitySelector
                quality={quality}
                onQualityChange={handleQualityChange}
                disabled={!user}
              />
              <PulsatingButton
                onClick={handleGenerate}
                onTouchEnd={handleGenerate}
                disabled={!user || prompt.length < 10}
                disabledAnimation={!user || prompt.length < 10}
                pulseColor="var(--primary-light)"
                className={`text-primary-foreground touch-manipulation ${
                  !user || prompt.length < 10
                    ? "bg-muted cursor-not-allowed"
                    : "bg-primary"
                }`}
              >
                Generate Design
              </PulsatingButton>
            </div>
          </div>

          {/* Theme Buttons */}
          <div className="mt-4">
            <ThemeButtons
              onThemeSelect={handleThemeSelect}
              activeThemes={selectedThemes}
            />
          </div>
        </div>

        {/* Sign-in overlay for non-authenticated users */}
        {!user && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <PulsatingButton
                onClick={signIn}
                className="bg-primary text-primary-foreground hover:bg-primary/80 px-4 py-2"
                pulseColor="var(--primary-light)"
                disabledAnimation={false}
              >
                Login to create
              </PulsatingButton>

              <div className="flex items-center gap-2">or</div>
              <Button
                variant="outline"
                onClick={() => window.open(SHOPIFY_URL, "_blank")}
                className="px-3 py-1 text-sm"
              >
                <StoreIcon className="size-3" />
                View the store
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
