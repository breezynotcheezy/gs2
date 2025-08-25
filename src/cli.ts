#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { Command } from "commander";
import dotenv from "dotenv";
import { validatePlateAppearanceCanonical } from "./core/canon/validator.js";
import type { PlateAppearanceCanonical } from "./core/canon/types.js";
import { canonicalizePlateAppearance } from "./core/canon/canonicalizer.js";
import type { GameContext } from "./core/canon/types.js";
import { canonicalizeGameText, deterministicSegment } from "./core/canon/game_canonicalizer.js";
import { buildHitterCards } from "./core/canon/cards.js";

// Load env: prefer .env.local, fallback to .env
const envPathLocal = path.resolve(process.cwd(), ".env.local");
const envPath = fs.existsSync(envPathLocal)
  ? envPathLocal
  : path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });

const program = new Command();
program
  .name("gs")
  .description("Green Seam CLI")
  .option("--validate-file <file>", "validate a canonical PA JSON file")
  .option("--canonicalize [text...]", "canonicalize raw PA text using OpenAI")
  .option("--canonicalize-file <file>", "canonicalize raw PA from a text file")
  .option("--extract-only-file <file>", "offline: split ALL PAs from a text file (no LLM), outputs array of strings")
  .option("--extract-all-file <file>", "extract and canonicalize ALL PAs from a text file")
  .option("--export-cards-file <file>", "extract canonical PAs then export hitter cards with recommendations to JSON file")
  .option("--ctx-file <file>", "path to a GameContext JSON file")
  .option("--model <name>", "OpenAI model name", "gpt-5-mini")
  .option("--seg-mode <mode>", "segmentation mode: det | llm | hybrid (default llm)", "llm")
  .option("--timeout-ms <n>", "OpenAI request timeout in ms", "45000")
  .option("--canon-concurrency <n>", "canonicalization worker count (default 3)", "3")
  .option("--cards-concurrency <n>", "recommendations worker count (default 4)", "4")
  .option("--seg-retries <n>", "segmentation retries (default 2)", "2")
  .option("--canon-retries <n>", "canonicalization retries (default 3)", "3")
  .option("--cards-retries <n>", "recommendations retries (default 2)", "2")
  .option("--canon-mode <mode>", "canonicalization mode: llm | det (default llm)", "llm")
  .option("--rec-mode <mode>", "recommendations: llm | det (default llm)", "llm")
  .option("--aliases-file <file>", "JSON file with alias map: { 'JK': 'Jason Kay', 'J Kay': 'Jason Kay' }")
  .option("--aliases <json>", "inline JSON alias map")
  .option("--no-strict-aliases", "allow unresolved/ambiguous names without failing")
  .option("--out <file>", "output JSON path (default: <input>.cards.json)")
  .option("--verbose", "log progress to stderr", false)
  .option("--demo", "run offline demo validation", false)
  .option("--deterministic", "fully deterministic: det segmentation/canon/recs, retries=1, concurrency=1, stable meta", false)
  .parse(process.argv);

const opts = program.opts<{
  validateFile?: string;
  canonicalize?: string | string[];
  canonicalizeFile?: string;
  extractOnlyFile?: string;
  extractAllFile?: string;
  exportCardsFile?: string;
  ctxFile?: string;
  model?: string;
  segMode?: "det" | "llm" | "hybrid" | string;
  timeoutMs?: string;
  canonConcurrency?: string;
  cardsConcurrency?: string;
  segRetries?: string;
  canonRetries?: string;
  cardsRetries?: string;
  canonMode?: "llm" | "det" | string;
  recMode?: "llm" | "det" | string;
  aliasesFile?: string;
  aliases?: string;
  strictAliases?: boolean;
  deterministic?: boolean;
  out?: string;
  verbose?: boolean;
  demo?: boolean;
}>();

