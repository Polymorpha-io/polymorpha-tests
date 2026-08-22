import { useCallback, useMemo } from "react";
import { ChevronDown, List, X } from "lucide-react";
import { buildDefaultConfig } from "@polymorpha/business-logic";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/shadcn/drawer";
import { Tabs, TabsContent } from "@/components/shadcn/tabs";
import { CleanTreeNav } from "@/components/CleaningPanel/components/CleanTreeNav";
import { CLEAN_TREE_NAV_VARIANT } from "@/components/CleaningPanel/constants";
import { CleanTreeContent } from "@/components/CleaningPanel/components/CleanTreeContent";
import { DatasetIdentity } from "@/components/CleaningPanel/components/DatasetIdentity";
import { DataTable } from "@/components/CleaningPanel/components/DataTable";
import { TabBar } from "@/components/CleaningPanel/components/TabBar";
import { TAB_ID } from "@/components/CleaningPanel/components/TabBar/constants";
import { useCleaningPanelState } from "@/components/CleaningPanel/useCleaningPanelState";
import { RecommendButton } from "@/components/RecommendButton/RecommendButton";
import "@/components/CleaningPanel/CleaningPanel.css";
import "@/components/CleaningPanel/css/preview-strips.css";
import "@/components/CleaningPanel/css/before-after.css";
import "@/components/CleaningPanel/css/row-gate.css";
import "@/components/CleaningPanel/css/badges.css";
import "@/components/CleaningPanel/css/toggle-cards.css";
import "@/components/CleaningPanel/css/footer.css";
import "@/components/CleaningPanel/css/accordion.css";
import "@/components/CleaningPanel/css/feature-modal.css";
import "@/components/CleaningPanel/css/step-footer.css";
import "@/components/CleaningPanel/css/misc.css";
import "@/components/AnalysePanel/AnalysePanel.css";

type CleaningPanelProps = {
  onProcess?: () => void;
  isProcessing?: boolean;
  processError?: string | null;
};

