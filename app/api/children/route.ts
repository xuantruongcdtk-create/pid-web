import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    children: [
      { id: "child-1", name: "Nguyễn Văn B", grade: "11", class: "11A1" }
    ]
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({ success: true, child: { id: `child-${Date.now()}`, ...body } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
