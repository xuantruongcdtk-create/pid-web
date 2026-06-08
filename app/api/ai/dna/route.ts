import { NextResponse } from "next/server";
import { AI_NOT_CONFIGURED_MESSAGE, hasGeminiKey, mockDnaUpdate } from "@/lib/ai/mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const studentId = typeof body?.studentId === "string" ? body.studentId : undefined;

    // DNA update is a derivative of analyze; the real flow runs through
    // /api/ai/analyze and the dnaUpdate field. This endpoint just returns
    // a mock when AI isn't configured, or directs the caller to /analyze.
    if (!hasGeminiKey()) {
      return NextResponse.json({
        success: true,
        aiConfigured: false,
        message: AI_NOT_CONFIGURED_MESSAGE,
        data: mockDnaUpdate(studentId),
      });
    }

    return NextResponse.json({
      success: true,
      aiConfigured: true,
      message: "Hãy gọi /api/ai/analyze để cập nhật Learning DNA dựa trên điểm số mới nhất.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
