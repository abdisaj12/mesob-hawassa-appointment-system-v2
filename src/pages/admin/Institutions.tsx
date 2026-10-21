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
import { supabase } from "@/integrations/supabase/client";

interface Institution {
  id: string;
  code: string;
  name: string;
  name_am?: string | null;
  description: string | null;
  active: boolean;
}

export default function Institutions() {
  const [items, setItems] = useState<Institution[]>([]);
  const [editing, setEditing] = useState<Partial<Institution> | null>(null);
  const [open, setOpen] = useState(false);

  const load = () =>
    supabase.from("institutions").select("*").order("name")
      .then(({ data }) => setItems((data ?? []) as Institution[]));

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing({ code: "", name: "", name_am: "", description: "", active: true }); setOpen(true); };
  const openEdit = (i: Institution) => { setEditing({ ...i }); setOpen(true); };

  const toggleActive = async (i: Institution) => {
    const next = !i.active;
    setItems((prev) => prev.map((p) => (p.id === i.id ? { ...p, active: next } : p)));
    const { error } = await supabase.from("institutions").update({ active: next }).eq("id", i.id);
    if (error) { toast.error(error.message); load(); }
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name?.trim() || !editing.code?.trim()) return toast.error("Code & name are required");
    if (editing.id) {
      const { error } = await supabase.from("institutions").update({
        code: editing.code, name: editing.name, name_am: editing.name_am || null, description: editing.description, active: editing.active,
      }).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("institutions").insert({
        code: editing.code!, name: editing.name!, name_am: editing.name_am || null, description: editing.description ?? null, active: editing.active ?? true,
      });
      if (error) return toast.error(error.message);
    }
    toast.success("Saved");
    setOpen(false); load();
  };

  const remove = async (i: Institution) => {
    if (!confirm(`Delete ${i.name}? Services under it will also be removed.`)) return;
    const { error } = await supabase.from("institutions").delete().eq("id", i.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Institutions</h1>
          <p className="text-sm text-muted-foreground">Bureaus that offer services through MESOB.</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New institution</Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Active</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">{i.code}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{i.name}</p>
                  {i.description && <p className="text-xs text-muted-foreground line-clamp-1">{i.description}</p>}
                </td>
                <td className="px-4 py-3"><Switch checked={i.active} onCheckedChange={() => toggleActive(i)} /></td>
                <td className="px-4 py-3 text-right space-x-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(i)}>
                    <Pencil className="mr-2 h-3 w-3" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(i)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No institutions yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit institution" : "New institution"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Code</Label>
                <Input value={editing.code || ""} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. TMA" className="mt-1" />
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
                  placeholder="e.g. የሀዋሳ ጤና ቢሮ"
                />
                <Label>Description</Label>
                <Textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={3} className="mt-1" />
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
