import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Build a throwaway profile directory from {relativePath: yamlString}. */
export function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'cvkit-test-'));
  for (const [path, body] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  }
  return dir;
}

export function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

/** A minimal valid profile: one role, one atom, one defensible evidence entry. */
export function minimal({ atomExtra = '', evidenceDefensible = true, atomText = 'Did a thing that worked.' } = {}) {
  return {
    'identity.yml': `
identity:
  name: Test Person
`,
    'experience.yml': `
experience:
  - id: EXP-a
    org: Acme
    title: Engineer
    start: "2020-01"
    end: present
    atoms:
      - id: A-1
        text: ${JSON.stringify(atomText)}
        tags: [alpha]
        evidence: [EV-1]
${atomExtra}
`,
    'evidence.yml': `
evidence:
  - id: EV-1
    claim: A thing
    source: Somewhere real
    defensible: ${evidenceDefensible}
`
  };
}

export const target = (over = {}) => ({
  id: 't', company: 'C', role: 'R',
  keywords: [], prefer: [], exclude: [],
  budget: {}, force_include: [], force_exclude: [],
  ...over
});
