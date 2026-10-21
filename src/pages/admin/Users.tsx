import { useEffect, useState } from "react";
import { UserCog, Search, ShieldCheck, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

type Role = "admin" | "agent" | "citizen";

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  institution_id: string | null;
  institution_name: string | null;
}

interface Institution { id: string; name: string; }

const ROLE_STYLES: Record<Role, string> = {
  admin:   "bg-rose-100 text-rose-700",
  agent:   "bg-purple-100 text-purple-700",
  citizen: "bg-slate-100 text-slate-600",
};
const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin", agent: "Staff", citizen: "Citizen",
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editRole, setEditRole] = useState<Role>("citizen");
  const [editInstitution, setEditInstitution] = useState("none");
  const [saving, setSaving] = useState(false);

  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [hasMore, setHasMore] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase.rpc("get_all_users");

    if (search.trim()) {
      const s = `%${search.trim()}%`;
      q = q.or(`full_name.ilike.${s},email.ilike.${s}`);
    }

    q = q.range(page * pageSize, (page + 1) * pageSize);

    const { data, error } = await q;
    setLoading(false);
    if (error) { toast.error("Failed to load users: " + error.message); return; }
    
    const d = data ?? [];
    if (d.length > pageSize) {
      setHasMore(true);
      setUsers(d.slice(0, pageSize) as UserRow[]);
    } else {
      setHasMore(false);
      setUsers(d as UserRow[]);
    }
  };

  useEffect(() => { setPage(0); }, [search]);

  useEffect(() => {
    const t = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(t);
  }, [page, search]);

  useEffect(() => {
    supabase.from("institutions").select("id, name").eq("active", true).order("name")
      .then(({ data }) => setInstitutions(data ?? []));
  }, []);

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setEditRole(u.role);
    setEditInstitution(u.institution_id ?? "none");
  };

  const save = async () => {
    if (!editing) return;
    if (editing.id === currentUser?.id && editRole !== "admin") {
      toast.error("You cannot remove your own admin role.");
      return;
    }
    if (editRole === "agent" && editInstitution === "none") {
      toast.error("Please assign an institution to this staff member.");
      return;
    }
    setSaving(true);
    try {
      // Remove all existing roles
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", editing.id);
      if (delErr) throw delErr;

      // Insert new role(s) — always keep citizen as base
      const roles: { user_id: string; role: string }[] = [{ user_id: editing.id, role: "citizen" }];
      if (editRole !== "citizen") roles.push({ user_id: editing.id, role: editRole });
      const { error: insErr } = await supabase.from("user_roles").insert(roles);
      if (insErr) throw insErr;

      // Update institution_id on profile
      const { error: profErr } = await supabase.from("profiles")
        .update({ institution_id: editRole === "agent" ? editInstitution : null })
        .eq("id", editing.id);
      if (profErr) throw profErr;

      toast.success("User updated successfully.");
      setEditing(null);
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = users;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground">
            Assign roles and institution access to registered users.
          </p>
        </div>
        <div className="relative max-w-sm w-full flex items-center gap-2">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name or email…" value={search} autoFocus
              onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          {search && (
            <Button variant="ghost" size="sm" onClick={() => setSearch("")} className="px-2">
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Legend & Pagination */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between rounded-xl border bg-card p-4 text-sm">
        <div className="flex flex-wrap gap-4">
          {(["citizen","agent","admin"] as Role[]).map((r) => (
            <div key={r} className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[r]}`}>
                {ROLE_LABELS[r]}
              </span>
              <span className="text-muted-foreground hidden lg:inline">
                {r === "citizen" && "Public — can book appointments only"}
                {r === "agent"   && "Staff — manages appointments at their institution"}
                {r === "admin"   && "Full access to everything"}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground shrink-0">
          Showing page <span className="font-medium text-foreground">{page + 1}</span>
          <Button size="sm" variant="outline" className="ml-2 h-7 px-2" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <Button size="sm" variant="outline" className="h-7 px-2" disabled={!hasMore} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
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
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Institution</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-t transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {u.full_name || "(no name)"}
                        {u.id === currentUser?.id && (
                          <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">you</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{u.email ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[u.role]}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.role === "agent"
                        ? (u.institution_name ?? <span className="text-destructive text-xs">⚠ Not assigned</span>)
                        : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                        <UserCog className="mr-2 h-3 w-3" /> Edit
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                      {search ? `No users matching "${search}".` : "No users found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-5">
              <div className="rounded-lg bg-muted/50 px-4 py-3">
                <p className="font-medium text-foreground">{editing.full_name || "(no name)"}</p>
                <p className="text-sm text-muted-foreground">{editing.email ?? "—"}</p>
              </div>

              <div>
                <Label className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Role
                </Label>
                <Select value={editRole} onValueChange={(v) => {
                  setEditRole(v as Role);
                  if (v !== "agent") setEditInstitution("none");
                }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="citizen">Citizen — public user</SelectItem>
                    <SelectItem value="agent">Staff — queue management</SelectItem>
                    <SelectItem value="admin">Admin — full access</SelectItem>
                  </SelectContent>
                </Select>
                {editRole === "admin" && (
                  <p className="mt-1.5 text-xs text-amber-700">
                    Admins have full access to all data. Assign carefully.
                  </p>
                )}
              </div>

              {editRole === "agent" && (
                <div>
                  <Label className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> Institution
                  </Label>
                  <Select value={editInstitution} onValueChange={setEditInstitution}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select institution…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Not assigned —</SelectItem>
                      {institutions.map((i) => (
                        <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editInstitution === "none" && (
                    <p className="mt-1.5 text-xs text-destructive">
                      Staff without an institution cannot see any appointments.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Saving…</> : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
