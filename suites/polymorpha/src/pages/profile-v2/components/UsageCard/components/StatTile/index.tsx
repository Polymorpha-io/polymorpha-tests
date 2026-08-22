import { type LucideIcon } from "lucide-react";

interface StatTileProps {
  icon: LucideIcon;
  value: string;
  unit?: string;
  label: string;
}

export function StatTile({ icon: Icon, value, unit, label }: StatTileProps) {
  return (
    <div
      className="group rounded-2xl border border-transparent p-3 transition-colors hover:bg-primary/10 hover:border-border"
      role="group"
      aria-label={`${value}${unit ? ` ${unit}` : ""} ${label}`}
    >
      <div className="w-7 h-7 rounded-[0.3rem] bg-primary/10 dark:bg-primary flex items-center justify-center mb-2 transition-colors group-hover:bg-primary">
        <Icon className="w-3.5 h-3.5 text-primary dark:text-primary-foreground transition-colors group-hover:text-primary-foreground" />
      </div>
      <p className="text-lg font-semibold font-mono leading-none tabular-nums transition-colors group-hover:text-primary">
        {value}
        {unit && (
          <span className="text-sm text-muted-foreground font-normal">
            {" "}
            {unit}
          </span>
        )}
      </p>
      <p className="text-[10px] font-medium tracking-[0.08em] uppercase text-muted-foreground mt-1.5">
        {label}
      </p>
    </div>
  );
}
