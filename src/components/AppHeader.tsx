import { Link } from "@tanstack/react-router";
import { BackButton } from "@/components/BackButton";
import { useAuthSession } from "@/hooks/use-auth-session";

/**
 * Slim app header: Back, brand and the profile avatar. Wallet, theme, language, search and notifications
 * live on the Profile page so the header stays uncluttered on phones.
 */
export function AppHeader() {
  const { user } = useAuthSession();
  const initials = (user?.email ?? "P").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 glass">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <BackButton />
          <Link to="/guru" className="press flex min-w-0 items-center gap-2" aria-label="Guru.AI home">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-primary font-black text-primary-foreground shadow-glow">G</span>
            <span className="truncate text-sm font-bold tracking-tight">Guru-G</span>
          </Link>
        </div>
        <Link
          to="/profile"
          aria-label="Profile"
          className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-[11px] font-black text-primary-foreground shadow-soft"
        >
          {initials}
        </Link>
      </div>
    </header>
  );
}
