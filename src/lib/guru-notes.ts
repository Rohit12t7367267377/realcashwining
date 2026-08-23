/** Browser-safe catalogue for the Guru.AI Class Notes section (no server imports). */

export const NOTES_BOARDS = [
  { id: "cbse", name: "CBSE", emoji: "🏛️" },
  { id: "icse", name: "ICSE / CISCE", emoji: "🎓" },
  { id: "up", name: "UP Board", emoji: "🕌" },
  { id: "bihar", name: "Bihar Board", emoji: "📜" },
  { id: "mp", name: "MP Board", emoji: "🌾" },
  { id: "rajasthan", name: "Rajasthan Board", emoji: "🏜️" },
  { id: "maharashtra", name: "Maharashtra Board", emoji: "⛵" },
  { id: "west-bengal", name: "West Bengal Board", emoji: "🐅" },
  { id: "tamil-nadu", name: "Tamil Nadu Board", emoji: "🛕" },
  { id: "gujarat", name: "Gujarat Board", emoji: "🦁" },
  { id: "karnataka", name: "Karnataka Board", emoji: "🌿" },
  { id: "ap-ts", name: "AP / Telangana Board", emoji: "🌶️" },
  { id: "kerala", name: "Kerala Board", emoji: "🌴" },
  { id: "punjab", name: "Punjab Board", emoji: "🌻" },
  { id: "haryana", name: "Haryana Board", emoji: "🐄" },
  { id: "jac", name: "Jharkhand (JAC)", emoji: "⛏️" },
  { id: "nios", name: "NIOS (Open School)", emoji: "🧭" },
] as const;

export const NOTES_CLASSES = Array.from({ length: 12 }, (_, i) => String(i + 1));

const PRIMARY = ["Mathematics", "English", "Hindi", "Environmental Studies (EVS)", "General Knowledge", "Computer Basics"];
const MIDDLE = ["Mathematics", "Science", "Social Science", "English", "Hindi", "Sanskrit", "Computer Science"];
const SECONDARY = ["Mathematics", "Science (Physics)", "Science (Chemistry)", "Science (Biology)", "Social Science", "English", "Hindi", "Information Technology"];
const SENIOR = [
  "Physics", "Chemistry", "Biology", "Mathematics", "Computer Science", "English Core",
  "Accountancy", "Business Studies", "Economics", "History", "Geography", "Political Science", "Psychology",
];

/** Subjects offered for a given class number (1-12). */
export function subjectsForClass(cls: string): string[] {
  const n = Number(cls);
  if (n <= 5) return PRIMARY;
  if (n <= 8) return MIDDLE;
  if (n <= 10) return SECONDARY;
  return SENIOR;
}

/** Bright gradient token pairs so each subject card looks distinct. */
export const NOTE_GRADIENTS = [
  "from-rose-500 to-orange-400",
  "from-sky-500 to-cyan-400",
  "from-violet-500 to-fuchsia-400",
  "from-emerald-500 to-lime-400",
  "from-amber-500 to-yellow-400",
  "from-indigo-500 to-blue-400",
  "from-pink-500 to-rose-400",
  "from-teal-500 to-emerald-400",
];

export function gradientFor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return NOTE_GRADIENTS[h % NOTE_GRADIENTS.length];
}

export type NotesPayload = {
  title: string;
  intro: string;
  /** "Explain simply" version of the topic. */
  simple: string;
  keyPoints: string[];
  importantPoints: string[];
  sections: { heading: string; body: string }[];
  formulas: string[];
  examples: { question: string; solution: string }[];
  practice: { question: string; answer: string }[];
  revision: string[];
  examTips: string[];
  nextTopics: string[];
};

export type QuizItem = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

/** Local progress tracking per topic (board/class/subject/topic). */
export type TopicProgress = { opened: boolean; quizScore: number | null; revised: boolean };

const PROGRESS_KEY = "guru-school-progress";

function progressId(p: { board: string; className: string; subject: string; topic: string }) {
  return [p.board, p.className, p.subject, p.topic].join("|").toLowerCase();
}

export function readProgress(): Record<string, TopicProgress> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? "{}") as Record<string, TopicProgress>;
  } catch {
    return {};
  }
}

export function saveProgress(
  key: { board: string; className: string; subject: string; topic: string },
  patch: Partial<TopicProgress>,
) {
  if (typeof window === "undefined") return;
  const all = readProgress();
  const id = progressId(key);
  all[id] = { opened: true, quizScore: null, revised: false, ...(all[id] ?? {}), ...patch };
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
}

export function getProgress(
  all: Record<string, TopicProgress>,
  key: { board: string; className: string; subject: string; topic: string },
): TopicProgress | null {
  return all[progressId(key)] ?? null;
}
