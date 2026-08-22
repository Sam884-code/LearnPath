// Keeps storage keys predictable and free of path separators or other
// characters that could be abused in a key/path context.
export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.slice(-100) || "file";
}
