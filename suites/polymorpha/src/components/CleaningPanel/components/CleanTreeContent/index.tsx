import { memo } from "react";
import { CLEAN_STEPS } from "@/components/CleaningPanel/constants";
import type { CleanTreeContentProps } from "./types";
import { RowGateStep } from "@/components/CleaningPanel/components/RowGateStep";
import { SamplingStep } from "@/components/CleaningPanel/components/SamplingStep";
import { MissingStep } from "@/components/CleaningPanel/components/MissingStep";
import { OutlierStep } from "@/components/CleaningPanel/components/OutlierStep";
import { DuplicatesStep } from "@/components/CleaningPanel/components/DuplicatesStep";
import { TypeConversionStep } from "@/components/CleaningPanel/components/TypeConversionStep";
import { TextCleanupStep } from "@/components/CleaningPanel/components/TextCleanupStep";
import { ColumnsStep } from "@/components/CleaningPanel/components/ColumnsStep";
import { EncodingStep } from "@/components/CleaningPanel/components/EncodingStep";
import { SortStep } from "@/components/CleaningPanel/components/SortStep";
import { StringReplaceStep } from "@/components/CleaningPanel/components/StringReplaceStep";
import { StandardizeStep } from "@/components/CleaningPanel/components/StandardizeStep";
import { MathTransformStep } from "@/components/CleaningPanel/components/MathTransformStep";
import { BinStep } from "@/components/CleaningPanel/components/BinStep";
import { DateExtractStep } from "@/components/CleaningPanel/components/DateExtractStep";
import { DerivedStep } from "@/components/CleaningPanel/components/DerivedStep";
import { LagLeadStep } from "@/components/CleaningPanel/components/LagLeadStep";
import { InteractionStep } from "@/components/CleaningPanel/components/InteractionStep";
import { ColumnStateStep } from "@/components/CleaningPanel/components/ColumnStateStep";
import { ExploreVisualiseStep } from "@/components/CleaningPanel/components/ExploreVisualiseStep";
import { ExploreDescriptiveStep } from "@/components/CleaningPanel/components/ExploreDescriptiveStep";
import { ExploreFrequencyStep } from "@/components/CleaningPanel/components/ExploreFrequencyStep";
import "@/components/CleaningPanel/CleaningPanel.css";

export type {
  CleanTreeContentProps,
  MissingColumnEntry,
  MissingFillPreview,
  OutlierLiveCount,
  Step__ColumnsProps,
  Step__DuplicatesProps,
  Step__ExploreProps,
  Step__MissingProps,
  Step__OutlierProps,
  Step__RowGateProps,
} from "./types";

