import OpenAI from "openai";

export function isGpt5(model?: string): boolean {
  return !!model && /^gpt-5(?:-|$)/i.test(model);
}

export function makeClient(opts?: { timeout?: number; maxRetries?: number }) {
  const timeout = typeof opts?.timeout === "number" ? opts.timeout : Number(process.env.OPENAI_TIMEOUT_MS ?? "45000");
  const maxRetries = typeof opts?.maxRetries === "number" ? opts.maxRetries : 2;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout, maxRetries });
}

export interface CompleteJSONParams {
  model: string;
  system?: string;
  user: string;
  temperature?: number;
  timeoutMs?: number;
  maxRetries?: number;
  verbosity?: "low" | "medium" | "high";
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  verbose?: boolean;
  client?: OpenAI;
}

// Returns raw text content (expected to be JSON by caller prompts)
export async function completeJSON(params: CompleteJSONParams): Promise<string> {
  const {
    model,
    system,
    user,
    temperature = 0,
    timeoutMs,
    maxRetries,
    verbosity = "low",
    reasoningEffort = "minimal",
    verbose,
    client,
  } = params;

  const c = client ?? makeClient({ timeout: timeoutMs, maxRetries });

  if (isGpt5(model) && (c as any).responses && typeof (c as any).responses.create === "function") {
    // Prefer Responses API for GPT-5 to leverage reasoning + verbosity controls
    const input = [system ? `System:\n${system}` : "", user].filter(Boolean).join("\n\n");
    if (verbose) console.error(`[llm] responses.create using ${model}`);
    const resp: any = await (c as any).responses.create({
      model,
      input,
      reasoning: { effort: reasoningEffort },
      text: { verbosity },
    } as any);
    const out = resp?.output_text
      ?? resp?.content?.map((p: any) => (p?.text || p?.content || "")).join("")
      ?? "";
    return String(out || "");
  }

  // Fallback to Chat Completions
  const messages = [
    ...(system ? [{ role: "system", content: system } as const] : []),
    { role: "user", content: user } as const,
  ];
  if (verbose) console.error(`[llm] chat.completions.create using ${model}`);
  const resp = await c.chat.completions.create({ model, messages: messages as any, temperature });
  return String(resp.choices?.[0]?.message?.content ?? "");
}
