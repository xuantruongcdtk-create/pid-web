"use client";

// Opt out of static prerender — calls Supabase client.createClient() at render
// time which throws if env vars aren't set at build time.
export const dynamic = "force-dynamic";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Globe, Lock, Loader2, Mail, Sparkles, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const refTeacherId = params.get("ref") || null;
  const subjectHint = params.get("subject") || null;
  const source = params.get("source") || null;
  const nextPath = params.get("next") || "/";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Persist referral context so we can apply it after email confirmation too.
  useEffect(() => {
    try {
      if (refTeacherId || subjectHint || source) {
        const payload = {
          ref: refTeacherId,
          subject: subjectHint,
          source,
          savedAt: Date.now(),
        };
        localStorage.setItem("pid_signup_context", JSON.stringify(payload));
      }
    } catch {
      /* ignore */
    }
  }, [refTeacherId, subjectHint, source]);

  async function handleEmailRegister(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
            referral_teacher_id: refTeacherId,
            subject_hint: subjectHint,
            signup_source: source,
          },
          emailRedirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (error) throw error;
      // If session is returned immediately (email confirmation disabled in dev),
      // persist the referral to profiles right away.
      if (data.session && data.user && refTeacherId) {
        await supabase
          .from("profiles")
          .update({ referral_teacher_id: refTeacherId })
          .eq("id", data.user.id);
      }
      if (data.session) {
        toast.success("Đăng ký thành công!");
        // New users go through onboarding before landing on the dashboard.
        router.replace("/onboarding");
        router.refresh();
      } else {
        toast.success("Đã gửi email xác thực. Hãy kiểm tra hộp thư của bạn.");
        router.replace("/login");
      }
    } catch (err) {
      toast.error(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(nextPath)}`,
          queryParams: refTeacherId ? { ref: refTeacherId } : undefined,
        },
      });
      if (error) throw error;
    } catch (e) {
      toast.error(friendlyAuthError(e));
    }
  }

  const hasReferralContext = refTeacherId || subjectHint || source === "quiz_share";

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black overflow-hidden px-4">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-700" />

      <Card className="w-full max-w-md bg-slate-900/40 border-slate-800/80 backdrop-blur-xl shadow-2xl relative z-10 animate-fade-in">
        <CardHeader className="space-y-2 text-center">
          {hasReferralContext && (
            <div className="flex justify-center gap-2 flex-wrap">
              {source === "quiz_share" && (
                <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  <Sparkles className="h-3 w-3 mr-1" /> Từ quiz được chia sẻ
                </Badge>
              )}
              {subjectHint && (
                <Badge className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                  Quan tâm: {subjectHint}
                </Badge>
              )}
            </div>
          )}
          <CardTitle className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
            Tạo tài khoản PID
          </CardTitle>
          <CardDescription className="text-slate-400">
            {source === "quiz_share"
              ? "Xem phân tích chi tiết kết quả quiz + theo dõi tiến bộ con miễn phí"
              : "Đồng hành cùng con trên lộ trình học tập với AI"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleEmailRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-300">
                Họ và tên
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  id="name"
                  placeholder="Nguyễn Văn A"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10 bg-slate-950/50 border-slate-800 text-slate-200 placeholder:text-slate-600 focus-visible:ring-purple-500"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  id="email"
                  placeholder="name@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-slate-950/50 border-slate-800 text-slate-200 placeholder:text-slate-600 focus-visible:ring-purple-500"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">
                Mật khẩu
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  className="pl-10 bg-slate-950/50 border-slate-800 text-slate-200 placeholder:text-slate-600 focus-visible:ring-purple-500"
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 transition-all duration-300 hover:scale-[1.01]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang đăng ký…
                </>
              ) : (
                "Đăng ký tài khoản"
              )}
            </Button>
          </form>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-850" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900/40 px-2 text-slate-500">Hoặc đăng ký bằng</span>
            </div>
          </div>

          <Button
            onClick={handleGoogle}
            variant="outline"
            className="w-full border-slate-800 bg-slate-950/50 text-slate-200 hover:bg-slate-900 hover:text-white transition-all duration-300"
          >
            <Globe className="mr-2 h-4 w-4 text-rose-500" />
            Đăng ký với Google
          </Button>

          {refTeacherId && (
            <p className="text-[11px] text-center text-slate-500">
              Bạn được giới thiệu bởi giáo viên trên PID — tag giới thiệu được lưu sau khi đăng ký.
            </p>
          )}
        </CardContent>
        <CardFooter className="text-center justify-center border-t border-slate-850/50 mt-4 pt-4">
          <p className="text-sm text-slate-400">
            Đã có tài khoản?{" "}
            <Link
              href={`/login${nextPath !== "/" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
              className="font-medium text-purple-400 hover:text-purple-300 transition-colors"
            >
              Đăng nhập ngay
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
