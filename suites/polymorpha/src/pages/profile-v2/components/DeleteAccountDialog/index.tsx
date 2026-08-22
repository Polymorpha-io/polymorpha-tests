import { useState, useCallback } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  TriangleAlert,
  Eye,
  EyeOff,
  LoaderCircle,
  CircleAlert,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { cn } from "@/lib/shadcn/utils";

interface DeleteAccountDialogProps {
  onDelete: (password?: string) => void;
  deleting?: boolean;
  deleteError?: string | null;
  isGoogleUser?: boolean;
}

export function DeleteAccountDialog({
  onDelete,
  deleting = false,
  deleteError = null,
  isGoogleUser = false,
}: DeleteAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleOpen = useCallback(() => {
    setOpen(true);
    setPassword("");
    setShowPassword(false);
  }, []);

  const handleConfirm = useCallback(() => {
    const trimmed = password.trim();
    if (!trimmed) {
      return;
    }
    onDelete(trimmed);
  }, [password, onDelete]);

  const handleConfirmGoogle = useCallback(() => {
    onDelete();
  }, [onDelete]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPassword(e.target.value);
    },
    [],
  );

  const hasPassword = password.trim().length > 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        onClick={handleOpen}
        render={
          <Button
            type="button"
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive! hover:text-white!"
          >
            <Trash2 className="h-4 w-4" />
            Delete account
          </Button>
        }
      />
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-popover p-6 text-popover-foreground ring-1 ring-foreground/10 shadow-xl duration-100 outline-none sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          {!deleting && (
            <DialogPrimitive.Close
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-4 right-4"
                />
              }
            >
              <X />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}

          <div className={deleting ? "opacity-60" : ""}>
            <div className="mb-5 flex items-start gap-4">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
              >
                <TriangleAlert className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="text-base font-semibold">
                  Delete your account
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                  {isGoogleUser
                    ? "Confirm that you want to permanently delete your account."
                    : "Enter your password to confirm account deletion."}
                </DialogPrimitive.Description>
              </div>
            </div>

            {!isGoogleUser && (
              <div className="mb-5">
                <label
                  htmlFor="delete-password"
                  className={cn(
                    "mb-1.5 block text-sm font-medium",
                    deleting && "opacity-60",
                  )}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="delete-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={password}
                    onChange={handleInputChange}
                    disabled={deleting}
                    className={cn(
                      "w-full rounded-lg border bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
                      deleteError ? "border-destructive" : "border-border",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    disabled={deleting}
                    className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {deleteError && (
                  <p className="mt-1.5 flex items-center gap-1 text-sm text-destructive">
                    <CircleAlert className="h-3.5 w-3.5" />
                    <span>{deleteError}</span>
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <DialogPrimitive.Close
                render={
                  <Button type="button" variant="outline" disabled={deleting} />
                }
              >
                Cancel
              </DialogPrimitive.Close>
              {isGoogleUser ? (
                <Button
                  type="button"
                  onClick={handleConfirmGoogle}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    "Yes, delete my account"
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!hasPassword || deleting}
                >
                  {deleting ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    "Delete account"
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
