import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, Shirt } from "lucide-react";

export type ShirtStyle = "standard" | "street";

interface ShirtStyleSelectorProps {
  shirtStyle: ShirtStyle;
  onShirtStyleChange: (style: ShirtStyle) => void;
  disabled?: boolean;
}

const SHIRT_STYLE_OPTIONS = [
  {
    value: "standard" as const,
    label: "Standard",
    description: "Comfort Colors - Classic fit",
    cost: "$25.00",
    printifyVariantId: "10436:68",
  },
  {
    value: "street" as const,
    label: "Street Style",
    description: "Shaka Wear - Oversized thick",
    cost: "$32.00",
    printifyVariantId: "10401:2054",
  },
];

export function ShirtStyleSelector({
  shirtStyle,
  onShirtStyleChange,
  disabled,
}: ShirtStyleSelectorProps) {
  const currentOption = SHIRT_STYLE_OPTIONS.find(
    option => option.value === shirtStyle,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-8 px-3 gap-2"
          title={`Style: ${currentOption?.label} - ${currentOption?.description}`}
        >
          <Shirt className="h-3 w-3" />
          <span className="text-xs">{currentOption?.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        {SHIRT_STYLE_OPTIONS.map(option => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onShirtStyleChange(option.value)}
            className="flex cursor-pointer flex-col items-start gap-1 p-3"
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium">{option.label}</span>
                {shirtStyle === option.value && (
                  <Check className="h-3 w-3 text-primary" />
                )}
              </div>
              <span className="text-muted-foreground text-xs">{option.cost}</span>
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