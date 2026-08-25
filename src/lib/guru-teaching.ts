/** Browser-safe teaching-style catalogue shared by Guru.AI characters and Universal AI. */

export type TeachingStyleId =
  | "friendly"
  | "strict"
  | "simple"
  | "exam"
  | "concept"
  | "fast"
  | "detailed";

export type TeachingStyle = {
  id: TeachingStyleId;
  label: string;
  emoji: string;
  blurb: string;
};

export const TEACHING_STYLES: TeachingStyle[] = [
  { id: "friendly", label: "Friendly", emoji: "😊", blurb: "Warm, encouraging, lots of praise." },
  { id: "strict", label: "Strict", emoji: "📏", blurb: "No shortcuts, corrections and discipline." },
  { id: "simple", label: "Simple", emoji: "🧒", blurb: "Very easy words, one idea at a time." },
  { id: "exam", label: "Exam-focused", emoji: "🎯", blurb: "Marks, patterns, tricks and past questions." },
  { id: "concept", label: "Concept-focused", emoji: "💡", blurb: "Deep 'why' before any formula." },
  { id: "fast", label: "Fast", emoji: "⚡", blurb: "Crisp summary, minimum words." },
  { id: "detailed", label: "Detailed", emoji: "📖", blurb: "Long, thorough, every step shown." },
];

const STYLE_DIRECTIVES: Record<TeachingStyleId, string> = {
  friendly:
    "Teaching style: FRIENDLY. Be warm and encouraging, greet the student, praise effort, use emojis sparingly and never make them feel silly.",
  strict:
    "Teaching style: STRICT. Be disciplined and direct. Correct mistakes plainly, set expectations, insist on practice and revision. No flattery.",
  simple:
    "Teaching style: SIMPLE. Use very easy vocabulary, short sentences, one idea per line, and an everyday analogy. Avoid jargon; if a term is needed, define it immediately.",
  exam:
    "Teaching style: EXAM-FOCUSED. Focus on what is asked in exams: marks weightage, question patterns, model answers, shortcuts, and common traps. End with 2 likely exam questions.",
  concept:
    "Teaching style: CONCEPT-FOCUSED. Build intuition first — explain why it works before any formula or rule, then connect it to the formula.",
  fast: "Teaching style: FAST. Answer in under 150 words using tight bullet points. No preamble, no repetition.",
  detailed:
    "Teaching style: DETAILED. Give a thorough, structured explanation with headings, every intermediate step, one worked example and a short summary.",
};

export function teachingStyleDirective(style: string | null | undefined): string {
  const key = (style ?? "friendly") as TeachingStyleId;
  return STYLE_DIRECTIVES[key] ?? STYLE_DIRECTIVES.friendly;
}

export function teachingStyleLabel(style: string | null | undefined): string {
  return TEACHING_STYLES.find((s) => s.id === style)?.label ?? "Friendly";
}

/** Universal AI: what kind of learner is asking. */
export type LearnerDomain = {
  id: string;
  label: string;
  emoji: string;
  /** Placeholder for the free-text "your level" field. */
  levelHint: string;
  /** Suggested level chips. */
  levels: string[];
};

export const LEARNER_DOMAINS: LearnerDomain[] = [
  {
    id: "school",
    label: "School",
    emoji: "🏫",
    levelHint: "e.g. Class 9 CBSE",
    levels: ["Class 1-5", "Class 6-8", "Class 9-10", "Class 11-12"],
  },
  {
    id: "college",
    label: "College",
    emoji: "🎓",
    levelHint: "e.g. B.Tech CSE 3rd sem",
    levels: ["B.A./B.Sc./B.Com", "B.Tech", "B.Ed", "M.A./M.Sc.", "MBA"],
  },
  {
    id: "exams",
    label: "Competitive exams",
    emoji: "🎯",
    levelHint: "e.g. NEET 2027 aspirant",
    levels: ["JEE", "NEET", "UPSC", "SSC", "Banking", "CUET", "GATE"],
  },
  {
    id: "programming",
    label: "Programming",
    emoji: "💻",
    levelHint: "e.g. Python beginner, DSA arrays",
    levels: ["Beginner", "Intermediate", "Advanced", "Interview prep"],
  },
  {
    id: "aiml",
    label: "AI / ML",
    emoji: "🤖",
    levelHint: "e.g. learning neural networks",
    levels: ["Basics", "Machine learning", "Deep learning", "Projects"],
  },
  {
    id: "science",
    label: "Science",
    emoji: "🔬",
    levelHint: "e.g. Physics — rotational motion",
    levels: ["Physics", "Chemistry", "Biology", "Environment"],
  },
  {
    id: "maths",
    label: "Mathematics",
    emoji: "➗",
    levelHint: "e.g. Calculus, integration",
    levels: ["Arithmetic", "Algebra", "Geometry", "Calculus", "Statistics"],
  },
  {
    id: "languages",
    label: "Languages",
    emoji: "🌐",
    levelHint: "e.g. spoken English practice",
    levels: ["English", "Hindi", "Sanskrit", "French", "Spanish"],
  },
  {
    id: "general",
    label: "General education",
    emoji: "🧠",
    levelHint: "e.g. curious about anything",
    levels: ["GK", "Current affairs", "History", "How things work"],
  },
];

/** Compose the learner-context sentence sent to the AI. */
export function buildLearnerContext(args: {
  domain?: string | null;
  level?: string | null;
  topic?: string | null;
}): string | null {
  const d = LEARNER_DOMAINS.find((x) => x.id === args.domain);
  const parts: string[] = [];
  if (d) parts.push(`Learning area: ${d.label}`);
  if (args.level?.trim()) parts.push(`Student level: ${args.level.trim()}`);
  if (args.topic?.trim()) parts.push(`Focus topic: ${args.topic.trim()}`);
  if (!parts.length) return null;
  return parts.join(". ") + ".";
}
