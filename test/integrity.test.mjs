/**
 * R3 — data integrity. Wrong data on a CV is worse than missing data, because
 * the reader cannot tell it is wrong and the candidate cannot defend it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProfile, allAtoms } from '../src/load.mjs';
import { validate } from '../src/validate.mjs';
import { fixture, cleanup, minimal } from './helpers.mjs';

const codes = (p) => validate(p).map((f) => f.code);

test('R3.1 modular files merge instead of overwriting', () => {
  const dir = fixture({
    'identity.yml': 'identity:\n  name: Test Person\n',
    'experience/a.yml': `
experience:
  - id: EXP-a
    org: Acme
    title: One
    start: "2020-01"
    atoms: [{ id: A-1, text: First thing done. }]
`,
    'experience/b.yml': `
experience:
  - id: EXP-b
    org: Beta
    title: Two
    start: "2018-01"
    atoms: [{ id: B-1, text: Second thing done. }]
`
  });
  const profile = loadProfile(dir);
  assert.equal(profile.experience.length, 2, 'splitting across files must not lose roles');
  assert.equal(allAtoms(profile).length, 2);
  cleanup(dir);
});

test('R3.2 duplicate atom ids across roles are an error', () => {
  const dir = fixture({
    'identity.yml': 'identity:\n  name: T\n',
    'a.yml': `
experience:
  - id: EXP-a
    org: A
    title: X
    start: "2020-01"
    atoms: [{ id: DUP, text: One claim. }]
  - id: EXP-b
    org: B
    title: Y
    start: "2019-01"
    atoms: [{ id: DUP, text: A different claim. }]
`
  });
  assert.ok(codes(loadProfile(dir)).includes('duplicate-id'));
  cleanup(dir);
});

test('R3.3 dangling evidence reference is an error, not a warning', () => {
  const dir = fixture({
    'identity.yml': 'identity:\n  name: T\n',
    'a.yml': `
experience:
  - id: EXP-a
    org: A
    title: X
    start: "2020-01"
    atoms: [{ id: A-1, text: A claim., evidence: [NOPE] }]
`
  });
  const found = validate(loadProfile(dir));
  const dangling = found.find((f) => f.code === 'dangling-evidence');
  assert.ok(dangling, 'must detect a reference to a nonexistent evidence id');
  assert.equal(dangling.level, 'error', 'a dangling reference must block the build');
  cleanup(dir);
});

test('R3.4 evidence used by no atom is reported', () => {
  const dir = fixture({
    ...minimal(),
    'evidence.yml': `
evidence:
  - id: EV-1
    claim: Used
    source: Real
    defensible: true
  - id: EV-ORPHAN
    claim: Proven but unclaimed
    source: Real
    defensible: true
`
  });
  assert.ok(codes(loadProfile(dir)).includes('orphan-evidence'));
  cleanup(dir);
});

test('R3.5 schema violations are reported as errors', () => {
  const dir = fixture({
    'identity.yml': 'identity:\n  nombre: Wrong Key\n'  // `name` is required
  });
  const errors = validate(loadProfile(dir)).filter((f) => f.level === 'error');
  assert.ok(errors.some((e) => e.code === 'schema'));
  cleanup(dir);
});

test('R3.6 a clean profile produces no findings at all', () => {
  const dir = fixture(minimal());
  assert.deepEqual(validate(loadProfile(dir)), []);
  cleanup(dir);
});

test('R3.7 schema loads regardless of working directory', () => {
  const dir = fixture(minimal());
  const original = process.cwd();
  process.chdir('/');
  try {
    assert.deepEqual(validate(loadProfile(dir)), [], 'validate must not depend on cwd');
  } finally {
    process.chdir(original);
    cleanup(dir);
  }
});
