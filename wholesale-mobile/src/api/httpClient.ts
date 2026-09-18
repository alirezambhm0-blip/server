// import { Platform } from 'react-native';
// import { authStorage } from '../storage/authStorage';

// // آی‌پی سیستم شما: 10.75.109.83
// const getDevBaseUrl = (): string => {
//   if (Platform.OS === 'web') {
//     return 'http://localhost:3000';
//   }
//   // برای اندروید و iOS آی‌پی کامپیوتر را می‌دهیم
//   return 'http://10.75.109.83:3000';
// };

// const BASE_URL = process.env.EXPO_PUBLIC_API_URL || getDevBaseUrl();

// /** تابع کمکی برای ساخت URL کامل از یک مسیر نسبی */
// export function buildUrl(relativeOrFull: string): string {
//   if (!relativeOrFull) return '';
//   if (relativeOrFull.startsWith('http')) return relativeOrFull;
//   const cleanPath = relativeOrFull.startsWith('/') ? relativeOrFull.slice(1) : relativeOrFull;
//   return `${BASE_URL}/${cleanPath}`;
// }

// type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// interface RequestConfig {
//   url: string;
//   method: HttpMethod;
//   body?: any;
//   headers?: Record<string, string>;
// }

// export class HttpError extends Error {
//   status: number;
//   data: any;

//   constructor(status: number, data: any, message?: string) {
//     super(message || data?.message || `HTTP Error ${status}`);
//     this.name = 'HttpError';
//     this.status = status;
//     this.data = data;
//   }
// }

// class HttpClient {
//   async request<T = any>(config: RequestConfig): Promise<{ status: number; data: T }> {
//     const token = await authStorage.getAccessToken();

//     const headers: Record<string, string> = {
//       'Content-Type': 'application/json',
//       'Accept': 'application/json',
//       ...(config.headers || {}),
//       ...(token ? { Authorization: `Bearer ${token}` } : {}),
//     };

//     const cleanPath = config.url.startsWith('/') ? config.url.slice(1) : config.url;
//     const finalUrl = `${BASE_URL}/${cleanPath}`;

//     try {
//       console.log(`[HttpClient] Requesting: ${config.method} ${finalUrl}`);

//       const res = await fetch(finalUrl, {
//         method: config.method,
//         headers,
//         body: config.body ? JSON.stringify(config.body) : undefined,
//       });

//       const contentType = res.headers.get('content-type');
//       const data = contentType?.includes('application/json')
//         ? await res.json()
//         : await res.text();

//       if (res.status === 401) {
//         console.warn('[HttpClient] 401 Unauthorized detected. Clearing auth storage...');
//         await authStorage.clearAll();
//         throw new HttpError(res.status, data, 'Unauthorized');
//       }

//       if (!res.ok) {
//         throw new HttpError(res.status, data);
//       }

//       return { status: res.status, data };
//     } catch (error) {
//       if (error instanceof HttpError) {
//         console.warn(`[HttpClient] HTTP Error ${error.status} from ${finalUrl}`, error.data);
//         throw error;
//       }
//       console.error(`[HttpClient] Failed Request to: ${finalUrl}`, error);
//       throw error;
//     }
//   }

//   get<T = any>(url: string, headers?: Record<string, string>) {
//     return this.request<T>({ url, method: 'GET', headers });
//   }

//   post<T = any>(url: string, body?: any, headers?: Record<string, string>) {
//     return this.request<T>({ url, method: 'POST', body, headers });
//   }

//   put<T = any>(url: string, body?: any, headers?: Record<string, string>) {
//     return this.request<T>({ url, method: 'PUT', body, headers });
//   }

//   patch<T = any>(url: string, body?: any, headers?: Record<string, string>) {
//     return this.request<T>({ url, method: 'PATCH', body, headers });
//   }

//   delete<T = any>(url: string, headers?: Record<string, string>) {
//     return this.request<T>({ url, method: 'DELETE', headers });
//   }

//   async uploadFile<T = any>(
//     url: string,
//     formData: FormData,
//     extraHeaders?: Record<string, string>,
//   ): Promise<{ status: number; data: T }> {
//     const token = await authStorage.getAccessToken();
//     const headers: Record<string, string> = {
//       'Accept': 'application/json',
//       ...(extraHeaders || {}),
//       ...(token ? { Authorization: `Bearer ${token}` } : {}),
//     };

//     const cleanUrl = url.startsWith('/') ? url.slice(1) : url;
//     const finalUrl = `${BASE_URL}/${cleanUrl}`;

//     try {
//       console.log(`[HttpClient] Uploading to: ${finalUrl}`);
//       const res = await fetch(finalUrl, {
//         method: 'POST',
//         headers,
//         body: formData as any,
//       });

//       const contentType = res.headers.get('content-type');
//       const data = contentType?.includes('application/json')
//         ? await res.json()
//         : await res.text();

//       if (res.status === 401) {
//         await authStorage.clearAll();
//         throw new HttpError(res.status, data, 'Unauthorized');
//       }
//       if (!res.ok) {
//         throw new HttpError(res.status, data);
//       }
//       return { status: res.status, data };
//     } catch (error) {
//       if (error instanceof HttpError) throw error;
//       console.error(`[HttpClient] Upload failed: ${finalUrl}`, error);
//       throw error;
//     }
//   }
// }

