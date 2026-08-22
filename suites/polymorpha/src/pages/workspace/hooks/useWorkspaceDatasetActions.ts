import { useCallback, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { getFirebaseDb, getFirebaseStorage } from "@/config/firebase";
import { useDataStore } from "@/store/useDataStore";
import { createFirestoreService } from "@/lib/FirestoreService";
import { callParseApi } from "@/lib/stats/api";
import { trackUpload } from "@/lib/tracking";
import { fetchApiAndConvertToCsv } from "@/lib/apiIngestion";
import { hashFile } from "@polymorpha/business-logic";
import type { Dataset } from "@/types";
import type {
  WorkspaceDatasetInfo,
  WorkspaceService,
} from "@/lib/WorkspaceService";
import type { Dispatch, SetStateAction } from "react";

export interface UseWorkspaceDatasetActionsArgs {
  service: WorkspaceService | null;
  workspaceId: string | undefined;
  user: { uid: string } | null;
  datasets: WorkspaceDatasetInfo[];
  setDatasets: Dispatch<SetStateAction<WorkspaceDatasetInfo[]>>;
  setError: (message: string | null) => void;
  setShowPipeline: (open: boolean) => void;
}

export interface WorkspaceConflictState {
  pendingUploadId: string;
  existingName: string;
  newName: string;
  uploadDoc: Record<string, unknown>;
  sourceWorkspaceName?: string;
}

export function useWorkspaceDatasetActions({
  service,
  workspaceId,
  user,
  datasets,
  setDatasets,
  setError,
  setShowPipeline,
}: UseWorkspaceDatasetActionsArgs) {
  const [showDatasetPicker, setShowDatasetPicker] = useState(false);
  const [uploadingNew, setUploadingNew] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [conflictState, setConflictState] =
    useState<WorkspaceConflictState | null>(null);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [pendingUploadDataset, setPendingUploadDataset] =
    useState<Dataset | null>(null);
  const [pendingApiOptions, setPendingApiOptions] = useState<{
    url: string;
    mode: "static" | "dynamic";
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add Dataset (with conflict detection)

  /** Core add logic — skips conflict check (used after conflict resolution) */
  const doAddDataset = useCallback(
    async (
      uploadId: string,
      displayName?: string,
      sourceWorkspaceName?: string,
    ) => {
      if (!service || !workspaceId || !user) return;
      const db = getFirebaseDb();
      if (!db) return;
      let dsFileName = displayName ?? "";
      const sourceName = sourceWorkspaceName ?? undefined;
      // Optimistic
      try {
        const snap = await getDoc(
          doc(db, "users", user.uid, "uploads", uploadId),
        );
        if (snap.exists()) {
          const d = snap.data();
          if (!dsFileName) dsFileName = d.fileName ?? "Unknown";
          setDatasets((prev) =>
            prev.some((p) => p.uploadId === uploadId)
              ? prev
              : [
                  ...prev,
                  {
                    uploadId,
                    fileName: dsFileName,
                    rowCount: d.rowCount ?? 0,
                    colCount: d.columnCount ?? 0,
                    uploadedAt: new Date(),
                    storageRef: d.storageRef ?? "",
                    hasStorage: !!d.storageRef,
                    sourceWorkspaceName: sourceName,
                  },
                ],
          );
        }
      } catch {
        /* non-fatal */
      }
      // W8: Close picker only after successful add, not before
      try {
        await service.addUploadToWorkspace(
          workspaceId,
          uploadId,
          dsFileName,
          sourceName,
        );
        setShowDatasetPicker(false);
      } catch {
        setDatasets((prev) => prev.filter((d) => d.uploadId !== uploadId));
        setShowDatasetPicker(false);
        setError("Could not add dataset.");
      }
    },
    [service, workspaceId, user, setDatasets, setError],
  );

  /** Entry point — checks for duplicate name before adding */
  const handleAddDataset = useCallback(
    async (uploadId: string, sourceWorkspaceName?: string) => {
      if (!user) return;
      const db = getFirebaseDb();
      if (!db) return;
      // Fetch the upload doc to get its fileName
      try {
        const snap = await getDoc(
          doc(db, "users", user.uid, "uploads", uploadId),
        );
        if (!snap.exists()) {
          doAddDataset(uploadId, undefined, sourceWorkspaceName);
          return;
        }
        const uploadData = snap.data();
        const fileName = (uploadData.fileName as string) ?? "Unknown";
        // Case-insensitive duplicate check
        const duplicate = datasets.find(
          (d) => d.fileName.toLowerCase() === fileName.toLowerCase(),
        );
        if (duplicate) {
          setConflictState({
            pendingUploadId: uploadId,
            existingName: duplicate.fileName,
            newName: fileName,
            uploadDoc: uploadData,
            sourceWorkspaceName,
          });
          return;
        }
      } catch {
        /* fall through to add */
      }
      doAddDataset(uploadId, undefined, sourceWorkspaceName);
    },
    [user, datasets, doAddDataset],
  );

  // Upload New File

  /** Core upload: save blob to storage, attach to workspace, update dataset list. */
  const completeUpload = useCallback(
    async (
      file: File,
      dataset: Dataset,
      displayName: string,
      apiOptions?: { url: string; mode: "static" | "dynamic" },
      totalRowCount?: number | null,
    ) => {
      if (!service || !workspaceId || !user) return;
      try {
        const fsService = createFirestoreService(user.uid);
        const contentHash = await hashFile(file).catch(() => undefined);
        const total = totalRowCount ?? dataset.rows.length;
        const id = await fsService.recordUpload({
          fileName: file.name,
          fileSize: file.size,
          rowCount: total,
          columnCount: dataset.columns.length,
          columns: dataset.columns.map((c) => c.name),
          blob: file,
          contentHash,
          sourceType: apiOptions ? "api" : "file",
          apiUrl: apiOptions?.url,
          updateMode: apiOptions?.mode,
        });
        if (id) {
          useDataStore.getState().setUploadId(id);
          await service.addUploadToWorkspace(workspaceId, id, displayName);
          setDatasets((prev) =>
            prev.some((d) => d.uploadId === id)
              ? prev
              : [
                  ...prev,
                  {
                    uploadId: id,
                    fileName: displayName,
                    rowCount: total,
                    colCount: dataset.columns.length,
                    uploadedAt: new Date(),
                    storageRef: "",
                    hasStorage: true,
                  },
                ],
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save upload.");
      }
    },
    [service, workspaceId, user, setDatasets, setError],
  );

  /** Parse a freshly browsed file, check for duplicate name, then upload and open pipeline. */
  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !service || !workspaceId || !user) return;
      setUploadingNew(true);
      setUploadProgress(`Uploading ${file.name}…`);
      try {
        // Upload to Storage first
        const tempPath = `users/${user.uid}/uploads/pending/${Date.now()}/${file.name}`;
        const storage = getFirebaseStorage();
        if (!storage) throw new Error("Storage not available");
        await uploadBytes(ref(storage, tempPath), file);

        // Parse via Python - fetch full file (preview is display-only 100-slice derived in setRaw)
        setUploadProgress(`Parsing ${file.name}…`);
        const parsed = await callParseApi(tempPath);
        const dataset: Dataset = {
          columns: parsed.columnTypes as Dataset["columns"],
          rows: parsed.rows as Dataset["rows"],
          fileName: parsed.fileName,
          uploadedAt: new Date(),
        };
        trackUpload(
          parsed.rowCount,
          dataset.columns.length,
          dataset.columns.map((c) => c.name),
        );
        await useDataStore.getState().setRaw(dataset, {
          totalRowCount: parsed.rowCount,
          storagePath: tempPath,
          preview: { ...dataset, rows: dataset.rows.slice(0, 100) },
        });
        // Open pipeline immediately — data is already in the store at preview step
        setUploadProgress("");
        setShowPipeline(true);
        // Check for duplicate name
        const duplicate = datasets.find(
          (d) => d.fileName.toLowerCase() === file.name.toLowerCase(),
        );
        if (duplicate) {
          setPendingUploadFile(file);
          setPendingUploadDataset(dataset);
          setConflictState({
            pendingUploadId: "new-upload",
            existingName: duplicate.fileName,
            newName: file.name,
            uploadDoc: {},
          });
          return;
        }
        await completeUpload(
          file,
          dataset,
          file.name,
          undefined,
          parsed.rowCount,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload file.");
      } finally {
        setUploadingNew(false);
        setUploadProgress("");
      }
    },
    [
      service,
      workspaceId,
      user,
      datasets,
      completeUpload,
      setError,
      setShowPipeline,
    ],
  );

  /** Connect a new API Dataset */
  const handleApiSelected = useCallback(
    async (apiUrl: string, updateMode: "static" | "dynamic") => {
      if (!service || !workspaceId || !user) return;
      setShowDatasetPicker(false);
      setUploadingNew(true);
      setUploadProgress(`Fetching API…`);
      try {
        const apiFile = await fetchApiAndConvertToCsv(apiUrl);
        const tempPath = `users/${user.uid}/uploads/pending/${Date.now()}/${apiFile.name}`;
        const storage = getFirebaseStorage();
        if (!storage) throw new Error("Storage not available");
        await uploadBytes(ref(storage, tempPath), apiFile);

        setUploadProgress(`Parsing API data…`);
        const parsed = await callParseApi(tempPath, undefined, apiUrl);
        const dataset: Dataset = {
          columns: parsed.columnTypes as Dataset["columns"],
          rows: parsed.rows as Dataset["rows"],
          fileName: parsed.fileName,
          uploadedAt: new Date(),
        };
        trackUpload(
          parsed.rowCount,
          dataset.columns.length,
          dataset.columns.map((c) => c.name),
        );
        await useDataStore.getState().setRaw(dataset, {
          totalRowCount: parsed.rowCount,
          storagePath: tempPath,
          preview: { ...dataset, rows: dataset.rows.slice(0, 100) },
        });
        setUploadProgress("");
        setShowPipeline(true);

        const duplicate = datasets.find(
          (d) => d.fileName.toLowerCase() === apiFile.name.toLowerCase(),
        );
        if (duplicate) {
          setPendingUploadFile(apiFile);
          setPendingUploadDataset(dataset);
          setPendingApiOptions({ url: apiUrl, mode: updateMode });
          setConflictState({
            pendingUploadId: "new-upload",
            existingName: duplicate.fileName,
            newName: apiFile.name,
            uploadDoc: {},
          });
          return;
        }
        await completeUpload(apiFile, dataset, apiFile.name, {
          url: apiUrl,
          mode: updateMode,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to connect API.");
      } finally {
        setUploadingNew(false);
        setUploadProgress("");
      }
    },
    [
      service,
      workspaceId,
      user,
      datasets,
      completeUpload,
      setError,
      setShowPipeline,
    ],
  );

  /** Conflict resolution: Rename */
  const handleConflictRename = useCallback(
    (newDisplayName: string) => {
      if (!conflictState) return;
      if (conflictState.pendingUploadId === "new-upload") {
        const file = pendingUploadFile;
        const ds = pendingUploadDataset;
        const apiOps = pendingApiOptions;
        setPendingUploadFile(null);
        setPendingUploadDataset(null);
        setPendingApiOptions(null);
        setConflictState(null);
        if (file && ds) {
          const total = useDataStore.getState().totalRowCount ?? ds.rows.length;
          completeUpload(file, ds, newDisplayName, apiOps ?? undefined, total);
        }
        return;
      }
      const sourceName = conflictState.sourceWorkspaceName;
      setConflictState(null);
      doAddDataset(conflictState.pendingUploadId, newDisplayName, sourceName);
    },
    [
      conflictState,
      doAddDataset,
      pendingUploadFile,
      pendingUploadDataset,
      pendingApiOptions,
      completeUpload,
    ],
  );

  /** Conflict resolution: Overwrite */
  const handleConflictOverwrite = useCallback(async () => {
    if (!conflictState || !service || !workspaceId) return;
    if (conflictState.pendingUploadId === "new-upload") {
      const file = pendingUploadFile;
      const ds = pendingUploadDataset;
      const apiOps = pendingApiOptions;
      const existingName = conflictState.existingName;
      setPendingUploadFile(null);
      setPendingUploadDataset(null);
      setPendingApiOptions(null);
      setConflictState(null);
      // Remove existing dataset before adding new one with same name
      const existing = datasets.find(
        (d) => d.fileName.toLowerCase() === existingName.toLowerCase(),
      );
      if (existing) {
        try {
          await service.removeUploadFromWorkspace(
            workspaceId,
            existing.uploadId,
            existing.fileName,
          );
          setDatasets((prev) =>
            prev.filter((d) => d.uploadId !== existing.uploadId),
          );
        } catch {
          setError("Could not remove existing dataset.");
          return;
        }
      }
      if (file && ds) {
        const total = useDataStore.getState().totalRowCount ?? ds.rows.length;
        completeUpload(file, ds, existingName, apiOps ?? undefined, total);
      }
      return;
    }
    // Find the existing dataset to remove
    const existing = datasets.find(
      (d) =>
        d.fileName.toLowerCase() === conflictState.existingName.toLowerCase(),
    );
    if (existing) {
      try {
        await service.removeUploadFromWorkspace(
          workspaceId,
          existing.uploadId,
          existing.fileName,
        );
        setDatasets((prev) =>
          prev.filter((d) => d.uploadId !== existing.uploadId),
        );
      } catch {
        setError("Could not remove existing dataset.");
        setConflictState(null);
        return;
      }
    }
    const pendingId = conflictState.pendingUploadId;
    const sourceName = conflictState.sourceWorkspaceName;
    setConflictState(null);
    doAddDataset(pendingId, undefined, sourceName);
  }, [
    conflictState,
    service,
    workspaceId,
    datasets,
    doAddDataset,
    pendingUploadFile,
    pendingUploadDataset,
    pendingApiOptions,
    completeUpload,
    setDatasets,
    setError,
  ]);

  /** Conflict resolution: Cancel */
  const handleConflictCancel = useCallback(() => {
    setPendingUploadFile(null);
    setPendingUploadDataset(null);
    setPendingApiOptions(null);
    setConflictState(null);
  }, []);

  return {
    showDatasetPicker,
    setShowDatasetPicker,
    uploadingNew,
    uploadProgress,
    conflictState,
    fileInputRef,
    handleAddDataset,
    handleApiSelected,
    handleFileSelected,
    handleConflictRename,
    handleConflictOverwrite,
    handleConflictCancel,
  };
}
