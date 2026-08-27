import axios, { AxiosError } from 'axios';
import Cookies from 'js-cookie';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export const api = axios.create({ baseURL: BASE_URL });

// Attach access token
api.interceptors.request.use((config) => {
  const token = Cookies.get('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, try refresh then retry once
api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = Cookies.get('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: refresh });
          Cookies.set('access_token', data.accessToken, { expires: 1 });
          original.headers = original.headers ?? {};
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(original);
        } catch {
          clearTokens();
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      } else {
        clearTokens();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);

export function saveTokens(accessToken: string, refreshToken: string) {
  Cookies.set('access_token', accessToken, { expires: 1 });
  Cookies.set('refresh_token', refreshToken, { expires: 7 });
}

export function clearTokens() {
  Cookies.remove('access_token');
  Cookies.remove('refresh_token');
}

function normalizeQuoteItem(item: any) {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    totalPrice: Number(item.totalPrice ?? item.total ?? 0),
    unitPrice: Number(item.unitPrice ?? 0),
    quantity: Number(item.quantity ?? 0),
  };
}

function normalizeServiceRequest(sr: any) {
  if (!sr || typeof sr !== 'object') return sr;
  const quoteItems = Array.isArray(sr.quoteItems)
    ? sr.quoteItems.map(normalizeQuoteItem)
    : sr.quoteItems;
  const quotedTotal = quoteItems?.reduce(
    (sum: number, item: any) => sum + item.totalPrice * (1 + Number(item.taxRate ?? 0) / 100),
    0,
  );

  return {
    ...sr,
    ticketNumber: sr.ticketNumber ?? sr.serviceRequestNumber,
    pickupDate: sr.pickupDate ?? sr.pickupSlotDate,
    pickupSlot: sr.pickupSlot ?? (sr.pickupSlotTime ? { label: sr.pickupSlotTime } : undefined),
    quoteItems,
    quotedTotal: sr.quotedTotal ?? (Number.isFinite(quotedTotal) ? quotedTotal : undefined),
    statusHistory: Array.isArray(sr.statusHistory)
      ? sr.statusHistory.map((h: any) => ({ ...h, createdAt: h.createdAt ?? h.timestamp }))
      : sr.statusHistory,
  };
}

function normalizeServiceRequestList(data: any) {
  if (Array.isArray(data)) return data.map(normalizeServiceRequest);
  if (Array.isArray(data?.data)) return { ...data, data: data.data.map(normalizeServiceRequest) };
  return data;
}

// ── Auth ─────────────────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }).then((r) => r.data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/users/me').then((r) => r.data),
};

// ── Service Requests ──────────────────────────────────────────────────
export const srApi = {
  list: (params?: { status?: string; page?: number; limit?: number; search?: string }) =>
    api.get('/service-requests', { params: { limit: 25, ...params } }).then((r) => normalizeServiceRequestList(r.data)),
  get: (id: string) => api.get(`/service-requests/${id}`).then((r) => normalizeServiceRequest(r.data)),
  updateStatus: (id: string, status: string, notes?: string) =>
    api.patch(`/service-requests/${id}/status`, { status, notes }).then((r) => normalizeServiceRequest(r.data)),
  assignTechnician: (id: string, technicianId: string | null) =>
    api.patch(`/service-requests/${id}/assign`, { technicianId }).then((r) => normalizeServiceRequest(r.data)),
  updateNotes: (id: string, notes: string) =>
    api.patch(`/service-requests/${id}/notes`, { notes }).then((r) => normalizeServiceRequest(r.data)),
};

// ── Users ─────────────────────────────────────────────────────────────
export const usersApi = {
  list: (params?: { role?: string; page?: number; limit?: number }) =>
    api.get('/users', { params: { limit: 50, ...params } }).then((r) => r.data),
  get: (id: string) => api.get(`/users/${id}`).then((r) => r.data),
  update: (id: string, body: Record<string, unknown>) =>
    api.patch(`/users/${id}`, body).then((r) => r.data),
  createStaff: (body: {
    name: string; email: string; phone: string;
    username: string; password: string; role: string;
  }) => api.post('/users', body).then((r) => r.data),
  setActive: (id: string, isActive: boolean) =>
    api.patch(`/users/${id}/active`, { isActive }).then((r) => r.data),
  remove: (id: string) => api.delete(`/users/${id}`),
};

// ── Pickup Slots ──────────────────────────────────────────────────────
export const slotsApi = {
  list: () => api.get('/admin/slots').then((r) => r.data),
  create: (body: { label: string; startTime: string; endTime: string }) =>
    api.post('/admin/slots', body).then((r) => r.data),
  update: (id: string, body: Partial<{ label: string; startTime: string; endTime: string; isActive: boolean }>) =>
    api.patch(`/admin/slots/${id}`, body).then((r) => r.data),
  delete: (id: string) => api.delete(`/admin/slots/${id}`),
  generate: () => api.post('/admin/slots/generate', {}).then((r) => r.data),
};

// ── Quotes ────────────────────────────────────────────────────────────
export interface QuoteLineInput {
  itemName?: string;
  description: string;
  hsnSac?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
}
export const quotesApi = {
  get: (srId: string) => api.get(`/service-requests/${srId}/quote`).then((r) => r.data),
  upsert: (srId: string, items: QuoteLineInput[]) =>
    api.post(`/service-requests/${srId}/quote`, { items }).then((r) => r.data),
};

// ── Invoices ──────────────────────────────────────────────────────────
export interface GenerateInvoiceInput {
  buyerName?: string; buyerCompany?: string; buyerContact?: string;
  buyerPhone?: string; buyerEmail?: string; buyerGstin?: string; buyerPan?: string;
  billingAddress?: string; shippingAddress?: string; invoiceDate?: string; dueDate?: string;
  reverseCharge?: boolean;
}
export const invoicesApi = {
  list: (params?: { page?: number; limit?: number }) =>
    api.get('/invoices', { params: { limit: 20, ...params } }).then((r) => r.data),
  listForSr: (srId: string) =>
    api.get(`/service-requests/${srId}/invoice`).then((r) => r.data),
  generate: (srId: string, body: GenerateInvoiceInput = {}) =>
    api.post(`/service-requests/${srId}/invoice/generate`, body).then((r) => r.data),
  // Fetch the PDF with auth, then open it in a new tab / trigger download.
  openPdf: async (id: string) => {
    const res = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};

// ── Admin dashboard ────────────────────────────────────────────────────
export const adminApi = {
  dashboard: () => api.get('/admin/dashboard').then((r) => r.data),
};

// ── Pickup / delivery assignments + proof photos ───────────────────────
export interface CreateAssignmentInput {
  serviceRequestId: string;
  agentId: string;
  type: 'PICKUP' | 'DELIVERY';
  scheduledDate: string;
  scheduledSlot: string;
}
export const deliveryApi = {
  listForSr: (srId: string) => api.get(`/delivery/assignments/by-sr/${srId}`).then((r) => r.data),
  create: (body: CreateAssignmentInput) => api.post('/delivery/assignments', body).then((r) => r.data),
  myTasks: () => api.get('/delivery/assignments/my-tasks').then((r) => r.data),
  myHistory: () => api.get('/delivery/assignments/my-history').then((r) => r.data),
  photos: (id: string) => api.get(`/delivery/assignments/${id}/photos`).then((r) => r.data),
  complete: (id: string) => api.patch(`/delivery/assignments/${id}/complete`).then((r) => r.data),
  uploadPhoto: (id: string, file: File, type: 'PICKUP' | 'WAREHOUSE' | 'DELIVERY') => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/delivery/assignments/${id}/photos?type=${type}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
  // Fetch a proof image with auth and return an object URL for <img src>.
  photoObjectUrl: async (photoId: string) => {
    const res = await api.get(`/delivery/photos/${photoId}/file`, { responseType: 'blob' });
    return URL.createObjectURL(res.data as Blob);
  },
};
