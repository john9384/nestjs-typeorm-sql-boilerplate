#!/usr/bin/env node
/*
 * Convenience wrapper to create an empty TypeORM migration by name.
 * Usage:
 *   npm run migration:create:name -- --name InitSchema
 * or
 *   npm run migration:create:name -- -n InitSchema
 *
 * It will create the file under: src/database/migrations/
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

function parseArgs(argv) {
  const args = { name: undefined };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--name' || a === '-n') {
      args.name = argv[i + 1];
      i++; // skip value
    } else if (a.startsWith('--name=')) {
      args.name = a.split('=')[1];
    } else if (a && !a.startsWith('-') && !args.name) {
      // allow positional as fallback
      args.name = a;
    }
  }
  return args;
}

(function main() {
  const { name } = parseArgs(process.argv);
  if (!name) {
    console.error('Missing migration name. Example:');
    console.error('  npm run migration:create -- src/database/migrations/InitSchema');
    console.error('  npm run migration:create:name -- --name InitSchema');
    process.exit(1);
  }

  const migrationPath = path.posix.join(
    'src',
    'database',
    'migrations',
    name
  );

  console.log(`Creating empty migration at: ${migrationPath}`);
  const result = spawnSync(
    path.join('node_modules', '.bin', 'typeorm-ts-node-commonjs'),
    ['migration:create', migrationPath],
    { stdio: 'inherit' }
  );

  process.exit(result.status === null ? 1 : result.status);
})();
