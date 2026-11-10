import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

/** Shared by the Nest runtime and TypeORM CLI to prevent schema/path drift. */
export function databaseOptions(env: NodeJS.ProcessEnv): DataSourceOptions {
  const mode = env.POSTGRES_SSLMODE || 'disable';
  const verify = mode === 'verify-ca' || mode === 'verify-full';
  const ssl =
    mode === 'disable'
      ? false
      : {
          rejectUnauthorized: verify
            ? env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== 'false'
            : false,
          ...(env.POSTGRES_SSL_CA ? { ca: env.POSTGRES_SSL_CA } : {}),
          ...(env.POSTGRES_SSL_CERT ? { cert: env.POSTGRES_SSL_CERT } : {}),
          ...(env.POSTGRES_SSL_KEY ? { key: env.POSTGRES_SSL_KEY } : {}),
        };
  return {
    type: 'postgres',
    host: env.POSTGRES_HOST,
    port: Number(env.POSTGRES_PORT || 5432),
    username: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    database: env.POSTGRES_DB,
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
    migrationsTableName: 'migrations',
    migrationsRun: false,
    synchronize: false,
    logging: env.NODE_ENV === 'development',
    ssl,
  };
}
