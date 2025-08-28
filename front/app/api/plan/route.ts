import { NextRequest, NextResponse } from "next/server";
import type { PlateAppearanceCanonical } from "@gs-src/core/canon/types";
import { completeJSON } from "@gs-src/core/llm";

function computeCounts(pitches: string[]) {
  let b = 0, s = 0;
  const states: Array<{ balls: number; strikes: number; ev: string }> = [];
  for (const ev of pitches) {
    states.push({ balls: b, strikes: s, ev });
    if (ev === "ball") b = Math.min(3, b + 1);
    else if (ev === "called_strike" || ev === "swinging_strike") s = Math.min(2, s + 1);
    else if (ev === "foul") s = Math.min(2, s + 1);
    else if (ev === "in_play") { /* terminal */ }
  }
  return states;
}

function deriveMetrics(pas: PlateAppearanceCanonical[]) {
  const n = pas.length;
  const pitchesSeen = pas.reduce((s, p) => s + (p.pitches?.length || 0), 0);
  const cnt = (r: string) => pas.filter((p) => p.pa_result === r).length;
  const isContact = (r: string) => ["gb", "fb", "ld", "single", "double", "triple", "hr", "reached_on_error", "fielder_choice"].includes(r);

  const contactRate = n ? pas.filter((p) => isContact(p.pa_result)).length / n : 0;
  const strikeoutRate = n ? cnt("strikeout") / n : 0;
  const walkRate = n ? cnt("walk") / n : 0;
  const hbpRate = n ? cnt("hbp") / n : 0;

  const battedBall = { gb: cnt("gb"), fb: cnt("fb"), ld: cnt("ld") };
  const power = { single: cnt("single"), double: cnt("double"), triple: cnt("triple"), hr: cnt("hr") };

  // Basic batting line approximations
  const walks = cnt("walk");
  const hbp = cnt("hbp");
  const hits = power.single + power.double + power.triple + power.hr;
  const ab = Math.max(0, n - walks - hbp); // approx AB (sac not tracked)
  const avg = ab ? hits / ab : 0;
  const obpDen = ab + walks + hbp; // sac flies not tracked
  const obp = obpDen ? (hits + walks + hbp) / obpDen : 0;
  const xbh = power.double + power.triple + power.hr;

  // Pitch mix and swing/miss proxies
  const pitchMix: Record<string, number> = { ball: 0, called_strike: 0, swinging_strike: 0, foul: 0, in_play: 0 };
  let swings = 0, misses = 0;
  let firstPitchBall = 0, firstPitchSwing = 0, firstPitchTake = 0;
  let twoStrikeSwings = 0, twoStrikeKLooking = 0, twoStrikeKSw = 0;
  for (const pa of pas) {
    const seq = pa.pitches || [];
    if (seq[0] === "ball") firstPitchBall++;
    if (seq[0] === "called_strike" || seq[0] === "ball") firstPitchTake++;
    if (seq[0] === "swinging_strike" || seq[0] === "in_play" || seq[0] === "foul") firstPitchSwing++;
    for (const ev of seq) pitchMix[ev] = (pitchMix[ev] || 0) + 1;
    const states = computeCounts(seq);
    for (const st of states) {
      const isSwing = st.ev === "swinging_strike" || st.ev === "in_play" || st.ev === "foul";
      if (isSwing) swings++;
      if (st.ev === "swinging_strike") misses++;
      if (st.strikes === 2 && (st.ev === "swinging_strike" || st.ev === "in_play" || st.ev === "foul")) twoStrikeSwings++;
    }
    if (pa.pa_result === "strikeout") {
      const last = seq[seq.length - 1];
      if (last === "called_strike") twoStrikeKLooking++;
      if (last === "swinging_strike") twoStrikeKSw++;
    }
  }

  return {
    sample: { pas: n, pitchesSeen, bip: Math.round(contactRate * n) },
    rates: {
      contactRate,
      strikeoutRate,
      walkRate,
      hbpRate,
      swingsPerPA: n ? swings / n : 0,
      missRateOnSwings: swings ? misses / swings : 0,
    },
    approach: {
      firstPitchBallRate: n ? firstPitchBall / n : 0,
      firstPitchSwingRate: n ? firstPitchSwing / n : 0,
      firstPitchTakeRate: n ? firstPitchTake / n : 0,
      twoStrikeSwingEvents: twoStrikeSwings,
      twoStrikeKLooking,
      twoStrikeKSw,
    },
    battedBall,
    power,
    batting: { hits, ab, avg, obp, xbh },
    pitchMix,
  };
}

