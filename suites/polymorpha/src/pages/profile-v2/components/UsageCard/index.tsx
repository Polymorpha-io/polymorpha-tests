import {
  BarChart3,
  CloudUpload,
  FileDown,
  FlaskConical,
  HardDrive,
  Table2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import { useUsageStats } from "@/pages/profile-v2/hooks/useUsageStats";
import { formatBytes } from "@/lib/format";
import { StatTile } from "@/pages/profile-v2/components/UsageCard/components/StatTile";

export default function UsageCard() {
  const { stats } = useUsageStats();

  const rowsProcessed = stats.totalRowsProcessed.toLocaleString();
  const datasets = stats.datasetsAnalysed.toLocaleString();
  const testRuns = stats.testsRun.toLocaleString();
  const uploads = stats.totalUploads.toLocaleString();
  const exports = stats.totalExports.toLocaleString();
  const storage = formatBytes(stats.totalStorageBytes);

  return (
    <Card className="overflow-hidden">
      {/* Header: icon, title, description */}
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-primary/10 dark:bg-primary flex items-center justify-center text-primary dark:text-primary-foreground shrink-0">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold leading-tight">
              Stats overview
            </CardTitle>
            <CardDescription className="text-xs leading-tight mt-0.5">
              Monitor your processing activity
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {/* Rows processed — large hero stat */}
      <CardContent className="border-b border-border pb-4">
        <p className="text-[10px] font-medium tracking-[0.08em] uppercase text-muted-foreground">
          Rows processed
        </p>
        <p className="text-[28px] font-semibold leading-none tracking-tight font-mono tabular-nums mt-1">
          {rowsProcessed}
        </p>
      </CardContent>

      {/* Stat tiles grid: datasets, test runs, uploads, exports, storage */}
      <CardContent className="pb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <StatTile icon={Table2} value={datasets} label="Datasets" />
          <StatTile icon={FlaskConical} value={testRuns} label="Test runs" />
          <StatTile icon={CloudUpload} value={uploads} label="Uploads" />
          <StatTile icon={FileDown} value={exports} label="Exports" />
          <StatTile icon={HardDrive} value={storage} label="Storage" />
        </div>
      </CardContent>
    </Card>
  );
}
