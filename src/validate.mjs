import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { allAtoms, evidenceIndex } from './load.mjs';

const PLACEHOLDER = /(TODO|TBD|\bX%|\[.*?\]|<[^>]+>)/i;

/**
 * Two layers of checking.
 *
 *  1. Schema — is the data shaped correctly?
 *  2. Integrity — do the claims hold up? This is the layer no other builder has.
 *
 * Integrity findings are either `error` (blocks a strict build) or `warn`.
 */
export function validate(profile, { schemaPath = 'schema/profile.schema.json' } = {}) {
  const findings = [];

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const ok = ajv.validate(schema, profile);
  if (!ok) {
    for (const e of ajv.errors) {
      findings.push({ level: 'error', code: 'schema', where: e.instancePath || '/', message: e.message });
    }
  }

  const evidence = evidenceIndex(profile);
  const atoms = allAtoms(profile);
  const seen = new Set();

  for (const atom of atoms) {
    const at = `${atom.role}/${atom.id}`;

    if (seen.has(atom.id)) {
      findings.push({ level: 'error', code: 'duplicate-id', where: at, message: `atom id "${atom.id}" is used more than once` });
    }
    seen.add(atom.id);

    const placeholder = atom.text.match(PLACEHOLDER);
    if (placeholder) {
      findings.push({ level: 'error', code: 'placeholder', where: at, message: `unfilled placeholder in text: "${placeholder[0]}"` });
    }

    const refs = atom.evidence ?? [];
    if (refs.length === 0) {
      findings.push({ level: 'warn', code: 'no-evidence', where: at, message: 'no evidence reference — cannot be verified' });
      continue;
    }

    for (const ref of refs) {
      if (!evidence[ref]) {
        findings.push({ level: 'error', code: 'dangling-evidence', where: at, message: `references unknown evidence id "${ref}"` });
      }
    }

    const backing = refs.map((r) => evidence[r]).filter(Boolean);
    const weak = backing.filter((e) => !e.defensible);
    if (weak.length) {
      findings.push({
        level: 'warn',
        code: 'not-defensible',
        where: at,
        message: `backed by evidence you marked not defensible: ${weak.map((e) => e.id).join(', ')}`
      });
    }

    const openSource = backing.filter((e) => PLACEHOLDER.test(e.source ?? ''));
    if (openSource.length) {
      findings.push({
        level: 'warn',
        code: 'unsourced',
        where: at,
        message: `evidence has no real source yet: ${openSource.map((e) => e.id).join(', ')}`
      });
    }
  }

  const used = new Set(atoms.flatMap((a) => a.evidence ?? []));
  for (const e of profile.evidence ?? []) {
    if (!used.has(e.id)) {
      findings.push({ level: 'warn', code: 'orphan-evidence', where: e.id, message: 'evidence not used by any atom — a bullet may be missing' });
    }
  }

  return findings;
}

/** An atom is verified iff every evidence entry behind it is defensible. Computed, never declared. */
export function isVerified(atom, evidence) {
  const refs = atom.evidence ?? [];
  if (refs.length === 0) return false;
  if (PLACEHOLDER.test(atom.text)) return false;
  return refs.every((r) => evidence[r]?.defensible === true);
}
