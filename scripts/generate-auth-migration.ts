/**
 * Writes migrations/0001_better_auth.sql: the SQL Better Auth's own migration planner produces for the
 * auth config in src/auth/auth.ts, against an empty SQLite database (D1 is SQLite). Run when the auth
 * config's schema changes:
 *
 *   npm run auth:migration
 *
 * test/auth-migration.test.ts fails when the committed file and the config disagree.
 */
/// <reference types="node" />
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { authMigrationSql } from './auth-migration.js';

const sql = await authMigrationSql();
writeFileSync(fileURLToPath(new URL('../migrations/0001_better_auth.sql', import.meta.url).href), sql);
console.log('wrote migrations/0001_better_auth.sql');
