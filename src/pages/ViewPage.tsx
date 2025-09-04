import { PlacementControls } from "@/components/3d/PlacementControls";
import { Scene3D } from "@/components/3d/Scene3D";
import { ShirtColorPicker } from "@/components/3d/ShirtColorPicker";
import {
  QualitySelector,
  type Quality,
} from "@/components/forms/QualitySelector";
import { Header } from "@/components/layout/Header";
import { PulsatingButton } from "@/components/magicui/pulsating-button";
import { Shirt3D } from "@/components/Shirt3D";
import { AutoSaveIndicator } from "@/components/ui/AutoSaveIndicator";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PromptChain } from "@/components/ui/PromptChain";
import { PublishButton } from "@/components/ui/PublishButton";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useShirtData } from "@/context/useShirtData";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useImageGeneration } from "@/hooks/useImageGeneration";
import { useShirtHistory } from "@/hooks/useShirtHistory";
import { generateDataUrlHash } from "@/services/imageHash";
import { ImageProcessor } from "@/services/printify/ImageProcessor";
import type { ShirtData } from "@/types";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Edit3,
  History,
  Loader2,
  Save,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
// UI-specific version type for the version selector
interface UIShirtVersion {
  version: number; // Version number (1, 2, 3, etc.)
  prompt: string; // Prompt used for this version
  imageUrl: string; // Base64 data URL of the image
  imageHash: string; // SHA-256 hash of this specific image
  responseId?: string; // OpenAI response ID for this version
  createdAt: string; // When this version was created
  quality: string; // Quality setting used ("low", "medium", "high")
  parentVersion?: number; // Which version this was based on (for edits)
  promptChain?: string[]; // Full prompt chain from original to this version
}

