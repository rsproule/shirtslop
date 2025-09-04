import { useEffect, useState } from "react";
import { useEcho } from "@merit-systems/echo-react-sdk";
import { ExternalLinkIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Button } from "./button";

interface InsufficientBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InsufficientBalanceModal({
  isOpen,
  onClose,
}: InsufficientBalanceModalProps) {
  const { createPaymentLink } = useEcho();
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  // Pre-generate payment link when modal opens
  useEffect(() => {
    if (isOpen && !paymentUrl && !isGeneratingLink) {
      setIsGeneratingLink(true);
      createPaymentLink(1.0)
        .then(url => {
          setPaymentUrl(url);
        })
        .catch(error => {
          console.error("Failed to create payment link:", error);
        })
        .finally(() => {
          setIsGeneratingLink(false);
        });
    }
  }, [isOpen, paymentUrl, isGeneratingLink, createPaymentLink]);

  const handleBuyCredits = () => {
    if (paymentUrl) {
      window.open(paymentUrl, "_blank");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Insufficient Balance</DialogTitle>
          <DialogDescription>
            You don't have enough credits to generate a design. Add $1 to your
            account to continue creating amazing shirt designs.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleBuyCredits}
            disabled={!paymentUrl || isGeneratingLink}
            className="flex items-center gap-2"
          >
            <ExternalLinkIcon className="h-4 w-4" />
            {isGeneratingLink ? "Preparing..." : "Buy $1 Credits"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
