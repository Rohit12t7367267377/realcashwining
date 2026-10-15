import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Baby, BookOpen, ArrowRight, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuruBoardCanvas } from "@/components/GuruBoardCanvas";
import { TeacherCharacter } from "@/components/TeacherCharacter";
import { LessonPlayback } from "@/components/LessonPlayback";
import { useLessonNarration } from "@/hooks/use-lesson-narration";
import { guruEngineTurn } from "@/lib/guru-engine.functions";

type Scope = "school" | "college" | "exam" | "skill" | "galaxy" | "universal" | "library" | "classroom";
type Result = Awaited<ReturnType<typeof guruEngineTurn>>;
export type LessonContext = { topic: string; scope?: Scope; subject?: string; levelLabel?: string; material?: string; refId?: string; language?: "en" | "hi" };

/** Shared depth controls keep every learning section on the same teaching engine. */
export function GuruLessonDepth({ topic, scope = "universal", subject, levelLabel, material, refId, language }: LessonContext) {
  const teach = useServerFn(guruEngineTurn);
  const narration = useLessonNarration();
  const [lesson, setLesson] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"easier" | "deeper">("deeper");
  const [error, setError] = useState("");
  const request = useRef(0);
  const history = useRef<Array<{ role: "teacher" | "student"; content: string }>>([]);
  const key = [scope, topic, subject, levelLabel, refId, language].join("|");
  useEffect(() => {
    request.current += 1;
    history.current = [];
    setLesson(null); setError(""); setBusy(false);
    narration.stop();
    return () => { request.current += 1; narration.stop(); };
  }, [key, narration.stop]);

  async function run(nextMode: "easier" | "deeper" | "next") {
    if (!topic.trim() || busy) return;
    const token = ++request.current;
    narration.stop(); setBusy(true); setError("");
    if (nextMode !== "next") { history.current = []; setMode(nextMode); }
    try {
      const result = await teach({ data: {
        scope, topic: topic.trim().slice(0, 300), subject: subject?.slice(0, 120),
        levelLabel: levelLabel?.slice(0, 160), material: material?.slice(0, 6000), refId, language,
        mode: nextMode, studentText: nextMode === "next" ? `Continue the ${mode === "deeper" ? "deep" : "easy"} lesson; cover the next unaddressed subtopic from its roadmap with the same level and relevant study materials.` : undefined,
        history: history.current.slice(-8),
      } });
      if (request.current !== token) return;
      setLesson(result);
      history.current.push({ role: "teacher", content: result.speech.slice(0, 1200) });
    } catch (e) { if (request.current === token) setError(e instanceof Error ? e.message : "Could not prepare this lesson."); }
    finally { if (request.current === token) setBusy(false); }
  }

  function download() {
    if (!lesson) return;
    const blob = new Blob([`${lesson.title}\n\nAI-generated study notes\n\n${lesson.speech}`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${lesson.title.replace(/[^a-zA-Z0-9 -]/g, "").slice(0, 70) || "study-notes"}.txt`; a.click(); URL.revokeObjectURL(url);
  }

  return <section className="mt-4 min-w-0 space-y-3" aria-label="Lesson depth">
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" disabled={busy || !topic.trim()} onClick={() => void run("easier")}><Baby className="h-4 w-4" /> Explain Easy</Button>
      <Button disabled={busy || !topic.trim()} onClick={() => void run("deeper")}><BookOpen className="h-4 w-4" /> Explain Deeply</Button>
      {busy && <span role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Preparing lesson…</span>}
    </div>
    {error && <div role="alert" className="text-sm text-destructive">{error}</div>}
    {lesson && !busy && <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{mode === "deeper" ? "Deep explanation" : "Easy explanation"} · AI-generated study material{lesson.groundedSources ? " · Authorized sources used" : " · No indexed source found; not an official syllabus"}</span>
        <TeacherCharacter teacherName={lesson.teacher.name} state={narration.speaking ? "speaking" : "idle"} lipSyncLevel={narration.lipSyncLevel} showStatus={false} className="w-16" />
      </div>
      <GuruBoardCanvas title={lesson.title} blocks={lesson.board} revealed={lesson.board.length} stepLabel={lesson.stepLabel} activeSegment={narration.speaking || narration.paused ? narration.activeSegment : undefined} />
      <LessonPlayback narration={narration} segments={lesson.segments} />
      {lesson.question && <p className="text-sm"><strong>Check your understanding: </strong>{lesson.question.prompt}{lesson.question.hint && <span className="block text-muted-foreground">Hint: {lesson.question.hint}</span>}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void run("next")} disabled={busy}><ArrowRight className="h-4 w-4" /> Continue topic</Button>
        <Button variant="outline" onClick={download}><Download className="h-4 w-4" /> Study notes</Button>
      </div>
    </>}
  </section>;
}