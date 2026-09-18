import { httpClient } from './httpClient';
import { Product } from '@/types/product';
import { Category } from './productsApi';

export interface SearchSuggestion {
  type: 'category' | 'product';
  id: string;
  text: string;
  image_url?: string;
  product_count?: number;
  category_name?: string;
  in_stock?: boolean;
}

export interface SearchResult {
  query: string;
  normalized_query: string;
  categories: Array<{
    id: string;
    name: string;
    image_url?: string;
    product_count: number;
  }>;
  products: {
    data: any[]; // will be mapped to Product type
    meta: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
      counts_by_filter: {
          all: number;
          active?: number;
          delivered?: number;
          cancelled?: number;
          discounted?: number;
          suggested?: number;
          new?: number;
          favorited?: number;
      }
    };
  };
  total_results: number;
  has_results: boolean;
}

export const searchApi = {
  search: (params: {
    q: string;
    category_id?: string;
    filter?: string;
    sort?: string;
    in_stock_only?: boolean;
    page?: number;
    limit?: number;
  }) => httpClient.get<SearchResult>('/search', { params }).then(r => r.data),

  getSuggestions: (q: string, limit = 8) => 
    httpClient.get<{ suggestions: SearchSuggestion[] }>('/search/suggestions', { params: { q, limit } }).then(r => r.data),

  getPopular: () => 
    httpClient.get<{ popular: Array<{ text: string, type: string }> }>('/search/popular').then(r => r.data),

  getHistory: () => 
    httpClient.get<{ history: Array<{ id: string, query: string, searched_at: string }> }>('/search/history').then(r => r.data),

  addHistory: (query: string, results_count: number) => 
    httpClient.post('/search/history', { query, results_count }).then(r => r.data),

  clearHistory: (id?: string) => {
    const url = id ? `/search/history/${id}` : '/search/history';
    return httpClient.delete(url).then(r => r.data);
  }
};
