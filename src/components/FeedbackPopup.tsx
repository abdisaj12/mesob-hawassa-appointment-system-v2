import { useEffect, useState } from "react";
import { Star, Loader2, X, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

interface PendingAppt {
  id: string;
  institution_id: string;
  service_id: string;
  services: { name: string } | null;
  institutions: { name: string } | null;
}

const STAR_LABELS: Record<number, { en: string; am: string }> = {
  1: { en: "Very poor",  am: "በጣም መጥፎ" },
  2: { en: "Poor",       am: "መጥፎ" },
  3: { en: "Average",    am: "መካከለኛ" },
  4: { en: "Good",       am: "ጥሩ" },
  5: { en: "Excellent",  am: "በጣም ጥሩ" },
};

const DISMISSED_KEY = "mesob-feedback-dismissed";

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function addDismissed(id: string) {
  try {
    const set = getDismissed();
    set.add(id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
  } catch {}
}

export default function FeedbackPopup() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  

  const [queue, setQueue] = useState<PendingAppt[]>([]);
  const [current, setCurrent] = useState<PendingAppt | null>(null);
  const [hovered, setHovered] = useState(0);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // On mount: find all served appointments without feedback, excluding dismissed ones
  useEffect(() => {
    if (!user || user.role === "admin" || user.role === "agent") return;

    const check = async () => {
      const dismissed = getDismissed();

      // Get all served appointments for this user
      const { data: appts } = await supabase
        .from("appointments")
        .select("id, institution_id, service_id, services(name), institutions(name)")
        .eq("user_id", user.id)
        .eq("status", "served");

      if (!appts || appts.length === 0) return;

      // Get already-rated appointment IDs
      const apptIds = appts.map((a: any) => a.id);
      const { data: existing } = await supabase
        .from("feedback")
        .select("appointment_id")
        .in("appointment_id", apptIds);

      const ratedIds = new Set((existing ?? []).map((f: any) => f.appointment_id));

      // Filter to unrated + not dismissed
      const pending = (appts as any[]).filter(
        (a) => !ratedIds.has(a.id) && !dismissed.has(a.id)
      ) as PendingAppt[];

      if (pending.length > 0) {
        setQueue(pending);
        setCurrent(pending[0]);
      }
    };

    // Small delay so the page renders first
    const timer = setTimeout(check, 1500);
    return () => clearTimeout(timer);
  }, [user]);

  const advance = () => {
    const next = queue.slice(1);
    setQueue(next);
    setCurrent(next[0] ?? null);
    setRating(0);
    setComment("");
    setHovered(0);
    setDone(false);
  };

  const dismiss = () => {
    if (current) addDismissed(current.id);
    advance();
  };

  const submit = async () => {
    if (!rating || !current || !user) return;
    setSaving(true);
    const { error } = await supabase.from("feedback").insert({
      appointment_id: current.id,
      user_id: user.id,
      institution_id: current.institution_id,
      service_id: current.service_id,
      rating,
      comment: comment.trim() || null,
    });
    setSaving(false);

    if (error && error.code !== "23505") {
      toast.error(error.message);
      return;
    }

    setDone(true);
    toast.success(t("feedback_thanks"));
    setTimeout(advance, 1400);
  };

  if (!current) return null;

  const active = hovered || rating;
  const remaining = queue.length;

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border bg-card shadow-2xl">
        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          {!done ? (
            <>
              {/* Header */}
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {t("How was your service?", "አገልግሎቱ እንዴት ነበር?")}
                </p>
                {remaining > 1 && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t(`${remaining} services to rate`, `${remaining} አገልግሎቶች ለመገምገም`)}
                  </p>
                )}
              </div>

              {/* Service info */}
              <div className="mb-5 rounded-lg bg-muted/50 px-4 py-3">
                <p className="font-semibold text-foreground">
                  {current.services?.name ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {current.institutions?.name ?? "—"}
                </p>
              </div>

              {/* Stars */}
              <div className="mb-2 flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHovered(n)}
                    onMouseLeave={() => setHovered(0)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-9 w-9 transition-colors ${
                        n <= active
                          ? "fill-amber-400 text-amber-400"
                          : "fill-transparent text-muted-foreground/40"
                      }`}
                    />
                  </button>
                ))}
              </div>
              {active > 0 && (
                <p className="mb-4 text-center text-sm font-medium text-foreground">
                  {STAR_LABELS[active][lang]}
                </p>
              )}

              {/* Comment */}
              <Textarea
                placeholder={t("Optional comment…", "አስተያየት (አማራጭ)…")}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                className="mb-4 resize-none text-sm"
              />

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground" onClick={dismiss}>
                  {t("feedback_skip")}
                </Button>
                <Button size="sm" className="flex-1" disabled={!rating || saving} onClick={submit}>
                  {saving
                    ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    : null}
                  {t("Submit rating", "ግምገማ አስገባ")}
                </Button>
              </div>
            </>
          ) : (
            // Thank-you state
            <div className="py-4 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
              <p className="mt-3 font-semibold text-foreground">
                {t("Thank you!", "አመሰግናለን!")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("Your feedback helps us improve.", "አስተያየትዎ አገልግሎታችንን ያሻሽለዋል።")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
