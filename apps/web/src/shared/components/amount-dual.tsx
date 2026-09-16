import { ReactNode } from 'react';
import { formatAmount } from '@/modules/sales/domain/sales';

interface AmountDualProps {
  amount: number;
  amountVes?: number | null;
  currency?: string;
  className?: string;
  vesClassName?: string;
}

export function AmountDual({ amount, amountVes, currency = 'USD', className = '', vesClassName = 'text-xs text-muted-foreground' }: AmountDualProps) {
  return (
    <div className={`flex flex-col items-end ${className}`}>
      <span>{formatAmount(amount)} {currency}</span>
      {amountVes != null && amountVes > 0 && (
        <span className={vesClassName}>{formatAmount(amountVes)} VES</span>
      )}
    </div>
  );
}
