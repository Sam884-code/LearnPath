import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { verifyLocalStorageToken } from "@/lib/storage/local";

// Only exists to make LocalStorageDriver's "signed URL" mean something in
// dev — verifies the HMAC token before serving a file from LOCAL_STORAGE_PATH.
// Never reachable with the R2 driver, since that returns a real presigned URL.
export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: keyParts } = await params;
  const key = keyParts.map(decodeURIComponent).join("/");

  const expiresParam = req.nextUrl.searchParams.get("expires");
  const sig = req.nextUrl.searchParams.get("sig");
  const expires = expiresParam ? Number(expiresParam) : NaN;

  if (!sig || !Number.isFinite(expires) || Date.now() / 1000 > expires) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Link expired or invalid" } }, { status: 401 });
  }
  if (!verifyLocalStorageToken(key, expires, sig)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid signature" } }, { status: 401 });
  }

  const baseDir = path.resolve(process.env.LOCAL_STORAGE_PATH ?? "./storage");
  const filePath = path.resolve(baseDir, key);
  if (filePath !== baseDir && !filePath.startsWith(baseDir + path.sep)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
  }

  try {
    const data = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": "attachment",
      },
    });
  } catch {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "File not found" } }, { status: 404 });
  }
}
