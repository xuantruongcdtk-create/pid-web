"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BookOpen,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Home,
  LineChart,
  LogOut,
  Menu,
  MessageSquare,
  PenTool,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useChildStore } from "@/store/useChildStore";
import { NotificationBell } from "@/components/dashboard/NotificationBell";

const menuItems = [
  { href: "/", label: "Tổng quan", icon: Home },
  { href: "/analytics", label: "Phân tích điểm số", icon: LineChart },
  { href: "/dna", label: "Learning DNA", icon: BrainCircuit },
  { href: "/quiz", label: "Kho đề & bài tập", icon: BookOpen },
  { href: "/coach", label: "AI Coach", icon: MessageSquare },
  { href: "/input", label: "Nhập điểm số", icon: PenTool },
  { href: "/settings", label: "Cài đặt", icon: Settings },
];

interface ChildRow {
  id: string;
  full_name: string;
  grade: string | null;
  avatar_color: string | null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const isActive = (href: string) =>
    href === "/" ? pathname === href : pathname.startsWith(href);

  // ---- Profile + active child ------------------------------------------
  const profileQ = useQuery({
    queryKey: ["dashboard-layout-profile"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .maybeSingle();
      return { ...data, email: user.email } as {
        full_name: string | null;
        role: string | null;
        email: string | undefined;
      };
    },
    staleTime: 5 * 60_000,
  });

  const childrenQ = useQuery({
    queryKey: ["dashboard-children"],
    queryFn: async (): Promise<ChildRow[]> => {
      const { data } = await supabase
        .from("children")
        .select("id, full_name, grade, avatar_color")
        .order("created_at", { ascending: true });
      return (data ?? []) as ChildRow[];
    },
    staleTime: 60_000,
  });

  const selectedChildId = useChildStore((s) => s.selectedChildId);
  const setSelectedChild = useChildStore((s) => s.setSelectedChild);
  const childList = childrenQ.data ?? [];
  const activeChild = childList.find((c) => c.id === selectedChildId) ?? null;

  useEffect(() => {
    if (!selectedChildId && childList.length > 0) {
      setSelectedChild(childList[0].id);
    }
  }, [selectedChildId, childList, setSelectedChild]);

  const profileName = profileQ.data?.full_name ?? profileQ.data?.email ?? "Phụ huynh";

  // ---- Sidebar ---------------------------------------------------------

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 border-r border-slate-900 w-64">
      <div className="flex items-center gap-3 px-6 h-20 border-b border-slate-900">
        <div className="p-2 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
          <GraduationCap className="h-6 w-6 text-white" />
        </div>
        <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          PID
        </span>
      </div>

      <nav
        role="navigation"
        aria-label="Menu chính"
        className="flex-1 px-4 py-6 space-y-1 overflow-y-auto"
      >
        {menuItems.map((item) => {
          const Active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={Active ? "page" : undefined}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 group",
                Active
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/15 font-semibold"
                  : "text-slate-400 hover:bg-slate-900 hover:text-white",
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-300",
                    Active ? "scale-110" : "group-hover:scale-105",
                  )}
                />
                <span>{item.label}</span>
              </div>
              {Active && <ChevronRight className="h-4 w-4 opacity-80" />}
            </Link>
          );
        })}
        {profileQ.data?.role === "teacher" && (
          <Link
            href="/teacher"
            className="mt-3 flex items-center justify-between px-4 py-3 rounded-xl border border-emerald-900/60 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950/50"
          >
            <div className="flex items-center gap-3">
              <GraduationCap className="h-5 w-5" />
              <span>Cổng giáo viên</span>
            </div>
            <ChevronRight className="h-4 w-4 opacity-60" />
          </Link>
        )}
      </nav>

      <div className="p-4 border-t border-slate-900 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-10 w-10 ring-2 ring-slate-800 shrink-0">
            <AvatarFallback className="bg-slate-800 text-slate-200">
              {(profileName ?? "PH").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-slate-200 truncate">{profileName}</span>
            <span className="text-xs text-slate-500">Phụ huynh</span>
          </div>
        </div>
        <form action="/api/auth/signout" method="POST" className="shrink-0">
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-xl"
            title="Đăng xuất"
            aria-label="Đăng xuất"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );

  // ---- Layout ----------------------------------------------------------

  return (
    <div className="min-h-screen flex bg-slate-950">
      <aside className="hidden md:flex flex-col sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 border-b border-slate-900 bg-slate-950/50 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-6">
          <div className="flex items-center gap-4 min-w-0">
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden text-slate-400 hover:bg-slate-900"
                    aria-label="Mở menu"
                  >
                    <Menu className="h-6 w-6" />
                  </Button>
                }
              />
              <SheetContent side="left" className="p-0 border-r-0 w-64 bg-slate-950">
                <SidebarContent />
              </SheetContent>
            </Sheet>

            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-200 truncate">
                {pathname === "/"
                  ? "Bảng điều khiển"
                  : menuItems.find((m) => pathname.startsWith(m.href) && m.href !== "/")?.label ||
                    "PID"}
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                Chào mừng bạn quay lại, đồng hành cùng con dễ dàng hơn với AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {childList.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-800 bg-slate-900/40 text-slate-200 hover:bg-slate-900"
                      aria-label="Chọn con đang xem"
                    >
                      <Avatar className="h-5 w-5 mr-2">
                        <AvatarFallback
                          style={{ backgroundColor: activeChild?.avatar_color ?? "#0f2554" }}
                          className="text-white text-[10px]"
                        >
                          {(activeChild?.full_name ?? "?").slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate max-w-[140px]">
                        {activeChild ? activeChild.full_name : "Chọn con"}
                      </span>
                      <ChevronDown className="h-3 w-3 ml-1.5" />
                    </Button>
                  }
                />
                <DropdownMenuContent
                  align="end"
                  className="bg-slate-950 border-slate-800 text-slate-200"
                >
                  <DropdownMenuLabel className="text-slate-500 text-[10px] uppercase tracking-wider">
                    Đang xem
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-800" />
                  {childList.map((c) => (
                    <DropdownMenuItem
                      key={c.id}
                      onClick={() => setSelectedChild(c.id)}
                      className={cn(
                        "flex items-center gap-2 cursor-pointer",
                        c.id === activeChild?.id && "bg-indigo-950/40 text-indigo-300",
                      )}
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarFallback
                          style={{ backgroundColor: c.avatar_color ?? "#0f2554" }}
                          className="text-white text-[10px]"
                        >
                          {c.full_name.slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{c.full_name}</span>
                      <span className="text-[10px] text-slate-500 ml-auto">
                        Lớp {c.grade ?? "—"}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator className="bg-slate-800" />
                  <Link
                    href="/settings"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "w-full justify-start text-slate-400",
                    )}
                  >
                    + Thêm con mới
                  </Link>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 bg-slate-950 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
