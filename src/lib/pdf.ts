// Per-page PDF text extraction using pdfjs-dist's legacy (Node) build.
// Dynamic import + loose typing to avoid subpath type-resolution friction.

export type PdfText = { pages: string[]; pageCount: number };

export async function extractPdfPages(buffer: Buffer): Promise<PdfText> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Point the worker at the real file so pdfjs doesn't try to spin up a "fake
  // worker" that fails to resolve inside Next's server runtime.
  try {
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    pdfjs.GlobalWorkerOptions.workerSrc = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  } catch {
    // Fall back to the default (fake) worker if resolution fails.
  }
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = (content.items as any[])
      .map((it) => (typeof it.str === "string" ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push(text);
  }
  return { pages, pageCount: doc.numPages };
}
