import { TeacherCharacter } from "@/components/TeacherCharacter";
import type { LipSyncLevel } from "@/hooks/use-teacher-audio";

/**
 * Animated 2D AI teacher character standing at a whiteboard.
 * The character blinks, moves its pointer arm and its mouth animates while
 * speaking; board lines appear one by one as the lesson is taught.
 */
export function GuruTeacherBoard({
  title,
  lines,
  revealed,
  speaking,
  teacher = "Guru",
  lipSyncLevel,
}: {
  title: string;
  lines: string[];
  revealed: number;
  speaking: boolean;
  teacher?: string;
  lipSyncLevel?: LipSyncLevel;
}) {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-3 ring-1 ring-border">
      <div className="flex items-stretch gap-2">
        {/* Whiteboard */}
        <div className="min-w-0 flex-1 rounded-2xl bg-[hsl(150_35%_18%)] p-3 text-white shadow-lift ring-4 ring-[hsl(30_45%_35%)]">
          <div className="border-b border-white/30 pb-1 text-sm font-black tracking-wide">{title}</div>
          <ul className="mt-2 space-y-1.5">
            {lines.slice(0, revealed).map((l, i) => (
              <li key={i} className="animate-rise-in flex gap-2 text-[13px] leading-snug">
                <span className="opacity-60">{i + 1}.</span>
                <span className="font-medium">{l}</span>
              </li>
            ))}
            {revealed === 0 && <li className="text-[13px] opacity-70">Ask a topic and I&apos;ll teach it on the board…</li>}
          </ul>
        </div>

        <TeacherCharacter
          teacherName={teacher}
          state={speaking ? "speaking" : revealed > 0 ? "explaining" : "idle"}
          className="w-[104px] sm:w-[118px]"
          showStatus={false}
          lipSyncLevel={lipSyncLevel}
        />
      </div>

      <div className="mt-2 text-center text-[11px] font-bold text-muted-foreground">
        {speaking ? `${teacher} is teaching…` : `${teacher} — your AI teacher`}
      </div>
    </div>
  );
}
