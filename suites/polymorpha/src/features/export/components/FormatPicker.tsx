import { FileText, Table, Sheet } from "lucide-react";
import { Card, CardContent } from "@/components/shadcn/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import type { ExportFormat, ExportPreset } from "../types";
import { cn } from "@/lib/shadcn/utils";

const FORMATS: Array<{
  id: ExportFormat;
  label: string;
  desc: string;
  Icon: typeof FileText;
}> = [
  {
    id: "pdf",
    label: "PDF Report",
    desc: "Publication-ready report",
    Icon: FileText,
  },
  {
    id: "xlsx",
    label: "Excel Workbook",
    desc: "Multi-sheet analysis",
    Icon: Sheet,
  },
  { id: "csv", label: "Cleaned CSV", desc: "Raw cleaned rows", Icon: Table },
];

const PRESETS: Array<{ id: ExportPreset; label: string; desc: string }> = [
  { id: "essentials", label: "Essentials", desc: "Concise summary" },
  { id: "standard", label: "Standard", desc: "Balanced report" },
  { id: "complete", label: "Complete", desc: "Full analysis + visuals" },
];

export function FormatPicker({
  format,
  setFormat,
  preset,
  setPreset,
  disabled,
}: {
  format: ExportFormat;
  setFormat: (f: ExportFormat) => void;
  preset: ExportPreset;
  setPreset: (p: ExportPreset) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Format</h3>
        <div className="mt-2 grid grid-cols-3 gap-2 max-[640px]:grid-cols-1">
          {FORMATS.map(({ id, label, desc, Icon }) => (
            <Card
              key={id}
              className={cn(
                "cursor-pointer transition-colors",
                format === id && "ring-2 ring-primary bg-primary/5",
                disabled && "pointer-events-none opacity-50",
              )}
              onClick={() => !disabled && setFormat(id)}
              role="radio"
              aria-checked={format === id}
              tabIndex={disabled ? -1 : 0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (!disabled) setFormat(id);
                }
              }}
            >
              <CardContent className="flex flex-col gap-1 p-3">
                <div className="flex items-center gap-2">
                  <Icon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <span className="text-xs text-muted-foreground">{desc}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Preset</h3>
        <Tabs
          value={preset}
          onValueChange={(v) => setPreset(v as ExportPreset)}
          className="mt-2"
        >
          <TabsList className="w-full">
            {PRESETS.map((p) => (
              <TabsTrigger
                key={p.id}
                value={p.id}
                className="flex-1"
                disabled={!!disabled}
                title={p.desc}
              >
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {PRESETS.find((p) => p.id === preset)?.desc}
        </p>
      </div>
    </div>
  );
}
