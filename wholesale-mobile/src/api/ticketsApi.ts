import { httpClient } from './httpClient';
import { Ticket } from '@/types/ticket';

export const ticketsApi = {
  getMyTickets: () => httpClient.get<{ items: Ticket[]; total: number; page: number; pageSize: number }>('/tickets').then((r) => r.data.items),
  
  getTicketDetails: (id: string) => httpClient.get<Ticket>(`/tickets/${id}`).then((r) => r.data),
  
  createTicket: (subject: string, message: string) => 
    httpClient.post<Ticket>('/tickets', { subject, message }).then((r) => r.data),
    
  replyToTicket: (id: string, message: string) => 
    httpClient.post<Ticket>(`/tickets/${id}/reply`, { message }).then((r) => r.data),
};
