import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { guruEngineSpeak } from "@/lib/guru-engine.functions";
import { useTeacherAudio } from "@/hooks/use-teacher-audio";
import type { LessonSegment } from "@/lib/lesson-segments";

/** Each segment gets its own audio: highlighting advances only on actual audio end. */
export function useLessonNarration() {
  const speak = useServerFn(guruEngineSpeak);
  const audio = useTeacherAudio();
  const sequence = useRef(0);
  const cache = useRef(new Map<string, Awaited<ReturnType<typeof speak>>>());
  const [activeSegment, setActiveSegment] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const stop = useCallback(() => {
    sequence.current += 1;
    audio.stop();
    setLoading(false);
  }, [audio.stop]);

  const start = useCallback(async (segments: LessonSegment[], index = 0) => {
    const token = ++sequence.current;
    audio.stop();
    setError(null);
    setEnded(false);
    const playAt = async (position: number): Promise<void> => {
      if (sequence.current !== token) return;
      const segment = segments[position];
      if (!segment) { setLoading(false); setEnded(true); return; }
      setActiveSegment(position);
      setLoading(true);
      try {
        const key = segment.narration;
        let result = cache.current.get(key);
        if (!result) {
          result = await speak({ data: { text: segment.narration.slice(0, 3000) } });
          if (sequence.current !== token) return;
          if (cache.current.size >= 24) cache.current.clear();
          cache.current.set(key, result);
        }
        if (sequence.current !== token) return;
        await audio.play({ ...result,
          onEnded: () => { if (sequence.current === token) void playAt(position + 1); },
          onError: () => { if (sequence.current === token) { setError("Audio could not play. Read the board or retry this section."); setLoading(false); } },
        });
      } catch (err) {
        if (sequence.current === token) setError(err instanceof Error ? err.message : "Voice unavailable. The board is still ready to read.");
      } finally {
        if (sequence.current === token) setLoading(false);
      }
    };
    await playAt(Math.max(0, Math.min(index, segments.length - 1)));
  }, [speak, audio.play, audio.stop]);

  useEffect(() => () => { sequence.current += 1; }, []);
  return { ...audio, stop, start, activeSegment, loading, error, ended };
}