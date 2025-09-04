import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, SlidersVertical } from "lucide-react";

export type Quality = "high" | "medium" | "low";

interface QualitySelectorProps {
  quality: Quality;
  onQualityChange: (quality: Quality) => void;
  disabled?: boolean;
}

const QUALITY_OPTIONS = [
  {
    value: "low" as const,
    label: "Fast",
    description: "Quick generation, lower quality",
    cost: "~$0.02",
  },
  {
    value: "medium" as const,
    label: "Default",
    description: "Balanced speed and quality",
    cost: "~$0.06",
  },
  {
    value: "high" as const,
    label: "Best",
    description: "Smartest best quality, slower generation",
    cost: "~$0.25",
  },
];

export function QualitySelector({
  quality,
  onQualityChange,
  disabled,
}: QualitySelectorProps) {
  const currentOption = QUALITY_OPTIONS.find(
    option => option.value === quality,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-8 w-8 p-0"
          title={`Quality: ${currentOption?.label} - ${currentOption?.description}`}
        >
          <SlidersVertical className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-48">
        {QUALITY_OPTIONS.map(option => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onQualityChange(option.value)}
            className="flex cursor-pointer flex-col items-start gap-1 p-3"
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium">{option.label}</span>
                <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">
                  {option.cost}
                </span>
              </div>
              {quality === option.value && <Check className="h-3 w-3" />}
            </div>
            <span className="text-muted-foreground text-xs">
              {option.description}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
