import type { StorageDriver } from "./types";
import { LocalStorageDriver } from "./local";
import { R2StorageDriver } from "./r2";

let cached: StorageDriver | null = null;

// STORAGE_DRIVER=local (the .env.example default) needs no cloud credentials
// at all — R2StorageDriver is never constructed unless STORAGE_DRIVER=r2.
export function getStorageDriver(): StorageDriver {
  if (!cached) {
    cached = process.env.STORAGE_DRIVER === "r2" ? new R2StorageDriver() : new LocalStorageDriver();
  }
  return cached;
}

export type { StorageDriver } from "./types";
