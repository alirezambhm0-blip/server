export type TicketStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';
export type SenderType = 'CUSTOMER' | 'ADMIN';

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderType: SenderType;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  customerId: string;
  subject: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
  messages?: TicketMessage[];
}
