import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listUsersAdmin, setRoleAssignment } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Pencil, Gavel, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/admin/roles")({ component: Page });

type Role = "admin" | "editor" | "moderator";

const ROLES: { key: Role; label: string; desc: string; icon: any; tint: string }[] = [
  { key: "admin", label: "Admin", desc: "Full access — manage users, content & settings.", icon: ShieldCheck, tint: "bg-red-500/10 text-red-600 border-red-500/30" },
  { key: "editor", label: "Editor", desc: "Edit categories, questions & contests.", icon: Pencil, tint: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  { key: "moderator", label: "Moderator", desc: "Moderate users, view reports & ban abusers.", icon: Gavel, tint: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
];

type Row = {
  id: string; email: string;
  profile: { full_name: string | null; phone: string | null } | null;
  roles: string[];
};

function Page() {
  const list = useServerFn(listUsersAdmin);
  const setRole = useServerFn(setRoleAssignment);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setRows((await list()) as Row[]); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => rows.filter((r) => (r.email + " " + (r.profile?.full_name ?? "")).toLowerCase().includes(q.toLowerCase())),
    [rows, q]
  );

  async function toggle(userId: string, role: Role, enabled: boolean) {
    const key = `${userId}:${role}`;
    setPending(key);
    // optimistic
    setRows((prev) => prev.map((r) => r.id !== userId ? r : {
      ...r,
      roles: enabled ? Array.from(new Set([...r.roles, role])) : r.roles.filter((x) => x !== role),
    }));
    try {
      await setRole({ data: { userId, role, enabled } });
      toast.success(`${enabled ? "Granted" : "Revoked"} ${role}`);
    } catch (e: any) {
      toast.error(e.message);
      load();
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Role Manager</h1>
          <p className="text-muted-foreground">Assign Admin, Editor or Moderator permissions to any user.</p>
        </div>
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {ROLES.map((r) => (
          <Card key={r.key} className={`p-4 border ${r.tint}`}>
            <div className="flex items-center gap-2 font-semibold"><r.icon className="w-4 h-4" /> {r.label}</div>
            <div className="text-xs mt-1 opacity-80">{r.desc}</div>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <Card className="divide-y">
          {filtered.length === 0 && <div className="p-8 text-center text-muted-foreground">No users.</div>}
          {filtered.map((r) => (
            <div key={r.id} className="p-4 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="font-medium flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-muted-foreground" />
                  {r.profile?.full_name || r.email}
                  {r.roles.length === 0 && <Badge variant="secondary">user</Badge>}
                  {r.roles.map((rl) => <Badge key={rl}>{rl}</Badge>)}
                </div>
                <div className="text-xs text-muted-foreground ml-6">{r.email}</div>
              </div>
              <div className="flex gap-4 flex-wrap">
                {ROLES.map((role) => {
                  const has = r.roles.includes(role.key);
                  const key = `${r.id}:${role.key}`;
                  return (
                    <label key={role.key} className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={has}
                        disabled={pending === key}
                        onCheckedChange={(v) => toggle(r.id, role.key, v)}
                      />
                      <span className="flex items-center gap-1"><role.icon className="w-3.5 h-3.5" /> {role.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
