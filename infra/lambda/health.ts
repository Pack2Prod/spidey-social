export async function handler(
  _event: unknown
): Promise<{ statusCode: number; headers: object; body: string }> {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      timestamp: new Date().toISOString(),
      message: 'spidey-social foundation',
    }),
  };
}
