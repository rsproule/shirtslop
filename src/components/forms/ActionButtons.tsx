import { PulsatingButton } from "@/components/magicui/pulsating-button";
import { useShirtData } from "@/context/useShirtData";

interface ActionButtonsProps {
  onGenerate: (enhancedPrompt?: string) => void;
  promptLength: number;
}

export function ActionButtons({
  onGenerate,
  promptLength,
}: ActionButtonsProps) {
  const { user } = useShirtData();

  const handleGenerate = () => {
    console.log(
      "Generate button clicked - isAuthenticated:",
      !!user,
      "promptLength:",
      promptLength,
    );
    if (!user) {
      alert("Please sign in to generate shirt designs");
      return;
    }
    onGenerate();
  };

  return (
    <div className="mt-8 flex justify-center sm:justify-end">
      <PulsatingButton
        onClick={handleGenerate}
        onTouchEnd={handleGenerate}
        disabled={!user || promptLength < 10}
        disabledAnimation={!user || promptLength < 10}
        pulseColor="var(--primary-light)"
        className={`text-primary-foreground touch-manipulation ${
          !user || promptLength < 10
            ? "bg-muted cursor-not-allowed"
            : "bg-primary"
        }`}
      >
        Generate Design
      </PulsatingButton>
    </div>
  );
}
