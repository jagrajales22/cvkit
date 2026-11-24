import { selectSections } from './select.mjs';

const esc = (s = '') => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(d) {
  if (!d) return '';
  if (d === 'present') return 'Present';
  const [y, m] = d.split('-');
  return m ? `${MONTHS[+m - 1]} ${y}` : y;
}
const range = (a, b) => `${fmtDate(a)} – ${fmtDate(b)}`;

/**
 * One template, one column, no tables, real headings — parser-safe by construction.
 * The visual polish lives in CSS, which a parser never sees, so there is no trade-off
 * between "ATS friendly" and "looks like a person made it".
 */
export function renderHTML(profile, target, selection, sections) {
  const { identity = {}, experience = [] } = profile;
  const byRole = new Map();
  for (const atom of selection.selected) {
    if (!byRole.has(atom.role)) byRole.set(atom.role, []);
    byRole.get(atom.role).push(atom);
  }

  const { headline, summary, skills, projects } = sections ?? selectSections(profile, target);

  const links = Object.values(identity.links ?? {}).map(esc).join(' &middot; ');

  const roleBlocks = experience
    .filter((r) => byRole.has(r.id))
    // Reverse-chronological by end date (current roles first), then by start.
    .sort((a, b) => {
      const end = (r) => (!r.end || r.end === 'present' ? '9999-99' : r.end);
      return end(b).localeCompare(end(a)) || String(b.start).localeCompare(String(a.start));
    })
    .map((role) => {
      const sub = (role.progression ?? [])
        .map((p) => `${esc(p.title)} (${p.org ? `${esc(p.org)}, ` : ''}${range(p.start, p.end)})`)
        .join(' &middot; ');
      return `
  <section class="role">
    <h3 class="org">${esc(role.org)}${role.org_note ? ` <span class="note">— ${esc(role.org_note)}</span>` : ''}${role.location ? ` <span class="note">&middot; ${esc(role.location)}</span>` : ''}</h3>
    ${sub ? `<p class="progression">${sub}</p>` : ''}
    <p class="title"><strong>${esc(role.title)}</strong> <span class="dates">&middot; ${range(role.start, role.end)}</span></p>
    ${role.scope ? `<p class="scope">${esc(role.scope)}</p>` : ''}
    <ul>
      ${byRole.get(role.id).map((a) => `<li${a.verified ? '' : ' class="unverified"'}>${esc(a.text)}</li>`).join('\n      ')}
    </ul>
  </section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="${esc(target.language ?? 'en')}">
<head>
<meta charset="utf-8">
<title>${esc(identity.name)} — ${esc(target.role ?? 'CV')}</title>
<style>
  :root { --ink:#1a1a1a; --muted:#4a5568; --accent:#0a2540; --rule:#c8d4df; }
  @page { size: letter; margin: 14mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Calibri","Carlito",Arial,sans-serif; color: var(--ink);
         font-size: 10.5pt; line-height: 1.42; max-width: 7.2in; margin: 0 auto; padding: 18px; }
  h1 { font-size: 21pt; color: var(--accent); margin: 0 0 2px; letter-spacing: .4px; }
  .headline { color: var(--muted); font-size: 11pt; margin: 0 0 6px; }
  .contact { font-size: 9.5pt; color: #333; margin: 0; }
  h2 { font-size: 10pt; color: var(--accent); text-transform: uppercase; letter-spacing: 1.4px;
       border-bottom: 1.5px solid var(--accent); padding-bottom: 3px; margin: 20px 0 8px; }
  h3.org { font-size: 11pt; color: var(--accent); margin: 14px 0 0; }
  .note { color: var(--muted); font-weight: 400; font-size: 9.5pt; }
  .progression { font-size: 9pt; color: var(--muted); font-style: italic; margin: 1px 0 3px; }
  .title { margin: 2px 0 2px; overflow: hidden; }
  .dates { color: var(--muted); font-size: 9.5pt; white-space: nowrap; }
  .scope { font-size: 9.5pt; color: var(--muted); margin: 0 0 4px; }
  ul { margin: 4px 0 0; padding-left: 17px; }
  li { margin-bottom: 4px; }
  li.unverified { border-left: 2px solid #c08a2e; padding-left: 7px; margin-left: -9px; }
  .skill { margin: 0 0 4px; }
  .skill b { color: var(--ink); }
  p.summary { margin: 0 0 7px; }
  .role { page-break-inside: avoid; }
  @media print { body { padding: 0; } li.unverified { border-left: none; padding-left: 0; margin-left: 0; } }
</style>
</head>
<body>

<header>
  <h1>${esc(identity.name)}</h1>
  ${headline ? `<p class="headline">${esc(headline.text)}</p>` : ''}
  <p class="contact">${[identity.location, identity.email, identity.phone].filter(Boolean).map(esc).join(' &middot; ')}</p>
  ${links ? `<p class="contact">${links}</p>` : ''}
</header>

${summary ? `<h2>Summary</h2>\n<p class="summary">${esc(summary.text)}</p>` : ''}

${skills.length ? `<h2>Core Expertise</h2>\n${skills.map((s) => `<p class="skill"><b>${esc(s.label)}:</b> ${s.items.map(esc).join(', ')}</p>`).join('\n')}` : ''}

<h2>Professional Experience</h2>
${roleBlocks}

${profile.education?.length ? `<h2>Education &amp; Certifications</h2>
${profile.education.filter((e) => e.kind === 'degree').map((e) => `<p class="skill"><b>${esc(e.credential)}</b><br>${esc(e.institution)}${e.end ? `, ${esc(e.start ?? '')}${e.start ? '–' : ''}${esc(e.end)}` : ''}</p>`).join('\n')}
<p class="skill"><b>Certifications:</b> ${profile.education.filter((e) => e.kind !== 'degree').map((e) => `${esc(e.credential)}${e.institution ? ` (${esc(e.institution)}${e.end ? `, ${esc(e.end)}` : ''})` : ''}`).join(' &middot; ')}</p>` : ''}

${projects.length ? `<h2>Selected Projects</h2>\n${projects.map((p) => `<p class="skill"><b>${esc(p.name)}:</b> ${esc(p.text)}</p>`).join('\n')}` : ''}

${profile.languages?.length || identity.work_authorization ? `<h2>Languages${identity.work_authorization ? ' &amp; Work Authorization' : ''}</h2>
${profile.languages?.length ? `<p class="skill"><b>Languages:</b> ${profile.languages.map((l) => `${esc(l.name)} (${esc(l.level)})`).join(' &middot; ')}</p>` : ''}
${identity.work_authorization ? `<p class="skill"><b>Work authorization:</b> ${Object.entries(identity.work_authorization).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(' &middot; ')}</p>` : ''}` : ''}

</body>
</html>
`;
}
