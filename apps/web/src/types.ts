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
  starBalance: number;
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
  bonusGiven: boolean;
  joinedAt: string;
}

export interface ReferralsResponse {
  code: string;
  link: string;
  count: number;
  countThisMonth: number;
  earnedStars: number;
  bonusPerReferral: number;
  items: ReferralItem[];
}

// Order
export interface OrderItem {
  id: string;
  kind: string;
  recipientUsername: string;
  amount: number;
  priceUsd: string;
  status: string;
  createdAt: string;
}

export interface CreateOrderResponse {
  order: OrderItem;
  referralBonus: { creditedTo: string; amount: number } | null;
}

// =====================================================
// Tasks
// =====================================================
export interface TaskItem {
  id: string;
  title: string;
  subtitle: string;
  reward: number;
  kind: string;
  iconKind: string;
  url: string | null;
  status: 'available' | 'completed';
}

export interface TasksResponse {
  items: TaskItem[];
  summary: {
    completedCount: number;
    totalCount: number;
    completedReward: number;
    totalReward: number;
  };
}

export interface TaskCheckResponse {
  ok: boolean;
  alreadyCompleted?: boolean;
  awarded?: number;
  starBalance?: number;
  error?: string;
  reason?: string;
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
        openTelegramLink?: (url: string) => void;
        openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
        HapticFeedback?: {
          impactOccurred: (s: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (t: 'error' | 'success' | 'warning') => void;
        };
      };
    };
  }
}

export {};
