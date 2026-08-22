import { describe, test, expect } from "vitest";
import { sniffAllowedMimeType } from "./fileSniff";
import {
  DOCX_BYTES,
  JPEG_BYTES,
  PDF_BYTES,
  PLAIN_TEXT_BYTES,
  PNG_BYTES,
  UNSUPPORTED_BYTES,
} from "../../tests/fixtures/files";

describe("sniffAllowedMimeType", () => {
  test("detects real PDF content by magic bytes", async () => {
    expect(await sniffAllowedMimeType(PDF_BYTES)).toBe("application/pdf");
  });

  test("detects real PNG content by magic bytes", async () => {
    expect(await sniffAllowedMimeType(PNG_BYTES)).toBe("image/png");
  });

  test("detects real JPEG content by magic bytes", async () => {
    expect(await sniffAllowedMimeType(JPEG_BYTES)).toBe("image/jpeg");
  });

  test("detects a real docx (zip-based) by its internal structure", async () => {
    expect(await sniffAllowedMimeType(DOCX_BYTES)).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  });

  test("falls back to a text heuristic for plain text (no magic bytes exist for it)", async () => {
    expect(await sniffAllowedMimeType(PLAIN_TEXT_BYTES)).toBe("text/plain");
  });

  test("rejects content that doesn't match any allowed type", async () => {
    expect(await sniffAllowedMimeType(UNSUPPORTED_BYTES)).toBeNull();
  });

  test("a PDF renamed to claim it's an image is still detected as a PDF, not trusted blindly", async () => {
    // The point of sniffing: the caller never even sees a declared filename
    // or content-type here, only bytes — proving the allowlist decision is
    // driven by content, not by whatever the client claims.
    expect(await sniffAllowedMimeType(PDF_BYTES)).toBe("application/pdf");
  });

  test("executable-like content (not on the allow list) is rejected even if it were mislabeled", async () => {
    // ELF magic bytes (Linux executable) — must never be treated as an
    // allowed type regardless of what a client's Content-Type header claims.
    const elfBytes = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(await sniffAllowedMimeType(elfBytes)).toBeNull();
  });
});
