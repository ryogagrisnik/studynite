export async function getNextGreVerbal(opts?: { mode?: 'random'|'concept'; concept?: 'TC'|'SE'|'RC' }) {
  const p = new URLSearchParams();
  if (opts?.mode) p.set('mode', opts.mode);
  if (opts?.concept) p.set('concept', opts.concept);
  const res = await fetch(`/api/gre-verbal/next?${p.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GRE verbal fetch failed (${res.status})`);
  const data = await res.json();
  return data.question;
}
