import { completeJSON } from "../llm";
import type { PlateAppearanceCanonical } from "./types";

export interface HitterCardTotals {
  pas: number;
  pitchesSeen: number;
  contactRate: number; // share of PAs with any in_play
  strikeoutRate: number;
  walkRate: number;
  hbpRate: number;
}

// Deterministic opponent exploit recommendations
function computeDeterministicExploit(card: HitterCard): [string[], number] {
  const recs: string[] = [];
  const t = card.totals;
  const bb = card.breakdown;

  // High strikeout rate: expand the zone late
  if (t.strikeoutRate >= 0.35) {
    recs.push(
      "Attack up and out of the zone with two strikes; expand late with breakers off the plate.",
      "Get ahead early; elevate fastball above the belt then finish with slider away."
    );
  }
  // Low contact rate
  if (t.contactRate <= 0.45) {
    recs.push("Pound edge zones; avoid middle. Force chase by tunneling off-speed after first-pitch strike.");
  }
  // Walk rate signal
  if (t.walkRate <= 0.05) {
    recs.push("Avoid free passes: expand early. He will chase; do not give middle-middle strikes.");
  } else if (t.walkRate >= 0.15) {
    recs.push("Challenge in-zone early; limit waste pitches. Make him earn swings in the zone.");
  }
  // Ground-ball heavy with little power
  const gbHeavy = bb.battedBall.gb >= Math.max(bb.battedBall.fb, bb.battedBall.ld) + 2;
  const lowPower = (bb.power.hr + bb.power.double + bb.power.triple) === 0;
  if (gbHeavy && lowPower) {
    recs.push("Live down in the zone; induce rollovers to SS/2B. Infield plays a step in for the double play.");
  }
  // Air-ball without power
  if (bb.battedBall.fb >= bb.battedBall.gb + 2 && (bb.power.hr + bb.power.double) <= 1) {
    recs.push("Climb the ladder: ride fastballs at the letters; outfield shades shallow corners for weak flies.");
  }
  // HBP tendency low/high not derived directly; rely on strike/ball mix
  if ((bb.pitchMix.ball ?? 0) > (bb.pitchMix.called_strike ?? 0) * 1.5 && t.walkRate >= 0.12) {
    recs.push("Fill the zone early; avoid nibbling. First-pitch strike is key.");
  }

  const unique = Array.from(new Set(recs)).slice(0, 5);
  while (unique.length < 3) unique.push("Standard plan: get ahead, change eye level, finish off the plate.");
  const conf = 0.45 + Math.min(0.4, Math.max(0, 0.2 * (t.pas / 8)));
  return [unique, Number(conf.toFixed(2))];
}

// Rule-based recommendation fallback so we always produce something without LLM
function computeDeterministicRecs(card: HitterCard): [string[], number] {
  const recs: string[] = [];
  const t = card.totals;
  const bb = card.breakdown;

  // Contact/2-strike approach
  if (t.strikeoutRate >= 0.35 || t.contactRate <= 0.45) {
    recs.push(
      "Simplify two-strike approach: shorten stride, choke up, prioritize contact to middle/oppo.",
      "Start load earlier to avoid being late; focus on on-time heel plant before swing."
    );
  }
  // Plate discipline
  if (t.walkRate <= 0.05 && (bb.pitchMix.ball ?? 0) < (bb.pitchMix.called_strike ?? 0)) {
    recs.push(
      "Tighten swing decisions: hunt one zone early; take borderline pitches until two strikes.",
      "Improve takes: track pitches to the glove; call ball/strike aloud in the on-deck circle."
    );
  }
  // Ground ball heavy
  if (bb.battedBall.gb >= Math.max(bb.battedBall.fb, bb.battedBall.ld) + 2) {
    recs.push(
      "Reduce rollovers: keep hands above the ball; feel slight uphill through contact, not down to."
    );
  }
  // Weak air balls
  if (bb.battedBall.fb >= bb.battedBall.gb + 2 && bb.power.hr + bb.power.double <= 1) {
    recs.push("Add intent: drive through center; finish high with full rotation instead of slicing under.");
  }
  // Power development
  if (bb.power.hr + bb.power.double + bb.power.triple === 0 && t.pas >= 6) {
    recs.push("Add rotational speed: med-ball scoop toss and step-behind throws 2x/week.");
  }
  // Baserunning awareness
  if ((card.sampleNotes || []).some((n) => /out at|picked off|caught stealing/i.test(n))) {
    recs.push("Sharpen baserunning reads: freeze on line drives; bigger secondary with eyes on the pitcher.");
  }

  // Trim and ensure 3–5 items
  const unique = Array.from(new Set(recs)).slice(0, 5);
  while (unique.length < 3) unique.push("Reinforce timing: load earlier; be on time for fastball, adjust to off-speed.");
  const conf = 0.45 + Math.min(0.4, Math.max(0, 0.2 * (t.pas / 8))); // more PAs => higher confidence up to ~0.85
  return [unique, Number(conf.toFixed(2))];
}

