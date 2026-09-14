import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRoleManagement, manageAdminRole } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, ShieldCheck, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/admin/roles")({ component: Page });

type AdminRole = { id: string; name: string; label: string; description: string | null; system: boolean; permissions: string[] };

type Row = {
  id: string; email: string;
  profile: { full_name: string | null; phone: string | null } | null;
  roleIds: string[];
};

function Page() {
  const list = useServerFn(getRoleManagement);
  const setRole = useServerFn(manageAdminRole);
  const [rows, setRows] = useState<Row[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [actorId, setActorId] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await list();
      setRows(data.users as Row[]);
      setRoles(data.roles as AdminRole[]);
      setActorId(data.actorId);
    }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => rows.filter((r) => (r.email + " " + (r.profile?.full_name ?? "")).toLowerCase().includes(q.toLowerCase())),
    [rows, q]
  );

  async function toggle(userId: string, role: AdminRole, enabled: boolean) {
    const action = enabled ? "assign" : "revoke";
    if (!window.confirm(`${action === "assign" ? "Assign" : "Revoke"} ${role.label}?`)) return;
    const reason = window.prompt(`Reason to ${action} ${role.label}?`);
    if (!reason?.trim()) return;
    const key = `${userId}:${role.id}`;
    setPending(key);
    setRows((prev) => prev.map((r) => r.id !== userId ? r : {
      ...r,
      roleIds: enabled ? Array.from(new Set([...r.roleIds, role.id])) : r.roleIds.filter((id) => id !== role.id),
    }));
    try {
      await setRole({ data: { userId, roleId: role.id, enabled, reason } });
      toast.success(`${enabled ? "Assigned" : "Revoked"} ${role.label}`);
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
          <h1 className="text-3xl font-bold">Roles & Permissions</h1>
          <p className="text-muted-foreground">Assign database-enforced operational roles. Every change is audited.</p>
        </div>
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-6">
        {roles.map((role) => (
          <Card key={role.id} className="p-4 border bg-card">
            <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="w-4 h-4 text-primary" /> {role.label}</div>
            <div className="text-xs mt-1 text-muted-foreground">{role.description || "Operational role"}</div>
            <div className="mt-3 flex flex-wrap gap-1">
              {role.permissions.slice(0, 4).map((permission) => <Badge key={permission} variant="secondary" className="text-[10px]">{permission}</Badge>)}
              {role.permissions.length > 4 && <Badge variant="outline" className="text-[10px]">+{role.permissions.length - 4}</Badge>}
            </div>
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
                   {r.roleIds.length === 0 && <Badge variant="secondary">No control-center role</Badge>}
                   {r.roleIds.map((roleId) => {
                     const role = roles.find((item) => item.id === roleId);
                     return role ? <Badge key={roleId}>{role.label}</Badge> : null;
                   })}
                </div>
                <div className="text-xs text-muted-foreground ml-6">{r.email}</div>
              </div>
              <div className="flex gap-4 flex-wrap">
                 {roles.map((role) => {
                   const has = r.roleIds.includes(role.id);
                   const key = `${r.id}:${role.id}`;
                  return (
                     <label key={role.id} className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={has}
                         disabled={pending === key || r.id === actorId}
                         onCheckedChange={(value) => toggle(r.id, role, value)}
                      />
                       <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> {role.label}</span>
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
