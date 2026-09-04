#!/usr/bin/env node
/**
 * Create and migrate the integration-test database.
 *
 * Integration tests write real rows and — in the worker's case — CLAIM QUEUED
 * JOBS. Claiming is global by design, so sharing a database with development
 * means a test and a running worker can race for the same job. The loser
 * processes it against the wrong storage root and fails it, which is exactly
 * the intermittent `unsupported_image_undecodable` that went unexplained twice
 * before this existed.
 *
 * Idempotent, and quiet when there is nothing to do.
 */
import { execFileSync } from 'node:child_process';

const url = process.env.TEST_DATABASE_URL ?? 'postgresql://mira:mira@localhost:5433/mira_test';
const name = new URL(url).pathname.slice(1);
const adminUrl = new URL(url);
adminUrl.pathname = '/postgres';

function psql(connection, sql) {
  return execFileSync('psql', [connection, '-tAc', sql], { encoding: 'utf8' }).trim();
}

try {
  const exists = psql(adminUrl.toString(), `select 1 from pg_database where datname = '${name}'`);
  if (!exists) {
    psql(adminUrl.toString(), `create database ${name}`);
    console.log(`created ${name}`);
  }
} catch (error) {
  // No database is a skip, not a failure: the suites report themselves as
  // skipped rather than red, and unit tests still run.
  console.warn(`could not prepare ${name}: ${error.message.split('\n')[0]}`);
  process.exit(0);
}

try {
  execFileSync('npm', ['run', 'db:migrate'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
} catch {
  console.warn('could not migrate the test database');
}
