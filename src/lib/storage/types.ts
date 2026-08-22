// Storage is kept behind this interface so R2 (or any S3-compatible service)
// can be swapped for local disk (or something else) without touching any
// route or service code — only `getStorageDriver()` needs to know which.
export interface StorageDriver {
  upload(params: { key: string; body: Buffer; contentType: string }): Promise<void>;
  getSignedDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}
