import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1794200000000 implements MigrationInterface {
  name = 'InitialSchema1794200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "name" varchar(255) NOT NULL,
        "email" varchar(255) NOT NULL,
        "password" varchar(255) NOT NULL,
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "auth_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "email" varchar(255) NOT NULL,
        "token" varchar(6) NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_auth_tokens" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_4da1b27c3e9959074fa2244336" ON "auth_tokens" ("email")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_0db4d75e7b32888464cdf8e374" ON "auth_tokens" ("token")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "auth_tokens"');
    await queryRunner.query('DROP TABLE "users"');
  }
}
