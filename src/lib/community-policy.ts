import { z } from "zod";

/** Education-only community rules: categories, content policy, upload limits and the feed-ranking formula. Pure and tested. */
export const CATEGORIES = [
  { id: "post", label: "Explanation" },
  { id: "video", label: "Video" },
  { id: "quiz", label: "Quiz" },
  { id: "notes", label: "Notes" },
  { id: "exam_tip", label: "Exam tip" },
  { id: "news", label: "Education news" },
  { id: "discussion", label: "Q&A" },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];

export const MEDIA_RULES = {
  image: { mimes: ["image/jpeg", "image/png", "image/webp", "image/gif"], maxMb: 10 },
  video: { mimes: ["video/mp4", "video/webm", "video/quicktime"], maxMb: 100 },
  document: { mimes: ["application/pdf"], maxMb: 20 },
} as const;
export type MediaKind = keyof typeof MEDIA_RULES;

/** Returns the media kind for a file, or an error. Executables, scripts and archives are never accepted. */
export function checkUpload(file: { type: string; size: number; name: string }): { ok: true; kind: MediaKind } | { ok: false; error: string } {
  if (/\.(exe|bat|cmd|sh|js|mjs|jar|apk|msi|dll|scr|com|vbs|ps1|html?|svg|zip|rar|7z)$/i.test(file.name)) return { ok: false, error: "This file type is not allowed." };
  for (const [kind, r] of Object.entries(MEDIA_RULES) as [MediaKind, (typeof MEDIA_RULES)[MediaKind]][]) {
    if ((r.mimes as readonly string[]).includes(file.type)) {
      return file.size > r.maxMb * 1024 * 1024 ? { ok: false, error: `${kind[0]!.toUpperCase()}${kind.slice(1)} files must be under ${r.maxMb} MB.` } : { ok: true, kind };
    }
  }
  return { ok: false, error: "Only images (JPG, PNG, WebP, GIF), videos (MP4, WebM, MOV) and PDF documents are allowed." };
}

const BANNED: { re: RegExp; reason: string }[] = [
  { re: /\b(guaranteed|assured)\s+(win|profit|return|selection|rank)/i, reason: "guaranteed-result claims" },
  { re: /\b(earn|make)\s+(₹|rs\.?|inr|\$)?\s*\d[\d,]*\s*(per|a|\/)\s*(day|hour|week)/i, reason: "money-making claims" },
  { re: /\b(paper\s*leak|leaked\s*paper|answer\s*key\s*leak)/i, reason: "leaked exam material" },
  { re: /\b(betting|satta|casino|teen\s*patti|rummy|dream\s*11\s*tips|fixed\s*match)\b/i, reason: "gambling content" },
  { re: /\b(whatsapp|telegram)\s*(me|group|channel|link|:)/i, reason: "off-platform solicitation" },
  { re: /\b(free\s+recharge|click\s+here\s+to\s+win|congratulations\s+you\s+(won|have\s+won))/i, reason: "scam wording" },
  { re: /\b(buy|sell)\s+(followers|likes|views|subscribers)\b/i, reason: "engagement selling" },
];
const URL_RE = /https?:\/\/[^\s)]+/gi;

export type PolicyResult = { ok: true } | { ok: false; reason: string };

/** First-line automated screening. Anything borderline is allowed and left to reports + moderators. */
export function checkContent(text: string, opts: { maxLinks?: number } = {}): PolicyResult {
  const t = text.normalize("NFKC");
  for (const b of BANNED) if (b.re.test(t)) return { ok: false, reason: `This looks like ${b.reason}, which is not allowed in an education community.` };
  const links = t.match(URL_RE) ?? [];
  if (links.length > (opts.maxLinks ?? 3)) return { ok: false, reason: "Too many links in one post." };
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length > 40 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.7) return { ok: false, reason: "Please avoid writing everything in capitals." };
  if (/(.)\1{14,}/.test(t)) return { ok: false, reason: "This looks like spam." };
  return { ok: true };
}

export function normaliseForDuplicate(s: string) { return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 300); }