// export const httpClient = new HttpClient();

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { authStorage } from '../storage/authStorage';

/**
 * تشخیص خودکار آدرس سرور:
 * - Web → localhost:3000
 * - موبایل (Expo Go) → IP سیستمی که Metro روش اجراست (خودکار)
 * - موبایل (Production) → از env var
 * - Fallback → IP دستی
 */
const DEV_IP = '10.75.109.83';
const API_PORT = 3000;

function getBaseUrl(): string {
  // ۱) اگر env var تنظیم شده (برای production یا override دستی)
  if (process.env.EXPO_PUBLIC_API_URL && Platform.OS !== 'web') {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // ۲) روی web همیشه localhost
  if (Platform.OS === 'web') {
    return `http://localhost:${API_PORT}`;
  }

  // ۳) تشخیص خودکار IP از Expo (Expo Go / dev client)
  try {
    const hostUri =
      Constants.expoConfig?.hostUri ??
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ??
      (Constants as any).manifest?.debuggerHost;

    if (hostUri) {
      // hostUri مثل "192.168.1.100:8081" → فقط IP را می‌گیریم
      const host = hostUri.split(':')[0];
      return `http://${host}:${API_PORT}`;
    }
  } catch {}

  // ۴) fallback
  return `http://${DEV_IP}:${API_PORT}`;
}

const BASE_URL = getBaseUrl();

// لاگ برای دیباگ — هنگام اجرا ببینید از کدام آدرس استفاده می‌شود
console.log(`[HttpClient] Platform=${Platform.OS} → API: ${BASE_URL}`);

/** تابع کمکی برای ساخت URL کامل */
export function buildUrl(relativeOrFull: string): string {
  if (!relativeOrFull) return '';
  if (relativeOrFull.startsWith('http')) return relativeOrFull;
  const cleanPath = relativeOrFull.startsWith('/') ? relativeOrFull.slice(1) : relativeOrFull;
  return `${BASE_URL}/${cleanPath}`;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestConfig {
  url: string;
  method: HttpMethod;
  body?: any;
  headers?: Record<string, string>;
  params?: Record<string, any>;
}

export class HttpError extends Error {
  status: number;
  data: any;

  constructor(status: number, data: any, message?: string) {
    super(message || data?.message || `HTTP Error ${status}`);
    this.name = 'HttpError';
    this.status = status;
    this.data = data;
  }
}

class HttpClient {
  async request<T = any>(config: RequestConfig): Promise<{ status: number; data: T }> {
    const token = await authStorage.getAccessToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(config.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    let finalUrl = buildUrl(config.url);
    
    // اضافه کردن Query Parameters اگر وجود داشته باشد
    if (config.params) {
      const qs = new URLSearchParams();
      Object.entries(config.params).forEach(([k, v]) => {
        if (v !== undefined) qs.append(k, String(v));
      });
      const queryString = qs.toString();
      if (queryString) finalUrl += `?${queryString}`;
    }

    try {
      const res = await fetch(finalUrl, {
        method: config.method,
        headers,
        body: config.body ? JSON.stringify(config.body) : undefined,
      });

      const contentType = res.headers.get('content-type');
      const data = contentType?.includes('application/json')
        ? await res.json()
        : await res.text();

      if (res.status === 401) {
        await authStorage.clearAll();
        throw new HttpError(res.status, data, 'Unauthorized');
      }

      if (!res.ok) {
        throw new HttpError(res.status, data);
      }

      return { status: res.status, data };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error(`[HttpClient] Connection Failed to: ${finalUrl}`, error);
      throw error;
    }
  }

  get<T = any>(url: string, config?: Partial<RequestConfig>) {
    return this.request<T>({ url, method: 'GET', ...config });
  }

  post<T = any>(url: string, body?: any, config?: Partial<RequestConfig>) {
    return this.request<T>({ url, method: 'POST', body, ...config });
  }

  put<T = any>(url: string, body?: any, config?: Partial<RequestConfig>) {
    return this.request<T>({ url, method: 'PUT', body, ...config });
  }

  patch<T = any>(url: string, body?: any, config?: Partial<RequestConfig>) {
    return this.request<T>({ url, method: 'PATCH', body, ...config });
  }

  delete<T = any>(url: string, config?: Partial<RequestConfig>) {
    return this.request<T>({ url, method: 'DELETE', ...config });
  }

  async uploadFile<T = any>(
    url: string,
    formData: FormData,
    extraHeaders?: Record<string, string>,
  ): Promise<{ status: number; data: T }> {
    const token = await authStorage.getAccessToken();

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...(extraHeaders || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const finalUrl = buildUrl(url);

    try {
      const res = await fetch(finalUrl, {
        method: 'POST',
        headers,
        body: formData as any,
      });

      const contentType = res.headers.get('content-type');
      const data = contentType?.includes('application/json')
        ? await res.json()
        : await res.text();

      if (res.status === 401) {
        await authStorage.clearAll();
        throw new HttpError(res.status, data, 'Unauthorized');
      }
      if (!res.ok) {
        throw new HttpError(res.status, data);
      }
      return { status: res.status, data };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error(`[HttpClient] Upload failed: ${finalUrl}`, error);
      throw error;
    }
  }
}

export const httpClient = new HttpClient();
