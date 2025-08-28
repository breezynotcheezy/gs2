import { completeJSON } from "../llm.js";
import type { GameContext, PlateAppearanceCanonical } from "./types.js";
import { canonicalizePlateAppearance } from "./canonicalizer.js";
import { toMinimalCanonicalFromText } from "./cards.js";

function extractJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch {}
  const fence = text.match(/```(?:json)?\n([\s\S]*?)\n```/i);
  if (fence && fence[1]) {
    try {
      return JSON.parse(fence[1]);
    } catch {}
  }
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    const slice = text.substring(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch {}
  }
  throw new Error("LLM did not return valid JSON array");
}

// Helper: extract short-name batter and pitcher deterministically from a PA text
function extractNamesFromText(s: string): { batter?: string; pitcher?: string } {
  const nameToken = "([A-Z]{1,2})\\s+([A-Z]{1,2})"; // spaced initials
  const initialsPair = "([A-Z])([A-Z])"; // compact initials
  const verbs = [
    "strikes out",
    "walks",
    "is hit by pitch",
    "singles",
    "doubles",
    "triples",
    "homers",
    "reaches on error",
    "grounds out",
    "flies out",
    "lines out",
  ].join("|");
  const spacedNameRe = new RegExp(`\\b${nameToken}\\b\\s+(?:${verbs})`, "i");
  const compactNameRe = new RegExp(`\\b${initialsPair}\\b\\s+(?:${verbs})`, "i");
  const pitcherSpaced = new RegExp(`\\b${nameToken}\\b\\s+pitching`, "i");
  const pitcherCompact = new RegExp(`\\b${initialsPair}\\b\\s+pitching`, "i");
  const t = s.replace(/\s+/g, " ").trim();
  let batter: string | undefined;
  let m = t.match(spacedNameRe) || t.match(compactNameRe);
  if (m) {
    const a = (m[1] || "").toUpperCase();
    const b = (m[2] || "").toUpperCase();
    if (a && b) batter = `${a} ${b}`;
  }
  let pitcher: string | undefined;
  let mp = t.match(pitcherSpaced) || t.match(pitcherCompact);
  if (mp) {
    const a = (mp[1] || "").toUpperCase();
    const b = (mp[2] || "").toUpperCase();
    if (a && b) pitcher = `${a} ${b}`;
  }
  return { batter, pitcher };
}

function eventVerbFor(pa: PlateAppearanceCanonical | undefined): string | undefined {
  if (!pa) return undefined;
  const map: Record<string, string> = {
    strikeout: "strikes out",
    walk: "walks",
    hbp: "is hit by pitch",
    single: "singles",
    double: "doubles",
    triple: "triples",
    hr: "homers",
    gb: "grounds out",
    fb: "flies out",
    ld: "lines out",
    reached_on_error: "reaches on error",
  } as const as any;
  return map[pa.pa_result as any];
}

export interface CanonicalizeGameResult {
  ok: boolean;
  data?: PlateAppearanceCanonical[];
  segments?: string[];
  errors?: string[];
}

function buildSegmentationPrompt(text: string): string {
  return `Task: Split the following youth baseball game log text into individual plate appearances (PAs).
Rules:
- Output a JSON array of strings ONLY. No prose. Each string is exactly one PA's raw text.
- Join 'In play.' with the immediately following descriptive sentence(s) that describe the ball-in-play result.
- Exclude scoreboard lines, inning headers, and team scores (e.g., 'Top 5th - ...', 'BRDG 8 - FRNT 2').
- Include pitcher/batter identification when attached to the PA (e.g., 'J M strikes out swinging, H W pitching.').
- Exclude substitutions unless they affect the next PA's pitcher (keep 'X in at pitcher' attached to the FIRST subsequent PA).
- Preserve pitch sequences and explicit base runner actions in the same PA chunk.
- Do not summarize or normalize; just split.

Text to split:\n\n${text}`;
}