// Minimal heuristic canonicalization from raw segment text for offline/timeout fallback
export function toMinimalCanonicalFromText(raw: string): PlateAppearanceCanonical {
  const lower = raw.toLowerCase();
  const pa: PlateAppearanceCanonical = {
    pa_result: "gb",
    pitches: [],
    batter: null,
    pitcher: null,
    fielder_num: null as any,
    outs_added: 0,
    explicit_runner_actions: [],
    notes: [raw.slice(0, 200)],
    confidence: 0.3,
  } as any;

  // Batter initials like "J M" at start
  const mName = raw.match(/^\s*([A-Z][a-z]?\s*[A-Z])\b/);
  if (mName) pa.batter = mName[1].trim();

  // Pitcher note like ", X Y pitching"
  const mPit = raw.match(/,\s*([A-Z][a-z]?\s*[A-Z])\s+pitching\.?/i);
  if (mPit) pa.pitcher = mPit[1].trim();

  // Result heuristics
  if (/home\s*run|homers?|hr\b/.test(lower)) { pa.pa_result = "hr"; pa.outs_added = 0; }
  else if (/triple\b/.test(lower)) { pa.pa_result = "triple"; }
  else if (/double\b/.test(lower)) { pa.pa_result = "double"; }
  else if (/walks?\b|bases?\s*on\s*balls/.test(lower)) { pa.pa_result = "walk"; }
  else if (/hit\s*by\s*pitch|hbp\b/.test(lower)) { pa.pa_result = "hbp"; }
  else if (/reaches?\s*on\s*error/.test(lower)) { pa.pa_result = "reached_on_error"; pa.outs_added = 0; }
  else if (/fielder'?s?\s*choice/.test(lower)) { pa.pa_result = "fielder_choice"; }
  else if (/strikes?\s*out/.test(lower)) { pa.pa_result = "strikeout"; pa.outs_added = 1; }
  else if (/flies?\s*out/.test(lower)) { pa.pa_result = "fb"; pa.outs_added = 1; }
  else if (/lines?\s*out/.test(lower)) { pa.pa_result = "ld"; pa.outs_added = 1; }
  else if (/grounds?\s*out|ground\s*ball/.test(lower)) { pa.pa_result = "gb"; pa.outs_added = 1; }

  // Fielder mapping when mentioned
  if (/to\s*center\s*fielder/.test(lower)) pa.fielder_num = 8 as any;
  else if (/to\s*left\s*fielder/.test(lower)) pa.fielder_num = 7 as any;
  else if (/to\s*right\s*fielder/.test(lower)) pa.fielder_num = 9 as any;
  else if (/to\s*shortstop/.test(lower)) pa.fielder_num = 6 as any;
  else if (/to\s*second\s*baseman/.test(lower)) pa.fielder_num = 4 as any;
  else if (/to\s*third\s*baseman/.test(lower)) pa.fielder_num = 5 as any;
  else if (/to\s*first\s*baseman/.test(lower)) pa.fielder_num = 3 as any;
  else if (/to\s*pitcher/.test(lower)) pa.fielder_num = 1 as any;
  else if (/to\s*catcher/.test(lower)) pa.fielder_num = 2 as any;

  // Pitches (very rough)
  if (/in\s*play/.test(lower)) pa.pitches.push("in_play");
  const balls = (lower.match(/\bball\b/g) || []).length; for (let i=0;i<balls;i++) pa.pitches.push("ball");
  const cs = (lower.match(/called\s*strike/g) || []).length; for (let i=0;i<cs;i++) pa.pitches.push("called_strike");
  const ss = (lower.match(/swinging\s*strike/g) || []).length; for (let i=0;i<ss;i++) pa.pitches.push("swinging_strike");
  const fouls = (lower.match(/\bfoul\b/g) || []).length; for (let i=0;i<fouls;i++) pa.pitches.push("foul");

  // Runner actions
  (function() {
    const adv = raw.match(/advances?\s*to\s*(first|second|third|home)/gi) || [];
    for (const a of adv) {
      const m = a.toLowerCase().match(/(first|second|third|home)/);
      if (!m) continue; const to = m[1];
      const base = to === "first" ? 1 : to === "second" ? 2 : to === "third" ? 3 : 4;
      pa.explicit_runner_actions.push({ runner: "", action: base===4?"score":"advance", to: base as any });
    }
    const steals = raw.match(/steals?\s*(second|third|home)/gi) || [];
    for (const s of steals) {
      const m = s.toLowerCase().match(/(second|third|home)/);
      if (!m) continue; const to = m[1];
      const base = to === "second" ? 2 : to === "third" ? 3 : 4;
      pa.explicit_runner_actions.push({ runner: "", action: base===4?"steal_home":"steal", to: base as any });
    }
    if (/scores\b/.test(lower)) pa.explicit_runner_actions.push({ runner: "", action: "score", to: 4 });
  })();

  return pa;
}

export interface HitterCardBreakdown {
  results: Record<string, number>; // counts by pa_result
  battedBall: { gb: number; fb: number; ld: number };
  power: { double: number; triple: number; hr: number };
  fielderMap: Record<string, number>; // by fielder_num
  pitchMix: Record<string, number>; // counts by PitchEvent
}

export interface HitterCard {
  hitter: string;
  totals: HitterCardTotals;
  breakdown: HitterCardBreakdown;
  sampleNotes?: string[];
  recommendations?: string[];
  recommendations_confidence?: number;
  exploit_recommendations?: string[];
  exploit_recommendations_confidence?: number;
}

export interface HitterCardsResult {
  ok: boolean;
  cards: HitterCard[];
  errors?: string[];
}

// --- Helpers to enforce actionable, controllable advice and sample-size-aware confidence ---
const BANNED_RE = [
  /increase\s+plate\s+appearances/i,
  /more\s+plate\s+appearances/i,
  /needs?\s+more\s+data/i,
  /larger\s+sample/i,
  /increase\s+pitches/i,
  /see\s+more\s+pitches/i,
  /get\s+more\s+at\-?bats/i,
  /play\s+more\s+games/i,
  /collect\s+more\s+data/i,
];

function filterUncontrollable(items: string[]): string[] {
  return (items || []).filter((s) => s && !BANNED_RE.some((rx) => rx.test(s)));
}

function capFillUnique(items: string[], minItems: number, maxItems: number, fallback: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of filterUncontrollable(items)) {
    const t = s.trim();
    if (!t) continue;
    if (!seen.has(t)) { out.push(t); seen.add(t); }
    if (out.length >= maxItems) break;
  }
  if (out.length < minItems) {
    for (const s of filterUncontrollable(fallback)) {
      const t = s.trim();
      if (!t) continue;
      if (!seen.has(t)) { out.push(t); seen.add(t); }
      if (out.length >= minItems) break;
    }
  }
  return out.slice(0, Math.max(minItems, Math.min(maxItems, out.length)));
}

