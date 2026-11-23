# Roadmap

## v0.1 — done
Modular YAML profile, evidence ledger, schema + integrity validation, deterministic
selection with budgets, HTML renderer, keyword gap reporting, strict mode, Claude Code skill.

## v0.2 — make it usable by someone who isn't you
- `cvkit init` scaffolding a profile from an existing PDF or DOCX
- JSON Resume export (lossy — atoms flatten to bullets — but unlocks 50+ community themes)
- DOCX renderer via docx-js, for recruiters who edit the file
- A second HTML template (EU/Czech conventions: languages with CEFR, work authorisation line)
- Tests on the selection engine

## v0.3 — the part that compounds
- `cvkit log` — append an evidence entry from one command, for the monthly habit
- Evidence prompts: given the profile, generate the specific questions whose answers
  would most improve it
- Coverage report over time: verified % as a tracked metric

## Deliberately not planned
- A match score. See README.
- Auto-apply or mass-tailoring. The volume arms race is negative-sum and this tool
  should not feed it.
- A hosted SaaS. Self-hosted or local, or it isn't the product.