// Compact and normalize recommendation text to the exact terse style
function sanitizeLine(s: any): string {
  let out = String(s ?? "").replace(/\s+/g, " ").trim()
  if (!out) return ""
  // Abbreviations and style tightening
  const reps: Array<[RegExp, string]> = [
    [/percent/gi, "%"],
    [/\bplate appearances?\b/gi, "PA"],
    [/\bpitches per (plate appearance|pa)\b/gi, "pitches/PA"],
    [/\bplate appearance\b/gi, "PA"],
    [/\bfirst pitch\b/gi, "first‑pitch"],
    [/\btwo strike\b/gi, "two‑strike"],
    [/\bdouble play\b/gi, "double‑play"],
    [/\boutfield\b/gi, "OF"],
    [/\binfield\b/gi, "IF"],
    [/\bstrikeout\b/gi, "K"],
    [/\bwalks?\b/gi, "BB"],
    [/\bhome runs?\b/gi, "HR"],
    [/\bline drives?\b/gi, "LD"],
    [/\bground( |-)balls?\b/gi, "GB"],
    [/\bfly( |-)balls?\b/gi, "FB"],
  ]
  for (const [rgx, repl] of reps) out = out.replace(rgx, repl)
  // Prefer em-dash for reason clauses
  out = out.replace(/\s-\s/g, " — ")
  // Length clamp to keep one concise line
  const MAX = 160
  if (out.length > MAX) out = out.slice(0, MAX - 1) + "…"
  return out
}

function enforcePatternsStyle(plan: any) {
  const tp = Array.isArray(plan?.teaching_patterns) ? plan.teaching_patterns : []
  const ep = Array.isArray(plan?.exploitable_patterns) ? plan.exploitable_patterns : []
  const clean = (x: any) => ({
    instruction: sanitizeLine(x?.instruction),
    evidence: sanitizeLine(x?.evidence),
  })
  const cleanTp = tp.map(clean).filter((x: any) => x.instruction)
  const cleanEp = ep.map(clean).filter((x: any) => x.instruction)
  return { ...plan, teaching_patterns: cleanTp.slice(0, 10), exploitable_patterns: cleanEp.slice(0, 10) }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const batter = String(body?.batter || "").trim();
    const pas = Array.isArray(body?.pas) ? (body.pas as PlateAppearanceCanonical[]) : [];
    const segments = Array.isArray(body?.segments) ? (body.segments as string[]) : [];

    if (!batter || pas.length === 0) {
      return NextResponse.json({ ok: false, error: "Missing batter or pas" }, { status: 400 });
    }

    const metrics = deriveMetrics(pas);

    const system = [
      "You are an elite MLB game-planning assistant.",
      "Outputs must be operational, terse, and testable. No fluff or hedging.",
      "Return STRICT JSON only with keys teaching_patterns and exploitable_patterns. No markdown or commentary.",
      "Each item is a single-line instruction with an 'evidence' string; omit items with weak or inconsistent evidence.",
      "Use only provided Metrics and literal Segments. Do not invent data.",
      "Forbidden phrases: speed band(s), eye level, mix speeds, tunneling, recognition work, maintain approach, 'consider', 'maybe', 'could'.",
    ].join(" ")
;

    const user = [
      `Batter: ${batter}`,
      `Metrics: ${JSON.stringify(metrics)}`,
      `Segments (last up to 20): ${JSON.stringify(segments.slice(-20))}`,
      "Produce a plan with this exact JSON schema:",
      JSON.stringify({
        teaching_patterns: [
          { instruction: "string", evidence: "string" }
        ],
        exploitable_patterns: [
          { instruction: "string", evidence: "string" }
        ]
      }),
      "Constraints (hard):",
      "- Use only provided Metrics and literal Segments. Do NOT invent directions or stats.",
      "- Arrays can be empty if evidence is weak.",
      "- teaching_patterns: each item is a single-line drill/coaching cue with how-to (imperative). Include minimal setup/reps when helpful.",
      "- exploitable_patterns: each item is a single-line in-game tactic (count+location and/or positioning).",
      "- Each item must reference evidence concisely in 'evidence' (e.g., '80% first‑pitch takes; high whiff up').",
      "- No hedging or vague verbs (e.g., vary speeds, eye level).",
      "Style exemplars (format only; do not copy numbers):",
      "Teaching: 'Delay contact on outer‑third — oppo‑delay tee drill: tee outer‑third, contact +2–3 in later; 3×10. Evidence: high called strikes outer edge; rollovers inside.'",
      "Teaching: 'Two‑strike battle — choke up 1/2‑in, widen stance; goal ≥2 fouls before ball in play. Evidence: high two‑strike K%.'",
      "Exploit: '0‑0 outer third for strike; then below‑zone off‑speed; IF DP depth; OF normal. Evidence: 80% first‑pitch takes; weak GB rate.'",
      "Exploit: 'Bust FB up 0‑1; back‑door breaker when behind; corners guard lines late. Evidence: 57% whiff high FB; oppo flares.'",
    ].join("\n\n")
;

    const raw = await completeJSON({
      model: "gpt-5-mini",
      system,
      user,
      temperature: 0,
      reasoningEffort: "low",
      verbosity: "low",
      timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS ?? 45000),
      maxRetries: 2,
      verbose: false,
    });

    let plan: any = null;
    try {
      plan = JSON.parse(raw);
    } catch {
      // Try to salvage JSON substring
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try { plan = JSON.parse(m[0]); } catch {}
      }
    }

    if (!plan || typeof plan !== "object") {
      return NextResponse.json({ ok: false, error: "Model output not JSON", raw }, { status: 502 });
    }

    // Sanitize patterns to remain single-line and concise before returning
    plan = enforcePatternsStyle(plan)

    return NextResponse.json({ ok: true, batter, metrics, plan });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
