#!/usr/bin/env node
/**
 * Generates packages/types/src/api.generated.ts from docs/05-api/openapi.yaml.
 *
 * openapi.yaml is the machine source of truth for API shapes
 * (docs/05-api/api-contract.md). Types for API payloads are GENERATED, never
 * hand-written (docs/08-engineering/coding-standards.md — TypeScript).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(root, 'docs/05-api/openapi.yaml');
const OUT = resolve(root, 'packages/types/src/api.generated.ts');

const ast = await openapiTS(readFileSync(SOURCE, 'utf8'), {
  alphabetize: false,
  emptyObjectsUnknown: true,
});

const banner = `/* eslint-disable */
// ---------------------------------------------------------------------------
// GENERATED FILE — DO NOT EDIT.
//
// Source:     docs/05-api/openapi.yaml
// Regenerate: npm run generate:api-types
// ---------------------------------------------------------------------------

`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, banner + astToString(ast), 'utf8');
console.log(`generate-api-types: wrote ${OUT}`);
