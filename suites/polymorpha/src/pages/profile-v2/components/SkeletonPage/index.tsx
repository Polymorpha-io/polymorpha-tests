import { Skeleton } from "@/components/shadcn/skeleton";

export function SkeletonPage() {
  return (
    <div className="contents" aria-busy="true">
      <div className="flex flex-1">
        <aside className="hidden md:flex w-[--sidebar-width] shrink-0 flex-col gap-4 border-r p-4">
          <Skeleton className="h-8 w-8 rounded-full bg-muted-foreground/20" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-20 bg-muted-foreground/20" />
            <Skeleton className="h-8 w-full rounded-md bg-muted-foreground/20" />
            <Skeleton className="h-8 w-full rounded-md bg-muted-foreground/20" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-20 bg-muted-foreground/20" />
            <Skeleton className="h-8 w-full rounded-md bg-muted-foreground/20" />
            <Skeleton className="h-8 w-full rounded-md bg-muted-foreground/20" />
            <Skeleton className="h-8 w-full rounded-md bg-muted-foreground/20" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-20 bg-muted-foreground/20" />
            <Skeleton className="h-8 w-full rounded-md bg-muted-foreground/20" />
            <Skeleton className="h-8 w-full rounded-md bg-muted-foreground/20" />
          </div>
        </aside>
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          <div className="space-y-2">
            <Skeleton className="h-6 w-28 md:h-7 md:w-36 bg-muted-foreground/20" />
            <Skeleton className="h-3 w-48 md:h-4 md:w-64 bg-muted-foreground/20" />
          </div>
          <div className="flex flex-col gap-4 rounded-2xl border p-4 md:flex-row md:items-center md:gap-6 md:p-7">
            <Skeleton className="size-16 rounded-full md:size-20 lg:size-24 bg-muted-foreground/20" />
            <div className="flex-1 space-y-2 md:space-y-3">
              <Skeleton className="h-6 w-40 md:h-8 md:w-48 bg-muted-foreground/20" />
              <Skeleton className="h-3 w-56 md:h-4 md:w-64 bg-muted-foreground/20" />
              <Skeleton className="h-3 w-28 md:h-4 md:w-32 bg-muted-foreground/20" />
            </div>
            <Skeleton className="h-8 w-16 rounded-md md:h-9 md:w-20 bg-muted-foreground/20" />
          </div>
          <Skeleton className="h-32 w-full rounded-xl md:h-40 bg-muted-foreground/20" />
        </main>
      </div>
    </div>
  );
}
