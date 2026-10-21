import { useEffect, useRef, useState } from "react";
import {
  MessageCircle, Send, Loader2, CheckCircle, XCircle, Clock,
} from "lucide-react";
import { DateTime } from "luxon";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

type ChatStatus = "open" | "resolved" | "closed";

interface Chat {
  id: string;
  subject: string;
  issue: string;
  status: ChatStatus;
  lang: string;
  created_at: string;
  user_id: string;
  profiles: { full_name: string | null; email: string | null } | null;
}

interface Message {
  id: string;
  body: string;
  is_support: boolean;
  sender_id: string;
  created_at: string;
}

const ISSUE_LABELS: Record<string, string> = {
  booking_problem:  "Booking",
  service_question: "Service Q",
  complaint:        "Complaint",
  technical_issue:  "Technical",
  other:            "Other",
};

const STATUS_STYLES: Record<ChatStatus, string> = {
  open:     "bg-amber-100 text-amber-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed:   "bg-slate-100 text-slate-600",
};

function formatTime(iso: string) {
  return DateTime.fromISO(iso).toFormat("HH:mm");
}

export default function SupportAdminPage() {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ChatStatus | "all">("open");
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [hasMore, setHasMore] = useState(false);

  const loadChats = async () => {
    setLoading(true);
    let q = supabase
      .from("support_chats")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (statusFilter !== "all") q = q.eq("status", statusFilter);

    q = q.range(page * pageSize, (page + 1) * pageSize);

    const { data, error } = await q;
    if (error) { toast.error(error.message); setLoading(false); return; }

    const d = data ?? [];
    let pageData = d;
    if (d.length > pageSize) {
      setHasMore(true);
      pageData = d.slice(0, pageSize);
    } else {
      setHasMore(false);
    }

    // fetch profiles separately
    const userIds = [...new Set(pageData.map((c: any) => c.user_id).filter(Boolean))];
    let profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      (profiles ?? []).forEach((p: any) => { profileMap[p.id] = p; });
    }

    const enriched = pageData.map((c: any) => ({
      ...c,
      profiles: profileMap[c.user_id] ?? null,
    }));
    setChats(enriched as unknown as Chat[]);
    setLoading(false);
  };

  useEffect(() => { setPage(0); }, [statusFilter]);

  useEffect(() => { loadChats(); }, [page, statusFilter]);

  // Realtime — new chats
  useEffect(() => {
    const channel = supabase
      .channel("admin_chats")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "support_chats",
      }, () => loadChats())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [statusFilter]);

  // Load messages for selected chat
  useEffect(() => {
    if (!selectedChat) return;
    setMessages([]);
    supabase
      .from("support_messages")
      .select("*")
      .eq("chat_id", selectedChat.id)
      .order("created_at")
      .then(({ data }) => setMessages((data ?? []) as Message[]));

    const channel = supabase
      .channel(`admin_chat_${selectedChat.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "support_messages",
        filter: `chat_id=eq.${selectedChat.id}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();

    // Clear unread
    setUnreadMap((m) => ({ ...m, [selectedChat.id]: 0 }));

    return () => { supabase.removeChannel(channel); };
  }, [selectedChat?.id]);

  // Track unread from any chat not currently selected
  useEffect(() => {
    const channel = supabase
      .channel("admin_unread")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "support_messages",
      }, (payload) => {
        const msg = payload.new as Message;
        if (!msg.is_support && msg.chat_id !== selectedChat?.id) {
          setUnreadMap((m) => ({ ...m, [msg.chat_id]: (m[msg.chat_id] ?? 0) + 1 }));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedChat?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!body.trim() || !selectedChat || !user) return;
    const msg = body.trim();
    setBody("");
    setSending(true);
    const { error } = await supabase.from("support_messages").insert({
      chat_id: selectedChat.id,
      sender_id: user.id,
      is_support: true,
      body: msg,
    });
    setSending(false);
    if (error) toast.error(error.message);
  };

  const setStatus = async (status: ChatStatus) => {
    if (!selectedChat) return;
    const { error } = await supabase
      .from("support_chats")
      .update({ status })
      .eq("id", selectedChat.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Chat marked as ${status}.`);
    setSelectedChat({ ...selectedChat, status });
    loadChats();
  };

  const openCount = chats.filter((c) => c.status === "open").length;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 overflow-hidden rounded-xl border bg-card">
      {/* Sidebar */}
      <div className="flex w-72 shrink-0 flex-col border-r">
        {/* Header */}
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Support Chats</h2>
            {openCount > 0 && (
              <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-white">
                {openCount}
              </span>
            )}
          </div>
          {/* Status filter */}
          <div className="mt-2 flex gap-1">
            {(["open", "resolved", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-4 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>}
          {!loading && chats.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <MessageCircle className="mx-auto h-8 w-8 mb-2 text-muted-foreground/30" />
              No {statusFilter !== "all" ? statusFilter : ""} chats.
            </div>
          )}
          {chats.map((c) => {
            const isSelected = selectedChat?.id === c.id;
            const unread = unreadMap[c.id] ?? 0;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedChat(c)}
                className={`w-full border-b px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                  isSelected ? "bg-muted" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <p className="text-sm font-medium text-foreground line-clamp-1">{c.profiles?.full_name || "(unnamed)"}</p>
                  <div className="flex shrink-0 items-center gap-1">
                    {unread > 0 && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">{unread}</span>
                    )}
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLES[c.status]}`}>
                      {c.status}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{c.subject}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="rounded bg-muted px-1">{ISSUE_LABELS[c.issue] ?? c.issue}</span>
                  <span>{c.lang.toUpperCase()}</span>
                  <span>{DateTime.fromISO(c.created_at).toRelative()}</span>
                </div>
              </button>
            );
          })}
        </div>
        {/* Pagination */}
        <div className="border-t p-2 flex items-center justify-between text-xs text-muted-foreground">
          <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span>Page {page + 1}</span>
          <Button size="sm" variant="ghost" disabled={!hasMore} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </div>

      {/* Chat panel */}
      <div className="flex flex-1 flex-col min-w-0">
        {!selectedChat ? (
          <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
            <MessageCircle className="h-12 w-12 mb-3 text-muted-foreground/20" />
            <p>Select a chat to start replying</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div>
                <p className="font-semibold text-foreground">{selectedChat.profiles?.full_name || "(unnamed)"}</p>
                <p className="text-xs text-muted-foreground">{selectedChat.profiles?.email} · {selectedChat.lang.toUpperCase()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[selectedChat.status]}`}>
                  {selectedChat.status}
                </span>
                {selectedChat.status === "open" && (
                  <Button size="sm" variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => setStatus("resolved")}>
                    <CheckCircle className="mr-1.5 h-3 w-3" /> Resolve
                  </Button>
                )}
                {selectedChat.status !== "closed" && (
                  <Button size="sm" variant="ghost" className="text-muted-foreground"
                    onClick={() => setStatus("closed")}>
                    <XCircle className="mr-1.5 h-3 w-3" /> Close
                  </Button>
                )}
              </div>
            </div>

            {/* Issue badge */}
            <div className="border-b px-5 py-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {DateTime.fromISO(selectedChat.created_at).toFormat("dd MMM yyyy, HH:mm")}
              <span className="rounded bg-muted px-1.5 py-0.5">{ISSUE_LABELS[selectedChat.issue]}</span>
              <span className="text-foreground font-medium">{selectedChat.subject}</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-2 p-4">
              {messages.map((m) => {
                const isSupport = m.is_support;
                return (
                  <div key={m.id} className={`flex ${isSupport ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                      isSupport
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "bg-muted text-foreground rounded-tl-none"
                    }`}>
                      {!isSupport && (
                        <p className="text-[10px] font-semibold mb-0.5 text-primary">
                          {selectedChat.profiles?.full_name || "Citizen"}
                        </p>
                      )}
                      <p>{m.body}</p>
                      <p className={`mt-0.5 text-[10px] ${isSupport ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {formatTime(m.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Reply input */}
            {selectedChat.status === "open" ? (
              <div className="border-t p-3 flex gap-2">
                <Input
                  placeholder="Reply to citizen…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
                  className="text-sm"
                />
                <Button size="icon" disabled={sending || !body.trim()} onClick={send}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <div className="border-t p-3 text-center text-xs text-muted-foreground">
                Chat is {selectedChat.status} — reopen to reply.
                {selectedChat.status !== "open" && (
                  <Button size="sm" variant="ghost" className="ml-2" onClick={() => setStatus("open")}>Reopen</Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
