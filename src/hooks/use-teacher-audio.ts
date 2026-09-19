import { useCallback, useEffect, useRef, useState } from "react";

export type LipSyncLevel = 0 | 1 | 2 | 3;

type TeacherAudio = {
  audioBase64: string;
  mimeType?: string;
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
    async ({ audioBase64, mimeType }: TeacherAudio) => {
      const token = ++tokenRef.current;
      stopAnalysis();
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = `data:${mimeType || "audio/mpeg"};base64,${audioBase64}`;
      audio.preload = "auto";

      const analysed = startAnalysis(audio);
      setSpeaking(true);
      audio.onended = () => {
        if (token !== tokenRef.current) return;
        stopAnalysis();
        setSpeaking(false);
      };
      audio.onerror = () => {
        if (token !== tokenRef.current) return;
        stopAnalysis();
        setSpeaking(false);
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

  return { play, stop, speaking, lipSyncLevel };
}