export const EVENT_ORDER_CREATED = 'order.created';
export class OrderCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly orderId: string,
    public readonly orderNo: string
  ) {}
}

export const EVENT_ORDER_STATUS_CHANGED = 'order.status.changed';
export class OrderStatusChangedEvent {
  constructor(
    public readonly userId: string,
    public readonly orderId: string,
    public readonly orderNo: string,
    public readonly previousStatus: string,
    public readonly newStatus: string
  ) {}
}

export const EVENT_KYC_SUBMITTED = 'kyc.submitted';
export class KycSubmittedEvent {
  constructor(public readonly userId: string) {}
}

export const EVENT_KYC_STATUS_CHANGED = 'kyc.status.changed';
export class KycStatusChangedEvent {
  constructor(
    public readonly userId: string,
    public readonly newStatus: string,
    public readonly reason?: string
  ) {}
}
