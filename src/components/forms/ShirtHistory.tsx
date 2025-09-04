import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useShirtData } from "@/context/useShirtData";
import { useShirtHistory } from "@/hooks/useShirtHistory";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "../ui/skeleton";
import type { ShirtHistoryItem } from "@/services/db";

export function ShirtHistory() {
  const { history, isLoading, clearHistory, removeFromHistory, setLastViewed } =
    useShirtHistory();
  const { setShirtData } = useShirtData();
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  if (isLoading) {
    return (
      <div className="border-border mt-12 border-t pt-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-foreground text-lg font-medium">
            Your Recent Designs
          </h2>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card
              key={i}
              className="border-border bg-muted relative overflow-hidden border shadow-sm"
              style={{ aspectRatio: "1024/1536" }}
            >
              <CardContent className="relative h-full p-0">
                <Skeleton className="absolute inset-0 h-full w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return null;
  }

  const displayHistory = showAll ? history : history.slice(0, 6);

  const handleViewShirt = async (item: ShirtHistoryItem) => {
    const shirtData = {
      prompt: item.originalPrompt || item.prompt || "",
      imageUrl: item.imageUrl,
      generatedAt:
        item.createdAt || item.generatedAt || new Date().toISOString(),
      isPartial: false,
      partialIndex: -1,
      // Include the crucial fields for ViewPage functionality
      designId: item.designId,
      responseId: item.responseId,
    };

    // Track this as the last viewed shirt
    try {
      await setLastViewed(item.hash);
    } catch (error) {
      console.warn("Failed to track last viewed:", error);
    }

    setShirtData(shirtData);
    navigate("/view");
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="border-border mt-12 border-t pt-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-foreground text-lg font-medium">
          Your Recent Designs
        </h2>
        <div className="flex items-center gap-3">
          {history.length > 6 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="text-muted-foreground hover:text-foreground"
            >
              {showAll ? "Show Less" : `Show All ${history.length}`}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearHistory}
            className="text-destructive hover:text-destructive/80"
          >
            Clear All
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {displayHistory.map((item: ShirtHistoryItem) => (
          <Card
            key={item.id}
            className="group border-border bg-background relative cursor-pointer overflow-hidden border transition-shadow hover:shadow-md"
            style={{ aspectRatio: "1024/1536" }}
            onClick={() => handleViewShirt(item)}
          >
            <CardContent className="relative h-full p-0">
              {/* Full-size image */}
              <img
                src={item.imageUrl}
                alt={item.prompt}
                className="absolute inset-0 h-full w-full object-cover"
                onLoad={() => console.log("Image loaded:", item.id)}
                onError={() => console.error("Image failed:", item.id)}
              />

              {/* Delete button - top right */}
              <Button
                size="sm"
                variant="ghost"
                onClick={e => {
                  e.stopPropagation();
                  removeFromHistory(item.hash || item.id || "");
                }}
                className="hover:bg-destructive absolute top-2 right-2 h-6 w-6 rounded-full bg-black/20 p-0 text-white transition-all hover:text-white"
              >
                <Trash2 className="h-3 w-3" />
              </Button>

              {/* Info overlay - bottom */}
              <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <p className="mb-1 truncate text-xs text-white">
                  {item.originalPrompt || item.prompt || ""}
                </p>
                <p className="text-xs text-white/70">
                  {formatTimestamp(
                    item.timestamp ||
                      Date.parse(item.createdAt || new Date().toISOString()),
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
