// ACA-US-21.3: payment confirmation from the payment provider (not chosen yet). Accepts {invoiceId, status, providerRef}
// behind a shared secret; the chosen provider's adapter must add its own signature check. No card data ever arrives here.
import { timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/platform-env';
import { confirmPayment } from '@/lib/loop/billing';
import { LoopError } from '@/lib/loop/core';
import { json, fail } from '@/lib/loop/http';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const secret = process.env.ACADEMY_PAYMENTS_SECRET ?? '',
      got = request.headers.get('x-academy-payments-secret') ?? '';
    if (
      secret.length < 32 ||
      got.length !== secret.length ||
      !timingSafeEqual(Buffer.from(got), Buffer.from(secret))
    )
      throw new LoopError('Not allowed.', 403);
    if (!env.DB) throw new LoopError('Database unavailable.', 503);
    const b = (await request.json()) as { invoiceId?: string; status?: string; providerRef?: string };
    if (b.status !== 'paid' || typeof b.invoiceId !== 'string' || typeof b.providerRef !== 'string')
      return json({ ignored: true });
    return json(await confirmPayment(env.DB, b.invoiceId, b.providerRef));
  } catch (e) {
    return fail(e);
  }
}
