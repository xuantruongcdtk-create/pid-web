"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  Loader2,
  Send,
  Sparkles,
  User,
  Wand2,
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  HeartHandshake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useChildStore } from "@/store/useChildStore";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestions?: string[]; // parsed from <!--SUGGESTIONS:[]--> trailer
  ts: number;
}

interface ChildRow {
  id: string;
  full_name: string;
  grade: string | null;
  avatar_color: string | null;
}

const QUICK_PROMPTS = [
  {
    icon: TrendingUp,
    label: "Tóm tắt tiến độ tuần này",
    prompt: "Tuần này con tiến bộ ở môn nào, cần chú ý môn nào? Tóm tắt ngắn gọn.",
  },
  {
    icon: AlertTriangle,
    label: "Dấu hiệu burnout?",
    prompt: "Con có dấu hiệu burnout không? Tôi nên làm gì để hỗ trợ?",
  },
  {
    icon: Lightbulb,
    label: "Kế hoạch ôn tập cuối tuần",
    prompt: "Gợi ý kế hoạch ôn tập cuối tuần cho con dựa trên điểm hiện tại.",
  },
  {
    icon: HeartHandshake,
    label: "Cách nói chuyện với con",
    prompt: "Tôi nên nói chuyện thế nào với con khi điểm môn Toán giảm?",
  },
];

const SUGGESTION_REGEX = /<!--SUGGESTIONS:(\[[\s\S]*?\])-->/;

function parseSuggestions(raw: string): { clean: string; suggestions: string[] } {
  const match = raw.match(SUGGESTION_REGEX);
  if (!match) return { clean: raw.trim(), suggestions: [] };
  let suggestions: string[] = [];
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed)) suggestions = parsed.filter((x) => typeof x === "string").slice(0, 4);
  } catch {
    /* ignore */
  }
  return { clean: raw.replace(SUGGESTION_REGEX, "").trim(), suggestions };
}

export default function AiCoachPage() {
  const supabase = useMemo(() => createClient(), []);
  const selectedChildId = useChildStore((s) => s.selectedChildId);
  const setSelectedChild = useChildStore((s) => s.setSelectedChild);

  const childrenQ = useQuery({
    queryKey: ["children-list"],
    queryFn: async (): Promise<ChildRow[]> => {
      const { data } = await supabase
        .from("children")
        .select("id, full_name, grade, avatar_color")
        .order("created_at", { ascending: true });
      return (data ?? []) as ChildRow[];
    },
    staleTime: 60_000,
  });

  const children = childrenQ.data ?? [];
  // Auto-select first child on first load
  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      setSelectedChild(children[0].id);
    }
  }, [selectedChildId, children, setSelectedChild]);

  const activeChild = children.find((c) => c.id === selectedChildId) ?? null;

  // ---- Chat state ------------------------------------------------------

  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: "greet",
      role: "assistant",
      content:
        "Xin chào! Tôi là AI Coach của PID. Tôi sẽ tư vấn dựa trên điểm số, Learning DNA và mood của con. Hỏi tôi bất cứ điều gì về việc đồng hành cùng con nhé.",
      ts: Date.now(),
      suggestions: QUICK_PROMPTS.slice(0, 2).map((p) => p.prompt),
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [aiConfiguredNotice, setAiConfiguredNotice] = useState<boolean | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  // Reset conversation when child changes
  useEffect(() => {
    setConversationId(null);
  }, [selectedChildId]);

  // ---- Send -------------------------------------------------------------

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
        ts: Date.now(),
      };
      const assistantId = `a-${Date.now()}`;
      const assistantStub: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        ts: Date.now(),
      };

      // Drop any leftover suggestion pills from prior turns
      setMessages((prev) => {
        const cleared = prev.map((m) =>
          m.role === "assistant" ? { ...m, suggestions: undefined } : m,
        );
        return [...cleared, userMsg, assistantStub];
      });
      setInput("");
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/ai/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            messages: [...messages, userMsg]
              .filter((m) => m.id !== "greet")
              .map((m) => ({ role: m.role, content: m.content })),
            childId: selectedChildId,
            conversationId,
          }),
        });

        if (!res.ok) {
          let errMsg = `Lỗi ${res.status}`;
          try {
            const j = await res.json();
            errMsg = j.message ?? j.error ?? errMsg;
          } catch {
            /* ignore */
          }
          throw new Error(errMsg);
        }
        const convHeader = res.headers.get("X-Conversation-Id");
        if (convHeader) setConversationId(convHeader);
        const aiConfHeader = res.headers.get("X-Ai-Configured");
        if (aiConfHeader === "false") setAiConfiguredNotice(false);
        else if (aiConfHeader === "true") setAiConfiguredNotice(true);

        const reader = res.body?.getReader();
        if (!reader) throw new Error("Không nhận được luồng dữ liệu");
        const decoder = new TextDecoder();
        let acc = "";

        // Read incrementally; update message content as new bytes arrive
        // and parse suggestions on completion.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          const { clean } = parseSuggestions(acc);
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: clean } : m)),
          );
        }
        // Final flush
        acc += decoder.decode();
        const { clean, suggestions } = parseSuggestions(acc);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: clean, suggestions } : m,
          ),
        );
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        toast.error(err?.message ?? "Lỗi khi gọi AI Coach");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: m.content || "Xin lỗi, không lấy được phản hồi. Hãy thử lại sau.",
                }
              : m,
          ),
        );
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, selectedChildId, conversationId, streaming],
  );

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // ---- UI ---------------------------------------------------------------

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col bg-slate-950/20 border border-slate-900 rounded-2xl overflow-hidden backdrop-blur-sm animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-slate-900 bg-slate-950/40 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl text-white shrink-0">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-slate-200 text-sm md:text-base truncate">
              AI Coach học tập
            </h4>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>Sẵn sàng tư vấn 24/7</span>
            </div>
          </div>
        </div>

        <ChildSwitcher
          children={children}
          active={activeChild}
          onSelect={(id) => setSelectedChild(id)}
        />
      </div>

      {aiConfiguredNotice === false && (
        <div className="px-4 py-2 bg-amber-950/40 border-b border-amber-900/60 text-amber-300 text-xs flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          Đang dùng dữ liệu mẫu — chưa cấu hình ANTHROPIC_API_KEY hợp lệ.
        </div>
      )}

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <div className="p-4 border-b border-slate-900 bg-slate-950/20 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {QUICK_PROMPTS.map((qp) => {
            const Icon = qp.icon;
            return (
              <button
                key={qp.label}
                onClick={() => sendMessage(qp.prompt)}
                className="flex items-start gap-2 p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-left hover:border-indigo-500/50 hover:bg-slate-900 transition-colors"
              >
                <Icon className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <div className="font-semibold text-slate-200">{qp.label}</div>
                  <div className="text-slate-500 line-clamp-2">{qp.prompt}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/10">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onSuggestion={(s) => sendMessage(s)}
            isStreaming={streaming && msg.role === "assistant" && msg.id === messages[messages.length - 1]?.id}
          />
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="p-4 border-t border-slate-900 bg-slate-950/40"
      >
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-850 rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-indigo-600 focus-within:border-transparent transition-all">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              activeChild
                ? `Hỏi AI Coach về ${activeChild.full_name}…`
                : "Hỏi AI Coach về việc đồng hành cùng con…"
            }
            disabled={streaming}
            className="flex-1 bg-transparent border-0 text-slate-200 placeholder:text-slate-600 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {streaming ? (
            <Button
              type="button"
              variant="ghost"
              onClick={cancelStream}
              className="text-slate-300 hover:text-white"
              size="sm"
            >
              Dừng
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg h-9 w-9"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

