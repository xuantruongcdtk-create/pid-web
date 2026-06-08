"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Check,
  GraduationCap,
  Heart,
  Loader2,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type Step = 1 | 2 | 3;
type Role = "parent" | "teacher";
type Direction = "next" | "back";

const STORAGE_KEY = "pid_onboarding_step";

const GRADES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

export function OnboardingWizard({
  initialName = "",
  onComplete,
}: {
  initialName?: string;
  onComplete?: () => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  const [step, setStep] = useState<Step>(1);
  const [direction, setDirection] = useState<Direction>("next");

  const [role, setRole] = useState<Role | null>(null);
  const [childName, setChildName] = useState(initialName);
  const [childGrade, setChildGrade] = useState("6");
  const [plan, setPlan] = useState<"free" | "premium">("free");

  // Restore step from localStorage on mount
  useEffect(() => {
    try {
      const saved = parseInt(localStorage.getItem(STORAGE_KEY) ?? "1", 10);
      if (saved >= 1 && saved <= 3) setStep(saved as Step);
    } catch {
      /* ignore */
    }
  }, []);

  // Persist step
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(step));
    } catch {
      /* ignore */
    }
  }, [step]);

  function go(next: Step) {
    setDirection(next > step ? "next" : "back");
    setStep(next);
  }

  const finishMut = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Bạn cần đăng nhập để hoàn thành onboarding");

      // 1. Mark onboarding complete + update role
      const profilePatch: Record<string, unknown> = { onboarding_completed: true };
      if (role) profilePatch.role = role;
      await supabase.from("profiles").update(profilePatch).eq("id", user.id);

      // 2. Optionally create the first child
      if (role === "parent" && childName.trim()) {
        await fetch("/api/children", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: childName.trim(),
            grade: childGrade,
          }),
        });
      }
    },
    onSuccess: () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      qc.invalidateQueries({ queryKey: ["dashboard-layout-profile"] });
      qc.invalidateQueries({ queryKey: ["children-list"] });
      qc.invalidateQueries({ queryKey: ["dashboard-children"] });
      toast.success("Xong! Bắt đầu hành trình cùng PID 🎉");
      if (onComplete) onComplete();
      else router.replace(role === "teacher" ? "/teacher" : "/");
    },
    onError: (e: any) => toast.error(e?.message ?? "Lỗi khi hoàn tất onboarding"),
  });

  function complete() {
    finishMut.mutate();
  }

  function skipToEnd() {
    if (step < 3) go(3);
    else complete();
  }

  // -- Step indicator ----------------------------------------------------
  const indicator = (
    <div className="flex justify-center items-center gap-3 py-2">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            "h-2 rounded-full transition-all duration-300",
            i === step ? "w-8 bg-indigo-500" : i < step ? "w-2 bg-indigo-500" : "w-2 bg-slate-700",
          )}
        />
      ))}
      <span className="ml-2 text-xs text-slate-500 font-mono">Bước {step}/3</span>
    </div>
  );

  // Slide animation class per direction
  const slideClass =
    direction === "next" ? "animate-onboard-in-from-right" : "animate-onboard-in-from-left";

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black px-4">
      <Card className="w-full max-w-md bg-slate-900/40 border-slate-800/80 backdrop-blur-xl shadow-2xl">
        <CardHeader className="space-y-3">
          {indicator}
          {step > 1 && (
            <button
              type="button"
              onClick={skipToEnd}
              className="absolute top-4 right-4 text-xs text-slate-400 hover:text-slate-200"
            >
              Bỏ qua →
            </button>
          )}
        </CardHeader>
        <CardContent key={step} className={cn("space-y-4", slideClass)}>
          {step === 1 && (
            <StepRole
              role={role}
              setRole={(r) => {
                setRole(r);
                setTimeout(() => go(2), 280);
              }}
            />
          )}
          {step === 2 && (
            <StepChild
              role={role}
              childName={childName}
              setChildName={setChildName}
              childGrade={childGrade}
              setChildGrade={setChildGrade}
              onBack={() => go(1)}
              onNext={() => go(3)}
            />
          )}
          {step === 3 && (
            <StepPlan
              plan={plan}
              setPlan={setPlan}
              loading={finishMut.isPending}
              onBack={() => go(2)}
              onFinish={complete}
            />
          )}
        </CardContent>
      </Card>

      {/* Animation styles (kept local — no globals.css edit needed) */}
      <style jsx>{`
        @keyframes pidOnboardRight {
          from {
            opacity: 0;
            transform: translateX(60px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes pidOnboardLeft {
          from {
            opacity: 0;
            transform: translateX(-60px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        :global(.animate-onboard-in-from-right) {
          animation: pidOnboardRight 250ms ease both;
        }
        :global(.animate-onboard-in-from-left) {
          animation: pidOnboardLeft 250ms ease both;
        }
      `}</style>
    </div>
  );
}

// ----------------------------------------------------------------------------

function StepRole({
  role,
  setRole,
}: {
  role: Role | null;
  setRole: (r: Role) => void;
}) {
  return (
    <>
      <CardTitle className="text-slate-100 text-2xl text-center">Bạn là…?</CardTitle>
      <CardDescription className="text-slate-400 text-center">
        Chúng tôi sẽ cá nhân hoá dashboard cho bạn.
      </CardDescription>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
        <RoleCard
          icon={Heart}
          title="Phụ huynh"
          description="Theo dõi học tập, sức khoẻ tinh thần của con và làm việc với AI Coach."
          active={role === "parent"}
          onSelect={() => setRole("parent")}
        />
        <RoleCard
          icon={GraduationCap}
          title="Giáo viên"
          description="Tạo quiz từ tài liệu, chia sẻ với phụ huynh qua link / Zalo."
          active={role === "teacher"}
          onSelect={() => setRole("teacher")}
        />
      </div>
      <p className="text-[11px] text-slate-500 text-center pt-2">
        Bạn có thể đổi vai trò sau trong Cài đặt.
      </p>
    </>
  );
}

