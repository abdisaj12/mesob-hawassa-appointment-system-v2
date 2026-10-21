import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { DateTime } from "luxon";
import { Loader2, ArrowLeft, Calendar, XCircle, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import BrandHeader from "@/components/BrandHeader";
import FeedbackWidget from "@/components/FeedbackWidget";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

type Status = "pending" | "served" | "no_show" | "cancelled";

interface AppointmentRow {
  id: string;
  reference: string;
  appointment_date: string;
  slot_window: "AM" | "PM";
  queue_number: number;
  status: Status;
  institution_id: string;
  service_id: string;
  institutions: { name: string } | null;
  services: { name: string } | null;
}

const STATUS_STYLES: Record<Status, string> = {
  pending:   "bg-amber-100 text-amber-800 border-amber-200",
  served:    "bg-emerald-100 text-emerald-800 border-emerald-200",
  no_show:   "bg-slate-100 text-slate-700 border-slate-200",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200",
};

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [appts, setAppts] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  // track which appointments already have feedback submitted this session
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set());
  const [existingFeedback, setExistingFeedback] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const [apptsRes, feedbackRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, reference, appointment_date, slot_window, queue_number, status, institution_id, service_id, institutions(name), services(name)")
        .eq("user_id", user.id)
        .order("appointment_date", { ascending: false })
        .order("slot_window"),
      supabase
        .from("feedback")
        .select("appointment_id")
        .eq("user_id", user.id),
    ]);
    setLoading(false);
    if (apptsRes.error) { toast.error(apptsRes.error.message); return; }
    setAppts((apptsRes.data ?? []) as unknown as AppointmentRow[]);
    const alreadyRated = new Set((feedbackRes.data ?? []).map((f: any) => f.appointment_id));
    setExistingFeedback(alreadyRated);
  };

  useEffect(() => { if (!authLoading) load(); }, [user, authLoading]);

  const cancel = async (id: string) => {
    setCancellingId(id);
    const { error } = await supabase.rpc("cancel_own_appointment", { _appointment_id: id });
    setCancellingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(lang === "am" ? "ቀጠሮ ተሰርዟል።" : "Appointment cancelled.");
    setAppts((prev) => prev.map((a) => a.id === id ? { ...a, status: "cancelled" } : a));
  };

  const { lang } = useLanguage();

  const statusLabel = (s: Status) => t(`status_${s}`);

  const needsFeedback = (a: AppointmentRow) =>
    a.status === "served" && !existingFeedback.has(a.id) && !ratedIds.has(a.id);

  return (
    <div className="min-h-screen bg-muted/40">
      <BrandHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t("nav_home")}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t("history_title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("history_subtitle")}</p>

        {authLoading || loading ? (
          <div className="mt-10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !user ? (
          <div className="mt-10 rounded-xl border bg-card p-8 text-center">
            <p className="text-muted-foreground">{lang === "am" ? "ቀጠሮዎችዎን ለማየት ይግቡ።" : "Please sign in to view your appointments."}</p>
            <Link to="/login" className="mt-4 inline-block"><Button>{t("nav_sign_in")}</Button></Link>
          </div>
        ) : appts.length === 0 ? (
          <div className="mt-10 rounded-xl border bg-card p-8 text-center">
            <Inbox className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-muted-foreground">{t("history_empty")}</p>
            <Link to="/book" className="mt-4 inline-block"><Button>{t("history_book_now")}</Button></Link>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {appts.map((a) => (
              <div key={a.id} className="rounded-xl border bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-bold text-foreground break-all">{a.reference}</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{a.services?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{a.institutions?.name ?? "—"}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${STATUS_STYLES[a.status]}`}>
                    {statusLabel(a.status)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {DateTime.fromISO(a.appointment_date).toFormat("DDD")}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                    {a.slot_window === "AM" ? "☀ AM" : "🌙 PM"}
                  </span>
                  <span>#{a.queue_number}</span>
                </div>

                {/* Cancel button for pending */}
                {a.status === "pending" && (
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm" variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={cancellingId === a.id}
                      onClick={() => cancel(a.id)}
                    >
                      {cancellingId === a.id
                        ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                        : <XCircle className="mr-1.5 h-3 w-3" />}
                      {t("history_cancel")}
                    </Button>
                  </div>
                )}

                {/* Feedback for served appointments */}
                {needsFeedback(a) && (
                  <FeedbackWidget
                    appointmentId={a.id}
                    institutionId={a.institution_id}
                    serviceId={a.service_id}
                    serviceName={a.services?.name ?? "service"}
                    onDone={() => setRatedIds((prev) => new Set([...prev, a.id]))}
                  />
                )}
                {a.status === "served" && (existingFeedback.has(a.id) || ratedIds.has(a.id)) && (
                  <p className="mt-2 text-xs text-emerald-600">
                    {lang === "am" ? "✓ አስተያየት ቀርቧል" : "✓ Feedback submitted"}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
