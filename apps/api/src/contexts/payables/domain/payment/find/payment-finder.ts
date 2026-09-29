import { PaymentNotFoundError } from '../../errors/payables.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { PaymentId, SupplierPayment } from '../supplier-payment.entity.js';
import { SupplierPaymentRepository } from '../payment.repository.js';

export class PaymentFinder {
  constructor(private readonly payments: SupplierPaymentRepository) {}

  async find(tenantId: TenantId, id: PaymentId): Promise<SupplierPayment> {
    const payment = await this.payments.find(tenantId, id);

    if (!payment) throw new PaymentNotFoundError(id.value);

    return payment;
  }
}
