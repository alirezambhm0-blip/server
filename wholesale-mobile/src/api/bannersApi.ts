import { httpClient } from './httpClient';

export interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  sortOrder: number;
}

export const bannersApi = {
  list: () => httpClient.get<Banner[]>('/banners').then((r) => {
      // Backend returns an array directly from the public endpoint
      const data = r.data as any;
      return Array.isArray(data) ? data : (data.items || []);
  }),
};