function RoleCard({
  icon: Icon,
  title,
  description,
  active,
  onSelect,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-xl border p-4 text-left transition-all",
        active
          ? "bg-indigo-950/40 border-indigo-500/60 shadow-md shadow-indigo-500/20"
          : "bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/40",
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-indigo-400" />
        <span className="font-semibold text-slate-100 text-sm">{title}</span>
        {active && <Check className="h-4 w-4 ml-auto text-emerald-400" />}
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
    </button>
  );
}

function StepChild({
  role,
  childName,
  setChildName,
  childGrade,
  setChildGrade,
  onBack,
  onNext,
}: {
  role: Role | null;
  childName: string;
  setChildName: (s: string) => void;
  childGrade: string;
  setChildGrade: (s: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const isParent = role !== "teacher";
  return (
    <>
      <CardTitle className="text-slate-100 text-2xl text-center">
        {isParent ? "Thêm hồ sơ con" : "Thêm lớp đầu tiên"}
      </CardTitle>
      <CardDescription className="text-slate-400 text-center">
        {isParent
          ? "Tạo một hồ sơ ngắn — bạn có thể thêm chi tiết sau."
          : "Bạn có thể đặt tên lớp ở đây hoặc bỏ qua để tạo sau."}
      </CardDescription>

      <div className="space-y-3 pt-3">
        <div className="space-y-2">
          <Label htmlFor="child-name" className="text-slate-300">
            {isParent ? "Tên con" : "Tên lớp / nhóm"}
          </Label>
          <Input
            id="child-name"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            placeholder={isParent ? "Nguyễn Văn B" : "Lớp 11A1"}
            className="bg-slate-950/50 border-slate-800 text-slate-200"
          />
        </div>
        {isParent && (
          <div className="space-y-2">
            <Label className="text-slate-300">Lớp đang học</Label>
            <Select value={childGrade} onValueChange={(v) => v && setChildGrade(v)}>
              <SelectTrigger className="bg-slate-950/50 border-slate-800 text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                {GRADES.map((g) => (
                  <SelectItem key={g} value={g}>
                    Lớp {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center pt-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="text-slate-400 hover:text-white"
        >
          ← Quay lại
        </Button>
        <Button
          type="button"
          onClick={onNext}
          className="bg-indigo-600 hover:bg-indigo-500 text-white"
        >
          Tiếp tục <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </>
  );
}

function StepPlan({
  plan,
  setPlan,
  loading,
  onBack,
  onFinish,
}: {
  plan: "free" | "premium";
  setPlan: (p: "free" | "premium") => void;
  loading: boolean;
  onBack: () => void;
  onFinish: () => void;
}) {
  return (
    <>
      <CardTitle className="text-slate-100 text-2xl text-center">Chọn gói khởi đầu</CardTitle>
      <CardDescription className="text-slate-400 text-center">
        Có thể nâng cấp / hạ cấp bất cứ lúc nào.
      </CardDescription>

      <div className="grid grid-cols-1 gap-3 pt-3">
        <PlanCard
          name="Free"
          price="0đ"
          features={["3 lượt tạo quiz AI", "Phân tích cơ bản", "1 hồ sơ con"]}
          active={plan === "free"}
          onSelect={() => setPlan("free")}
        />
        <PlanCard
          name="Premium"
          price="199.000đ / tháng"
          features={[
            "Tạo quiz không giới hạn",
            "AI Coach không giới hạn",
            "Báo cáo chi tiết + Early Warning",
          ]}
          highlight
          active={plan === "premium"}
          badge="Dùng thử 7 ngày miễn phí"
          onSelect={() => setPlan("premium")}
        />
      </div>

      <div className="flex justify-between items-center pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="text-slate-400 hover:text-white"
        >
          ← Quay lại
        </Button>
        <Button
          type="button"
          onClick={onFinish}
          disabled={loading}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold min-w-36"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang lưu…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" /> Bắt đầu
            </>
          )}
        </Button>
      </div>
      <p className="text-[11px] text-slate-500 text-center">
        Lựa chọn Premium ở đây không trừ tiền — bạn sẽ chọn phương thức thanh toán sau.
      </p>
    </>
  );
}

function PlanCard({
  name,
  price,
  features,
  active,
  highlight,
  badge,
  onSelect,
}: {
  name: string;
  price: string;
  features: string[];
  active: boolean;
  highlight?: boolean;
  badge?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-xl border p-4 text-left transition-all",
        active && highlight && "bg-indigo-950/50 border-indigo-500 shadow-md shadow-indigo-500/20",
        active && !highlight && "bg-slate-900 border-slate-600",
        !active && "bg-slate-950/40 border-slate-800 hover:border-slate-700",
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-100">{name}</span>
          {badge && (
            <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px]">
              {badge}
            </Badge>
          )}
        </div>
        {active && <Check className="h-4 w-4 text-emerald-400" />}
      </div>
      <div className="text-sm text-slate-400 mb-2">{price}</div>
      <ul className="text-xs text-slate-400 space-y-1">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-1.5">
            <Users className="h-3 w-3 text-indigo-400 shrink-0" />
            {f}
          </li>
        ))}
      </ul>
    </button>
  );
}
