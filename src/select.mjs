import { allAtoms, evidenceIndex } from './load.mjs';
import { isVerified } from './validate.mjs';

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9+#. ]/g, ' ');

/**
 * Deterministic scoring. No model involved.
 *
 * The LLM's job is to write good atoms and set good tags. This function's job is to
 * apply the rules the same way every time, so a build is reproducible and reviewable.
 */
function score(atom, target) {
  let s = atom.weight ?? 1;

  const text = norm(atom.text);
  const tags = (atom.tags ?? []).map((t) => t.toLowerCase());

  for (const kw of target.keywords ?? []) {
    if (text.includes(norm(kw).trim())) s += 3;
  }
  for (const tag of target.prefer ?? []) {
    if (tags.includes(tag.toLowerCase())) s += 2;
  }
  return s;
}

/**
 * @returns {{selected: object[], dropped: object[], notes: string[]}}
 */
export function select(profile, target, { strict = false } = {}) {
  const evidence = evidenceIndex(profile);
  const budget = target.budget ?? {};
  const notes = [];
  const dropped = [];

  let pool = allAtoms(profile).map((a) => ({
    ...a,
    verified: isVerified(a, evidence),
    score: score(a, target)
  }));

  const excludeTags = (target.exclude ?? []).map((t) => t.toLowerCase());
  const forceOut = new Set(target.force_exclude ?? []);
  const forceIn = new Set(target.force_include ?? []);

  pool = pool.filter((a) => {
    // Strict is checked FIRST and outranks everything, including `pinned` and
    // `force_include`. Those say "this claim is important"; they cannot say
    // "this claim is true". A bypass here would make --strict a suggestion.
    if (strict && !a.verified) {
      dropped.push({ ...a, reason: 'not verified (strict)' });
      if (a.pinned || forceIn.has(a.id)) {
        notes.push(
          `DROPPED DESPITE ${a.pinned ? 'pinned' : 'force_include'}: ${a.id} — ` +
          `strict mode outranks it. Mark its evidence defensible, or build without --strict.`
        );
      }
      return false;
    }
    if (forceIn.has(a.id)) return true;
    if (forceOut.has(a.id)) {
      dropped.push({ ...a, reason: 'force_exclude' });
      return false;
    }
    const tags = (a.tags ?? []).concat(a.roleTags ?? []).map((t) => t.toLowerCase());
    if (excludeTags.some((t) => tags.includes(t))) {
      dropped.push({ ...a, reason: `excluded tag` });
      return false;
    }
    return true;
  });

  pool.sort((a, b) => b.score - a.score || (b.weight ?? 1) - (a.weight ?? 1));

  // Per-role cap, then global cap. Pinned atoms bypass both.
  const perRole = budget.atoms_per_role ?? Infinity;
  const counts = {};
  const kept = [];
  for (const atom of pool) {
    if (atom.pinned) { kept.push(atom); counts[atom.role] = (counts[atom.role] ?? 0) + 1; continue; }
    if ((counts[atom.role] ?? 0) >= perRole) { dropped.push({ ...atom, reason: 'per-role budget' }); continue; }
    kept.push(atom);
    counts[atom.role] = (counts[atom.role] ?? 0) + 1;
  }

  const total = budget.atoms_total ?? Infinity;
  const selected = [];
  for (const atom of kept) {
    if (!atom.pinned && selected.length >= total) { dropped.push({ ...atom, reason: 'total budget' }); continue; }
    selected.push(atom);
  }

  // Pinned atoms are allowed past the budget — that is what pinning is for — but a
  // budget quietly exceeded becomes a CV that quietly runs long. Say so.
  if (Number.isFinite(total) && selected.length > total) {
    const over = selected.length - total;
    const pinned = selected.filter((a) => a.pinned).map((a) => a.id);
    notes.push(
      `OVER BUDGET: ${selected.length} atoms against atoms_total ${total} (${over} over). ` +
      `Pinned atoms bypass the budget: ${pinned.join(', ')}. Unpin some, or raise the budget.`
    );
  }
  for (const [role, n] of Object.entries(counts)) {
    if (Number.isFinite(perRole) && n > perRole) {
      notes.push(`OVER BUDGET: ${role} has ${n} atoms against atoms_per_role ${perRole}, due to pinned atoms.`);
    }
  }

  // Restore document order within each role so the CV reads chronologically.
  const roleOrder = (profile.experience ?? []).map((r) => r.id);
  selected.sort((a, b) => {
    const ra = roleOrder.indexOf(a.role);
    const rb = roleOrder.indexOf(b.role);
    return ra - rb || b.score - a.score;
  });

  return { selected, dropped, notes };
}

/** Which of the target's keywords no selected atom covers. The gap list. */
export function keywordGaps(selected, target) {
  const blob = norm(selected.map((a) => a.text).join(' '));
  return (target.keywords ?? []).filter((kw) => !blob.includes(norm(kw).trim()));
}

export function pickTagged(items, target, limit = Infinity) {
  return rankTagged(items, target).slice(0, limit).map((x) => x.item);
}

/** Rank by how many of the target's preferred tags an item carries. Keeps the score. */
export function rankTagged(items, target) {
  const prefer = (target.prefer ?? []).map((t) => t.toLowerCase());
  return [...(items ?? [])]
    .map((item) => ({
      item,
      score: (item.tags ?? []).filter((t) => prefer.includes(t.toLowerCase())).length
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Everything outside the experience bullets: headline, summary, skills, projects.
 * Verification never applies here — these carry no evidence — so --strict does not
 * affect them. They are cut by budget alone, which is why the build has to say so.
 */
export function selectSections(profile, target) {
  const budget = target.budget ?? {};
  const limits = { skills: budget.skill_groups ?? 5, projects: budget.projects ?? 3 };

  const cut = (key, limit) => {
    const ranked = rankTagged(profile[key], target);
    return {
      kept: ranked.slice(0, limit).map((x) => x.item),
      dropped: ranked.slice(limit).map((x) => ({ id: x.item.id, score: x.score, limit }))
    };
  };

  const skills = cut('skills', limits.skills);
  const projects = cut('projects', limits.projects);

  return {
    headline: (profile.headlines ?? []).find((h) => h.id === target.headline)
      ?? pickTagged(profile.headlines, target, 1)[0],
    summary: (profile.summaries ?? []).find((s) => s.id === target.summary)
      ?? pickTagged(profile.summaries, target, 1)[0],
    skills: skills.kept,
    projects: projects.kept,
    dropped: { skills: skills.dropped, projects: projects.dropped },
    limits
  };
}
