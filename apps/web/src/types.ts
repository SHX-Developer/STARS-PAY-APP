// Типы, которыми мы обмениваемся с бэком

export interface AppUser {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  languageCode: string | null;
  isPremium: boolean;
  avatarUrl: string | null;
  sparkleBalance: number;
  tier: string;
  referralCode: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: AppUser;
}

export interface MeResponse {
  user: AppUser;
  stats: { referrals: number };
}

export interface ReferralItem {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  avatarUrl: string | null;
  ordersCount: number;
  createdAt: string;
}

export interface ReferralsResponse {
  code: string;
  link: string;
  count: number;
  items: ReferralItem[];
}

// Telegram WebApp SDK (минимальный shape)
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            is_premium?: boolean;
            photo_url?: string;
          };
          start_param?: string;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        colorScheme: 'light' | 'dark';
        themeParams: Record<string, string>;
        viewportHeight: number;
        viewportStableHeight: number;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        HapticFeedback?: {
          impactOccurred: (s: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (t: 'error' | 'success' | 'warning') => void;
        };
      };
    };
  }
}

export {};