export const CleanTreeContent = memo(function CleanTreeContent({
  activeStep,
  raw,
  cleaned,
  cleaningConfig,
  configuredSteps,
  updateConfig,
  footer,
  numericColumns,
  step__rowGate,
  step__missing,
  step__outlier,
  step__duplicates,
  step__columns,
  step__explore,
}: CleanTreeContentProps) {
  return (
    <div className="clean-tree-content min-w-0 flex-1 p-4 max-lg:p-3.5">
      {activeStep === CLEAN_STEPS.rowGate && (
        <RowGateStep
          raw={raw}
          cleaningConfig={cleaningConfig}
          updateConfig={updateConfig}
          footer={footer}
          rowGateWarning={step__rowGate.warning}
          configured={configuredSteps.has(CLEAN_STEPS.rowGate)}
        />
      )}

      {activeStep === CLEAN_STEPS.sampling && (
        <SamplingStep
          raw={raw}
          cleaningConfig={cleaningConfig}
          updateConfig={updateConfig}
          footer={footer}
        />
      )}

      {activeStep === CLEAN_STEPS.missing && (
        <MissingStep
          raw={raw}
          cleaned={cleaned}
          cleaningConfig={cleaningConfig}
          updateConfig={updateConfig}
          footer={footer}
          configured={configuredSteps.has(CLEAN_STEPS.missing)}
          showResolvedMissing={step__missing.showResolved}
          onToggleShowResolved={step__missing.onToggleShowResolved}
          visibleMissingColumns={step__missing.columns}
          highAttentionMissing={step__missing.highAttentionCount}
          activeMissingColumn={step__missing.activeColumn}
          activeMissingColumnName={step__missing.activeColumnName}
          onFocusColumn={step__missing.onFocusColumn}
          missingFillPreview={step__missing.fillPreview}
        />
      )}

      {activeStep === CLEAN_STEPS.outliers && (
        <OutlierStep
          raw={raw}
          cleaned={cleaned}
          cleaningConfig={cleaningConfig}
          updateConfig={updateConfig}
          footer={footer}
          configured={configuredSteps.has(CLEAN_STEPS.outliers)}
          outlierColumns={step__outlier.candidates}
          skippedOutlierColumns={step__outlier.skipped}
          activeOutlierColumn={step__outlier.activeColumn}
          activeOutlierColumnName={step__outlier.activeColumnName}
          onFocusColumn={step__outlier.onFocusColumn}
          outlierLiveCount={step__outlier.liveCount}
        />
      )}

      {activeStep === CLEAN_STEPS.duplicates && (
        <DuplicatesStep
          raw={raw}
          cleaningConfig={cleaningConfig}
          updateConfig={updateConfig}
          footer={footer}
          duplicateLiveCount={step__duplicates.liveCount}
        />
      )}

      {activeStep === CLEAN_STEPS.typeConversion && (
        <TypeConversionStep
          raw={raw}
          cleaningConfig={cleaningConfig}
          updateConfig={updateConfig}
          footer={footer}
        />
      )}

      {activeStep === CLEAN_STEPS.textCleanup && (
        <TextCleanupStep
          raw={raw}
          cleaningConfig={cleaningConfig}
          updateConfig={updateConfig}
          footer={footer}
        />
      )}

      {activeStep === CLEAN_STEPS.columns && (
        <ColumnsStep
          raw={raw}
          cleaningConfig={cleaningConfig}
          updateConfig={updateConfig}
          footer={footer}
          activeColumn={step__columns.activeColumn}
          activeColumnFocusName={step__columns.activeColumnName}
          onFocusColumn={step__columns.onFocusColumn}
        />
      )}

      {activeStep === CLEAN_STEPS.encoding && (
        <EncodingStep raw={raw} footer={footer} />
      )}

      {activeStep === CLEAN_STEPS.sort && (
        <SortStep
          raw={raw}
          cleaningConfig={cleaningConfig}
          updateConfig={updateConfig}
          footer={footer}
        />
      )}

      {activeStep === CLEAN_STEPS.stringReplace && (
        <StringReplaceStep
          raw={raw}
          cleaningConfig={cleaningConfig}
          updateConfig={updateConfig}
          footer={footer}
        />
      )}

      {activeStep === CLEAN_STEPS.standardize && (
        <StandardizeStep
          raw={raw}
          cleaningConfig={cleaningConfig}
          updateConfig={updateConfig}
          footer={footer}
        />
      )}

      {activeStep === CLEAN_STEPS.mathTransform && (
        <MathTransformStep
          raw={raw}
          numericColumns={numericColumns}
          cleaningConfig={cleaningConfig}
          updateConfig={updateConfig}
          footer={footer}
        />
      )}

      {activeStep === CLEAN_STEPS.bin && (
        <BinStep
          raw={raw}
          numericColumns={numericColumns}
          cleaningConfig={cleaningConfig}
          updateConfig={updateConfig}
          footer={footer}
        />
      )}

      {activeStep === CLEAN_STEPS.dateExtract && (
        <DateExtractStep
          raw={raw}
          cleaningConfig={cleaningConfig}
          updateConfig={updateConfig}
          footer={footer}
        />
      )}

      {activeStep === CLEAN_STEPS.derived && (
        <DerivedStep
          raw={raw}
          cleaningConfig={cleaningConfig}
          updateConfig={updateConfig}
          footer={footer}
        />
      )}

      {activeStep === CLEAN_STEPS.lagLead && (
        <LagLeadStep
          raw={raw}
          cleaningConfig={cleaningConfig}
          updateConfig={updateConfig}
          footer={footer}
        />
      )}

      {activeStep === CLEAN_STEPS.interaction && (
        <InteractionStep
          raw={raw}
          numericColumns={numericColumns}
          cleaningConfig={cleaningConfig}
          updateConfig={updateConfig}
          footer={footer}
        />
      )}

      {activeStep === CLEAN_STEPS.columnState && (
        <ColumnStateStep raw={raw} cleaningConfig={cleaningConfig} />
      )}

      {activeStep === CLEAN_STEPS.exploreVisualise && (
        <ExploreVisualiseStep
          exploreData={step__explore.data}
          exploreComputed={step__explore.computed}
        />
      )}

      {activeStep === CLEAN_STEPS.exploreDescriptive && (
        <ExploreDescriptiveStep
          exploreData={step__explore.data}
          exploreComputed={step__explore.computed}
        />
      )}

      {activeStep === CLEAN_STEPS.exploreFrequency && (
        <ExploreFrequencyStep
          exploreData={step__explore.data}
          exploreComputed={step__explore.computed}
        />
      )}


    </div>
  );
});
