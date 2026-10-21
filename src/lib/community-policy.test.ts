import { describe, expect, it } from "vitest";
import { checkContent, checkUpload, commentInputSchema, postInputSchema, rankFeed, scorePost, type RankInput } from "./community-policy";

const base: RankInput = { id: "a", userId: "u1", createdAt: Date.UTC(2026, 9, 20), category: "post", subject: "Physics", examTag: null, likes: 0, comments: 0, saves: 0, validViews: 0, avgPct: 0, followsAuthor: false, newsStatus: "unverified" };
const NOW = Date.UTC(2026, 9, 21);

describe("content policy", () => {
  it("blocks scams, gambling, leaks and off-platform solicitation", () => {
    for (const t of ["Guaranteed selection in JEE, join now", "Earn 5000 per day from home", "NEET paper leak available", "Free recharge click here to win", "Join my telegram group: abc", "buy followers cheap"]) {
      expect(checkContent(t).ok, t).toBe(false);
    }
  });
  it("allows normal educational writing, including 'guarantee' in a maths sense", () => {
    expect(checkContent("Newton's second law: F = ma. Here is a worked example with a 5 kg block.").ok).toBe(true);
    expect(checkContent("Is the answer guaranteed to converge for this series? Let's check the ratio test.").ok).toBe(true);
  });
  it("limits links, shouting and repeated characters", () => {
    expect(checkContent("a https://a.co b https://b.co c https://c.co d https://d.co").ok).toBe(false);
    expect(checkContent("THIS IS THE BEST COURSE IN THE WHOLE WORLD BUY NOW BEFORE IT ENDS TODAY").ok).toBe(false);
    expect(checkContent("noooooooooooooooooooo way").ok).toBe(false);
  });
});

describe("uploads", () => {
  it("accepts supported media and rejects executables, scripts, svg/html and oversize", () => {
    expect(checkUpload({ name: "a.png", type: "image/png", size: 1000 })).toEqual({ ok: true, kind: "image" });
    expect(checkUpload({ name: "n.pdf", type: "application/pdf", size: 1000 })).toEqual({ ok: true, kind: "document" });
    expect(checkUpload({ name: "x.exe", type: "application/octet-stream", size: 10 }).ok).toBe(false);
    expect(checkUpload({ name: "x.svg", type: "image/svg+xml", size: 10 }).ok).toBe(false);
    expect(checkUpload({ name: "x.png.js", type: "image/png", size: 10 }).ok).toBe(false);
    expect(checkUpload({ name: "big.mp4", type: "video/mp4", size: 101 * 1024 * 1024 }).ok).toBe(false);
  });
});

describe("post validation", () => {
  it("news needs a source, video needs a video, source is news-only", () => {
    expect(postInputSchema.safeParse({ category: "news", body: "Exam date announced" }).success).toBe(false);
    expect(postInputSchema.safeParse({ category: "news", body: "Exam date announced", sourceUrl: "https://example.org/n" }).success).toBe(true);
    expect(postInputSchema.safeParse({ category: "video", body: "x", media: { path: "u/x.png", kind: "image" } }).success).toBe(false);
    expect(postInputSchema.safeParse({ category: "post", body: "hello", sourceUrl: "https://example.org" }).success).toBe(false);
    expect(postInputSchema.safeParse({ category: "post", body: "" }).success).toBe(false);
    expect(postInputSchema.safeParse({ category: "dance", body: "x" }).success).toBe(false);
    expect(postInputSchema.safeParse({ category: "news", body: "x", sourceUrl: "javascript:alert(1)" }).success).toBe(false);
  });
  it("validates comments", () => {
    expect(commentInputSchema.safeParse({ postId: crypto.randomUUID(), body: "  " }).success).toBe(false);
    expect(commentInputSchema.safeParse({ postId: crypto.randomUUID(), body: "nice" }).success).toBe(true);
  });
});

describe("feed ranking", () => {
  it("newer beats older with equal engagement (decay)", () => {
    expect(scorePost({ ...base, createdAt: NOW - 3_600_000 }, { subjects: [], exams: [] }, NOW)).toBeGreaterThan(scorePost({ ...base, createdAt: NOW - 96 * 3_600_000 }, { subjects: [], exams: [] }, NOW));
  });
  it("is not just likes: a high-rate, well-watched post outranks one with many likes on huge views", () => {
    const viral: RankInput = { ...base, id: "v", likes: 60, validViews: 5000, avgPct: 0.1 };
    const good: RankInput = { ...base, id: "g", likes: 40, comments: 15, saves: 12, validViews: 200, avgPct: 0.8 };
    expect(scorePost(good, { subjects: [], exams: [] }, NOW)).toBeGreaterThan(scorePost(viral, { subjects: [], exams: [] }, NOW));
  });
  it("tiny samples cannot spike (smoothing)", () => {
    const fluke: RankInput = { ...base, id: "f", likes: 3, validViews: 1, avgPct: 1 };
    const steady: RankInput = { ...base, id: "s", likes: 30, comments: 8, validViews: 400, avgPct: 0.6 };
    expect(scorePost(steady, { subjects: [], exams: [] }, NOW)).toBeGreaterThan(scorePost(fluke, { subjects: [], exams: [] }, NOW));
  });
  it("personalisation: followed creator and matching subject/exam boost", () => {
    const plain = scorePost(base, { subjects: [], exams: [] }, NOW);
    expect(scorePost({ ...base, followsAuthor: true }, { subjects: [], exams: [] }, NOW)).toBeGreaterThan(plain);
    expect(scorePost(base, { subjects: ["physics"], exams: [] }, NOW)).toBeGreaterThan(plain);
  });
  it("unverified news is down-weighted vs verified", () => {
    const n = { ...base, category: "news", likes: 10, validViews: 100 };
    expect(scorePost({ ...n, newsStatus: "verified" }, { subjects: [], exams: [] }, NOW)).toBeGreaterThan(scorePost(n, { subjects: [], exams: [] }, NOW));
  });
  it("one author cannot fill the page, and ordering is deterministic", () => {
    const mk = (id: string, userId: string, likes: number): RankInput => ({ ...base, id, userId, likes, validViews: 100 });
    const items = [mk("a1", "A", 50), mk("a2", "A", 49), mk("a3", "A", 48), mk("b1", "B", 1)];
    const out = rankFeed(items, { subjects: [], exams: [] }, "for_you", NOW).map((p) => p.id);
    expect(out).toEqual(["a1", "a2", "b1", "a3"]);
    expect(rankFeed([...items].reverse(), { subjects: [], exams: [] }, "for_you", NOW).map((p) => p.id)).toEqual(out);
  });
});

import { learnLinkFor } from "./community-policy";
describe("learning links", () => {
  it("routes by exam, level and subject to the matching Guru.AI section", () => {
    expect(learnLinkFor({ examTag: "JEE Main" })?.to).toBe("/guru/exams");
    expect(learnLinkFor({ educationLevel: "B.Tech Semester 3", subject: "DBMS" })?.to).toBe("/guru/college");
    expect(learnLinkFor({ educationLevel: "Class 10", subject: "Science" })?.to).toBe("/guru/school");
    expect(learnLinkFor({ subject: "Python programming" })?.to).toBe("/guru/skills");
    expect(learnLinkFor({ subject: "History" })?.to).toBe("/guru/universal");
    expect(learnLinkFor({})).toBeNull();
  });
});
