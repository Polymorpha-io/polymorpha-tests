import { Fragment, useEffect, useRef } from "react";
import type { AppStep } from "@/types";
import { useIsMobile } from "@/hooks/shadcn/use-mobile";
import { STEPS, STEPS_ID, STEP_ORDER } from "@/components/Pipeline/constants";
import Stepper__Mobile from "@/components/Pipeline/components/Stepper/components/Stepper__Mobile";

export type StepperProps = {
  current: AppStep;
  setStep: (step: AppStep) => void;
  isWorkspaceMode: boolean;
  disabled?: boolean;
};

export default function Stepper({
  current,
  setStep,
  isWorkspaceMode,
  disabled = false,
}: StepperProps) {
  const isMobile = useIsMobile();

  const order = STEP_ORDER;
  const currentIdx = order.indexOf(current);
  const visibleSteps = isWorkspaceMode
    ? STEP_ORDER.filter((id) => id !== STEPS_ID.upload).map((id) => STEPS[id])
    : Object.values(STEPS);

  const stepElsRef = useRef(new Map<AppStep, HTMLLIElement>());

  useEffect(() => {
    const stepEl = stepElsRef.current.get(current);
    if (!stepEl) return;
    stepEl.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [current]);

  if (isMobile) {
    return (
      <Stepper__Mobile current={current} isWorkspaceMode={isWorkspaceMode} />
    );
  }

  return (
    <nav aria-label="Progress">
      <ol className="flex items-start justify-center max-sm:justify-start overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
        {visibleSteps.map((s, i) => {
          const origIdx = order.indexOf(s.id);
          const isDone = origIdx < currentIdx;
          const isCurrent = origIdx === currentIdx;
          const Icon = s.icon;

          return (
            <Fragment key={s.id}>
              <li
                ref={(el) => {
                  if (el) stepElsRef.current.set(s.id, el);
                  else stepElsRef.current.delete(s.id);
                }}
                className="flex flex-col items-center w-24 shrink-0"
              >
                {isDone ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (disabled) return;
                      setStep(s.id);
                    }}
                    title={
                      disabled
                        ? "Cleaning in progress — please wait"
                        : `Go back to ${s.label}`
                    }
                    aria-label={`Go back to ${s.label}`}
                    disabled={disabled}
                    aria-disabled={disabled}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${disabled ? "bg-muted opacity-50 cursor-not-allowed" : "bg-muted hover:bg-muted/80"}`}
                  >
                    <Icon
                      className="w-4 h-4 text-primary dark:text-chart-2"
                      aria-hidden="true"
                    />
                  </button>
                ) : (
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isCurrent ? "bg-primary" : "bg-card border border-border"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        isCurrent
                          ? "text-primary-foreground"
                          : "text-muted-foreground"
                      }`}
                      aria-hidden="true"
                    />
                  </span>
                )}
                <span
                  className={`font-mono text-xs mt-2 text-center leading-tight ${
                    isCurrent
                      ? "text-primary dark:text-chart-2 font-medium"
                      : "text-muted-foreground"
                  }`}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {s.label}
                </span>
              </li>
              {i < visibleSteps.length - 1 && (
                <li
                  aria-hidden="true"
                  className={`flex-1 min-w-8 max-w-16 h-px mt-4 ${
                    isDone ? "bg-primary dark:bg-chart-2" : "bg-border"
                  }`}
                />
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
