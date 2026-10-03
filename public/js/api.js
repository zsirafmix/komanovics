// Ranglista API kliens. Hálózati hiba esetén érthető magyar hibaüzenetet dob.
export async function fetchScores() {
  const r = await fetch('/api/scores', { cache: 'no-store' });
  if (!r.ok) throw new Error('A ranglista most nem érhető el.');
  return r.json();
}

export async function submitScore({ name, score, level, durationSec }) {
  let r;
  try {
    r = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, score, level, durationSec }),
    });
  } catch {
    throw new Error('Nincs kapcsolat a szerverrel.');
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Hiba (${r.status})`);
  return j;
}