export function CleaningPanel({
  onProcess,
  isProcessing = false,
  processError,
}: CleaningPanelProps) {
  const state = useCleaningPanelState();

  const handleApply = useCallback(() => {
    state.setStepPreview(null);
    onProcess?.();
  }, [onProcess, state.setStepPreview]);

  const applyFooter = useMemo(
    () => (
      <div className="clean-step-footer">
        {state.stepPreview && (
          <div className="clean-step-preview-result">
            <span>
              <strong>{state.stepPreview.rowsRemoved}</strong> rows removed
            </span>
            <span>
              <strong>{state.stepPreview.valuesImputed}</strong> values imputed
            </span>
            <span>
              <strong>{state.stepPreview.outliersHandled}</strong> outliers
              handled
            </span>
            <span>
              <strong>{state.stepPreview.columnsRemoved}</strong> columns
              removed
            </span>
          </div>
        )}
        {state.activeStepWarnings.length > 0 && (
          <div className="clean-step-warnings">
            {state.activeStepWarnings.map((w, i) => (
              <p key={i} className="clean-step-warning-item">
                {w.message}
              </p>
            ))}
          </div>
        )}
        <div className="clean-step-footer-actions">
          <button
            className="btn-primary btn-sm clean-step-apply-btn"
            onClick={handleApply}
            disabled={isProcessing}
          >
            {isProcessing ? "Applying..." : "Apply changes"}
          </button>
          <button
            className="btn-ghost btn-sm clean-estimate-link"
            onClick={state.handlePreviewStep}
            disabled={state.isPreviewing}
          >
            {state.isPreviewing ? "Estimating..." : "Estimate impact"}
          </button>
          <span className="clean-autosave-indicator">Auto-saved</span>
        </div>
        {(processError || state.previewError) && (
          <p className="clean-inline-error">
            {processError || state.previewError}
          </p>
        )}
      </div>
    ),
    [
      state.stepPreview,
      state.activeStepWarnings,
      state.isPreviewing,
      state.previewError,
      state.handlePreviewStep,
      isProcessing,
      processError,
      handleApply,
    ],
  );

  if (!state.raw || !state.cleaningConfig) {
    return null;
  }

  return (
    <>
      <div className="flex w-full flex-col gap-4 self-start overflow-hidden">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <DatasetIdentity dataset={state.cleaned ?? state.raw} />
          <RecommendButton stage="process" />
        </div>

        <Tabs
          value={state.activeTab}
          onValueChange={state.setActiveTab}
          className="flex-1 min-h-0"
        >
          <TabBar
            issues={state.dataScanIssues}
            issuesDisabled={state.hasCleaned}
            onIssueSelect={state.handleIssueSelect}
            impactCount={state.impactCount}
            impact={state.impact}
            onUndo={state.handleUndo}
            canUndo={state.canUndo}
            onRedo={state.handleRedo}
            canRedo={state.canRedo}
            onReset={() => {
              state.updateConfig(buildDefaultConfig(state.raw!));
              state.setStepPreview(null);
            }}
          />

          {/* Data tab */}
          <TabsContent value={TAB_ID.data}>
            {state.raw && (
              <DataTable
                dataset={state.cleaned ?? state.raw}
                newColumnNames={state.diff?.columnsAdded}
              />
            )}
          </TabsContent>

          {/* Processing tab */}
          <TabsContent value={TAB_ID.workflow}>
            <Drawer
              modal
              swipeDirection="left"
              open={state.stepDrawerOpen}
              onOpenChange={state.setStepDrawerOpen}
            >
              <div className="flex min-h-0 flex-1 flex-col">
                {/* Drawer trigger (tablet and below) */}
                <DrawerTrigger
                  aria-label="Open processing steps"
                  className="mb-3.5 inline-flex w-fit items-center gap-2 self-start rounded-lg border border-border bg-background px-3 py-2 text-[15px] font-semibold text-foreground hover:bg-muted dark:border-input dark:bg-input/30 dark:hover:bg-input/50 lg:hidden"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <List className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{state.activeStepLabel}</span>
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                </DrawerTrigger>

                <div className="flex min-h-0 flex-1 flex-row overflow-hidden rounded-lg border border-border bg-card">
                  {/* Left sidebar tree (desktop only) */}
                  <CleanTreeNav
                    variant={CLEAN_TREE_NAV_VARIANT.Panel}
                    activeStep={state.activeStep}
                    onSelectStep={state.setActiveStep}
                    configuredSteps={state.configuredSteps}
                    openGroups={state.openGroups}
                    onOpenGroupsChange={state.setOpenGroups}
                  />

                  {/* Right content panel */}
                  <CleanTreeContent
                    activeStep={state.activeStep}
                    raw={state.raw}
                    cleaned={state.cleaned}
                    cleaningConfig={state.cleaningConfig}
                    configuredSteps={state.configuredSteps}
                    updateConfig={state.updateConfig}
                    footer={applyFooter}
                    numericColumns={state.numericColumns}
                    step__rowGate={state.rowGateProps}
                    step__missing={state.missingProps}
                    step__outlier={state.outlierProps}
                    step__duplicates={state.duplicatesProps}
                    step__columns={state.columnsProps}
                    step__explore={state.exploreProps}
                  />
                </div>
              </div>

              {/* Step drawer (tablet and below) */}
              <DrawerContent className="bg-background dark:bg-background">
                <DrawerHeader className="flex flex-row items-center justify-between gap-2 border-b border-border py-3.5 pl-4 pr-0.5">
                  <DrawerTitle className="text-[13px] font-bold uppercase tracking-[0.06em]">
                    Steps
                  </DrawerTitle>
                  <DrawerClose
                    aria-label="Close steps"
                    className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  >
                    <X className="size-4" />
                  </DrawerClose>
                </DrawerHeader>
                <div className="min-h-0 flex-1 overflow-auto">
                  <CleanTreeNav
                    variant={CLEAN_TREE_NAV_VARIANT.Drawer}
                    activeStep={state.activeStep}
                    onSelectStep={(step) => {
                      state.setActiveStep(step);
                      state.setStepDrawerOpen(false);
                    }}
                    configuredSteps={state.configuredSteps}
                    openGroups={state.openGroups}
                    onOpenGroupsChange={state.setOpenGroups}
                  />
                </div>
              </DrawerContent>
            </Drawer>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
