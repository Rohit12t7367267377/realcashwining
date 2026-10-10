import { z } from "zod";

const text = z.string().max(6000);
const short = z.string().max(300);
const number = z.number().finite().nonnegative();
const order = z.number().int().min(0).max(100000);
const uuid = z.string().uuid();
const common = { active: z.boolean().optional(), sort_order: order.optional() };

/** Explicit editable fields; IDs, timestamps and calculated counters are server-owned. */
export const adminWriteSchemas = {
  memberships: z.object({ ...common, code: short, name: short, description: text, price: number, duration_days: z.number().int().min(1).max(3650), perks: z.array(short).max(100), recommended: z.boolean().optional(), highlight: short.optional(), daily_quiz_limit: order.optional(), audience: short.optional() }).strict(),
  coupons: z.object({ code: short, kind: short, amount: number, xp_amount: order, max_redemptions: order.nullable(), per_user_limit: z.number().int().min(1), expires_at: z.string().datetime().nullable(), active: z.boolean(), note: text }).strict(),
  faqs: z.object({ ...common, question: text, answer: text, category: short }).strict(),
  banners: z.object({ ...common, title: short, subtitle: text, image_url: text, link_url: text, cta_label: short, starts_at: z.string().datetime().nullable().optional(), ends_at: z.string().datetime().nullable().optional() }).strict(),
  broadcasts: z.object({ title: short, body: text, audience: short, active: z.boolean() }).strict(),
  app_updates: z.object({ version: short, message: text, url: text, force_update: z.boolean(), active: z.boolean() }).strict(),
  cricket_matches: z.object({ name: short, status: short, venue: short, date_time: z.string().datetime().nullable().optional(), team_a: short, team_b: short, score_a: short, score_b: short, match_type: short, is_live: z.boolean(), series: short.optional() }).strict(),
};

export const catalogWriteSchemas = {
  exam: z.object({ ...common, code: short, name: short, category: short, emoji: short, conducting_body: short, blurb: text }).partial().strict(),
  exam_subject: z.object({ ...common, exam_id: uuid, name: short, emoji: short, weightage: short }).partial().strict(),
  exam_topic: z.object({ ...common, subject_id: uuid, title: short }).partial().strict(),
  degree: z.object({ ...common, code: short, name: short, level: short, emoji: short, blurb: text }).partial().strict(),
  regulation: z.object({ ...common, degree_id: uuid, university: short, name: short }).partial().strict(),
  college_subject: z.object({ ...common, regulation_id: uuid, term: short, name: short, code: short, is_programming: z.boolean() }).partial().strict(),
  college_unit: z.object({ ...common, subject_id: uuid, unit_number: order, title: short }).partial().strict(),
  college_topic: z.object({ ...common, unit_id: uuid, title: short }).partial().strict(),
};