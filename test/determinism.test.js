import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function runCliDeterministic(inputPath, outPath) {
  const distCli = path.join(projectRoot, 'dist', 'cli.js');
  const useDist = await fileExists(distCli);
  const cmd = process.execPath;
  const args = useDist
    ? [distCli, inputPath, '--deterministic', '--out', outPath]
    : [path.join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.js'), path.join(projectRoot, 'src', 'cli.ts'), inputPath, '--deterministic', '--out', outPath];
  return await new Promise((resolve, reject) => {
    const ps = spawn(cmd, args, { cwd: projectRoot, env: { ...process.env } });
    let stdout = '';
    let stderr = '';
    ps.stdout.on('data', (d) => { stdout += d.toString(); });
    ps.stderr.on('data', (d) => { stderr += d.toString(); });
    ps.on('error', reject);
    ps.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`CLI exit ${code}. stderr=\n${stderr}\nstdout=\n${stdout}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

test('deterministic mode produces bit-identical outputs and stable metadata', async () => {
  const inputPath = path.join(projectRoot, 'gc.txt');
  const inputText = await fs.readFile(inputPath, 'utf8');
  const expectedGen = `deterministic:${sha256Hex(inputText)}`;

  const out1 = path.join(projectRoot, `out.det.1.${Date.now()}.json`);
  const out2 = path.join(projectRoot, `out.det.2.${Date.now()}.json`);

  try {
    await runCliDeterministic(inputPath, out1);
    await runCliDeterministic(inputPath, out2);

    const t1 = await fs.readFile(out1, 'utf8');
    const t2 = await fs.readFile(out2, 'utf8');

    // Byte-for-byte equality
    assert.equal(t1, t2, 'Outputs differ between deterministic runs');

    const j = JSON.parse(t1);
    assert.equal(j?.ok, true);
    assert.equal(j?.meta?.input, path.basename(inputPath));
    assert.equal(j?.meta?.deterministic, true);
    assert.equal(j?.meta?.generatedAt, expectedGen);
    assert.equal(j?.meta?.segMode, 'det');
    assert.equal(j?.meta?.canonMode, 'det');
    assert.equal(j?.meta?.recMode, 'det');

    // Minimal content sanity
    assert.ok(Array.isArray(j?.hitters), 'hitters must be an array');
  } finally {
    // Cleanup
    try { await fs.unlink(out1); } catch {}
    try { await fs.unlink(out2); } catch {}
  }
});
