import { useShallow } from "zustand/react/shallow";
import { useDataStore } from "@/store/useDataStore";
import { RecommendButton } from "@/components/RecommendButton/RecommendButton";
import { ReportBuilder } from "./ReportBuilder";
import { ExportTypeSelector } from "./ExportTypeSelector";
import { ExportPreview } from "./ExportPreview";
import { DataPreviewModal, SaveExportModal } from "./ExportDialogs";
import { useExportGeneration } from "./hooks/useExportGeneration";
import "./ExportPanel.css";
import "./css/preview.css";
import "./css/modal.css";

export function ExportPanel({ onExport }: { onExport?: () => void }) {
  const {
    cleaned,
    results,
    exportPreferences,
    setExportPreferences,
    cart,
    removeFromCart,
  } = useDataStore(
    useShallow((s) => ({
      cleaned: s.cleaned,
      results: s.results,
      exportPreferences: s.exportPreferences,
      setExportPreferences: s.setExportPreferences,
      cart: s.cart,
      removeFromCart: s.removeFromCart,
    })),
  );

  const totalRowCount = useDataStore((s) => s.totalRowCount);
  const {
    selectedType,
    setSelectedType,
    outputFormat,
    setOutputFormat,
    activeBuilderSection,
    setActiveBuilderSection,
    datasetName,
    setDatasetName,
    previewApproved,
    setPreviewApproved,
    showDataModal,
    setShowDataModal,
    showSaveProfileModal,
    setShowSaveProfileModal,
    savingToProfile,
    dataPreviewTab,
    setDataPreviewTab,
    exportReminder,
    lastGeneratedExport,
    savingToWorkspace,
    exportSplitPct,
    abortRef,
    exportLayoutRef,
    startExportSplitDrag,
    handleExportSplitKeyDown,
    handleGenerate,
    handleSavePdfToProfile,
    handleSaveToWorkspace,
    canSavePendingPdf,
    pendingPdfWarning,
    pendingPdfSave,
    descriptiveSelection,
    frequencySelection,
    isPdfType,
    typeLabel,
    exportFileBaseName,
    normalizedDatasetName,
    tabularPreview,
    visualCandidates,
    numericCols,
    categoricalCols,
    totalTests,
    wsId,
    generating,
    genProgress,
    genPhase,
    genError,
    htmlDocDef,
    htmlPreviewLoading,
    htmlPreviewError,
  } = useExportGeneration(onExport);
  if (!cleaned || !results) return null;
  return (
    <>
      <div
        ref={exportLayoutRef}
        className="ep-layout"
        style={{ "--ep-left": `${exportSplitPct}%` } as React.CSSProperties}
      >
        <div className="export-panel">
          <div
            className="ep-header"
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <div style={{ flex: 1 }}>
              <h2>Export Centre</h2>
              <p className="ep-subtitle">
                {normalizedDatasetName} ·{" "}
                {(totalRowCount ?? cleaned.rows.length).toLocaleString()} rows ×{" "}
                {cleaned.columns.length} columns
              </p>
              <div className="ep-dataset-name-row">
                <label className="ep-pref-label" htmlFor="ep-dataset-name">
                  Dataset name
                </label>
                <input
                  id="ep-dataset-name"
                  className="ep-pref-input ep-dataset-name-input"
                  type="text"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  placeholder="Dataset name for exports"
                />
              </div>
            </div>
            <RecommendButton stage="export" />
          </div>

          {/*  Export Type Selector  */}
          <ExportTypeSelector
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            generating={generating}
          />
          {genError && <p className="error-msg ep-error-padded">{genError}</p>}
          {exportReminder && (
            <p className="ep-export-reminder">{exportReminder}</p>
          )}

          {/*  Report Customization (PDF types only)  */}
          {isPdfType && (
            <ReportBuilder
              activeBuilderSection={activeBuilderSection}
              setActiveBuilderSection={setActiveBuilderSection}
              outputFormat={outputFormat}
              setOutputFormat={setOutputFormat}
              canExportDOCX={true}
              canExportVisualPDF={true}
              exportPreferences={exportPreferences}
              setExportPreferences={setExportPreferences}
              cleaned={cleaned}
              numericCols={numericCols}
              categoricalCols={categoricalCols}
              descriptiveSelection={descriptiveSelection}
              frequencySelection={frequencySelection}
              visualCandidates={visualCandidates}
              cart={cart}
              removeFromCart={removeFromCart}
              totalTests={totalTests}
              results={results}
            />
          )}
        </div>

        <button
          type="button"
          className="ep-layout-divider"
          onMouseDown={startExportSplitDrag}
          onKeyDown={handleExportSplitKeyDown}
          aria-label="Resize export panel and preview"
          aria-valuemin={40}
          aria-valuemax={75}
          aria-valuenow={Math.round(exportSplitPct)}
        >
          <span className="ep-layout-divider-grip" aria-hidden="true" />
        </button>

        {/*  Preview / Confirmation  */}
        <ExportPreview
          typeLabel={typeLabel}
          selectedType={selectedType}
          isPdfType={isPdfType}
          htmlPreviewLoading={htmlPreviewLoading}
          htmlPreviewError={htmlPreviewError}
          htmlDocDef={htmlDocDef}
          cleaned={cleaned}
          tabularPreview={tabularPreview}
          dataPreviewTab={dataPreviewTab}
          setDataPreviewTab={setDataPreviewTab}
          setShowDataModal={setShowDataModal}
          generating={generating}
          genProgress={genProgress}
          genPhase={genPhase}
          abortRef={abortRef}
          previewApproved={previewApproved}
          setPreviewApproved={setPreviewApproved}
          canUsePdfTypes={true}
          canExportExcel={true}
          canExportCSV={true}
          handleGenerate={handleGenerate}
          lastGeneratedExport={lastGeneratedExport}
          wsId={wsId}
          handleSaveToWorkspace={handleSaveToWorkspace}
          savingToWorkspace={savingToWorkspace}
        />
      </div>

      {/*  Data Preview Modal  */}
      <DataPreviewModal
        showDataModal={showDataModal && !!cleaned}
        setShowDataModal={setShowDataModal}
        selectedType={selectedType}
        exportFileBaseName={exportFileBaseName}
        dataPreviewTab={dataPreviewTab}
        setDataPreviewTab={setDataPreviewTab}
        tabularPreview={tabularPreview}
        cleaned={cleaned}
      />

      <SaveExportModal
        showSaveProfileModal={showSaveProfileModal && !!pendingPdfSave}
        setShowSaveProfileModal={(open) => {
          if (!savingToProfile) setShowSaveProfileModal(open);
        }}
        savingToProfile={savingToProfile}
        pendingPdfSave={pendingPdfSave}
        pendingPdfWarning={pendingPdfWarning}
        canSavePendingPdf={canSavePendingPdf}
        handleSavePdfToProfile={handleSavePdfToProfile}
      />
    </>
  );
}
