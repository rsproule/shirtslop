import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useShirtData } from "@/context/useShirtData";
import { useShirtHistory } from "@/hooks/useShirtHistory";
import { PRODUCT_DESCRIPTION_TEMPLATE } from "@/lib/productDescription";
import { SHOPIFY_URL } from "@/lib/utils";
import { db, ImageLifecycleState } from "@/services/db";
import { generateDataUrlHash, getPublishedProduct } from "@/services/imageHash";
import { printifyService } from "@/services/printify";
import { ProductBuilder } from "@/services/printify/ProductBuilder";
import type { ShirtStyle } from "@/services/printify/types";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Share2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type PublishStatus =
  | "processing"
  | "uploading"
  | "creating"
  | "publishing"
  | "syncing";

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  designName: string;
  isPublishing?: boolean;
  publishStatus?: PublishStatus;
  error?: string;
  shopifyUrl?: string;
  isPublished?: boolean;
  onPublish?: (productName: string, shirtStyle: ShirtStyle) => void;
}

function PublishModal({
  isOpen,
  onClose,
  designName,
  isPublishing,
  publishStatus,
  error,
  shopifyUrl,
  isPublished,
  onPublish,
}: PublishModalProps) {
  const [productName, setProductName] = useState("");
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [shirtStyle, setShirtStyle] = useState<ShirtStyle>("standard");

  // Initialize product name when modal opens, but don't override user edits
  useEffect(() => {
    if (designName && !hasUserEdited && !isPublished) {
      setProductName(designName);
    }
  }, [designName, hasUserEdited, isPublished]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasUserEdited(false);
      setProductName("");
      setShirtStyle("standard");
    }
  }, [isOpen]);

  const handleProductNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProductName(e.target.value);
    setHasUserEdited(true);
  };

  const streetInfo = ProductBuilder.getShirtStyleInfo("street");
  const standardInfo = ProductBuilder.getShirtStyleInfo("standard");
  const priceDiff = streetInfo.price - standardInfo.price;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publish Design</DialogTitle>
          <DialogDescription>
            {isPublishing
              ? `Publishing "${designName}" to your store...`
              : isPublished
                ? `"${designName}" has been published successfully!`
                : `Ready to share "${designName}" with the world?`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isPublishing && !isPublished && !error && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="productName" className="text-sm font-medium">
                  Product Name
                </Label>
                <Input
                  id="productName"
                  value={productName}
                  onChange={handleProductNameChange}
                  placeholder="Enter product name..."
                  className="mt-1"
                  maxLength={30}
                />
                <p className="text-muted-foreground mt-1 text-xs">
                  {productName.length}/30 characters
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium">
                  Shirt Style
                  <span className="ml-2 font-normal text-muted-foreground">
                    {shirtStyle === "street" ? streetInfo.priceFormatted : standardInfo.priceFormatted}
                  </span>
                </Label>
                <ToggleGroup
                  type="single"
                  value={shirtStyle}
                  onValueChange={(value) => {
                    if (value) setShirtStyle(value as ShirtStyle);
                  }}
                  className="mt-2 flex w-full flex-col"
                  variant="outline"
                >
                  <ToggleGroupItem
                    value="standard"
                    className="w-full justify-start"
                  >
                    <span className="text-sm">Standard</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="street"
                    className="w-full justify-start"
                  >
                    <span className="text-sm">Street Style</span>
                  </ToggleGroupItem>
                </ToggleGroup>
                <p className="text-muted-foreground mt-1.5 text-xs">
                  {shirtStyle === "street" 
                    ? `Shaka Wear heavyweight tee (+$${(priceDiff / 100).toFixed(2)})`
                    : "Comfort Colors standard tee"
                  }
                </p>
              </div>
            </div>
          )}

          {isPublishing && (
            <div className="bg-primary/10 flex items-center gap-3 rounded-lg p-4">
              <Loader2 className="text-primary h-5 w-5 animate-spin" />
              <div>
                <p className="font-medium">Your shirt is nearly ready!</p>
                <p className="text-muted-foreground text-sm">
                  {publishStatus === "processing" && "Uploading your design..."}
                  {publishStatus === "uploading" && "Uploading your design..."}
                  {publishStatus === "creating" && "Creating product..."}
                  {publishStatus === "publishing" && "Publishing to store..."}
                  {publishStatus === "syncing" && "Syncing..."}
                  {!publishStatus && `Creating "${productName}"...`}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="border-destructive/20 bg-destructive/10 flex items-start gap-3 rounded-lg border p-4">
              <AlertCircle className="text-destructive mt-0.5 h-5 w-5" />
              <div>
                <p className="text-destructive font-medium">
                  Publishing Failed
                </p>
                <p className="text-destructive/80 mt-1 text-sm">{error}</p>
              </div>
            </div>
          )}

          {isPublished && !isPublishing && (
            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-900">Success!</p>
                <p className="mt-1 text-sm text-green-700">
                  "{productName}" is now live. It may take a few minutes for the
                  previews to appear.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          {isPublished && !isPublishing ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {shopifyUrl && (
                <Button onClick={() => window.open(shopifyUrl, "_blank")}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Product
                </Button>
              )}
            </>
          ) : !isPublishing && !error ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={() => onPublish?.(productName, shirtStyle)}
                disabled={!productName.trim()}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Publish
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose} disabled={isPublishing}>
              {isPublishing ? "Publishing..." : "Close"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PublishButton() {
  const { shirtData, user, texturePlacement } = useShirtData();
  const {
    updateLifecycle,
    updateExternalIds,
    getByHash,
    getVersionsByDesignId,
  } = useShirtHistory();
  const [showModal, setShowModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string>();
  const [shopifyUrl, setShopifyUrl] = useState<string>();
  const [isPublished, setIsPublished] = useState(false);
  const [publishStatus, setPublishStatus] =
    useState<PublishStatus>("processing");
  const [designTitle, setDesignTitle] = useState<string>("");
  const [alreadyPublished, setAlreadyPublished] = useState<{
    shopifyUrl?: string;
    productName: string;
  } | null>(null);

  // Unified checker that consults both new and legacy storage
  const computePublishedStatus = useCallback(async () => {
    if (!shirtData?.imageUrl) {
      setAlreadyPublished(null);
      return;
    }

    try {
      const imageHash = await generateDataUrlHash(shirtData.imageUrl);

      // Prefer the simple publishedProducts table
      const publishedProduct = await db.publishedProducts.get(imageHash);
      if (publishedProduct) {
        setAlreadyPublished({
          shopifyUrl: publishedProduct.shopifyUrl,
          productName: publishedProduct.productName,
        });
        return;
      }

      // Fallback to legacy shirtHistory check
      const legacy = await getPublishedProduct(imageHash);
      if (legacy) {
        setAlreadyPublished({
          shopifyUrl: legacy.shopifyUrl,
          productName: legacy.productName,
        });
        return;
      }

      setAlreadyPublished(null);
    } catch (error) {
      setAlreadyPublished(null);
    }
  }, [shirtData?.imageUrl]);

  useEffect(() => {
    void computePublishedStatus();
  }, [computePublishedStatus]);

  // Load design title from database
  useEffect(() => {
    const loadDesignTitle = async () => {
      if (!shirtData?.imageUrl) {
        setDesignTitle("");
        return;
      }

      try {
        const imageHash = await generateDataUrlHash(shirtData.imageUrl);
        const record = await getByHash(imageHash);
        if (record?.generatedTitle) {
          setDesignTitle(record.generatedTitle);
        } else {
          // Fallback to a truncated prompt if no generated title yet
          setDesignTitle(
            shirtData.prompt?.substring(0, 30) || "Untitled Design",
          );
        }
      } catch (error) {
        console.warn("Failed to load design title:", error);
        setDesignTitle(shirtData.prompt?.substring(0, 30) || "Untitled Design");
      }
    };

    loadDesignTitle();
  }, [shirtData?.imageUrl, shirtData?.prompt, getByHash]);

  // (second checker removed; unified into computePublishedStatus)

  // Prevent navigation/refresh during publishing
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isPublishing) {
        event.preventDefault();
        // Modern browsers require returnValue to be set
        event.returnValue =
          "Your design is being published. Are you sure you want to leave?";
        return "Your design is being published. Are you sure you want to leave?";
      }
    };

    if (isPublishing) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isPublishing]);

  const handleOpenModal = () => {
    if (!shirtData?.imageUrl || !shirtData?.prompt) return;
    setShowModal(true);
  };

  const handleConfirmPublish = async (confirmedProductName: string, selectedShirtStyle: ShirtStyle) => {
    if (!shirtData?.imageUrl || !shirtData?.prompt) return;

    setIsPublishing(true);
    setPublishStatus("processing");
    setError(undefined);
    setShopifyUrl(undefined);
    setIsPublished(false);

    try {
      const imageHash = await generateDataUrlHash(shirtData.imageUrl);

      // Update lifecycle to UPLOADING
      setPublishStatus("uploading");
      await updateLifecycle(imageHash, ImageLifecycleState.UPLOADING);

      // Get the prompt chain from the latest version
      let promptChain: string[] | undefined;
      if (shirtData.designId) {
        try {
          const versions = await getVersionsByDesignId(shirtData.designId);
          const latestVersion = versions.find(v => v.isLatestVersion);
          promptChain = latestVersion?.promptChain;
          console.log(
            "📝 Using prompt chain for product description:",
            promptChain,
          );
        } catch (error) {
          console.warn(
            "Failed to get prompt chain for product description:",
            error,
          );
        }
      }

      const description = PRODUCT_DESCRIPTION_TEMPLATE(
        user,
        shirtData.prompt,
        promptChain,
        selectedShirtStyle,
      );

      // Update lifecycle to PUBLISHING before creating product
      setPublishStatus("creating");
      await updateLifecycle(imageHash, ImageLifecycleState.PUBLISHING);

      setPublishStatus("publishing");
      const result = await printifyService.createShirtFromDesign(
        shirtData.imageUrl,
        shirtData.prompt,
        confirmedProductName,
        description,
        texturePlacement,
        selectedShirtStyle,
        (status: PublishStatus) => setPublishStatus(status),
      );

      // Set the Shopify URL using the external handle directly
      if (result.product.external?.handle) {
        setShopifyUrl(result.product.external.handle);
      }

      // Update database with published product info using new hash-based system
      try {
        await updateExternalIds(imageHash, {
          generatedTitle: confirmedProductName,
          printifyProductId: result.product.id,
          shopifyUrl: result.product.external?.handle,
        });

        // Save to published products table
        const publishedProduct = {
          hash: imageHash,
          productName: confirmedProductName,
          printifyProductId: result.product.id,
          shopifyUrl: result.product.external?.handle || "",
          publishedAt: new Date().toISOString(),
          createdBy: user?.id,
          shirtStyle: selectedShirtStyle,
        };

        await db.publishedProducts.put(publishedProduct);
        console.log("📦 Saved published product:", publishedProduct);

        // Update lifecycle to PUBLISHED
        await updateLifecycle(imageHash, ImageLifecycleState.PUBLISHED);

        // Update publishedAt timestamp and shirt style
        await db.shirtHistory.update(imageHash, {
          publishedAt: new Date().toISOString(),
          shirtStyle: selectedShirtStyle,
        });

        console.log("💾 Updated published product in database:", {
          hash: imageHash,
          productName: confirmedProductName,
          productId: result.product.id,
          shopifyUrl: result.product.external?.handle,
          lifecycle: ImageLifecycleState.PUBLISHED,
        });
      } catch (dbError) {
        console.warn("Failed to update database:", dbError);
        // Set lifecycle to FAILED if database update fails
        await updateLifecycle(imageHash, ImageLifecycleState.FAILED);
      }

      setIsPublished(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to publish shirt";
      setError(errorMessage);

      // Update lifecycle to FAILED on publish error
      try {
        const imageHash = await generateDataUrlHash(shirtData.imageUrl);
        await updateLifecycle(imageHash, ImageLifecycleState.FAILED);
        await db.shirtHistory.update(imageHash, {
          publishError: errorMessage,
        });
      } catch (updateError) {
        console.warn("Failed to update error state:", updateError);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCloseModal = async () => {
    setShowModal(false);
    setError(undefined);
    setShopifyUrl(undefined);

    // If we just published successfully, update the navbar button state
    if (isPublished) {
      await computePublishedStatus();
    }

    setIsPublished(false);
  };

  const isDisabled =
    !shirtData?.imageUrl ||
    !shirtData?.prompt ||
    shirtData?.isPartial !== false ||
    isPublishing;

  // If already published, show store link button
  if (alreadyPublished) {
    return (
      <Button
        onClick={() =>
          window.open(alreadyPublished.shopifyUrl || SHOPIFY_URL, "_blank")
        }
        size="sm"
        className="bg-primary text-primary-foreground hover:bg-primary/80 flex items-center gap-2"
      >
        <ExternalLink className="h-4 w-4" />
        Go to Store
      </Button>
    );
  }

  return (
    <>
      <Button
        onClick={handleOpenModal}
        disabled={isDisabled}
        size="sm"
        className="bg-primary text-primary-foreground hover:bg-primary/80 flex items-center gap-2"
      >
        {isPublishing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
        {shirtData?.isPartial
          ? "Generating..."
          : isPublishing
            ? "Publishing..."
            : "Publish"}
      </Button>

      <PublishModal
        isOpen={showModal}
        onClose={handleCloseModal}
        designName={designTitle || "Untitled Design"}
        isPublishing={isPublishing}
        publishStatus={publishStatus}
        error={error}
        shopifyUrl={shopifyUrl}
        isPublished={isPublished}
        onPublish={handleConfirmPublish}
      />
    </>
  );
}
