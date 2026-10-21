import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { DateTime } from "luxon";
import { Loader2, Search, ArrowLeft, BellRing, UsersRound, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BrandHeader from "@/components/BrandHeader";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";

type Status = "pending" | "served" | "cancelled" | "no_show";

const STATUS_STYLES: Record<Status, string> = {
  pending:   "bg-amber-100 text-amber-800 border-amber-200",
  served:    "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200",
  no_show:   "bg-slate-100 text-slate-700 border-slate-200",
};

export default function LookupPage() {
  const [ref, setRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [appt, setAppt] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { t, lang } = useLanguage();
  
  // Real-time Queue Tracking State
  const [currentServing, setCurrentServing] = useState<number | null>(null);

  const loadQueueStatus = async (a: any) => {
    const { data } = await supabase.rpc("get_current_queue_status", {
      _institution_id: a.institution_id,
      _service_id: a.service_id,
      _date: a.appointment_date,
      _window: a.slot_window,
    });
    if (data !== null) setCurrentServing(data);
  };

  const lookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!ref.trim()) return;
    setLoading(true); setError(null); setAppt(null); setCurrentServing(null);
    const { data, error } = await supabase.rpc("lookup_appointment", { _ref: ref.trim() });
    setLoading(false);
    if (error) { setError(error.message); return; }
    if (!data || data.length === 0) { setError("No appointment found with that reference."); return; }
    
    const fetchedAppt = data[0];
    setAppt(fetchedAppt);
    loadQueueStatus(fetchedAppt);
  };

  useEffect(() => {
    if (!appt) return;
    
    // Subscribe to queue updates for this specific institution, service, date, and window
    const channelName = `queue:${appt.institution_id}:${appt.service_id}:${appt.appointment_date}:${appt.slot_window}`;
    const channel = supabase.channel(channelName)
      .on("broadcast", { event: "queue_update" }, (payload) => {
        const update = payload.payload;
        
        // Update currently serving if the queue advances
        if (update.status === "served" || update.status === "no_show") {
           setCurrentServing(prev => Math.max(prev ?? 0, update.queue_number));
        }
        
        // Update citizen's own status if it matches
        if (update.queue_number === appt.queue_number) {
           setAppt((prev: any) => ({ ...prev, status: update.status }));
        }
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [appt]);

  const peopleAhead = (appt && currentServing !== null && appt.status === "pending") 
    ? Math.max(0, appt.queue_number - currentServing - 1) 
    : null;
    
  const isUpNext = peopleAhead !== null && peopleAhead <= 3;

  return (
    <div className="min-h-screen bg-muted/40">
      <BrandHeader />

      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Live Queue Tracker</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your reference number to track your spot in line in real-time.
        </p>

        <form onSubmit={lookup} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="ref">Reference number</Label>
            <Input
              id="ref"
              value={ref}
              onChange={(e) => setRef(e.target.value.toUpperCase().trim())}
              placeholder="HWS-YYYYMMDD-AM-…"
              className="mt-1 font-mono"
              autoFocus
            />
          </div>
          <Button type="submit" disabled={loading || ref.trim().length < 5}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Track Status
          </Button>
        </form>

        {error && (
          <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {appt && (
          <div className="mt-8 overflow-hidden rounded-xl border bg-card shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Live Queue Banner */}
            {appt.status === "pending" && (
              <div className={`p-6 border-b ${isUpNext ? 'bg-primary text-primary-foreground' : 'bg-muted/50'}`}>
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="text-center md:text-left space-y-1">
                    <p className={`text-sm font-semibold uppercase tracking-wider ${isUpNext ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                      Now Serving
                    </p>
                    <p className="text-5xl font-black font-mono">
                      #{String(currentServing ?? 0).padStart(3, '0')}
                    </p>
                  </div>
                  
                  <div className={`flex items-center gap-4 rounded-2xl px-6 py-4 ${isUpNext ? 'bg-black/20' : 'bg-card border shadow-sm'}`}>
                    <UsersRound className={`h-8 w-8 ${isUpNext ? 'text-primary-foreground' : 'text-primary'}`} />
                    <div>
                      <p className={`text-sm font-semibold uppercase tracking-wider ${isUpNext ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        People Ahead of You
                      </p>
                      <p className={`text-2xl font-bold ${!isUpNext && 'text-foreground'}`}>
                        {peopleAhead}
                      </p>
                    </div>
                  </div>
                </div>
                
                {isUpNext && (
                  <div className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-white/20 p-3 text-sm font-medium">
                    <BellRing className="h-5 w-5 animate-pulse" />
                    Please head to the counter, your turn is approaching!
                  </div>
                )}
              </div>
            )}
            
            {(appt.status === "served" || appt.status === "cancelled" || appt.status === "no_show") && (
              <div className={`p-6 border-b text-center ${
                appt.status === "served" ? "bg-emerald-50" : "bg-muted/50"
              }`}>
                <p className="text-lg font-bold text-foreground">
                  Appointment {String(appt.status).replace("_", " ")}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Thank you for using the MESOB platform.
                </p>
              </div>
            )}

            {/* Appointment Details */}
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Reference</p>
                  <p className="font-mono text-lg font-bold text-foreground break-all">{appt.reference}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                  STATUS_STYLES[appt.status as Status] ?? STATUS_STYLES.pending
                }`}>
                  {String(appt.status).replace("_", " ")}
                </span>
              </div>
              
              <div className="mt-6 grid gap-4 sm:grid-cols-2 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground">Citizen</p>
                  <p className="font-medium text-foreground">{appt.full_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Your Queue Number</p>
                  <p className="font-medium text-foreground font-mono text-base">#{String(appt.queue_number).padStart(3, '0')} ({appt.slot_window})</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium text-foreground">
                    {DateTime.fromISO(appt.appointment_date).toFormat("DDDD")}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Institution</p>
                  <p className="font-medium text-foreground">
                    {lang === "am" && appt.institution_name_am ? appt.institution_name_am : appt.institution_name}
                  </p>
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <p className="text-muted-foreground">Service</p>
                  <p className="font-medium text-foreground">
                    {lang === "am" && appt.service_name_am ? appt.service_name_am : appt.service_name}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
