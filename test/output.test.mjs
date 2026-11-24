/**
 * R4 — budget enforcement and R5 — rendering correctness.
 *
 * A CV that silently runs to four pages, or that breaks on an apostrophe, fails
 * at the only moment that matters: when a human opens it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProfile } from '../src/load.mjs';
import { select, keywordGaps, selectSections } from '../src/select.mjs';
import { renderHTML } from '../src/render-html.mjs';
import { fixture, cleanup, minimal, target } from './helpers.mjs';

/** n atoms in one role, all verified. */
function manyAtoms(n, roles = 1) {
  const exp = [];
  const ev = [];
  for (let r = 0; r < roles; r++) {
    const atoms = [];
    for (let i = 0; i < n; i++) {
      atoms.push(`      - { id: R${r}-${i}, text: Shipped improvement number ${i}., evidence: [EV${r}-${i}] }`);
      ev.push(`  - { id: EV${r}-${i}, claim: c, source: Real, defensible: true }`);
    }
    exp.push(`  - id: EXP-${r}\n    org: Org${r}\n    title: Role\n    start: "20${10 + r}-01"\n    atoms:\n${atoms.join('\n')}`);
  }
  return {
    'identity.yml': 'identity:\n  name: Test Person\n',
    'experience.yml': `experience:\n${exp.join('\n')}\n`,
    'evidence.yml': `evidence:\n${ev.join('\n')}\n`
  };
}

test('R4.1 atoms_total is enforced', () => {
  const dir = fixture(manyAtoms(20));
  const { selected } = select(loadProfile(dir), target({ budget: { atoms_total: 5 } }));
  assert.equal(selected.length, 5);
  cleanup(dir);
});

test('R4.2 atoms_per_role is enforced across roles', () => {
  const dir = fixture(manyAtoms(10, 3));
  const { selected } = select(loadProfile(dir), target({ budget: { atoms_per_role: 2, atoms_total: 99 } }));
  const perRole = {};
  for (const a of selected) perRole[a.role] = (perRole[a.role] ?? 0) + 1;
  for (const [role, n] of Object.entries(perRole)) {
    assert.ok(n <= 2, `${role} exceeded atoms_per_role with ${n}`);
  }
  cleanup(dir);
});

test('R4.3 pinned atoms do not silently blow the total budget', () => {
  const files = manyAtoms(10);
  files['experience.yml'] = files['experience.yml'].replace(
    /- \{ id: (R0-[0-4]), text: ([^}]+)\}/g,
    '- { id: $1, text: $2, pinned: true }'
  );
  const dir = fixture(files);
  const { selected, notes } = select(loadProfile(dir), target({ budget: { atoms_total: 2 } }));
  assert.ok(
    selected.length <= 2 || notes.some((n) => /budget/i.test(n)),
    `budget of 2 produced ${selected.length} atoms with no warning — overflow must be reported`
  );
  cleanup(dir);
});

test('R4.4 every dropped atom carries a reason', () => {
  const dir = fixture(manyAtoms(10));
  const { dropped } = select(loadProfile(dir), target({ budget: { atoms_total: 3 } }));
  assert.ok(dropped.length > 0);
  for (const d of dropped) assert.ok(d.reason, `atom ${d.id} dropped with no reason`);
  cleanup(dir);
});

test('R4.5 section budgets are reported, not silent', () => {
  const dir = fixture({
    ...minimal(),
    'projects.yml': `
projects:
  - { id: P1, name: One, text: A thing., tags: [x] }
  - { id: P2, name: Two, text: A thing., tags: [x] }
  - { id: P3, name: Three, text: A thing., tags: [x] }
  - { id: P4, name: Four, text: A thing., tags: [x] }
`
  });
  const sections = selectSections(loadProfile(dir), target({ budget: { projects: 2 } }));
  assert.equal(sections.projects.length, 2);
  assert.equal(sections.dropped.projects.length, 2, 'cut projects must be recorded');
  assert.equal(sections.dropped.projects[0].limit, 2);
  cleanup(dir);
});

