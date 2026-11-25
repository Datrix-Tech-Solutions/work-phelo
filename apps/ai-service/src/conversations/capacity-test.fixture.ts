// Concurrent HTTP fixtures retry hard-capacity rejection with a fresh proof
// and the SAME idempotency key. Never reuse a consumed proof.
export async function afterCapacity<T extends { status: number }>(
  request: () => PromiseLike<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const response = await request();
    if (response.status !== 429 || attempt === 10) return response;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
