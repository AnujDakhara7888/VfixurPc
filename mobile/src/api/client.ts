import axios, { AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { SessionTokens } from './session';

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
  // Standalone / EAS builds have no Metro host and don't see .env at build
  // time (it's gitignored on purpose) — fall back to the real live backend
  // instead of localhost, which means nothing on a phone.
  return 'https://vfixurpc-backend-160921860149.us-central1.run.app/api/v1';
}

const BASE_URL = getBaseUrl();

export const api = axios.create({ baseURL: BASE_URL, timeout: 15_000 });
export const session = new SessionTokens(SecureStore);
const expiredListeners = new Set<() => void>();
export function onSessionCleared(listener: () => void) {
  expiredListeners.add(listener);
  return () => { expiredListeners.delete(listener); };
}
let refreshFlight: { revision: number; promise: Promise<void> } | undefined;
const publicAuth = (url?: string) => /^\/auth\/(login|register)(?:\/(?:verify|resend)-otp)?$/.test(url ?? '')
  || /^\/auth\/(forgot-password|reset-password|recovery-settings)$/.test(url ?? '');

api.interceptors.request.use(async (config) => {
  if (publicAuth(config.url)) return config;
  const revision = session.revision;
  if ((config as any)._sessionRevision !== undefined && (config as any)._sessionRevision !== revision)
    throw new axios.CanceledError('Account changed');
  const token = await session.get('access_token');
  if (revision !== session.revision) throw new axios.CanceledError('Account changed');
  (config as any)._sessionRevision = revision;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => {
    if (!publicAuth(r.config.url) && (r.config as any)._sessionRevision !== session.revision)
      throw new axios.CanceledError('Account changed');
    return r;
  },
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (!original || publicAuth(original.url)) return Promise.reject(error);
    const revision = original._sessionRevision;
    if (revision !== session.revision) throw new axios.CanceledError('Account changed');
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = await session.get('refresh_token');
      if (refresh) {
        try {
          if (!refreshFlight || refreshFlight.revision !== revision) {
            const promise = axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: refresh }, { timeout: 15000 })
              .then(({data}) => session.refresh(data.accessToken, data.refreshToken, revision));
            refreshFlight = { revision, promise };
            promise.finally(() => { if (refreshFlight?.promise === promise) refreshFlight = undefined; }).catch(() => {});
          }
          await refreshFlight.promise;
          if (revision !== session.revision) throw new axios.CanceledError('Account changed');
          original.headers.Authorization = `Bearer ${await session.get('access_token')}`;
          return api(original);
        } catch (refreshError: any) {
          if (revision === session.revision && [400, 401, 403].includes(refreshError.response?.status)) await clearTokens();
        }
      }
      else if (revision === session.revision) await clearTokens();
    }
    return Promise.reject(error);
  },
);

export async function saveTokens(accessToken: string, refreshToken: string) {
  await session.replace(accessToken, refreshToken);
}

export async function clearTokens() {
  await session.clear();
  expiredListeners.forEach(listener => listener());
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
  verifyLoginOtp: (challengeId: string, code: string) =>
    api.post('/auth/login/verify-otp', { challengeId, code }).then((r) => r.data),
  resendLoginOtp: (challengeId: string) =>
    api.post('/auth/login/resend-otp', { challengeId }).then((r) => r.data),
  register: (body: { name: string; email: string; phone: string; username: string; password: string; referralUsername?: string; dateOfBirth?: string }) =>
    api.post('/auth/register', body).then((r) => r.data),
  verifyRegistrationOtp: (challengeId: string, code: string) =>
    api.post('/auth/register/verify-otp', { challengeId, code }).then((r) => r.data),
  resendRegistrationOtp: (challengeId: string) =>
    api.post('/auth/register/resend-otp', { challengeId }).then((r) => r.data),
  logout: () => api.post('/auth/logout'),
  deleteAccount: (password: string) => api.delete('/auth/account', { data: { password, confirmation: 'DELETE' } }).then(r => r.data),
  requestEmailChange: (newEmail: string, password: string) =>
    api.post('/auth/email-change/request', { newEmail, password }).then((r) => r.data),
  verifyEmailChange: (challengeId: string, code: string) =>
    api.post('/auth/email-change/verify', { challengeId, code }).then((r) => r.data),
  me: () => api.get('/users/me').then((r) => r.data),
  updateFcmToken: (fcmToken: string) => api.patch('/auth/fcm-token', { fcmToken }).then((r) => r.data),
};