// ----------------------------------------------------------------------------

function MessageBubble({
  msg,
  onSuggestion,
  isStreaming,
}: {
  msg: Message;
  onSuggestion: (s: string) => void;
  isStreaming: boolean;
}) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex items-start gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <Avatar className="h-8 w-8 ring-1 ring-slate-800 shrink-0">
          <AvatarFallback className="bg-gradient-to-tr from-indigo-600 to-purple-600 text-white text-xs">
            <Wand2 className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
      <div className="flex flex-col space-y-1 max-w-[85%] min-w-0">
        <div
          className={cn(
            "p-4 rounded-2xl text-sm leading-relaxed border whitespace-pre-line break-words",
            isUser
              ? "bg-indigo-600 border-indigo-500 text-white rounded-tr-none"
              : "bg-slate-900/60 border-slate-900 text-slate-200 rounded-tl-none",
          )}
        >
          {msg.content || (isStreaming ? "…" : "")}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-slate-300/70 align-text-bottom ml-1 animate-pulse" />
          )}
        </div>
        {!isUser && msg.suggestions && msg.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {msg.suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => onSuggestion(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <Avatar className="h-8 w-8 ring-1 ring-slate-800 shrink-0">
          <AvatarFallback className="bg-slate-800 text-slate-300">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

function ChildSwitcher({
  children,
  active,
  onSelect,
}: {
  children: ChildRow[];
  active: ChildRow | null;
  onSelect: (id: string) => void;
}) {
  if (children.length === 0) {
    return (
      <Badge className="bg-amber-950 border-amber-900 text-amber-400 text-[10px]">
        Chưa có hồ sơ con
      </Badge>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="border-slate-800 bg-slate-950/50 text-slate-200 hover:bg-slate-900"
          >
            <Avatar className="h-5 w-5 mr-2">
              <AvatarFallback
                style={{ backgroundColor: active?.avatar_color ?? "#0f2554" }}
                className="text-white text-[10px]"
              >
                {(active?.full_name ?? "?").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate max-w-[120px]">
              {active ? active.full_name : "Chọn con"}
            </span>
            <ChevronDown className="h-3 w-3 ml-1.5" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="bg-slate-950 border-slate-800 text-slate-200">
        <DropdownMenuLabel className="text-slate-500 text-[10px] uppercase tracking-wider">
          Tư vấn cho
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-800" />
        {children.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              "flex items-center gap-2 cursor-pointer",
              c.id === active?.id && "bg-indigo-950/40 text-indigo-300",
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
            <span className="text-[10px] text-slate-500 ml-auto">Lớp {c.grade ?? "—"}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