export function deterministicSegment(raw: string): string[] {
  // Normalize separators
  let text = raw.replace(/\r\n?/g, "\n");
  // Remove inning headers and team labels like "Top 5th - Bridgewater" but preserve following play text
  text = text.replace(/\b(Top|Bottom)\s+\d+(?:st|nd|rd|th)\b(?:\s*-\s*[^\n.]+)?/gi, "");
  // Remove scoreboard marks like "BRDG 8 - FRNT 2" anywhere
  text = text.replace(/[A-Z]{2,}\s*\d+\s*-\s*[A-Z]{2,}\s*\d+/g, "");
  // Normalize vertical bars to sentence breaks
  text = text.replace(/\|/g, ". ");
  // Make sure lineup changes are their own token
  text = text.replace(/\s+(Lineup changed:)/g, ". $1");
  text = text.replace(/\s+/g, " ").trim();

  // Split by sentences on period/question/exclamation keeping boundaries
  const tokens = text.split(/(?<=[.!?])\s+/);

  const segments: string[] = [];
  let current = "";
  let pendingPitcherNote = "";

  const stripNoise = (t: string) => {
    let s = t.trim();
    s = s.replace(/\b(Top|Bottom)\s+\d+(?:st|nd|rd|th)\b(?:\s*-\s*[^.]+)?/gi, "").trim();
    s = s.replace(/[A-Z]{2,}\s*\d+\s*-\s*[A-Z]{2,}\s*\d+/g, "").trim();
    return s;
  };

  const isPitcherChange = (t: string) => /Lineup changed:\s*.*?in at pitcher/i.test(t);

  const typeLed = /^(Strikeout|Fly Out|Ground Out|Line Out|Walk|Hit By Pitch|Single|Double|Triple|Home Run|Reach(?:es)? on Error)\b/i;
  const nameLed = /^\s*[A-Z]{1,2}\s+[A-Z]{1,2}\s+(strikes out|walks|grounds out|flies out|lines out|doubles|triples|singles|homers|is hit by pitch|reaches on error)/i;
  const inPlay = /^\s*In play\b/i;

  const startOfPA = (t: string, haveCurrent: boolean) => {
    if (typeLed.test(t)) return true;
    if (nameLed.test(t)) return true;
    if (!haveCurrent && inPlay.test(t)) return true;
    return false;
  };

  for (let tok of tokens) {
    let t = stripNoise(tok);
    if (!t) continue;

    // Handle embedded pitcher change within a token by splitting before/after
    if (isPitcherChange(t)) {
      const match = t.match(/Lineup changed:\s*.*?in at pitcher[^.]*\.?/i);
      const before = match ? t.slice(0, match.index).trim() : "";
      const change = match ? match[0].trim() : t.trim();
      const after = match ? t.slice((match.index || 0) + change.length).trim() : "";
      if (before) {
        // process the part before as normal by pushing back into loop
        const items = before.split(/(?<=[.!?])\s+/);
        for (const i of items) {
          const ii = i.trim();
          if (!ii) continue;
          // re-run the loop body for this piece by unshifting into tokens-like processing
          // Implement inline: decide start/continue based on current state
          const start = startOfPA(ii, current.length > 0);
          if (start) {
            if (current) {
              segments.push(current.trim());
              current = "";
            }
            current = ii;
          } else {
            if (!current) { current = ii; } else { current += ` ${ii}`; }
          }
        }
      }
      pendingPitcherNote = change;
      if (after) {
        t = after; // continue with the after-part
      } else {
        continue;
      }
    }

    const isName = nameLed.test(t);
    const isType = typeLed.test(t);
    const start = isType || isName || (!current && inPlay.test(t));
    if (start) {
      if (current) {
        // If this is a name-led description immediately following a summary token (or 'In play'), merge into current
        const currentSummarized = /^(Strikeout|Fly Out|Ground Out|Line Out|Walk|Hit By Pitch|Single|Double|Triple|Home Run)/i.test(current) || /\bIn play\b/i.test(current);
        if (isName && currentSummarized) {
          current += ` ${pendingPitcherNote ? pendingPitcherNote + " " : ""}${t}`;
          pendingPitcherNote = "";
        } else {
          segments.push(current.trim());
          current = "";
          current = pendingPitcherNote ? `${pendingPitcherNote} ${t}` : t;
          pendingPitcherNote = "";
        }
      } else {
        current = pendingPitcherNote ? `${pendingPitcherNote} ${t}` : t;
        pendingPitcherNote = "";
      }
    } else {
      if (!current) {
        // Skip stray tokens until a PA starts, except 'In play' which should glue to previous
        if (inPlay.test(t)) {
          current = pendingPitcherNote ? `${pendingPitcherNote} ${t}` : t;
          pendingPitcherNote = "";
        }
        continue;
      }
      // Continue current PA: include pitches, in-play desc, runner actions, etc.
      current += ` ${t}`;
    }
  }

  if (current) segments.push(current.trim());

  // Filter overly short or non-informative segments
  return segments.filter((s) => /\b(strike|walk|ground|fly|line|single|double|triple|home run|hit by pitch|in play|reaches? on error)\b/i.test(s));
}

