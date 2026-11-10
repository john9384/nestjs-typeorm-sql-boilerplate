import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { databaseOptions } from '../src/config/database-options';
import { InitialSchema1794200000000 } from '../src/database/migrations/1794200000000-InitialSchema';

/** Record ONLY the initial migration for databases that already have the original schema. */
async function baseline(): Promise<void> {
  const source = new DataSource({
    ...databaseOptions(process.env),
    migrations: [InitialSchema1794200000000],
  });
  await source.initialize();
  try {
    const runner = source.createQueryRunner();
    try {
      for (const table of ['users', 'auth_tokens']) {
        if (!(await runner.hasTable(table))) {
          throw new Error(
            `Cannot baseline: ${table} is missing. Use migration:run for a fresh database.`,
          );
        }
      }
    } finally {
      await runner.release();
    }
    await source.runMigrations({ fake: true });
    console.log(
      'Original schema baseline recorded; run npm run migration:run next.',
    );
  } finally {
    await source.destroy();
  }
}

void baseline().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
