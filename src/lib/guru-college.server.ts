import { callAiChat, extractJson } from "@/lib/ai-gateway.server";

const str = (v: unknown) => String(v ?? "").trim();
const arr = (v: unknown) =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => (x as string).trim()).filter(Boolean) : [];

export type CodingQuestion = {
  title: string;
  prompt: string;
  language: string;
  starter: string;
  hints: string[];
  solution: string;
};

export type OutputPrediction = {
  code: string;
  language: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

/** Suggest a list for one level of the college hierarchy. */
export async function suggestCollegeList(input: {
  level: "regulations" | "terms" | "subjects" | "units" | "topics";
  degree: string;
  regulation?: string;
  term?: string;
  subject?: string;
  unit?: string;
}): Promise<string[]> {
  const ask: Record<typeof input.level, string> = {
    regulations:
      "List 8-12 popular Indian universities or regulation schemes that offer this degree (e.g. 'AKTU (2021 Regulation)', 'Anna University (R2021)', 'IGNOU', 'Savitribai Phule Pune University').",
    terms: "List the semesters or years of this degree in order (e.g. 'Semester 1' … or 'Year 1').",
    subjects: "List 6-10 real subjects taught in this semester/year for this degree and university.",
    units: "List the units of this subject in syllabus order as 'Unit 1: <title>' style strings (4-6 units).",
    topics: "List 5-10 teachable topics inside this unit in teaching order.",
  };
  const raw = await callAiChat(
    [
      {
        role: "system",
        content:
          'You are an Indian university curriculum expert. Return ONLY JSON: {"items":["..."]}. Use real, current curriculum names. No numbering prefixes except where asked.',
      },
      {
        role: "user",
        content:
          `Degree: ${input.degree}.` +
          (input.regulation ? ` University/Regulation: ${input.regulation}.` : "") +
          (input.term ? ` Term: ${input.term}.` : "") +
          (input.subject ? ` Subject: ${input.subject}.` : "") +
          (input.unit ? ` Unit: ${input.unit}.` : "") +
          ` ${ask[input.level]}`,
      },
    ],
    { responseFormat: "json_object", temperature: 0.25 },
  );
  const p = (extractJson(raw) ?? {}) as { items?: unknown };
  return arr(p.items).slice(0, 16);
}

/** Coding practice questions for a programming subject/topic. */
export async function buildCodingQuestions(input: {
  subject: string;
  topic: string;
  language: string;
  count: number;
}): Promise<CodingQuestion[]> {
  const raw = await callAiChat(
    [
      {
        role: "system",
        content:
          "You are a programming professor. Return ONLY JSON: " +
          '{"questions":[{"title":"...","prompt":"...","language":"...","starter":"...","hints":["..."],"solution":"..."}]} ' +
          `with exactly ${input.count} questions. prompt states the problem with sample input/output. starter is a short skeleton. solution is complete, runnable code.`,
      },
      {
        role: "user",
        content: `Subject: ${input.subject}. Topic: ${input.topic}. Language: ${input.language}. Create coding practice problems from easy to hard.`,
      },
    ],
    { responseFormat: "json_object", temperature: 0.45 },
  );
  const p = (extractJson(raw) ?? {}) as { questions?: unknown };
  const rows = Array.isArray(p.questions) ? (p.questions as Record<string, unknown>[]) : [];
  return rows
    .map((q) => ({
      title: str(q.title),
      prompt: str(q.prompt),
      language: str(q.language) || input.language,
      starter: str(q.starter),
      hints: arr(q.hints).slice(0, 4),
      solution: str(q.solution),
    }))
    .filter((q) => q.title && q.prompt)
    .slice(0, input.count);
}

/** Output-prediction MCQs for a programming topic. */
export async function buildOutputPredictions(input: {
  subject: string;
  topic: string;
  language: string;
  count: number;
}): Promise<OutputPrediction[]> {
  const raw = await callAiChat(
    [
      {
        role: "system",
        content:
          "You write 'predict the output' questions. Return ONLY JSON: " +
          '{"questions":[{"code":"...","language":"...","options":["a","b","c","d"],"answerIndex":0,"explanation":"..."}]} ' +
          `with exactly ${input.count} questions. code is a short complete snippet (max 15 lines). Options are candidate outputs.`,
      },
      { role: "user", content: `Subject: ${input.subject}. Topic: ${input.topic}. Language: ${input.language}.` },
    ],
    { responseFormat: "json_object", temperature: 0.5 },
  );
  const p = (extractJson(raw) ?? {}) as { questions?: unknown };
  const rows = Array.isArray(p.questions) ? (p.questions as Record<string, unknown>[]) : [];
  return rows
    .map((q) => {
      const options = arr(q.options).slice(0, 4);
      const idx = Number(q.answerIndex ?? 0);
      return {
        code: str(q.code),
        language: str(q.language) || input.language,
        options,
        answerIndex: Number.isFinite(idx) && idx >= 0 && idx < options.length ? idx : 0,
        explanation: str(q.explanation),
      };
    })
    .filter((q) => q.code && q.options.length === 4)
    .slice(0, input.count);
}

/** Review the learner's code: explain, debug or check it against the problem. */
export async function reviewCode(input: {
  mode: "explain" | "debug" | "review";
  language: string;
  code: string;
  problem?: string;
}): Promise<{ answer: string }> {
  const system =
    input.mode === "explain"
      ? "You are a patient programming teacher. Explain the given code line by line in plain language, then summarise what it prints/returns and its time complexity."
      : input.mode === "debug"
        ? "You are a debugging mentor. Find every bug in the code, explain why it fails, then give the corrected full code in a fenced block and a short list of what changed."
        : "You are a code reviewer. Say whether the code solves the problem, list correctness issues, edge cases missed, and suggest an improved version in a fenced block.";
  const answer = await callAiChat(
    [
      { role: "system", content: `${system} Keep it under 400 words. Language: ${input.language}.` },
      {
        role: "user",
        content: `${input.problem ? `Problem: ${input.problem}\n\n` : ""}Code:\n\`\`\`${input.language}\n${input.code}\n\`\`\``,
      },
    ],
    { temperature: 0.3 },
  );
  return { answer: answer.trim() };
}