function sampleSizeScale(pas: number): number {
  // Scale confidence down for tiny samples: pas=0..6 => 0.5..1.0, then cap at 1.0
  const n = Math.max(0, Number(pas || 0));
  return Math.min(1, 0.5 + 0.5 * Math.min(1, n / 6));
}

function applySampleAwareConf(conf: number | undefined, pas: number): number | undefined {
  if (typeof conf !== "number" || Number.isNaN(conf)) return undefined;
  const c = Math.max(0, Math.min(1, conf));
  const scaled = c * sampleSizeScale(pas);
  return Number(scaled.toFixed(2));
}

// --- Deterministic alias resolution for hitter names ---
type NameParts = {
  raw: string;
  cleaned: string;
  first?: string;
  last?: string;
  firstInitial?: string;
  lastInitial?: string;
  isInitialsOnly: boolean;
  isLastOnly: boolean;
  isFullName: boolean;
};

function titleCaseWord(w: string): string {
  if (!w) return w;
  return w[0].toUpperCase() + w.slice(1).toLowerCase();
}

function titleCaseName(s: string): string {
  // Preserve hyphens/apostrophes while title-casing alpha segments
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => tok.split(/([\-'])/).map((seg, i) => (i % 2 === 0 ? titleCaseWord(seg) : seg)).join(""))
    .join(" ");
}

function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function parseName(raw: string): NameParts {
  const cleaned = cleanName(raw);
  const simple = cleaned.replace(/\./g, "");
  const parts = simple.split(/\s+/).filter(Boolean);
  const np: NameParts = {
    raw,
    cleaned,
    isInitialsOnly: false,
    isLastOnly: false,
    isFullName: false,
  };
  if (parts.length === 0) return np;
  if (parts.length === 1) {
    const p = parts[0];
    // Single token. If exactly two letters, treat as initials (e.g., "JK").
    if (/^[A-Za-z]{2}$/.test(p)) {
      np.firstInitial = p[0].toUpperCase();
      np.lastInitial = p[1].toUpperCase();
      np.isInitialsOnly = true;
    } else if (/^[A-Za-z]$/.test(p)) {
      // Single letter only — insufficient, keep as-is (initials-only, missing second)
      np.firstInitial = p[0].toUpperCase();
      np.isInitialsOnly = true;
    } else {
      // Assume this is a last name-only token
      np.last = p;
      np.lastInitial = p[0]?.toUpperCase();
      np.isLastOnly = true;
    }
    return np;
  }
  if (parts.length >= 2) {
    const f = parts[0];
    const l = parts[parts.length - 1];
    np.first = f;
    np.last = l;
    np.firstInitial = f[0]?.toUpperCase();
    np.lastInitial = l[0]?.toUpperCase();
    const allSingleLetters = parts.every((p) => /^[A-Za-z]$/.test(p));
    if (allSingleLetters && parts.length === 2) {
      np.isInitialsOnly = true; // e.g., "J K"
    } else {
      // Treat as full name even if middle tokens exist
      np.isFullName = true;
    }
    return np;
  }
  return np;
}

function buildAliasMap(allNames: string[], explicit?: Record<string, string>) {
  const errors: string[] = [];
  const norm = (s: string) => titleCaseName(cleanName(s));
  const unique = Array.from(new Set(allNames.filter((s) => s && s.trim())));
  const parts = unique.map(parseName);

  // Index full names
  const fullNames = parts.filter((p) => p.isFullName && p.first && p.last);
  const canonicalSet = new Set<string>();
  for (const p of fullNames) canonicalSet.add(norm(`${p.first} ${p.last}`));

  const byLastUpper = new Map<string, Set<string>>(); // KAY -> { "Jason Kay" }
  const byInitials = new Map<string, Set<string>>(); // JK -> { "Jason Kay" }
  const byFirstInitLast = new Map<string, Set<string>>(); // J|KAY -> { "Jason Kay" }

  const add = (m: Map<string, Set<string>>, k: string, v: string) => {
    if (!m.has(k)) m.set(k, new Set());
    m.get(k)!.add(v);
  };

  for (const p of fullNames) {
    const canon = norm(`${p.first} ${p.last}`);
    const lastUpper = (p.last || "").replace(/[^A-Za-z]/g, "").toUpperCase();
    const firstInit = (p.first || "")[0]?.toUpperCase() || "";
    const pair = `${firstInit}${(p.lastInitial || "").toUpperCase()}`;
    add(byLastUpper, lastUpper, canon);
    if (firstInit && p.lastInitial) add(byInitials, pair, canon);
    if (firstInit && lastUpper) add(byFirstInitLast, `${firstInit}|${lastUpper}`, canon);
  }

  const aliasMap: Record<string, string> = {};

  // Apply explicit aliases first
  if (explicit) {
    for (const [k, v] of Object.entries(explicit)) {
      const from = norm(k);
      const to = norm(v);
      // Validate target exists in canonical set or is a valid-looking full name
      if (!canonicalSet.has(to) && !/^\w+[\s\-']+\w+$/i.test(to)) {
        errors.push(`Alias target not a known full name: ${k} -> ${v}`);
      }
      aliasMap[from] = to;
    }
  }

  // Infer aliases deterministically
  for (const p of parts) {
    const rawN = norm(p.cleaned);
    if (aliasMap[rawN]) continue; // explicitly provided

    if (p.isFullName && p.first && p.last) {
      aliasMap[rawN] = norm(`${p.first} ${p.last}`);
      continue;
    }

    // Last-only: unique last name in dataset
    if (p.isLastOnly && p.last) {
      const lastUpper = p.last.replace(/[^A-Za-z]/g, "").toUpperCase();
      const cands = Array.from(byLastUpper.get(lastUpper) || []);
      if (cands.length === 1) aliasMap[rawN] = cands[0]!;
      else if (cands.length > 1) errors.push(`Ambiguous last name '${p.last}': ${cands.join(", ")}`);
      continue;
    }

    // Initials-only like "J K" or "JK"
    if (p.isInitialsOnly && p.firstInitial && p.lastInitial) {
      const pair = `${p.firstInitial}${p.lastInitial}`;
      const cands = Array.from(byInitials.get(pair) || []);
      if (cands.length === 1) {
        aliasMap[rawN] = cands[0]!;
      } else if (cands.length > 1) {
        errors.push(`Ambiguous initials '${p.cleaned}': ${cands.join(", ")}`);
      } else {
        // No full-name candidate present; normalize to spaced initials as canonical (e.g., "J K")
        aliasMap[rawN] = `${p.firstInitial} ${p.lastInitial}`;
      }
      continue;
    }

    // First initial + last name (e.g., "J Kay" or "J. Kay")
    if (p.firstInitial && p.last && !p.isFullName) {
      const lastUpper = p.last.replace(/[^A-Za-z]/g, "").toUpperCase();
      const cands = Array.from(byFirstInitLast.get(`${p.firstInitial}|${lastUpper}`) || []);
      if (cands.length === 1) {
        aliasMap[rawN] = cands[0]!;
      } else if (cands.length > 1) {
        errors.push(`Ambiguous name '${p.cleaned}': ${cands.join(", ")}`);
      } else {
        // Normalize to "F Last" form deterministically
        const canon = `${p.firstInitial} ${titleCaseWord(p.last)}`;
        aliasMap[rawN] = canon;
      }
      continue;
    }
  }

  // Collect unresolved (anything not mapped and not a full canonical form we saw)
  const unresolved: string[] = [];
  for (const name of unique) {
    const nm = norm(name);
    if (!aliasMap[nm]) {
      const pr = parseName(nm);
      if (!(pr.isFullName && pr.first && pr.last)) unresolved.push(nm);
    }
  }

  return { aliasMap, errors, unresolved };
}

function applyAliasMap(paList: PlateAppearanceCanonical[], aliasMap: Record<string, string>): PlateAppearanceCanonical[] {
  const norm = (s: string) => titleCaseName(cleanName(s));
  return paList.map((pa) => {
    const b = (pa.batter || "").trim();
    if (!b) return { ...pa };
    const key = norm(b);
    const to = aliasMap[key] || key;
    if (to === pa.batter) return pa;
    return { ...pa, batter: to } as PlateAppearanceCanonical;
  });
}

export interface BuildCardsOptions {
  model?: string;
  recMode?: "llm" | "det";
  transportTimeoutMs?: number;
  verbose?: boolean;
  maxRetries?: number;
  concurrency?: number;
  aliases?: Record<string, string>; // explicit alias map: from -> canonical full name
  strictAliases?: boolean; // if true, fail on ambiguous/unresolved names (default true)
}

export function buildHitterCardsDet(paList: PlateAppearanceCanonical[]): HitterCard[] {
  const byHitter = new Map<string, PlateAppearanceCanonical[]>();
  for (const pa of paList) {
    const name = (pa.batter || "Unknown").trim() || "Unknown";
    if (!byHitter.has(name)) byHitter.set(name, []);
    byHitter.get(name)!.push(pa);
  }

  const cards: HitterCard[] = [];
  for (const [hitter, list] of byHitter.entries()) {
    const resultsCount: Record<string, number> = {};
    const fielderMap: Record<string, number> = {};
    const pitchMix: Record<string, number> = {};
    let gb = 0, fb = 0, ld = 0;
    let dbl = 0, tpl = 0, hr = 0;
    let K = 0, BB = 0, HBP = 0;
    let inPlayPas = 0;
    let pitchesSeen = 0;
    const notes: string[] = [];

    for (const pa of list) {
      const r = pa.pa_result;
      resultsCount[r] = (resultsCount[r] || 0) + 1;
      if (pa.fielder_num != null) {
        const key = String(pa.fielder_num);
        fielderMap[key] = (fielderMap[key] || 0) + 1;
      }
      for (const p of pa.pitches || []) pitchMix[p] = (pitchMix[p] || 0) + 1;
      pitchesSeen += (pa.pitches || []).length;
      if ((pa.pitches || []).includes("in_play")) inPlayPas += 1;
      if (r === "gb") gb += 1;
      if (r === "fb") fb += 1;
      if (r === "ld") ld += 1;
      if (r === "double") dbl += 1;
      if (r === "triple") tpl += 1;
      if (r === "hr") hr += 1;
      if (r === "strikeout") K += 1;
      if (r === "walk") BB += 1;
      if (r === "hbp") HBP += 1;
      if (pa.notes && pa.notes.length) notes.push(...pa.notes.slice(0, 1));
    }

    const totals: HitterCardTotals = {
      pas: list.length,
      pitchesSeen,
      contactRate: list.length ? inPlayPas / list.length : 0,
      strikeoutRate: list.length ? K / list.length : 0,
      walkRate: list.length ? BB / list.length : 0,
      hbpRate: list.length ? HBP / list.length : 0,
    };
    const breakdown: HitterCardBreakdown = {
      results: resultsCount,
      battedBall: { gb, fb, ld },
      power: { double: dbl, triple: tpl, hr },
      fielderMap,
      pitchMix,
    };
    cards.push({ hitter, totals, breakdown, sampleNotes: notes.slice(0, 6) });
  }
  return cards.sort((a, b) => b.totals.pas - a.totals.pas || a.hitter.localeCompare(b.hitter));
}

export async function buildHitterCards(
  paList: PlateAppearanceCanonical[],
  options: BuildCardsOptions = {}
): Promise<HitterCardsResult> {
  const { model = "gpt-5-mini", recMode = "llm", transportTimeoutMs, verbose, maxRetries = 2 } = options;

  // Strict alias resolution before aggregation
  let explicitAliases: Record<string, string> | undefined = options.aliases;
  if (!explicitAliases && process.env.GS_ALIASES) {
    try { explicitAliases = JSON.parse(process.env.GS_ALIASES); } catch { /* ignore */ }
  }
  const strict = options.strictAliases !== false; // default true

  // Ensure every PA has a batter in strict mode
  const missingIdx: number[] = [];
  for (let i = 0; i < paList.length; i++) {
    const b = (paList[i]?.batter || "").trim();
    if (!b) missingIdx.push(i);
  }
  if (strict && missingIdx.length) {
    const preview = missingIdx.slice(0, 10).map((i) => `#${i}`).join(", ");
    return {
      ok: false,
      cards: [],
      errors: [
        `[strict] Missing batter on ${missingIdx.length} plate appearances (first: ${preview}${missingIdx.length > 10 ? ", ..." : ""})`,
      ],
    };
  }
  const allNames = paList.map((p) => (p.batter || "")).filter(Boolean);
  const { aliasMap, errors: aliasErrors, unresolved } = buildAliasMap(allNames, explicitAliases);
  const aliasProblems: string[] = [];
  if (aliasErrors.length) aliasProblems.push(...aliasErrors.map((e) => `[alias] ${e}`));
  if (unresolved.length) aliasProblems.push(`[alias] Unresolved names: ${unresolved.join(", ")}`);
  if (strict && aliasProblems.length) {
    return { ok: false, cards: [], errors: aliasProblems };
  }

  const normalizedPas = applyAliasMap(paList, aliasMap);
  const cards = buildHitterCardsDet(normalizedPas);
  if (recMode === "det") {
    for (const c of cards) {
      const [recs, conf] = computeDeterministicRecs(c);
      c.recommendations = recs;
      c.recommendations_confidence = conf;
      const [xrecs, xconf] = computeDeterministicExploit(c);
      c.exploit_recommendations = xrecs;
      c.exploit_recommendations_confidence = xconf;
    }
    return { ok: true, cards };
  }

  const errors: string[] = [];

  const recOne = async (card: HitterCard): Promise<void> => {
    let lastErr = "";
    for (let attempt = 0; attempt < Math.max(1, maxRetries); attempt++) {
      try {
        const summary = { hitter: card.hitter, totals: card.totals, breakdown: card.breakdown, sampleNotes: card.sampleNotes || [] };
        const prompt = `You are a youth baseball coach and opposing scout. Based ONLY on the provided summary, return TWO recommendation sets:

Strictly follow:
- Be specific and concise (bulleted items, 3-5 each).
- Base every item ONLY on the provided stats/notes; do not guess beyond them.
- Never recommend uncontrollable/meta actions (e.g., "increase plate appearances", "get more data", "see more pitches", "play more games").
- Do not mention sample size or data limitations. If sample is small, reflect uncertainty ONLY via lower confidence.
- Output JSON ONLY with this shape:
  {
    "development": { "recommendations": string[], "confidence": number },
    "exploit": { "recommendations": string[], "confidence": number }
  }

Meaning:
- development: what THIS hitter should work on to improve.
- exploit: how an opponent should pitch/defend to exploit CURRENT weaknesses.

Summary:\n${JSON.stringify(summary)}`;
        const raw = await completeJSON({
          model,
          system: "Output only JSON. No prose.",
          user: prompt,
          temperature: 0,
          timeoutMs: typeof transportTimeoutMs === "number" ? transportTimeoutMs : Number(process.env.OPENAI_TIMEOUT_MS ?? "45000"),
          maxRetries: 2,
          verbosity: "low",
          reasoningEffort: "minimal",
          verbose,
        });
        const parsed = parseJSONFlex(raw);
        // Backward-compat support: if model returns the old shape
        if (Array.isArray(parsed?.recommendations)) {
          const devRaw = parsed.recommendations.map((s: any) => String(s)).slice(0, 6);
          const [drecs] = computeDeterministicRecs(card);
          const devRecs = capFillUnique(devRaw, 3, 6, drecs);
          const devConfRaw = typeof parsed?.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : undefined;
          const devConf = applySampleAwareConf(devConfRaw, card.totals.pas);
          if (!devRecs.length) throw new Error("no recommendations returned");
          card.recommendations = devRecs;
          card.recommendations_confidence = devConf;
          const [xrecs, xconf] = computeDeterministicExploit(card);
          card.exploit_recommendations = xrecs;
          card.exploit_recommendations_confidence = xconf;
          return;
        }

        // New shape: development and exploit
        const dev = parsed?.development || {};
        const exp = parsed?.exploit || {};
        const devRaw = Array.isArray(dev?.recommendations) ? dev.recommendations.map((s: any) => String(s)).slice(0, 6) : [];
        const expRaw = Array.isArray(exp?.recommendations) ? exp.recommendations.map((s: any) => String(s)).slice(0, 6) : [];
        const [drecs] = computeDeterministicRecs(card);
        const [xrecsDet] = computeDeterministicExploit(card);
        const devRecs = capFillUnique(devRaw, 3, 6, drecs);
        const expRecs = capFillUnique(expRaw, 3, 6, xrecsDet);
        const devConf = applySampleAwareConf(typeof dev?.confidence === "number" ? Math.max(0, Math.min(1, dev.confidence)) : undefined, card.totals.pas);
        const expConf = applySampleAwareConf(typeof exp?.confidence === "number" ? Math.max(0, Math.min(1, exp.confidence)) : undefined, card.totals.pas);
        if (!devRecs.length && !expRecs.length) throw new Error("no recommendations returned");
        if (!devRaw.length && devRecs.length) {
          const [drecs, dconf] = computeDeterministicRecs(card);
          card.recommendations = drecs;
          card.recommendations_confidence = dconf;
        } else {
          card.recommendations = devRecs;
          card.recommendations_confidence = devConf;
        }
        if (!expRaw.length && expRecs.length) {
          const [xrecs, xconf] = computeDeterministicExploit(card);
          card.exploit_recommendations = xrecs;
          card.exploit_recommendations_confidence = xconf;
        } else {
          card.exploit_recommendations = expRecs;
          card.exploit_recommendations_confidence = expConf;
        }
        return;
      } catch (e: any) {
        lastErr = String(e?.message || e);
        if (attempt === Math.max(1, maxRetries) - 1) errors.push(`${card.hitter}: ${lastErr}`);
      }
    }
    // Fallback deterministic recs if LLM fails entirely
    const [recs, conf] = computeDeterministicRecs(card);
    card.recommendations = recs;
    card.recommendations_confidence = conf;
    const [xrecs, xconf] = computeDeterministicExploit(card);
    card.exploit_recommendations = xrecs;
    card.exploit_recommendations_confidence = xconf;
  };

  const concurrency = Math.max(1, Number(options.concurrency ?? process.env.GS_CARDS_CONCURRENCY ?? 4));
  let idx = 0;
  const workers = Array.from({ length: Math.min(concurrency, cards.length) }, () => (async () => {
    while (true) {
      const i = idx++;
      if (i >= cards.length) break;
      const card = cards[i];
      if (verbose) console.error(`[cards] recommending for ${card.hitter} (${i + 1}/${cards.length})`);
      await recOne(card);
    }
  })());
  await Promise.all(workers);

  return { ok: true, cards, errors: errors.length ? errors : undefined };
}

function parseJSONFlex(text: string): any {
  try { return JSON.parse(text); } catch {}
  const fence = text.match(/```(?:json)?\n([\s\S]*?)\n```/i);
  if (fence?.[1]) { try { return JSON.parse(fence[1]); } catch {} }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return {};
}
