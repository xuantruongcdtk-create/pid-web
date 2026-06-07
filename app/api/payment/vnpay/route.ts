import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { findCreditPack, findPlan, resolvePurchase } from "@/lib/payment/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  purchaseCode: z.string().min(1).max(80),
});

function isVnpayConfigured(): boolean {
  return (
    !!process.env.VNPAY_TMN_CODE &&
    !!process.env.VNPAY_HASH_SECRET &&
    !!process.env.VNPAY_URL &&
    !process.env.VNPAY_TMN_CODE.startsWith("your_")
  );
}

function sortObject<T extends Record<string, string | number>>(obj: T) {
  return Object.keys(obj)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      acc[key] = String(obj[key]);
      return acc;
    }, {});
}

function encodeRfc3986(str: string) {
  return encodeURIComponent(str).replace(/%20/g, "+");
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function getClientIp(request: Request) {
  const xfwd = request.headers.get("x-forwarded-for");
  if (xfwd) return xfwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "127.0.0.1";
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
      if (!plan)
        return NextResponse.json({ success: false, error: "unknown_plan" }, { status: 400 });
      amount = plan.monthlyPriceVnd;
      orderInfo = `PID Nang cap ${plan.name}`;
    } else {
      const pack = findCreditPack(purchaseCode);
      if (!pack)
        return NextResponse.json({ success: false, error: "unknown_pack" }, { status: 400 });
      amount = pack.priceVnd;
      orderInfo = `PID ${pack.name}`;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
    }

    const orderId = `PID-${user.id.slice(0, 8)}-${Date.now()}`;

    await supabase.from("payment_transactions").insert({
      user_id: user.id,
      provider: "vnpay",
      provider_transaction_id: orderId,
      amount,
      currency: "VND",
      status: "pending",
      plan_purchased: purchaseCode,
      metadata: { order_info: orderInfo },
    });

    // Sandbox fallback when VNPAY env not set
    if (!isVnpayConfigured()) {
      const origin = new URL(request.url).origin;
      return NextResponse.json({
        success: true,
        provider: "vnpay",
        mocked: true,
        orderId,
        payUrl: `${origin}/payment/success?provider=vnpay&orderId=${encodeURIComponent(orderId)}&mock=1`,
      });
    }

    const now = new Date();
    const createDate =
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
      `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const returnUrl =
      process.env.VNPAY_RETURN_URL ||
      `${new URL(request.url).origin}/payment/success?provider=vnpay`;

    const params: Record<string, string | number> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: process.env.VNPAY_TMN_CODE!,
      vnp_Locale: "vn",
      vnp_CurrCode: "VND",
      vnp_TxnRef: orderId,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: "other",
      vnp_Amount: amount * 100, // VNPAY uses cents
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: getClientIp(request),
      vnp_CreateDate: createDate,
    };

    const sorted = sortObject(params);
    const signData = Object.entries(sorted)
      .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
      .join("&");

    const secureHash = crypto
      .createHmac("sha512", process.env.VNPAY_HASH_SECRET!)
      .update(signData)
      .digest("hex");

    const payUrl = `${process.env.VNPAY_URL}?${signData}&vnp_SecureHashType=HmacSHA512&vnp_SecureHash=${secureHash}`;

    return NextResponse.json({ success: true, provider: "vnpay", orderId, payUrl });
  } catch (error: any) {
    console.error("/api/payment/vnpay error:", error);
    return NextResponse.json(
      { success: false, error: "internal", message: error?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
