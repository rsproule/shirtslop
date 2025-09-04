import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useShirtData } from "@/context/useShirtData";

const SHIRT_COLORS = [
  { name: "White", color: "#f8f9fa", description: "Off-white" },
  { name: "Shadow", color: "#343a40", description: "Charcoal black" },
  { name: "Cream", color: "#f5f5dc", description: "Warm cream" },
];

export function ShirtColorPicker() {
  const { shirtColor, setShirtColor } = useShirtData();

  const handleColorClick = (color: string) => {
    setShirtColor(color);
  };

  return (
    <div className="flex justify-center">
      <TooltipProvider>
        <div className="flex gap-1">
          {SHIRT_COLORS.map(colorOption => (
            <Tooltip key={colorOption.color}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => handleColorClick(colorOption.color)}
                  className={`h-8 w-8 rounded border-2 transition-all ${
                    shirtColor === colorOption.color
                      ? "border-foreground"
                      : "border-border hover:border-muted-foreground"
                  }`}
                  style={{ backgroundColor: colorOption.color }}
                  aria-label={`Select ${colorOption.name} shirt color`}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>{colorOption.name}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
