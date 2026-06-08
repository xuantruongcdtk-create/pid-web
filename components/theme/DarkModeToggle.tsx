"use client";

import React from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Monitor } from "lucide-react";

export function DarkModeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // While next-themes hydrates we'd otherwise see a flash; render a stable
  // placeholder.
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Đổi giao diện"
        className="text-slate-300 hover:bg-slate-900"
      >
        <Sun className="h-5 w-5" />
      </Button>
    );
  }

  const current = theme === "system" ? "system" : (resolvedTheme ?? "dark");

  function cycle() {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycle}
      aria-label={
        current === "light"
          ? "Đổi sang chế độ tối"
          : current === "dark"
            ? "Đổi sang chế độ hệ thống"
            : "Đổi sang chế độ sáng"
      }
      title={`Hiện đang: ${current === "light" ? "Sáng" : current === "dark" ? "Tối" : "Hệ thống"}`}
      className="text-slate-300 hover:bg-slate-900"
    >
      {theme === "light" && <Sun className="h-5 w-5" />}
      {theme === "dark" && <Moon className="h-5 w-5" />}
      {theme === "system" && <Monitor className="h-5 w-5" />}
    </Button>
  );
}
