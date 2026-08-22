import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageDriver } from "./types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// Cloudflare R2 is S3-compatible, so the AWS SDK works against it directly —
// just point `endpoint` at the account's R2 URL with region "auto".
export class R2StorageDriver implements StorageDriver {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const accountId = requireEnv("R2_ACCOUNT_ID");
    this.bucket = requireEnv("R2_BUCKET_NAME");
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
      },
    });
  }

  async upload({ key, body, contentType }: { key: string; body: Buffer; contentType: string }) {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType })
    );
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
