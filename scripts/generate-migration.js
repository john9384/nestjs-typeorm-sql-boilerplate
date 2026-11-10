#!/usr/bin/env node
/*
 * Convenience wrapper to generate a TypeORM migration by name.
 * Usage:
 *   npm run migration:generate:name -- --name CreateUserTable
 * or
 *   npm run migration:generate:name -- -n CreateUserTable
 *
 * It will generate file under: src/database/migrations/
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
    console.error('  npm run migration:generate -- src/database/migrations/UpdateDb');
    console.error('  npm run migration:generate:name -- --name UpdateDb');
    process.exit(1);
  }

  const migrationPath = path.posix.join(
    'src',
    'database',
    'migrations',
    name
  );

  console.log(`Generating migration at: ${migrationPath}`);
  const result = spawnSync(
    path.join('node_modules', '.bin', 'typeorm-ts-node-commonjs'),
    ['-d', 'typeorm.config.ts', 'migration:generate', migrationPath],
    { stdio: 'inherit' }
  );

  process.exit(result.status === null ? 1 : result.status);
})();
