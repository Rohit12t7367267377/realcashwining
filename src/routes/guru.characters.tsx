import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-store";
import { listGuruCharacters, selectGuruCharacter } from "@/lib/guru.functions";
import { Lock, Check, UserRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/guru/characters")({
  head: () => ({
    meta: [
      { title: "My AI Character — Pick Your Guru.AI Teacher" },
      { name: "description", content: "Choose your Guru.AI teacher character, see their teaching style and unlock new characters and costumes with XP, streaks and lessons." },
      { property: "og:title", content: "My AI Character — Guru.AI" },
      { property: "og:description", content: "Pick and unlock your personal AI teacher character in Guru.AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CharactersPage,
});

function CharactersPage() {
  const { state } = useUser();
  const qc = useQueryClient();
  const list = useServerFn(listGuruCharacters);
  const select = useServerFn(selectGuruCharacter);

  const { data } = useQuery({ queryKey: ["guru-characters"], queryFn: () => list(), enabled: state.loggedIn });
  const pick = useMutation({
    mutationFn: (character_id: string) => select({ data: { character_id } }),
    onSuccess: () => {
      toast.success("Character selected");
      qc.invalidateQueries({ queryKey: ["guru-characters"] });
      qc.invalidateQueries({ queryKey: ["guru-dashboard"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not select"),
  });

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to choose your character</h1>
          <Link to="/login"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <h1 className="text-2xl font-black">My AI Character</h1>
        <p className="mt-1 text-sm opacity-90">Each character teaches with a different style and tone.</p>
      </header>

      <section className="mt-4 grid gap-2 sm:grid-cols-2">
        {(data?.characters ?? []).map((c) => {
          const selected = data?.selectedId === c.id;
          return (
            <div key={c.id} className={`rounded-2xl p-4 shadow-soft ${selected ? "bg-gradient-primary text-primary-foreground" : "bg-card"}`}>
              <div className="flex items-start gap-3">
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg ${selected ? "bg-primary-foreground/20" : "bg-primary/10 text-primary"}`}>
                  {c.emoji || <UserRound className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black">{c.name}</div>
                  <div className={`text-[11px] ${selected ? "opacity-90" : "text-muted-foreground"}`}>
                    {[c.personality, c.teaching_style, c.tone].filter(Boolean).join(" • ")}
                  </div>
                  {c.tagline && <p className={`mt-1 text-xs ${selected ? "opacity-90" : "text-muted-foreground"}`}>{c.tagline}</p>}
                </div>
              </div>
              <div className="mt-3">
                {selected ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold"><Check className="h-3.5 w-3.5" /> Selected</span>
                ) : c.unlocked ? (
                  <Button size="sm" className="bg-gradient-primary" disabled={pick.isPending} onClick={() => pick.mutate(c.id)}>
                    Choose
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" /> {c.requirementText}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {(data?.costumes?.length ?? 0) > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Costumes</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data!.costumes.map((c) => (
              <div key={c.id} className="rounded-2xl bg-card p-3 text-center shadow-soft">
                <div className="text-2xl">{c.emoji ?? "🎽"}</div>
                <div className="mt-1 text-xs font-bold">{c.name}</div>
                <div className="text-[10px] text-muted-foreground">{c.unlocked ? "Unlocked" : c.requirementText}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
