# cvkit

**A CV generator that refuses to print claims you can't defend.**

Every other resume tool either renders exactly what you type, or lets an AI write whatever sounds impressive. Neither checks anything. cvkit sits in between: your career data is modular and version-controlled, every bullet carries a reference to evidence, and `--strict` builds drop any claim whose evidence you have not marked defensible.

The division of labour is deliberate:

| Layer | Who does it | Why |
|---|---|---|
| Writing bullets, setting tags, judging tone | You, with an LLM | Judgment, language, nuance |
| Scoring, selecting, budgeting, enforcing | cvkit, deterministically | Reproducible, reviewable, no hallucination |

An LLM is very good at phrasing an achievement and very bad at knowing whether it happened. So it never decides what goes on the page.

## Quick start

```bash
npm install

# See it work on the bundled example profile
node src/cli.mjs check    --profile profile.example
node src/cli.mjs evidence --profile profile.example
node src/cli.mjs build    --profile profile.example --target targets/example-ml-infra.yml --strict

# Then make it yours
cp -r profile.example profile
$EDITOR profile/identity.yml
node src/cli.mjs check
```

`profile/` is gitignored, as is everything in `targets/` except the examples. Your career
data and the companies you're applying to stay on your machine — fork this repo publicly
without publishing either.

Output lands in `build/`: an HTML CV (print to PDF from any browser) and a `.plan.json` recording exactly which atoms were selected, which were dropped and why, and which of the target's keywords nothing covers.

## The data model

Four concepts, and the third is the one that doesn't exist anywhere else.

**Profile** — split across as many YAML files under `profile/` as you like. Arrays concatenate on load, so one file per employer under `profile/experience/` merges into a single list. Add a file, it's in. This is what "modular" means here: no monolith, no database.

**Atom** — one atomic, selectable claim. Not a resume bullet: a *fact with an id*. Atoms carry tags, a weight, and evidence references.

```yaml
- id: NORTH-latency
  text: Cut p99 inference latency from 840ms to 310ms by reworking the batching layer.
  tags: [ai, metric, performance]
  evidence: [EV-latency]
  weight: 9
```

**Evidence** — the ledger. An atom may only claim what an entry here supports.

```yaml
- id: EV-latency
  claim: p99 inference latency reduced 840ms to 310ms
  baseline: "840ms p99"
  result: "310ms p99"
  period: "Q2 2025"
  source: "Grafana dashboard snapshot; perf review doc"
  defensible: true
```

`defensible` is a promise to yourself, and `source: memory` is not a source. An atom is **verified** if and only if every evidence entry behind it is defensible and its text contains no placeholders. Verification is computed at build time, never declared — you cannot mark your own homework.

**Target** — one file per application. Keywords from the posting, tags to prefer or exclude, and hard budgets the renderer enforces.

```yaml
target:
  id: example-ml-infra
  keywords: [evaluation, benchmark, inference, latency, Python]
  prefer: [ai, eval, metric, async]
  exclude: [earlier]
  budget: { atoms_total: 10, atoms_per_role: 6, pages: 2 }
```

## What the commands do

### `check`
Schema validation, then integrity: duplicate ids, unfilled placeholders (`TODO`, `X%`, `<fill>`), atoms referencing evidence that doesn't exist, atoms backed by evidence you marked not defensible, and orphan evidence — a proven fact with no bullet, which usually means a bullet is missing.

### `evidence`
Your open items, ranked by **what they cost you** — the summed weight of the atoms each one blocks. This answers "which number should I go find first" with arithmetic rather than a guess.

```
EV-cost (blocks 1 atom(s), weight 6)
  claim:  Cloud spend reduction from rightsizing
  need:   TODO — monthly spend before → TODO — monthly spend after
  source: TODO — billing export, not yet pulled
```

### `build --target <file> [--strict]`
Scores every atom against the target, applies per-role and total budgets, renders, and reports keyword gaps. In `--strict` mode, unverified atoms never reach the page.

On the example profile the difference is one atom:

```
normal:  8 atoms selected, 2 dropped — 1 not verified: NORTH-costsave
strict:  7 atoms selected, 3 dropped
```

That gap is your evidence debt, made visible.

The build **refuses outright** on any error-level finding. A CV with a `TODO` in it is a worse outcome than no CV.

## Keyword gaps are not a to-do list

The build prints what the posting asks for and your selected atoms don't cover. That list is **interview preparation, not text to paste in**. Keyword stuffing fails at the step that actually decides the outcome — the human read — and recruiters spot a keyword wall instantly.

The same goes for the absent feature everyone expects: there is no match score. Those numbers are third-party estimates of word overlap, no employer ever sees them, and none of them confirms your document even parsed. cvkit will not invent one.

## Design decisions

**The generated CV is one column, no tables, real headings.** Parser-safe by construction. The polish lives in CSS, which a parser never reads, so there is no trade-off between "ATS friendly" and "looks like a person made it".

**HTML as the render target.** Browsers already produce excellent PDFs and every machine has one. DOCX and Typst renderers are planned; the renderer interface takes `(profile, target, selection)` and returns a string, so adding one is a single file.

**Git is the version history.** No "save as v3_final_FINAL.pdf". Your career data is a repo; a tailored CV is a build artifact.

**The example profile is fictional.** `profile.example/` is an invented person, so the repo demos end to end without anyone publishing their own history. Ada Okonkwo does not exist.

**Your data never leaves your machine.** No account, no upload, no telemetry.

## With Claude Code

`skills/tailor-cv/SKILL.md` makes an agent a first-class user: it drafts target files from a pasted job description, proposes new atoms when you describe a win, and converts your notes into evidence entries. It cannot mark anything defensible — that's yours.

## Status

v0.1. Working end to end: load, validate, select, render, report. Roadmap in `ROADMAP.md`.

## Licence

MIT.
