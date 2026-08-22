import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import {
  createWorkspaceService,
  type WorkspaceExportInfo,
  type WorkspaceSummary,
} from "@/lib/WorkspaceService";
import { ref, getDownloadURL, listAll } from "firebase/storage";
import { getFirebaseStorage } from "@/config/firebase";
import { decompressBlob } from "@polymorpha/business-logic";
import { readStorageValue, writeStorageValue } from "@/lib/storage";
import { useLoadWorkspaceDataset } from "@/hooks/useLoadWorkspaceDataset";
import { useWorkspaceAutosave } from "@/hooks/useWorkspaceAutosave";
import type { WorkspaceDatasetInfo } from "@/lib/WorkspaceService";

export interface UseWorkspaceDataArgs {
  workspaceId: string | undefined;
  user: { uid: string } | null;
  authInitialized: boolean;
  datasets: WorkspaceDatasetInfo[];
  setDatasets: Dispatch<SetStateAction<WorkspaceDatasetInfo[]>>;
  setError: (message: string | null) => void;
  setShowPipeline: (open: boolean) => void;
}

export function useWorkspaceData({
  workspaceId,
  user,
  authInitialized,
  datasets,
  setDatasets,
  setError,
  setShowPipeline,
}: UseWorkspaceDataArgs) {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [exports, setExports] = useState<WorkspaceExportInfo[]>([]);
  const [workspaceList, setWorkspaceList] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openingFileName, setOpeningFileName] = useState<string | null>(null);
  const [loadingDataset, setLoadingDataset] = useState(false);
  const [pdfFiles, setPdfFiles] = useState<{ name: string; url: string }[]>([]);
  const [listingPdfs, setListingPdfs] = useState(false);
  const [viewingPdf, setViewingPdf] = useState<string | null>(null);
  const [viewingPdfName, setViewingPdfName] = useState("");
  const pdfCacheRef = useRef<{
    workspaceId: string;
    files: { name: string; url: string }[];
    exportsLength: number;
  } | null>(null);

  const service = useMemo(
    () => (user ? createWorkspaceService(user.uid) : null),
    [user?.uid],
  );
  // Autosave step to workspace
  useWorkspaceAutosave(workspaceId, service);

  // Track the latest requested workspaceId to prevent stale async responses
  // from overwriting state when the user rapidly switches workspaces.
  const latestWorkspaceRef = useRef<string | null>(null);

  // Fetch

  const fetchWorkspace = useCallback(async () => {
    if (!service || !workspaceId || !user) return;
    // Mark this workspaceId as the latest request
    latestWorkspaceRef.current = workspaceId;
    setError(null);
    try {
      const ws = await service.getWorkspace(workspaceId);
      // Discard stale response — user already switched to a different workspace
      if (latestWorkspaceRef.current !== workspaceId) return;
      if (!ws) {
        setError("Workspace not found.");
        setLoading(false);
        return;
      }
      setWorkspace(ws);

      // Fetch datasets and exports via cached batched methods (single Firestore round-trip each after cache)
      const [dsResults, exResults, wsList] = await Promise.all([
        service.getDatasetsForWorkspace(workspaceId),
        service.getExportsForWorkspace(workspaceId),
        service.listWorkspaces(),
      ]);
      // Discard stale response again after the batch fetch
      if (latestWorkspaceRef.current !== workspaceId) return;
      setDatasets(dsResults);
      setExports(exResults);
      setWorkspaceList(wsList);
    } catch {
      if (latestWorkspaceRef.current !== workspaceId) return;
      setError("Could not load workspace.");
    } finally {
      if (latestWorkspaceRef.current === workspaceId) {
        setLoading(false);
      }
    }
  }, [service, workspaceId, user, setDatasets, setError]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  // Auto-refresh PDF list — uses cache to avoid re-scanning Storage on every render
  useEffect(() => {
    const cached = pdfCacheRef.current;
    if (
      cached &&
      cached.workspaceId === workspaceId &&
      cached.exportsLength === exports.length
    ) {
      setPdfFiles(cached.files);
      return;
    }
    handleListPdfs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exports]);

  // Auth redirect
  useEffect(() => {
    const loc = window.location;
    if (authInitialized && !user) {
      sessionStorage.setItem("polymorpha-redirect", loc.pathname + loc.search);
      navigate("/login", { replace: true });
    }
  }, [authInitialized, user, navigate]);

  // Open Dataset

  const loadDataset = useLoadWorkspaceDataset(workspaceId, service);

  const handleOpenDataset = useCallback(
    async (uploadId: string) => {
      if (!service || !workspaceId) return;
      setError(null);
      const ds = datasets.find((d) => d.uploadId === uploadId);
      setOpeningFileName(ds?.fileName ?? "dataset");
      setLoadingDataset(true);
      try {
        await loadDataset(uploadId);
        setShowPipeline(true);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to open dataset.",
        );
      } finally {
        setLoadingDataset(false);
        setOpeningFileName(null);
      }
    },
    [loadDataset, service, workspaceId, datasets, setError, setShowPipeline],
  );

  // List PDFs from Storage

  const handleListPdfs = useCallback(async () => {
    if (!user || !workspaceId) return;
    setListingPdfs(true);
    setPdfFiles([]);
    try {
      const storage = getFirebaseStorage();
      if (!storage) throw new Error("Storage not available");
      const exportsRef = ref(
        storage,
        `users/${user.uid}/workspaces/${workspaceId}/exports`,
      );

      // Session-level cache: the listAll + per-folder scan + getDownloadURL
      // round-trips are expensive; reuse them within 5 minutes per workspace.
      const cacheKey = `pdf-list:${user.uid}:${workspaceId}:${exports.length}`;
      const cached = readStorageValue(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as { name: string; url: string }[];
          setPdfFiles(parsed);
          pdfCacheRef.current = {
            workspaceId: workspaceId!,
            files: parsed,
            exportsLength: exports.length,
          };
          return;
        } catch {
          /* fall through to a fresh scan */
        }
      }

      const result = await listAll(exportsRef);
      const files: { name: string; url: string }[] = [];
      for (const prefix of result.prefixes) {
        const folderResult = await listAll(prefix);
        for (const item of folderResult.items) {
          const fileName = item.name;
          const url = await getDownloadURL(item);
          files.push({ name: fileName, url });
        }
      }
      files.sort((a, b) => a.name.localeCompare(b.name));
      pdfCacheRef.current = {
        workspaceId: workspaceId!,
        files,
        exportsLength: exports.length,
      };
      writeStorageValue(cacheKey, JSON.stringify(files));
      setPdfFiles(files);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list PDFs.");
    } finally {
      setListingPdfs(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, workspaceId, exports.length, setError]);

  // Open PDF Viewer

  const handleOpenPdf = useCallback(
    async (file: { name: string; url: string }) => {
      try {
        const response = await fetch(file.url);
        let blob = await response.blob();
        if (file.name.endsWith(".gz")) {
          blob = await decompressBlob(blob);
        }
        setViewingPdf(URL.createObjectURL(blob));
        setViewingPdfName(file.name.replace(/\.gz$/i, ""));
      } catch {
        setError("Failed to open PDF.");
      }
    },
    [setError],
  );

  // Rename

  const startRename = useCallback(() => {
    if (workspace) {
      setRenaming(true);
      setRenameValue(workspace.name);
    }
  }, [workspace]);
  const submitRename = useCallback(async () => {
    if (!service || !workspace || !renameValue.trim()) {
      setRenaming(false);
      return;
    }
    try {
      await service.renameWorkspace(workspace.workspaceId, renameValue.trim());
      setWorkspace({ ...workspace, name: renameValue.trim() });
      setRenaming(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not rename workspace.",
      );
    }
  }, [service, workspace, renameValue, setError]);

  const handleDelete = useCallback(async () => {
    if (!service || !workspace) return;
    if (
      !window.confirm(
        `Delete "${workspace.name}"? This can be recovered within 30 days.`,
      )
    )
      return;
    try {
      await service.deleteWorkspace(workspace.workspaceId);
      navigate("/workspaces", { replace: true });
    } catch {
      setError("Could not delete workspace.");
    }
  }, [service, workspace, navigate, setError]);

  const handleSelectWorkspace = useCallback(
    (id: string) => {
      navigate(`/workspaces/${id}`);
      setSidebarOpen(false);
    },
    [navigate],
  );

  const handleRenameFromSidebar = useCallback(
    async (ws: WorkspaceSummary) => {
      const newName = window.prompt("Rename workspace:", ws.name);
      if (!newName?.trim() || !service) return;
      try {
        await service.renameWorkspace(ws.workspaceId, newName.trim());
        if (ws.workspaceId === workspaceId)
          setWorkspace((prev) =>
            prev ? { ...prev, name: newName.trim() } : prev,
          );
        setWorkspaceList((prev) =>
          prev.map((w) =>
            w.workspaceId === ws.workspaceId
              ? { ...w, name: newName.trim() }
              : w,
          ),
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not rename workspace.",
        );
      }
    },
    [service, workspaceId, setError],
  );

  const handleDuplicateFromSidebar = useCallback(
    async (ws: WorkspaceSummary) => {
      if (!service) return;
      try {
        const newId = await service.duplicateWorkspace(ws.workspaceId);
        navigate(`/workspaces/${newId}`);
      } catch {
        setError("Could not duplicate workspace.");
      }
    },
    [service, navigate, setError],
  );

  const handleDeleteFromSidebar = useCallback(
    async (ws: WorkspaceSummary) => {
      if (!service) return;
      if (
        !window.confirm(
          `Delete "${ws.name}"? This can be recovered within 30 days.`,
        )
      )
        return;
      try {
        await service.deleteWorkspace(ws.workspaceId);
        if (ws.workspaceId === workspaceId)
          navigate("/workspaces", { replace: true });
        else
          setWorkspaceList((prev) =>
            prev.filter((w) => w.workspaceId !== ws.workspaceId),
          );
      } catch {
        setError("Could not delete workspace.");
      }
    },
    [service, workspaceId, navigate, setError],
  );

  return {
    service,
    workspace,
    setWorkspace,
    exports,
    workspaceList,
    loading,
    renaming,
    setRenaming,
    renameValue,
    setRenameValue,
    sidebarOpen,
    setSidebarOpen,
    openingFileName,
    loadingDataset,
    pdfFiles,
    listingPdfs,
    viewingPdf,
    setViewingPdf,
    viewingPdfName,
    fetchWorkspace,
    handleListPdfs,
    handleOpenPdf,
    startRename,
    submitRename,
    handleDelete,
    handleSelectWorkspace,
    handleRenameFromSidebar,
    handleDuplicateFromSidebar,
    handleDeleteFromSidebar,
    handleOpenDataset,
    loadDataset,
  };
}
