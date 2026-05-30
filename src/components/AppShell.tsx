import { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl animate-blob" />
        <div className="absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-secondary/20 blur-3xl animate-blob" style={{ animationDelay: "4s" }} />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-accent/20 blur-3xl animate-blob" style={{ animationDelay: "8s" }} />
      </div>
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
