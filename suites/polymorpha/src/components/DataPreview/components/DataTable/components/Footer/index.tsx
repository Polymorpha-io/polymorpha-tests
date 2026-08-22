interface FooterProps {
  visibleCount: number;
  totalCount: number;
}

export function Footer({ visibleCount, totalCount }: FooterProps) {
  return (
    <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground font-mono bg-background">
      Showing{" "}
      <span className="font-semibold text-foreground">
        {visibleCount.toLocaleString()}
      </span>{" "}
      of{" "}
      <span className="font-semibold text-foreground">
        {totalCount.toLocaleString()}
      </span>{" "}
      rows
    </div>
  );
}
