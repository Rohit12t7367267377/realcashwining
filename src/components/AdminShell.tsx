import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, FolderTree, HelpCircle, Trophy, Users, Settings, LogOut, Home, ShieldCheck,
  Banknote, BookOpen, Gavel, Radio, Award, Target, Sparkles, Zap, Wand2, Crown, Ticket, Image,
  Bell, Database, Download, AlertTriangle, MessageSquare, Eye, ShoppingBag, Gift, Megaphone, Star, Cog,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Item = { to: string; label: string; icon: React.ElementType; exact?: boolean };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Overview",
    items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    title: "Home",
    items: [
      { to: "/admin/banners", label: "Banners", icon: Image },
      { to: "/admin/categories", label: "Categories", icon: FolderTree },
      { to: "/admin/questions", label: "Questions", icon: HelpCircle },
      { to: "/admin/reading", label: "Reading Comprehension", icon: BookOpen },
      { to: "/admin/contests", label: "Contests", icon: Trophy },
      { to: "/admin/live-scores", label: "Live Scores", icon: Radio },
      { to: "/admin/cricket", label: "Cricket API", icon: Radio },
    ],
  },
  {
    title: "Ranks",
    items: [
      { to: "/admin/results", label: "Declare Results", icon: Gavel },
      { to: "/admin/automation", label: "Automation", icon: Cog },
      { to: "/admin/prizes", label: "Prize Distribution", icon: Award },

      { to: "/admin/missions", label: "Missions", icon: Target },
      { to: "/admin/events", label: "Seasonal Events", icon: Sparkles },
      { to: "/admin/xp", label: "XP & Levels", icon: Zap },
      { to: "/leaderboard", label: "View Leaderboard", icon: Trophy },
    ],
  },
  {
    title: "Elite Hub",
    items: [
      { to: "/admin/store", label: "Store & Orders", icon: ShoppingBag },
      { to: "/admin/memberships", label: "VIP Plans", icon: Crown },
      { to: "/admin/subscriptions", label: "Subscriptions", icon: Crown },
      { to: "/admin/coupons", label: "Coupons", icon: Ticket },
      { to: "/admin/payments", label: "Payments", icon: Banknote },
    ],
  },
  {
    title: "Guru.AI",
    items: [
      { to: "/admin/ai", label: "AI Studio", icon: Wand2 },
      { to: "/admin/library", label: "Books & Resources", icon: BookOpen },
      { to: "/admin/knowledge", label: "AI Knowledge Sources", icon: Database },
      { to: "/admin/catalog", label: "Exams & College", icon: FolderTree },
      { to: "/admin/teaching", label: "Teaching Engine", icon: Cog },
    ],
  },

  {
    title: "Profile & Creators",
    items: [
      { to: "/admin/users", label: "Users & Wallets", icon: Users },
      { to: "/admin/creators", label: "Creators & Monetization", icon: Star },
      { to: "/admin/ads", label: "Ads Manager", icon: Megaphone },
      { to: "/admin/community", label: "Community", icon: Users },
      { to: "/admin/comments", label: "Moderation", icon: Eye },
      { to: "/admin/kyc", label: "KYC", icon: ShieldCheck },
    ],
  },
  {
    title: "System",
    items: [
      { to: "/admin/notifications", label: "Push Notifications", icon: Bell },
      { to: "/admin/broadcasts", label: "In-App Alerts", icon: Megaphone },

      { to: "/admin/feedback", label: "Feedback", icon: MessageSquare },
      { to: "/admin/faqs", label: "FAQs", icon: HelpCircle },
      { to: "/admin/fraud", label: "Fraud & Anti-Cheat", icon: AlertTriangle },
      { to: "/admin/app-updates", label: "App Updates", icon: Download },
      { to: "/admin/roles", label: "Roles", icon: ShieldCheck },
            { to: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const ADMIN_GROUPS = GROUPS;
export const ADMIN_GROUP_ICONS = { Gift };

export function AdminShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();

  async function logout() {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  }

  return (
    <div className="min-h-screen flex bg-muted/30">
      <aside className="w-64 shrink-0 bg-card border-r flex flex-col">
        <div className="p-5 border-b">
          <div className="font-bold text-lg bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            CWL Admin
          </div>
          <div className="text-xs text-muted-foreground">Control panel</div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {g.title}
              </div>
              <div className="space-y-1">
                {g.items.map((n) => {
                  const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                        active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground",
                      )}
                    >
                      <n.icon className="w-4 h-4 shrink-0" />
                      {n.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t space-y-1">
          <Link to="/" className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted">
            <Home className="w-4 h-4" /> Back to app
          </Link>
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted text-destructive">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
