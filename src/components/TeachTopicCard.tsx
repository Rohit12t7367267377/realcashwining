import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { GuruTeacherAvatar } from "@/components/GuruTeacherAvatar";

/** The same AI-teacher entry for every Guru.AI section: opens the shared Classroom and starts the lesson. */
export function TeachTopicCard({ topic, subtitle = "Your AI teacher explains this live on the board" }: { topic: string; subtitle?: string }) {
  return (
    <section className="relative mt-3 overflow-hidden rounded-3xl bg-gradient-hero p-4 text-primary-foreground shadow-lift animate-rise-in" aria-label="AI Teacher">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <div className="min-w-0 pb-1">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">AI Teacher · Classroom</p>
          <h2 className="mt-1 line-clamp-3 text-lg font-black leading-tight">{topic}</h2>
          <p className="mt-1 text-xs opacity-90">{subtitle}</p>
          <Link to="/guru/classroom" search={{ topic, go: "1" }}
            className="press mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-primary shadow-soft">
            <Play className="h-4 w-4" aria-hidden /> Start class
          </Link>
        </div>
        <GuruTeacherAvatar className="h-[170px] w-[100px] drop-shadow-lg" />
      </div>
    </section>
  );
}
