import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/shadcn/tabs";
import type { Dataset, ExportPreferences } from "@/types";
import type { VisualCandidate } from "../types";
import { CHART_COLORS } from "@/lib/palette";

function SwitchRow({
  label,
  checked,
  onCheckedChange,
  disabled,
  hint,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-md border border-transparent px-2 py-1.5 has-[button[aria-checked=true]]:bg-muted/60 hover:bg-muted/40">
      <span className="flex flex-col">
        <span className="text-sm">{label}</span>
        {hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onCheckedChange(!checked)}
        className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border bg-muted transition-colors aria-checked:bg-primary disabled:opacity-50"
      >
        <span
          className="inline-block size-4 translate-x-0.5 rounded-full bg-background shadow transition-transform aria-checked:translate-x-4"
          aria-hidden="true"
          // use data attr via parent aria-checked already styles; keep simple
        />
      </button>
    </label>
  );
}

function ColumnPicker({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: string[];
  value: string[] | null;
  onChange: (v: string[] | null) => void;
  disabled?: boolean;
}) {
  const isAll = value === null;
  return (
    <div className="space-y-1.5 rounded-md border bg-card p-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(null)}
          className={`rounded-full border px-2.5 py-1 text-xs ${isAll ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
        >
          All
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([])}
          className={`rounded-full border px-2.5 py-1 text-xs ${value !== null && value.length === 0 ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
        >
          None
        </button>
        {options.map((name) => {
          const selected = value === null || value.includes(name);
          return (
            <button
              key={name}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (isAll) onChange(options.filter((n) => n !== name));
                else if (selected) onChange(value!.filter((n) => n !== name));
                else onChange([...(value ?? []), name]);
              }}
              className={`rounded-full border px-2.5 py-1 text-xs ${selected ? "bg-primary/10 border-primary/30" : "bg-background hover:bg-muted"}`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ReportBuilder({
  preferences,
  setPreferences,
  cleaned,
  numericCols,
  categoricalCols,
  visualCandidates,
  totalTests,
}: {
  preferences: ExportPreferences;
  setPreferences: (up: Partial<ExportPreferences>) => void;
  cleaned: Dataset;
  numericCols: Array<{ name: string }>;
  categoricalCols: Array<{ name: string }>;
  visualCandidates: VisualCandidate[];
  totalTests: number;
}) {
  const numericNames = numericCols.map((c) => c.name);
  const catNames = categoricalCols.map((c) => c.name);
  const allNames = cleaned.columns.map((c) => c.name);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report Builder</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sections" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="columns" className="flex-1">
              Columns
            </TabsTrigger>
            <TabsTrigger value="sections" className="flex-1">
              Sections
            </TabsTrigger>
            <TabsTrigger value="tests" className="flex-1">
              Tests
            </TabsTrigger>
            <TabsTrigger value="visuals" className="flex-1">
              Visuals
            </TabsTrigger>
            <TabsTrigger value="layout" className="flex-1">
              Layout
            </TabsTrigger>
          </TabsList>

          <TabsContent value="columns" className="mt-4 space-y-3">
            <ColumnPicker
              label="Included columns (null = all)"
              options={allNames}
              value={preferences.includedColumns}
              onChange={(v) => setPreferences({ includedColumns: v })}
            />
            <ColumnPicker
              label="Descriptive numeric columns"
              options={numericNames}
              value={preferences.descriptiveColumns}
              onChange={(v) => setPreferences({ descriptiveColumns: v })}
            />
            <ColumnPicker
              label="Frequency categorical columns"
              options={catNames}
              value={preferences.frequencyColumns}
              onChange={(v) => setPreferences({ frequencyColumns: v })}
            />
          </TabsContent>

          <TabsContent value="sections" className="mt-4 space-y-1">
            <SwitchRow
              label="Executive summary"
              checked={preferences.includeExecutiveSummary}
              onCheckedChange={(v) =>
                setPreferences({ includeExecutiveSummary: v })
              }
            />
            <SwitchRow
              label="Data preparation"
              checked={preferences.includeDataPreparation}
              onCheckedChange={(v) =>
                setPreferences({ includeDataPreparation: v })
              }
            />
            <SwitchRow
              label="Descriptive statistics"
              checked={preferences.includeDescriptive}
              onCheckedChange={(v) => setPreferences({ includeDescriptive: v })}
            />
            <SwitchRow
              label="Frequencies"
              checked={preferences.includeFrequencies}
              onCheckedChange={(v) => setPreferences({ includeFrequencies: v })}
            />
            <SwitchRow
              label="Correlation"
              checked={preferences.includeCorrelation}
              onCheckedChange={(v) => setPreferences({ includeCorrelation: v })}
            />
            <SwitchRow
              label="Normality"
              checked={preferences.includeNormality}
              onCheckedChange={(v) => setPreferences({ includeNormality: v })}
            />
            <SwitchRow
              label="Statistical tests"
              checked={preferences.includeTests}
              onCheckedChange={(v) => setPreferences({ includeTests: v })}
            />
            <SwitchRow
              label="Methodology"
              checked={preferences.includeMethodology}
              onCheckedChange={(v) => setPreferences({ includeMethodology: v })}
            />
            <SwitchRow
              label="Visuals"
              hint="Include charts in PDF"
              checked={preferences.includeVisuals}
              onCheckedChange={(v) => setPreferences({ includeVisuals: v })}
            />
          </TabsContent>

          <TabsContent value="tests" className="mt-4 space-y-1">
            <SwitchRow
              label="Enable tests section"
              checked={preferences.includeTests}
              onCheckedChange={(v) => setPreferences({ includeTests: v })}
            />
            <div
              className={
                preferences.includeTests ? "" : "opacity-50 pointer-events-none"
              }
            >
              <SwitchRow
                label="t-tests"
                checked={preferences.exportTTests}
                onCheckedChange={(v) => setPreferences({ exportTTests: v })}
                disabled={!preferences.includeTests}
              />
              <SwitchRow
                label="ANOVA"
                checked={preferences.exportAnova}
                onCheckedChange={(v) => setPreferences({ exportAnova: v })}
                disabled={!preferences.includeTests}
              />
              <SwitchRow
                label="Mann-Whitney"
                checked={preferences.exportMannWhitney}
                onCheckedChange={(v) =>
                  setPreferences({ exportMannWhitney: v })
                }
                disabled={!preferences.includeTests}
              />
              <SwitchRow
                label="Kruskal-Wallis"
                checked={preferences.exportKruskalWallis}
                onCheckedChange={(v) =>
                  setPreferences({ exportKruskalWallis: v })
                }
                disabled={!preferences.includeTests}
              />
              <SwitchRow
                label="Chi-square"
                checked={preferences.exportChiSquare}
                onCheckedChange={(v) => setPreferences({ exportChiSquare: v })}
                disabled={!preferences.includeTests}
              />
              <SwitchRow
                label="Regression"
                checked={preferences.exportRegression}
                onCheckedChange={(v) => setPreferences({ exportRegression: v })}
                disabled={!preferences.includeTests}
              />
              {totalTests === 0 ? (
                <p className="mt-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  No tests selected or no results available. Run analysis first
                  or enable test types.
                </p>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="visuals" className="mt-4 space-y-2">
            {visualCandidates.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm">
                <p className="text-muted-foreground">No visuals selected.</p>
                <a href="#analyse" className="text-primary underline text-xs">
                  Go to Analyse → Visualise to add visuals
                </a>
              </div>
            ) : (
              <div className="space-y-1">
                {visualCandidates.map((c, i) => (
                  <label
                    key={c.key}
                    className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      checked={!preferences.excludedVisualKeys.includes(c.key)}
                      onChange={(e) => {
                        const excluded = new Set(
                          preferences.excludedVisualKeys,
                        );
                        if (e.target.checked) excluded.delete(c.key);
                        else excluded.add(c.key);
                        setPreferences({
                          excludedVisualKeys: Array.from(excluded),
                        });
                      }}
                      className="size-4"
                    />
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{
                        background:
                          c.color || CHART_COLORS[i % CHART_COLORS.length],
                      }}
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate">{c.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.key}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Visuals use the palette from <code>src/lib/palette.ts</code>.
              Disable individually via checkboxes; empty means none exported.
            </p>
          </TabsContent>

          <TabsContent value="layout" className="mt-4 space-y-3">
            <div className="grid gap-2">
              <label className="text-xs font-medium">PDF Font</label>
              <Select
                value={preferences.pdfFont}
                onValueChange={(v) =>
                  setPreferences({ pdfFont: v as ExportPreferences["pdfFont"] })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Roboto">Roboto</SelectItem>
                  <SelectItem value="Helvetica">Helvetica</SelectItem>
                  <SelectItem value="Times">Times</SelectItem>
                  <SelectItem value="Courier">Courier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" htmlFor="exp-author">
                Author
              </label>
              <input
                id="exp-author"
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={preferences.authorName}
                onChange={(e) => setPreferences({ authorName: e.target.value })}
                placeholder="Author name"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" htmlFor="exp-location">
                Location
              </label>
              <input
                id="exp-location"
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={preferences.location}
                onChange={(e) => setPreferences({ location: e.target.value })}
                placeholder="Location / affiliation"
              />
            </div>
            <div className="space-y-1">
              <SwitchRow
                label="Header"
                checked={preferences.includeHeader}
                onCheckedChange={(v) => setPreferences({ includeHeader: v })}
              />
              <SwitchRow
                label="Footer"
                checked={preferences.includeFooter}
                onCheckedChange={(v) => setPreferences({ includeFooter: v })}
              />
              <SwitchRow
                label="Logo"
                checked={preferences.includeLogo}
                onCheckedChange={(v) => setPreferences({ includeLogo: v })}
              />
              <SwitchRow
                label="Creation date"
                checked={preferences.includeCreationDate}
                onCheckedChange={(v) =>
                  setPreferences({ includeCreationDate: v })
                }
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
