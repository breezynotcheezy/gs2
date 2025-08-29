import { completeJSON } from "../llm";
import type { GameContext, PlateAppearanceCanonical } from "./types";
import { canonicalizePlateAppearance } from "./canonicalizer";
import { toMinimalCanonicalFromText } from "./cards";
import { createHash } from "node:crypto";

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
function extractNamesFromText(s: string): { batter?: string; pitcher?: string; batterSource?: "verb" | "cue"; pitcherSource?: "verb" | "cue" } {
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
  const batterCues = [
    "batting",
    "at bat",
    "at the plate",
    "to bat",
    "steps in",
    "leading off",
    "leads off",
    "now batting",
    "to the plate",
  ].join("|");
  const spacedNameRe = new RegExp(`\\b${nameToken}\\b\\s+(?:${verbs})`, "i");
  const compactNameRe = new RegExp(`\\b${initialsPair}\\b\\s+(?:${verbs})`, "i");
  const pitcherSpaced = new RegExp(`\\b${nameToken}\\b\\s+pitching`, "i");
  const pitcherCompact = new RegExp(`\\b${initialsPair}\\b\\s+pitching`, "i");
  // Name followed by batter cue
  const spacedNameCue = new RegExp(`\\b${nameToken}\\b\\s+(?:${batterCues})`, "i");
  const compactNameCue = new RegExp(`\\b${initialsPair}\\b\\s+(?:${batterCues})`, "i");
  // Cue then name (e.g., "Now batting: J M" or "Batting: John Smith")
  const cueThenSpaced = new RegExp(`(?:now batting|batting)[:]?-?\\s+${nameToken}\\b`, "i");

  // Support full names (e.g., "John Miller strikes out" or "John Miller pitching")
  // Allow letters, apostrophes, hyphens, and periods within name tokens.
  const fullName = "([A-Za-z][A-Za-z'.-]{1,})\\s+([A-Za-z][A-Za-z'.-]{1,})";
  const fullNameRe = new RegExp(`\\b${fullName}\\b\\s+(?:${verbs})`, "i");
  const pitcherFullName = new RegExp(`\\b${fullName}\\b\\s+pitching`, "i");
  const fullNameCue = new RegExp(`\\b${fullName}\\b\\s+(?:${batterCues})`, "i");
  const cueThenFullName = new RegExp(`(?:now batting|batting)[:]?-?\\s+${fullName}\\b`, "i");
  const t = s.replace(/\s+/g, " ").trim();
  let batter: string | undefined;
  let batterSource: "verb" | "cue" | undefined;
  // Try to classify source of the batter match (verb-led vs cue-led)
  let m: RegExpMatchArray | null = null;
  if ((m = t.match(fullNameRe))) { batterSource = "verb"; }
  else if ((m = t.match(fullNameCue))) { batterSource = "cue"; }
  else if ((m = t.match(spacedNameRe))) { batterSource = "verb"; }
  else if ((m = t.match(compactNameRe))) { batterSource = "verb"; }
  else if ((m = t.match(spacedNameCue))) { batterSource = "cue"; }
  else if ((m = t.match(compactNameCue))) { batterSource = "cue"; }
  else if ((m = t.match(cueThenFullName))) { batterSource = "cue"; }
  else if ((m = t.match(cueThenSpaced))) { batterSource = "cue"; }
  if (m) {
    const aRaw = (m[1] || "");
    const bRaw = (m[2] || "");
    const a = aRaw.charAt(0).toUpperCase();
    const b = bRaw.charAt(0).toUpperCase();
    if (a && b) batter = `${a} ${b}`;
  }
  let pitcher: string | undefined;
  let pitcherSource: "verb" | "cue" | undefined;
  let mp = t.match(pitcherFullName) || t.match(pitcherSpaced) || t.match(pitcherCompact);
  if (mp) {
    const aRaw = (mp[1] || "");
    const bRaw = (mp[2] || "");
    const a = aRaw.charAt(0).toUpperCase();
    const b = bRaw.charAt(0).toUpperCase();
    if (a && b) pitcher = `${a} ${b}`;
    pitcherSource = "cue";
  }
  return { batter, pitcher, batterSource, pitcherSource };
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
  // Preserve newlines to avoid collapsing multiple PAs into a single token.
  // Normalize whitespace per line, then rejoin with newlines so line boundaries remain available for tokenization.
  text = text
    .split("\n")
    .map((ln) => ln.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  // Split by sentence boundaries OR newline boundaries (many logs separate PAs by newlines)
  const tokens = text.split(/(?<=[.!?])\s+|\n+/);

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
  const verbPart = /(strikes out|walks|grounds out|flies out|lines out|doubles|triples|singles|homers|is hit by pitch|reaches on error)/i;
  const cuePart = /(batting|at bat|at the plate|to bat|steps in|leading off|leads off|now batting)/i;
  const nameLed = /^\s*[A-Z]{1,2}\s+[A-Z]{1,2}\s+(?:strikes out|walks|grounds out|flies out|lines out|doubles|triples|singles|homers|is hit by pitch|reaches on error|batting|at bat|at the plate|to bat|steps in|leading off|leads off|now batting)/i;
  const cueStart = /^\s*(Now batting|Batting)\b/i;
  const inPlay = /^\s*In play\b/i;

  const startOfPA = (t: string, haveCurrent: boolean) => {
    if (typeLed.test(t)) return true;
    if (nameLed.test(t)) return true;
    if (cueStart.test(t)) return true;
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
        // If this is a name-led description immediately following a summary token, merge into current.
        // Note: Do NOT merge solely due to presence of 'In play' inside the current token; that can belong to pitch sequence
        // and would incorrectly glue a new PA onto the previous one.
        const currentSummarized = typeLed.test(current);
        if (isName && currentSummarized) {
          // Only merge if the name-led token describes the SAME event as the summary type.
          // Derive expected verb from the summary type (e.g., "Strikeout" => "strikes out").
          const tm = current.match(/^(Strikeout|Fly Out|Ground Out|Line Out|Walk|Hit By Pitch|Single|Double|Triple|Home Run|Reach(?:es)? on Error)\b/i);
          const typeWord = tm ? tm[1].toLowerCase() : "";
          const typeToVerb: Record<string, string> = {
            "strikeout": "strikes out",
            "fly out": "flies out",
            "ground out": "grounds out",
            "line out": "lines out",
            "walk": "walks",
            "hit by pitch": "is hit by pitch",
            "single": "singles",
            "double": "doubles",
            "triple": "triples",
            "home run": "homers",
            "reach on error": "reaches on error",
            "reaches on error": "reaches on error",
          };
          const expectedVerb = typeToVerb[typeWord] || "";
          const samePlay = expectedVerb ? new RegExp(`\\b${expectedVerb}\\b`, "i").test(t) : false;
          if (samePlay) {
            current += ` ${pendingPitcherNote ? pendingPitcherNote + " " : ""}${t}`;
            pendingPitcherNote = "";
          } else {
            segments.push(current.trim());
            current = pendingPitcherNote ? `${pendingPitcherNote} ${t}` : t;
            pendingPitcherNote = "";
          }
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
  options: { model?: string; maxRetries?: number; segmentationMode?: "det" | "llm" | "hybrid"; transportTimeoutMs?: number; verbose?: boolean; segmentationConcurrency?: number } = {}
): Promise<string[]> {
  const { model = "gpt-5-mini", maxRetries = 2, segmentationMode = "hybrid", transportTimeoutMs, verbose } = options;
  const timeout = typeof transportTimeoutMs === "number" ? transportTimeoutMs : Number(process.env.OPENAI_TIMEOUT_MS ?? "45000");
  const segConcOpt = Math.max(1, Number((options as any).segmentationConcurrency ?? process.env.GS_SEG_LLM_CONCURRENCY ?? 2));

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
          const segConc = segConcOpt;
          const results: string[][] = new Array(rawChunks.length);
          let next = 0;
          const worker = async () => {
            while (true) {
              const i = next++;
              if (i >= rawChunks.length) break;
              const chunkText = rawChunks[i];
              if (verbose) console.error(`[segmentGameText] Fallback chunk ${i + 1}/${rawChunks.length} (char-based)`);
              const segs = await callOne(chunkText, 0);
              results[i] = segs && segs.length ? segs : deterministicSegment(chunkText);
            }
          };
          const workers = Array.from({ length: Math.min(segConc, rawChunks.length) }, () => worker());
          await Promise.all(workers);
          return results.flat();
        }
      }
      // Single call as final fallback, then ensure non-empty by falling back to deterministic
      const one = await callOne(text, detBase.length);
      return one && one.length ? one : detBase;
    }

    // Otherwise, process groups with limited parallelism and preserve order
    const segConc = segConcOpt;
    const results: string[][] = new Array(groups.length);
    let next = 0;
    const worker = async () => {
      while (true) {
        const gi = next++;
        if (gi >= groups.length) break;
        const g = groups[gi];
        const chunkText = g.join(" \n");
        if (verbose) console.error(`[segmentGameText] Processing chunk ${gi + 1}/${groups.length} with ${g.length} baseline segments`);
        const segs = await callOne(chunkText, g.length);
        // If LLM returns empty, fall back to baseline deterministic segments for this chunk
        results[gi] = segs && segs.length ? segs : g;
      }
    };
    const workers = Array.from({ length: Math.min(segConc, groups.length) }, () => worker());
    await Promise.all(workers);
    return results.flat();
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
  const nameLed = /^\s*[A-Z]{1,2}\s+[A-Z]{1,2}\s+(?:strikes out|walks|grounds out|flies out|lines out|doubles|triples|singles|homers|is hit by pitch|reaches on error|batting|at bat|at the plate|to bat|steps in|leading off|leads off|now batting)/i;
  const merged: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const cur = segments[i]?.trim();
    const nxt = segments[i + 1]?.trim();
    if (!cur) continue;
    if (nxt && typeLed.test(cur) && nameLed.test(nxt)) {
      const tm = cur.match(/^(Strikeout|Fly Out|Ground Out|Line Out|Walk|Hit By Pitch|Single|Double|Triple|Home Run|Reach(?:es)? on Error)\b/i);
      const typeWord = tm ? tm[1].toLowerCase() : "";
      const typeToVerb: Record<string, string> = {
        "strikeout": "strikes out",
        "fly out": "flies out",
        "ground out": "grounds out",
        "line out": "lines out",
        "walk": "walks",
        "hit by pitch": "is hit by pitch",
        "single": "singles",
        "double": "doubles",
        "triple": "triples",
        "home run": "homers",
        "reach on error": "reaches on error",
        "reaches on error": "reaches on error",
      };
      const expectedVerb = typeToVerb[typeWord] || "";
      const samePlay = expectedVerb ? new RegExp(`\\b${expectedVerb}\\b`, "i").test(nxt) : false;
      if (samePlay) {
        merged.push(`${cur} ${nxt}`.trim());
        i++; // skip next; it is merged
      } else {
        merged.push(cur);
      }
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

// Normalize various name styles to spaced initials (e.g., "John Miller" => "J M", "JM" => "J M")
function normalizeShortName(name: string): string {
  const t = String(name || "").replace(/\s+/g, " ").trim();
  if (!t) return t;
  // Already spaced initials
  const mSpaced = t.match(/^([A-Za-z])\s+([A-Za-z])$/);
  if (mSpaced) return `${mSpaced[1].toUpperCase()} ${mSpaced[2].toUpperCase()}`;
  // Compact initials
  const mCompact = t.match(/^([A-Za-z])([A-Za-z])$/);
  if (mCompact) return `${mCompact[1].toUpperCase()} ${mCompact[2].toUpperCase()}`;
  // Full name: use first and last tokens' initials
  const toks = t.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
  if (toks.length >= 2) {
    const first = toks[0].replace(/[^A-Za-z]/g, "");
    const last = toks[toks.length - 1].replace(/[^A-Za-z]/g, "");
    if (first && last) return `${first[0].toUpperCase()} ${last[0].toUpperCase()}`;
  }
  return t;
}

export async function canonicalizeGameText(
  rawGameText: string,
  ctx: GameContext,
  options: { model?: string; maxRetries?: number; segmentationMode?: "det" | "llm" | "hybrid"; transportTimeoutMs?: number; verbose?: boolean; concurrency?: number; canonMode?: "llm" | "det"; segmentationRetries?: number; segmentationConcurrency?: number } = {}
): Promise<CanonicalizeGameResult> {
  const { model = "gpt-5-mini", maxRetries = 2, segmentationMode = "hybrid", transportTimeoutMs, verbose } = options;
  const concurrency = Math.max(1, Number((options as any).concurrency ?? process.env.GS_CANON_CONCURRENCY ?? 3));
  const segRetries = Math.max(1, Number((options as any).segmentationRetries ?? maxRetries));
  const segments = await segmentGameText(rawGameText, { model, maxRetries: segRetries, segmentationMode, transportTimeoutMs, verbose, segmentationConcurrency: (options as any).segmentationConcurrency });
  
  const isDet = (options as any).canonMode === "det";

  // --- Per-segment LRU cache (avoids re-LLMing identical segments) ---
  type CanonCacheEntry = { ts: number; value: PlateAppearanceCanonical };
  const CANON_CACHE_MAX = Math.max(50, Number(process.env.GS_CANON_CACHE_MAX || 200));
  // Module-level cache store
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if (!(globalThis as any).__GS_CANON_CACHE) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    (globalThis as any).__GS_CANON_CACHE = new Map<string, CanonCacheEntry>();
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const CANON_CACHE: Map<string, CanonCacheEntry> = (globalThis as any).__GS_CANON_CACHE;

  function canonKey(seg: string, context: GameContext, model?: string, mode?: string) {
    const h = createHash("sha256");
    h.update(JSON.stringify({ v: 1, seg, ctx: context, model: model || "", mode: mode || "llm" }));
    return h.digest("hex");
  }
  function canonGet(key: string): PlateAppearanceCanonical | undefined {
    const e = CANON_CACHE.get(key);
    if (!e) return undefined;
    // bump recency
    CANON_CACHE.delete(key);
    e.ts = Date.now();
    CANON_CACHE.set(key, e);
    return e.value;
  }
  function canonSet(key: string, value: PlateAppearanceCanonical) {
    if (CANON_CACHE.size >= CANON_CACHE_MAX) {
      // evict oldest
      let oldestK: string | undefined;
      let oldestTs = Infinity;
      for (const [k, v] of CANON_CACHE.entries()) {
        if (v.ts < oldestTs) { oldestTs = v.ts; oldestK = k; }
      }
      if (oldestK) CANON_CACHE.delete(oldestK);
    }
    CANON_CACHE.set(key, { ts: Date.now(), value });
  }

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
        const key = canonKey(seg, ctx, model, (options as any).canonMode || "llm");
        const cached = canonGet(key);
        if (cached) {
          if (verbose) console.error(`[canonicalizeGameText] [w${id}] cache hit for segment ${i + 1}/${segments.length}`);
          resultsArr[i] = cached;
          continue;
        }
        if (verbose) console.error(`[canonicalizeGameText] [w${id}] Canonicalizing segment ${i + 1}/${segments.length}`);
        const res = await canonicalizePlateAppearance(seg, ctx, { model, transportTimeoutMs, verbose, maxRetries });
        if (res.ok && res.data) {
          resultsArr[i] = res.data;
          canonSet(key, res.data);
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
    const info = extractNamesFromText(seg);
    if (!pa.batter && info.batter) pa.batter = info.batter;
    if (!pa.pitcher && info.pitcher) pa.pitcher = info.pitcher;

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
    // Final cue-based backfill: allow previous segment "Now batting ..." to assign batter
    if (!pa.batter) {
      const prv = segments[i - 1] || "";
      const prevInfo = extractNamesFromText(prv);
      if (prevInfo.batter && prevInfo.batterSource === "cue") pa.batter = prevInfo.batter;
    }

    // Normalize names to spaced initials for consistent grouping downstream
    if (pa.batter) pa.batter = normalizeShortName(pa.batter);
    if (pa.pitcher) pa.pitcher = normalizeShortName(pa.pitcher);

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

  // Keep segments and data aligned: drop any positions where PA is missing
  const pairs = resultsArr.map((pa, i) => ({ pa, seg: segments[i] })).filter((x) => !!x.pa) as { pa: PlateAppearanceCanonical; seg: string }[];
  const retSegs = pairs.map((x) => x.seg);
  const results: PlateAppearanceCanonical[] = pairs.map((x) => x.pa);

  if (errors.length) return { ok: false, segments: retSegs, data: results, errors };
  return { ok: true, segments: retSegs, data: results };
}
