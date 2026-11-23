---
name: tailor-cv
description: Build a tailored CV with cvkit from a job description, add new achievements as atoms, or convert notes into evidence entries. Use when the user wants to apply for a role, update their career data, or asks what's unproven in their profile.
---

# Tailoring a CV with cvkit

You are operating on a cvkit repository. Career data lives in `profile/` as YAML; each
application is a file in `targets/`; builds land in `build/`.

## The rule that governs everything

**You may write text. You may not decide what is true.**

Specifically:
- Never set `defensible: true` on an evidence entry. Only the user can, and only for a
  fact they could source under questioning. If they say "yes that's right", that is still
  not enough — ask where it is written down.
- Never invent a number, a date, a percentage, a team size, or a technology.
- Never upgrade a claim's strength. "contributed to" does not become "led".
- If an atom needs a figure the user hasn't given, write the atom with the figure as
  `TODO` and create the evidence entry with `defensible: false`. The validator will
  block the build until it's resolved — that is the system working, not a failure.

## Workflow: tailoring for a posting

1. **Read the posting.** Pull out: the terms they actually use, seniority, IC vs people
   leadership balance, and the three things the CV must prove.

2. **Write the target file**, `targets/<company>-<role>.yml`:
   - `keywords` — their vocabulary, verbatim. Not synonyms, not your paraphrase.
   - `prefer` / `exclude` — tags that exist in the profile. Check first; don't invent tags.
   - `budget` — `atoms_total` around 12–16 for two pages, `atoms_per_role` 5–7.
   - `headline` / `summary` — ids from the profile, or omit to let tag matching pick.

3. **Build twice**:
   ```bash
   node src/cli.mjs build --target targets/<file>.yml --strict
   node src/cli.mjs build --target targets/<file>.yml
   ```
   The difference between the two is the user's evidence debt made visible. Report it.

4. **Report, in this order:**
   - What the role actually wants (4 lines).
   - Which atoms were selected and the notable drops, with reasons from `plan.json`.
   - Keyword gaps — framed as *interview questions to prepare*, never as text to add.
   - Anything unverified that strict mode removed, and what evidence would restore it.

Never paste the full CV into the conversation. The user opens the HTML.

## Workflow: a new achievement

The user describes something they did. Convert it to an atom plus an evidence entry.

- Put the atom in the right role file under `profile/experience/`.
- Id convention: `<ROLE>-<short-slug>`, e.g. `NORTH-latency`.
- Tag it with tags already used in the profile where they fit.
- `weight`: 8–10 for the strongest claims, 1–3 for background.
- Create the matching evidence entry in `profile/evidence.yml` with `defensible: false`
  and a `source` naming the specific document that would prove it — "Q3 quality report",
  not "metrics".
- Then ask the one question that closes it: where is this written down?

## Workflow: evidence triage

Run `node src/cli.mjs evidence`. It ranks open items by the summed weight of the atoms
each one blocks. Walk the top item only — suggest where that figure is likely to live
(performance reviews, promotion packets, dashboards, incident records, CI history) and
what specifically to extract. Do not generate a to-do list of ten items; one closed
beats five opened.

## Workflow: a verified claim arrives

When the user supplies a real figure with a real source:
1. Update the evidence entry: fill `baseline`, `result`, `period`, `source`, set
   `recorded` to today. Leave `defensible` for them to flip, and say so plainly.
2. Rewrite the atom text with the actual number, removing the placeholder.
3. Run `check` and report the verified percentage.

## House style for atom text

`<Action verb> <what> <scope or tech>, <resulting in> <measurable outcome>.`

One line where possible, two maximum. Present tense for the current role, past for the
rest. Every atom needs a number, a scope (team size, systems, markets) or a named
technology. Avoid: "responsible for", "helped with", "successfully", "leveraged",
"spearheaded", "results-driven".

Prefer absolutes to ratios: "from three weeks to five days" beats "cut by 75%", because
a ratio invites the question an absolute already answers.

## Commands

```bash
node src/cli.mjs check                                    # validate + integrity
node src/cli.mjs evidence                                 # open items, ranked
node src/cli.mjs build --target targets/x.yml --strict    # verified claims only
```