function normalizeQuoteItem(item: any) {
  if (!item || typeof item !== 'object') return item;
  const description = String(item.description ?? '').trim() || String(item.itemName ?? '').trim() || 'Repair item';
  return {
    ...item,
    description,
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
  createBooking: async (body: { id: string; offerId?: string; discountCode?: string; feePolicyVersion: string; feesAccepted: boolean; requests: Record<string, any>[] }) => {
    try {
      const { data } = await api.post('/service-requests/bookings', body, { timeout: 60000 });
      return { ...data, requests: data.requests.map(normalizeSR) };
    } catch (error) {
      if (!(error instanceof AxiosError) || error.response?.status !== 404 || body.requests.length !== 1) throw error;

      const { newDevice, ...request } = body.requests[0];
      if (!request.deviceId && newDevice) {
        const { data: device } = await api.post('/devices', newDevice);
        request.deviceId = device.id;
      }
      const { data } = await api.post('/service-requests', request, { timeout: 60000 });
      const normalized = normalizeSR(data);
      return {
        booking: { id: body.id, reference: normalized.ticketNumber },
        requests: [normalized],
      };
    }
  },
  list: () => api.get('/service-requests/my').then((r) =>
    Array.isArray(r.data) ? r.data.map(normalizeSR) : r.data
  ),
  get: (id: string) => api.get(`/service-requests/${id}`).then((r) => normalizeSR(r.data)),
  create: (body: {
    deviceId?: string;
    serviceCategory?: string;
    serviceMode?: string;
    bookingAnswers?: Record<string, string | string[]>;
    termsAccepted?: boolean;
    policyVersion?: string;
    notes?: string;
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
  approveQuote: (id: string, version?: number) => api.patch(`/service-requests/${id}/approve-quote`, {version}).then((r) => normalizeSR(r.data)),
  rejectQuote: (id: string, reason: string, version: number | undefined, returnMethod: 'ORIGINAL_DELIVERY' | 'CUSTOMER_COLLECTION' | 'PAID_RETURN_DELIVERY', returnAddress?: string) =>
    api.patch(`/service-requests/${id}/reject-quote`, { reason, version, returnMethod, returnAddress }).then((r) => normalizeSR(r.data)),
};

export const devicesApi = {
  list: () => api.get('/devices').then((r) => r.data),
  create: (body: { brand: string; model: string; serialNumber?: string; condition?: string }) =>
    api.post('/devices', body).then((r) => r.data),
};

export const slotsApi = {
  list: () => api.get('/pickup-slots').then((r) => r.data),
};

export const placesApi = {
  businessProfile: () => api.get('/places/business-profile').then(r => r.data as { placeId: string; name: string; rating?: number; reviewCount?: number; writeReviewUrl: string; mapsUrl: string; reviewsNotice?: string; fetchedAt?: string; reviews: { author: string; rating: number; text: string; relativeTime?: string; authorPhoto?: string; authorUrl?: string; reviewUrl?: string }[] }),
};

export const notificationsApi = {
  list: () => api.get('/notifications').then((r) => r.data),
  unread: () => api.get('/notifications/unread-count').then(r=>r.data),
  read: (id: string) => api.patch(`/notifications/${id}/read`).then(r=>r.data),
  readAll: () => api.patch('/notifications/read-all').then(r=>r.data),
  promotionalPreference: (enabled: boolean) => api.patch('/notifications/promotional-preference', { enabled }).then(r => r.data),
  whatsappPreference: (enabled: boolean) => api.patch('/notifications/whatsapp-preference', { enabled }).then(r => r.data),
};

export const offersApi = {
  list: () => api.get('/offers').then(r => r.data),
  get: (id: string) => api.get(`/offers/${id}`).then(r => r.data),
  validateCode: (code: string, serviceCategories: string[]) => api.post('/offers/validate-code', { code, serviceCategories }).then(r => r.data),
};

export const faqApi = {
  list: () => api.get('/faq').then((r) => r.data),
  children: (id: string) => api.get(`/faq/${id}/children`).then((r) => r.data),
};
