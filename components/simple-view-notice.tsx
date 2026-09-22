import { Button } from "@/components/ui/button";
import type { SimpleViewReason } from "@/lib/journey";
import { cn } from "@/lib/utils";

const messages: Record<SimpleViewReason, string> = {
  manual: "Simple view is on. The building index lists every building.",
  unsupported: "Simple view is on because this device can't show the 3D district.",
  contextLost: "Simple view is on because the 3D district stopped working.",
  assetFailed: "Simple view is on because part of the 3D district couldn't load.",
  slow: "Simple view is on because the 3D district was running too slowly.",
};

type SimpleViewNoticeProps = {
  /** Why the page switched to simple view, or `null` when there's nothing to say. */
  reason: SimpleViewReason | null;
  onDismiss: () => void;
};

// A brief word on why the page switched to simple view. The live region stays
// mounted, even when empty, so each new notice is announced when it appears.
export function SimpleViewNotice({ reason, onDismiss }: SimpleViewNoticeProps) {
  return (
    <div className="px-4 md:px-10">
      {/* On wide screens it stays clear of the 380px building overview panel. */}
      <div
        className={cn(
          "flex max-w-2xl items-center gap-2 md:max-w-[min(42rem,calc(100%-380px-1.5rem))]",
          reason &&
            "mb-6 rounded-sm border border-border-control bg-paper-raised py-1 pr-1 pl-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-200",
        )}>
        <p role="status" aria-live="polite" className={cn("flex-1 type-body-sm", reason && "py-2")}>
          {reason ? messages[reason] : null}
        </p>
        {reason ? (
          <Button variant="ghost" className="px-3" aria-label="Dismiss notice" onClick={onDismiss}>
            Dismiss
          </Button>
        ) : null}
      </div>
    </div>
  );
}
