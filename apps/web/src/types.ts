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
  isAdmin?: boolean;
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
export type OrderStatus =
  | 'created'
  | 'paid'
  | 'delivering'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export interface OrderItem {
  id: string;
  number: number; // целочисленный номер #120, #121, …
  kind: string;   // 'stars' | 'premium'
  recipientUsername: string;
  amount: number;
  priceUsd: string;
  status: OrderStatus;
  createdAt: string;
  paidAt: string | null;
  deliveringAt: string | null;
  deliveredAt: string | null;
}

export interface CreateOrderResponse {
  order: OrderItem;
  referralBonus: { creditedTo: string; amount: number } | null;
}

export interface OrdersResponse {
  items: OrderItem[];
}

// =====================================================
// Wallet (transactions + withdraw)
// =====================================================
export type TxType = 'task' | 'referral' | 'referral_signup' | 'withdrawal' | 'admin';

export interface TransactionItem {
  id: string;
  type: TxType;
  amount: number; // знаковая
  note: string | null;
  createdAt: string;
}

export interface TransactionsResponse {
  items: TransactionItem[];
}

export interface WithdrawResponse {
  ok: boolean;
  starBalance?: number;
  transaction?: TransactionItem;
  withdrawal?: WithdrawalItem;
  error?: string;
  min?: number;
}

export interface AdminUserBrief {
  firstName: string;
  username: string | null;
  telegramId: string;
}

export interface AdminOrderItem {
  id: string;
  number: number;
  kind: string;
  recipientUsername: string;
  amount: number;
  priceUzs: number;
  status: string;
  createdAt: string;
  user: AdminUserBrief;
}

export interface WithdrawalItem {
  id: string;
  number: number;
  amount: number;
  recipientUsername: string | null;
  recipientTelegramId: string;
  status: string;
  note: string | null;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  user?: AdminUserBrief;
}

export interface AdminStatsResponse {
  stats: {
    users: { total: number; today: number };
    orders: { total: number; today: number; active: number; completed: number; cancelled: number };
    revenue: { totalUzs: number; todayUzs: number };
    products: { starsSold: number; premiumOrders: number };
    wallet: {
      userBalanceStars: number;
      pendingWithdrawals: number;
      completedWithdrawals: number;
      pendingWithdrawalStars: number;
      completedWithdrawalStars: number;
    };
    tasks: { completions: number };
  };
  recentOrders: AdminOrderItem[];
  withdrawals: WithdrawalItem[];
  delivery: { withdrawalApiConfigured: boolean; orderApiConfigured: boolean };
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
