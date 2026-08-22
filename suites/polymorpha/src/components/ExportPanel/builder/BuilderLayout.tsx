import { CheckItem } from "@/components/ExportPanel/HtmlPreview";
import type { PDFFontFamily } from "@/types";
import type { ReportBuilderProps } from "./builderShared";

export function BuilderLayout({
  exportPreferences,
  setExportPreferences,
}: ReportBuilderProps) {
  return (
    <div className="ep-card">
      <div className="ep-card-head">
        <span className="ep-card-icon"></span>
        <h4>PDF Layout</h4>
      </div>
      <div className="ep-card-body">
        <div className="ep-pref-row">
          <label className="ep-pref-label">Font</label>
          <select
            className="ep-pref-select"
            value={exportPreferences.pdfFont}
            onChange={(e) =>
              setExportPreferences({
                pdfFont: e.target.value as PDFFontFamily,
              })
            }
          >
            <option value="Roboto">Roboto</option>
            <option value="Helvetica">Helvetica</option>
            <option value="Times">Times New Roman</option>
            <option value="Courier">Courier</option>
          </select>
        </div>
        <CheckItem
          label="Include header"
          checked={exportPreferences.includeHeader}
          onChange={(v) => setExportPreferences({ includeHeader: v })}
        />
        <CheckItem
          label="Include footer (page numbers)"
          checked={exportPreferences.includeFooter}
          onChange={(v) => setExportPreferences({ includeFooter: v })}
        />
        <CheckItem
          label="Show author name"
          checked={exportPreferences.includeAuthorName}
          onChange={(v) => setExportPreferences({ includeAuthorName: v })}
        />
        <CheckItem
          label="Show polymorpha logo"
          checked={exportPreferences.includeLogo}
          onChange={(v) => setExportPreferences({ includeLogo: v })}
        />
        <CheckItem
          label="Show creation date"
          checked={exportPreferences.includeCreationDate}
          onChange={(v) => setExportPreferences({ includeCreationDate: v })}
        />
        <div className="ep-divider" />
        <div className="ep-pref-row">
          <label className="ep-pref-label">Author name</label>
          <input
            className="ep-pref-input"
            type="text"
            placeholder="Your name"
            value={exportPreferences.authorName}
            onChange={(e) =>
              setExportPreferences({ authorName: e.target.value })
            }
          />
        </div>
        <div className="ep-pref-row">
          <label className="ep-pref-label">Location</label>
          <input
            className="ep-pref-input"
            type="text"
            placeholder="e.g. University of Cape Town"
            value={exportPreferences.location}
            onChange={(e) => setExportPreferences({ location: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
