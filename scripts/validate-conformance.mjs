#!/usr/bin/env node
// Validates every conformance fixture against its JSON Schema (draft 2020-12, with formats).
//
// Layout: protocol/conformance/<schema>/<verdict>/<name>.json, where <schema> is the schema's
// path under protocol/schemas/ without ".schema.json".
//
//   valid/     must be accepted by the schema
//   invalid/   must be rejected by the schema
//   semantic/  must be accepted by the schema. These break a rule that JSON Schema cannot
//              express (see the schema's $comment); a conforming implementation rejects them
//              in code, so a schema-only validator is expected to accept them.
//
// Exit code 0 when every expectation holds, 1 otherwise.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PROTOCOL_SCHEMAS = join(ROOT, 'protocol', 'schemas');
const SCHEMA_DIRS = [PROTOCOL_SCHEMAS];
const CONFORMANCE = join(ROOT, 'protocol', 'conformance');
const VERDICTS = new Set(['valid', 'invalid', 'semantic']);

const toPosix = (p) => p.split(sep).join('/');
const rel = (p) => toPosix(relative(ROOT, p));

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

const ajv = new Ajv2020({
  strict: true,
  // `oneOf: [{required: [a]}, {required: [b]}]` names properties declared by the parent.
  strictRequired: false,
  allErrors: true,
});
addFormats(ajv);

const failures = [];
const fail = (message) => failures.push(message);

// 1. Load and compile every schema.
const schemaFiles = SCHEMA_DIRS.flatMap((dir) =>
  existsSync(dir) ? walk(dir).filter((f) => f.endsWith('.schema.json')) : [],
);
const validators = new Map(); // key: path under protocol/schemas without .schema.json
for (const file of schemaFiles) {
  try {
    const schema = readJson(file);
    const validate = ajv.compile(schema);
    if (file.startsWith(PROTOCOL_SCHEMAS + sep)) {
      const key = toPosix(relative(PROTOCOL_SCHEMAS, file)).replace(/\.schema\.json$/, '');
      validators.set(key, validate);
    }
  } catch (error) {
    fail(`${rel(file)}: schema does not compile: ${error.message}`);
  }
}

// 2. The schema index lists files that exist.
const indexFile = join(PROTOCOL_SCHEMAS, 'index.json');
if (existsSync(indexFile)) {
  for (const entry of readJson(indexFile).schemas ?? []) {
    if (!existsSync(join(PROTOCOL_SCHEMAS, entry.file)))
      fail(`protocol/schemas/index.json: listed file is missing: ${entry.file}`);
  }
}

// 3. Every fixture against its schema.
const counts = { valid: 0, invalid: 0, semantic: 0 };
const covered = new Set();
const fixtures = walk(CONFORMANCE).filter((f) => f.endsWith('.json'));
for (const file of fixtures) {
  const parts = toPosix(relative(CONFORMANCE, file)).split('/');
  const verdict = parts.at(-2);
  const key = parts.slice(0, -2).join('/');
  if (parts.length < 3 || !VERDICTS.has(verdict)) {
    fail(`${rel(file)}: not in <schema>/<valid|invalid|semantic>/<name>.json layout`);
    continue;
  }
  const validate = validators.get(key);
  if (!validate) {
    fail(`${rel(file)}: no schema at protocol/schemas/${key}.schema.json`);
    continue;
  }
  covered.add(key);
  counts[verdict] += 1;
  let instance;
  try {
    instance = readJson(file);
  } catch (error) {
    fail(`${rel(file)}: not valid JSON: ${error.message}`);
    continue;
  }
  const accepted = validate(instance);
  const expected = verdict !== 'invalid';
  if (accepted !== expected) {
    const detail = accepted ? 'accepted' : ajv.errorsText(validate.errors);
    fail(`${rel(file)}: expected ${expected ? 'accept' : 'reject'}, got ${detail}`);
  }
}

if (fixtures.length === 0) fail('no conformance fixtures found');

const withoutFixtures = [...validators.keys()].filter((k) => !covered.has(k)).sort();

console.log(`schemas compiled: ${schemaFiles.length}`);
console.log(
  `fixtures: ${fixtures.length} (valid ${counts.valid}, invalid ${counts.invalid}, semantic ${counts.semantic})`,
);
console.log(`schemas with fixtures: ${covered.size}`);
if (withoutFixtures.length) console.log(`schemas without fixtures: ${withoutFixtures.join(', ')}`);
if (failures.length) {
  for (const message of failures) console.error(`FAIL ${message}`);
  console.error(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log('PASS: valid/ and semantic/ fixtures accepted, invalid/ fixtures rejected');
