import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { FolderTree, HelpCircle, Trophy, Users } from "lucide-react";
import { countQuestions } from "@/lib/admin-questions.functions";


export const Route = createFileRoute("/admin/")({ component: Page });

function Page() {
  const [stats, setStats] = useState({ cats: 0, qs: 0, contests: 0, users: 0 });
  useEffect(() => {
    (async () => {
      const [c, q, ct, p] = await Promise.all([
        supabase.from("categories").select("id", { count: "exact", head: true }),
        countQuestions().catch(() => ({ count: 0 })),
        supabase.from("contests").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      setStats({ cats: c.count ?? 0, qs: q.count ?? 0, contests: ct.count ?? 0, users: p.count ?? 0 });
    })();
  }, []);


  const cards = [
    { label: "Categories", value: stats.cats, icon: FolderTree, color: "from-rose-500 to-pink-500" },
    { label: "Questions", value: stats.qs, icon: HelpCircle, color: "from-amber-500 to-orange-500" },
    { label: "Contests", value: stats.contests, icon: Trophy, color: "from-violet-500 to-fuchsia-500" },
    { label: "Users", value: stats.users, icon: Users, color: "from-emerald-500 to-teal-500" },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-1">Admin Dashboard</h1>
      <p className="text-muted-foreground mb-8">Manage everything in your quiz platform.</p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5 overflow-hidden relative">
            <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full bg-gradient-to-br ${c.color} opacity-20`} />
            <c.icon className="w-6 h-6 mb-3 text-primary" />
            <div className="text-3xl font-bold">{c.value}</div>
            <div className="text-sm text-muted-foreground">{c.label}</div>
          </Card>
        ))}
      </div>
      <Card className="mt-8 p-6">
        <h2 className="font-semibold mb-2">Quick start</h2>
        <ol className="list-decimal list-inside text-sm space-y-1 text-muted-foreground">
          <li>Add categories (SSC, UPSC, Banking…) in <strong>Categories</strong>.</li>
          <li>Add MCQ questions to each category in <strong>Questions</strong>.</li>
          <li>Create paid or free contests in <strong>Contests</strong>.</li>
          <li>Adjust wallets, ban users, or grant admin in <strong>Users & Wallets</strong>.</li>
          <li>Tune daily rewards, referral bonus & banner in <strong>Settings</strong>.</li>
        </ol>
      </Card>
    </div>
  );
}