// Consolidated runner: one command path for extract + canonicalize + cards
async function runCardsCommand(inputFilePath: string, options: typeof opts, segDefaultWhenNotDet: "hybrid" | "det" = "hybrid") {
  const isDet = !!options.deterministic || ["1", "true"].includes(String(process.env.GS_DETERMINISTIC).toLowerCase());
  // Require API key only when any stage uses LLM
  if (
    !process.env.OPENAI_API_KEY && !isDet &&
    ((((options.recMode as any) ?? "llm") === "llm") || (((options.canonMode as any) ?? "llm") === "llm"))
  ) {
    console.error("Missing OPENAI_API_KEY. Put it in .env.local or .env, or run offline with --deterministic or --canon-mode det/--rec-mode det.");
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), inputFilePath);
  const textArg = fs.readFileSync(filePath, "utf-8");

  let ctx: GameContext;
  if (options.ctxFile) {
    const file = path.resolve(process.cwd(), options.ctxFile!);
    ctx = JSON.parse(fs.readFileSync(file, "utf-8"));
  } else {
    ctx = { inning: 1, half: "top", outs: 0, bases: {}, score: { home: 0, away: 0 } } as GameContext;
  }

  const segModeEff = isDet ? "det" : ((options.segMode as any) || segDefaultWhenNotDet);
  const canonModeEff = isDet ? "det" : ((options.canonMode as any) || "llm");
  const recModeEff = isDet ? "det" : ((options.recMode as any) || "llm");
  const segRetriesEff = isDet ? 1 : Number(options.segRetries || "2");
  const canonRetriesEff = isDet ? 1 : Number(options.canonRetries || "3");
  const canonConcEff = isDet ? 1 : Number(options.canonConcurrency || "3");
  const cardsConcEff = isDet ? 1 : Number(options.cardsConcurrency || "4");
  const cardsRetriesEff = isDet ? 1 : Number(options.cardsRetries || "2");

  const canRes = await canonicalizeGameText(textArg, ctx, {
    model: options.model,
    segmentationMode: segModeEff as any,
    segmentationRetries: segRetriesEff,
    transportTimeoutMs: Number(options.timeoutMs || "45000"),
    verbose: !!options.verbose,
    concurrency: canonConcEff,
    maxRetries: canonRetriesEff,
    canonMode: canonModeEff,
  });

  if (!canRes.ok) {
    if (canRes.segments?.length) {
      console.error("Segments (debug):\n" + JSON.stringify(canRes.segments, null, 2));
    }
    console.error("Extraction failed:\n" + (canRes.errors || []).join("\n"));
    if (canRes.data?.length) {
      console.log(JSON.stringify(canRes.data, null, 2));
    }
    process.exit(2);
  }

  const paList: PlateAppearanceCanonical[] = (canRes.data || []) as PlateAppearanceCanonical[];

  // Parse aliases (inline takes precedence over file)
  let aliasesObj: Record<string, string> | undefined = undefined;
  if (options.aliases) {
    const aliasesStr: string = options.aliases as string;
    try {
      aliasesObj = JSON.parse(aliasesStr);
    } catch {
      console.error("Invalid --aliases JSON. Provide a valid JSON object, e.g. { \"JK\": \"Jason Kay\" }");
      process.exit(1);
    }
  } else if (options.aliasesFile) {
    const fileArg: string = options.aliasesFile as string;
    const aPath = path.resolve(process.cwd(), fileArg);
    try {
      aliasesObj = JSON.parse(fs.readFileSync(aPath, "utf-8"));
    } catch {
      console.error(`Failed to read --aliases-file at ${aPath}`);
      process.exit(1);
    }
  }

  const cardsRes = await buildHitterCards(paList, {
    model: options.model,
    recMode: recModeEff as any,
    transportTimeoutMs: Number(options.timeoutMs || "45000"),
    verbose: !!options.verbose,
    concurrency: cardsConcEff,
    maxRetries: cardsRetriesEff,
    aliases: aliasesObj,
    strictAliases: options.strictAliases,
  });

  if (!cardsRes.ok) {
    console.error((cardsRes.errors || []).join("\n"));
    process.exit(2);
  }

  const outPath = path.resolve(process.cwd(), options.out || `${path.basename(filePath)}.cards.json`);
  const outJson = {
    ok: true,
    meta: {
      input: path.basename(filePath),
      generatedAt: (isDet ? `deterministic:${createHash("sha256").update(textArg).digest("hex")}` : new Date().toISOString()),
      model: options.model,
      segMode: segModeEff,
      canonMode: canonModeEff,
      recMode: recModeEff,
      timeoutMs: Number(options.timeoutMs || "45000"),
      canon: { ok: true, totalPAs: paList.length, errors: [] as string[] },
      recErrors: cardsRes.errors || [],
      deterministic: isDet,
    },
    hitters: cardsRes.cards,
  };
  fs.writeFileSync(outPath, JSON.stringify(outJson, null, 2));
  console.log(outPath);
  process.exit(0);
}

