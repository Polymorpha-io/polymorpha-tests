import { memo } from "react";
import { XIcon, type LucideIcon } from "lucide-react";

export type ToastMessageProps = {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  onDismiss?: () => void;
};

const ToastMessage = memo(function ToastMessage({
  title,
  description,
  icon: Icon,
  onDismiss,
}: ToastMessageProps) {
  return (
    <section
      className="w-85 max-w-[calc(100vw-36px)] rounded-lg border border-border bg-card p-3 text-card-foreground shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
    >
      <div className="flex items-start gap-2.5">
        {Icon && (
          <span
            aria-hidden="true"
            className="flex size-7 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Icon className="size-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {title && (
            <h3 className="font-mono text-sm font-bold leading-[1.3] tracking-[0.01em]">
              {title}
            </h3>
          )}
          {description && (
            <p className="mt-1 text-[13px] leading-normal text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={onDismiss}
            className="flex size-7.5 flex-none cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>
    </section>
  );
});

export default ToastMessage;
