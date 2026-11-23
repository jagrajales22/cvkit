#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadProfile, loadTarget, evidenceIndex, allAtoms } from './load.mjs';
import { validate, isVerified } from './validate.mjs';
import { select, keywordGaps } from './select.mjs';
import { renderHTML } from './render-html.mjs';

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const C = { red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', dim: '\x1b[2m', bold: '\x1b[1m', off: '\x1b[0m' };
const say = (...a) => console.log(...a);

function report(findings) {
  const errors = findings.filter((f) => f.level === 'error');
  const warns = findings.filter((f) => f.level === 'warn');
  for (const f of errors) say(`${C.red}  error${C.off} ${f.where.padEnd(28)} ${f.message} ${C.dim}[${f.code}]${C.off}`);
  for (const f of warns) say(`${C.yellow}  warn ${C.off} ${f.where.padEnd(28)} ${f.message} ${C.dim}[${f.code}]${C.off}`);
  if (!findings.length) say(`${C.green}  clean${C.off}`);
  return { errors: errors.length, warns: warns.length };
}

function cmdCheck() {
  const profile = loadProfile(opt('profile', 'profile'));
  say(`${C.bold}Checking profile${C.off}`);
  const { errors, warns } = report(validate(profile));
  const evidence = evidenceIndex(profile);
  const atoms = allAtoms(profile);
  const verified = atoms.filter((a) => isVerified(a, evidence)).length;
  say('');
  say(`  ${atoms.length} atoms, ${verified} verified (${Math.round((verified / atoms.length) * 100)}%), ${errors} errors, ${warns} warnings`);
  process.exit(errors ? 1 : 0);
}

function cmdBuild() {
  const profileDir = opt('profile', 'profile');
  const targetPath = opt('target');
  const outDir = opt('out', 'build');
  const strict = flag('strict');

  if (!targetPath) {
    say('usage: cvkit build --target targets/<file>.yml [--strict] [--out build]');
    process.exit(2);
  }

  const profile = loadProfile(profileDir);
  const findings = validate(profile);
  const errors = findings.filter((f) => f.level === 'error');
  if (errors.length) {
    say(`${C.bold}Build refused — fix these first${C.off}`);
    report(errors);
    process.exit(1);
  }

  const target = loadTarget(targetPath);
  const selection = select(profile, target, { strict });
  const gaps = keywordGaps(selection.selected, target);

  mkdirSync(outDir, { recursive: true });
  const base = `${(profile.identity.name ?? 'cv').split(' ').slice(-2).join('_')}_${target.id}`;
  const htmlPath = join(outDir, `${base}.html`);
  writeFileSync(htmlPath, renderHTML(profile, target, selection));

  const planPath = join(outDir, `${base}.plan.json`);
  writeFileSync(planPath, JSON.stringify({
    target: target.id,
    strict,
    built: new Date().toISOString(),
    selected: selection.selected.map((a) => ({ id: a.id, role: a.role, score: a.score, verified: a.verified })),
    dropped: selection.dropped.map((a) => ({ id: a.id, reason: a.reason })),
    keyword_gaps: gaps,
    notes: selection.notes
  }, null, 2));

  const unverified = selection.selected.filter((a) => !a.verified);

  say(`${C.bold}Built${C.off} ${target.company ?? ''} ${target.role ?? target.id}`.trim());
  say(`  ${selection.selected.length} atoms selected, ${selection.dropped.length} dropped${strict ? `${C.green} (strict)${C.off}` : ''}`);
  if (unverified.length) {
    say(`${C.yellow}  ${unverified.length} selected atoms are not verified:${C.off} ${unverified.map((a) => a.id).join(', ')}`);
  }
  if (gaps.length) {
    say(`${C.yellow}  keyword gaps:${C.off} ${gaps.join(', ')}`);
    say(`${C.dim}  (these are the questions to prepare for, not text to paste in)${C.off}`);
  }
  for (const n of selection.notes) say(`${C.yellow}  ${n}${C.off}`);
  say('');
  say(`  ${htmlPath}`);
  say(`  ${planPath}`);
  say(`${C.dim}  PDF: open the HTML and print to PDF, or run \`npm run pdf\`${C.off}`);
}

function cmdEvidence() {
  const profile = loadProfile(opt('profile', 'profile'));
  const evidence = profile.evidence ?? [];
  const open = evidence.filter((e) => !e.defensible);
  const atoms = allAtoms(profile);

  say(`${C.bold}Evidence ledger${C.off}  ${evidence.length - open.length}/${evidence.length} defensible`);
  say('');
  if (!open.length) { say(`${C.green}  nothing open${C.off}`); return; }

  say(`${C.bold}Open items, by how much they cost you${C.off}`);
  const ranked = open
    .map((e) => {
      const blocked = atoms.filter((a) => (a.evidence ?? []).includes(e.id));
      const weight = blocked.reduce((s, a) => s + (a.weight ?? 1), 0);
      return { e, blocked, weight };
    })
    .sort((a, b) => b.weight - a.weight);

  for (const { e, blocked, weight } of ranked) {
    say(`${C.yellow}  ${e.id}${C.off} ${C.dim}(blocks ${blocked.length} atom(s), weight ${weight})${C.off}`);
    say(`    claim:  ${e.claim}`);
    if (e.baseline || e.result) say(`    need:   ${e.baseline ?? '?'} → ${e.result ?? '?'}`);
    say(`    source: ${e.source}`);
    say(`    atoms:  ${blocked.map((a) => a.id).join(', ') || '—'}`);
    say('');
  }
}

switch (cmd) {
  case 'check': cmdCheck(); break;
  case 'build': cmdBuild(); break;
  case 'evidence': cmdEvidence(); break;
  default:
    say(`cvkit — evidence-backed, modular CV generation

  cvkit check                         validate the profile and report integrity findings
  cvkit evidence                      show open evidence, ranked by what it blocks
  cvkit build --target <file> [--strict]
                                      select atoms for a target and render

  --profile <dir>   profile directory (default: profile)
  --out <dir>       output directory  (default: build)
  --strict          refuse to emit any claim that is not backed by defensible evidence
`);
}
