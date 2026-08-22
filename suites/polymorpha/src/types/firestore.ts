import {
  type FirestoreDataConverter,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Timestamp,
} from "firebase/firestore";

export function firestoreConverter<
  T extends { id?: string },
>(): FirestoreDataConverter<T> {
  return {
    toFirestore(data: T): DocumentData {
      const { id: _, ...rest } = data;
      return rest as DocumentData;
    },
    fromFirestore(snap: QueryDocumentSnapshot): T {
      const data = snap.data() as DocumentData;
      return { ...data, id: snap.id } as T;
    },
  };
}

export type TimestampFields = Record<string, Timestamp | null | undefined>;
