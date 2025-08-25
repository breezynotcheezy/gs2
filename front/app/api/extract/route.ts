import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import { canonicalizeGameText } from "@gs-src/core/canon/game_canonicalizer";
import type { GameContext } from "@gs-src/core/canon/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function loadEnv() {
  // Load from front/.env* first
  dotenv.config();
  // Also try to load from repo root .env.local if present
  const repoRootEnv = path.resolve(process.cwd(), "..", ".env.local");
  if (fs.existsSync(repoRootEnv)) {
    dotenv.config({ path: repoRootEnv, override: false });
  }
}

export async function POST(req: NextRequest) {
  try {
    loadEnv();

    const body = await req.json().catch(() => ({} as any));
    const text: string = body?.text ?? "";
    const segMode: "det" | "llm" | "hybrid" = body?.segMode || "hybrid";
    const model: string = body?.model || "gpt-5-mini";
    const timeoutMs: number = typeof body?.timeoutMs === "number" ? body.timeoutMs : Number(process.env.OPENAI_TIMEOUT_MS || 45000);
    const verbose: boolean = !!body?.verbose;
    const envDet = process.env.GS_DETERMINISTIC;
    const detFromEnv = typeof envDet === "string" ? ["1", "true", "yes", "on"].includes(envDet.toLowerCase()) : false;
    const deterministic: boolean = typeof body?.deterministic === "boolean" ? body.deterministic : detFromEnv;
    const ctx: GameContext = body?.ctx || ({ inning: 1, half: "top", outs: 0, bases: {}, score: { home: 0, away: 0 } } as GameContext);

    if (!text || typeof text !== "string") {
      return NextResponse.json({ ok: false, error: "text required" }, { status: 400 });
    }

    const effectiveSegMode: "det" | "llm" | "hybrid" = deterministic ? "det" : segMode;
    const canonMode: "det" | "llm" | undefined = deterministic ? "det" : undefined;
    const needsLLM = !(canonMode === "det" && effectiveSegMode === "det");
    if (needsLLM && !process.env.OPENAI_API_KEY) {
      return NextResponse.json({ ok: false, error: "Missing OPENAI_API_KEY in env" }, { status: 500 });
    }

    const result = await canonicalizeGameText(text, ctx, {
      model,
      segmentationMode: effectiveSegMode,
      canonMode,
      maxRetries: deterministic ? 1 : undefined,
      concurrency: deterministic ? 1 : undefined,
      transportTimeoutMs: timeoutMs,
      verbose,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
