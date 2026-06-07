"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Info,
  ListChecks,
  Loader2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface AlertRow {
  id: string;
  child_id: string;
  type: "warning" | "success" | "info";
  title: string;
  description: string | null;
  is_read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  // Load my child ids first — alerts are joined via children RLS
  const childIdsQ = useQuery({
    queryKey: ["my-child-ids"],
    queryFn: async (): Promise<string[]> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("children").select("id").eq("parent_id", user.id);
      return (data ?? []).map((c) => c.id);
    },
    staleTime: 5 * 60_000,
  });

  const childIds = childIdsQ.data ?? [];

  // Latest 10 alerts
  const alertsQ = useQuery<AlertRow[]>({
    queryKey: ["alerts", childIds.join(",")],
    enabled: childIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("id, child_id, type, title, description, is_read, created_at")
        .in("child_id", childIds)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as AlertRow[];
    },
    staleTime: 30_000,
  });

  // Realtime subscribe to alerts INSERTs for my children
  useEffect(() => {
    if (childIds.length === 0) return;
    const channel = supabase
      .channel("alerts-stream")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alerts",
          filter: `child_id=in.(${childIds.join(",")})`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["alerts"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, qc, childIds]);

  const alerts = alertsQ.data ?? [];
  const unread = alerts.filter((a) => !a.is_read).length;

  async function markRead(id: string) {
    qc.setQueryData<AlertRow[]>(["alerts", childIds.join(",")], (prev) =>
      (prev ?? []).map((a) => (a.id === id ? { ...a, is_read: true } : a)),
    );
    await supabase.from("alerts").update({ is_read: true }).eq("id", id);
  }

  async function markAllRead() {
    const unreadIds = alerts.filter((a) => !a.is_read).map((a) => a.id);
    if (unreadIds.length === 0) return;
    qc.setQueryData<AlertRow[]>(["alerts", childIds.join(",")], (prev) =>
      (prev ?? []).map((a) => ({ ...a, is_read: true })),
    );
    await supabase.from("alerts").update({ is_read: true }).in("id", unreadIds);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Thông báo${unread > 0 ? ` (${unread} chưa đọc)` : ""}`}
            className="relative text-slate-300 hover:text-white hover:bg-slate-900"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-slate-950 tabular-nums"
                aria-hidden
              >
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
        }
      />
      <SheetContent
        side="right"
        className="w-full sm:w-[400px] bg-slate-950 border-slate-800 p-0 text-slate-100"
      >
        <SheetHeader className="px-5 py-4 border-b border-slate-900">
          <SheetTitle className="text-slate-100 flex items-center gap-2">
            <Bell className="h-4 w-4 text-indigo-400" /> Thông báo
            {unread > 0 && (
              <Badge className="bg-rose-600 text-white border-0">{unread} mới</Badge>
            )}
          </SheetTitle>
          {alerts.length > 0 && unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-indigo-400 hover:text-indigo-300 self-start flex items-center gap-1"
            >
              <ListChecks className="h-3 w-3" /> Đánh dấu tất cả đã đọc
            </button>
          )}
        </SheetHeader>

        <div className="overflow-y-auto h-[calc(100vh-5rem)]">
          {alertsQ.isLoading || childIdsQ.isLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-500 text-sm">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang tải…
            </div>
          ) : alerts.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="divide-y divide-slate-900 animate-slide-right-stagger">
              {alerts.map((alert) => (
                <AlertItem key={alert.id} alert={alert} onMarkRead={markRead} />
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 gap-2">
      <CheckCircle2 className="h-10 w-10 text-emerald-400" />
      <h3 className="text-sm font-semibold text-slate-200">Mọi thứ đang ổn!</h3>
      <p className="text-xs text-slate-500 max-w-[260px] leading-relaxed">
        Hiện không có cảnh báo nào. Khi AI phát hiện điểm bất thường hoặc dấu hiệu burnout, bạn sẽ
        thấy thông báo ở đây.
      </p>
    </div>
  );
}

function AlertItem({
  alert,
  onMarkRead,
}: {
  alert: AlertRow;
  onMarkRead: (id: string) => void;
}) {
  const variant = alert.type;
  const Icon =
    variant === "warning" ? AlertTriangle : variant === "success" ? Sparkles : Info;
  const iconColor =
    variant === "warning"
      ? "text-amber-400 bg-amber-500/15"
      : variant === "success"
        ? "text-emerald-400 bg-emerald-500/15"
        : "text-indigo-400 bg-indigo-500/15";

  const timeAgo = formatDistanceToNow(new Date(alert.created_at), {
    addSuffix: true,
    locale: vi,
  });

  return (
    <li>
      <button
        onClick={() => alert.is_read || onMarkRead(alert.id)}
        className={cn(
          "w-full text-left px-5 py-3 flex items-start gap-3 transition-colors group",
          alert.is_read ? "opacity-70 hover:opacity-90" : "hover:bg-slate-900/60",
        )}
      >
        <div className={cn("p-2 rounded-lg shrink-0", iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-100 leading-snug">{alert.title}</h4>
            {!alert.is_read && (
              <span
                className="h-2 w-2 rounded-full bg-indigo-400 mt-1.5 shrink-0"
                aria-label="Chưa đọc"
              />
            )}
          </div>
          {alert.description && (
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
              {alert.description}
            </p>
          )}
          <p className="text-[11px] text-slate-500">{timeAgo}</p>
        </div>
      </button>
    </li>
  );
}
