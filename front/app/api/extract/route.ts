import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import { createHash } from "node:crypto";
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

// Simple in-memory LRU cache to speed up repeated parses
type CacheEntry = { key: string; value: any; ts: number };
const MAX_CACHE = 20;
const cache = new Map<string, CacheEntry>();
function makeKey(obj: any) {
  const h = createHash("sha256");
  h.update(JSON.stringify(obj));
  return h.digest("hex");
}
function getCached(key: string) {
  const e = cache.get(key);
  if (!e) return undefined;
  // bump recency
  cache.delete(key);
  e.ts = Date.now();
  cache.set(key, e);
  return e.value;
}
function setCached(key: string, value: any) {
  if (cache.size >= MAX_CACHE) {
    // evict oldest
    let oldestKey: string | undefined;
    let oldestTs = Infinity;
    for (const [k, v] of cache.entries()) {
      if (v.ts < oldestTs) {
        oldestTs = v.ts;
        oldestKey = k;
      }
    }
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { key, value, ts: Date.now() });
}

export async function POST(req: NextRequest) {
  try {
    loadEnv();

    const body = await req.json().catch(() => ({} as any));
    let text: string = body?.text ?? "";
    // Default to hybrid (det+LLM) segmentation for robustness on large files
    const segMode: "det" | "llm" | "hybrid" = body?.segMode || "hybrid";
    const model: string = body?.model || "gpt-5-mini";
    const timeoutMs: number = typeof body?.timeoutMs === "number" ? body.timeoutMs : Number(process.env.OPENAI_TIMEOUT_MS || 45000);
    const verbose: boolean = !!body?.verbose;
    // Only enable deterministic mode if explicitly requested in the body; ignore env for safety
    const deterministic: boolean = typeof body?.deterministic === "boolean" ? body.deterministic : false;
    // Optional client-provided tuning knobs
    const segConc: number | undefined = Number.isFinite(body?.segConc) ? Math.max(1, Number(body.segConc)) : undefined;
    const canonConc: number | undefined = Number.isFinite(body?.canonConc) ? Math.max(1, Number(body.canonConc)) : undefined;
    const segRetries: number | undefined = Number.isFinite(body?.segRetries) ? Math.max(1, Number(body.segRetries)) : undefined;
    const ctx: GameContext = body?.ctx || ({ inning: 1, half: "top", outs: 0, bases: {}, score: { home: 0, away: 0 } } as GameContext);

    // If no JSON 'text' provided, accept raw text/plain bodies for very large inputs
    if (!text) {
      const ct = req.headers.get("content-type") || "";
      if (/^text\/plain/i.test(ct)) {
        const rawTxt = await req.text().catch(() => "");
        if (rawTxt) text = rawTxt;
      }
    }

    if (!text || typeof text !== "string") {
      return NextResponse.json({ ok: false, error: "text required" }, { status: 400 });
    }

    const effectiveSegMode: "det" | "llm" | "hybrid" = deterministic ? "det" : segMode;
    const canonMode: "det" | "llm" | undefined = deterministic ? "det" : undefined;
    const needsLLM = !(canonMode === "det" && effectiveSegMode === "det");
    if (needsLLM && !process.env.OPENAI_API_KEY) {
      return NextResponse.json({ ok: false, error: "Missing OPENAI_API_KEY in env" }, { status: 500 });
    }

    // Apply runtime overrides so core honors client tuning (speeds up large-file LLM parsing)
    if (typeof timeoutMs === "number") process.env.OPENAI_TIMEOUT_MS = String(timeoutMs);
    if (typeof segConc === "number") process.env.GS_SEG_LLM_CONCURRENCY = String(segConc);
    if (typeof canonConc === "number") process.env.GS_CANON_CONCURRENCY = String(canonConc);

    // Cache key includes normalized text (whitespace-insensitive) and key options that affect output
    const textForKey = text.replace(/\r\n?/g, "\n").replace(/\s+/g, " ").trim();
    const cacheKey = makeKey({ text: textForKey, segMode: effectiveSegMode, canonMode, model, timeoutMs, ctx });
    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { status: 200 });
    }

    const result = await canonicalizeGameText(text, ctx, {
      model,
      segmentationMode: effectiveSegMode,
      canonMode,
      // Keep retries minimal when deterministic; otherwise use defaults
      maxRetries: deterministic ? 1 : undefined,
      // Allow higher concurrency when not deterministic to speed LLM work
      concurrency: deterministic ? 1 : Number((canonConc ?? process.env.GS_CANON_CONCURRENCY) || 4),
      transportTimeoutMs: timeoutMs,
      verbose,
      segmentationRetries: segRetries,
      segmentationConcurrency: segConc,
    });

    setCached(cacheKey, result);
    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
