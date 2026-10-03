import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  emptyData,
  type CollectionName,
  type DataState,
  type Profile,
} from "./types";
const names = Object.keys(emptyData) as CollectionName[];
export const collectionRef = (uid: string, name: CollectionName) =>
  collection(db, "users", uid, name);
export const save = async <T extends { id: string }>(
  uid: string,
  name: CollectionName,
  item: T,
) => setDoc(doc(collectionRef(uid, name), item.id), item);
export const remove = async (uid: string, name: CollectionName, id: string) =>
  deleteDoc(doc(collectionRef(uid, name), id));
export const saveProfile = (uid: string, p: Profile) =>
  setDoc(doc(db, "users", uid), p);
export const watchProfile = (
  uid: string,
  ok: (p: Profile | null) => void,
  fail: (e: Error) => void,
) =>
  onSnapshot(
    doc(db, "users", uid),
    (s) => ok(s.exists() ? (s.data() as Profile) : null),
    fail,
  );
export function watchData(
  uid: string,
  ok: (
    name: CollectionName,
    items: DataState[CollectionName],
    pending: boolean,
    cache: boolean,
  ) => void,
  fail: (e: Error) => void,
): Unsubscribe[] {
  return names.map((name) =>
    onSnapshot(
      collectionRef(uid, name),
      { includeMetadataChanges: true },
      (s) =>
        ok(
          name,
          s.docs.map((d) => ({
            ...d.data(),
            id: d.id,
          })) as unknown as DataState[CollectionName],
          s.metadata.hasPendingWrites,
          s.metadata.fromCache,
        ),
      fail,
    ),
  );
}
export async function exportAll(uid: string) {
  const result: Record<string, unknown> = {
    format: "daymark-v1",
    exportedAt: new Date().toISOString(),
  };
  for (const name of names) {
    result[name] = (await getDocs(collectionRef(uid, name))).docs.map((d) => ({
      ...d.data(),
      id: d.id,
    }));
  }
  const snap = await getDoc(doc(db, "users", uid));
  result.profile = snap.data() ?? null;
  return result;
}
export async function eraseData(uid: string) {
  for (const name of names) {
    const docs = (await getDocs(collectionRef(uid, name))).docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await deleteDoc(doc(db, "users", uid));
}
export async function importData(uid: string, data: Record<string, unknown>) {
  if (data.format !== "daymark-v1")
    throw Error("Choose a Daymark JSON backup.");
  for (const name of names) {
    const list = data[name];
    if (!Array.isArray(list)) continue;
    for (let i = 0; i < list.length; i += 300) {
      const batch = writeBatch(db);
      for (const item of list.slice(i, i + 300)) {
        if (
          !item ||
          typeof item !== "object" ||
          typeof item.id !== "string" ||
          item.id.length > 120
        )
          throw Error(`Invalid ${name} entry`);
        batch.set(doc(collectionRef(uid, name), item.id), item);
      }
      await batch.commit();
    }
  }
  if (data.profile && typeof data.profile === "object")
    await saveProfile(uid, data.profile as Profile);
}
