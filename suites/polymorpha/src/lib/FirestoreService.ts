/**
 * FirestoreService — OOP wrapper for all user data persistence.
 *
 * Uses .withConverter<T>() on all document references for typed Firestore access.
 * Handles: user doc creation, quota checks, upload/export recording,
 * analysis stats, and Storage uploads.
 */

import {
  collection,
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentReference,
  type WithFieldValue,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import {
  getFirebaseAuth,
  getFirebaseDb,
  getFirebaseStorage,
} from "@/config/firebase";
import { firestoreConverter } from "@/types/firestore";
import { compressBlobAsync } from "@polymorpha/business-logic";
import { getCacheService } from "./CacheService";
import {
  MAX_QUOTA_BYTES,
  QUOTAS_CACHE_TTL_MS as CONFIG_QUOTAS_TTL,
  RESUMABLE_THRESHOLD_BYTES,
} from "@/config";

// Firestore document types (with id)

export interface UserPreferences {
  theme: string;
  defaultExportMode: string;
  dateFormat?: string;
  numberLocale?: string;
  decimalPlaces?: string;
  significanceLevel?: string;
  statsLevel?: string;
  autoSaveExports?: boolean;
  showFormulas?: boolean;
  compactTables?: boolean;
}

export interface UserDoc {
  id?: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  plan: string;
  storageBucket: string;
  provider: string;
  createdAt: unknown;
  updatedAt: unknown;
  lastOnline: unknown;
  lastExportAt: unknown;
  totalExports: number;
  totalUploads: number;
  totalStorageBytes: number;
  maxSavedBytes: number;
  storageConsent: boolean;
  storageConsentAt: unknown;
  maxSavedFiles: number;
  maxSavedUploads: number;
  maxSavedExports: number;
  region: string | null;
  preferences: UserPreferences;
  stats: {
    datasetsAnalysed: number;
    totalRowsProcessed: number;
    totalColumnsProcessed: number;
    testsRun: number;
    exportsCompleted?: number;
    hasCompletedExport?: boolean;
  };
}

export interface UploadDoc {
  id?: string;
  fileName: string;
  fileSize: number;
  rowCount: number;
  columnCount: number;
  columns: string[];
  uploadedAt: unknown;
  storageRef: string;
  compressed?: boolean;
  originalSize?: number;
  contentHash?: string;
  sourceType?: "file" | "api";
  apiUrl?: string;
  updateMode?: "static" | "dynamic";
}

export interface ExportDoc {
  id?: string;
  uploadId: string | null;
  fileName: string;
  type: string;
  createdAt: unknown;
  fileSize: number;
  storageRef: string;
  downloadUrl: string;
  metadata: Record<string, unknown>;
  compressed?: boolean;
  originalSize?: number;
}

// Quotas type (derived from read, not stored as-is)

export interface UserQuotas {
  totalUploads: number;
  totalExports: number;
  totalStorageBytes: number;
  maxSavedBytes: number;
  maxSavedFiles: number;
  maxSavedUploads: number;
  maxSavedExports: number;
}

export interface UploadMeta {
  fileName: string;
  fileSize: number;
  rowCount: number;
  columnCount: number;
  columns: string[];
  blob?: Blob;
  contentHash?: string;
  sourceType?: "file" | "api";
  apiUrl?: string;
  updateMode?: "static" | "dynamic";
}

export interface ExportMeta {
  uploadId?: string | null;
  fileName: string;
  type: "premium-pdf" | "statistical-pdf" | "excel" | "csv" | "docx";
  blob?: Blob;
  workspaceId?: string | null;
  metadata: {
    rowCount: number;
    columnCount: number;
    includedColumns: string[] | null;
    testsRun: number;
    // PDF-specific metadata
    pdfFont?: string;
    sectionsIncluded?: string[];
    includeVisuals?: boolean;
    authorName?: string;
    location?: string;
    generatedAt?: string;
  };
}

// Converters

const userConverter = firestoreConverter<UserDoc>();
const uploadConverter = firestoreConverter<UploadDoc>();
const exportConverter = firestoreConverter<ExportDoc>();

/** Quota via CacheService (Plan5): unified, cross-tab, LRU. Fallback Map removed. */
function quotaCacheGet(uid: string): UserQuotas | null {
  try {
    return getCacheService().get<UserQuotas>(uid, "quota") ?? null;
  } catch {
    return null;
  }
}
function quotaCacheSet(uid: string, data: UserQuotas, ttlMs: number): void {
  try {
    getCacheService().set(uid, "quota", data, ttlMs);
  } catch {
    void 0;
  }
}
function quotaCacheDelete(uid: string): void {
  try {
    getCacheService().invalidate(uid, "quota");
  } catch {
    void 0;
  }
}

// Service

export class FirestoreService {
  private uid: string;

  constructor(uid: string) {
    this.uid = uid;
  }

  // Typed document references

  private userRef(): DocumentReference<UserDoc> {
    return doc(getFirebaseDb()!, "users", this.uid).withConverter(
      userConverter,
    );
  }

  private uploadDocRef(id: string): DocumentReference<UploadDoc> {
    return doc(
      getFirebaseDb()!,
      "users",
      this.uid,
      "uploads",
      id,
    ).withConverter(uploadConverter);
  }

  private exportDocRef(
    id: string,
    workspaceId?: string | null,
  ): DocumentReference<ExportDoc> {
    const db = getFirebaseDb()!;
    return (
      workspaceId
        ? doc(db, "users", this.uid, "workspaces", workspaceId, "exports", id)
        : doc(db, "users", this.uid, "exports", id)
    ).withConverter(exportConverter) as DocumentReference<ExportDoc>;
  }

  private get db() {
    return getFirebaseDb();
  }
  private get storage() {
    return getFirebaseStorage();
  }
  private get authUid() {
    return getFirebaseAuth()?.currentUser?.uid ?? null;
  }

  // User Document

  async ensureUserDoc(data: {
    email: string;
    displayName: string | null;
    photoURL: string | null;
    provider: "email" | "google";
    storageBucket?: string;
    storageConsent?: boolean;
    region?: string;
  }): Promise<void> {
    if (!this.db) return;

    const snap = await getDoc(this.userRef()).catch(() => null);
    if (snap?.exists()) return;

    const docData: WithFieldValue<UserDoc> = {
      email: data.email,
      displayName: data.displayName,
      photoURL: data.photoURL,
      plan: "free",
      storageBucket:
        data.storageBucket || "gs://polymorpha-io.firebasestorage.app",
      provider: data.provider,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastOnline: serverTimestamp(),
      lastExportAt: null,
      totalExports: 0,
      totalUploads: 0,
      totalStorageBytes: 0,
      maxSavedBytes: MAX_QUOTA_BYTES,
      storageConsent: data.storageConsent ?? false,
      storageConsentAt: data.storageConsent ? serverTimestamp() : null,
      maxSavedFiles: 50,
      maxSavedUploads: 25,
      maxSavedExports: 25,
      region: data.region ?? null,
      preferences: { theme: "system", defaultExportMode: "premium" },
      stats: {
        datasetsAnalysed: 0,
        totalRowsProcessed: 0,
        totalColumnsProcessed: 0,
        testsRun: 0,
      },
    };
    await setDoc(this.userRef(), docData);
  }

  async touchOnline(): Promise<void> {
    if (!this.db) return;
    await updateDoc(this.userRef(), {
      lastOnline: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  }

  // Quotas

  /** TTL for the quotas read-cache (user doc read is per upload/export) — D20 config. */
  private static readonly QUOTAS_CACHE_TTL_MS = CONFIG_QUOTAS_TTL;

  async getQuotas(force = false): Promise<UserQuotas | null> {
    if (!this.db) return null;
    const cached = force ? null : quotaCacheGet(this.uid);
    if (cached) return cached;
    const snap = await getDoc(this.userRef()).catch(() => null);
    if (!snap?.exists()) return null;
    const d = snap.data();
    const quotas: UserQuotas = {
      totalUploads: d.totalUploads ?? 0,
      totalExports: d.totalExports ?? 0,
      totalStorageBytes: d.totalStorageBytes ?? 0,
      maxSavedBytes: d.maxSavedBytes ?? MAX_QUOTA_BYTES,
      maxSavedFiles: d.maxSavedFiles ?? 50,
      maxSavedUploads: d.maxSavedUploads ?? 25,
      maxSavedExports: d.maxSavedExports ?? 25,
    };
    quotaCacheSet(this.uid, quotas, FirestoreService.QUOTAS_CACHE_TTL_MS);
    return quotas;
  }

  /** Drop the cached quotas (call after the user doc's counters change). */
  private invalidateQuotas(): void {
    quotaCacheDelete(this.uid);
  }

  async checkStorageCap(incomingBytes: number): Promise<void> {
    const quotas = await this.getQuotas();
    if (!quotas) return;
    if (quotas.totalStorageBytes + incomingBytes > quotas.maxSavedBytes) {
      throw new Error(
        `Storage cap exceeded. Used ${(quotas.totalStorageBytes / 1048576).toFixed(2)} MB of ${(quotas.maxSavedBytes / 1048576).toFixed(1)} MB.`,
      );
    }
  }

  // Stats & Analytics

  async recordAnalysis(
    rowCount: number,
    columnCount: number,
    testsRun: number,
  ): Promise<void> {
    if (!this.db) return;
    await updateDoc(this.userRef(), {
      "stats.datasetsAnalysed": increment(1),
      "stats.totalRowsProcessed": increment(rowCount),
      "stats.totalColumnsProcessed": increment(columnCount),
      "stats.testsRun": increment(testsRun),
      updatedAt: serverTimestamp(),
    }).catch(() => {});
    this.invalidateQuotas();
  }

  async recordExportCompletion(): Promise<void> {
    if (!this.db) return;
    await updateDoc(this.userRef(), {
      "stats.exportsCompleted": increment(1),
      "stats.hasCompletedExport": true,
      lastExportAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch(() => {});
    this.invalidateQuotas();
  }

  // Uploads

  /** Threshold above which resumable upload is used (10 MB) — D20 config. */
  private static readonly RESUMABLE_THRESHOLD = RESUMABLE_THRESHOLD_BYTES;

  async recordUpload(meta: UploadMeta): Promise<string | null> {
    if (!this.db) return null;

    let incomingBytes = 0;
    let compressedForUpload: Blob | null = null;
    if (meta.blob && this._canWriteStorage()) {
      try {
        compressedForUpload = await compressBlobAsync(meta.blob);
        incomingBytes = compressedForUpload.size;
      } catch {
        incomingBytes = meta.fileSize;
      }
    } else if (meta.blob) {
      incomingBytes = meta.fileSize;
    }

    try {
      const db = this.db;
      const newUploadRef = doc(
        collection(getFirebaseDb()!, "users", this.uid, "uploads"),
      ).withConverter(uploadConverter);

      const docData: WithFieldValue<UploadDoc> = {
        fileName: meta.fileName,
        fileSize: meta.fileSize,
        rowCount: meta.rowCount,
        columnCount: meta.columnCount,
        columns: meta.columns,
        uploadedAt: serverTimestamp(),
        storageRef: "",
        sourceType: meta.sourceType || "file",
      };
      if (meta.contentHash) {
        (docData as Record<string, unknown>).contentHash = meta.contentHash;
      }
      if (meta.apiUrl) {
        (docData as Record<string, unknown>).apiUrl = meta.apiUrl;
      }
      if (meta.updateMode) {
        (docData as Record<string, unknown>).updateMode = meta.updateMode;
      }

      await runTransaction(db, async (tx) => {
        const userSnap = await tx.get(this.userRef());
        if (!userSnap.exists()) {
          throw new Error("User document not found");
        }
        const data = userSnap.data();
        const totalStorageBytes = (data.totalStorageBytes as number) ?? 0;
        const maxSavedBytes = (data.maxSavedBytes as number) ?? MAX_QUOTA_BYTES;
        if (
          incomingBytes > 0 &&
          totalStorageBytes + incomingBytes > maxSavedBytes
        ) {
          throw new Error(
            `Storage cap exceeded. Used ${(totalStorageBytes / 1048576).toFixed(2)} MB of ${(maxSavedBytes / 1048576).toFixed(1)} MB.`,
          );
        }
        tx.set(newUploadRef, docData);
        if (incomingBytes > 0) {
          tx.update(this.userRef(), {
            totalUploads: increment(1),
            totalStorageBytes: increment(incomingBytes),
            updatedAt: serverTimestamp(),
          });
        } else {
          tx.update(this.userRef(), {
            totalUploads: increment(1),
            updatedAt: serverTimestamp(),
          });
        }
      });
      this.invalidateQuotas();

      let storedBytes = incomingBytes;
      let storagePath = "";

      if (this.storage && compressedForUpload && this._canWriteStorage()) {
        const path = `users/${this.uid}/datasets/${newUploadRef.id}/${meta.fileName}.gz`;
        storagePath = path;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            if (
              compressedForUpload.size > FirestoreService.RESUMABLE_THRESHOLD
            ) {
              await this._uploadResumable(path, compressedForUpload);
            } else {
              await uploadBytes(ref(this.storage, path), compressedForUpload);
            }
            await updateDoc(this.uploadDocRef(newUploadRef.id), {
              storageRef: path,
              compressed: true,
              originalSize: meta.fileSize,
            });
            break;
          } catch (err: unknown) {
            const code =
              err instanceof Error && "code" in err
                ? (err as { code: string }).code
                : "";
            const authFailure =
              code === "storage/unauthorized" ||
              code === "storage/unauthenticated";
            if (authFailure && attempt === 0) {
              await new Promise((resolve) => setTimeout(resolve, 1500));
              continue;
            }
            if (authFailure) {
              storedBytes = incomingBytes;
              storagePath = "";
              break;
            }
            try {
              await updateDoc(this.userRef(), {
                totalStorageBytes: increment(-incomingBytes),
                totalUploads: increment(-1),
                updatedAt: serverTimestamp(),
              });
              this.invalidateQuotas();
            } catch {
              void 0;
            }
            throw err;
          }
        }
        if (storedBytes !== incomingBytes && storagePath) {
          const delta = storedBytes - incomingBytes;
          if (delta !== 0) {
            try {
              await updateDoc(this.userRef(), {
                totalStorageBytes: increment(delta),
                updatedAt: serverTimestamp(),
              });
              this.invalidateQuotas();
            } catch {
              void 0;
            }
          }
        }
      } else if (incomingBytes === 0) {
        storedBytes = 0;
      }

      getCacheService().invalidateScope(this.uid, "workspaces");

      return newUploadRef.id;
    } catch {
      return null;
    }
  }

  // Exports

  async saveExport(
    meta: ExportMeta,
  ): Promise<{ exportId: string; downloadUrl: string } | null> {
    if (!this.db) return null;

    const incomingBytes = meta.blob?.size ?? 0;
    let canUploadBlob = !!meta.blob && this._canWriteStorage();

    try {
      const db = this.db;
      const exportsRef = meta.workspaceId
        ? collection(
            getFirebaseDb()!,
            "users",
            this.uid,
            "workspaces",
            meta.workspaceId,
            "exports",
          )
        : collection(getFirebaseDb()!, "users", this.uid, "exports");
      const newExportRef = doc(exportsRef).withConverter(exportConverter);

      let effectiveCanUpload = canUploadBlob;
      let reservedBytes = 0;

      await runTransaction(db, async (tx) => {
        const userSnap = await tx.get(this.userRef());
        if (!userSnap.exists()) {
          throw new Error("User document not found");
        }
        const data = userSnap.data();
        const totalStorageBytes = (data.totalStorageBytes as number) ?? 0;
        const maxSavedBytes = (data.maxSavedBytes as number) ?? MAX_QUOTA_BYTES;
        if (incomingBytes > 0 && effectiveCanUpload) {
          if (totalStorageBytes + incomingBytes > maxSavedBytes) {
            effectiveCanUpload = false;
            reservedBytes = 0;
          } else {
            reservedBytes = incomingBytes;
          }
        }
        tx.set(newExportRef, {
          uploadId: meta.uploadId ?? null,
          fileName: meta.fileName,
          type: meta.type,
          createdAt: serverTimestamp(),
          fileSize: meta.blob?.size ?? 0,
          storageRef: "",
          downloadUrl: "",
          metadata: meta.metadata as Record<string, unknown>,
        } as WithFieldValue<ExportDoc>);
        if (reservedBytes > 0) {
          tx.update(this.userRef(), {
            totalExports: increment(1),
            totalStorageBytes: increment(reservedBytes),
            updatedAt: serverTimestamp(),
          });
        } else {
          tx.update(this.userRef(), {
            totalExports: increment(1),
            updatedAt: serverTimestamp(),
          });
        }
      });
      this.invalidateQuotas();
      canUploadBlob = effectiveCanUpload;

      let storedBytes = reservedBytes;
      let downloadUrl = "";

      if (
        this.storage &&
        meta.blob &&
        canUploadBlob &&
        this._canWriteStorage()
      ) {
        const ext = meta.type.includes("pdf")
          ? "pdf"
          : meta.type === "excel"
            ? "xlsx"
            : meta.type === "csv"
              ? "csv"
              : "docx";
        const extFolder = meta.workspaceId
          ? `workspaces/${meta.workspaceId}/exports`
          : "exports";
        const path = `users/${this.uid}/${extFolder}/${newExportRef.id}/${meta.fileName}.${ext}`;
        try {
          await uploadBytes(ref(this.storage, path), meta.blob);
          downloadUrl = await getDownloadURL(ref(this.storage, path));
          storedBytes = meta.blob.size;
          await updateDoc(
            this.exportDocRef(newExportRef.id, meta.workspaceId),
            {
              storageRef: path,
              downloadUrl,
              fileSize: storedBytes,
              compressed: false,
              originalSize: meta.blob.size,
            },
          );
        } catch (err: unknown) {
          const code =
            err instanceof Error && "code" in err
              ? (err as { code: string }).code
              : "";
          if (
            code === "storage/unauthorized" ||
            code === "storage/unauthenticated"
          ) {
            storedBytes = reservedBytes;
          } else {
            try {
              await updateDoc(this.userRef(), {
                totalExports: increment(-1),
                totalStorageBytes: increment(-reservedBytes),
                updatedAt: serverTimestamp(),
              });
              this.invalidateQuotas();
            } catch {
              void 0;
            }
            throw err;
          }
        }
      } else {
        storedBytes = reservedBytes;
      }

      return { exportId: newExportRef.id, downloadUrl };
    } catch {
      return null;
    }
  }

  // Preferences

  async updateUserPreferences(
    prefs: Partial<{
      theme: string;
      defaultExportMode: string;
      dateFormat: string;
      numberLocale: string;
      decimalPlaces: string;
      significanceLevel: string;
      statsLevel: string;
      autoSaveExports: boolean;
      showFormulas: boolean;
      compactTables: boolean;
    }>,
  ): Promise<void> {
    if (!this.db) return;
    const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (prefs.theme) updates["preferences.theme"] = prefs.theme;
    if (prefs.defaultExportMode)
      updates["preferences.defaultExportMode"] = prefs.defaultExportMode;
    if (prefs.dateFormat) updates["preferences.dateFormat"] = prefs.dateFormat;
    if (prefs.numberLocale)
      updates["preferences.numberLocale"] = prefs.numberLocale;
    if (prefs.decimalPlaces)
      updates["preferences.decimalPlaces"] = prefs.decimalPlaces;
    if (prefs.significanceLevel)
      updates["preferences.significanceLevel"] = prefs.significanceLevel;
    if (prefs.statsLevel) updates["preferences.statsLevel"] = prefs.statsLevel;
    if (typeof prefs.autoSaveExports === "boolean")
      updates["preferences.autoSaveExports"] = prefs.autoSaveExports;
    if (typeof prefs.showFormulas === "boolean")
      updates["preferences.showFormulas"] = prefs.showFormulas;
    if (typeof prefs.compactTables === "boolean")
      updates["preferences.compactTables"] = prefs.compactTables;
    await updateDoc(this.userRef(), updates).catch(() => {});
    this.invalidateQuotas();
  }

  async updateStorageConsent(uid: string, consent: boolean): Promise<void> {
    if (!this.db) return;
    await updateDoc(doc(this.db, "users", uid), {
      storageConsent: consent,
      storageConsentAt: consent ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });
  }

  async getStorageConsentAndUsage(uid: string): Promise<{
    storageConsent: boolean;
    totalUploads: number;
    totalExports: number;
    totalSavedFiles: number;
    maxSavedFiles: number;
    maxSavedUploads: number;
    maxSavedExports: number;
    totalStorageBytes: number;
    maxSavedBytes: number;
  }> {
    if (!this.db) {
      return {
        storageConsent: false,
        totalUploads: 0,
        totalExports: 0,
        totalSavedFiles: 0,
        maxSavedFiles: 50,
        maxSavedUploads: 25,
        maxSavedExports: 25,
        totalStorageBytes: 0,
        maxSavedBytes: MAX_QUOTA_BYTES,
      };
    }
    try {
      const snap = await getDoc(doc(this.db, "users", uid));
      if (snap.exists()) {
        const d = snap.data();
        const totalUploads = d.totalUploads ?? 0;
        const totalExports = d.totalExports ?? 0;
        const maxSavedUploads = d.maxSavedUploads ?? 25;
        const maxSavedExports = d.maxSavedExports ?? 25;
        return {
          storageConsent: d.storageConsent ?? false,
          totalUploads,
          totalExports,
          totalSavedFiles: totalUploads + totalExports,
          maxSavedFiles: maxSavedUploads + maxSavedExports,
          maxSavedUploads,
          maxSavedExports,
          totalStorageBytes: d.totalStorageBytes ?? 0,
          maxSavedBytes: d.maxSavedBytes ?? MAX_QUOTA_BYTES,
        };
      }
    } catch {
      /* silent */
    }
    return {
      storageConsent: false,
      totalUploads: 0,
      totalExports: 0,
      totalSavedFiles: 0,
      maxSavedFiles: 50,
      maxSavedUploads: 25,
      maxSavedExports: 25,
      totalStorageBytes: 0,
      maxSavedBytes: MAX_QUOTA_BYTES,
    };
  }

  // Helpers

  private _uploadResumable(path: string, blob: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(ref(this.storage!, path), blob);
      uploadTask.on(
        "state_changed",
        null,
        (error) => reject(error),
        () => resolve(),
      );
    });
  }

  private _canWriteStorage(): boolean {
    return this.authUid === this.uid;
  }
}

// Factory

export function createFirestoreService(uid: string): FirestoreService {
  return new FirestoreService(uid);
}
