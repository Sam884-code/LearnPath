import { fileTypeFromBuffer } from "file-type";

// SPEC.md §5.6's allowed upload types.
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

function looksLikePlainText(buffer: Buffer): boolean {
  if (buffer.length === 0) return true;
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  let printable = 0;
  for (const byte of sample) {
    if (byte === 0) return false; // a null byte rules out plain text entirely
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126) || byte >= 128) {
      printable++;
    }
  }
  return printable / sample.length > 0.95;
}

// Sniffs the actual file content instead of trusting the client-declared
// MIME type (SPEC.md §5.6). Returns the resolved MIME type if it's one of the
// allowed types, or null otherwise.
export async function sniffAllowedMimeType(buffer: Buffer): Promise<string | null> {
  const detected = await fileTypeFromBuffer(buffer);

  if (detected) {
    if (ALLOWED_MIME_TYPES.has(detected.mime)) return detected.mime;
    // Legacy .doc is an OLE Compound File Binary. file-type identifies the
    // container but can't distinguish the specific Office format inside it
    // without deeper parsing — CFBF is the correct signature for .doc, so
    // treat it as a match rather than rejecting every legacy Word file.
    if (detected.mime === "application/x-cfb") return "application/msword";
    return null;
  }

  // No magic-number match. The only allowed type with no signature at all is
  // plain text, so fall back to a content heuristic for that one case.
  if (looksLikePlainText(buffer)) return "text/plain";

  return null;
}
