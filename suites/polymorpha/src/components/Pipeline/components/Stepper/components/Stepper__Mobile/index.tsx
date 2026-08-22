import { STEPS, STEPS_ID, STEP_ORDER } from "@/components/Pipeline/constants";
import type { StepperProps } from "@/components/Pipeline/components/Stepper";

type Stepper__MobileProps = Omit<StepperProps, "setStep">;

export default function Stepper__Mobile({
  current,
  isWorkspaceMode,
}: Stepper__MobileProps) {
  const visibleSteps = isWorkspaceMode
    ? STEP_ORDER.filter((id) => id !== STEPS_ID.upload).map((id) => STEPS[id])
    : Object.values(STEPS);
  const visibleIdx = visibleSteps.findIndex((s) => s.id === current);
  const percent = Math.round(((visibleIdx + 1) / visibleSteps.length) * 100);
  const currentStep = STEPS[current];
  const Icon = currentStep.icon;

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground tracking-[0.08em] uppercase">
          Step {visibleIdx + 1} of {visibleSteps.length}
        </span>
        <span className="text-xs font-semibold text-primary dark:text-chart-2">
          {percent}%
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
          <Icon
            className="w-5 h-5 text-primary-foreground"
            aria-hidden="true"
          />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">
            {currentStep.label}
          </p>
          <p className="text-xs text-muted-foreground leading-snug mt-0.5">
            {currentStep.description}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div
          className="h-1.5 bg-border rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Workflow progress"
        >
          <div
            className="h-full bg-primary rounded-full transition-[width] duration-400 ease-in-out motion-reduce:transition-none"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs font-medium text-muted-foreground tracking-[0.04em] uppercase">
          <span>{visibleSteps[0]?.label}</span>
          <span>{visibleSteps[visibleSteps.length - 1]?.label}</span>
        </div>
      </div>
    </div>
  );
}
