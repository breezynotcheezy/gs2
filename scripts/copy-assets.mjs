import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..');

async function ensureDir(p) {
  await fs.promises.mkdir(p, { recursive: true }).catch(() => {});
}

async function copyDir(src, dest) {
  // Node 18+ has fs.cp
  if (fs.cp) {
    await fs.promises.mkdir(dest, { recursive: true });
    await fs.promises.cp(src, dest, { recursive: true, force: true });
    return;
  }
  // Fallback
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  await ensureDir(dest);
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      await copyDir(s, d);
    } else if (e.isFile()) {
      await fs.promises.copyFile(s, d);
    }
  }
}

async function main() {
  const srcSchemaDir = path.join(repoRoot, 'src', 'core', 'canon', 'schema');
  const distSchemaDir = path.join(repoRoot, 'dist', 'core', 'canon', 'schema');
  try {
    const stat = await fs.promises.stat(srcSchemaDir);
    if (!stat.isDirectory()) return;
  } catch {
    // nothing to copy
    return;
  }
  await copyDir(srcSchemaDir, distSchemaDir);
  console.log(`[copy-assets] Copied schema to ${distSchemaDir}`);
}

main().catch((err) => {
  console.error('[copy-assets] Failed:', err);
  process.exitCode = 1;
});
