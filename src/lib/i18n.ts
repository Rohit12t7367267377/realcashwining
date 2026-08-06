import { useEffect, useState } from "react";

export type Lang = "en" | "hi";
const KEY = "cwl_lang";
const EVT = "cwl-lang-change";

export const LANGS: Array<{ code: Lang; label: string }> = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
];

export function readLang(): Lang {
  if (typeof window === "undefined") return "en";
  return (localStorage.getItem(KEY) as Lang | null) ?? "en";
}

export function setLang(l: Lang) {
  localStorage.setItem(KEY, l);
  window.dispatchEvent(new Event(EVT));
}

/** App language with localStorage persistence, shared across components. */
export function useLang() {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const sync = () => setLangState(readLang());
    sync();
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, []);
  return { lang, setLang, label: LANGS.find((l) => l.code === lang)?.label ?? "English" };
}

const DICT: Record<string, Record<Lang, string>> = {
  wallet: { en: "Wallet", hi: "वॉलेट" },
  won: { en: "Won", hi: "जीते" },
  played: { en: "Played", hi: "खेले" },
  home: { en: "Home", hi: "होम" },
  ranks: { en: "Ranks", hi: "रैंक" },
  profile: { en: "Profile", hi: "प्रोफ़ाइल" },
  language: { en: "Language", hi: "भाषा" },
  theme: { en: "Theme", hi: "थीम" },
  askPlaceholder: { en: "Type your question…", hi: "अपना सवाल लिखें…" },
  send: { en: "Send", hi: "भेजें" },
  chatHistory: { en: "Chat history", hi: "चैट इतिहास" },
  voiceAssistant: { en: "Voice assistant", hi: "वॉइस असिस्टेंट" },
};

export function t(key: keyof typeof DICT, lang: Lang): string {
  return DICT[key]?.[lang] ?? String(key);
}
