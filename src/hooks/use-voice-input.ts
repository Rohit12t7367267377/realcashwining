import { useCallback, useState } from "react";
import { toast } from "sonner";

/** Browser speech-to-text for typed-question boxes. Calls onText with the recognised sentence. */
export function useVoiceInput(lang: "en" | "hi" | string) {
  const [listening, setListening] = useState(false);
  const start = useCallback((onText: (t: string) => void) => {
    const w = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return toast.info("Voice input isn't supported on this browser — please type.");
    const rec = new SR();
    rec.lang = lang === "hi" ? "hi-IN" : "en-IN";
    rec.interimResults = false;
    rec.onresult = (ev: any) => onText(String(ev.results[0][0].transcript ?? "")); // eslint-disable-line @typescript-eslint/no-explicit-any
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  }, [lang]);
  return { listening, start };
}
