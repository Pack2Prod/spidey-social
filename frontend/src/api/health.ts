/**
 * Health check helper. Fetches /health from the given base URL.
 * Not wired into UI yet (setup only).
 */
export async function checkHealth(baseUrl: string): Promise<{ ok: boolean }> {
  const url = `${baseUrl.replace(/\/$/, '')}/health`;
  const res = await fetch(url);
  const data = (await res.json()) as { ok?: boolean };
  return { ok: data.ok === true };
}
