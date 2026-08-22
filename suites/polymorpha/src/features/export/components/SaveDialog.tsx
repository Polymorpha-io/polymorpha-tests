import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { Button } from "@/components/shadcn/button";

export function SaveDialog({
  open,
  onOpenChange,
  fileName,
  saving,
  onSave,
  onSkip,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fileName: string | null;
  saving: boolean;
  onSave: () => void;
  onSkip: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save export?</DialogTitle>
          <DialogDescription>
            {fileName
              ? `Save ${fileName} to this workspace.`
              : "Save this export to the workspace."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onSkip}
            disabled={saving}
          >
            Download only
          </Button>
          <Button type="button" onClick={onSave} disabled={saving || !fileName}>
            {saving ? "Saving…" : "Save to workspace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
