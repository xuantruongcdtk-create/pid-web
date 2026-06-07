import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const text = await request.text();
    console.log("Received Stripe Webhook raw text: ", text.substring(0, 100));

    // Handle stripe event signature verification and logic
    return NextResponse.json({ received: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
