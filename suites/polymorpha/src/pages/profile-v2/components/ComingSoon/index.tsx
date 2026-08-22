import { Sparkles, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/shadcn/card";

interface ComingSoonProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
}

export function ComingSoon({
  icon: Icon = Sparkles,
  title = "Something new is on the way",
  description = "We're building this feature to make your workflow even smoother. Stay tuned.",
}: ComingSoonProps) {
  return (
    <Card className="overflow-hidden flex-1">
      <CardContent className="flex flex-col items-center justify-center text-center px-8 py-10 sm:p-12 h-full">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 dark:bg-primary border border-primary/15 dark:border-primary flex items-center justify-center text-primary dark:text-primary-foreground mb-6">
          <Icon className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-65">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
