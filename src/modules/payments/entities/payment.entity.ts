import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { UserEntity } from '../../../database/entities/user.entity';
import type { PaymentStatus } from '../payment.contract';

@Entity('payments')
@Index('UQ_payments_reference', ['reference'], { unique: true })
@Index('IDX_payments_user_created', ['userId', 'createdAt'])
@Check('CHK_payments_amount', '"amount" > 0 AND "amount" <= 9007199254740991')
@Check('CHK_payments_status', "\"status\" IN ('pending', 'success', 'failed')")
export class PaymentEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_payments_user' })
  user: UserEntity;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 100 })
  reference: string;

  @Column({ type: 'varchar', length: 50 })
  provider: string;

  // PostgreSQL bigint is returned as a string to preserve precision.
  @Column({ type: 'bigint' })
  amount: string;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: PaymentStatus;

  @Column({ type: 'text', nullable: true })
  authorizationUrl: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  accessCode: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;
}
