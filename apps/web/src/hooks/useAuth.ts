import { useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from '../lib/api';
import { getInitData, getStartParam, applyTelegramTheme } from '../lib/telegram';
import type { AppUser } from '../types';

export type AuthState =
  | { status: 'loading' }
  | { status: 'no-telegram' } // открыто вне Telegram
  | { status: 'error'; message: string }
  | { status: 'authed'; user: AppUser };

/**
 * Логика входа:
 * 1) При монтировании читаем initData из Telegram WebApp.
 * 2) Шлём на /api/auth/telegram → получаем JWT и юзера.
 * 3) Сохраняем токен. При следующих рендерах /api/me возвращает свежие данные.
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const login = useCallback(async () => {
    const initData = getInitData();
    if (!initData) {
      setState({ status: 'no-telegram' });
      return;
    }
    try {
      const startParam = getStartParam();
      const res = await api.authTelegram(initData, startParam);
      setToken(res.token);
      setState({ status: 'authed', user: res.user });
    } catch (err) {
      const e = err as Error & {
        status?: number;
        body?: { code?: string; message?: string; error?: string };
      };
      const code = e.body?.code;
      const detail = e.body?.message ?? e.body?.error;
      const msg = code
        ? `${code}${detail ? `: ${detail}` : ''}`
        : detail ?? e.message ?? 'auth failed';
      setState({ status: 'error', message: msg });
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) return;
    try {
      const { user } = await api.me();
      setState({ status: 'authed', user });
    } catch {
      // токен мог протухнуть — повторно логинимся через initData
      setToken(null);
      await login();
    }
  }, [login]);

  useEffect(() => {
    applyTelegramTheme();
    // если уже есть токен — сразу подтянем профиль, иначе залогинимся
    if (getToken()) {
      void refresh();
    } else {
      void login();
    }
  }, [login, refresh]);

  const logout = useCallback(() => {
    setToken(null);
    setState({ status: 'loading' });
    void login();
  }, [login]);

  return { state, refresh, logout } as const;
}
