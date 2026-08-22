import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { StorageDriver } from "./types";

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}

// There's no real S3 to presign a URL against in local dev, so this signs its
// own short-lived HMAC token over (key, expiry) — verified by the
// _local-storage serving route below. Exported so that route can verify with
// the exact same signing logic.
export function signLocalStorageToken(key: string, expiresAtEpochSeconds: number): string {
  const payload = `${key}.${expiresAtEpochSeconds}`;
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function verifyLocalStorageToken(key: string, expiresAtEpochSeconds: number, signature: string): boolean {
  const expected = signLocalStorageToken(key, expiresAtEpochSeconds);
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export class LocalStorageDriver implements StorageDriver {
  private baseDir: string;
  private baseUrl: string;

  constructor() {
    this.baseDir = path.resolve(process.env.LOCAL_STORAGE_PATH ?? "./storage");
    this.baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  }

  private resolvePath(key: string): string {
    const resolved = path.resolve(this.baseDir, key);
    if (resolved !== this.baseDir && !resolved.startsWith(this.baseDir + path.sep)) {
      throw new Error("Invalid storage key");
    }
    return resolved;
  }

  async upload({ key, body }: { key: string; body: Buffer; contentType: string }): Promise<void> {
    const filePath = this.resolvePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, body);
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const sig = signLocalStorageToken(key, expires);
    return `${this.baseUrl}/api/v1/_local-storage/${key
      .split("/")
      .map(encodeURIComponent)
      .join("/")}?expires=${expires}&sig=${sig}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    await fs.rm(filePath, { force: true });
  }
}
