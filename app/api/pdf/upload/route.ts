import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "no_file", message: "Không tìm thấy file" },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: "file_too_large",
          message: `File vượt quá ${Math.round(MAX_BYTES / 1024 / 1024)}MB`,
        },
        { status: 413 },
      );
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".pdf") && file.type !== "application/pdf") {
      return NextResponse.json(
        { success: false, error: "not_pdf", message: "Chỉ chấp nhận file PDF" },
        { status: 415 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());

    // pdf-parse v2 exports a PDFParse class; v1's default function call is gone.
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    const result = await parser.getText();
    const text = (result.text ?? "").trim();
    const pages = result.total ?? result.pages?.length ?? 0;
    await parser.destroy().catch(() => undefined);

    return NextResponse.json({
      success: true,
      data: {
        filename: file.name,
        size: file.size,
        pages,
        text,
        textLength: text.length,
      },
    });
  } catch (error: any) {
    console.error("/api/pdf/upload error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "parse_failed",
        message: error?.message ?? "Không thể đọc nội dung PDF",
      },
      { status: 500 },
    );
  }
}
