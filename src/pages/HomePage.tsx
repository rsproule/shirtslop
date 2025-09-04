import { type Quality } from "@/components/forms/QualitySelector";
import { ShirtHistory } from "@/components/forms/ShirtHistory";
import { PromptSection } from "@/components/home/PromptSection";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { Navbar } from "@/components/layout/Navbar";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { useShirtData } from "@/context/useShirtData";
import { useImageGeneration } from "@/hooks/useImageGeneration";
import { usePromptHistory } from "@/hooks/usePromptHistory";
import { useShirtHistory } from "@/hooks/useShirtHistory";
import { useThemeSuggestions } from "@/hooks/useThemeSuggestions";
import { useEffect, useState } from "react";

export function HomePage() {
  const { isLoading, setIsLoading } = useShirtData();
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { addToHistory: addPromptToHistory } = usePromptHistory();
  const { addToHistory: addShirtToHistory } = useShirtHistory();
  const { generateImage } = useImageGeneration(addShirtToHistory, setError);
  const { enhancePromptWithThemes, getThemeSuggestion, selectedThemes } =
    useThemeSuggestions();

  // Reset loading state when component unmounts
  useEffect(() => {
    return () => {
      setIsLoading(false);
    };
  }, [setIsLoading]);

  const handleGenerate = (
    enhancedPrompt?: string,
    base64Images?: string[],
    quality?: Quality,
  ) => {
    // Clear any previous errors
    setError(null);

    if (prompt.trim().length >= 10) {
      // Add to history asynchronously (don't wait for it)
      addPromptToHistory(prompt).catch(console.error);
    }

    // Use the enhanced prompt if provided, otherwise enhance it here
    const finalPrompt =
      enhancedPrompt || enhancePromptWithThemes(prompt, selectedThemes);
    generateImage(finalPrompt, base64Images, quality);
  };

  const handleRetryGeneration = () => {
    setError(null);
    const enhancedPrompt = enhancePromptWithThemes(prompt, selectedThemes);
    generateImage(enhancedPrompt);
  };

  const handleDismissError = () => {
    setError(null);
  };

  const handleSelectFromHistory = (selectedPrompt: string) => {
    setPrompt(selectedPrompt);
  };

  // Create the full prompt that would be sent to the API
  const createFullPrompt = (userPrompt: string, themes: string[]): string => {
    if (!userPrompt.trim()) return "";

    // Get the full prompt enhancer strings for selected themes
    const themeEnhancers = themes
      .map(themeName => getThemeSuggestion(themeName))
      .filter(Boolean)
      .map(theme => theme!.promptEnhancers[0]);

    const styleGuide =
      themeEnhancers.length > 0
        ? `Style guide: ${themeEnhancers.join(", ")}`
        : "";

    const fullPrompt = `Generate an image for: ${userPrompt}.
     
${styleGuide}

IMPORTANT: DO NOT INCLUDE AN IMAGE ON A SHIRT. JUST INCLUDE THE IMAGE
      `;

    return fullPrompt;
  };

  if (isLoading) {
    return (
      <>
        <LoadingScreen />
        {/* Error Display - Show even during loading */}
        <ErrorDisplay
          error={error}
          onDismiss={handleDismissError}
          onRetry={
            prompt.trim().length >= 10 ? handleRetryGeneration : undefined
          }
          autoHide={false}
        />
      </>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-white">
      {/* Navbar */}
      <Navbar />

      {/* Prompt Section */}
      <PromptSection
        prompt={prompt}
        setPrompt={setPrompt}
        onGenerate={handleGenerate}
        onSelectFromHistory={handleSelectFromHistory}
        createFullPrompt={createFullPrompt}
      />

      {/* Shirt History - always show */}
      <div className="mx-auto mt-8 w-full max-w-7xl px-8">
        <ShirtHistory />
      </div>

      {/* Error Display */}
      <ErrorDisplay
        error={error}
        onDismiss={handleDismissError}
        onRetry={prompt.trim().length >= 10 ? handleRetryGeneration : undefined}
        autoHide={false}
      />
    </div>
  );
}