async function main() {
  // BEST PIPELINE: one positional arg (file path), no flags => extract+canonicalize (hybrid), strict aliasing, export cards
  const posArgs = (program.args || []) as string[];
  const noModeFlags = !opts.validateFile && !opts.canonicalize && !opts.canonicalizeFile && !opts.extractOnlyFile && !opts.extractAllFile && !opts.exportCardsFile;
  if (posArgs.length >= 1 && noModeFlags) {
    await runCardsCommand(posArgs[0], opts, "hybrid");
  }

  if (opts.validateFile) {
    const file = path.resolve(process.cwd(), opts.validateFile);
    const content = fs.readFileSync(file, "utf-8");
    const json = JSON.parse(content);
    const result = validatePlateAppearanceCanonical(json);
    if (result.ok) {
      console.log("OK: file is a valid PlateAppearanceCanonical record.");
      process.exit(0);
    } else {
      console.error("INVALID: \n" + (result.errors || []).join("\n"));
      process.exit(1);
    }

  // Export hitter cards with recommendations
  if (opts.exportCardsFile) {
    await runCardsCommand(opts.exportCardsFile!, opts, "det");
  }
  }

  if (opts.extractOnlyFile) {
    const filePath = path.resolve(process.cwd(), opts.extractOnlyFile!);
    const textArg = fs.readFileSync(filePath, "utf-8");
    const segs = deterministicSegment(textArg);
    console.log(JSON.stringify(segs, null, 2));
    process.exit(0);
  }

  if (opts.extractAllFile) {
    const isDet = !!opts.deterministic || ["1", "true"].includes(String(process.env.GS_DETERMINISTIC).toLowerCase());
    if (!process.env.OPENAI_API_KEY && !isDet && (((opts.canonMode as any) ?? "llm") === "llm")) {
      console.error("Missing OPENAI_API_KEY. Put it in .env.local or .env, or run with --canon-mode det.");
      process.exit(1);
    }
    const filePath = path.resolve(process.cwd(), opts.extractAllFile!);
    const textArg = fs.readFileSync(filePath, "utf-8");
    let ctx: GameContext;
    if (opts.ctxFile) {
      const file = path.resolve(process.cwd(), opts.ctxFile!);
      ctx = JSON.parse(fs.readFileSync(file, "utf-8"));
    } else {
      ctx = {
        inning: 1,
        half: "top",
        outs: 0,
        bases: {},
        score: { home: 0, away: 0 },
      } as GameContext;
    }
    try {
      const segModeEff = isDet ? "det" : (opts.segMode as any);
      const canonModeEff = isDet ? "det" : ((opts.canonMode as any) || "llm");
      const canonRetriesEff = isDet ? 1 : Number(opts.canonRetries || "3");
      const canonConcEff = isDet ? 1 : Number(opts.canonConcurrency || "3");
      const res = await canonicalizeGameText(textArg, ctx, {
        model: opts.model,
        segmentationMode: segModeEff as any,
        segmentationRetries: isDet ? 1 : Number(opts.segRetries || "2"),
        transportTimeoutMs: Number(opts.timeoutMs || "45000"),
        verbose: !!opts.verbose,
        concurrency: canonConcEff,
        maxRetries: canonRetriesEff,
        canonMode: canonModeEff,
      });
      if (res.ok) {
        console.log(JSON.stringify(res.data || [], null, 2));
        process.exit(0);
      } else {
        if (res.segments?.length) {
          console.error("Segments (debug):\n" + JSON.stringify(res.segments, null, 2));
        }
        console.error("Extraction failed:\n" + (res.errors || []).join("\n"));
        // still print partial successes if any
        if (res.data?.length) {
          console.log(JSON.stringify(res.data, null, 2));
        }
        process.exit(2);
      }
    } catch (e) {
      console.error(e);
      process.exit(2);
    }
  }

  if (opts.canonicalizeFile) {
    if (!process.env.OPENAI_API_KEY) {
      console.error("Missing OPENAI_API_KEY. Put it in .env.local or .env.");
      process.exit(1);
    }
    const filePath = path.resolve(process.cwd(), opts.canonicalizeFile!);
    const textArg = fs.readFileSync(filePath, "utf-8");
    let ctx: GameContext;
    if (opts.ctxFile) {
      const file = path.resolve(process.cwd(), opts.ctxFile!);
      ctx = JSON.parse(fs.readFileSync(file, "utf-8"));
    } else {
      ctx = {
        inning: 1,
        half: "top",
        outs: 0,
        bases: {},
        score: { home: 0, away: 0 },
      } as GameContext;
    }
    try {
      const res = await canonicalizePlateAppearance(textArg, ctx, {
        model: opts.model,
        transportTimeoutMs: Number(opts.timeoutMs || "45000"),
        verbose: !!opts.verbose,
      });
      if (res.ok) {
        console.log(JSON.stringify(res.data, null, 2));
        process.exit(0);
      } else {
        console.error("Canonicalization failed:\n" + (res.errors || []).join("\n"));
        process.exit(2);
      }
    } catch (e) {
      console.error(e);
      process.exit(2);
    }
  }

  if (opts.canonicalize) {
    const textArg = Array.isArray(opts.canonicalize)
      ? opts.canonicalize.join(" ")
      : opts.canonicalize;
    if (!process.env.OPENAI_API_KEY) {
      console.error("Missing OPENAI_API_KEY. Put it in .env.local or .env.");
      process.exit(1);
    }
    let ctx: GameContext;
    if (opts.ctxFile) {
      const file = path.resolve(process.cwd(), opts.ctxFile!);
      ctx = JSON.parse(fs.readFileSync(file, "utf-8"));
    } else {
      ctx = {
        inning: 1,
        half: "top",
        outs: 0,
        bases: {},
        score: { home: 0, away: 0 },
      } as GameContext;
    }
    try {
      const res = await canonicalizePlateAppearance(textArg as string, ctx, {
        model: opts.model,
        transportTimeoutMs: Number(opts.timeoutMs || "45000"),
        verbose: !!opts.verbose,
      });
      if (res.ok) {
        console.log(JSON.stringify(res.data, null, 2));
        process.exit(0);
      } else {
        console.error("Canonicalization failed:\n" + (res.errors || []).join("\n"));
        process.exit(2);
      }
    } catch (e) {
      console.error(e);
      process.exit(2);
    }
  }

  // Default demo
  if (opts.demo || !opts.validateFile) {
    const demo: PlateAppearanceCanonical = {
      pa_result: "fb",
      pitches: ["ball", "called_strike", "in_play"],
      batter: "A L",
      pitcher: "R S",
      fielder_num: 8,
      outs_added: 1,
      explicit_runner_actions: [],
      notes: ["In play. flies out to center fielder"],
      confidence: 0.92,
    };
    const result = validatePlateAppearanceCanonical(demo);
    if (result.ok) {
      console.log("Demo record is valid.\n", JSON.stringify(demo, null, 2));
      process.exit(0);
    } else {
      console.error("Demo record invalid:\n" + (result.errors || []).join("\n"));
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
