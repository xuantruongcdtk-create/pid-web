/**
 * Centralized pricing config — single source of truth used by the pricing UI
 * and webhook handlers.
 */

export type PlanId = "free" | "premium" | "teacher_pro";
export type CreditPackId = "pack_10" | "pack_30" | "pack_100";

export interface PlanDef {
  id: PlanId;
  name: string;
  monthlyPriceVnd: number;
  /** "premium_monthly" / "teacher_pro_monthly" etc — stored in payments.plan_purchased */
  purchaseCode: string;
  highlight?: boolean;
  features: string[];
  badge?: string;
  ctaLabel: string;
  trialDays?: number;
}

export interface CreditPackDef {
  id: CreditPackId;
  name: string;
  credits: number;
  priceVnd: number;
  /** % discount vs base pack_10 unit price (~ 5_000đ/credit). Used in UI tag. */
  savingsPct: number;
  popular?: boolean;
}

export const PLANS: PlanDef[] = [
  {
    id: "free",
    name: "Free",
    monthlyPriceVnd: 0,
    purchaseCode: "free",
    ctaLabel: "Đang dùng",
    features: [
      "3 lần tạo quiz từ PDF/text",
      "Phân tích cơ bản theo tuần",
      "1 hồ sơ con",
      "Không có AI Coach chat",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    monthlyPriceVnd: 199_000,
    purchaseCode: "premium_monthly",
    highlight: true,
    badge: "Được chọn nhiều nhất",
    trialDays: 7,
    ctaLabel: "Dùng thử 7 ngày miễn phí",
    features: [
      "Tạo quiz KHÔNG GIỚI HẠN",
      "AI Coach chat không giới hạn",
      "Báo cáo phân tích chi tiết tuần/tháng",
      "Cảnh báo sớm (Early Warning)",
      "Learning DNA tự động cập nhật",
      "Nhiều hồ sơ con",
      "Hỗ trợ ưu tiên",
    ],
  },
  {
    id: "teacher_pro",
    name: "Teacher Pro",
    monthlyPriceVnd: 299_000,
    purchaseCode: "teacher_pro_monthly",
    ctaLabel: "Nâng cấp Teacher Pro",
    features: [
      "Mọi tính năng Premium",
      "Cổng giáo viên + chia sẻ quiz công khai",
      "Quản lý nhiều lớp / nhiều quiz cùng lúc",
      "Class analytics ẩn danh",
      "Tag affiliate khi phụ huynh đăng ký từ link của bạn",
      "Hỗ trợ kỹ thuật riêng",
    ],
  },
];

export const CREDIT_PACKS: CreditPackDef[] = [
  {
    id: "pack_10",
    name: "Pack 10 quiz",
    credits: 10,
    priceVnd: 50_000,
    savingsPct: 0,
    popular: true,
  },
  {
    id: "pack_30",
    name: "Pack 30 quiz",
    credits: 30,
    priceVnd: 120_000,
    savingsPct: 17,
  },
  {
    id: "pack_100",
    name: "Pack 100 quiz",
    credits: 100,
    priceVnd: 350_000,
    savingsPct: 30,
  },
];

export function findPlan(id: string): PlanDef | undefined {
  return PLANS.find((p) => p.id === id || p.purchaseCode === id);
}

export function findCreditPack(id: string): CreditPackDef | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount) + "đ";
}

/**
 * Given a `purchaseCode` (what we put in the order's orderInfo / plan_purchased
 * field), tell the webhook what to apply.
 */
export function resolvePurchase(
  purchaseCode: string,
): { type: "plan"; plan: PlanId; addDays: number } | { type: "credits"; credits: number } | null {
  if (purchaseCode === "premium_monthly") return { type: "plan", plan: "premium", addDays: 30 };
  if (purchaseCode === "premium_yearly")
    return { type: "plan", plan: "premium", addDays: 365 };
  if (purchaseCode === "teacher_pro_monthly")
    return { type: "plan", plan: "teacher_pro", addDays: 30 };
  const pack = findCreditPack(purchaseCode);
  if (pack) return { type: "credits", credits: pack.credits };
  return null;
}