export async function segmentGameText(
  rawGameText: string,
  options: { model?: string; maxRetries?: number; segmentationMode?: "det" | "llm" | "hybrid"; transportTimeoutMs?: number; verbose?: boolean } = {}
): Promise<string[]> {
  const { model = "gpt-5-mini", maxRetries = 2, segmentationMode = "hybrid", transportTimeoutMs, verbose } = options;
  const timeout = typeof transportTimeoutMs === "number" ? transportTimeoutMs : Number(process.env.OPENAI_TIMEOUT_MS ?? "45000");

  // Helper: LLM segmentation
  const llmSegment = async (text: string, previous?: string[]): Promise<string[]> => {
    let lastErr = "";
    const detBase = previous && previous.length ? previous : deterministicSegment(text);

    // Chunk deterministic segments to keep each prompt small
    const groups: string[][] = [];
    const MAX_GROUP_CHARS = 2000;
    const MAX_GROUP_PAS = 10;
    let cur: string[] = [];
    let curLen = 0;
    for (const s of detBase) {
      const addLen = s.length + 2;
      if (cur.length >= MAX_GROUP_PAS || curLen + addLen > MAX_GROUP_CHARS) {
        if (cur.length) groups.push(cur);
        cur = [];
        curLen = 0;
      }
      cur.push(s);
      curLen += addLen;
    }
    if (cur.length) groups.push(cur);

    const callOne = async (chunkText: string, prevCount: number): Promise<string[]> => {
      for (let attempt = 0; attempt < Math.max(1, maxRetries); attempt++) {
        try {
          const base = buildSegmentationPrompt(chunkText);
          const withPrev = prevCount > 0
            ? `${base}\n\nThe deterministic baseline for this CHUNK produced ${prevCount} segments. Improve upon it if needed. Only return segments from THIS chunk; do not include anything outside it.`
            : `${base}\n\nOnly return segments from THIS chunk; do not include anything outside it.`;
          const userPrompt = attempt === 0 ? withPrev : `${withPrev}\n\nLast error: ${lastErr}. Return JSON array only.`;
          if (verbose) console.error(`[segmentGameText] LLM segmentation attempt ${attempt + 1}/${Math.max(1, maxRetries)} using ${model} (chunk)`);
          const raw = await completeJSON({
            model,
            system: "You are a strict JSON array emitter. Output only valid JSON.",
            user: userPrompt,
            temperature: 0,
            timeoutMs: timeout,
            maxRetries: 2,
            verbosity: "low",
            reasoningEffort: "minimal",
            verbose,
          });
          const arr = extractJSON(raw);
          if (!Array.isArray(arr)) throw new Error("Segmentation response was not an array");
          const segs = arr.map((s) => String(s).trim()).filter(Boolean);
          if (!segs.length) throw new Error("No segments returned");
          return segs;
        } catch (e: any) {
          lastErr = String(e?.message || e);
          if (attempt === Math.max(1, maxRetries) - 1) throw new Error(lastErr);
        }
      }
      return [];
    };

    // For small baseline groups, fall back to raw char-based chunking to avoid a single giant prompt
    // This kicks in when the deterministic baseline is tiny relative to the raw text size.
    if (groups.length <= 1) {
      const needsFallback = detBase.length <= 5 && text.length > MAX_GROUP_CHARS;
      if (needsFallback) {
        const tnorm = text.replace(/\r\n?/g, "\n").replace(/\|/g, ". ").replace(/\s+/g, " ").trim();
        const sentences = tnorm.split(/(?<=[.!?])\s+/);
        const rawChunks: string[] = [];
        let buf = "";
        for (const sent of sentences) {
          const add = (buf ? " " : "") + sent;
          if (buf.length + add.length > MAX_GROUP_CHARS && buf.length > 0) {
            rawChunks.push(buf);
            buf = sent;
          } else {
            buf += add;
          }
        }
        if (buf) rawChunks.push(buf);
        if (rawChunks.length > 1) {
          const merged: string[] = [];
          for (let i = 0; i < rawChunks.length; i++) {
            const chunkText = rawChunks[i];
            if (verbose) console.error(`[segmentGameText] Fallback chunk ${i + 1}/${rawChunks.length} (char-based)`);
            const segs = await callOne(chunkText, 0);
            merged.push(...segs);
          }
          return merged;
        }
      }
      // Single call as final fallback
      return await callOne(text, detBase.length);
    }

    // Otherwise, process groups sequentially and merge
    const merged: string[] = [];
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      const chunkText = g.join(" \n");
      if (verbose) console.error(`[segmentGameText] Processing chunk ${gi + 1}/${groups.length} with ${g.length} baseline segments`);
      const segs = await callOne(chunkText, g.length);
      merged.push(...segs);
    }
    return merged;
  };

  // Deterministic first
  const detSegments = deterministicSegment(rawGameText);
  let segments = detSegments;

  if (segmentationMode === "llm") {
    segments = await llmSegment(rawGameText, detSegments);
  } else if (segmentationMode === "hybrid") {
    try {
      const llmSegs = await llmSegment(rawGameText, detSegments);
      if (llmSegs.length >= detSegments.length) segments = llmSegs;
    } catch {
      segments = detSegments;
    }
  }

  // Post-merge: join a summary-led segment immediately followed by a name-led segment (same play context)
  const typeLed = /^(Strikeout|Fly Out|Ground Out|Line Out|Walk|Hit By Pitch|Single|Double|Triple|Home Run|Reach(?:es)? on Error)\b/i;
  const nameLed = /^\s*[A-Z]{1,2}\s+[A-Z]{1,2}\s+(strikes out|walks|grounds out|flies out|lines out|doubles|triples|singles|homers|is hit by pitch|reaches on error)/i;
  const merged: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const cur = segments[i]?.trim();
    const nxt = segments[i + 1]?.trim();
    if (!cur) continue;
    if (nxt && typeLed.test(cur) && nameLed.test(nxt)) {
      merged.push(`${cur} ${nxt}`.trim());
      i++; // skip next; it is merged
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

export async function canonicalizeGameText(
  rawGameText: string,
  ctx: GameContext,
  options: { model?: string; maxRetries?: number; segmentationMode?: "det" | "llm" | "hybrid"; transportTimeoutMs?: number; verbose?: boolean; concurrency?: number; canonMode?: "llm" | "det"; segmentationRetries?: number } = {}
): Promise<CanonicalizeGameResult> {
  const { model = "gpt-5-mini", maxRetries = 2, segmentationMode = "hybrid", transportTimeoutMs, verbose } = options;
  const concurrency = Math.max(1, Number((options as any).concurrency ?? process.env.GS_CANON_CONCURRENCY ?? 3));
  const segRetries = Math.max(1, Number((options as any).segmentationRetries ?? maxRetries));
  const segments = await segmentGameText(rawGameText, { model, maxRetries: segRetries, segmentationMode, transportTimeoutMs, verbose });
  
  const isDet = (options as any).canonMode === "det";

  // Prepare results container: fill immediately for det mode, else allocate and fill via LLM workers
  const resultsArr: (PlateAppearanceCanonical | undefined)[] = isDet
    ? segments.map((s) => toMinimalCanonicalFromText(s))
    : new Array(segments.length);
  const errors: string[] = [];

  if (!isDet) {
    let next = 0;
    const worker = async (id: number) => {
      while (true) {
        const i = next++;
        if (i >= segments.length) break;
        const seg = segments[i];
        if (verbose) console.error(`[canonicalizeGameText] [w${id}] Canonicalizing segment ${i + 1}/${segments.length}`);
        const res = await canonicalizePlateAppearance(seg, ctx, { model, transportTimeoutMs, verbose, maxRetries });
        if (res.ok && res.data) {
          resultsArr[i] = res.data;
        } else {
          errors.push(`Segment ${i}: ${(res.errors || []).join("; ")}`);
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, segments.length) }, (_, k) => worker(k + 1));
    await Promise.all(workers);
  }

  // Deterministic backfill: use segment text (and neighbors) to fill missing batter/pitcher
  for (let i = 0; i < resultsArr.length; i++) {
    const pa = resultsArr[i];
    if (!pa) continue;
    const seg = segments[i] || "";
    const { batter, pitcher } = extractNamesFromText(seg);
    if (!pa.batter && batter) pa.batter = batter;
    if (!pa.pitcher && pitcher) pa.pitcher = pitcher;

    if (!pa.batter) {
      const verb = eventVerbFor(pa);
      if (verb) {
        // check next then previous
        const nxt = segments[i + 1] || "";
        const prv = segments[i - 1] || "";
        const hasVerb = (t: string) => new RegExp(`\\b${verb}\\b`, "i").test(t);
        const nextNames = extractNamesFromText(nxt);
        if (!pa.batter && nextNames.batter && hasVerb(nxt)) pa.batter = nextNames.batter;
        if (!pa.batter) {
          const prevNames = extractNamesFromText(prv);
          if (prevNames.batter && hasVerb(prv)) pa.batter = prevNames.batter;
        }
      }
    }
    if (!pa.pitcher) {
      const nxt = segments[i + 1] || "";
      const prv = segments[i - 1] || "";
      const nextNames = extractNamesFromText(nxt);
      if (!pa.pitcher && nextNames.pitcher) pa.pitcher = nextNames.pitcher;
      if (!pa.pitcher) {
        const prevNames = extractNamesFromText(prv);
        if (prevNames.pitcher) pa.pitcher = prevNames.pitcher;
      }
    }
  }

  const results: PlateAppearanceCanonical[] = resultsArr.filter(Boolean) as PlateAppearanceCanonical[];

  if (errors.length) return { ok: false, segments, data: results, errors };
  return { ok: true, segments, data: results };
}
