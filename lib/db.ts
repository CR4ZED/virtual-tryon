import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { browser } from 'wxt/browser';
import type { ProviderId } from './providers/common';
import { MAX_PHOTOS } from './validate';

export interface Settings {
  provider: ProviderId;
  geminiKey: string;
  openaiKey: string;
  geminiModel: string;
  openaiModel: string;
}

export const DEFAULT_SETTINGS: Settings = {
  provider: 'gemini',
  geminiKey: '',
  openaiKey: '',
  geminiModel: 'gemini-3.1-flash-image',
  openaiModel: 'gpt-image-2.5-sunburst',
};

export interface PhotoRecord {
  id: string;
  blob: Blob;
  width: number;
  height: number;
  primary: boolean;
  createdAt: number;
}

export interface ResultRecord {
  id: string;
  blob: Blob;
  productUrl: string;
  basePhotoId: string;
  matchPose: boolean;
  provider: ProviderId;
  createdAt: number;
}

export const MAX_RESULTS = 50;

interface TryOnDB extends DBSchema {
  kv: { key: string; value: unknown };
  photos: { key: string; value: PhotoRecord };
  results: { key: string; value: ResultRecord; indexes: { productUrl: string; createdAt: number } };
}

let dbPromise: Promise<IDBPDatabase<TryOnDB>> | undefined;

// API keys live here rather than chrome.storage because content scripts can read chrome.storage.
function db(): Promise<IDBPDatabase<TryOnDB>> {
  dbPromise ??= openDB<TryOnDB>('tryon', 1, {
    upgrade(d) {
      d.createObjectStore('kv');
      d.createObjectStore('photos', { keyPath: 'id' });
      const results = d.createObjectStore('results', { keyPath: 'id' });
      results.createIndex('productUrl', 'productUrl');
      results.createIndex('createdAt', 'createdAt');
    },
  });
  return dbPromise;
}

// Strictly increasing timestamps keep "oldest" well-defined when writes land in the same millisecond.
let lastStamp = 0;
const stamp = () => (lastStamp = Math.max(Date.now(), lastStamp + 1));

export type DataKind = 'photos' | 'settings';
const CHANNEL = 'tryon-data';

function notifyChange(kind: DataKind): void {
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage(kind);
  channel.close();
}

export function onDataChange(kind: DataKind, cb: () => void): () => void {
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (e) => {
    if (e.data === kind) cb();
  };
  return () => channel.close();
}

export async function getSettings(): Promise<Settings> {
  const stored = (await (await db()).get('kv', 'settings')) as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const tx = (await db()).transaction('kv', 'readwrite');
  const stored = (await tx.store.get('settings')) as Partial<Settings> | undefined;
  const next = { ...DEFAULT_SETTINGS, ...stored, ...patch };
  await tx.store.put(next, 'settings');
  await tx.done;
  notifyChange('settings');
  return next;
}

export async function listPhotos(): Promise<PhotoRecord[]> {
  return (await (await db()).getAll('photos')).sort((a, b) => a.createdAt - b.createdAt);
}

export async function addPhoto(blob: Blob, width: number, height: number): Promise<PhotoRecord> {
  const tx = (await db()).transaction('photos', 'readwrite');
  const count = await tx.store.count();
  if (count >= MAX_PHOTOS) throw new Error(`You can store up to ${MAX_PHOTOS} photos.`);
  const rec: PhotoRecord = { id: crypto.randomUUID(), blob, width, height, primary: count === 0, createdAt: stamp() };
  await tx.store.add(rec);
  await tx.done;
  notifyChange('photos');
  return rec;
}

export async function deletePhoto(id: string): Promise<void> {
  const tx = (await db()).transaction('photos', 'readwrite');
  const removed = await tx.store.get(id);
  await tx.store.delete(id);
  if (removed?.primary) {
    const [oldest] = (await tx.store.getAll()).sort((a, b) => a.createdAt - b.createdAt);
    if (oldest) await tx.store.put({ ...oldest, primary: true });
  }
  await tx.done;
  notifyChange('photos');
}

export async function setPrimaryPhoto(id: string): Promise<void> {
  const tx = (await db()).transaction('photos', 'readwrite');
  if (!(await tx.store.get(id))) {
    await tx.done;
    return;
  }
  for (const photo of await tx.store.getAll()) await tx.store.put({ ...photo, primary: photo.id === id });
  await tx.done;
  notifyChange('photos');
}

export async function saveResult(rec: Omit<ResultRecord, 'id' | 'createdAt'>, keep: Set<string>): Promise<ResultRecord> {
  const full: ResultRecord = { ...rec, id: crypto.randomUUID(), createdAt: stamp() };
  const tx = (await db()).transaction('results', 'readwrite');
  await tx.store.add(full);
  const oldestFirst = await tx.store.index('createdAt').getAllKeys();
  let excess = oldestFirst.length - MAX_RESULTS;
  for (const id of oldestFirst) {
    if (excess <= 0) break;
    if (id === full.id || keep.has(id)) continue;
    await tx.store.delete(id);
    excess--;
  }
  await tx.done;
  return full;
}

export async function latestResultFor(productUrl: string): Promise<ResultRecord | undefined> {
  const all = await (await db()).getAllFromIndex('results', 'productUrl', productUrl);
  return all.sort((a, b) => b.createdAt - a.createdAt)[0];
}

export async function getResult(id: string): Promise<ResultRecord | undefined> {
  return (await db()).get('results', id);
}

export async function deleteAllData(): Promise<void> {
  const tx = (await db()).transaction(['kv', 'photos', 'results'], 'readwrite');
  await Promise.all([tx.objectStore('kv').clear(), tx.objectStore('photos').clear(), tx.objectStore('results').clear(), tx.done]);
  await browser.storage.local.clear();
  notifyChange('photos');
  notifyChange('settings');
}
