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

  // Pitch mix and swing/miss proxies
  const pitchMix: Record<string, number> = { ball: 0, called_strike: 0, swinging_strike: 0, foul: 0, in_play: 0 };
  let swings = 0, misses = 0;
  let firstPitchBall = 0, firstPitchSwing = 0;
  let twoStrikeSwings = 0, twoStrikeKLooking = 0, twoStrikeKSw = 0;
  for (const pa of pas) {
    const seq = pa.pitches || [];
    if (seq[0] === "ball") firstPitchBall++;
    if (seq[0] === "swinging_strike" || seq[0] === "in_play") firstPitchSwing++;
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
    sample: { pas: n, pitchesSeen },
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
      twoStrikeSwingEvents: twoStrikeSwings,
      twoStrikeKLooking,
      twoStrikeKSw,
    },
    battedBall,
    power,
    pitchMix,
  };
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
      "You are an elite MLB hitting and game-planning assistant.",
      "Your outputs must be operational, specific, and testable.",
      "Only use the metrics and segments provided. Do not infer missing details.",
      "If evidence is weak or inconsistent, omit the item entirely.",
      "Forbidden phrases: speed band, speed bands, eye level, change eye level, mix speeds, vary speeds, tunneling, work on recognition, maintain approach.",
      "Each item must include concrete numbers (counts, %, or steps) and reference evidence.",
      "Output STRICT JSON only. No markdown or commentary.",
    ].join(" ");

    const user = [
      `Batter: ${batter}`,
      `Metrics: ${JSON.stringify(metrics)}`,
      `Segments (last up to 20): ${JSON.stringify(segments.slice(-20))}`,
      "Produce a plan with this exact JSON schema:",
      JSON.stringify({
        weaknesses: [
          { id: "string", title: "string", evidence: ["string"], metric: "string", current: "string", target: "string", why_it_matters: "string" },
        ],
        fix_plan: {
          one_session: [ { drill: "string", sets: "string", notes: "string", metric: "string", target: "string" } ],
          take_home: [ { drill: "string", schedule: "string", equipment: "string", metric: "string", target: "string" } ],
        },
        exploit_plan: [ { situation: "string", tactic: "string", evidence: "string" } ],
        kpis: [ { name: "string", current: 0, target: 0, timeframe: "1w" } ],
        session_plan: { warmup: ["string"], main: ["string"], competition: ["string"] },
        messaging: { cue: "string", mantra: "string" }
      }),
      "Constraints (hard):",
      "- Use only provided metrics and the literal segment texts. Do NOT invent pitch types, directions, or stats.",
      "- If evidence is insufficient, output fewer items (arrays can be empty).",
      "- Every item must include: a measurable baseline from Metrics or a quote/phrase from Segments, and a numeric target/timeframe.",
      "- Tactics must be executable in one sentence. Forbid vague verbs (e.g., 'vary speed bands', 'eye level', 'mix speeds').",
      "Reliability gates:",
      "- Only propose an exploit if sample >= 12 PAs OR >= 8 balls-in-play, AND the observed rate deviates >= 15 percentage points from neutral (e.g., contact vs K, GB vs LD, first-pitch take/swing).",
      "- For direction or fielder-based ideas, rely ONLY on explicit phrases inside Segments (e.g., 'grounds out to second base', 'to right field'). If direction is not present in Segments, omit direction-based positioning.",
      "Positioning rules:",
      "- If Segments show repeated right-side outs (e.g., 'to 1B/2B/right field'), recommend: 'infield: N steps toward 1B' where N = clamp(round((rate-0.50)*10), 1..3). Use 0 if not reliable.",
      "- Depth changes must be step-based: 'infield depth: +1 step in' or 'outfield depth: +1 step shallow'. Never recommend extreme shifts unless rate >= 0.80 and sample criteria are met.",
      "Pitch/location rules:",
      "- You may only recommend location/count sequencing derived from Metrics (e.g., 'first-pitch take rate high -> auto-strike early', 'two-strike called K% high -> expand up-and-in then land edge'). Do NOT claim pitch types unless segments explicitly name them.",
      "Examples (unacceptable -> acceptable):",
      "- Unacceptable: 'Opponents: vary speed bands and eye level after 0-1.'",
      "- Acceptable: '0-0: throw strike at knees (outer third). 0-1: repeat outer third. 2-2: expand 2-3 inches off outer edge.' (if supported by first-pitch take rate and miss-on-swings).",
    ].join("\n\n");

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

    return NextResponse.json({ ok: true, batter, metrics, plan });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
