import { useEffect, useState, useMemo } from "react";
import { Star, Loader2, TrendingUp, MessageSquare } from "lucide-react";
import { DateTime } from "luxon";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

interface FeedbackRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  appointment_id: string;
  institution_id: string;
  service_id: string;
  institutions: { name: string } | null;
  services: { name: string } | null;
  profiles: { full_name: string | null; email: string | null } | null;
}

function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const sz = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${sz} ${n <= rating ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground/30"}`}
        />
      ))}
    </span>
  );
}

export default function FeedbackAdminPage() {
  const { user } = useAuth();
  const isAgent = user?.role === "agent";

  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [institutions, setInstitutions] = useState<{ id: string; name: string }[]>([]);
  const [instFilter, setInstFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    const q = supabase
      .from("feedback")
      .select("*, institutions(name), services(name)")
      .order("created_at", { ascending: false });
    if (isAgent && user?.institution_id) {
      q.eq("institution_id", user.institution_id);
    }
    const { data, error } = await q;
    if (error) { toast.error(error.message); setLoading(false); return; }

    // fetch profiles separately since there's no FK from feedback to profiles
    const userIds = [...new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean))];
    let profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      (profiles ?? []).forEach((p: any) => { profileMap[p.id] = p; });
    }

    const enriched = (data ?? []).map((r: any) => ({
      ...r,
      profiles: profileMap[r.user_id] ?? null,
    }));
    setRows(enriched as unknown as FeedbackRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    supabase.from("institutions").select("id, name").order("name")
      .then(({ data }) => setInstitutions(data ?? []));
  }, []);

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (ratingFilter !== "all" && r.rating !== Number(ratingFilter)) return false;
      if (!isAgent && instFilter !== "all" && r.institution_id !== instFilter) return false;
      if (q &&
        !r.institutions?.name.toLowerCase().includes(q) &&
        !r.services?.name.toLowerCase().includes(q) &&
        !r.profiles?.full_name?.toLowerCase().includes(q) &&
        !(r.comment ?? "").toLowerCase().includes(q)
      ) return false;
      return true;
    });
  }, [rows, ratingFilter, instFilter, search, isAgent]);

  // Summary stats
  const avg = visible.length
    ? (visible.reduce((s, r) => s + r.rating, 0) / visible.length).toFixed(1)
    : "—";
  const dist = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: visible.filter((r) => r.rating === n).length,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Feedback</h1>
        <p className="text-sm text-muted-foreground">Citizen ratings and comments after being served.</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
            <TrendingUp className="h-3.5 w-3.5" /> Average rating
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-4xl font-bold text-foreground">{avg}</span>
            <Stars rating={Math.round(Number(avg) || 0)} size="lg" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{visible.length} review{visible.length !== 1 ? "s" : ""}</p>
        </div>

        <div className="rounded-xl border bg-card p-4 sm:col-span-2">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Distribution</p>
          <div className="space-y-1">
            {dist.map(({ n, count }) => {
              const pct = visible.length ? (count / visible.length) * 100 : 0;
              return (
                <div key={n} className="flex items-center gap-2 text-xs">
                  <Stars rating={n} />
                  <div className="flex-1 rounded-full bg-muted h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search by service, citizen or comment…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[14rem]"
        />
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All ratings" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ratings</SelectItem>
            {[5, 4, 3, 2, 1].map((n) => (
              <SelectItem key={n} value={String(n)}>{n} star{n !== 1 ? "s" : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isAgent && (
          <Select value={instFilter} onValueChange={setInstFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All institutions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All institutions</SelectItem>
              {institutions.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Citizen</th>
                  <th className="px-4 py-3 text-left">Service</th>
                  {!isAgent && <th className="px-4 py-3 text-left">Institution</th>}
                  <th className="px-4 py-3 text-left">Rating</th>
                  <th className="px-4 py-3 text-left">Comment</th>
                  <th className="px-4 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{r.profiles?.full_name || "(unnamed)"}</p>
                      <p className="text-xs text-muted-foreground">{r.profiles?.email}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.services?.name ?? "—"}</td>
                    {!isAgent && <td className="px-4 py-3 text-muted-foreground">{r.institutions?.name ?? "—"}</td>}
                    <td className="px-4 py-3"><Stars rating={r.rating} /></td>
                    <td className="px-4 py-3 max-w-xs">
                      {r.comment ? (
                        <p className="text-muted-foreground line-clamp-2">{r.comment}</p>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs italic">no comment</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {DateTime.fromISO(r.created_at).toFormat("dd MMM yyyy")}
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={isAgent ? 5 : 6} className="px-4 py-12 text-center text-muted-foreground">
                      <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                      No feedback yet.
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
