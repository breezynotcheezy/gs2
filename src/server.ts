import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import dotenv from "dotenv";
import { canonicalizeGameText } from "./core/canon/game_canonicalizer";
import type { GameContext } from "./core/canon/types";

// Load env (.env.local preferred)
const envLocal = path.resolve(process.cwd(), ".env.local");
dotenv.config({ path: fs.existsSync(envLocal) ? envLocal : path.resolve(process.cwd(), ".env") });

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(process.cwd(), "public");

const PORT = Number(process.env.PORT || 5173);

function send(res: http.ServerResponse, code: number, body: any, headers: Record<string, string> = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(code, { "content-type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json", ...headers });
  res.end(payload);
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  let reqPath = (url.parse(req.url || "/").pathname || "/");
  if (reqPath === "/") reqPath = "/index.html";
  const fp = path.join(publicDir, path.normalize(reqPath));
  if (!fp.startsWith(publicDir)) {
    return send(res, 403, { ok: false, error: "forbidden" });
  }
  fs.readFile(fp, (err, data) => {
    if (err) {
      if (reqPath !== "/index.html") return send(res, 404, { ok: false, error: "not found" });
      // fallback empty page
      return send(res, 200, "<html><body>UI missing. Create public/index.html</body></html>", { "content-type": "text/html" });
    }
    const ext = path.extname(fp).toLowerCase();
    const type = ext === ".html" ? "text/html" : ext === ".js" ? "text/javascript" : ext === ".css" ? "text/css" : "application/octet-stream";
    res.writeHead(200, { "content-type": `${type}; charset=utf-8` });
    res.end(data);
  });
}

function parseBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const LIMIT = 5 * 1024 * 1024; // 5MB
    req.on("data", (c) => {
      chunks.push(c);
      size += c.length;
      if (size > LIMIT) {
        reject(new Error("payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const method = req.method || "GET";
    const pathname = (url.parse(req.url || "/").pathname || "/");

    if (method === "GET" && (pathname === "/" || pathname.startsWith("/index") || pathname.startsWith("/assets") || pathname.startsWith("/public"))) {
      return serveStatic(req, res);
    }

    if (method === "GET" && pathname === "/health") {
      return send(res, 200, { ok: true });
    }

    if (method === "POST" && pathname === "/extract") {
      if (!process.env.OPENAI_API_KEY) {
        return send(res, 500, { ok: false, error: "Missing OPENAI_API_KEY in env" });
      }
      const bodyRaw = await parseBody(req);
      let body: any;
      try {
        body = JSON.parse(bodyRaw || "{}");
      } catch {
        return send(res, 400, { ok: false, error: "Invalid JSON" });
      }
      const text: string = body?.text ?? "";
      const segMode: "det" | "llm" | "hybrid" = body?.segMode || "hybrid";
      const model: string = body?.model || "gpt-5-mini";
      const timeoutMs: number = typeof body?.timeoutMs === "number" ? body?.timeoutMs : Number(process.env.OPENAI_TIMEOUT_MS || 45000);
      const verbose: boolean = !!body?.verbose;
      const ctx: GameContext = body?.ctx || ({ inning: 1, half: "top", outs: 0, bases: {}, score: { home: 0, away: 0 } } as GameContext);

      if (!text || typeof text !== "string") return send(res, 400, { ok: false, error: "text required" });

      const result = await canonicalizeGameText(text, ctx, {
        model,
        segmentationMode: segMode,
        transportTimeoutMs: timeoutMs,
        verbose,
      });
      return send(res, 200, result);
    }

    return send(res, 404, { ok: false, error: "not found" });
  } catch (e: any) {
    console.error(e);
    return send(res, 500, { ok: false, error: String(e?.message || e) });
  }
});

server.listen(PORT, () => {
  console.log(`UI server running at http://localhost:${PORT}`);
});