test('R5.1 HTML-significant characters in content are escaped', () => {
  const dir = fixture(minimal({
    atomText: 'Cut latency <300ms & raised coverage to >80% for "p99" cases.'
  }));
  const profile = loadProfile(dir);
  const html = renderHTML(profile, target(), select(profile, target()));
  assert.doesNotMatch(html, /<300ms/, 'raw < from content leaked into markup');
  assert.match(html, /&lt;300ms/);
  assert.match(html, /&amp; raised/);
  cleanup(dir);
});

test('R5.2 an apostrophe in a name does not corrupt the page', () => {
  const dir = fixture({
    ...minimal(),
    'identity.yml': "identity:\n  name: \"Siobhán O'Brien\"\n"
  });
  const profile = loadProfile(dir);
  const html = renderHTML(profile, target(), select(profile, target()));
  assert.match(html, /O'Brien/);
  cleanup(dir);
});

test('R5.3 roles render reverse-chronologically, current first', () => {
  const dir = fixture({
    'identity.yml': 'identity:\n  name: T\n',
    'experience.yml': `
experience:
  - id: EXP-old
    org: Oldest
    title: X
    start: "2010-01"
    end: "2015-01"
    atoms: [{ id: O-1, text: An older accomplishment., evidence: [E1] }]
  - id: EXP-now
    org: Current
    title: Y
    start: "2020-01"
    end: present
    atoms: [{ id: N-1, text: A current accomplishment., evidence: [E2] }]
  - id: EXP-mid
    org: Middle
    title: Z
    start: "2016-01"
    end: "2019-12"
    atoms: [{ id: M-1, text: A middle accomplishment., evidence: [E3] }]
`,
    'evidence.yml': `
evidence:
  - { id: E1, claim: c, source: Real, defensible: true }
  - { id: E2, claim: c, source: Real, defensible: true }
  - { id: E3, claim: c, source: Real, defensible: true }
`
  });
  const profile = loadProfile(dir);
  const html = renderHTML(profile, target(), select(profile, target()));
  const order = ['Current', 'Middle', 'Oldest'].map((o) => html.indexOf(o));
  assert.ok(order[0] < order[1] && order[1] < order[2],
    `roles out of order: ${JSON.stringify(order)}`);
  cleanup(dir);
});

test('R5.4 a role whose atoms were all dropped does not render as an empty block', () => {
  const dir = fixture(minimal({ evidenceDefensible: false }));
  const profile = loadProfile(dir);
  const selection = select(profile, target(), { strict: true });
  const html = renderHTML(profile, target(), selection);
  assert.doesNotMatch(html, /Acme/, 'a role with no surviving atoms must not render');
  cleanup(dir);
});

test('R5.5 work_authorization reaches the page', () => {
  const dir = fixture({
    ...minimal(),
    'identity.yml': `
identity:
  name: Test Person
  work_authorization:
    Colombia: Citizen
`
  });
  const profile = loadProfile(dir);
  const html = renderHTML(profile, target(), select(profile, target()));
  assert.match(html, /Colombia/);
  assert.match(html, /Citizen/);
  cleanup(dir);
});

test('R5.6 keyword gaps report only terms genuinely absent', () => {
  const dir = fixture(minimal({ atomText: 'Built the evaluation harness for model output.' }));
  const profile = loadProfile(dir);
  const t = target({ keywords: ['evaluation', 'kubernetes'] });
  const gaps = keywordGaps(select(profile, t).selected, t);
  assert.deepEqual(gaps, ['kubernetes']);
  cleanup(dir);
});

test('R5.7 renders without crashing on a profile that has only identity', () => {
  const dir = fixture({ 'identity.yml': 'identity:\n  name: Sparse Person\n' });
  const profile = loadProfile(dir);
  const html = renderHTML(profile, target(), select(profile, target()));
  assert.match(html, /Sparse Person/);
  cleanup(dir);
});
