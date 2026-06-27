import type {
  AuthResponse,
  MeResponse,
  ReferralsResponse,
  TasksResponse,
  TaskCheckResponse,
  CreateOrderResponse,
  OrdersResponse,
  TransactionsResponse,
  WithdrawResponse,
  AdminStatsResponse,
  WithdrawalItem,
} from '../types';

// Базовый URL — пустая строка означает same-origin (так в проде через Traefik).
// В dev Vite-прокси перенаправляет /api → :4000.
const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

const TOKEN_KEY = 'stars_pay_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  headers.set('Accept', 'application/json');
  // FormData — браузер сам ставит multipart Content-Type с boundary
  const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  if (opts.body && !headers.has('Content-Type') && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* noop */
    }
    const err = new Error(`HTTP ${res.status}`) as Error & { status: number; body: unknown };
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json() as Promise<T>;
}

export const api = {
  authTelegram(initData: string, startParam?: string) {
    return request<AuthResponse>('/api/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ initData, startParam }),
    });
  },
  me() {
    return request<MeResponse>('/api/me');
  },
  referrals() {
    return request<ReferralsResponse>('/api/referrals');
  },
  tasks() {
    return request<TasksResponse>('/api/tasks');
  },
  checkTask(id: string) {
    return request<TaskCheckResponse>(`/api/tasks/${encodeURIComponent(id)}/check`, {
      method: 'POST',
    });
  },
  createOrder(payload: {
    kind: 'stars' | 'premium';
    recipientUsername: string;
    amount: number;
    priceUsd: number;
    receipt?: File | null;
  }) {
    if (payload.receipt) {
      const fd = new FormData();
      fd.append('kind', payload.kind);
      fd.append('recipientUsername', payload.recipientUsername);
      fd.append('amount', String(payload.amount));
      fd.append('priceUsd', String(payload.priceUsd));
      fd.append('receipt', payload.receipt);
      // Не ставим Content-Type — браузер сам поставит multipart с boundary.
      return request<CreateOrderResponse>('/api/orders', {
        method: 'POST',
        body: fd,
      });
    }
    return request<CreateOrderResponse>('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        kind: payload.kind,
        recipientUsername: payload.recipientUsername,
        amount: payload.amount,
        priceUsd: payload.priceUsd,
      }),
    });
  },
  lookupUsername(username: string) {
    return request<{
      found: boolean;
      username?: string;
      name?: string | null;
      isPremium?: boolean;
      avatarUrl?: string | null;
      raw?: unknown;
    }>(`/api/lookup?username=${encodeURIComponent(username)}`);
  },
  orders() {
    return request<OrdersResponse>('/api/orders');
  },
  transactions() {
    return request<TransactionsResponse>('/api/transactions');
  },
  withdraw(amount: number) {
    return request<WithdrawResponse>('/api/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },
  adminStats() {
    return request<AdminStatsResponse>('/api/admin/stats');
  },
  completeWithdrawal(id: string) {
    return request<{ ok: boolean; withdrawal: WithdrawalItem }>(
      `/api/admin/withdrawals/${encodeURIComponent(id)}/complete`,
      { method: 'POST' },
    );
  },
  cancelWithdrawal(id: string) {
    return request<{ ok: boolean; withdrawal: WithdrawalItem }>(
      `/api/admin/withdrawals/${encodeURIComponent(id)}/cancel`,
      { method: 'POST' },
    );
  },
};
