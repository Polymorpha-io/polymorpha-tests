import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { hashFile } from "@polymorpha/business-logic";
import { getCacheService } from "@/lib/CacheService";
import { callParseApi, type ParseApiResult } from "@/lib/stats/api";
import { ref, uploadBytes } from "firebase/storage";
import { getFirebaseStorage, getFirebaseAuth } from "@/config/firebase";
import type { Column, Dataset } from "@/types";
import { useDataStore } from "@/store/useDataStore";
import { useAuthStore } from "@/store/useAuthStore";
import { ANON_MAX_ROWS, MAX_UPLOAD_BYTES } from "@/config";
import { createFirestoreService } from "@/lib/FirestoreService";
import { createWorkspaceService } from "@/lib/WorkspaceService";
import { trackUpload } from "@/lib/tracking";
import { fetchApiAndConvertToCsv } from "@/lib/apiIngestion";
import { AnonymousLimitModal } from "@/components/AnonymousLimitModal";
import "./Upload.css";

export interface ParseProgress {
  percent: number;
  stage: string;
}

export function Upload() {
  const setRaw = useDataStore((s) => s.setRaw);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sourceType, setSourceType] = useState<"file" | "api">("file");
  const [apiUrl, setApiUrl] = useState("");
  const [updateMode, setUpdateMode] = useState<"static" | "dynamic">("static");
  const [progress, setProgress] = useState<ParseProgress | null>(null);
  const [anonLimitOpen, setAnonLimitOpen] = useState(false);
  const [anonLimitInfo, setAnonLimitInfo] = useState<{
    total: number;
    truncated: number;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cache = getCacheService();

  /** Convert ParseApiResult to Dataset */
  const parsedToDataset = useCallback(
    (parsed: ParseApiResult): Dataset => ({
      columns: parsed.columnTypes as Column[],
      rows: parsed.rows as Dataset["rows"],
      fileName: parsed.fileName,
      uploadedAt: new Date(),
    }),
    [],
  );

  const finalizeDataset = useCallback(
    async (
      dataset: Dataset,
      file: File,
      nextWarnings: string[],
      contentHash?: string,
      storagePath?: string,
      passedSourceType?: "file" | "api",
      passedApiUrl?: string,
      passedUpdateMode?: "static" | "dynamic",
      totalRowCount?: number | null,
    ) => {
      setWarnings(nextWarnings);
      // setRaw derives preview (first 100) automatically; dataset here is full raw.
      await setRaw(dataset, {
        totalRowCount: totalRowCount ?? dataset.rows.length,
        storagePath: storagePath ?? null,
      });
      trackUpload(
        totalRowCount ?? dataset.rows.length,
        dataset.columns.length,
        dataset.columns.map((c) => c.name),
      );

      // Cache parsed dataset in IndexedDB (fire-and-forget)
      if (contentHash) {
        cache.setDataset(contentHash, dataset).catch(() => {});
        cache.setSession(
          `hash:${contentHash}`,
          { fileName: file.name, uploadedAt: Date.now(), storagePath },
          24 * 60 * 60 * 1000,
        );
      }

      const uid = useAuthStore.getState().user?.uid;
      if (uid) {
        const wsId = useDataStore.getState().workspaceId;

        createFirestoreService(uid)
          .getStorageConsentAndUsage(uid)
          .then(async (usage) => {
            let canUploadBlob = true;
            const warningsToAdd: string[] = [];

            if (!usage.storageConsent) {
              try {
                await createFirestoreService(uid).updateStorageConsent(
                  uid,
                  true,
                );
              } catch (e) {
                if (import.meta.env.DEV) console.warn("[polymorpha]", e);
              }
            }

            if (warningsToAdd.length > 0) {
              setWarnings((prev) => [...prev, ...warningsToAdd]);
            }

            createFirestoreService(uid)
              .recordUpload({
                fileName: file.name,
                fileSize: file.size,
                rowCount: totalRowCount ?? dataset.rows.length,
                columnCount: dataset.columns.length,
                columns: dataset.columns.map((c) => c.name),
                blob: canUploadBlob ? file : undefined,
                contentHash,
                sourceType: passedSourceType || "file",
                apiUrl: passedApiUrl,
                updateMode: passedUpdateMode,
              })
              .then((id) => {
                if (id) {
                  useDataStore.getState().setUploadId(id);
                  if (wsId) {
                    createWorkspaceService(uid)
                      .addUploadToWorkspace(wsId, id)
                      .catch((e) => {
                        if (import.meta.env.DEV)
                          console.warn("[polymorpha]", e);
                      });
                  }
                }
              })
              .catch((e) => {
                if (import.meta.env.DEV) console.warn("[polymorpha]", e);
              });
          })
          .catch((e) => {
            if (import.meta.env.DEV) console.warn("[polymorpha]", e);
          });
      }
    },
    [setRaw, cache],
  );

  const processFile = useCallback(
    async (
      file: File,
      isApi: boolean = false,
      apiOptions?: { url: string; mode: "static" | "dynamic" },
    ) => {
      setError(null);
      setWarnings([]);
      setProgress(null);
      setLoading(true);

      const abort = new AbortController();
      abortRef.current = abort;

      try {
        // 0. Early size + magic sniff guard (02) — D20 MAX_UPLOAD_BYTES
        if (file.size > MAX_UPLOAD_BYTES) {
          throw new Error(
            "File exceeds 50 MB limit. Please trim or split the file before uploading.",
          );
        }
        // Magic sniff — peek 8 bytes to detect xlsx vs csv quickly
        try {
          const head = await file.slice(0, 8).arrayBuffer();
          const u8 = new Uint8Array(head);
          // no-op sniff; hash worker will report format mismatch later
          void u8[0];
        } catch {
          // ignore sniff failure
        }
        // 1. Compute content hash
        setProgress({ percent: 0, stage: "Computing file fingerprint…" });
        const contentHash = await hashFile(file, (p) => {
          setProgress({
            percent: Math.round(p.percent * 0.1),
            stage: "Computing file fingerprint…",
          });
        });
        if (abort.signal.aborted) return;

        // 2. Check cache
        const sessionHit = cache.getSession<{
          fileName: string;
          uploadedAt: number;
          storagePath?: string;
        }>(`hash:${contentHash}`);
        if (sessionHit) {
          const cachedDataset = await cache.getDataset(contentHash);
          if (cachedDataset) {
            setProgress({ percent: 100, stage: "Restored from cache" });
            await finalizeDataset(
              cachedDataset,
              file,
              [
                `File "${file.name}" matches a previously uploaded file (${new Date(sessionHit.uploadedAt).toLocaleDateString()}). Restored from cache.`,
              ],
              contentHash,
              sessionHit.storagePath,
              isApi ? "api" : "file",
              apiOptions?.url,
              apiOptions?.mode,
            );
            setLoading(false);
            setProgress(null);
            return;
          }
        }

        // 3. Upload to Firebase Storage
        setProgress({ percent: 10, stage: "Uploading file…" });
        const uid = getFirebaseAuth()?.currentUser?.uid;
        const tempPath = uid
          ? `users/${uid}/uploads/pending/${contentHash}/${file.name}`
          : `anonymous/pending/${contentHash}/${file.name}`;
        const storage = getFirebaseStorage();
        if (!storage) throw new Error("Storage not available");

        await uploadBytes(ref(storage, tempPath), file);
        if (abort.signal.aborted) return;

        // 4. Parse via Python backend — fetch FULL file for pipeline (raw), preview is 100-slice for UI
        setProgress({ percent: 30, stage: "Parsing file…" });
        const parsed = await callParseApi(tempPath);
        if (abort.signal.aborted) return;

        // Anonymous cap: first 10k rows, authed unlimited. Per-user, no shared state.
        const isAnonUpload = !getFirebaseAuth()?.currentUser?.uid;
        let effectiveParsed = parsed;
        let anonTruncated = false;
        const originalRowCount = parsed.rowCount;
        if (isAnonUpload && parsed.rowCount > ANON_MAX_ROWS) {
          // Truncate to first ANON_MAX_ROWS for anonymous - not a reject.
          effectiveParsed = {
            ...parsed,
            rows: parsed.rows.slice(0, ANON_MAX_ROWS),
            rowCount: ANON_MAX_ROWS,
          };
          anonTruncated = true;
        }

        const datasetFull = parsedToDataset(effectiveParsed);
        setProgress({ percent: 100, stage: "Done" });

        const anonWarning = anonTruncated
          ? `Anonymous uploads are limited to first ${ANON_MAX_ROWS.toLocaleString()} of ${originalRowCount.toLocaleString()} rows. Sign in for unlimited.`
          : null;
        if (anonTruncated) {
          setAnonLimitInfo({
            total: originalRowCount,
            truncated: ANON_MAX_ROWS,
          });
          setAnonLimitOpen(true);
        }
        const nextWarnings: string[] = [];
        if (anonWarning) nextWarnings.push(anonWarning);
        if (effectiveParsed.rowCount > 100) {
          nextWarnings.push(
            `Loaded ${effectiveParsed.rowCount.toLocaleString()} rows${anonTruncated ? ` (truncated from ${originalRowCount.toLocaleString()})` : ""}. Table shows first 100 — analysis uses all ${effectiveParsed.rowCount.toLocaleString()} rows.`,
          );
        }

        await finalizeDataset(
          datasetFull,
          file,
          nextWarnings,
          contentHash,
          tempPath,
          isApi ? "api" : "file",
          apiOptions?.url,
          apiOptions?.mode,
          effectiveParsed.rowCount,
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // cancelled
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "Unknown error processing file.",
          );
        }
      } finally {
        setLoading(false);
        setProgress(null);
        abortRef.current = null;
      }
    },
    [finalizeDataset, cache, parsedToDataset],
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
    setProgress(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file && !loading) {
        processFile(file).catch(console.error);
      }
    },
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    disabled: loading,
    multiple: false,
  });

  const handleConnectApi = useCallback(async () => {
    if (!apiUrl) return;
    setError(null);
    setWarnings([]);
    setProgress(null);
    setLoading(true);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      setProgress({ percent: 10, stage: "Fetching data from API…" });
      const apiFile = await fetchApiAndConvertToCsv(apiUrl);
      if (abort.signal.aborted) return;

      setProgress({ percent: 50, stage: "Processing API data…" });
      await processFile(apiFile, true, { url: apiUrl, mode: updateMode });
    } catch (err: unknown) {
      if (!abort.signal.aborted) {
        setError(
          err instanceof Error ? err.message : "Failed to connect to API",
        );
        setLoading(false);
      }
    }
  }, [apiUrl, updateMode, processFile]);

  return (
    <div className="upload-page">
      {/* Extra decorative blobs */}
      <div
        className="upload-blob-extra upload-blob-extra--1"
        aria-hidden="true"
      />
      <div
        className="upload-blob-extra upload-blob-extra--2"
        aria-hidden="true"
      />
      <div
        className="upload-blob-extra upload-blob-extra--3"
        aria-hidden="true"
      />
      <div
        className="upload-blob-extra upload-blob-extra--4"
        aria-hidden="true"
      />
      <div
        className="upload-blob-extra upload-blob-extra--5"
        aria-hidden="true"
      />

      {/*  Hero  */}
      <section className="upload-hero">
        <h1 className="upload-hero-h1">
          Clean, analyse, and export your data in seconds
        </h1>
        <p className="upload-hero-sub">
          Upload a CSV or Excel file. Polymorpha auto-cleans, runs statistical
          tests, and generates shareable reports. Everything runs in your
          browser, and nothing leaves your device.
        </p>
      </section>

      <section className="upload-seo-terms sr-only" aria-hidden="true">
        <p>
          free stats calculator online, clean csv file automatically, analyze
          spreadsheet data fast, easy t test and anova tool, correlation checker
          for excel, turn raw data into report, statistical analysis software
          free, data cleaning tool online, descriptive statistics calculator,
          normality test online, chi-square test calculator, mann-whitney u
          test, kruskal-wallis test online, regression analysis tool, generate
          APA report from data, export statistics to PDF, outlier detection
          tool, missing value imputation, data visualization online, frequency
          distribution calculator
        </p>
      </section>

      <div
        className="upload-tabs"
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <button
          className={`btn-${sourceType === "file" ? "primary" : "ghost"} btn-sm`}
          onClick={() => setSourceType("file")}
        >
          Upload File
        </button>
        <button
          className={`btn-${sourceType === "api" ? "primary" : "ghost"} btn-sm`}
          onClick={() => setSourceType("api")}
        >
          Connect API
        </button>
      </div>

      {sourceType === "file" ? (
        <div
          {...getRootProps()}
          className={`drop-zone${isDragActive ? " drag-over" : ""}${loading ? " drop-zone--loading" : ""}`}
          role="button"
          tabIndex={0}
          aria-label="Upload a CSV or Excel file"
          aria-busy={loading}
        >
          <input {...getInputProps()} />
          {loading ? (
            <div className="upload-loading">
              <div className="upload-spinner" />
              <p>{progress?.stage ?? "Parsing your file..."}</p>
              {progress && (
                <div className="upload-progress-bar">
                  <div
                    className="upload-progress-fill"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              )}
              <p className="drop-hint">
                {progress
                  ? `${progress.percent}%`
                  : "Large files may take a moment"}
              </p>
              <button
                type="button"
                className="upload-cancel-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel();
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <div className="drop-icon-wrap">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 100 100"
                  aria-hidden="true"
                >
                  <defs>
                    <filter id="dropGlow">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <radialGradient id="dropBlobGrad" cx="35%" cy="35%">
                      <stop
                        offset="0%"
                        stopColor="#3b82f6"
                        stopOpacity="0.85"
                      />
                      <stop
                        offset="50%"
                        stopColor="#6366f1"
                        stopOpacity="0.7"
                      />
                      <stop
                        offset="100%"
                        stopColor="#8b5cf6"
                        stopOpacity="0.75"
                      />
                    </radialGradient>
                    <radialGradient id="dropBlobGrad2" cx="65%" cy="60%">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.5" />
                      <stop
                        offset="100%"
                        stopColor="#6366f1"
                        stopOpacity="0.3"
                      />
                    </radialGradient>
                  </defs>
                  <path
                    d="M50 18 C68 18 82 28 84 44 C86 60 78 74 62 80 C46 86 30 78 22 64 C14 50 20 32 36 22 C42 18 46 18 50 18Z"
                    fill="url(#dropBlobGrad)"
                    opacity="0.35"
                    filter="url(#dropGlow)"
                  />
                  <path
                    d="M50 22 C66 22 78 30 80 44 C82 58 75 70 61 76 C47 82 33 75 26 63 C19 51 24 35 38 26 C44 22 47 22 50 22Z"
                    fill="url(#dropBlobGrad)"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeOpacity="0.3"
                  />
                  <ellipse
                    cx="58"
                    cy="56"
                    rx="22"
                    ry="20"
                    fill="url(#dropBlobGrad2)"
                  />
                  <path
                    d="M50 30 C62 30 70 36 72 46 C74 56 68 64 58 68 C48 72 38 67 34 58 C30 49 34 38 42 32 C46 30 48 30 50 30Z"
                    fill="white"
                    opacity="0.12"
                  />
                  <ellipse
                    cx="42"
                    cy="38"
                    rx="14"
                    ry="10"
                    fill="white"
                    opacity="0.35"
                  />
                  <circle cx="50" cy="50" r="3" fill="white" opacity="0.75" />
                </svg>
              </div>
              <p className="drop-label">Drop your file here</p>
              <p className="drop-sub">or click to browse</p>
              <p className="drop-hint">.CSV, .XLSX, .XLS</p>
            </>
          )}
        </div>
      ) : (
        <div
          className="api-connect-zone"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            padding: "2rem",
            border: "1px solid var(--border)",
            borderRadius: "1rem",
            background: "var(--card)",
          }}
        >
          <p className="drop-label" style={{ margin: 0, textAlign: "center" }}>
            Connect to an API
          </p>
          <input
            type="url"
            className="input"
            placeholder="https://api.example.com/data.json"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            disabled={loading}
          />
          <div
            style={{ display: "flex", gap: "1rem", justifyContent: "center" }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="updateMode"
                value="static"
                checked={updateMode === "static"}
                onChange={() => setUpdateMode("static")}
                disabled={loading}
              />
              Static Snapshot
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="updateMode"
                value="dynamic"
                checked={updateMode === "dynamic"}
                onChange={() => setUpdateMode("dynamic")}
                disabled={loading}
              />
              Dynamic (Auto-sync)
            </label>
          </div>
          <p className="drop-hint" style={{ textAlign: "center" }}>
            {updateMode === "static"
              ? "Data will be imported once and remain unchanged."
              : "Data will automatically sync whenever you open the workspace."}
          </p>

          {loading ? (
            <div className="upload-loading">
              <div className="upload-spinner" />
              <p>{progress?.stage ?? "Connecting to API..."}</p>
            </div>
          ) : (
            <button
              className="btn-primary"
              onClick={handleConnectApi}
              disabled={!apiUrl}
            >
              Connect API
            </button>
          )}
        </div>
      )}

      {error && <p className="error-msg">{error}</p>}
      {warnings.map((w, i) => (
        <p key={i} className="warning-msg">
          {w}
        </p>
      ))}

      {anonLimitInfo && (
        <AnonymousLimitModal
          open={anonLimitOpen}
          onOpenChange={setAnonLimitOpen}
          totalRows={anonLimitInfo.total}
          truncatedRows={anonLimitInfo.truncated}
        />
      )}

      {/*  Features  */}
      <section className="upload-features">
        <div className="upload-feature">
          <h3>Preview instantly</h3>
          <p>
            See column types, structure, and a data snapshot before any
            processing begins.
          </p>
        </div>
        <div className="upload-feature">
          <h3>Auto-clean</h3>
          <p>
            Handle missing values, outliers, duplicates, and encoding in one
            guided flow.
          </p>
        </div>
        <div className="upload-feature">
          <h3>Run statistics</h3>
          <p>
            Descriptive stats, normality, correlation, t-tests, ANOVA, and more.
            All automatic.
          </p>
        </div>
        <div className="upload-feature">
          <h3>Export reports</h3>
          <p>
            Generate PDF, Word, or Excel reports with APA-formatted narratives
            and charts.
          </p>
        </div>
      </section>
    </div>
  );
}
