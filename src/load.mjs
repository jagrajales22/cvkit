import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { parse } from 'yaml';

/** Recursively collect every .yml/.yaml file under a directory. */
function yamlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...yamlFiles(full));
    else if (['.yml', '.yaml'].includes(extname(entry))) out.push(full);
  }
  return out.sort();
}

/**
 * Merge rule: arrays concatenate, objects shallow-merge, scalars last-wins.
 * This is what makes the profile modular — split it across as many files as you like.
 */
function merge(base, add, file) {
  for (const [key, value] of Object.entries(add)) {
    if (Array.isArray(value)) {
      base[key] = (base[key] ?? []).concat(value);
    } else if (value && typeof value === 'object') {
      base[key] = { ...(base[key] ?? {}), ...value };
    } else {
      base[key] = value;
    }
    void file;
  }
  return base;
}

export function loadProfile(dir = 'profile') {
  const profile = {};
  for (const file of yamlFiles(dir)) {
    const doc = parse(readFileSync(file, 'utf8'));
    if (doc) merge(profile, doc, file);
  }
  return profile;
}

export function loadTarget(path) {
  const doc = parse(readFileSync(path, 'utf8'));
  return doc.target ?? doc;
}

/** Every atom in the profile, flattened, with its parent role attached. */
export function allAtoms(profile) {
  const atoms = [];
  for (const role of profile.experience ?? []) {
    for (const atom of role.atoms ?? []) {
      atoms.push({ ...atom, role: role.id, roleTags: role.tags ?? [] });
    }
  }
  return atoms;
}

export function evidenceIndex(profile) {
  return Object.fromEntries((profile.evidence ?? []).map((e) => [e.id, e]));
}