const tag = z.string().trim().max(60).optional().transform((v) => (v ? v : undefined));
export const postInputSchema = z.object({
  category: z.enum(CATEGORY_IDS),
  title: z.string().trim().max(140).optional().transform((v) => (v ? v : undefined)),
  body: z.string().trim().max(5000),
  subject: tag, examTag: tag, educationLevel: tag,
  sourceUrl: z.string().trim().url().max(500).refine((u) => /^https?:\/\//i.test(u), "Source must be an http(s) link").optional(),
  sourcePublishedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  quizContestId: z.string().uuid().optional(),
  media: z.object({ path: z.string().min(3).max(300), kind: z.enum(["image", "video", "document"]), durationSeconds: z.number().int().min(1).max(21600).optional() }).optional(),
}).superRefine((v, ctx) => {
  if (!v.body && !v.media && !v.quizContestId) ctx.addIssue({ code: "custom", path: ["body"], message: "Write something or attach a file." });
  if (v.category === "news" && !v.sourceUrl) ctx.addIssue({ code: "custom", path: ["sourceUrl"], message: "News posts need a source link." });
  if (v.category === "video" && v.media?.kind !== "video") ctx.addIssue({ code: "custom", path: ["media"], message: "Video posts need a video file." });
  if (v.category === "quiz" && !v.quizContestId && !v.body) ctx.addIssue({ code: "custom", path: ["body"], message: "Describe the quiz or attach an existing one." });
  if (v.category !== "news" && (v.sourceUrl || v.sourcePublishedOn)) ctx.addIssue({ code: "custom", path: ["sourceUrl"], message: "Source details are only for news posts." });
});
export type PostInput = z.infer<typeof postInputSchema>;

export const commentInputSchema = z.object({ postId: z.string().uuid(), body: z.string().trim().min(1).max(1000), parentId: z.string().uuid().optional() });
export const RATE_LIMITS = { postsPerDay: 20, commentsPerMinute: 10, reportsPerDay: 30 } as const;

// ------------------------------------------------------------------ feed ranking
export type RankInput = {
  id: string; userId: string; createdAt: number; category: string; subject: string | null; examTag: string | null;
  likes: number; comments: number; saves: number; validViews: number; avgPct: number; followsAuthor: boolean; newsStatus: string;
};
export type RankPrefs = { subjects: string[]; exams: string[] };
export const HALF_LIFE_HOURS = 36;

/**
 * Explainable first-version score:
 *   quality  = log(1 + engagement-with-diminishing-returns) x completion bonus, normalised by views (not raw likes alone)
 *   fit      = +0.6 followed creator, +0.4 matching subject, +0.4 matching exam
 *   decay    = 0.5 ^ (ageHours / 36)
 * Abuse resistance: each signal is log-damped, comments weigh more than likes, saves most; a post with few valid views
 * cannot get a high engagement rate (Bayesian smoothing); each author contributes at most 2 posts per page.
 */
export function scorePost(p: RankInput, prefs: RankPrefs, now = Date.now()): number {
  const eng = p.likes + 2 * p.comments + 3 * p.saves;
  const smoothedRate = (eng + 1) / (p.validViews + 20); // 20 = prior views, damps tiny samples
  const quality = Math.log1p(eng) * (0.6 + smoothedRate * 4) * (0.8 + 0.4 * Math.min(1, p.avgPct));
  const fit = (p.followsAuthor ? 0.6 : 0) + (p.subject && prefs.subjects.some((s) => s.toLowerCase() === p.subject!.toLowerCase()) ? 0.4 : 0)
    + (p.examTag && prefs.exams.some((s) => s.toLowerCase() === p.examTag!.toLowerCase()) ? 0.4 : 0);
  const ageH = Math.max(0, (now - p.createdAt) / 3_600_000);
  const decay = Math.pow(0.5, ageH / HALF_LIFE_HOURS);
  const newsPenalty = p.category === "news" && p.newsStatus !== "verified" ? 0.6 : 1;
  return (0.15 + quality + fit) * decay * newsPenalty;
}
export function rankFeed<T extends RankInput>(items: T[], prefs: RankPrefs, mode: "for_you" | "trending", now = Date.now()): T[] {
  const scored = items.map((p) => ({ p, s: mode === "trending" ? scorePost({ ...p, followsAuthor: false }, { subjects: [], exams: [] }, now) : scorePost(p, prefs, now) }));
  scored.sort((a, b) => b.s - a.s || b.p.createdAt - a.p.createdAt || a.p.id.localeCompare(b.p.id));
  const perAuthor = new Map<string, number>();
  const main: T[] = [], overflow: T[] = [];
  for (const { p } of scored) {
    const n = perAuthor.get(p.userId) ?? 0;
    perAuthor.set(p.userId, n + 1);
    (n < 2 ? main : overflow).push(p);
  }
  return [...main, ...overflow];
}

// ------------------------------------------------------------------ learning links
/** Contextual "Learn this topic" destination inside the existing Guru.AI sections (never a single generic page). */
export function learnLinkFor(p: { category?: string | null; subject?: string | null; examTag?: string | null; educationLevel?: string | null }) {
  const lvl = (p.educationLevel ?? "").toLowerCase();
  const subj = (p.subject ?? "").toLowerCase();
  if (p.examTag) return { to: "/guru/exams" as const, label: `Prepare for ${p.examTag}` };
  if (/college|university|b\.?tech|b\.?sc|b\.?com|degree|semester/.test(lvl)) return { to: "/guru/college" as const, label: "Learn this in College" };
  if (/class\s*(9|10|11|12)|school|board|cbse|icse/.test(lvl)) return { to: "/guru/school" as const, label: "Learn this in School" };
  if (/code|coding|python|java|dsa|algorithm|programming|sql|web/.test(subj)) return { to: "/guru/skills" as const, label: "Practise Coding & DSA" };
  if (subj) return { to: "/guru/universal" as const, label: `Ask Guru.AI about ${p.subject}` };
  return null;
}
