import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

let supabaseSyncStarted = false;
function startSupabaseSync() {
  if (supabaseSyncStarted || typeof window === "undefined") return;
  supabaseSyncStarted = true;
  const apply = (session: any) => {
    const u = session?.user;
    if (u) {
      const base = current ?? load();
      const name = u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split("@")[0] || "Player";
      const phone = u.phone || u.user_metadata?.phone || base.phone || "";
      const referralCode = base.referralCode || ("CWL" + Math.random().toString(36).slice(2, 7).toUpperCase());
      save({ ...base, loggedIn: true, name, phone, referralCode, joinedAt: base.joinedAt || Date.now() });
    } else {
      const base = current ?? load();
      if (base.loggedIn) save({ ...base, loggedIn: false });
    }
  };
  supabase.auth.getSession().then(({ data }) => apply(data.session));
  supabase.auth.onAuthStateChange((_e, session) => apply(session));
}

const KEY = "cwl_user_state_v1";

export type UserState = {
  loggedIn: boolean;
  name: string;
  phone: string;
  referralCode: string;
  wallet: number;
  winnings: number;
  contestsPlayed: number;
  contestsWon: number;
  totalScore: number;
  joinedAt: number;
  history: { contestId: string; title: string; score: number; total: number; reward: number; at: number }[];
  txns: { id: string; type: "credit" | "debit"; amount: number; note: string; at: number }[];
  dailyClaimedOn?: string;
  referrals: number;
};

const DEFAULT: UserState = {
  loggedIn: false,
  name: "",
  phone: "",
  referralCode: "",
  wallet: 0,
  winnings: 0,
  contestsPlayed: 0,
  contestsWon: 0,
  totalScore: 0,
  joinedAt: 0,
  history: [],
  txns: [],
  referrals: 0,
};

function load(): UserState {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

let listeners: Array<() => void> = [];
let current: UserState | null = null;

function save(s: UserState) {
  current = s;
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(s));
  }
  listeners.forEach((l) => l());
}

export function useUser() {
  const [state, setState] = useState<UserState>(() => {
    if (current) return current;
    current = load();
    return current;
  });

  useEffect(() => {
    const l = () => setState(current!);
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);

  const update = useCallback((patch: Partial<UserState> | ((s: UserState) => UserState)) => {
    const next = typeof patch === "function" ? patch(current!) : { ...current!, ...patch };
    save(next);
  }, []);

  const login = useCallback((name: string, phone: string) => {
    const code = "CWL" + Math.random().toString(36).slice(2, 7).toUpperCase();
    save({
      ...DEFAULT,
      loggedIn: true,
      name,
      phone,
      referralCode: code,
      wallet: 0,
      joinedAt: Date.now(),
      txns: [],
    });
  }, []);

  const logout = useCallback(() => save(DEFAULT), []);

  const addMoney = useCallback((amount: number, note = "Added via UPI") => {
    update((s) => ({
      ...s,
      wallet: s.wallet + amount,
      txns: [{ id: crypto.randomUUID(), type: "credit", amount, note, at: Date.now() }, ...s.txns],
    }));
  }, [update]);

  const debit = useCallback((amount: number, note: string) => {
    if (!current || current.wallet < amount) return false;
    update((s) => ({
      ...s,
      wallet: s.wallet - amount,
      txns: [{ id: crypto.randomUUID(), type: "debit", amount, note, at: Date.now() }, ...s.txns],
    }));
    return true;
  }, [update]);

  const recordResult = useCallback(
    (contestId: string, title: string, score: number, total: number, reward: number) => {
      update((s) => ({
        ...s,
        contestsPlayed: s.contestsPlayed + 1,
        contestsWon: s.contestsWon + (reward > 0 ? 1 : 0),
        totalScore: s.totalScore + score,
        wallet: s.wallet + reward,
        winnings: s.winnings + reward,
        history: [{ contestId, title, score, total, reward, at: Date.now() }, ...s.history].slice(0, 50),
        txns: reward > 0 ? [{ id: crypto.randomUUID(), type: "credit", amount: reward, note: `Won: ${title}`, at: Date.now() }, ...s.txns] : s.txns,
      }));
    },
    [update]
  );

  const claimDaily = useCallback(() => {
    const today = new Date().toDateString();
    if (current?.dailyClaimedOn === today) return 0;
    const reward = Math.floor(Math.random() * 16) + 5; // 5-20
    update((s) => ({
      ...s,
      dailyClaimedOn: today,
      wallet: s.wallet + reward,
      txns: [{ id: crypto.randomUUID(), type: "credit", amount: reward, note: "Daily reward 🎁", at: Date.now() }, ...s.txns],
    }));
    return reward;
  }, [update]);

  return { state, update, login, logout, addMoney, debit, recordResult, claimDaily };
}
