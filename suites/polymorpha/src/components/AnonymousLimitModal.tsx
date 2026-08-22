import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { ANON_MAX_ROWS } from "@/config";

export interface AnonymousLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalRows: number;
  truncatedRows?: number;
  onContinue?: () => void;
}

export function AnonymousLimitModal({
  open,
  onOpenChange,
  totalRows,
  truncatedRows = ANON_MAX_ROWS,
  onContinue,
}: AnonymousLimitModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Anonymous limit: first {ANON_MAX_ROWS.toLocaleString()} rows
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm leading-relaxed">
              <p>
                You uploaded <strong>{totalRows.toLocaleString()} rows</strong>,
                but anonymous sessions are limited to the first{" "}
                <strong>{truncatedRows.toLocaleString()} rows</strong>.
              </p>
              <p>
                Sign in for{" "}
                <strong>unlimited rows (up to 50 MB per file)</strong>, saved
                workspaces, and full export history.
              </p>
              <p className="text-xs text-muted-foreground">
                We&apos;ll continue with the first{" "}
                {truncatedRows.toLocaleString()} rows so you can try cleaning,
                analysis and export right now.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <button
            className="btn-ghost btn-sm"
            onClick={() => {
              onContinue?.();
              onOpenChange(false);
            }}
          >
            Continue with {truncatedRows.toLocaleString()}
          </button>
          <Link
            to="/login"
            className="btn-primary btn-sm text-center"
            onClick={() => onOpenChange(false)}
          >
            Sign in to unlock all rows
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
