import { useEffect, useState, useMemo } from "react";
import { DateTime } from "luxon";
import { Loader2, Search, CheckCircle, XCircle, AlertCircle, Calendar, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

type Status = "pending" | "served" | "no_show" | "cancelled";

interface Appointment {
  id: string;
  reference: string;
  full_name: string;
  phone: string;
  national_id: string;
  appointment_date: string;
  slot_window: "AM" | "PM";
  queue_number: number;
  status: Status;
  institution_id: string;
  service_id: string;
}

interface Institution { id: string; name: string; }
interface Service { id: string; name: string; institution_id: string; }

const STATUS_STYLES: Record<Status, string> = {
  pending:   "bg-amber-100 text-amber-700",
  served:    "bg-emerald-100 text-emerald-700",
  no_show:   "bg-slate-100 text-slate-600",
  cancelled: "bg-rose-100 text-rose-700",
};
const STATUS_LABELS: Record<Status, string> = {
  pending:   "Waiting",
  served:    "Served",
  no_show:   "No-show",
  cancelled: "Cancelled",
};

export default function Appointments() {
  const { user } = useAuth();
  const isAgent = user?.role === "agent";

  const today = DateTime.now().setZone("Africa/Addis_Ababa").toISODate()!;
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [windowFilter, setWindowFilter] = useState<"AM" | "PM" | "all">("all");
  const [instFilter, setInstFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");

  const [appts, setAppts] = useState<Appointment[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [hasMore, setHasMore] = useState(false);

  const loadData = async () => {
    setLoading(true);
    let q = supabase
      .from("appointments")
      .select("*")
      .eq("appointment_date", date)
      .order("slot_window")
      .order("queue_number");

    if (isAgent && user?.institution_id) {
       q = q.eq("institution_id", user.institution_id);
    } else if (!isAgent && instFilter !== "all") {
       q = q.eq("institution_id", instFilter);
    }

    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    if (windowFilter !== "all") q = q.eq("slot_window", windowFilter);
    if (serviceFilter !== "all") q = q.eq("service_id", serviceFilter);
    
    if (search.trim()) {
      const s = `%${search.trim()}%`;
      q = q.or(`full_name.ilike.${s},reference.ilike.${s},national_id.ilike.${s}`);
    }

    q = q.range(page * pageSize, (page + 1) * pageSize);

    const { data, error } = await q;
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    
    const d = data ?? [];
    if (d.length > pageSize) {
       setHasMore(true);
       setAppts(d.slice(0, pageSize) as Appointment[]);
    } else {
       setHasMore(false);
       setAppts(d as Appointment[]);
    }
  };

  useEffect(() => {
    supabase.from("institutions").select("id, name").order("name")
      .then(({ data }) => setInstitutions(data ?? []));
    supabase.from("services").select("id, name, institution_id").order("name")
      .then(({ data }) => setServices((data ?? []) as Service[]));
  }, []);

  // Derived: are any filters active?
  const hasFilters = date !== "" || search !== "" || statusFilter !== "all" || windowFilter !== "all" || instFilter !== "all" || serviceFilter !== "all";

  useEffect(() => { setPage(0); }, [date, search, statusFilter, windowFilter, instFilter, serviceFilter]);

  useEffect(() => {
    const t = setTimeout(() => { loadData(); }, 300);
    return () => clearTimeout(t);
  }, [page, date, search, statusFilter, windowFilter, instFilter, serviceFilter, isAgent, user?.institution_id]);

  const updateStatus = async (appt: Appointment, status: Status) => {
    setUpdatingId(appt.id);
    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", appt.id);
    setUpdatingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked as ${STATUS_LABELS[status]}`);
    setAppts((prev) => prev.map((a) => a.id === appt.id ? { ...a, status } : a));

    // Broadcast update so the public Live Tracker UI updates instantly without polling
    const channelName = `queue:${appt.institution_id}:${appt.service_id}:${appt.appointment_date}:${appt.slot_window}`;
    supabase.channel(channelName).send({
      type: "broadcast",
      event: "queue_update",
      payload: { 
        queue_number: appt.queue_number, 
        status 
      },
    });
  };

  const instName = (id: string) =>
    institutions.find((i) => i.id === id)?.name ?? "—";
  const svcName = (id: string) =>
    services.find((s) => s.id === id)?.name ?? "—";

  // Agents only see their own institution's services in the dropdown.
  // Admins see all, or the institution they picked in the filter above.
  const filteredServices = useMemo(() => {
    if (isAgent) {
      return services.filter((s) => s.institution_id === user?.institution_id);
    }
    return instFilter === "all"
      ? services
      : services.filter((s) => s.institution_id === instFilter);
  }, [services, instFilter, isAgent, user?.institution_id]);

  const visible = appts;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Appointments</h1>
          <p className="text-sm text-muted-foreground">
            View and manage appointments. Mark citizens as served or absent.
          </p>
        </div>
        <div>
          <Label className="text-xs">Date</Label>
          <div className="relative mt-1">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        {/* Search */}
        <div className="relative min-w-[14rem]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Name, reference or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Window */}
        <div className="min-w-[8rem]">
          <Label className="text-xs">Window</Label>
          <Select value={windowFilter} onValueChange={(v) => setWindowFilter(v as any)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">AM & PM</SelectItem>
              <SelectItem value="AM">Morning (AM)</SelectItem>
              <SelectItem value="PM">Afternoon (PM)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="min-w-[9rem]">
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Waiting</SelectItem>
              <SelectItem value="served">Served</SelectItem>
              <SelectItem value="no_show">No-show</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Institution (admin only) */}
        {!isAgent && (
          <div className="min-w-[12rem]">
            <Label className="text-xs">Institution</Label>
            <Select value={instFilter} onValueChange={(v) => {
              setInstFilter(v);
              setServiceFilter("all");
            }}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All institutions</SelectItem>
                {institutions.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="min-w-[12rem]">
          <Label className="text-xs">Service</Label>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {filteredServices.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-end mb-1">
          <Button variant="outline" size="sm" onClick={() => {
            setSearch("");
            setWindowFilter("all");
            setStatusFilter("all");
            setInstFilter("all");
            setServiceFilter("all");
          }} className="h-9">
            Clear Filters
          </Button>
        </div>
      </div>

      {/* Summary badges and Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Showing page <span className="font-medium text-foreground">{page + 1}</span> 
          {" "}for {DateTime.fromISO(date).toFormat("DDDD")}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <Button size="sm" variant="outline" disabled={!hasMore} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Reference</th>
                  <th className="px-4 py-3 text-left">Citizen</th>
                  <th className="px-4 py-3 text-left">National ID</th>
                  <th className="px-4 py-3 text-left">Service</th>
                  {!isAgent && <th className="px-4 py-3 text-left">Institution</th>}
                  <th className="px-4 py-3 text-left">Window</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => {
                  const isUpdating = updatingId === a.id;
                  return (
                    <tr key={a.id} className="border-t transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono font-bold text-foreground">
                        {a.queue_number}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {a.reference}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{a.full_name}</p>
                        <p className="text-xs text-muted-foreground">{a.phone}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{a.national_id}</td>
                      <td className="px-4 py-3 text-muted-foreground">{svcName(a.service_id)}</td>
                      {!isAgent && (
                        <td className="px-4 py-3 text-muted-foreground">{instName(a.institution_id)}</td>
                      )}
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {a.slot_window === "AM" ? "☀ AM" : "🌙 PM"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span 
                          className={`rounded-full px-2 py-0.5 text-xs font-medium cursor-help ${STATUS_STYLES[a.status]}`}
                          title={`Appointment is currently ${STATUS_LABELS[a.status]}`}
                        >
                          {STATUS_LABELS[a.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isUpdating ? (
                          <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
                        ) : a.status === "pending" ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => updateStatus(a, "served")}
                            >
                              <CheckCircle className="mr-1 h-3 w-3" /> Served
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-slate-500 hover:text-slate-700"
                              onClick={() => updateStatus(a, "no_show")}
                            >
                              <AlertCircle className="mr-1 h-3 w-3" /> No-show
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => updateStatus(a, "cancelled")}
                            >
                              <XCircle className="mr-1 h-3 w-3" /> Cancel
                            </Button>
                          </div>
                        ) : (
                          // Allow re-opening a completed appointment
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground"
                            onClick={() => updateStatus(a, "pending")}
                          >
                            Revert to waiting
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={isAgent ? 8 : 9} className="px-4 py-16 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <Inbox className="h-10 w-10 text-muted-foreground/30" />
                        <p>
                          {!hasFilters 
                            ? `No appointments on ${DateTime.fromISO(date).toFormat("DDDD")}.` 
                            : "No appointments match the current filters."}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
