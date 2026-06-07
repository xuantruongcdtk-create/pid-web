import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  findCreditPack,
  findPlan,
  resolvePurchase,
} from "@/lib/payment/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  purchaseCode: z.string().min(1).max(80),
});

function isMomoConfigured(): boolean {
  return (
    !!process.env.MOMO_PARTNER_CODE &&
    !!process.env.MOMO_ACCESS_KEY &&
    !!process.env.MOMO_SECRET_KEY &&
    !!process.env.MOMO_API_URL &&
    !process.env.MOMO_PARTNER_CODE.startsWith("your_")
  );
}

export async function POST(request: Request) {
  try {
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "invalid_body" }, { status: 400 });
    }
    const { purchaseCode } = parsed.data;

    const resolution = resolvePurchase(purchaseCode);
    if (!resolution) {
      return NextResponse.json({ success: false, error: "unknown_purchase" }, { status: 400 });
    }

    let amount = 0;
    let orderInfo = "";
    if (resolution.type === "plan") {
      const plan = findPlan(resolution.plan);
      if (!plan) {
        return NextResponse.json({ success: false, error: "unknown_plan" }, { status: 400 });
      }
      amount = plan.monthlyPriceVnd;
      orderInfo = `PID - Nang cap ${plan.name}`;
    } else {
      const pack = findCreditPack(purchaseCode);
      if (!pack) {
        return NextResponse.json({ success: false, error: "unknown_pack" }, { status: 400 });
      }
      amount = pack.priceVnd;
      orderInfo = `PID - ${pack.name}`;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
    }

    const orderId = `PID-${user.id.slice(0, 8)}-${Date.now()}`;
    const requestId = orderId;

    await supabase.from("payment_transactions").insert({
      user_id: user.id,
      provider: "momo",
      provider_transaction_id: orderId,
      amount,
      currency: "VND",
      status: "pending",
      plan_purchased: purchaseCode,
      metadata: { request_id: requestId, order_info: orderInfo },
    });

    // Sandbox fallback: simulate redirect to /payment/success
    if (!isMomoConfigured()) {
      const origin = new URL(request.url).origin;
      return NextResponse.json({
        success: true,
        provider: "momo",
        mocked: true,
        orderId,
        payUrl: `${origin}/payment/success?provider=momo&orderId=${encodeURIComponent(orderId)}&mock=1`,
      });
    }

    const redirectUrl =
      process.env.MOMO_RETURN_URL ||
      `${new URL(request.url).origin}/payment/success?provider=momo`;
    const ipnUrl =
      process.env.MOMO_NOTIFY_URL ||
      `${new URL(request.url).origin}/api/payment/webhook?provider=momo`;
    const requestType = "captureWallet";
    const extraData = "";

    const rawSignature =
      `accessKey=${process.env.MOMO_ACCESS_KEY}` +
      `&amount=${amount}` +
      `&extraData=${extraData}` +
      `&ipnUrl=${ipnUrl}` +
      `&orderId=${orderId}` +
      `&orderInfo=${orderInfo}` +
      `&partnerCode=${process.env.MOMO_PARTNER_CODE}` +
      `&redirectUrl=${redirectUrl}` +
      `&requestId=${requestId}` +
      `&requestType=${requestType}`;

    const signature = crypto
      .createHmac("sha256", process.env.MOMO_SECRET_KEY!)
      .update(rawSignature)
      .digest("hex");

    const payload = {
      partnerCode: process.env.MOMO_PARTNER_CODE,
      partnerName: "Parent Intelligence Dashboard",
      storeId: "PID",
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      lang: "vi",
      requestType,
      autoCapture: true,
      extraData,
      signature,
    };

    const momoRes = await fetch(process.env.MOMO_API_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const momoJson = await momoRes.json().catch(() => ({}));

    if (!momoRes.ok || (momoJson?.resultCode !== undefined && momoJson.resultCode !== 0)) {
      await supabase
        .from("payment_transactions")
        .update({ status: "failed", metadata: { momo_response: momoJson } })
        .eq("provider_transaction_id", orderId);
      return NextResponse.json(
        {
          success: false,
          error: "momo_create_failed",
          message: momoJson?.message ?? "Khởi tạo thanh toán MoMo thất bại",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      provider: "momo",
      orderId,
      payUrl: momoJson.payUrl,
      qrCodeUrl: momoJson.qrCodeUrl,
      deeplink: momoJson.deeplink,
    });
  } catch (error: any) {
    console.error("/api/payment/momo error:", error);
    return NextResponse.json(
      { success: false, error: "internal", message: error?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
