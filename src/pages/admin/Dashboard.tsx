import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

interface Appt {
  status: "pending" | "served" | "no_show" | "cancelled";
  service_id: string;
  institution_id: string;
}

const STAT_CARDS = [
  {
    key: "total",
    label: "Total booked",
    tone: "bg-primary/10 text-primary",
    desc: "All appointments",
  },
  {
    key: "served",
    label: "Served",
    tone: "bg-emerald-100 text-emerald-700",
    desc: "Completed visits",
  },
  {
    key: "pending",
    label: "Waiting",
    tone: "bg-amber-100 text-amber-700",
    desc: "Yet to be called",
  },
  {
    key: "no_show",
    label: "No-show",
    tone: "bg-slate-100 text-slate-600",
    desc: "Didn't arrive",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    tone: "bg-rose-100 text-rose-700",
    desc: "Booking cancelled",
  },
] as const;

export default function Dashboard() {
  const { user } = useAuth();
  const isAgent = user?.role === "agent";

  const today = DateTime.now().setZone("Africa/Addis_Ababa").toISODate()!;
  const [date, setDate] = useState(today);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [institutions, setInstitutions] = useState<
    { id: string; name: string }[]
  >([]);
  const [agentInstitutionName, setAgentInstitutionName] = useState<string>("");
  const [services, setServices] = useState<
    Record<string, { name: string; institution_id: string }>
  >({});
  const [instFilter, setInstFilter] = useState("all");
  const [weekStats, setWeekStats] = useState({ total: 0, served: 0, avgRating: 0 });

  // Load lookup data
  useEffect(() => {
    supabase
      .from("institutions")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        setInstitutions(data ?? []);
        // If agent, find their institution name for the header
        if (isAgent && user?.institution_id) {
          const inst = (data ?? []).find((i) => i.id === user.institution_id);
          if (inst) setAgentInstitutionName(inst.name);
        }
      });

    // Weekly stats
    const weekStart = DateTime.now().setZone("Africa/Addis_Ababa").startOf("week").toISODate();
    const weekEnd = DateTime.now().setZone("Africa/Addis_Ababa").endOf("week").toISODate();
    supabase
      .from("appointments")
      .select("status, institution_id")
      .gte("appointment_date", weekStart)
      .lte("appointment_date", weekEnd)
      .then(({ data }) => {
        const rows = data ?? [];
        const total = rows.length;
        const served = rows.filter((r: any) => r.status === "served").length;
        setWeekStats((prev) => ({ ...prev, total, served }));
      });
    supabase
      .from("feedback")
      .select("rating")
      .gte("created_at", weekStart + "T00:00:00")
      .then(({ data }) => {
        const rows = data ?? [];
        const avg = rows.length ? rows.reduce((s: number, r: any) => s + r.rating, 0) / rows.length : 0;
        setWeekStats((prev) => ({ ...prev, avgRating: avg }));
      });

    supabase
      .from("services")
      .select("id, name, institution_id")
      .then(({ data }) => {
        const m: Record<string, { name: string; institution_id: string }> = {};
        (data ?? []).forEach(
          (s: any) => (m[s.id] = { name: s.name, institution_id: s.institution_id })
        );
        setServices(m);
      });
  }, []);

  // Load appointments for selected date
  useEffect(() => {
    supabase
      .from("appointments")
      .select("status, service_id, institution_id")
      .eq("appointment_date", date)
      .then(({ data }) => setAppts((data ?? []) as Appt[]));
  }, [date]);

  // For agents: RLS already limits rows to their institution — no need to filter
  // For admins: apply the institution dropdown filter
  const scoped = useMemo(() => {
    if (isAgent) return appts;
    if (instFilter === "all") return appts;
    return appts.filter((a) => a.institution_id === instFilter);
  }, [appts, instFilter, isAgent]);

  const stats = useMemo(() => {
    const s = {
      total: scoped.length,
      served: 0,
      pending: 0,
      no_show: 0,
      cancelled: 0,
    };
    scoped.forEach((a) => {
      s[a.status as keyof typeof s]++;
    });
    return { ...s, serveRate: s.total ? Math.round((s.served / s.total) * 100) : 0 };
  }, [scoped]);

  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    scoped.forEach((a) => {
      const name =
        services[a.service_id]?.name || a.service_id.slice(0, 6) + "…";
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([service, count]) => ({
        service:
          service.length > 28 ? service.slice(0, 28) + "…" : service,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [scoped, services]);

  const isToday = date === today;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {isAgent ? (
              <>
                {agentInstitutionName
                  ? <><span className="font-medium text-foreground">{agentInstitutionName}</span> · </>
                  : "Your institution · "}
                {DateTime.fromISO(date).toFormat("DDDD")}
                {isToday && " (today)"}
              </>
            ) : (
              <>
                {DateTime.fromISO(date).toFormat("DDDD")}
                {isToday && " · today"}
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1"
            />
          </div>
          {/* Admin only: institution filter */}
          {!isAgent && (
            <div className="min-w-[14rem]">
              <Label className="text-xs">Institution</Label>
              <Select value={instFilter} onValueChange={setInstFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All institutions</SelectItem>
                  {institutions.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Weekly summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">This week</p>
          <p className="text-3xl font-bold text-foreground">{weekStats.total}</p>
          <p className="text-sm text-muted-foreground">Total bookings</p>
        </div>
        <div className="rounded-xl border bg-card p-4 flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Serve rate</p>
          <p className="text-3xl font-bold text-emerald-600">
            {stats.total ? stats.serveRate : weekStats.total ? Math.round((weekStats.served / weekStats.total) * 100) : 0}%
          </p>
          <p className="text-sm text-muted-foreground">Served vs booked</p>
        </div>
        <div className="rounded-xl border bg-card p-4 flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg rating</p>
          <p className="text-3xl font-bold text-amber-500">
            {weekStats.avgRating ? weekStats.avgRating.toFixed(1) : "—"}
          </p>
          <p className="text-sm text-muted-foreground">★ citizen feedback</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {STAT_CARDS.map((c) => (
          <div key={c.key} className="rounded-xl border bg-card p-4">
            <div
              className={`mb-2 inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${c.tone}`}
            >
              {c.label}
            </div>
            <p className="text-3xl font-bold text-foreground">
              {stats[c.key as keyof typeof stats]}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{c.desc}</p>
          </div>
        ))}
      </div>

      {/* Attendance breakdown — most useful for staff at a glance */}
      {stats.total > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">
            Attendance breakdown
          </h2>
          <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full">
            {stats.served > 0 && (
              <div
                className="bg-emerald-500"
                style={{ width: `${(stats.served / stats.total) * 100}%` }}
                title={`Served: ${stats.served}`}
              />
            )}
            {stats.pending > 0 && (
              <div
                className="bg-amber-400"
                style={{ width: `${(stats.pending / stats.total) * 100}%` }}
                title={`Waiting: ${stats.pending}`}
              />
            )}
            {stats.no_show > 0 && (
              <div
                className="bg-slate-400"
                style={{ width: `${(stats.no_show / stats.total) * 100}%` }}
                title={`No-show: ${stats.no_show}`}
              />
            )}
            {stats.cancelled > 0 && (
              <div
                className="bg-rose-400"
                style={{ width: `${(stats.cancelled / stats.total) * 100}%` }}
                title={`Cancelled: ${stats.cancelled}`}
              />
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Served {stats.total > 0 ? Math.round((stats.served / stats.total) * 100) : 0}%
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              Waiting {stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0}%
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
              No-show {stats.total > 0 ? Math.round((stats.no_show / stats.total) * 100) : 0}%
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-rose-400" />
              Cancelled {stats.total > 0 ? Math.round((stats.cancelled / stats.total) * 100) : 0}%
            </span>
          </div>
        </div>
      )}

      {/* Appointments per service chart */}
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-foreground">
          Appointments per service
        </h2>
        {chartData.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No data for this date.
          </p>
        ) : (
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="service"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="var(--primary)"
                  radius={[6, 6, 0, 0]}
                  name="Appointments"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
