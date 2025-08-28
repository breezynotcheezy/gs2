import { NextResponse } from "next/server";
import { completeJSON } from "@gs-src/core/llm";

export const dynamic = "force-dynamic"; // ensure runtime execution

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const batter = String(body?.batter || "");
    const pas = Array.isArray(body?.pas) ? body.pas : [];
    const segments = Array.isArray(body?.segments) ? body.segments : [];
    const model = String(body?.model || "gpt-5-mini");

    if (!batter) {
      return NextResponse.json({ ok: false, error: "Missing batter" }, { status: 400 });
    }

    // Fast path: if there are no plate appearances, do not call the LLM.
    if (pas.length === 0) {
      return NextResponse.json({ ok: true, swing_mechanic: "", positional: "", opponent_pattern: "", confidence: 0 });
    }

    const system = [
      "You are a professional baseball hitting coach.",
      "Analyze ONLY the provided data for the player, independent of team. Do NOT invent or speculate beyond it.",
      "If evidence is insufficient for any field, output an empty string for that field.",
      "Return exactly three items in plain language (team-agnostic, not one-off situational):",
      "(1) swing_mechanic: concrete swing cue(s) the hitter can work on.",
      "(2) positional: stance/approach/positioning cue(s) for the hitter.",
      "(3) opponent_pattern: how opponents could pitch AND/OR position defense to exploit recurring tendencies.",
      "Keep items concise, specific, and grounded in observed patterns (not single at-bat anomalies).",
      "Output strictly valid JSON with keys: swing_mechanic, positional, opponent_pattern, confidence.",
      "confidence is a float 0..1 estimating reliability of these tips.",
    ].join(" ");

    const user = [
      `Batter: ${batter}`,
      "Context: PlateAppearanceCanonical objects and raw segment notes follow.",
      "Return JSON only.",
      "Produce exactly these fields: 'swing_mechanic', 'positional', 'opponent_pattern', 'confidence'.",
      "Rules:",
      "- Base insights solely on recurring patterns in the provided data (not one-off events). If not supported by evidence, leave the field empty.",
      "- Be concise and specific. If pitch types/zones or batted-ball tendencies are present in data, you may reference them.",
      "- 'opponent_pattern' should (when supported) include a brief pitch plan (e.g., pitch type/zone/sequence) and/or a brief fielding positioning cue.",
      "- Do not assume team; write generically so it applies regardless of which team the reader is on.",
      "Data (pas):",
      JSON.stringify(pas, null, 2),
      "Segments (notes):",
      JSON.stringify(segments, null, 2),
    ].join("\n\n");

    const raw = await completeJSON({
      model,
      system,
      user,
      temperature: 0.7,
      reasoningEffort: "low",
      verbosity: "low",
      timeoutMs: 20000,
      maxRetries: 1,
    });

    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try to salvage by extracting a JSON block if present
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch {}
      }
    }

    // Minimal sanitize: collapse extra spaces and trim. No content rewriting.
    const sanitize = (s: any) => String(s ?? "").replace(/\s{2,}/g, " ").trim();
    const swing = sanitize(parsed?.swing_mechanic);
    const positional = sanitize(parsed?.positional);
    const opponent = sanitize(parsed?.opponent_pattern);
    const conf: number = Math.max(0, Math.min(1, Number(parsed?.confidence ?? 0.75)));

    return NextResponse.json({ ok: true, swing_mechanic: swing, positional, opponent_pattern: opponent, confidence: conf });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
