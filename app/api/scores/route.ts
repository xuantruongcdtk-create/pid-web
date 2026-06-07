import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ success: true, scores: [] });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({ success: true, score: { id: `score-${Date.now()}`, ...body } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
