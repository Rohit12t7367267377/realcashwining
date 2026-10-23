import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { guruEngineSpeak } from "@/lib/guru-engine.functions";
import { useTeacherAudio } from "@/hooks/use-teacher-audio";
import type { LessonSegment } from "@/lib/lesson-segments";

/** Split long narration into short sentence-aligned pieces so no request is truncated or times out. */
export function chunkNarration(text: string, size = 420): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const out: string[] = [];
  let buf = "";
  for (const part of clean.split(/(?<=[.!?।])\s+/)) {
    if (part.length > size) {
      if (buf) { out.push(buf.trim()); buf = ""; }
      for (let i = 0; i < part.length; i += size) out.push(part.slice(i, i + size));
      continue;
    }
    if ((buf + " " + part).trim().length > size) { out.push(buf.trim()); buf = part; }
    else buf = `${buf} ${part}`;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/**
 * Each segment is spoken as short chunks. The next chunk is fetched while the current one plays,
 * so the voice never pauses or cuts off between sentences; a failed fetch is retried once.
 * Highlighting advances only on actual audio end.
 */
export function useLessonNarration() {
  const speak = useServerFn(guruEngineSpeak);
  const audio = useTeacherAudio();
  const sequence = useRef(0);
  const retried = useRef("");
  type Spoken = Awaited<ReturnType<typeof speak>>;
  const cache = useRef(new Map<string, Promise<Spoken>>());
  const [activeSegment, setActiveSegment] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const stop = useCallback(() => {
    sequence.current += 1;
    audio.stop();
    setLoading(false);
  }, [audio.stop]);

  // A changed voice or speed must never replay old audio.
  useEffect(() => {
    const clear = () => cache.current.clear();
    window.addEventListener("guru:voice-changed", clear);
    return () => window.removeEventListener("guru:voice-changed", clear);
  }, []);

  const fetchChunk = useCallback((text: string): Promise<Spoken> => {
    const hit = cache.current.get(text);
    if (hit) return hit;
    const run = async () => {
      try { return await speak({ data: { text } }); }
      catch { await new Promise((r) => setTimeout(r, 600)); return speak({ data: { text } }); }
    };
    const p = run();
    if (cache.current.size >= 40) cache.current.clear();
    cache.current.set(text, p);
    p.catch(() => cache.current.delete(text));
    return p;
  }, [speak]);

  const start = useCallback(async (segments: LessonSegment[], index = 0) => {
    const token = ++sequence.current;
    audio.stop();
    setError(null);
    setEnded(false);
    const plan = segments.map((seg) => chunkNarration(seg.narration));
    const playAt = async (position: number, chunk: number): Promise<void> => {
      if (sequence.current !== token) return;
      const chunks = plan[position];
      if (!chunks) { setLoading(false); setEnded(true); return; }
      if (chunk >= chunks.length) { void playAt(position + 1, 0); return; }
      setActiveSegment(position);
      setLoading(true);
      try {
        const result = await fetchChunk(chunks[chunk]);
        if (sequence.current !== token) return;
        // Warm up whatever plays next while this chunk is speaking.
        const ahead = [chunks[chunk + 1], chunks[chunk + 2] ?? plan[position + 1]?.[0]].filter(Boolean) as string[];
        for (const u of ahead) void fetchChunk(u).catch(() => undefined);
        await audio.play({ ...result,
          onEnded: () => { if (sequence.current === token) void playAt(position, chunk + 1); },
          onError: () => {
            if (sequence.current !== token) return;
            // One quiet retry with a fresh copy before giving up, so a hiccup never ends the lesson.
            cache.current.delete(chunks[chunk]);
            if (retried.current !== `${position}:${chunk}`) { retried.current = `${position}:${chunk}`; void playAt(position, chunk); return; }
            setError("Audio could not play. Read the board or retry this section."); setLoading(false);
          },
        });
      } catch (err) {
        if (sequence.current === token) setError(err instanceof Error ? err.message : "Voice unavailable. The board is still ready to read.");
      } finally {
        if (sequence.current === token) setLoading(false);
      }
    };
    await playAt(Math.max(0, Math.min(index, segments.length - 1)), 0);
  }, [fetchChunk, audio.play, audio.stop]);

  useEffect(() => () => { sequence.current += 1; }, []);
  return { ...audio, stop, start, activeSegment, loading, error, ended };
}
