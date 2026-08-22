import { HelpCircle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/shadcn/dialog";

export function DataModellerHelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent
        className="p-0 border-0 bg-transparent shadow-none sm:rounded-none max-w-none flex items-center justify-center"
        hideClose
      >
        <div className="modal-content" style={{ maxWidth: "600px" }}>
          <button
            className="modal-close-icon"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6 6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <h2
            id="help-title"
            style={{
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <HelpCircle size={20} className="text-primary" /> How to use Data
            Modeller
          </h2>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              color: "var(--foreground)",
            }}
          >
            <div>
              <strong>1. Datasets & Connections</strong>
              <p className="text-muted-foreground" style={{ marginTop: "4px" }}>
                Your current table is already loaded in the center. To join it
                with other datasets, drag a table from the left{" "}
                <strong>Connections</strong> sidebar and drop it anywhere on the
                canvas.
              </p>
            </div>
            <div>
              <strong>2. Operations (Joins & Unions)</strong>
              <p className="text-muted-foreground" style={{ marginTop: "4px" }}>
                Drag an operation like <strong>Inner Join</strong> from the left
                sidebar. Notice it has two connection points: Left and Right.
                Connect the dots from your data sources into these Left and
                Right inputs.
              </p>
            </div>
            <div>
              <strong>3. Previewing Data</strong>
              <p className="text-muted-foreground" style={{ marginTop: "4px" }}>
                Click on any operation node (like a Join) to instantly see the
                result of that operation in the table below. If the table is
                blank, make sure both Left and Right sides are connected
                properly!
              </p>
            </div>
            <div>
              <strong>4. Exporting</strong>
              <p className="text-muted-foreground" style={{ marginTop: "4px" }}>
                Drag an <strong>Export</strong> node and connect it to your
                final result. Clicking it will instantly download your newly
                modeled CSV file.
              </p>
            </div>
          </div>

          <div
            style={{
              marginTop: "24px",
              paddingTop: "16px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                color: "var(--muted-foreground)",
                fontStyle: "italic",
              }}
            >
              Made by stella
            </div>
            <button className="btn-primary" onClick={onClose}>
              Got it
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
