import type { ReactNode } from "react";
import { BeforeAfter, EXAMPLES } from "@/components/CleaningPanel/BeforeAfter";
import { EncodingModal } from "@/components/EncodingModal/EncodingModal";
import "@/components/CleaningPanel/CleaningPanel.css";
import type { Dataset } from "@/types";

export type EncodingStepProps = {
  raw: Dataset;
  footer: ReactNode;
};

export function EncodingStep({ raw, footer }: EncodingStepProps) {
  return (
    <div className="clean-step-panel">
      <h3>Encoding</h3>
      <p className="clean-hint-line">
        Use encoding after column cleanup so you don't encode fields you plan to
        drop or rename.
      </p>
      {raw.rows.length === 0 && (
        <BeforeAfter
          headers={EXAMPLES.encoding.headers}
          before={EXAMPLES.encoding.before}
          after={EXAMPLES.encoding.after}
          afterHeaders={EXAMPLES.encoding.afterHeaders}
          captionBefore={EXAMPLES.encoding.captionBefore}
          captionAfter={EXAMPLES.encoding.captionAfter}
        />
      )}
      <EncodingModal inline />
      {footer}
    </div>
  );
}
