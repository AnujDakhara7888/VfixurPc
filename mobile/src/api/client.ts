import axios, { AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

/**
 * In Expo Go on a physical device, localhost = the phone itself.
 * We derive the Mac's IP from the Expo dev-server host automatically.
 * In production builds, falls back to the hardcoded server URL.
 */
function getBaseUrl(): string {
  // Explicit override always wins (set in mobile/.env as EXPO_PUBLIC_API_URL)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Expo Go exposes the dev server host (e.g. "192.168.1.5:8081")
  const expoHost =
    Constants.expoConfig?.hostUri ??
    (Constants as any).manifest?.debuggerHost ??
    (Constants as any).manifest2?.extra?.expoClient?.hostUri;

  if (expoHost) {
    // Replace the Metro port with the NestJS port
    const ip = expoHost.split(':')[0];
    return `http://${ip}:3000/api/v1`;
  }
  // Production / fallback
  return 'http://localhost:3000/api/v1';
}

const BASE_URL = getBaseUrl();
console.log('[API] Base URL:', BASE_URL);

export const api = axios.create({ baseURL: BASE_URL, timeout: 15_000 });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = await SecureStore.getItemAsync('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: refresh });
          await SecureStore.setItemAsync('access_token', data.accessToken);
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(original);
        } catch {
          await clearTokens();
        }
      }
    }
    return Promise.reject(error);
  },
);

export async function saveTokens(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync('access_token', accessToken);
  await SecureStore.setItemAsync('refresh_token', refreshToken);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync('access_token');
  await SecureStore.deleteItemAsync('refresh_token');
}

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof AxiosError) {
    if (!error.response) return 'Cannot connect to server. Check your Wi-Fi.';
    const msg = error.response.data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
    return `Server error ${error.response.status}`;
  }
  return fallback;
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }).then((r) => r.data),
  register: (body: { name: string; email: string; phone: string; username: string; password: string }) =>
    api.post('/auth/register', body).then((r) => r.data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/users/me').then((r) => r.data),
};

function normalizeQuoteItem(item: any) {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    unitPrice:  Number(item.unitPrice  ?? 0),
    totalPrice: Number(item.totalPrice ?? item.total ?? 0),
    quantity:   Number(item.quantity   ?? 1),
  };
}

function normalizeSR(sr: any) {
  if (!sr || typeof sr !== 'object') return sr;
  const quoteItems = Array.isArray(sr.quoteItems)
    ? sr.quoteItems.map(normalizeQuoteItem)
    : [];
  const quotedTotal =
    sr.quotedTotal != null
      ? Number(sr.quotedTotal)
      : quoteItems.reduce((sum: number, qi: any) => sum + qi.totalPrice * (1 + Number(qi.taxRate ?? 18) / 100), 0);
  return {
    ...sr,
    ticketNumber: sr.ticketNumber ?? sr.serviceRequestNumber,
    quoteItems,
    quotedTotal: Number.isFinite(quotedTotal) ? quotedTotal : undefined,
    statusHistory: Array.isArray(sr.statusHistory)
      ? sr.statusHistory.map((h: any) => ({ ...h, createdAt: h.createdAt ?? h.timestamp }))
      : sr.statusHistory,
  };
}

export const srApi = {
  list: () => api.get('/service-requests/my').then((r) =>
    Array.isArray(r.data) ? r.data.map(normalizeSR) : r.data
  ),
  get: (id: string) => api.get(`/service-requests/${id}`).then((r) => normalizeSR(r.data)),
  create: (body: {
    deviceId: string;
    issues: { category: string; description?: string }[];
    pickupSlotDate: string;
    pickupSlotTime: string;
    pickupAddress: string;
    scratches?: string;
    dents?: string;
    hingeCondition?: string;
    screenCondition?: string;
    cameraWorking?: boolean;
    laptopStarting?: boolean;
  }) => api.post('/service-requests', body).then((r) => r.data),
  approveQuote: (id: string) => api.patch(`/service-requests/${id}/approve-quote`).then((r) => r.data),
  rejectQuote: (id: string, reason: string) =>
    api.patch(`/service-requests/${id}/reject-quote`, { reason }).then((r) => r.data),
};

export const devicesApi = {
  list: () => api.get('/devices').then((r) => r.data),
  create: (body: { brand: string; model: string; serialNumber?: string; condition?: string }) =>
    api.post('/devices', body).then((r) => r.data),
};

export const slotsApi = {
  list: () => api.get('/pickup-slots').then((r) => r.data),
};

export const notificationsApi = {
  list: () => api.get('/notifications').then((r) => r.data),
};
