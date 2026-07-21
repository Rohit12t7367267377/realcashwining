import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, FolderTree, HelpCircle, Trophy, Users, Settings, LogOut, Home, ShieldCheck, Banknote, BookOpen, Gavel, Radio, Award, Target, Sparkles, Zap, Wand2, Crown, Ticket, Image, Bell, Download, AlertTriangle, MessageSquare, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/payments", label: "Payments", icon: Banknote },
  { to: "/admin/categories", label: "Categories", icon: FolderTree },
  { to: "/admin/questions", label: "Questions", icon: HelpCircle },
  { to: "/admin/ai", label: "AI Studio", icon: Wand2 },
  { to: "/admin/contests", label: "Contests", icon: Trophy },
  { to: "/admin/results", label: "Declare Results", icon: Gavel },
  { to: "/admin/live-scores", label: "Live Scores", icon: Radio },
  { to: "/admin/cricket", label: "Cricket API", icon: Radio },
  { to: "/admin/missions", label: "Missions", icon: Target },
  { to: "/admin/events", label: "Seasonal Events", icon: Sparkles },
  { to: "/admin/xp", label: "XP & Levels", icon: Zap },
  { to: "/leaderboard", label: "Leaderboard", icon: Award },
  { to: "/admin/memberships", label: "VIP Plans", icon: Crown },
  { to: "/admin/coupons", label: "Coupons", icon: Ticket },
  { to: "/admin/banners", label: "Banners", icon: Image },
  { to: "/admin/broadcasts", label: "Notifications", icon: Bell },
  { to: "/admin/app-updates", label: "App Updates", icon: Download },
  { to: "/admin/faqs", label: "FAQs", icon: HelpCircle },
  { to: "/admin/feedback", label: "Feedback", icon: MessageSquare },
  { to: "/admin/kyc", label: "KYC", icon: ShieldCheck },
  { to: "/admin/fraud", label: "Fraud & Anti-Cheat", icon: AlertTriangle },
  { to: "/admin/comments", label: "Moderation", icon: Eye },
  { to: "/admin/books", label: "Books", icon: BookOpen },
  { to: "/admin/users", label: "Users & Wallets", icon: Users },
  { to: "/admin/roles", label: "Roles", icon: ShieldCheck },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();

  async function logout() {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  }

  return (
    <div className="min-h-screen flex bg-muted/30">
      <aside className="w-64 bg-card border-r flex flex-col">
        <div className="p-5 border-b">
          <div className="font-bold text-lg bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            CWL Admin
          </div>
          <div className="text-xs text-muted-foreground">Control panel</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((n) => {
            const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
                )}
              >
                <n.icon className="w-4 h-4" />
                {n.label}
              </Link>
            );
          })}
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
