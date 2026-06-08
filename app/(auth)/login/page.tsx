"use client";

// Opt out of static prerender — calls Supabase client.createClient() at render
// time which throws if env vars aren't set at build time.
export const dynamic = "force-dynamic";

import React, { Suspense, useMemo, useState } from "react";
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
import { Globe, Loader2, Lock, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const nextPath = params.get("next") || "/";
  const oauthError = params.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  // Surface error pings from /callback?error=…
  React.useEffect(() => {
    if (oauthError === "auth-failed") {
      toast.error("Đăng nhập Google không thành công. Vui lòng thử lại.");
    } else if (oauthError === "no-code") {
      toast.error("Không nhận được mã xác thực. Vui lòng thử lại.");
    }
  }, [oauthError]);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (data.session) {
        toast.success("Đăng nhập thành công!");
        router.replace(nextPath);
        router.refresh();
      }
    } catch (err) {
      toast.error(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    if (oauthLoading) return;
    setOauthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (error) throw error;
      // signInWithOAuth redirects the whole tab; if we're still here, something went wrong.
    } catch (err) {
      toast.error(friendlyAuthError(err));
      setOauthLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black overflow-hidden px-4">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse delay-700" />

      <Card className="w-full max-w-md bg-slate-900/40 border-slate-800/80 backdrop-blur-xl shadow-2xl relative z-10 animate-fade-in">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            PID
          </CardTitle>
          <CardDescription className="text-slate-400">
            Đăng nhập để theo dõi tiến trình học tập của con
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleEmailLogin} className="space-y-4">
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
                  required
                  className="pl-10 bg-slate-950/50 border-slate-800 text-slate-200 placeholder:text-slate-600 focus-visible:ring-indigo-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-slate-300">
                  Mật khẩu
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 bg-slate-950/50 border-slate-800 text-slate-200 placeholder:text-slate-600 focus-visible:ring-indigo-500"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20 transition-all duration-300 hover:scale-[1.01]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang đăng nhập…
                </>
              ) : (
                "Đăng nhập"
              )}
            </Button>
          </form>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-850" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900/40 px-2 text-slate-500">Hoặc đăng nhập bằng</span>
            </div>
          </div>

          <Button
            onClick={handleGoogleLogin}
            disabled={oauthLoading}
            variant="outline"
            className="w-full border-slate-800 bg-slate-950/50 text-slate-200 hover:bg-slate-900 hover:text-white transition-all duration-300"
          >
            {oauthLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang chuyển đến Google…
              </>
            ) : (
              <>
                <Globe className="mr-2 h-4 w-4 text-rose-500" /> Đăng nhập với Google
              </>
            )}
          </Button>
        </CardContent>
        <CardFooter className="text-center justify-center border-t border-slate-850/50 mt-4 pt-4">
          <p className="text-sm text-slate-400">
            Chưa có tài khoản?{" "}
            <Link
              href={`/register${nextPath !== "/" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
              className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Đăng ký ngay
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
