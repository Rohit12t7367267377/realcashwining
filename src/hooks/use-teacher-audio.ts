import { useCallback, useEffect, useRef, useState } from "react";

export type LipSyncLevel = 0 | 1 | 2 | 3;

type TeacherAudio = {
  audioBase64: string;
  mimeType?: string;
  onEnded?: () => void;
  onError?: () => void;
};

type WebkitAudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

/** Plays teacher speech and derives four stable mouth shapes from its live volume. */
export function useTeacherAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const frameRef = useRef<number | null>(null);
  const tokenRef = useRef(0);
  const levelRef = useRef<LipSyncLevel>(0);
  const [speaking, setSpeaking] = useState(false);
  const [lipSyncLevel, setLipSyncLevel] = useState<LipSyncLevel>(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  const updateLevel = useCallback((next: LipSyncLevel) => {
    if (levelRef.current === next) return;
    levelRef.current = next;
    setLipSyncLevel(next);
  }, []);

  const stopAnalysis = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    updateLevel(0);
  }, [updateLevel]);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    stopAnalysis();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setSpeaking(false);
    setPaused(false);
    setProgress(0);
  }, [stopAnalysis]);

  const startAnalysis = useCallback(
    (audio: HTMLAudioElement) => {
      const AudioContextCtor = window.AudioContext ?? (window as WebkitAudioWindow).webkitAudioContext;
      if (!AudioContextCtor) return false;

      try {
        const context = contextRef.current ?? new AudioContextCtor();
        contextRef.current = context;
        const analyser = analyserRef.current ?? context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.55;
        analyserRef.current = analyser;

        if (!sourceRef.current) {
          const source = context.createMediaElementSource(audio);
          source.connect(analyser);
          analyser.connect(context.destination);
          sourceRef.current = source;
        }

        void context.resume().catch(() => undefined);
        const samples = new Uint8Array(analyser.fftSize);
        const sample = () => {
          analyser.getByteTimeDomainData(samples);
          let energy = 0;
          for (const value of samples) {
            const centered = (value - 128) / 128;
            energy += centered * centered;
          }
          const rms = Math.sqrt(energy / samples.length);
          const next: LipSyncLevel = rms < 0.025 ? 0 : rms < 0.07 ? 1 : rms < 0.14 ? 2 : 3;
          updateLevel(next);
          frameRef.current = requestAnimationFrame(sample);
        };
        sample();
        return true;
      } catch {
        return false;
      }
    },
    [updateLevel],
  );

  const play = useCallback(
    async ({ audioBase64, mimeType, onEnded, onError }: TeacherAudio) => {
      const token = ++tokenRef.current;
      stopAnalysis();
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = `data:${mimeType || "audio/mpeg"};base64,${audioBase64}`;
      audio.preload = "auto";

      const analysed = startAnalysis(audio);
      setPaused(false);
      setProgress(0);
      audio.onplaying = () => {
        if (token !== tokenRef.current) return;
        setSpeaking(true);
        setPaused(false);
      };
      audio.ontimeupdate = () => {
        if (token === tokenRef.current && Number.isFinite(audio.duration) && audio.duration > 0) {
          setProgress(audio.currentTime / audio.duration);
        }
      };
      audio.onended = () => {
        if (token !== tokenRef.current) return;
        stopAnalysis();
        setSpeaking(false);
        setProgress(1);
        onEnded?.();
      };
      audio.onerror = () => {
        if (token !== tokenRef.current) return;
        stopAnalysis();
        setSpeaking(false);
        onError?.();
      };

      try {
        await audio.play();
        if (!analysed) updateLevel(1);
      } catch (error) {
        if (token === tokenRef.current) {
          stopAnalysis();
          setSpeaking(false);
        }
        throw error;
      }
    },
    [startAnalysis, stopAnalysis, updateLevel],
  );

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;
    audio.pause();
    stopAnalysis();
    setSpeaking(false);
    setPaused(true);
  }, [stopAnalysis]);

  const resume = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    startAnalysis(audio);
    try { await audio.play(); }
    catch (err) { stopAnalysis(); setSpeaking(false); throw err; }
  }, [startAnalysis, stopAnalysis]);

  useEffect(
    () => () => {
      tokenRef.current += 1;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      audioRef.current?.pause();
      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      void contextRef.current?.close().catch(() => undefined);
    },
    [],
  );

  return { play, stop, pause, resume, speaking, paused, progress, lipSyncLevel };
}