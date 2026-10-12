// ACA-TT-4.1.2 reliable upload of own-work files on phones and slow connections; ACA-US-4.1-AC3 a work file is
// visible only to its owner unless they share it; ACA-US-18.2 confidential-file guard for public servants.
// Upload protocol (resumable): start → PUT chunks at the offset the server reports → complete when all bytes are in
// and the SHA-256 matches. A dropped connection resumes from the server's offset; nothing is lost or duplicated.
import {createHash} from 'node:crypto';
import {mkdirSync, openSync, writeSync, closeSync, readFileSync, rmSync, existsSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {type Db, type Actor, LoopError, audit, refuse, requireSelf, iso, newId, text} from './core';

export const MAX_FILE_BYTES = 15 * 1024 * 1024, MAX_CHUNK_BYTES = 512 * 1024;
export const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'text/plain': 'txt', 'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};
type FileRow = {id: string; member_id: string; task_id: string | null; name: string; mime: string; size: number; sha256: string; received: number; status: string; shared: number; no_confidential_confirmed: number};

export function filesRoot() {
  const root = process.env.ACADEMY_FILES_PATH;
  if (!root) throw new LoopError('File uploads are not set up on this server.', 503);
  return root;
}
const pathOf = (f: {member_id: string; id: string}) => join(filesRoot(), f.member_id.replace(/[^A-Za-z0-9-]/g, ''), f.id.replace(/[^A-Za-z0-9-]/g, ''));

/** ACA-US-18.2: markings that block an upload for officers. Checked against the file name and, for text files, the first bytes. */
const CONFIDENTIAL = /\b(confidential|secret|top[ -]?secret|restricted|गोपनीय|गुप्त)\b/i;

export async function startUpload(db: Db, actor: Actor, memberId: string, input: {taskId?: unknown; name?: unknown; mime?: unknown; size?: unknown; sha256?: unknown; noConfidential?: unknown}, now = Date.now()) {
  const m = await requireSelf(db, actor, memberId, 'file.start', now);
  const name = text(input.name, 'File name', 200).replace(/[\\/\u0000-\u001f]/g, '_');
  const mime = typeof input.mime === 'string' ? input.mime : '';
  if (!ALLOWED_TYPES[mime]) throw new LoopError('This file type is not accepted. Use a photo, PDF, Word, Excel, text or CSV file.', 415);
  const size = Number(input.size);
  if (!Number.isInteger(size) || size <= 0) throw new LoopError('The file is empty.');
  if (size > MAX_FILE_BYTES) throw new LoopError('The file is larger than 15 MB. Use a smaller photo or a shorter extract.', 413);
  const sha = typeof input.sha256 === 'string' && /^[a-f0-9]{64}$/.test(input.sha256) ? input.sha256 : null;
  if (!sha) throw new LoopError('The upload is missing its checksum.');
  if (m.role === 'officer') { // ACA-US-18.2
    if (CONFIDENTIAL.test(name)) { await audit(db, actor.userId, 'file.blocked_marking', {org: m.org_id, outcome: 'refused', now}); throw new LoopError('This file looks marked confidential or higher, so it cannot be uploaded. Use a redacted version with the marking removed only after the sensitive content is removed.', 422); }
    if (input.noConfidential !== true) throw new LoopError('Confirm that the file holds no confidential or classified material before you upload it.', 400);
  }
  let taskId: string | null = null;
  if (typeof input.taskId === 'string') {
    const t = await db.prepare('SELECT id FROM loop_tasks WHERE id=? AND member_id=?').bind(input.taskId, m.id).first<{id: string}>();
    if (!t) return refuse(db, actor.userId, 'file.start', m.org_id, 'You do not have access to this.', now);
    taskId = t.id;
  }
  // Same file restarted (same task, name, size and checksum): resume instead of starting again.
  const existing = await db.prepare(`SELECT * FROM loop_files WHERE member_id=? AND sha256=? AND size=? AND status='uploading' AND (task_id IS ? OR task_id=?)`).bind(m.id, sha, size, taskId, taskId).first<FileRow>();
  if (existing) return {fileId: existing.id, received: existing.received, chunk: MAX_CHUNK_BYTES};
  const id = newId('file');
  mkdirSync(join(filesRoot(), m.id.replace(/[^A-Za-z0-9-]/g, '')), {recursive: true, mode: 0o700});
  closeSync(openSync(pathOf({member_id: m.id, id}), 'w', 0o600));
  await db.prepare('INSERT INTO loop_files(id,member_id,task_id,name,mime,size,sha256,no_confidential_confirmed,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id, m.id, taskId, name, mime, size, sha, input.noConfidential === true ? 1 : 0, iso(now)).run();
  return {fileId: id, received: 0, chunk: MAX_CHUNK_BYTES};
}

async function ownFile(db: Db, actor: Actor, fileId: string, action: string, now: number) {
  const f = await db.prepare('SELECT f.*, m.user_id, m.org_id FROM loop_files f JOIN loop_members m ON m.id=f.member_id WHERE f.id=?').bind(fileId).first<FileRow & {user_id: string; org_id: string}>();
  if (!f || f.user_id !== actor.userId) return refuse(db, actor.userId, action, f?.org_id ?? null, 'You do not have access to this.', now);
  return f;
}

export async function uploadChunk(db: Db, actor: Actor, fileId: string, offset: number, bytes: Uint8Array, now = Date.now()) {
  const f = await ownFile(db, actor, fileId, 'file.chunk', now);
  if (f.status === 'complete') return {received: f.size, complete: true};
  if (offset !== f.received) return {received: f.received, complete: false, resumeAt: f.received}; // client resumes from the server's offset
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_CHUNK_BYTES || offset + bytes.byteLength > f.size) throw new LoopError('This part of the file is not the expected size.', 400);
  const fd = openSync(pathOf(f), 'r+');
  try { writeSync(fd, bytes, 0, bytes.byteLength, offset); } finally { closeSync(fd); }
  const received = offset + bytes.byteLength;
  const upd = await db.prepare('UPDATE loop_files SET received=? WHERE id=? AND received=?').bind(received, f.id, offset).run();
  if (upd.meta.changes !== 1) return {received: (await db.prepare('SELECT received FROM loop_files WHERE id=?').bind(f.id).first<{received: number}>())!.received, complete: false};
  if (received < f.size) return {received, complete: false};
  const data = readFileSync(pathOf(f));
  if (statSync(pathOf(f)).size !== f.size || createHash('sha256').update(data).digest('hex') !== f.sha256) {
    await db.prepare('UPDATE loop_files SET received=0 WHERE id=?').bind(f.id).run();
    closeSync(openSync(pathOf(f), 'w'));
    throw new LoopError('The file did not arrive intact. Please upload it again.', 422);
  }
  if (f.mime === 'text/plain' || f.mime === 'text/csv') {
    const m = await db.prepare('SELECT role, org_id FROM loop_members WHERE id=?').bind(f.member_id).first<{role: string; org_id: string}>();
    if (m?.role === 'officer' && CONFIDENTIAL.test(data.subarray(0, 4000).toString('utf8'))) {
      rmSync(pathOf(f), {force: true}); await db.prepare('DELETE FROM loop_files WHERE id=?').bind(f.id).run();
      await audit(db, actor.userId, 'file.blocked_marking', {org: m.org_id, outcome: 'refused', now});
      throw new LoopError('This file is marked confidential or higher, so it was not kept. Use a redacted version.', 422);
    }
  }
  await db.prepare(`UPDATE loop_files SET status='complete', completed_at=? WHERE id=?`).bind(iso(now), f.id).run();
  return {received, complete: true};
}

export async function uploadStatus(db: Db, actor: Actor, fileId: string, now = Date.now()) {
  const f = await ownFile(db, actor, fileId, 'file.status', now);
  return {fileId: f.id, name: f.name, size: f.size, received: f.received, complete: f.status === 'complete'};
}

/** Only the owner can read a file; others only after the owner shares it and only through the share's own flow. */
export async function readOwnFile(db: Db, actor: Actor, fileId: string, now = Date.now()) {
  const f = await ownFile(db, actor, fileId, 'file.read', now);
  if (f.status !== 'complete') throw new LoopError('This file has not finished uploading.', 409);
  return {name: f.name, mime: f.mime, data: readFileSync(pathOf(f))};
}
export async function deleteOwnFile(db: Db, actor: Actor, fileId: string, now = Date.now()) {
  const f = await ownFile(db, actor, fileId, 'file.delete', now);
  rmSync(pathOf(f), {force: true});
  await db.prepare('UPDATE loop_submissions SET file_id=NULL WHERE file_id=?').bind(f.id).run();
  await db.prepare('DELETE FROM loop_files WHERE id=?').bind(f.id).run();
}
export function removeMemberFiles(memberId: string) {
  const dir = join(filesRoot(), memberId.replace(/[^A-Za-z0-9-]/g, ''));
  if (existsSync(dir)) rmSync(dir, {recursive: true, force: true});
}
/** Text of a small text file, for the AI only when AIA-ACADEMY-01 allows it (ACA-US-4.2-AC3). */
export function textExcerpt(f: {member_id: string; id: string; mime: string}, max = 8000) {
  if (f.mime !== 'text/plain' && f.mime !== 'text/csv') return null;
  return readFileSync(pathOf(f)).subarray(0, max).toString('utf8');
}
