import type { EntryRecord, QuestionRecord, ScoringRules } from "./types";

export interface AnswerScore {
  questionId: string;
  points: number;
  correct: boolean;
  /** false while the question is still unresolved or void: it does not count. */
  counted: boolean;
}

export function scoreAnswer(q: QuestionRecord, answer: string | undefined, rules: ScoringRules): AnswerScore {
  if (q.status !== "resolved") return { questionId: q.id, points: 0, correct: false, counted: false };
  if (answer === undefined) return { questionId: q.id, points: 0, correct: false, counted: true };
  const correct = answer === q.resolvedOption;
  return {
    questionId: q.id,
    points: correct ? q.points : -Math.max(0, rules.negativePerWrong),
    correct,
    counted: true,
  };
}

export function scoreEntry(entry: Pick<EntryRecord, "answers">, questions: QuestionRecord[], rules: ScoringRules) {
  const scores = questions.map((q) => scoreAnswer(q, entry.answers[q.id], rules));
  const counted = scores.filter((s) => s.counted);
  return {
    scores,
    points: counted.reduce((s, x) => s + x.points, 0),
    correct: counted.filter((s) => s.correct).length,
    answered: questions.filter((q) => entry.answers[q.id] !== undefined).length,
  };
}

export interface RankedEntry {
  userId: string;
  entryId: string;
  points: number;
  correct: number;
  submittedAt: string;
  rank: number;
}

/**
 * Deterministic ranking. Order: points desc, correct desc, earlier submission,
 * then user id, so every participant gets a unique, reproducible rank.
 */
export function rankEntries(
  rows: Array<{ userId: string; entryId: string; points: number; correct: number; submittedAt: string }>,
): RankedEntry[] {
  return [...rows]
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.correct !== a.correct) return b.correct - a.correct;
      const ta = Date.parse(a.submittedAt);
      const tb = Date.parse(b.submittedAt);
      if (ta !== tb) return ta - tb;
      return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
    })
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
