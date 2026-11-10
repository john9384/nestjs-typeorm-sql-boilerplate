import { MigrationInterface, QueryRunner } from 'typeorm';

/** Existing applications must already have the users table before this migration. */
export class CreateNotificationsAndPayments1794300000000 implements MigrationInterface {
  name = 'CreateNotificationsAndPayments1794300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "title" varchar(255) NOT NULL,
        "body" text NOT NULL,
        "data" jsonb,
        "readAt" timestamptz,
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_notifications_user_created" ON "notifications" ("userId", "createdAt")',
    );
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "email" varchar(255) NOT NULL,
        "reference" varchar(100) NOT NULL,
        "provider" varchar(50) NOT NULL,
        "amount" bigint NOT NULL,
        "currency" varchar(3) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "authorizationUrl" text,
        "accessCode" varchar(255),
        "metadata" jsonb,
        "paidAt" timestamptz,
        CONSTRAINT "PK_payments" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_payments_amount" CHECK ("amount" > 0 AND "amount" <= 9007199254740991),
        CONSTRAINT "CHK_payments_status" CHECK ("status" IN ('pending', 'success', 'failed')),
        CONSTRAINT "FK_payments_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_payments_reference" ON "payments" ("reference")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_payments_user_created" ON "payments" ("userId", "createdAt")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "payments"');
    await queryRunner.query('DROP TABLE "notifications"');
  }
}
