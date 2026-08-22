import { TriangleAlert } from "lucide-react";
import { Card } from "@/components/shadcn/card";
import { DeleteAccountDialog } from "@/pages/profile-v2/components/DeleteAccountDialog";
import { useAccountDeletion } from "@/pages/profile-v2/hooks/useAccountDeletion";

export function DangerZone() {
  const { deleting, deleteError, isGoogleUser, handleDelete } =
    useAccountDeletion();

  return (
    <Card className="overflow-hidden">
      <header className="flex items-start gap-4 border-b border-border px-5 py-5 sm:px-6 sm:py-6">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
        >
          <TriangleAlert className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight sm:text-lg">
            Danger zone
          </h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Irreversible actions for your Polymorpha account
          </p>
        </div>
      </header>

      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="rounded-lg border border-border bg-muted p-4 sm:p-5">
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold">Delete this account</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Once you delete your account, there is no going back. This will
                permanently remove your Polymorpha workspace — including all
                datasets, analysis runs, saved uploads, and exports. This action
                cannot be undone.
              </p>
            </div>
            <div>
              <DeleteAccountDialog
                onDelete={handleDelete}
                deleting={deleting}
                deleteError={deleteError}
                isGoogleUser={isGoogleUser}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
