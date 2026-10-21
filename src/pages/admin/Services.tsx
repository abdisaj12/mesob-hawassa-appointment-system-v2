import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

interface Institution { id: string; name: string; }
interface Service { name_am?: string | null;
  id: string; institution_id: string; name: string;
  description: string | null; estimated_duration_min: number;
  am_capacity: number; pm_capacity: number; active: boolean;
}

export default function Services() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [items, setItems] = useState<Service[]>([]);
  const [editing, setEditing] = useState<Partial<Service> | null>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    const { data } = await supabase.from("services").select("*").order("name");
    setItems((data ?? []) as Service[]);
  };
  useEffect(() => {
    supabase.from("institutions").select("id, name").order("name")
      .then(({ data }) => setInstitutions((data ?? []) as Institution[]));
    load();
  }, []);

  const instName = (id: string) => institutions.find((i) => i.id === id)?.name || "—";

  const openNew = () => {
    setEditing({
      institution_id: institutions[0]?.id || "", name: "", description: "",
      estimated_duration_min: 20, am_capacity: 20, pm_capacity: 20, active: true,
    });
    setOpen(true);
  };
  const openEdit = (s: Service) => { setEditing({ ...s }); setOpen(true); };

  const toggleActive = async (s: Service) => {
    setItems((prev) => prev.map((p) => (p.id === s.id ? { ...p, active: !s.active } : p)));
    const { error } = await supabase.from("services").update({ active: !s.active }).eq("id", s.id);
    if (error) { toast.error(error.message); load(); }
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name?.trim() || !editing.institution_id) return toast.error("Institution & name required");
    const payload = {
      institution_id: editing.institution_id!,
      name: editing.name!,
      name_am: editing.name_am || null,
      description: editing.description ?? null,
      estimated_duration_min: Number(editing.estimated_duration_min) || 20,
      am_capacity: Number(editing.am_capacity) || 20,
      pm_capacity: Number(editing.pm_capacity) || 20,
      active: editing.active ?? true,
    };
    if (editing.id) {
      const { error } = await supabase.from("services").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("services").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Saved"); setOpen(false); load();
  };

  const remove = async (s: Service) => {
    if (!confirm(`Delete ${s.name}?`)) return;
    const { error } = await supabase.from("services").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  const visible = filter === "all" ? items : items.filter((i) => i.institution_id === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Services</h1>
          <p className="text-sm text-muted-foreground">Services offered at each institution.</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="min-w-[12rem]">
            <Label className="text-xs">Filter by institution</Label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {institutions.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New service</Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Service</th>
              <th className="px-4 py-3 text-left">Institution</th>
              <th className="px-4 py-3 text-left">Duration</th>
              <th className="px-4 py-3 text-left">AM / PM cap</th>
              <th className="px-4 py-3 text-left">Active</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{s.name}</p>
                  {s.description && <p className="text-xs text-muted-foreground line-clamp-1">{s.description}</p>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{instName(s.institution_id)}</td>
                <td className="px-4 py-3">{s.estimated_duration_min} min</td>
                <td className="px-4 py-3">{s.am_capacity} / {s.pm_capacity}</td>
                <td className="px-4 py-3"><Switch checked={s.active} onCheckedChange={() => toggleActive(s)} /></td>
                <td className="px-4 py-3 text-right space-x-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                    <Pencil className="mr-2 h-3 w-3" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(s)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No services.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit service" : "New service"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Institution</Label>
                <Select value={editing.institution_id || ""} onValueChange={(v) => setEditing({ ...editing, institution_id: v })}>
                  <SelectTrigger className="mt-1 w-full max-w-full"><div className="truncate"><SelectValue placeholder="Pick…" /></div></SelectTrigger>
                  <SelectContent className="w-[var(--radix-select-trigger-width)]">
                    {institutions.map((i) => <SelectItem key={i.id} value={i.id}><span className="block truncate max-w-[380px]">{i.name}</span></SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Name (English)</Label>
                <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Name (Amharic — ስም)</Label>
                <Input
                  value={editing.name_am || ""}
                  onChange={(e) => setEditing({ ...editing, name_am: e.target.value })}
                  placeholder="e.g. የካርድ ሪቻርጅ አገልግሎት"
                  className="mt-1"
                />
                <Label>Description</Label>
                <Textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={3} className="mt-1" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Duration (min)</Label>
                  <Input type="number" min={5} max={240} value={editing.estimated_duration_min || 20}
                    onChange={(e) => setEditing({ ...editing, estimated_duration_min: Number(e.target.value) })} className="mt-1" />
                </div>
                <div>
                  <Label>AM capacity</Label>
                  <Input type="number" min={1} max={500} value={editing.am_capacity || 20}
                    onChange={(e) => setEditing({ ...editing, am_capacity: Number(e.target.value) })} className="mt-1" />
                </div>
                <div>
                  <Label>PM capacity</Label>
                  <Input type="number" min={1} max={500} value={editing.pm_capacity || 20}
                    onChange={(e) => setEditing({ ...editing, pm_capacity: Number(e.target.value) })} className="mt-1" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={!!editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
