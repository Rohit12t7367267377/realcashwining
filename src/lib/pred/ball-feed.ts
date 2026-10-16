// Ball-by-ball normalizer. Pure and strict: a row is accepted only when every
// required field can be read unambiguously. Unrecognised rows are rejected and
// counted - they are never guessed. If the provider's real format differs from
// the shapes below, zero events are accepted and the admin sees the rejection
// count, so the ball-by-ball contests stay disabled instead of settling wrongly.
//
// STATUS: written against documented/assumed field names and unit-tested with
// mock fixtures only. It has NOT been verified against the live provider.
import type { BallEvent } from "./types";

export interface BallFeedResult {
  events: Array<Omit<BallEvent, "matchId" | "revision">>;
  total: number;
  rejected: number;
}

const toInt = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && /^-?\d+$/.test(v.trim())) return Number(v.trim());
  return null;
};

const pick = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};

const truthy = (v: unknown): boolean | null => {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "1" || v === "true") return true;
  if (v === 0 || v === "0" || v === "false" || v === "") return false;
  return null;
};

/** Finds the array of delivery rows in a provider payload (data.bbb | data.balls | data). */
export function extractRows(payload: unknown): unknown[] | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const data = p.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["bbb", "balls", "deliveries", "commentary"]) if (Array.isArray(d[k])) return d[k] as unknown[];
  }
  return null;
}

/**
 * Expected row fields (any listed alias is accepted):
 *   innings : inning | innings | innings_no            (1-based integer)
 *   over    : over_no | overNumber | over              (1-based integer; fractional "0.3" style is REJECTED as ambiguous)
 *   ball    : ball | ball_no | ballNumber              (1-based position in the over, wides included)
 *   legal   : legal | is_legal  (boolean)  OR  extra_type in {wide, noball, no_ball, nb, wd} => illegal
 *   runs    : runs_bat | batsman_runs | bat_runs       (integer)
 *   extras  : extras | extra_runs                      (integer, default 0)
 *   wicket  : wicket | is_wicket | isWicket            (boolean)
 */
export function normalizeBalls(payload: unknown): BallFeedResult {
  const rows = extractRows(payload);
  if (!rows) return { events: [], total: 0, rejected: 0 };
  const byKey = new Map<string, Omit<BallEvent, "matchId" | "revision">>();
  let rejected = 0;

  for (const raw of rows) {
    if (!raw || typeof raw !== "object") { rejected++; continue; }
    const r = raw as Record<string, unknown>;
    const innings = toInt(pick(r, ["inning", "innings", "innings_no"]));
    const over = toInt(pick(r, ["over_no", "overNumber", "over"]));
    const seq = toInt(pick(r, ["ball", "ball_no", "ballNumber"]));
    const runsBat = toInt(pick(r, ["runs_bat", "batsman_runs", "bat_runs"]));
    const extras = toInt(pick(r, ["extras", "extra_runs"])) ?? 0;
    const wicket = truthy(pick(r, ["wicket", "is_wicket", "isWicket"]));

    let legal = truthy(pick(r, ["legal", "is_legal"]));
    if (legal === null) {
      const et = pick(r, ["extra_type", "extraType"]);
      if (typeof et === "string") legal = !/^(wide|wd|noball|no_ball|nb)$/i.test(et.trim());
      else if (et === undefined || et === "") legal = true;
    }

    if (
      innings === null || innings < 1 || over === null || over < 1 || seq === null || seq < 1 ||
      runsBat === null || runsBat < 0 || extras < 0 || wicket === null || legal === null
    ) { rejected++; continue; }

    const eventKey = `${innings}.${over}.${seq}`;
    byKey.set(eventKey, { eventKey, innings, over, seq, legal, runsBat, extras, wicket });
  }
  // Duplicate rows for the same delivery collapse to the last one (idempotent).
  return { events: [...byKey.values()], total: rows.length, rejected };
}
