import Ajv from "ajv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PlateAppearanceCanonical } from "./types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.join(__dirname, "schema", "plate_appearance_canonical.schema.json");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));

// Ajv typing can be tricky under NodeNext; cast to any for construction
const ajv = new (Ajv as any)({ allErrors: true, strict: true, allowUnionTypes: true });
const validateAjv = ajv.compile(schema as any);

export interface ValidationResult {
  ok: boolean;
  errors?: string[];
}

export function explainAjvErrors(): string[] {
  if (!validateAjv.errors) return [];
  return validateAjv.errors.map((e: any) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`);
}

export function checkDomainInvariants(obj: PlateAppearanceCanonical): string[] {
  const errs: string[] = [];
  const r = obj.pa_result;
  const o = obj.outs_added;

  // Conservative domain rules
  if (r === "walk" || r === "hbp") {
    if (o !== 0) errs.push(`outs_added must be 0 for ${r}`);
  }
  if (r === "hr" || r === "double" || r === "triple") {
    if (o !== 0) errs.push(`outs_added must be 0 for ${r}`);
  }
  if (r === "strikeout") {
    if (o !== 1) errs.push(`outs_added must be 1 for strikeout`);
  }
  // Optional: check pitches length aligns with strikeout/BB patterns can be added later.

  return errs;
}

export function validatePlateAppearanceCanonical(obj: unknown): ValidationResult {
  const valid = validateAjv(obj);
  const errors: string[] = [];
  if (!valid) errors.push(...explainAjvErrors());

  if (valid) {
    const inv = checkDomainInvariants(obj as PlateAppearanceCanonical);
    errors.push(...inv);
  }

  return { ok: errors.length === 0, errors: errors.length ? errors : undefined };
}
