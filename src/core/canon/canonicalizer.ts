import { completeJSON } from "../llm";
import type { GameContext, PlateAppearanceCanonical } from "./types";
import { validatePlateAppearanceCanonical } from "./validator";
// Bundle the JSON schema at build-time; avoid runtime fs access in serverless
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON module import
import schema from "./schema/plate_appearance_canonical.schema.json";

export interface CanonicalizeOptions {
  maxRetries?: number; // default 3
  model?: string; // e.g., "gpt-5-mini"
  selfCheck?: boolean; // run a corrective self-check pass (default true)
  transportTimeoutMs?: number; // network timeout per request
  verbose?: boolean; // log progress to stderr
}

function extractJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch {}
  // Strip code fences if present
  const fence = text.match(/```(?:json)?\n([\s\S]*?)\n```/i);
  if (fence && fence[1]) {
    try { return JSON.parse(fence[1]); } catch {}
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const slice = text.substring(start, end + 1);
    try { return JSON.parse(slice); } catch {}
  }
  throw new Error("LLM did not return valid JSON payload");
}

export interface CanonicalizeResult {
  ok: boolean;
  data?: PlateAppearanceCanonical;
  errors?: string[];
  raw?: unknown;
}

function microHeuristic(raw: string): Partial<PlateAppearanceCanonical> {
  const lower = raw.toLowerCase();
  const out: Partial<PlateAppearanceCanonical> = {};

  // "flies out to center fielder" => fb, f8
  if (/flies? out to (?:the )?center fielder/.test(lower)) {
    out.pa_result = "fb" as const;
    out.fielder_num = 8 as any;
    out.outs_added = 1 as any;
  }
  // "scores on steal of home"
  if (/scores? on (?:a )?steal of home/.test(lower)) {
    out.explicit_runner_actions = [
      { runner: "", action: "steal_home", to: 4 },
    ];
  }

  // Deterministic name extraction from current PA text only
  // Prefer initials/short names. We do NOT infer beyond explicit mentions.
  const nameToken = "([A-Z]{1,2})\\s+([A-Z]{1,2})"; // e.g., "L D", "JN" won't match here unless space present
  const initialsPair = "([A-Z]{1})([A-Z]{1})"; // e.g., "LD" compact
  const batterVerbs = [
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

  // Examples we want to catch inside one PA bundle:
  //   "L D strikes out swinging, J N pitching, ..."
  //   "G B walks, J N pitching, ..."
  //   "M R is hit by pitch, J N pitching, ..."
  // Support either spaced initials ("L D") or compact ("LD"). We'll normalize compact to spaced.
  const spacedNameRe = new RegExp(`\\b${nameToken}\\b\\s+(?:${batterVerbs})`, "i");
  const compactNameRe = new RegExp(`\\b${initialsPair}\\b\\s+(?:${batterVerbs})`, "i");
  const pitcherReSpaced = new RegExp(`\\b${nameToken}\\b\\s+pitching`, "i");
  const pitcherReCompact = new RegExp(`\\b${initialsPair}\\b\\s+pitching`, "i");

  const rawClean = raw.replace(/\s+/g, " ").trim();
  let m = rawClean.match(spacedNameRe);
  if (!m) m = rawClean.match(compactNameRe);
  if (m) {
    const first = m[1]?.toUpperCase();
    const last = (m[2] ?? m[1])?.toUpperCase();
    if (first && last) out.batter = `${first} ${last}`;
  }
  let mp = rawClean.match(pitcherReSpaced);
  if (!mp) mp = rawClean.match(pitcherReCompact);
  if (mp) {
    const pf = mp[1]?.toUpperCase();
    const pl = (mp[2] ?? mp[1])?.toUpperCase();
    if (pf && pl) out.pitcher = `${pf} ${pl}`;
  }
  return out;
}

function buildPrompt(rawBundle: string, ctx: GameContext): string {
  return `You will canonicalize a youth baseball plate appearance into a strict JSON record.

Rules:
- Output JSON ONLY, no prose, matching the provided JSON Schema exactly.
- Do not infer base advances except explicit phrases (steal/advance/score). Forced advances are handled elsewhere.
- If uncertain, set confidence conservatively and leave optional fields null/omitted.
- Use short initials for names if present in the text.

JSON Schema (DRAFT-07):
${JSON.stringify(schema)}

Context:
${JSON.stringify(ctx, null, 2)}

Raw Plate Appearance Text:
${rawBundle}
`;
}

export async function canonicalizePlateAppearance(
  rawBundle: string,
  ctx: GameContext,
  options: CanonicalizeOptions = {}
): Promise<CanonicalizeResult> {
  const { maxRetries = 3, model = "gpt-5-mini", selfCheck = true, transportTimeoutMs, verbose } = options;

  const timeout = typeof transportTimeoutMs === "number"
    ? transportTimeoutMs
    : Number(process.env.OPENAI_TIMEOUT_MS ?? "45000");

  const basePrompt = buildPrompt(rawBundle, ctx);
  const heuristic = microHeuristic(rawBundle);

  let lastErrs: string[] = [];

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (verbose) {
        console.error(`[canonicalizePlateAppearance] attempt ${attempt + 1}/${maxRetries} using ${model}`);
      }
      const userPrompt = attempt === 0
        ? basePrompt
        : `${basePrompt}\n\nErrors last attempt: ${JSON.stringify(lastErrs)}\nRe-emit JSON only.`;

      const raw = await completeJSON({
        model,
        system: "You are a strict JSON emitter. Output ONLY a JSON object matching the provided schema. No prose.",
        user: userPrompt,
        temperature: 0,
        timeoutMs: timeout,
        maxRetries: 2,
        verbosity: "low",
        reasoningEffort: "minimal",
        verbose,
      });
      const parsed: any = typeof raw === "string" ? extractJSON(raw) : raw;

      // Merge minimal heuristic only to FILL GAPS. LLM values take precedence.
      const merged = { ...heuristic, ...parsed } as PlateAppearanceCanonical;

      const v = validatePlateAppearanceCanonical(merged);
      if (v.ok) return { ok: true, data: merged, raw: parsed };

      lastErrs = v.errors ?? ["unknown validation error"];
    } catch (e: any) {
      lastErrs = [String(e?.message || e)];
    }
  }

  // If first pass failed, stop here
  if (!selfCheck) return { ok: false, errors: lastErrs };

  // Optional self-check: ask the model to correct the JSON to match the raw text; enforce schema conceptually
  try {
    const checkPrompt = `You will correct a JSON record to align with the raw plate appearance text and the schema. Output JSON ONLY.\n\nSchema:\n${JSON.stringify(schema)}\n\nContext:\n${JSON.stringify(ctx, null, 2)}\n\nRaw Text:\n${rawBundle}\n\nExisting JSON (may contain errors):`;
    const raw = await completeJSON({
      model,
      system: "You are a strict JSON emitter. Output only JSON matching the schema.",
      user: checkPrompt,
      temperature: 0,
      timeoutMs: timeout,
      maxRetries: 2,
      verbosity: "low",
      reasoningEffort: "minimal",
      verbose,
    });
    const parsed: any = typeof raw === "string" ? extractJSON(raw) : raw;
    const v2 = validatePlateAppearanceCanonical(parsed);
    if (v2.ok) return { ok: true, data: parsed, raw: parsed };
    return { ok: false, errors: v2.errors };
  } catch (e: any) {
    return { ok: false, errors: lastErrs.length ? lastErrs : [String(e?.message || e)] };
  }
}
