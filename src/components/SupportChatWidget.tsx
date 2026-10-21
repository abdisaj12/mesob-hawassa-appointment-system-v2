import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

type ChatIssue = "booking_problem" | "service_question" | "complaint" | "technical_issue" | "other";
type Step = "closed" | "new" | "chat";

interface Message {
  id: string;
  body: string;
  is_support: boolean;
  created_at: string;
  sender_id: string;
  chat_id: string;
}

interface Chat {
  id: string;
  subject: string;
  issue: ChatIssue;
  status: string;
}

const ISSUES: { value: ChatIssue; key: string }[] = [
  { value: "booking_problem",  key: "chat_issue_booking" },
  { value: "service_question", key: "chat_issue_service" },
  { value: "complaint",        key: "chat_issue_complaint" },
  { value: "technical_issue",  key: "chat_issue_technical" },
  { value: "other",            key: "chat_issue_other" },
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function SupportChatWidget() {
  const { user, loading: authLoading } = useAuth();
  const { t, lang } = useLanguage();
  const isStaff = user?.role === "admin" || user?.role === "agent";

  const [step, setStep] = useState<Step>("closed");
  const [issue, setIssue] = useState<ChatIssue>("booking_problem");
  const [subject, setSubject] = useState("");
  const [starting, setStarting] = useState(false);
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || isStaff || step !== "closed") return;
    supabase
      .from("support_chats")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setChat(data[0] as Chat);
          setUnread(1);
        }
      });
  }, [user, isStaff]);

  useEffect(() => {
    if (!chat) return;
    supabase
      .from("support_messages")
      .select("*")
      .eq("chat_id", chat.id)
      .order("created_at")
      .then(({ data }) => setMessages((data ?? []) as Message[]));

    const channel = supabase
      .channel(`chat_${chat.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `chat_id=eq.${chat.id}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
        if (step === "closed") setUnread((n) => n + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chat?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startChat = async () => {
    if (!user) { toast.error(t("chat_sign_in_required")); return; }
    if (!subject.trim()) { toast.error(t("chat_desc_label")); return; }
    setStarting(true);
    const { data, error } = await supabase
      .from("support_chats")
      .insert({ user_id: user.id, issue, subject: subject.trim(), lang })
      .select()
      .single();
    setStarting(false);
    if (error) { toast.error(error.message); return; }
    setChat(data as Chat);
    setStep("chat");
    await supabase.from("support_messages").insert({
      chat_id: data.id,
      sender_id: user.id,
      is_support: false,
      body: subject.trim(),
    });
  };

  const send = async () => {
    if (!body.trim() || !chat || !user) return;
    const msg = body.trim();
    setBody("");
    setSending(true);
    const { error } = await supabase.from("support_messages").insert({
      chat_id: chat.id,
      sender_id: user.id,
      is_support: false,
      body: msg,
    });
    setSending(false);
    if (error) toast.error(error.message);
  };

  const openChat = () => {
    setUnread(0);
    setStep(chat ? "chat" : "new");
  };

  if (authLoading || isStaff) return null;

  const isResolved = chat?.status === "resolved" || chat?.status === "closed";

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {step !== "closed" && (
        <div className="flex h-[460px] w-80 flex-col rounded-2xl border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              {step === "chat" && (
                <button onClick={() => setStep("new")} className="mr-1 opacity-70 hover:opacity-100">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <MessageCircle className="h-4 w-4" />
              <span className="text-sm font-semibold">{t("chat_title")}</span>
            </div>
            <button onClick={() => setStep("closed")} className="opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>

          {step === "new" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <p className="text-sm text-muted-foreground">{t("chat_welcome")}</p>
              <div>
                <Label className="text-xs">{t("chat_issue_label")}</Label>
                <Select value={issue} onValueChange={(v) => setIssue(v as ChatIssue)}>
                  <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ISSUES.map((iss) => (
                      <SelectItem key={iss.value} value={iss.value}>
                        {t(iss.key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t("chat_desc_label")}</Label>
                <Textarea
                  className="mt-1 resize-none text-sm"
                  rows={3}
                  placeholder={t("chat_desc_placeholder")}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              {!user && (
                <p className="text-xs text-amber-600">{t("chat_sign_in_required")}</p>
              )}
              <Button className="w-full" disabled={starting || !subject.trim() || !user} onClick={startChat}>
                {starting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                {t("chat_start")}
              </Button>
            </div>
          )}

          {step === "chat" && (
            <>
              {isResolved && (
                <div className="bg-emerald-50 px-3 py-2 text-xs text-emerald-700 text-center border-b">
                  {t("chat_resolved")}
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <div className="flex justify-start">
                  <div className="rounded-xl rounded-tl-none bg-muted px-3 py-2 text-xs text-muted-foreground max-w-[80%]">
                    {t("chat_welcome")}
                  </div>
                </div>
                {messages.map((m) => {
                  const isMine = m.sender_id === user?.id && !m.is_support;
                  return (
                    <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                        isMine
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-muted text-foreground rounded-tl-none"
                      }`}>
                        {m.is_support && (
                          <p className="text-[10px] font-semibold text-primary mb-0.5">{t("chat_support")}</p>
                        )}
                        <p>{m.body}</p>
                        <p className={`mt-0.5 text-[10px] ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                          {formatTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              {!isResolved && (
                <div className="border-t p-3 flex gap-2">
                  <Input
                    className="text-sm"
                    placeholder={t("chat_type")}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
                  />
                  <Button size="icon" disabled={sending || !body.trim()} onClick={send}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <button
        onClick={step === "closed" ? openChat : () => setStep("closed")}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-all hover:scale-105 animate-bounce-in"
      >
        {step === "closed" ? (
          <>
            <MessageCircle className="h-6 w-6" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white animate-bounce">
                {unread}
              </span>
            )}
          </>
        ) : (
          <X className="h-6 w-6" />
        )}
      </button>
    </div>
  );
}
