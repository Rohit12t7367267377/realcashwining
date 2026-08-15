/** Browser-safe catalogue shared by the Guru.AI Skills module (no server imports). */
export type SkillTrack = {
  slug: string;
  title: string;
  emoji: string;
  blurb: string;
  levels: string[];
};

export const GURU_SKILL_TRACKS: SkillTrack[] = [
  {
    slug: "spoken-english",
    title: "Spoken English",
    emoji: "🗣️",
    blurb: "Daily conversation, pronunciation and confidence drills.",
    levels: ["Everyday greetings", "Describing people & places", "Opinions & debates", "Interview English"],
  },
  {
    slug: "coding",
    title: "Coding Basics",
    emoji: "💻",
    blurb: "Logic building, Python fundamentals and problem solving.",
    levels: ["Variables & loops", "Functions & lists", "Dictionaries & files", "Mini projects"],
  },
  {
    slug: "maths-tricks",
    title: "Maths Speed Tricks",
    emoji: "⚡",
    blurb: "Vedic shortcuts for competitive exams and quizzes.",
    levels: ["Multiplication tricks", "Squares & roots", "Percentages", "Data interpretation"],
  },
  {
    slug: "gk-current-affairs",
    title: "GK & Current Affairs",
    emoji: "🌏",
    blurb: "Static GK plus the news that exams actually ask about.",
    levels: ["India basics", "World geography", "Polity & economy", "This month in news"],
  },
  {
    slug: "reading-comprehension",
    title: "Reading Comprehension",
    emoji: "📖",
    blurb: "Passage reading strategy, inference and vocabulary.",
    levels: ["Skimming & scanning", "Inference questions", "Tone & author intent", "Timed passages"],
  },
  {
    slug: "finance",
    title: "Money & Finance",
    emoji: "💰",
    blurb: "Saving, budgeting, UPI safety and simple investing.",
    levels: ["Budget basics", "Banking & UPI safety", "Interest & loans", "Investing 101"],
  },
];

export function findSkillTrack(slug: string) {
  return GURU_SKILL_TRACKS.find((t) => t.slug === slug) ?? null;
}
