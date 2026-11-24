# Testing

```bash
npm test
```

29 tests, no dependencies — Node's built-in runner.

## Why risk-based

cvkit makes one promise: it will not print a claim you cannot defend. Coverage
percentage is the wrong target for a tool like that. A suite that exercises every
line of the date formatter while leaving a hole in strict mode would be well
covered and worthless.

So tests are ranked by **what it costs when this fails**, and written in that order.

## The risk model

| | Risk | If it fails | Likelihood | Priority |
|---|---|---|---|---|
| **R1** | An unverified claim reaches a strict build | The tool's entire premise is false. The user believes their CV is defensible when it is not, and finds out in an interview | Medium — several code paths can bypass a filter | **Critical** |
| **R2** | A placeholder reaches the page | A CV goes out reading "reduced cost by TODO%" | Low–medium | **Critical** |
| **R3** | Data silently wrong or lost | Wrong facts on a CV are worse than missing ones: unnoticeable to the reader, indefensible by the candidate | Medium — modular merge, id collisions | **High** |
| **R4** | Budget not enforced | A CV quietly runs to four pages; content silently disappears | Medium | **High** |
| **R5** | Rendering corrupts content | Broken markup, lost characters, wrong chronology | Low–medium | **Medium** |
| **R6** | Cosmetic defects | Spacing, alignment | High | **Low** — not automated; caught by looking |

R6 is deliberately uncovered. Visual polish is cheap to inspect and expensive to
assert, and a screenshot diff would fail on every intentional change.

## Coverage

**R1 — the guarantee (7 tests)**
Unverified atoms blocked in strict mode and flagged in normal mode. Pinned atoms
and `force_include` cannot bypass strict. An atom with no evidence, or a dangling
reference, is never verified. One non-defensible entry among several poisons the
atom.

**R2 — placeholders (3 tests)**
`TODO` blocks the build; a placeholder makes an atom unverified even when its
evidence is defensible; no placeholder survives into rendered HTML.

**R3 — integrity (7 tests)**
Files merge rather than overwrite. Duplicate ids, dangling references and schema
violations are errors. Orphan evidence is reported. A clean profile produces
zero findings. Validation works from any working directory.

**R4 — budgets (5 tests)**
`atoms_total` and `atoms_per_role` enforced. Pinned overflow reported. Every drop
carries a reason. Section cuts recorded with the limit that caused them.

**R5 — rendering (7 tests)**
HTML-significant characters escaped. Apostrophes survive. Reverse-chronological
order with current roles first. Empty roles do not render. `work_authorization`
reaches the page. Keyword gaps list only genuinely absent terms. A profile with
nothing but an identity still renders.

## Defects this found

Three, all in the top two risk tiers.

**D1 — `pinned: true` bypassed strict mode.** A pinned atom backed by
non-defensible evidence reached a strict build. Pinning says *this claim is
important*; it cannot say *this claim is true*. Strict is now evaluated before
anything else and outranks both pinning and `force_include`, and reports when it
overrides them.

**D2 — `force_include` bypassed strict mode.** Same defect by a second route,
which is the argument for testing a guarantee rather than a function: one fix
without the other leaves the hole open.

**D3 — pinned atoms blew the budget silently.** Five pinned atoms against
`atoms_total: 2` produced five, with no warning. Pinned atoms still bypass the
budget — that is what pinning is for — but the overflow is now reported with the
atoms responsible.

D1 and D2 mattered most: the README promises strict mode unconditionally, and the
promise had two exits. Worth noting that a line-coverage target would likely have
been satisfied without either being found, since the bypass lived in a condition
that other tests executed happily.

## Adding tests

`test/helpers.mjs` builds throwaway profile directories from an object of
`{path: yaml}`, so a test states only what it needs. Name tests `R<tier>.<n>` and
put them in the file matching their tier.
