import {
  CLEAN_TREE,
  CLEAN_TREE_NAV_VARIANT,
} from "@/components/CleaningPanel/constants";
import { groupOfStep } from "@/components/CleaningPanel/utils";
import { Button } from "@/components/shadcn/button";
import { cn } from "@/lib/shadcn/utils";
import { Check, LockKeyhole } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/shadcn/accordion";
import type { CleanTreeNavProps } from "./types";

export function CleanTreeNav({
  activeStep,
  onSelectStep,
  configuredSteps,
  openGroups,
  onOpenGroupsChange,
  variant = CLEAN_TREE_NAV_VARIANT.Panel,
}: CleanTreeNavProps) {
  const lockedSteps: readonly string[] = [];

  const activeGroup = groupOfStep(activeStep);

  return (
    <aside
      className={cn(
        "flex min-h-0 shrink-0 select-none bg-background",
        variant === CLEAN_TREE_NAV_VARIANT.Panel
          ? "hidden w-67 flex-col border-r border-border lg:flex"
          : "w-full flex-col",
      )}
    >
      <div className="min-h-0 flex-1 overflow-auto">
        <Accordion
          className="w-full"
          multiple
          value={openGroups}
          onValueChange={onOpenGroupsChange}
        >
          {CLEAN_TREE.map((group) => {
            const isOpen = openGroups.includes(group.group);
            const isActiveGroup = group.group === activeGroup;
            return (
              <AccordionItem key={group.group} value={group.group}>
                <AccordionTrigger
                  aria-current={isActiveGroup && !isOpen ? "true" : undefined}
                  className={cn(
                    "items-center rounded-none border-l-3 border-transparent px-4.5 pb-2.25 pt-2.75 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground hover:bg-muted hover:text-foreground hover:no-underline",
                    isActiveGroup &&
                      !isOpen &&
                      "border-l-chart-2 bg-muted text-chart-2",
                  )}
                >
                  {group.group}
                </AccordionTrigger>
                <AccordionContent className="pb-0">
                  {group.items.map((item) => {
                    const locked = lockedSteps.includes(item.id);
                    const configured = configuredSteps.has(item.id);
                    const active = activeStep === item.id;
                    return (
                      <Button
                        key={item.id}
                        type="button"
                        variant="ghost"
                        disabled={locked}
                        aria-current={active ? "step" : undefined}
                        className={cn(
                          "h-10 w-full justify-between rounded-none border-l-3 border-transparent px-4.5 py-2 text-left text-[15px] font-normal text-foreground hover:bg-muted hover:text-foreground",
                          active &&
                            "border-l-chart-2 bg-muted font-bold text-chart-2",
                          locked && "text-muted-foreground opacity-50",
                        )}
                        onClick={() => {
                          onSelectStep(item.id);
                        }}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {configured && (
                            <Check
                              data-icon="inline-start"
                              aria-hidden="true"
                              strokeWidth={3}
                              className="size-3.5 shrink-0 text-chart-2"
                            />
                          )}
                          <span className="truncate">{item.label}</span>
                          {configured && (
                            <span className="sr-only">Configured</span>
                          )}
                        </span>
                        {locked && (
                          <LockKeyhole
                            data-icon="inline-end"
                            aria-hidden="true"
                            className="text-muted-foreground"
                          />
                        )}
                      </Button>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </aside>
  );
}
