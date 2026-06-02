import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { getTransactionHistory } from "@/lib/wallet.functions";
import { useAuthSession } from "@/hooks/use-auth-session";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  Filter,
  Landmark,
  Smartphone,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/wallet/history")({
  head: () => ({ meta: [{ title: "Transaction History — Cash Winning League" }] }),
  component: TxnHistoryPage,
});

type FilterTab = "all" | "credit" | "debit" | "deposit" | "withdrawal" | "prize";

function TxnHistoryPage() {
  const { user, loading: authLoading } = useAuthSession();

  if (authLoading)
    return (
      <AppShell>
        <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  if (!user) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <Wallet className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-2 text-xl font-bold">Sign in to view history</h2>
          <Link to="/auth">
            <button className="mt-4 rounded-xl bg-gradient-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-glow">
              Sign In
            </button>
          </Link>
        </div>
      </AppShell>
    );
  }

  return <TxnHistoryInner />;
}

function TxnHistoryInner() {
  const fetchHistory = useServerFn(getTransactionHistory);
  const { data, isLoading } = useQuery({
    queryKey: ["txn-history"],
    queryFn: () => fetchHistory(),
  });
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const unified = useMemo(() => {
    if (!data) return [];
    const rows: UnifiedRow[] = [];

    // transactions
    for (const t of data.txns) {
      const note = t.note ?? "";
      let category: UnifiedRow["category"] = "other";
      if (note.toLowerCase().includes("deposit")) category = "deposit";
      else if (note.toLowerCase().includes("withdrawal")) category = "withdrawal";
      else if (note.toLowerCase().includes("won") || note.toLowerCase().includes("prize")) category = "prize";
      else if (note.toLowerCase().includes("bonus") || note.toLowerCase().includes("welcome")) category = "bonus";
      else if (note.toLowerCase().includes("refund")) category = "refund";
      else if (note.toLowerCase().includes("entry") || note.toLowerCase().includes("join")) category = "entry";

      rows.push({
        id: `txn-${t.id}`,
        kind: "txn",
        date: t.created_at,
        type: t.type as "credit" | "debit",
        amount: Number(t.amount),
        note,
        status: "completed",
        category,
      });
    }

    // deposits
    for (const d of data.deposits) {
      rows.push({
        id: `dep-${d.id}`,
        kind: "deposit",
        date: d.created_at,
        type: "credit" as const,
        amount: Number(d.amount),
        note: `Deposit via UTR ${d.upi_utr}`,
        status: d.status as any,
        category: "deposit",
        meta: d.payer_upi ? `Payer: ${d.payer_upi}` : undefined,
      });
    }

    // withdrawals
    for (const w of data.withdrawals) {
      rows.push({
        id: `wd-${w.id}`,
        kind: "withdrawal",
        date: w.created_at,
        type: "debit" as const,
        amount: Number(w.amount),
        note: `Withdrawal to ${w.upi_id}`,
        status: w.status as any,
        category: "withdrawal",
        meta: w.payout_ref ? `Ref: ${w.payout_ref}` : undefined,
      });
    }

    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return rows;
  }, [data]);

  const filtered = useMemo(() => {
    let rows = unified;
    if (filter === "credit") rows = rows.filter((r) => r.type === "credit");
    else if (filter === "debit") rows = rows.filter((r) => r.type === "debit");
    else if (filter === "deposit") rows = rows.filter((r) => r.category === "deposit");
    else if (filter === "withdrawal") rows = rows.filter((r) => r.category === "withdrawal");
    else if (filter === "prize") rows = rows.filter((r) => r.category === "prize");

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        const hay = `${r.id} ${r.note} ${r.meta ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return rows;
  }, [unified, filter, search]);

  const stats = useMemo(() => {
    const credits = unified.filter((r) => r.type === "credit" && r.status === "completed").reduce((s, r) => s + r.amount, 0);
    const debits = unified.filter((r) => r.type === "debit" && r.status === "completed").reduce((s, r) => s + r.amount, 0);
    return { credits, debits, net: credits - debits };
  }, [unified]);

  if (isLoading || !data) {
    return (
      <AppShell>
        <p className="p-8 text-center text-sm text-muted-foreground">Loading history…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/wallet" className="flex h-9 w-9 items-center justify-center rounded-xl bg-card shadow-soft">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-black">Transaction History</h1>
          <p className="text-xs text-muted-foreground">All credits, debits & requests</p>
        </div>
      </div>

      {/* Stats */}
      <section className="mt-5 grid grid-cols-3 gap-2">
        <StatCard label="Total In" value={`+₹${stats.credits.toFixed(0)}`} color="text-success" />
        <StatCard label="Total Out" value={`−₹${stats.debits.toFixed(0)}`} color="text-destructive" />
        <StatCard label="Net" value={`₹${stats.net.toFixed(0)}`} color={stats.net >= 0 ? "text-success" : "text-destructive"} />
      </section>

      {/* Search */}
      <section className="mt-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by ID, UTR, or contest…"
          className="h-10 rounded-xl pl-9 pr-9 bg-card border-0 shadow-soft focus-visible:ring-1"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </section>

      {/* Filters */}
      <section className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>All</FilterChip>
        <FilterChip active={filter === "credit"} onClick={() => setFilter("credit")}>Credits</FilterChip>
        <FilterChip active={filter === "debit"} onClick={() => setFilter("debit")}>Debits</FilterChip>
        <FilterChip active={filter === "deposit"} onClick={() => setFilter("deposit")}>Deposits</FilterChip>
        <FilterChip active={filter === "withdrawal"} onClick={() => setFilter("withdrawal")}>Withdrawals</FilterChip>
        <FilterChip active={filter === "prize"} onClick={() => setFilter("prize")}>Prizes</FilterChip>
      </section>

      {/* List */}
      <section className="mt-3 space-y-2 pb-4">
        {filtered.length === 0 && (
          <div className="rounded-2xl bg-card p-8 text-center shadow-soft">
            <Filter className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              {search.trim() ? "No transactions match your search." : "No transactions match this filter."}
            </p>
          </div>
        )}

        {groupByDate(filtered).map(([dateLabel, items]) => (
          <div key={dateLabel}>
            <div className="sticky top-0 z-10 mb-2 mt-4 px-1">
              <span className="rounded-lg bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {dateLabel}
              </span>
            </div>
            <div className="space-y-2">
              {items.map((row) => (
                <TxnRow key={row.id} row={row} />
              ))}
            </div>
          </div>
        ))}
      </section>
    </AppShell>
  );
}

// ---------- Types ----------

interface UnifiedRow {
  id: string;
  kind: "txn" | "deposit" | "withdrawal";
  date: string;
  type: "credit" | "debit";
  amount: number;
  note: string;
  status: "completed" | "pending" | "approved" | "paid" | "rejected";
  category: "deposit" | "withdrawal" | "prize" | "bonus" | "refund" | "entry" | "other";
  meta?: string;
}

// ---------- Helpers ----------

function groupByDate(rows: UnifiedRow[]): [string, UnifiedRow[]][] {
  const map = new Map<string, UnifiedRow[]>();
  for (const row of rows) {
    const d = new Date(row.date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let label: string;
    if (d.toDateString() === today.toDateString()) label = "Today";
    else if (d.toDateString() === yesterday.toDateString()) label = "Yesterday";
    else label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(row);
  }
  return Array.from(map.entries());
}

function TxnRow({ row }: { row: UnifiedRow }) {
  const isCredit = row.type === "credit";
  const { Icon, iconBg, iconColor } = getRowMeta(row);

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", iconBg)}>
        <Icon className={cn("h-5 w-5", iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-bold">{row.note}</span>
          {row.status !== "completed" && <StatusBadge status={row.status} />}
        </div>
        {row.meta && <div className="truncate text-[10px] text-muted-foreground">{row.meta}</div>}
        <div className="text-[10px] text-muted-foreground">
          {new Date(row.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          {" · "}
          <span className="capitalize">{row.category}</span>
        </div>
      </div>
      <div className={cn("shrink-0 text-right text-sm font-black", isCredit ? "text-success" : "text-destructive")}>
        {isCredit ? "+" : "−"}₹{row.amount.toFixed(0)}
      </div>
    </div>
  );
}

function getRowMeta(row: UnifiedRow) {
  if (row.category === "deposit")
    return { Icon: ArrowDownLeft, iconBg: "bg-emerald-100", iconColor: "text-emerald-700" };
  if (row.category === "withdrawal")
    return { Icon: ArrowUpRight, iconBg: "bg-rose-100", iconColor: "text-rose-700" };
  if (row.category === "prize")
    return { Icon: Trophy, iconBg: "bg-amber-100", iconColor: "text-amber-700" };
  if (row.category === "bonus")
    return { Icon: Gift, iconBg: "bg-sky-100", iconColor: "text-sky-700" };
  if (row.category === "refund")
    return { Icon: Landmark, iconBg: "bg-violet-100", iconColor: "text-violet-700" };
  if (row.category === "entry")
    return { Icon: Smartphone, iconBg: "bg-orange-100", iconColor: "text-orange-700" };
  if (row.type === "credit")
    return { Icon: ArrowDownLeft, iconBg: "bg-emerald-100", iconColor: "text-emerald-700" };
  return { Icon: ArrowUpRight, iconBg: "bg-rose-100", iconColor: "text-rose-700" };
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { text: string; className: string }> = {
    pending: { text: "Pending", className: "bg-amber-100 text-amber-700" },
    approved: { text: "Approved", className: "bg-sky-100 text-sky-700" },
    paid: { text: "Paid", className: "bg-emerald-100 text-emerald-700" },
    rejected: { text: "Rejected", className: "bg-rose-100 text-rose-700" },
    completed: { text: "Done", className: "bg-muted text-muted-foreground" },
  };
  const cfg = map[status] ?? map.completed;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider", cfg.className)}>
      {status === "pending" && <Clock className="h-2.5 w-2.5" />}
      {status === "approved" && <CheckCircle2 className="h-2.5 w-2.5" />}
      {status === "paid" && <CheckCircle2 className="h-2.5 w-2.5" />}
      {status === "rejected" && <XCircle className="h-2.5 w-2.5" />}
      {cfg.text}
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl bg-card p-3 text-center shadow-soft">
      <div className={cn("text-lg font-black", color)}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all",
        active ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-card text-muted-foreground shadow-soft hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
