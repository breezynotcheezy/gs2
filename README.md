# Green Seam (In-Process, LLM-assisted)

Professional-grade design with strict guarantees:

- Deterministic baseball logic — inning/outs/bases/score are never LLM-driven.
- Strict I/O schemas — every model output validates against JSON Schema + domain invariants.
- Observable & auditable — every decision has inputs, features and EV math.
- Graceful degradation — conservative defaults and flags on ambiguity.

## Quick start

1. Install deps

```bash
npm install
```

2. Dev run (offline validator demo)

```bash
npm run dev
```

3. Build and run compiled CLI

```bash
npm run build
npm start -- --demo
```

4. Validate a JSON file

```bash
npm run cli -- --validate-file path/to/pa.json
```

Env: put your key in `.env.local` as `OPENAI_API_KEY=...` (already present). We never print secrets and we validate all LLM outputs before use.

Default model: `gpt-5-mini` (cost-optimized GPT-5). Override with `--model <name>` in CLI or the UI model field.

Notes:
- LLM calls prefer the GPT-5 Responses API with minimal reasoning effort and low verbosity for fast, schema-accurate JSON.
- Falls back to Chat Completions automatically for non-GPT-5 models.

## Deterministic mode (offline, reproducible)

Run the entire pipeline fully offline with zero variability between runs by enabling deterministic mode:

```bash
# One-arg best pipeline: extract + canonicalize + cards with strict aliasing
npm run cli -- --deterministic gc.txt

# Or via env var (equivalent)
GS_DETERMINISTIC=1 npm run cli -- gc.txt
```

Deterministic mode guarantees the following:

- segmentationMode = `det` (no LLM)
- canonMode = `det` (no LLM)
- recMode = `det` (no LLM)
- retries = 1 for all stages
- concurrency = 1 for canonicalization and recommendations
- output metadata `meta.generatedAt` is a stable `deterministic:<sha256(input_text)>` instead of a timestamp

No `OPENAI_API_KEY` is required in deterministic mode.

## Env vars

- `OPENAI_API_KEY`: required for LLM paths (not needed in deterministic mode)
- `GS_DETERMINISTIC`: set to `1` or `true` to force deterministic mode
- `GS_CANON_CONCURRENCY`, `GS_CARDS_CONCURRENCY`: default concurrent workers (deterministic mode forces 1)
- `OPENAI_TIMEOUT_MS`: request timeout (ignored in deterministic mode)

## Test determinism

After installing deps, run tests. The suite runs a deterministic pipeline twice on `gc.txt` and asserts bit-identical output:

```bash
npm test
```

You can also inspect the produced JSON with:

```bash
npm run build
node dist/cli.js gc.txt --deterministic --out out.cards.json
```

## Layout (early scaffold)

```
src/
  cli.ts                    # minimal CLI (offline demo by default)
  core/
    canon/
      schema/plate_appearance_canonical.schema.json
      types.ts
      validator.ts          # Ajv + domain invariants
      canonicalizer.ts      # OpenAI JSON-schema constrained (stub)
    state/
      engine.ts             # stubbed entry point
```

Additional modules (features, model, policy, decision, assurance, storage, ui) will follow per the design.
