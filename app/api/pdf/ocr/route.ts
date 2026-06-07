import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image") as File;

    if (!image) {
      return NextResponse.json({ success: false, error: "No image uploaded" }, { status: 400 });
    }

    // Mock OCR Image to Text conversion
    const recognizedText = "y = x^3 - 3x^2 + 2. Tìm điểm cực trị.";

    return NextResponse.json({ success: true, text: recognizedText });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
