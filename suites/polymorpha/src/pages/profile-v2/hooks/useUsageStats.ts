import { useCallback, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { getFirebaseDb } from "@/config/firebase";
import { doc, getDoc, type DocumentReference } from "firebase/firestore";
import { firestoreConverter } from "@/types/firestore";
import { type UserDoc } from "@/lib/FirestoreService";
import {
  useUsageStatsStore,
  type UserStats,
} from "@/store/profile/useUsageStatsStore";

export type { UserStats } from "@/store/profile/useUsageStatsStore";

function profileUserRef(uid: string): DocumentReference<UserDoc> {
  return doc(getFirebaseDb()!, "users", uid).withConverter(
    firestoreConverter<UserDoc>(),
  );
}

export interface UseUsageStatsReturn {
  stats: UserStats;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
}

export function useUsageStats(): UseUsageStatsReturn {
  const { user } = useAuthStore();
  const stats = useUsageStatsStore((state) => state.stats);
  const setStats = useUsageStatsStore((state) => state.setStats);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(() => {
    if (!user) {
      return;
    }

    const db = getFirebaseDb();
    if (!db) {
      setError("Database not available");
      return;
    }

    setLoading(true);
    setError(null);

    getDoc(profileUserRef(user.uid))
      .then((snap) => {
        const d = snap.data();

        if (d) {
          setStats({
            totalUploads: d.totalUploads ?? 0,
            totalExports: d.totalExports ?? 0,
            totalStorageBytes: d.totalStorageBytes ?? 0,
            datasetsAnalysed: d.stats?.datasetsAnalysed ?? 0,
            totalRowsProcessed: d.stats?.totalRowsProcessed ?? 0,
            totalColumnsProcessed: d.stats?.totalColumnsProcessed ?? 0,
            testsRun: d.stats?.testsRun ?? 0,
          });
        }
      })
      .catch((e) => {
        if (import.meta.env.DEV) {
          console.warn("[polymorpha]", e);
        }
        setError("Failed to fetch usage stats");
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [user, setStats]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    refreshing,
    error,
    refresh,
  };
}
