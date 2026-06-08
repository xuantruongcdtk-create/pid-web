/**
 * Server-side PDF text extractor.
 *
 * The actual upload route at `app/api/pdf/upload/route.ts` calls
 * `pdf-parse` v2's `PDFParse` class directly — this helper exists so any
 * future code (e.g. background jobs) can re-use the same shape.
 */

export interface ParsedPdf {
  text: string;
  pages: number;
}

export async function parsePdf(buffer: Buffer): Promise<ParsedPdf> {
  // Dynamic import so this module stays Node-only (pdf-parse pulls in PDF.js
  // which doesn't run in Edge/Browser).
  const mod = (await import("pdf-parse")) as {
    PDFParse: new (opts: { data: Uint8Array }) => {
      getText(): Promise<{ text: string; pages: { num: number; text: string }[]; total: number }>;
      destroy(): Promise<void>;
    };
  };
  const parser = new mod.PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return {
      text: (result.text ?? "").trim(),
      pages: result.total ?? result.pages?.length ?? 0,
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
