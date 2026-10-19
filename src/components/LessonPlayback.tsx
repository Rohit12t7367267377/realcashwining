import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Pause, Play, Square, Loader2, RotateCcw } from "lucide-react";
import type { useLessonNarration } from "@/hooks/use-lesson-narration";
import type { LessonSegment } from "@/lib/lesson-segments";

export function LessonPlayback({ narration, segments, position }: { narration: ReturnType<typeof useLessonNarration>; segments: LessonSegment[]; position?: number }) {
  if (!segments.length) return null;
  // While audio is active it owns the position; otherwise the shared reading position (teacher board or book) does.
  const active = narration.speaking || narration.paused || narration.loading;
  const current = Math.max(0, Math.min(active || position === undefined ? narration.activeSegment : position, segments.length - 1));
  return <div className="mt-3 space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="icon" aria-label="Previous lesson section" disabled={current === 0 || narration.loading} onClick={() => void narration.start(segments, current - 1)}><ChevronLeft /></Button>
      <Button variant="outline" onClick={() => {
        if (narration.speaking) narration.pause();
        else if (narration.paused) void narration.resume().catch(() => void narration.start(segments, current));
        else void narration.start(segments, narration.ended && position === undefined ? 0 : current);
      }} disabled={narration.loading}>
        {narration.loading ? <Loader2 className="animate-spin" /> : narration.speaking ? <Pause /> : <Play />}
        {narration.loading ? "Loading voice…" : narration.speaking ? "Pause" : narration.paused ? "Resume" : "Listen"}
      </Button>
      <Button variant="outline" size="icon" aria-label="Stop lesson narration" onClick={narration.stop}><Square /></Button>
      <Button variant="outline" size="icon" aria-label="Next lesson section" disabled={current >= segments.length - 1 || narration.loading} onClick={() => void narration.start(segments, current + 1)}><ChevronRight /></Button>
      <span className="text-xs text-muted-foreground" aria-live="polite">Section {current + 1} of {segments.length}</span>
      <progress aria-label="Current section speech progress" className="h-2 w-24 accent-primary" value={narration.progress} max={1} />
    </div>
    {narration.error && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
      <span>{narration.error}</span>
      <Button size="sm" variant="outline" onClick={() => void narration.start(segments, current)}><RotateCcw /> Retry voice</Button>
    </div>}
  </div>;
}