export function ViewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [copied, setCopied] = useState(false);
  const [title, setTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustPrompt, setAdjustPrompt] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustQuality, setAdjustQuality] = useState<Quality>("high");
  const [versions, setVersions] = useState<UIShirtVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<number>(1);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Track the image URL when starting an adjustment to detect completion
  const adjustmentStartImageUrl = useRef<string | null>(null);

  const {
    shirtData,
    setShirtData,
    texturePlacement,
    setTexturePlacement,
    setIsLoading,
  } = useShirtData();
  const { autoSaveStatus, lastSavedAt } = useAutoSave();
  const {
    updateExternalIds,
    getByHash,
    getLastViewed,
    setLastViewed,
    getVersionsByDesignId,
    addToHistory,
    history,
    isLoading: isHistoryLoading,
  } = useShirtHistory();

  // Standalone function to reload versions (for manual calls)
  const reloadVersions = async (designId: string, currentImageUrl?: string) => {
    try {
      const allVersions = await getVersionsByDesignId(designId);
      if (allVersions.length > 0) {
        const versionData: UIShirtVersion[] = allVersions
          .map(version => ({
            version: version.versionNumber,
            prompt: version.prompt,
            imageUrl: version.imageUrl,
            imageHash: version.hash,
            responseId: version.responseId,
            createdAt: version.createdAt,
            quality: version.quality,
            parentVersion: undefined,
            promptChain: version.promptChain, // Include the full prompt chain
          }))
          .sort((a, b) => a.version - b.version);

        // Find current version - use provided imageUrl or fall back to shirtData
        const targetImageUrl = currentImageUrl || shirtData?.imageUrl;
        const currentVersionItem = allVersions.find(
          version => version.imageUrl === targetImageUrl,
        );
        const currentVersionNumber =
          currentVersionItem?.versionNumber ||
          Math.max(...allVersions.map(v => v.versionNumber));

        setVersions(versionData);
        setCurrentVersion(currentVersionNumber);

        console.log(
          "🎯 Manually reloaded",
          allVersions.length,
          "versions for design:",
          designId,
          "- current version:",
          currentVersionNumber,
        );
      }
    } catch (error) {
      console.error("Failed to reload versions:", error);
    }
  };

  // Handle adjustment completion - save to database and reload versions
  const handleAdjustmentComplete = async (shirtData: ShirtData) => {
    console.log("🎯 Adjustment completed, saving to database");
    try {
      await addToHistory(shirtData);

      // Kick off title regeneration in background using full prompt chain (latest version)
      try {
        if (shirtData.designId) {
          const allVersions = await getVersionsByDesignId(shirtData.designId);
          const latest = allVersions.sort(
            (a, b) => b.versionNumber - a.versionNumber,
          )[0];
          // Fire-and-forget: generate title and store it against the latest image hash
          // Prefer the latest prompt as primary signal but include chain context
          // Reuse the image-generation hook's title pipeline by instantiating it locally
          // We can't call its internal function here, so we instead enqueue a minimal title job via history API
          // The history API will update design's generatedTitle when provided
          try {
            const imageUrl = shirtData.imageUrl || "";
            const imageHash = imageUrl
              ? await generateDataUrlHash(imageUrl)
              : undefined;
            if (imageHash) {
              // Simple heuristic name using chain, non-blocking; server-quality name will still come from normal flow later
              const quickName = (latest?.prompt || shirtData.prompt || "")
                .slice(0, 30)
                .trim();
              await updateExternalIds(imageHash, { generatedTitle: quickName });
              setTitle(quickName);
            }
          } catch (e) {
            console.warn("Failed quick title update:", e);
          }
        }
      } catch (e) {
        console.warn("⚠️ Failed to kick off title regeneration:", e);
      }
      console.log("🎯 Successfully saved adjustment to database");

      // Reload versions after a short delay to ensure database write is complete
      setTimeout(() => {
        if (shirtData.designId) {
          console.log("🎯 Reloading versions after adjustment save");
          reloadVersions(shirtData.designId, shirtData.imageUrl);
        }
      }, 100);
    } catch (error) {
      console.error("Failed to save adjustment:", error);
    }
  };

  const { editImage } = useImageGeneration(handleAdjustmentComplete);

  // Load quality preference from localStorage on mount
  useEffect(() => {
    const savedQuality = localStorage.getItem("imageQuality") as Quality;
    if (savedQuality && ["low", "medium", "high"].includes(savedQuality)) {
      setAdjustQuality(savedQuality);
    }
  }, []);

  // Reset adjust loading state when new image data arrives during adjustment (partial or complete)
  useEffect(() => {
    if (
      shirtData &&
      isAdjusting &&
      shirtData.imageUrl &&
      adjustmentStartImageUrl.current &&
      shirtData.imageUrl !== adjustmentStartImageUrl.current
    ) {
      // Reset loading overlay as soon as we get the first partial or complete image
      setIsAdjusting(false);

      // Only reset the reference when we get the final complete image
      if (!shirtData.isPartial) {
        adjustmentStartImageUrl.current = null;
      }
    }
  }, [shirtData?.imageUrl, shirtData?.isPartial, isAdjusting]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load version data when shirt data changes
  useEffect(() => {
    const loadVersionData = async () => {
      if (!shirtData?.imageUrl || !shirtData?.designId) {
        return;
      }

      try {
        // Query all versions of this design using the new hook method
        const allVersions = await getVersionsByDesignId(shirtData.designId);

        if (allVersions.length > 0) {
          // Convert database ShirtVersion items to UI ShirtVersion format and sort by version number
          const versionData: UIShirtVersion[] = allVersions
            .map(version => ({
              version: version.versionNumber,
              prompt: version.prompt,
              imageUrl: version.imageUrl,
              imageHash: version.hash,
              responseId: version.responseId,
              createdAt: version.createdAt,
              quality: version.quality,
              parentVersion: undefined, // Could be derived from parentHash if needed
              promptChain: version.promptChain, // Include the full prompt chain
            }))
            .sort((a, b) => a.version - b.version);

          // Find current version (the one with matching imageUrl)
          const currentVersionItem = allVersions.find(
            version => version.imageUrl === shirtData.imageUrl,
          );
          const currentVersionNumber = currentVersionItem?.versionNumber || 1;

          setVersions(versionData);
          setCurrentVersion(currentVersionNumber);
        } else {
          // Create a single version from current data
          const singleVersion: UIShirtVersion = {
            version: 1,
            prompt: shirtData.prompt,
            imageUrl: shirtData.imageUrl,
            imageHash: "", // We don't have this readily available
            responseId: shirtData.responseId,
            createdAt: shirtData.generatedAt || new Date().toISOString(),
            quality: "high",
            parentVersion: undefined,
          };
          setVersions([singleVersion]);
          setCurrentVersion(1);
        }
      } catch (error) {
        console.error("Failed to load version data:", error);
      }
    };

    loadVersionData();
  }, [shirtData?.designId, shirtData?.imageUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loadShirtData = async () => {
      // Only reset loading when component mounts if we don't have partial data
      if (!shirtData || !shirtData.isPartial) {
        setIsLoading(false);
      }

      // Check if data was passed via router state (highest priority)
      if (location.state && !shirtData) {
        const stateData = location.state as ShirtData;
        setShirtData(stateData);
        // Track this as last viewed if it has an imageUrl
        if (stateData.imageUrl) {
          try {
            const hash = await generateDataUrlHash(stateData.imageUrl);
            await setLastViewed(hash);
          } catch (error) {
            console.warn("Failed to track last viewed:", error);
          }
        }
        return;
      }

      // If no shirt data, try to load last viewed
      if (!shirtData) {
        try {
          const lastViewed = await getLastViewed();
          if (lastViewed) {
            const shirtDataFromHistory: ShirtData = {
              prompt: lastViewed.originalPrompt,
              imageUrl: lastViewed.imageUrl,
              generatedAt: lastViewed.createdAt,
              responseId: lastViewed.responseId,
              designId: lastViewed.designId,
              isPartial: false,
            };
            setShirtData(shirtDataFromHistory);
            return;
          }
        } catch (error) {
          console.warn("Failed to load last viewed:", error);
        }

        // Final fallback to localStorage for backward compatibility
        const stored = localStorage.getItem("shirtGenData");
        if (stored) {
          setShirtData(JSON.parse(stored));
        }
      }
    };

    loadShirtData();
  }, [
    location.state,
    shirtData,
    setShirtData,
    setIsLoading,
    getLastViewed,
    setLastViewed,
  ]);

  // Load title from database when shirtData changes (but not when editing)
  useEffect(() => {
    const loadTitle = async () => {
      // Don't overwrite title if user is currently editing
      if (isEditingTitle) return;

      if (shirtData?.imageUrl) {
        try {
          const imageHash = await generateDataUrlHash(shirtData.imageUrl);
          const record = await getByHash(imageHash);
          if (record?.generatedTitle) {
            setTitle(record.generatedTitle);
          } else {
            // Fallback to a truncated prompt if no generated title yet
            setTitle(shirtData.prompt?.substring(0, 30) || "Untitled Design");
          }
        } catch (error) {
          console.warn("Failed to load title:", error);
          setTitle(shirtData.prompt?.substring(0, 30) || "Untitled Design");
        }
      }
    };

    loadTitle();
  }, [shirtData?.imageUrl, shirtData?.prompt, getByHash, isEditingTitle]);

  // Prevent navigation/refresh during progressive generation
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (shirtData?.isPartial) {
        event.preventDefault();
        // Modern browsers require returnValue to be set
        event.returnValue =
          "Your design is still generating. Are you sure you want to leave?";
        return "Your design is still generating. Are you sure you want to leave?";
      }
    };

    if (shirtData?.isPartial) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [shirtData?.isPartial]);

  if (!shirtData) {
    // Show loading while history is still loading
    if (isHistoryLoading) {
      return (
        <div className="bg-background flex min-h-svh items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      );
    }

    // Only show empty state if no shirts exist in history at all
    if (history.length === 0) {
      return (
        <div className="flex min-h-svh items-center justify-center">
          <div className="text-center">
            <h2 className="text-foreground mb-4 text-2xl font-light">
              No Design Found
            </h2>
            <p className="text-muted-foreground mb-8">
              Create your first shirt design to see it here.
            </p>
            <Button
              onClick={() => navigate("/")}
              className="bg-primary text-primary-foreground hover:bg-primary/80 px-8 py-3"
            >
              Create Design
            </Button>
          </div>
        </div>
      );
    }

    // If we have history but no shirt data loaded yet, show loading
    return (
      <div className="bg-background flex min-h-svh items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading your last design...</p>
        </div>
      </div>
    );
  }

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(shirtData.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (error) {
      console.error("Failed to copy prompt:", error);
    }
  };

  const handleSaveTitle = async () => {
    if (!shirtData?.imageUrl) return;

    setIsSavingTitle(true);
    try {
      const imageHash = await generateDataUrlHash(shirtData.imageUrl);
      await updateExternalIds(imageHash, {
        generatedTitle: title.trim() || "Untitled Design",
      });
      setIsEditingTitle(false);
    } catch (error) {
      console.error("Failed to save title:", error);
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleCancelEdit = async () => {
    // Reload title from database
    if (shirtData?.imageUrl) {
      try {
        const imageHash = await generateDataUrlHash(shirtData.imageUrl);
        const record = await getByHash(imageHash);
        if (record?.generatedTitle) {
          setTitle(record.generatedTitle);
        }
      } catch (error) {
        console.warn("Failed to reload title:", error);
      }
    }
    setIsEditingTitle(false);
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadFullRes = () => {
    if (shirtData?.imageUrl) {
      downloadImage(shirtData.imageUrl, `shirt-design-full-${Date.now()}.png`);
    }
  };

  const handleDownloadCompressed = async () => {
    if (!shirtData?.imageUrl) return;

    try {
      // Convert data URL to blob
      const imageBlob = await ImageProcessor.fetchImageAsBlob(
        shirtData.imageUrl,
      );

      // Compress it
      const compressedBlob = await ImageProcessor.compressImage(
        imageBlob,
        0.75,
      );

      // Convert back to data URL
      const reader = new FileReader();
      reader.onload = () => {
        const compressedDataUrl = reader.result as string;
        downloadImage(
          compressedDataUrl,
          `shirt-design-compressed-${Date.now()}.png`,
        );
      };
      reader.readAsDataURL(compressedBlob);
    } catch (error) {
      console.error("Failed to compress and download image:", error);
    }
  };

  const handleStartEdit = () => {
    setIsEditingImage(true);
    setEditPrompt("");
  };

  const handleCancelImageEdit = () => {
    setIsEditingImage(false);
    setEditPrompt("");
  };

  const handleSubmitEdit = () => {
    if (!editPrompt.trim()) {
      alert("Please enter an edit prompt");
      return;
    }

    if (!shirtData?.responseId) {
      alert(
        "No response ID available for editing. Try generating a new image first.",
      );
      return;
    }

    // Start the editing process
    editImage(editPrompt, shirtData.responseId);

    // Reset edit state
    setIsEditingImage(false);
    setEditPrompt("");
  };

  const handleAdjustQualityChange = (newQuality: Quality) => {
    setAdjustQuality(newQuality);
    localStorage.setItem("imageQuality", newQuality);
  };

  const handleOpenAdjustModal = async () => {
    console.log("🔍 Checking responseId availability:");
    console.log("🔍 Current shirtData:", shirtData);
    console.log("🔍 ResponseId:", shirtData?.responseId);

    if (!shirtData?.responseId) {
      console.warn("⚠️ No response ID available - generate a new image first");
      alert("⚠️ No response ID available - generate a new image first");
      return;
    }

    setAdjustPrompt(""); // Start with empty prompt for follow-up instructions
    setShowAdjustModal(true);
  };

  const handleSubmitAdjust = async () => {
    if (!adjustPrompt.trim() || !shirtData?.responseId) {
      return;
    }

    try {
      // Record the current image URL to detect when adjustment completes
      adjustmentStartImageUrl.current = shirtData.imageUrl || null;

      setIsAdjusting(true);
      setShowAdjustModal(false);

      console.log(
        "🔄 Starting image adjustment with responseId:",
        shirtData.responseId,
      );
      console.log("🔄 Adjustment prompt:", adjustPrompt);
      console.log("🔄 Adjustment quality:", adjustQuality);
      console.log("🔄 Current designId:", shirtData.designId);
      console.log("🔄 Recording start image URL for completion detection");

      // Call edit image with the response ID, quality, and designId - stay on current page
      await editImage(
        adjustPrompt,
        shirtData.responseId,
        adjustQuality,
        shirtData.designId,
      );

      // Reset state
      setAdjustPrompt("");
    } catch (error) {
      console.error("Failed to adjust image:", error);
      setIsAdjusting(false);
      adjustmentStartImageUrl.current = null; // Reset on error
    }
  };

  const copyDebugInfo = async () => {
    const debugInfo = {
      shirtData: {
        prompt: shirtData?.prompt,
        responseId: shirtData?.responseId,
        designId: shirtData?.designId,
        isPartial: shirtData?.isPartial,
        partialIndex: shirtData?.partialIndex,
        generatedAt: shirtData?.generatedAt,
        hasImageUrl: !!shirtData?.imageUrl,
        imageUrlLength: shirtData?.imageUrl?.length,
      },
      versions: {
        total: versions.length,
        currentVersion: currentVersion,
        versions: versions.map(v => ({
          version: v.version,
          prompt: v.prompt,
          responseId: v.responseId,
          quality: v.quality,
          createdAt: v.createdAt,
          hasImageUrl: !!v.imageUrl,
        })),
      },
      state: {
        isAdjusting,
        showAdjustModal,
        adjustPrompt,
        adjustQuality,
        isEditingTitle,
        isSavingTitle,
      },
      history: {
        totalItems: history?.length || 0,
        isLoading: isHistoryLoading,
      },
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy debug info:", error);
    }
  };

  const handleVersionChange = (version: UIShirtVersion) => {
    console.log("🔄 Switching to version:", version.version);

    // Update shirt data with the selected version
    const versionShirtData: ShirtData = {
      prompt: version.prompt,
      imageUrl: version.imageUrl,
      responseId: version.responseId,
      generatedAt: version.createdAt,
      isPartial: false,
    };

    setShirtData(versionShirtData);
    setCurrentVersion(version.version);
  };

  return (
    <div className="bg-background flex h-svh flex-col">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col">
        {/* Header with Navigation and Publish button */}
        <div className="relative">
          <Header showBackButton />

          {/* Publish button - Top right, aligned with header */}
          <div className="absolute top-3 right-6">
            <PublishButton />
          </div>
        </div>

        {/* Separate Title Section */}
        <div className="border-border bg-background flex-shrink-0 border-b px-2 py-1">
          <div className="flex items-center justify-between">
            {/* Title - Left/Center */}
            <div className="flex-1 text-center">
              {isEditingTitle ? (
                <div className="mx-auto flex w-full max-w-lg items-center justify-center gap-2">
                  <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        handleSaveTitle();
                      } else if (e.key === "Escape") {
                        handleCancelEdit();
                      }
                    }}
                    className="text-foreground h-auto min-w-0 flex-1 border-none bg-transparent px-2 py-1 text-left text-sm font-semibold shadow-none focus-visible:ring-0"
                    maxLength={30}
                    placeholder="Enter design title..."
                    autoFocus
                  />
                  <button
                    onClick={handleSaveTitle}
                    disabled={isSavingTitle}
                    className="hover:bg-muted flex h-5 w-5 flex-shrink-0 items-center justify-center rounded transition-colors"
                    title="Save"
                  >
                    {isSavingTitle ? (
                      <Save className="h-3 w-3 animate-pulse" />
                    ) : (
                      <Save className="h-3 w-3" />
                    )}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSavingTitle}
                    className="hover:bg-muted flex h-5 w-5 flex-shrink-0 items-center justify-center rounded transition-colors"
                    title="Cancel"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="group hover:bg-muted/50 flex w-full items-center gap-2 rounded px-2 py-1 text-left transition-all"
                  title="Click to edit title"
                >
                  <h1 className="text-foreground group-hover:text-muted-foreground text-sm font-semibold">
                    {title || "Untitled Design"}
                  </h1>
                  <Edit3 className="text-muted-foreground group-hover:text-foreground h-4 w-4" />
                </button>
              )}
            </div>

            {/* Version Selector - Right */}
            {versions.length >= 1 && !isAdjusting && !shirtData?.isPartial && (
              <div className="flex-shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <span className="flex items-center text-xs">
                      <History className="mr-2 h-2 w-2" />v{currentVersion}
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {versions
                      .slice()
                      .reverse()
                      .map(version => (
                        <DropdownMenuItem
                          key={version.version}
                          onClick={() => handleVersionChange(version)}
                          className="flex cursor-pointer flex-col items-start gap-1 p-3"
                        >
                          <div className="flex w-full items-center justify-between">
                            <span className="font-medium">
                              Version {version.version}
                              {version.version === currentVersion &&
                                " (Current)"}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {version.quality}
                            </span>
                          </div>
                          <p className="text-muted-foreground max-w-full truncate text-xs">
                            {version.prompt}
                          </p>
                          <span className="text-muted-foreground text-xs">
                            {new Date(version.createdAt).toLocaleDateString()}
                          </span>
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>

        {/* 3D Scene - Takes remaining space */}
        <div className="relative min-h-0 flex-1">
          <Scene3D>
            {shirtData.imageUrl && (
              <Shirt3D
                imageUrl={shirtData.imageUrl}
                texturePlacement={texturePlacement}
              />
            )}
          </Scene3D>

          {/* Adjustment Loading Overlay */}
          {isAdjusting && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4 rounded-lg bg-white/90 p-6 shadow-lg dark:bg-gray-900/90">
                <Loader2 className="text-primary h-8 w-8 animate-spin" />
                <div className="text-center">
                  <p className="text-sm font-medium">Adjusting Image</p>
                  <p className="text-muted-foreground text-xs">
                    This may take a moment...
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="border-border bg-background flex-shrink-0 border-t p-2 sm:p-4">
          <div className="mx-auto max-w-4xl">
            {/* User Prompt Display */}
            {shirtData.prompt && (
              <div className="mb-2 sm:mb-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleCopyPrompt}
                          className="group hover:bg-muted max-w-full cursor-pointer rounded-lg px-3 py-1 transition-colors"
                        >
                          <div className="flex items-center justify-start gap-2">
                            <div className="text-muted-foreground group-hover:text-foreground w-full text-sm italic sm:w-96">
                              <PromptChain
                                chain={
                                  versions.find(
                                    v => v.version === currentVersion,
                                  )?.promptChain
                                }
                                prompt={shirtData.prompt}
                                mode="condensed"
                              />
                            </div>
                            {copied && (
                              <Check className="h-4 w-4 flex-shrink-0 text-green-600" />
                            )}
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="max-w-xs">
                          <PromptChain
                            chain={
                              versions.find(v => v.version === currentVersion)
                                ?.promptChain
                            }
                            prompt={shirtData.prompt}
                            mode="full"
                          />
                        </div>
                        <p className="text-primary-foreground/50 mt-1 text-xs">
                          Click to copy
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Adjust Image Button - Only show if responseId is available */}
                  {shirtData.responseId && !shirtData.isPartial && (
                    <Button
                      onClick={handleOpenAdjustModal}
                      disabled={isAdjusting}
                      size="sm"
                      className="flex w-auto items-center gap-2"
                      variant="outline"
                    >
                      <Wand2 className="h-4 w-4" />
                      {isAdjusting ? "Adjusting..." : "Adjust"}
                    </Button>
                  )}
                </div>
                {shirtData.isPartial && (
                  <div className="mt-3">
                    <div className="text-muted-foreground mb-2 text-xs">
                      Generating your design...
                    </div>
                    <div className="bg-muted mx-auto h-2 w-48 rounded-full">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-purple-300 transition-all duration-500 ease-out"
                        style={{
                          width: `${((shirtData.partialIndex !== undefined ? shirtData.partialIndex + 1 : 1) / 3) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {shirtData.partialIndex !== undefined
                        ? shirtData.partialIndex + 1
                        : 1}{" "}
                      of 3
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Controls - Responsive Layout */}
            <div className="mb-1 flex flex-col items-center gap-1 sm:flex-row sm:justify-between sm:gap-3">
              {/* Shirt Color Selection */}
              <div>
                <ShirtColorPicker />
              </div>

              {/* Texture Placement */}
              <div>
                <PlacementControls
                  placement={texturePlacement}
                  onPlacementChange={setTexturePlacement}
                />
              </div>
            </div>

            {/* Debug Controls - Only in development */}
            {import.meta.env.DEV && shirtData.imageUrl && (
              <div className="border-border mt-2 border-t pt-2">
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadFullRes}
                    className="text-xs"
                  >
                    <Download className="mr-1 h-3 w-3" />
                    Full Res
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadCompressed}
                    className="text-xs"
                  >
                    <Download className="mr-1 h-3 w-3" />
                    Compressed
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartEdit}
                    className="text-xs"
                    disabled={isEditingImage}
                  >
                    <Edit3 className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                </div>

                {/* Inline Edit UI */}
                {isEditingImage && (
                  <div className="mt-2 space-y-2">
                    <Input
                      placeholder="Describe how to edit the image..."
                      value={editPrompt}
                      onChange={e => setEditPrompt(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          handleSubmitEdit();
                        } else if (e.key === "Escape") {
                          handleCancelImageEdit();
                        }
                      }}
                      className="text-xs"
                      autoFocus
                    />

                    {/* Status indicator */}
                    <div className="text-muted-foreground text-xs">
                      {shirtData?.responseId ? (
                        <span>
                          ✅ Response ID: {shirtData.responseId.slice(0, 20)}...
                        </span>
                      ) : (
                        <span>
                          ⚠️ No response ID available - generate a new image
                          first
                        </span>
                      )}
                    </div>

                    <div className="flex justify-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleSubmitEdit}
                        disabled={!editPrompt.trim() || !shirtData?.responseId}
                        className="text-xs"
                      >
                        <Check className="mr-1 h-3 w-3" />
                        Edit Image
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelImageEdit}
                        className="text-xs"
                      >
                        <X className="mr-1 h-3 w-3" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Auto-save indicator - Bottom right of entire page */}
      <div
        className={`fixed right-4 z-50 transition-all duration-200 ${import.meta.env.DEV && showDebugInfo ? "bottom-32" : "bottom-4"}`}
      >
        <AutoSaveIndicator status={autoSaveStatus} lastSavedAt={lastSavedAt} />
      </div>

      {/* Debug Information Panel - Only in development */}
      {import.meta.env.DEV && (
        <div className="border-border bg-card fixed right-0 bottom-0 left-0 z-40 border-t">
          <div className="mx-auto max-w-7xl px-4">
            <button
              onClick={() => setShowDebugInfo(!showDebugInfo)}
              className="text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-2 py-2 text-sm transition-colors"
            >
              {showDebugInfo ? (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Hide Debug Info
                </>
              ) : (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Show Debug Info
                </>
              )}
            </button>

            {showDebugInfo && (
              <div className="border-border bg-muted/30 mb-4 rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-foreground text-sm font-semibold">
                    Debug Information
                  </h3>
                  <Button
                    onClick={copyDebugInfo}
                    variant="outline"
                    size="sm"
                    className="h-8 px-3"
                  >
                    <Copy className="mr-2 h-3 w-3" />
                    {copied ? "Copied!" : "Copy JSON"}
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {/* Shirt Data */}
                  <div className="bg-background rounded-md border p-3">
                    <h4 className="text-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                      Shirt Data
                    </h4>
                    <div className="space-y-1 text-xs">
                      <div>
                        <span className="text-muted-foreground">Prompt:</span>{" "}
                        {shirtData?.prompt || "None"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Response ID:
                        </span>{" "}
                        {shirtData?.responseId || "None"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Design ID:
                        </span>{" "}
                        {shirtData?.designId || "None"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Is Partial:
                        </span>{" "}
                        {shirtData?.isPartial ? "Yes" : "No"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Partial Index:
                        </span>{" "}
                        {shirtData?.partialIndex ?? "N/A"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Has Image:
                        </span>{" "}
                        {shirtData?.imageUrl ? "Yes" : "No"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Generated:
                        </span>{" "}
                        {shirtData?.generatedAt
                          ? new Date(shirtData.generatedAt).toLocaleTimeString()
                          : "N/A"}
                      </div>
                    </div>
                  </div>

                  {/* Versions */}
                  <div className="bg-background rounded-md border p-3">
                    <h4 className="text-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                      Versions
                    </h4>
                    <div className="space-y-1 text-xs">
                      <div>
                        <span className="text-muted-foreground">Total:</span>{" "}
                        {versions.length}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Current:</span>{" "}
                        {currentVersion}
                      </div>
                      <div className="text-muted-foreground mt-2 text-xs font-medium">
                        Version List:
                      </div>
                      {versions.length > 0 ? (
                        <div className="max-h-20 overflow-y-auto">
                          {versions.map(v => (
                            <div
                              key={v.version}
                              className={`text-xs ${v.version === currentVersion ? "text-primary font-medium" : "text-muted-foreground"}`}
                            >
                              v{v.version}: {v.quality} (
                              {new Date(v.createdAt).toLocaleTimeString()})
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-xs">
                          No versions loaded
                        </div>
                      )}

                      {/* Show prompt chain for current version */}
                      {versions.length > 0 && (
                        <>
                          <div className="text-muted-foreground mt-2 text-xs font-medium">
                            Prompt Chain:
                          </div>
                          <div className="max-h-16 overflow-y-auto">
                            {(() => {
                              const currentVersionData = versions.find(
                                v => v.version === currentVersion,
                              );
                              const chain = currentVersionData?.promptChain;
                              if (chain && chain.length > 0) {
                                return (
                                  <div className="text-muted-foreground space-y-1 text-xs">
                                    {chain.map((prompt, index) => (
                                      <div key={index}>
                                        {index + 1}. {prompt}
                                      </div>
                                    ))}
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="text-muted-foreground text-xs">
                                    No chain available
                                  </div>
                                );
                              }
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* State */}
                  <div className="bg-background rounded-md border p-3">
                    <h4 className="text-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                      State
                    </h4>
                    <div className="space-y-1 text-xs">
                      <div>
                        <span className="text-muted-foreground">
                          Is Adjusting:
                        </span>{" "}
                        {isAdjusting ? "Yes" : "No"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Show Adjust Modal:
                        </span>{" "}
                        {showAdjustModal ? "Yes" : "No"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Adjust Quality:
                        </span>{" "}
                        {adjustQuality}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Is Editing Title:
                        </span>{" "}
                        {isEditingTitle ? "Yes" : "No"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          History Loading:
                        </span>{" "}
                        {isHistoryLoading ? "Yes" : "No"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          History Items:
                        </span>{" "}
                        {history?.length || 0}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Adjust Image Modal */}
      <Dialog open={showAdjustModal} onOpenChange={setShowAdjustModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adjust Image</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">
                What changes would you like to make?
              </label>
              <Textarea
                value={adjustPrompt}
                onChange={e => setAdjustPrompt(e.target.value)}
                placeholder="e.g., make it more realistic, add more details, change the colors..."
                className="min-h-[100px] resize-none"
                onKeyDown={e => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    handleSubmitAdjust();
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <div className="flex items-center gap-2">
                <QualitySelector
                  quality={adjustQuality}
                  onQualityChange={handleAdjustQualityChange}
                  disabled={false}
                />
                <PulsatingButton
                  onClick={handleSubmitAdjust}
                  disabled={!adjustPrompt.trim()}
                  className="bg-primary text-primary-foreground flex items-center gap-2"
                  pulseColor="var(--primary-light)"
                >
                  Regenerate
                </PulsatingButton>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
