// shared/constants.ts
export const PAYMENT_STATUS = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded'
} as const;

export const TRANSACTION_TYPES = {
    PAYMENT: 'payment',
    REFUND: 'refund',
    WITHDRAWAL: 'withdrawal',
    DEPOSIT: 'deposit'
} as const;