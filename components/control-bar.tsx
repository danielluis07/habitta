import type { ComponentProps, ReactNode, Ref } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The district's controls on one paper-raised strip. They set how the visitor
// sees the district, never where they are in it.
export function ControlBar({ children }: { children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label="View controls"
      className="flex flex-wrap items-center gap-1 rounded-sm border border-border-control bg-paper-raised p-1">
      {children}
    </div>
  );
}

export function ControlBarButton({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      className={cn("px-3 hover:bg-paper hover:no-underline", className)}
      {...props}
    />
  );
}

type ControlSwitchProps = {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ref?: Ref<HTMLButtonElement>;
};

// A preference that is on or off. Its state is written out, not shown by color
// alone, and assistive technology hears the same state from the switch role.
export function ControlSwitch({ label, checked, onCheckedChange, ref }: ControlSwitchProps) {
  return (
    <ControlBarButton
      ref={ref}
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className="gap-2.5">
      {label}{" "}
      <span
        aria-hidden
        className={cn(
          "min-w-9 rounded-sm border px-1.5 py-1 text-center",
          checked ? "border-ink bg-ink text-paper" : "border-border-control",
        )}>
        {checked ? "On" : "Off"}
      </span>
    </ControlBarButton>
  );
}
