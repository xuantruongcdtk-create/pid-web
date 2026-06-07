import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { resolvePurchase } from "@/lib/payment/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Service-role Supabase client — webhooks must bypass RLS because they're
 * called by the payment provider, not the authenticated user.
 */
function serviceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// ---- Signature verifiers --------------------------------------------------

function verifyMomo(body: Record<string, any>): boolean {
  const secret = process.env.MOMO_SECRET_KEY;
  if (!secret) return false;
  const fields = [
    "accessKey",
    "amount",
    "extraData",
    "message",
    "orderId",
    "orderInfo",
    "orderType",
    "partnerCode",
    "payType",
    "requestId",
    "responseTime",
    "resultCode",
    "transId",
  ];
  const raw = fields
    .map((f) => `${f}=${body[f] === undefined || body[f] === null ? "" : body[f]}`)
    .join("&");
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return expected === body.signature;
}

function verifyVnpay(params: Record<string, string>): boolean {
  const secret = process.env.VNPAY_HASH_SECRET;
  if (!secret) return false;
  const { vnp_SecureHash, vnp_SecureHashType: _ignored, ...rest } = params;
  void _ignored;
  const sorted = Object.keys(rest)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      acc[key] = rest[key];
      return acc;
    }, {});
  const signData = Object.entries(sorted)
    .map(([k, v]) => `${encodeURIComponent(k).replace(/%20/g, "+")}=${encodeURIComponent(v).replace(/%20/g, "+")}`)
    .join("&");
  const expected = crypto.createHmac("sha512", secret).update(signData).digest("hex");
  return expected === vnp_SecureHash;
}

// ---- Core: apply purchase to user account ---------------------------------

async function applyPurchase(opts: {
  supabase: ReturnType<typeof serviceRoleClient>;
  userId: string;
  planPurchased: string;
}): Promise<{ kind: "plan" | "credits"; detail: string } | null> {
  const resolution = resolvePurchase(opts.planPurchased);
  if (!resolution) return null;

  if (resolution.type === "credits") {
    // Increment credits atomically (read-then-write — acceptable for low contention)
    const { data: profile } = await opts.supabase
      .from("profiles")
      .select("credits")
      .eq("id", opts.userId)
      .maybeSingle();
    const next = (profile?.credits ?? 0) + resolution.credits;
    await opts.supabase
      .from("profiles")
      .update({ credits: next })
      .eq("id", opts.userId);
    return { kind: "credits", detail: `+${resolution.credits} credits` };
  }

  // Plan upgrade
  const { data: profile } = await opts.supabase
    .from("profiles")
    .select("plan, plan_expires_at")
    .eq("id", opts.userId)
    .maybeSingle();
  const now = new Date();
  const base =
    profile?.plan_expires_at && new Date(profile.plan_expires_at) > now
      ? new Date(profile.plan_expires_at)
      : now;
  const newExpiry = new Date(base);
  newExpiry.setDate(newExpiry.getDate() + resolution.addDays);

  await opts.supabase
    .from("profiles")
    .update({ plan: resolution.plan, plan_expires_at: newExpiry.toISOString() })
    .eq("id", opts.userId);

  return {
    kind: "plan",
    detail: `Plan ${resolution.plan} đến ${newExpiry.toISOString()}`,
  };
}

// ---- Handler --------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const providerHint = url.searchParams.get("provider"); // momo|vnpay

    // Read body once — could be JSON (MoMo) or form-encoded (rare)
    const raw = await request.text();
    let body: Record<string, any> = {};
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        // form-encoded fallback
        const params = new URLSearchParams(raw);
        body = Object.fromEntries(params.entries());
      }
    }

    // Provider detection
    const provider =
      providerHint ??
      (typeof body.partnerCode === "string"
        ? "momo"
        : typeof body.vnp_TxnRef === "string"
          ? "vnpay"
          : null);

    if (!provider) {
      return NextResponse.json(
        { success: false, error: "unknown_provider" },
        { status: 400 },
      );
    }

    const supabase = serviceRoleClient();

    if (provider === "momo") {
      if (!verifyMomo(body)) {
        return NextResponse.json(
          { success: false, error: "invalid_signature" },
          { status: 400 },
        );
      }
      const orderId = String(body.orderId);
      const resultCode = Number(body.resultCode);
      const success = resultCode === 0;

      // Idempotency: skip if already processed
      const { data: existing } = await supabase
        .from("payment_transactions")
        .select("id, status, user_id, plan_purchased")
        .eq("provider_transaction_id", orderId)
        .maybeSingle();
      if (!existing) {
        return NextResponse.json(
          { success: false, error: "order_not_found", orderId },
          { status: 404 },
        );
      }
      if (existing.status === "success") {
        return NextResponse.json({ success: true, idempotent: true });
      }

      if (!success) {
        await supabase
          .from("payment_transactions")
          .update({ status: "failed", metadata: { momo: body } })
          .eq("provider_transaction_id", orderId);
        return NextResponse.json({ success: true, status: "failed", resultCode });
      }

      // mark success + apply
      await supabase
        .from("payment_transactions")
        .update({ status: "success", metadata: { momo: body } })
        .eq("provider_transaction_id", orderId);

      let applied: { kind: string; detail: string } | null = null;
      if (existing.user_id && existing.plan_purchased) {
        applied = await applyPurchase({
          supabase,
          userId: existing.user_id,
          planPurchased: existing.plan_purchased,
        });
      }
      return NextResponse.json({ success: true, applied });
    }

    if (provider === "vnpay") {
      if (!verifyVnpay(body as Record<string, string>)) {
        return NextResponse.json(
          { success: false, error: "invalid_signature" },
          { status: 400 },
        );
      }
      const orderId = String(body.vnp_TxnRef);
      const responseCode = String(body.vnp_ResponseCode);
      const success = responseCode === "00";

      const { data: existing } = await supabase
        .from("payment_transactions")
        .select("id, status, user_id, plan_purchased")
        .eq("provider_transaction_id", orderId)
        .maybeSingle();
      if (!existing) {
        return NextResponse.json(
          { success: false, error: "order_not_found", orderId },
          { status: 404 },
        );
      }
      if (existing.status === "success") {
        return NextResponse.json({ success: true, idempotent: true });
      }

      if (!success) {
        await supabase
          .from("payment_transactions")
          .update({ status: "failed", metadata: { vnpay: body } })
          .eq("provider_transaction_id", orderId);
        return NextResponse.json({ success: true, status: "failed", responseCode });
      }

      await supabase
        .from("payment_transactions")
        .update({ status: "success", metadata: { vnpay: body } })
        .eq("provider_transaction_id", orderId);

      let applied: { kind: string; detail: string } | null = null;
      if (existing.user_id && existing.plan_purchased) {
        applied = await applyPurchase({
          supabase,
          userId: existing.user_id,
          planPurchased: existing.plan_purchased,
        });
      }
      return NextResponse.json({ success: true, applied });
    }

    return NextResponse.json({ success: false, error: "unsupported_provider" }, { status: 400 });
  } catch (error: any) {
    console.error("/api/payment/webhook error:", error);
    return NextResponse.json(
      { success: false, error: "internal", message: error?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}

// VNPAY also redirects via GET to the IPN endpoint sometimes
export async function GET(request: Request) {
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (params[k] = v));
  return POST(
    new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    }),
  );
}
