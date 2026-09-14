import { PaymentNotFoundError } from '../../errors/receivables.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { CustomerPayment, PaymentId } from '../customer-payment.entity.js';
import { PaymentRepository } from '../payment.repository.js';

export class PaymentFinder {
  constructor(private readonly payments: PaymentRepository) {}

  async find(tenantId: TenantId, id: PaymentId): Promise<CustomerPayment> {
    const payment = await this.payments.find(tenantId, id);

    if (!payment) throw new PaymentNotFoundError(id.value);

    return payment;
  }
}
