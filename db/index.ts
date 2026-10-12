import { env } from '@/lib/platform-env';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getDb() {
  if (!env.DB) {
    throw new Error('The Academy database is unavailable. Set ACADEMY_DATABASE_PATH.');
  }

  return drizzle(env.DB, { schema });
}
