import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShirtData } from "@/context/useShirtData";
import { useShirtHistory } from "@/hooks/useShirtHistory";
import { useState } from "react";
import { Toast } from "./Toast";

export function SaveButton() {
  const { shirtData } = useShirtData();
  const { addToHistory } = useShirtHistory();
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleSave = async () => {
    if (!shirtData?.imageUrl || !shirtData?.prompt) return;

    setIsSaving(true);
    try {
      await addToHistory(shirtData);
      setShowToast(true);
    } catch (error) {
      console.error("Failed to save design:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const isDisabled =
    !shirtData?.imageUrl ||
    !shirtData?.prompt ||
    shirtData?.isPartial !== false;

  return (
    <>
      <Button
        onClick={handleSave}
        disabled={isDisabled || isSaving}
        size="sm"
        variant="outline"
        className="flex items-center gap-2"
      >
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {isSaving
          ? "Saving..."
          : shirtData?.isPartial
            ? "Generating..."
            : "Save"}
      </Button>

      <Toast
        message="Design saved to recent designs!"
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </>
  );
}
