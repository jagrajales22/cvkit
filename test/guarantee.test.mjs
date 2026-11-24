/**
 * R1 — the core guarantee.
 *
 * "--strict builds drop any claim whose evidence you have not marked defensible."
 *
 * Every test here checks that promise directly. A failure means the tool's whole
 * reason for existing is broken, so these run first and matter most.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProfile, evidenceIndex, allAtoms } from '../src/load.mjs';
import { isVerified, validate } from '../src/validate.mjs';
import { select } from '../src/select.mjs';
import { renderHTML } from '../src/render-html.mjs';
import { fixture, cleanup, minimal, target } from './helpers.mjs';

test('R1.1 unverified atom never reaches a strict build', () => {
  const dir = fixture(minimal({ evidenceDefensible: false }));
  const profile = loadProfile(dir);
  const { selected } = select(profile, target(), { strict: true });
  assert.equal(selected.length, 0, 'strict kept an atom backed by non-defensible evidence');
  cleanup(dir);
});

test('R1.2 unverified atom DOES reach a normal build, flagged', () => {
  const dir = fixture(minimal({ evidenceDefensible: false }));
  const profile = loadProfile(dir);
  const { selected } = select(profile, target(), { strict: false });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].verified, false, 'atom should be marked unverified');
  cleanup(dir);
});

test('R1.3 pinned atoms do NOT bypass strict mode', () => {
  const dir = fixture(minimal({ evidenceDefensible: false, atomExtra: '        pinned: true' }));
  const profile = loadProfile(dir);
  const { selected } = select(profile, target(), { strict: true });
  assert.equal(selected.length, 0,
    'a pinned atom with non-defensible evidence reached a strict build — strict must outrank pinned');
  cleanup(dir);
});

test('R1.4 force_include does NOT bypass strict mode', () => {
  const dir = fixture(minimal({ evidenceDefensible: false }));
  const profile = loadProfile(dir);
  const { selected } = select(profile, target({ force_include: ['A-1'] }), { strict: true });
  assert.equal(selected.length, 0,
    'force_include smuggled an unverified claim into a strict build');
  cleanup(dir);
});

test('R1.5 an atom with no evidence at all is never verified', () => {
  const dir = fixture({
    ...minimal(),
    'experience.yml': `
experience:
  - id: EXP-a
    org: Acme
    title: Engineer
    start: "2020-01"
    atoms:
      - id: A-1
        text: A claim with nothing behind it.
`
  });
  const profile = loadProfile(dir);
  const atom = allAtoms(profile)[0];
  assert.equal(isVerified(atom, evidenceIndex(profile)), false);
  cleanup(dir);
});

test('R1.6 an atom citing a nonexistent evidence id is not verified', () => {
  const dir = fixture({
    ...minimal(),
    'evidence.yml': `
evidence:
  - id: EV-OTHER
    claim: Unrelated
    source: Somewhere
    defensible: true
`
  });
  const profile = loadProfile(dir);
  const atom = allAtoms(profile)[0];
  assert.equal(isVerified(atom, evidenceIndex(profile)), false,
    'a dangling evidence reference must not count as verification');
  cleanup(dir);
});

test('R1.7 one non-defensible entry among several poisons the atom', () => {
  const dir = fixture({
    ...minimal(),
    'experience.yml': `
experience:
  - id: EXP-a
    org: Acme
    title: Engineer
    start: "2020-01"
    atoms:
      - id: A-1
        text: Backed by two sources, one of them weak.
        evidence: [EV-1, EV-2]
`,
    'evidence.yml': `
evidence:
  - id: EV-1
    claim: Solid
    source: Real
    defensible: true
  - id: EV-2
    claim: Shaky
    source: TODO
    defensible: false
`
  });
  const profile = loadProfile(dir);
  const atom = allAtoms(profile)[0];
  assert.equal(isVerified(atom, evidenceIndex(profile)), false,
    'verification must require ALL backing evidence to be defensible');
  cleanup(dir);
});

test('R2.1 a placeholder in atom text blocks the build', () => {
  const dir = fixture(minimal({ atomText: 'Reduced cost by TODO% last year.' }));
  const profile = loadProfile(dir);
  const errors = validate(profile).filter((f) => f.level === 'error');
  assert.ok(errors.some((e) => e.code === 'placeholder'), 'TODO in text must be an error');
  cleanup(dir);
});

test('R2.2 a placeholder makes an atom unverified even with defensible evidence', () => {
  const dir = fixture(minimal({ atomText: 'Improved throughput by X%.', evidenceDefensible: true }));
  const profile = loadProfile(dir);
  const atom = allAtoms(profile)[0];
  assert.equal(isVerified(atom, evidenceIndex(profile)), false);
  cleanup(dir);
});

test('R2.3 no placeholder survives into rendered HTML', () => {
  const dir = fixture(minimal({ atomText: 'Did a real thing, measured properly.' }));
  const profile = loadProfile(dir);
  const selection = select(profile, target(), { strict: true });
  const html = renderHTML(profile, target(), selection);
  assert.doesNotMatch(html, /TODO|TBD|<fill>/i);
  cleanup(dir);
});
