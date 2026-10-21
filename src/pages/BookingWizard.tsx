import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Printer, RotateCcw, ArrowLeft, ArrowRight,
  Calendar, Loader2, Sun, Moon, LogIn, CheckCircle2, Circle, Copy
} from "lucide-react";
import StepIndicator from "@/components/StepIndicator";
import BrandHeader from "@/components/BrandHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { generateBookingQR } from "@/lib/qrcode";
import { cn } from "@/lib/utils";

const STEPS_EN = ["Services", "Date & Window", "Your Info", "Confirmation"];
const STEPS_AM = ["አገልግሎቶች", "ቀን እና ክፍለ ጊዜ", "መረጃዎ", "ማረጋገጫ"];

interface Institution { id: string; code: string; name: string; name_am?: string | null; }
interface Service { name_am?: string | null;
  id: string; institution_id: string; name: string;
  description: string | null; estimated_duration_min: number;
  am_capacity: number; pm_capacity: number;
}
interface BookingResult {
  reference: string;
  queue_number: number;
  slot_window: "AM" | "PM";
  appointment_date: string;
  service_name: string;
  full_name: string;
}

type Win = "AM" | "PM";

async function downloadSlip(confs: Array<{
  reference: string; queue_number: number; slot_window: string;
  service_name?: string; appointment_date: string; full_name?: string;
}>) {
  const rows = (await Promise.all(confs.map(async (conf) => {
    const qr = await generateBookingQR(conf.reference);
    const d = new Date(conf.appointment_date).toLocaleDateString("en-GB", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const w = conf.slot_window === "AM" ? "Morning - 9:00 to 12:00" : "Afternoon - 1:00 to 5:00";
    return "<div style='margin-bottom:24px;text-align:center'>"
      + "<img src='" + qr + "' style='width:120px;height:120px;margin:0 auto 12px'/>"
      + "<p style='font-size:10px;text-transform:uppercase;color:#999;margin:0 0 4px'>Reference</p>"
      + "<p style='font-family:monospace;font-size:13px;font-weight:bold;background:#f3f4f6;padding:8px 12px;border-radius:6px;word-break:break-all;margin:0 0 12px'>" + conf.reference + "</p>"
      + "<div style='text-align:center;background:#1a2f6e;color:white;border-radius:12px;padding:16px;margin:12px 0'>"
      + "<p style='font-size:11px;opacity:.8;margin:0'>Queue Number</p>"
      + "<p style='font-size:52px;font-weight:bold;line-height:1;margin:4px 0'>#" + conf.queue_number + "</p>"
      + "<p style='font-size:11px;opacity:.8;margin:0'>" + w + "</p>"
      + "</div>"
      + "<p style='font-size:10px;text-transform:uppercase;color:#999;margin:0 0 2px'>Service</p>"
      + "<p style='font-size:15px;font-weight:600;margin:0 0 10px'>" + (conf.service_name ?? "") + "</p>"
      + "<p style='font-size:10px;text-transform:uppercase;color:#999;margin:0 0 2px'>Date</p>"
      + "<p style='font-size:15px;font-weight:600;margin:0 0 10px'>" + d + "</p>"
      + "<p style='font-size:10px;text-transform:uppercase;color:#999;margin:0 0 2px'>Name</p>"
      + "<p style='font-size:15px;font-weight:600;margin:0'>" + (conf.full_name ?? "") + "</p>"
      + "<hr style='border:none;border-top:2px dashed #ddd;margin:16px 0'/>"
      + "</div>";
  }))).join("");

  const html = "<!DOCTYPE html><html><head>"
    + "<meta charset='utf-8'/>"
    + "<meta name='viewport' content='width=device-width,initial-scale=1'/>"
    + "<title>Appointment Slip</title></head>"
    + "<body style='font-family:Arial,sans-serif;padding:24px;max-width:400px;margin:0 auto;color:#111'>"
    + "<div style='text-align:center;margin-bottom:20px'>"
    + "<p style='font-size:22px;font-weight:bold;color:#1a2f6e;margin:0'>MESOB Hawassa</p>"
    + "<p style='font-size:12px;color:#666;margin:4px 0 0'>Government Service Appointment</p>"
    + "</div>"
    + "<hr style='border:none;border-top:2px dashed #ddd;margin:16px 0'/>"
    + rows
    + "<p style='text-align:center;font-size:11px;color:#999;margin-top:8px'>"
    + "Please arrive 10 minutes before your window.<br/>Keep this slip for verification at the office."
    + "</p></body></html>";

  const win = window.open("", "_blank");
  if (!win) { alert("Please allow popups to download the slip."); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}


// Helper to get localized name
function n(item: { name: string; name_am?: string | null } | undefined, lang: string): string {
  if (!item) return "";
  return (lang === "am" && item.name_am) ? item.name_am : item.name;
}

export default function BookingWizard() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [step, setStep] = useState(0);

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [instId, setInstId] = useState<string>("");
  // Multi-select: a Set of selected service IDs
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [date, setDate] = useState("");
  const [availability, setAvailability] = useState<Record<string, { am: number; pm: number }>>({});
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [win, setWin] = useState<Win | "">("");

  const [form, setForm] = useState({ full_name: "", phone: "", national_id: "" });
  const [submitting, setSubmitting] = useState(false);
  // One result per service booked
  const [confirmations, setConfirmations] = useState<BookingResult[]>([]);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (confirmations.length === 0) return;
    (async () => {
      const entries = await Promise.all(
        confirmations.map(async (c) => [c.reference, await generateBookingQR(c.reference)] as const)
      );
      setQrCodes(Object.fromEntries(entries));
    })();
  }, [confirmations]);

  useEffect(() => {
    supabase.from("institutions").select("id, code, name, name_am").eq("active", true).order("name")
      .then(({ data }: any) => setInstitutions((data ?? []) as Institution[]));
    supabase.from("services").select("*, name_am").eq("active", true).order("name")
      .then(({ data }: any) => setServices((data ?? []) as Service[]));
  }, []);

  useEffect(() => {
    if (user) {
      setForm((f) => ({
        full_name: f.full_name || user.full_name || "",
        phone: f.phone,
        national_id: f.national_id,
      }));
    }
  }, [user]);

  // Fetch slot availability whenever date or selected services change
  useEffect(() => {
    if (!date || !instId || selectedIds.size === 0) { setAvailability({}); return; }
    setLoadingAvail(true);
    (supabase as any).rpc("get_slot_availability", {
      _institution_id: instId,
      _service_ids: Array.from(selectedIds),
      _date: date,
    }).then(({ data }: any) => {
      const map: Record<string, { am: number; pm: number }> = {};
      (data ?? []).forEach((r: any) => {
        map[r.service_id] = { am: r.am_available, pm: r.pm_available };
      });
      setAvailability(map);
      setLoadingAvail(false);
    });
  }, [date, instId, JSON.stringify(Array.from(selectedIds).sort())]);

  const minDate = DateTime.now().setZone("Africa/Addis_Ababa").toISODate()!;
  const maxDate = DateTime.now().setZone("Africa/Addis_Ababa").plus({ days: 14 }).toISODate()!;

  const instServices = useMemo(
    () => services.filter((s) => s.institution_id === instId),
    [services, instId]
  );

  const selectedServices = useMemo(
    () => instServices.filter((s) => selectedIds.has(s.id)),
    [instServices, selectedIds]
  );

  const toggleService = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const changeInstitution = (id: string) => {
    setInstId(id);
    setSelectedIds(new Set()); // clear selections when institution changes
  };

  const canNext = () => {
    if (step === 0) return !!instId && selectedIds.size > 0;
    if (step === 1) return !!date && !!win;
    if (step === 2)
      return (
        form.full_name.trim().length >= 2 &&
        /^\+?\d[\d\s-]{7,}$/.test(form.phone.trim()) &&
        form.national_id.trim().length >= 4
      );
    return true;
  };

  const submit = async () => {
    if (!user) {
      toast.error("Please sign in to confirm your booking.");
      return;
    }
    setSubmitting(true);

    try {
      const rpcAny: any = supabase;
      const { data, error } = await rpcAny.rpc("book_multiple_appointments", {
        _institution_id: instId,
        _service_ids: Array.from(selectedIds),
        _full_name: form.full_name.trim(),
        _phone: form.phone.trim(),
        _national_id: form.national_id.trim(),
        _date: date,
        _window: win as Win,
      });

      if (error) throw error;

      const results: BookingResult[] = (Array.isArray(data) ? data : []).map((d: any) => ({
        reference: d.reference,
        queue_number: d.queue_number,
        slot_window: d.slot_window,
        appointment_date: d.appointment_date,
        service_name: n(selectedServices.find(s => s.id === d.service_id), lang) || "Service",
        full_name: d.full_name,
      }));

      setConfirmations(results);
      setStep(3);
    } catch (err: any) {
      toast.error(`Booking failed: ${err?.message || "Please try again."}`);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep(0);
    setInstId("");
    setSelectedIds(new Set());
    setDate("");
    setWin("");
    setForm({ full_name: user?.full_name || "", phone: "", national_id: "" });
    setConfirmations([]);
  };

  // Total estimated time across selected services
  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.estimated_duration_min, 0),
    [selectedServices]
  );

  return (
    <div className="min-h-screen bg-muted/40">
      <BrandHeader />

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {t("nav_book")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {lang === "am" ? "አንድ ወይም ከዚያ በላይ አገልግሎቶችን ይምረጡ — ለእያንዳንዱ የወረፋ ቁጥር ይሰጥዎታል።" : "Select one or more services — you'll get a separate queue number for each."}
          </p>
        </div>

        <div className="mb-8 rounded-xl border bg-card p-4 sm:p-6">
          <StepIndicator steps={lang === "am" ? STEPS_AM : STEPS_EN} current={step} />
        </div>

        <div className="rounded-xl border bg-card p-4 sm:p-6">

          {/* ── Step 0: Institution + multi-service select ── */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {t("book_step1_title")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {lang === "am" ? "ቢሮ ይምረጡ፣ ከዚያም ዛሬ የሚፈልጓቸውን አገልግሎቶች ሁሉ ይምረጡ።" : "Pick a bureau, then select all the services you need today."}
                </p>
              </div>

              {/* Institution picker */}
              <div className="max-w-sm">
                <Label>{t("common_institution")}</Label>
                <Select value={instId} onValueChange={changeInstitution}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={lang === "am" ? "ተቋም ይምረጡ…" : "Select an institution…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {institutions.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{n(i, lang)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Service checkboxes */}
              {instId && (
                <div className="space-y-2">
                  <Label>
                    {t("book_services_title")}
                    {selectedIds.size > 0 && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {selectedIds.size} selected
                      </span>
                    )}
                  </Label>

                  {instServices.length === 0 && (
                    <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                      No active services at this institution.
                    </p>
                  )}

                  <div className="grid gap-2 sm:grid-cols-2">
                    {instServices.map((svc) => {
                      const checked = selectedIds.has(svc.id);
                      return (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => toggleService(svc.id)}
                          className={cn(
                            "flex items-start gap-3 rounded-xl border p-4 text-left transition-all",
                            checked
                              ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                              : "border-border hover:border-primary/40 hover:bg-muted/30"
                          )}
                        >
                          {checked
                            ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                            : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/40" />
                          }
                          <div className="min-w-0">
                            <p className={cn(
                              "font-medium leading-snug",
                              checked ? "text-primary" : "text-foreground"
                            )}>
                              {n(svc, lang)}
                            </p>
                            {svc.description && (
                              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                                {svc.description}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground">
                              ~{svc.estimated_duration_min} min
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Summary of selected */}
              {selectedIds.size > 0 && (
                <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                  <p className="font-medium text-foreground">
                    {selectedIds.size} service{selectedIds.size > 1 ? "s" : ""} selected
                    · ~{totalDuration} min total
                  </p>
                  <ul className="mt-1.5 space-y-0.5">
                    {selectedServices.map((s) => (
                      <li key={s.id} className="text-muted-foreground flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-primary inline-block" />
                        {n(s, lang)}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    You'll receive a separate queue number for each service.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Step 1: Date + window ── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {t("book_step2_title")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {lang === "am" ? "በሚቀጥሉት 14 ቀናት ውስጥ ማንኛውም ቀን ይምረጡ። ለእያንዳንዱ አገልግሎት የወረፋ ቁጥር ይሰጥዎታል።" : "Choose any day in the next 14 days. You'll be assigned a queue number per service."}
                  number per service — no exact time needed.
                </p>
              </div>
              <div className="max-w-sm">
                <Label htmlFor="date">{t("book_date")}</Label>
                <div className="relative mt-1">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="date" type="date" min={minDate} max={maxDate}
                    value={date} onChange={(e) => setDate(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <Label>{lang === "am" ? "ክፍለ ጊዜ" : "Window"}</Label>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {[
                    { v: "AM" as Win, label: lang === "am" ? "ጠዋት" : "Morning", time: lang === "am" ? "ከጠዋቱ 3:00 – 6:00" : "9:00 – 12:00", Icon: Sun },
                    { v: "PM" as Win, label: lang === "am" ? "ከሰዓት" : "Afternoon", time: lang === "am" ? "ከሰዓቱ 7:00 – 11:00" : "1:00 – 5:00", Icon: Moon },
                  ].map(({ v, label, time, Icon }) => {
                    // Calculate minimum available slots across all selected services for this window
                    const minAvail = selectedIds.size === 0 ? null
                      : Math.min(...Array.from(selectedIds).map(id =>
                          availability[id]?.[v.toLowerCase() as "am" | "pm"] ?? 999
                        ));
                    const isFull = minAvail !== null && minAvail === 0;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => !isFull && setWin(v)}
                        disabled={isFull}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border p-4 text-left transition-all",
                          isFull
                            ? "border-border opacity-50 cursor-not-allowed bg-muted"
                            : win === v
                              ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                              : "border-border hover:border-primary/50"
                        )}
                      >
                        <Icon className={cn("h-6 w-6", win === v ? "text-primary" : "text-muted-foreground")} />
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{label}</p>
                          <p className="text-xs text-muted-foreground">{time}</p>
                        </div>
                        {loadingAvail && date ? (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        ) : minAvail !== null && (
                          <span className={cn(
                            "text-xs font-semibold rounded-full px-2 py-0.5",
                            isFull
                              ? "bg-destructive/10 text-destructive"
                              : minAvail <= 5
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                          )}>
                            {isFull ? t("book_full") : `${minAvail} ${t("book_slots_left")}`}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Personal details ── */}
          {step === 2 && (
            <div className="max-w-lg space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{t("book_step3_title")}</h2>
                <p className="text-sm text-muted-foreground">
                  {lang === "am" ? "እነዚህ መረጃዎች በቢሮ ለመለየት ያገለግላሉ።" : "We use these to identify you at the office."}
                </p>
              </div>
              {!user && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-accent bg-accent/10 p-3 text-sm">
                  <span className="text-accent-foreground">
                    {lang === "am" ? "ቀጠሮዎን ለማረጋገጥ መለያ ያስፈልጎታል።" : "You need an account to confirm your booking."}
                  </span>
                  <Link to="/login">
                    <Button size="sm">
                      <LogIn className="mr-1.5 h-4 w-4" /> {t("nav_sign_in")}
                    </Button>
                  </Link>
                </div>
              )}
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="name">{t("auth_full_name")}</Label>
                  <Input
                    id="name" value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder={lang === "am" ? "ለምሳሌ፡ አበበ በቀለ" : "e.g. Abebe Bekele"}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">{t("auth_phone")}</Label>
                  <Input
                    type="tel"
                    id="phone" value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+251 9XX XXX XXX"
                  />
                </div>
                <div>
                  <Label htmlFor="nid">{t("auth_national_id")}</Label>
                  <Input
                    id="nid" value={form.national_id}
                    onChange={(e) => setForm({ ...form, national_id: e.target.value })}
                    placeholder={lang === "am" ? "FAN / የመታወቂያ ቁጥር" : "FAN / National ID number"}
                  />
                </div>
              </div>

              {/* Booking summary before confirming */}
              <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
                <p className="font-medium text-foreground">{t("book_summary")}</p>
                <p className="text-muted-foreground">
                  {DateTime.fromISO(date).toFormat("DDDD")} · {win === "AM" ? (lang === "am" ? "ጠዋት (ከጠዋቱ 3–6)" : "Morning (9–12)") : (lang === "am" ? "ከሰዓት (ከሰዓቱ 7–11)" : "Afternoon (1–5)")}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {selectedServices.map((s) => (
                    <li key={s.id} className="text-muted-foreground flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-primary inline-block" />
                      {n(s, lang)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* ── Step 3: Confirmation ── */}
          {step === 3 && confirmations.length > 0 && (
            <div className="space-y-6 print:space-y-4">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-center">
                <p className="text-sm font-medium text-primary">
                  {confirmations.length} appointment{confirmations.length > 1 ? "s" : ""} confirmed
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("book_success_desc")}
                </p>
              </div>

              {/* One card per booked service */}
              <div className="grid gap-4 sm:grid-cols-2">
                {confirmations.map((c, i) => (
                  <div
                    key={c.reference}
                    className="rounded-xl border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-foreground leading-snug">
                        {c.service_name}
                      </p>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 shrink-0">
                        Confirmed
                      </span>
                    </div>

                    {qrCodes[c.reference] && (
                      <img
                        src={qrCodes[c.reference]}
                        alt={`QR code for booking ${c.reference}`}
                        className="mx-auto h-28 w-28"
                      />
                    )}

                    <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                      <p className="text-xs text-muted-foreground">Reference</p>
                      <div className="mt-0.5 flex items-center justify-center gap-2">
                        <p className="font-mono text-lg font-bold tracking-tight text-foreground">
                          {c.reference}
                        </p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(c.reference);
                            toast.success("Reference copied to clipboard");
                          }}
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground"
                          title="Copy Reference"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                        Queue #{c.queue_number} · {c.slot_window}
                      </p>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                      {DateTime.fromISO(c.appointment_date).toFormat("DDDD")}
                    </p>
                  </div>
                ))}
              </div>

              {/* Citizen info */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Citizen</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {confirmations[0].full_name}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Date</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {DateTime.fromISO(confirmations[0].appointment_date).toFormat("DDDD")}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 print:hidden">
                <Button onClick={() => downloadSlip(confirmations)} variant="outline">
                  <Printer className="mr-2 h-4 w-4" /> Download slip
                </Button>
                <Button onClick={reset}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Book another appointment
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        {step < 3 && (
          <div className="mt-6 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            {step < 2 && (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            {step === 2 && (
              <Button
                onClick={submit}
                disabled={!canNext() || submitting || !user}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Booking {selectedIds.size} service{selectedIds.size > 1 ? "s" : ""}…
                  </>
                ) : (
                  <>
                    Confirm {selectedIds.size} booking{selectedIds.size > 1 ? "s" : ""}
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}