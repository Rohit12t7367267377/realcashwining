import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Play, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { guruEngineSpeak, guruListVoices, guruSaveVoicePreference } from "@/lib/guru-engine.functions";
import { cn } from "@/lib/utils";

type VoiceRow = { code: string; label: string; language: string | null; accent: string | null; gender: string | null; style: string | null; speed: number | null };
const GENDERS = [["all", "All"], ["female", "Female"], ["male", "Male"], ["other", "Other"]] as const;
const SAMPLE = "Hello! I am your Guru.AI teacher. Let us learn this topic together, step by step.";

/** Teacher voice: pick a voice (female / male / other), set the speaking speed and preview it. Saved per student. */
export function ClassroomVoiceSettings({ active }: { active: boolean }) {
  const qc = useQueryClient();
  const list = useServerFn(guruListVoices);
  const save = useServerFn(guruSaveVoicePreference);
  const speak = useServerFn(guruEngineSpeak);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["guru-voices"], queryFn: () => list(), enabled: active, staleTime: 5 * 60_000 });
  const [gender, setGender] = useState<(typeof GENDERS)[number][0]>("all");
  const [code, setCode] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState<"save" | "preview" | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { if (data) { setCode(data.preferredVoice); setSpeed(Math.min(1.5, Math.max(0.5, data.preferredSpeed || 1))); } }, [data]);
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const voices = useMemo(() => ((data?.voices ?? []) as unknown as VoiceRow[]), [data]);
  const shown = voices.filter((v) => {
    const g = (v.gender ?? "").toLowerCase();
    return gender === "all" || (gender === "other" ? g !== "female" && g !== "male" : g === gender);
  });

  function stopPreview() { audioRef.current?.pause(); setPlaying(false); }

  async function persist() {
    await save({ data: { voiceCode: code, speed } });
    window.dispatchEvent(new CustomEvent("guru:voice-changed", { detail: { speed } }));
    void qc.invalidateQueries({ queryKey: ["guru-voices"] });
  }

  async function preview() {
    if (playing) return stopPreview();
    setBusy("preview");
    try {
      await persist(); // the server reads the saved voice and speed
      const r = await speak({ data: { text: SAMPLE, voiceCode: code ?? undefined } });
      const el = audioRef.current ?? new Audio();
      audioRef.current = el;
      el.src = `data:${r.mimeType || "audio/mpeg"};base64,${r.audioBase64}`;
      el.playbackRate = r.speed ?? speed;
      el.onended = () => setPlaying(false);
      el.onerror = () => setPlaying(false);
      await el.play();
      setPlaying(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not play the preview"); }
    finally { setBusy(null); }
  }

  async function saveOnly() {
    setBusy("save");
    try { await persist(); toast.success("Teacher voice saved"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save the voice"); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <Label className="flex items-center gap-1.5"><Volume2 className="h-4 w-4" /> Teacher voice</Label>
      {isLoading && <p className="text-xs text-muted-foreground">Loading voices…</p>}
      {isError && <p role="alert" className="text-xs text-destructive">Could not load voices. <button type="button" className="underline" onClick={() => void refetch()}>Retry</button></p>}
      {!isLoading && !isError && (
        <>
          <div role="group" aria-label="Voice type" className="flex gap-1.5 overflow-x-auto">
            {GENDERS.map(([v, l]) => (
              <button key={v} type="button" aria-pressed={gender === v} onClick={() => setGender(v)}
                className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-bold", gender === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{l}</button>
            ))}
          </div>
          <div className="grid max-h-48 gap-1.5 overflow-y-auto" role="radiogroup" aria-label="Teacher voice">
            <button type="button" role="radio" aria-checked={code === null} onClick={() => setCode(null)}
              className={cn("rounded-xl border px-3 py-2 text-left text-xs", code === null ? "border-primary bg-primary/10" : "border-border")}>
              <span className="font-bold">Default (teacher's own voice)</span>
            </button>
            {shown.map((v) => (
              <button key={v.code} type="button" role="radio" aria-checked={code === v.code} onClick={() => setCode(v.code)}
                className={cn("rounded-xl border px-3 py-2 text-left text-xs", code === v.code ? "border-primary bg-primary/10" : "border-border")}>
                <span className="font-bold">{v.label}</span>
                <span className="block text-[11px] text-muted-foreground">{[v.gender, v.accent, v.language, v.style].filter(Boolean).join(" · ")}</span>
              </button>
            ))}
            {shown.length === 0 && <p className="text-xs text-muted-foreground">No voices of this type are available yet.</p>}
          </div>
          <div>
            <Label className="flex justify-between text-xs"><span>Speaking speed</span><span className="tabular-nums">{speed.toFixed(2)}×</span></Label>
            <Slider className="mt-2" min={0.6} max={1.4} step={0.05} value={[Math.min(1.4, Math.max(0.6, speed))]} onValueChange={(v) => setSpeed(v[0] ?? 1)} aria-label="Speaking speed" />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>Slow</span><span>Normal</span><span>Fast</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void preview()}>
              {busy === "preview" ? <Loader2 className="animate-spin" /> : playing ? <Square /> : <Play />} {playing ? "Stop" : "Preview"}
            </Button>
            <Button type="button" disabled={busy !== null} onClick={() => void saveOnly()}>{busy === "save" ? <Loader2 className="animate-spin" /> : null} Save voice</Button>
          </div>
        </>
      )}
    </div>
  );
}
