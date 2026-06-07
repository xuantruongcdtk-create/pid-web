"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ChevronRight,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  PlusSquare,
} from "lucide-react";

const teacherMenuItems = [
  { href: "/teacher", label: "Bảng điều khiển", icon: Home },
  { href: "/teacher/upload", label: "Tạo đề bằng AI", icon: PlusSquare },
];

export function TeacherShell({
  children,
  teacherName,
}: {
  children: React.ReactNode;
  teacherName?: string;
}) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/teacher" ? pathname === href : pathname.startsWith(href);

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 border-r border-slate-900 w-64">
      <div className="flex items-center gap-3 px-6 h-20 border-b border-slate-900">
        <div className="p-2 bg-gradient-to-tr from-emerald-600 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20">
          <GraduationCap className="h-6 w-6 text-white" />
        </div>
        <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-emerald-300 via-teal-300 to-indigo-300 bg-clip-text text-transparent">
          GV · PID
        </span>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {teacherMenuItems.map((item) => {
          const Active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 group ${
                Active
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/15 font-semibold"
                  : "text-slate-400 hover:bg-slate-900 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`h-5 w-5 transition-transform duration-300 ${
                    Active ? "scale-110" : "group-hover:scale-105"
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {Active && <ChevronRight className="h-4 w-4 opacity-80" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-10 w-10 ring-2 ring-slate-800 shrink-0">
            <AvatarImage src="" />
            <AvatarFallback>
              {(teacherName ?? "GV").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-slate-200 truncate">
              {teacherName ?? "Giáo viên"}
            </span>
            <span className="text-xs text-slate-500">Teacher Portal</span>
          </div>
        </div>
        <Link
          href="/"
          className="text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-xl h-9 w-9 inline-flex items-center justify-center shrink-0"
          title="Về phụ huynh dashboard"
        >
          <LogOut className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-950">
      <aside className="hidden md:flex flex-col sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 border-b border-slate-900 bg-slate-950/50 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden text-slate-400 hover:bg-slate-900"
                  >
                    <Menu className="h-6 w-6" />
                  </Button>
                }
              />
              <SheetContent side="left" className="p-0 border-r-0 w-64 bg-slate-950">
                <SidebarContent />
              </SheetContent>
            </Sheet>

            <div>
              <h1 className="text-lg font-bold text-slate-200">
                {pathname === "/teacher"
                  ? "Bảng quản lý Giáo viên"
                  : teacherMenuItems.find(
                      (m) => pathname.startsWith(m.href) && m.href !== "/teacher",
                    )?.label || "Cổng Giáo viên"}
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                Tạo, chia sẻ và theo dõi đề kiểm tra cho lớp của bạn
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 bg-slate-950 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
