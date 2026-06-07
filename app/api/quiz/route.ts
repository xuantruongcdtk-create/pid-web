import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ success: true, quizzes: [] });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({ success: true, quiz: { id: "new-quiz", ...body } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
