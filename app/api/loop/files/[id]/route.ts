// ACA-TT-4.1.2: resumable upload of own-work files (PUT a chunk at the server's offset) and download by the owner only.
import { env } from '@/lib/platform-env';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { uploadChunk, readOwnFile, MAX_CHUNK_BYTES } from '@/lib/loop/files';
import { LoopError } from '@/lib/loop/core';
import { json, fail, sameOrigin, readCapped } from '@/lib/loop/http';
export const dynamic = 'force-dynamic';

async function actor() {
  if (!env.DB) throw new LoopError('The Academy is temporarily unavailable.', 503);
  const u = await getChatGPTUser();
  if (!u) throw new LoopError('Sign in to continue.', 401);
  return { db: env.DB, actor: { userId: u.userId } };
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    const { db, actor: a } = await actor();
    const offset = Number(request.headers.get('x-upload-offset'));
    if (!Number.isInteger(offset) || offset < 0) throw new LoopError('Missing upload offset.');
    const bytes = await readCapped(request, MAX_CHUNK_BYTES);
    return json(await uploadChunk(db, a, (await params).id, offset, bytes));
  } catch (e) {
    return fail(e);
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, actor: a } = await actor();
    const f = await readOwnFile(db, a, (await params).id);
    return new Response(new Uint8Array(f.data), {
      headers: {
        'Content-Type': f.mime,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return fail(e);
  }
}
