import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TexturePlacement } from "@/types";

interface PlacementControlsProps {
  placement: TexturePlacement;
  onPlacementChange: (placement: TexturePlacement) => void;
}

export function PlacementControls({
  placement,
  onPlacementChange,
}: PlacementControlsProps) {
  return (
    <div className="flex justify-center">
      <ToggleGroup
        type="single"
        value={placement}
        onValueChange={value => {
          if (value) onPlacementChange(value as TexturePlacement);
        }}
        variant="outline"
        size="sm"
        className="flex-row"
      >
        <ToggleGroupItem value="front" className="px-3 py-1 sm:px-4 sm:py-2">
          Front
        </ToggleGroupItem>
        <ToggleGroupItem value="back" className="px-3 py-1 sm:px-4 sm:py-2">
          Back
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
