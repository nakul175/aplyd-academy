// Runtime environment for the Node production setup (ADR-0001, Option A). Replaces `cloudflare:workers`.
// env.DB is a D1-compatible database over SQLite, so the v0.17 SQL runs unchanged.
// Server-only: imported by API routes and server helpers, never by client components.
import { openDatabase, type D1Like } from './sqlite-d1';

type PlatformEnv = { DB: D1Like | undefined };

declare global {
  var __academyDb: D1Like | undefined;
}

function database(): D1Like | undefined {
  const file = process.env.ACADEMY_DATABASE_PATH;
  if (!file) return undefined; // Routes already answer 503 when the database is unavailable.
  globalThis.__academyDb ??= openDatabase(file);
  return globalThis.__academyDb;
}

export const env: PlatformEnv = {
  get DB() {
    return database();
  },
};
