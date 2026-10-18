// Delivery markets: what can happen on one ball, and how a provider record maps to exactly ONE outcome.
// Pure and provider-neutral. Answer definitions never overlap because a fixed precedence picks one primary event.
import type { BallEvent, QuestionOption } from "./types";

export type DeliveryOutcome =
  | "dot" | "run1" | "run2" | "run3" | "four" | "six" | "wide" | "noball" | "wicket" | "other";

export interface DeliveryOption {
  id: DeliveryOutcome;
  label: string;
  /** Only meaningful when the slot counts every delivery ("event" mode); a legal delivery can never be a wide or no-ball. */
  eventModeOnly: boolean;
  help: string;
}

/**
 * Precedence used when several things happen on one delivery (first match wins):
 * wicket > wide > no-ball > six > four > 3 > 2 > 1 > dot > other.
 */
export const DELIVERY_OPTIONS: DeliveryOption[] = [
  { id: "dot", label: "Dot ball", eventModeOnly: false, help: "Zero runs off the bat (byes and leg-byes count as dots)." },
  { id: "run1", label: "1 run", eventModeOnly: false, help: "Exactly 1 run off the bat." },
  { id: "run2", label: "2 runs", eventModeOnly: false, help: "Exactly 2 runs off the bat." },
  { id: "run3", label: "3 runs", eventModeOnly: false, help: "Exactly 3 runs off the bat." },
  { id: "four", label: "Four", eventModeOnly: false, help: "A boundary four off the bat." },
  { id: "six", label: "Six", eventModeOnly: false, help: "A six off the bat." },
  { id: "wide", label: "Wide", eventModeOnly: true, help: "The delivery is a wide." },
  { id: "noball", label: "No-ball", eventModeOnly: true, help: "The delivery is a no-ball, whatever happens off the bat." },
  { id: "wicket", label: "Wicket", eventModeOnly: false, help: "Any dismissal on the delivery, whatever else happens." },
  { id: "other", label: "Other", eventModeOnly: false, help: "Anything not covered by the options you offer (e.g. 5 runs)." },
];

export const DELIVERY_IDS = DELIVERY_OPTIONS.map((o) => o.id);

export type MarketMode = "legal" | "event";

/** Default offer: every option that can actually be resolved in this mode. */
export function defaultOptionIds(mode: MarketMode): DeliveryOutcome[] {
  return DELIVERY_OPTIONS.filter((o) => mode === "event" || !o.eventModeOnly).map((o) => o.id);
}

/** Returns an error message, or null when the option set is valid for the mode. */
export function validateOptionIds(ids: string[], mode: MarketMode, labels: Record<string, string> = {}): string | null {
  const known = new Set<string>(DELIVERY_IDS);
  if (ids.length < 2) return "Offer at least two outcome options.";
  if (new Set(ids).size !== ids.length) return "Outcome options must be unique.";
  for (const id of ids) {
    if (!known.has(id)) return `Unknown outcome option: ${id}.`;
    const def = DELIVERY_OPTIONS.find((o) => o.id === id)!;
    if (mode === "legal" && def.eventModeOnly) {
      return `“${def.label}” cannot be an outcome when predicting the Nth LEGAL delivery (a wide or no-ball is not a legal delivery). Switch the market to “every delivery” or remove it.`;
    }
  }
  const finalLabels = ids.map((id) => (labels[id] ?? DELIVERY_OPTIONS.find((o) => o.id === id)!.label).trim().toLowerCase());
  if (finalLabels.some((l) => l.length < 1 || l.length > 40)) return "Option names must be 1–40 characters.";
  if (new Set(finalLabels).size !== finalLabels.length) return "Option names must be different from each other.";
  return null;
}

export function buildOptions(ids: string[], labels: Record<string, string> = {}): QuestionOption[] {
  return ids.map((id) => ({ id, label: (labels[id] ?? DELIVERY_OPTIONS.find((o) => o.id === id)!.label).trim() }));
}

/**
 * The single primary outcome of one delivery, or "unknown" when the record is not enough to decide
 * (an illegal delivery whose type the provider did not state). "unknown" must never be guessed.
 */
export function classifyDelivery(e: BallEvent, mode: MarketMode): DeliveryOutcome | "unknown" {
  if (e.wicket) return "wicket";
  if (!e.legal) {
    if (mode === "legal") return "unknown"; // not reachable in legal mode; callers filter illegal deliveries out
    if (e.extraType === "wide") return "wide";
    if (e.extraType === "noball") return "noball";
    return "unknown";
  }
  switch (e.runsBat) {
    case 0: return "dot";
    case 1: return "run1";
    case 2: return "run2";
    case 3: return "run3";
    case 4: return "four";
    case 6: return "six";
    default: return "other";
  }
}

/**
 * Maps an outcome onto an option that is actually offered. An outcome the admin switched off counts as
 * "Other" when that is offered; otherwise the question is void (nobody is scored on an answer nobody could give).
 */
export function mapToOffered(
  outcome: DeliveryOutcome,
  offered: string[] | undefined,
): { ok: true; optionId: string } | { ok: false; reason: string } {
  if (!offered || offered.includes(outcome)) return { ok: true, optionId: outcome };
  if (offered.includes("other")) return { ok: true, optionId: "other" };
  return { ok: false, reason: "outcome_not_offered" };
}
