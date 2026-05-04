# StarsPay — Telegram Mini App

Telegram WebApp для продажи Stars и Premium-подписок. Готов к деплою на сервер с Dokploy.

```
┌─────────────────────────────────────────────┐
│  Telegram WebApp (React + Vite)             │
│        │                                     │
│        ▼                                     │
│  nginx (статика + reverse proxy /api,        │
│         /avatars → api:4000)                 │
│        │                                     │
│        ▼                                     │
│  Fastify + Prisma  ──────────►  PostgreSQL   │
│  (валидация initData, JWT,                   │
│   скачивание аватарок)                       │
└─────────────────────────────────────────────┘
```

## Стек

- **Бэкенд:** Node.js 20, Fastify 4, Prisma 5, PostgreSQL 16, Zod
- **Фронтенд:** Vite 5, React 18, TypeScript 5
- **Инфра:** Multi-stage Docker, docker-compose, nginx, готовый Dokploy-проект

## Структура

```
.
├── apps/
│   ├── api/          # Fastify + Prisma (TypeScript)
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts    # POST /api/auth/telegram
│   │   │   │   ├── me.ts      # GET  /api/me
│   │   │   │   └── health.ts  # /health, /health/ready
│   │   │   ├── lib/
│   │   │   │   ├── telegram.ts  # HMAC-валидация initData
│   │   │   │   ├── avatar.ts    # скачивание аватарки + Bot API fallback
│   │   │   │   └── prisma.ts
│   │   │   ├── server.ts
│   │   │   └── index.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/      # уже сгенерированный init
│   │   └── Dockerfile
│   └── web/          # Vite + React + TypeScript
│       ├── src/
│       │   ├── App.tsx
│       │   ├── components/
│       │   ├── screens/
│       │   ├── hooks/useAuth.ts
│       │   └── lib/{api,telegram,tokens}.ts
│       ├── nginx.conf
│       └── Dockerfile
├── docker-compose.yml       # прод (для Dokploy)
├── docker-compose.dev.yml   # только postgres для локальной разработки
├── .env.example
└── README.md
```

## Что готово в MVP

| Функция | Статус |
|---|---|
| Валидация Telegram `initData` (HMAC-SHA256) | ✅ |
| Авто-создание аккаунта при первом входе | ✅ |
| Скачивание и локальное хранение аватарки | ✅ |
| Резервный путь через Bot API `getUserProfilePhotos` | ✅ |
| JWT-сессия (`Authorization: Bearer …`) | ✅ |
| Обновление профиля при последующих заходах | ✅ |
| Реф-связка через `start_param` | ✅ |
| Профиль (с аватаркой, балансом, реф-кодом) | ✅ |
| Главный экран (Stars / Premium форма) | ✅ |
| Реферальный экран (ссылка, статистика, список приглашённых) | ✅ |
| Tasks (9 заданий: канал/инст/4×stars/3×premium с авто-верификацией) | ✅ |
| Заглушка экрана Orders | ✅ |
| Миграции Prisma (применяются автоматически) | ✅ |
| Healthcheck'и контейнеров | ✅ |

Модели `Order`, `Task`, `TaskCompletion` уже описаны в `schema.prisma` и готовы к расширению — нужно только добавить роуты.

## API

```
POST /api/auth/telegram       — вход через Telegram WebApp
                                body: { initData: string, startParam?: string }
                                ↳ { token, user }

GET  /api/me                  — профиль текущего юзера
                                Authorization: Bearer <jwt>
                                ↳ { user, stats: { referrals } }

GET  /api/referrals           — реф-ссылка, счётчик и список приглашённых
                                Authorization: Bearer <jwt>
                                ↳ { code, link, count, countThisMonth,
                                    earnedStars,
                                    items: [{ id, username, firstName,
                                              lastName, avatarUrl,
                                              ordersCount, joinedAt }] }

GET  /api/tasks               — список заданий + сводка прогресса
                                Authorization: Bearer <jwt>
                                ↳ { items: [{ id, title, subtitle, reward,
                                              kind, iconKind, url, status }],
                                    summary: { completedCount, totalCount,
                                               completedReward, totalReward } }

POST /api/tasks/:id/check     — проверить выполнение и зачислить stars
                                Authorization: Bearer <jwt>
                                ↳ { ok, awarded?, starBalance?, alreadyCompleted? }
                                либо при failed verify:
                                ↳ 409 { ok: false, error: 'not_yet', reason }

GET  /avatars/:file           — статика аватарок
GET  /health, /health/ready   — для healthcheck'ов
```

## Локальная разработка

```bash
# 1. Зависимости
npm install

# 2. Запустить только PostgreSQL в Docker
docker compose -f docker-compose.dev.yml up -d

# 3. Заполнить .env (см. секцию ниже про переменные)
# Локально DATABASE_URL должен указывать на localhost:5432:
#   DATABASE_URL=postgresql://starspay:starspay@localhost:5432/starspay?schema=public

# 4. Применить миграции
npm run db:migrate

# 5. Запустить бэк и фронт (в двух терминалах)
npm run dev:api    # → http://localhost:4000
npm run dev:web    # → http://localhost:5173
```

Чтобы протестировать Telegram-авторизацию локально, нужен HTTPS-туннель (например, [ngrok](https://ngrok.com/) или Cloudflare Tunnel) на порт 5173 — Telegram открывает Mini App только по HTTPS. Затем в [@BotFather](https://t.me/BotFather) задайте Web App URL: `/setmenubutton` или `/newapp`.

## Переменные окружения

Все переменные с подробными комментариями — в `.env.example`. Минимально обязательные для прод-деплоя:

| Переменная | Что вписать |
|---|---|
| `DATABASE_URL` | Internal Connection URL из Dokploy-Postgres + `?schema=public` |
| `TELEGRAM_BOT_TOKEN` | Токен от [@BotFather](https://t.me/BotFather) |
| `JWT_SECRET` | Случайная строка ≥ 32 символов (`openssl rand -base64 48`) |
| `CORS_ORIGINS` | `https://ваш-домен.com` (или `*`, если фронт+бэк на одном домене) |
| `TELEGRAM_BOT_USERNAME` | Юзернейм бота без `@` (например `starspay_bot`) — для реф-ссылок |
| `TELEGRAM_MINIAPP_NAME` | Short-name из BotFather `/newapp` (необязательно) |

## Деплой в Dokploy

1. **Создайте бота в Telegram**
   - Откройте [@BotFather](https://t.me/BotFather) → `/newbot` → запишите токен.
   - Создайте Mini App: `/newapp` → выберите бота → задайте имя и URL (укажете после деплоя).

2. **Запушьте репозиторий** (GitHub / GitLab / Gitea).

3. **В Dokploy создайте отдельный Postgres:**
   - **Project → Create → Database → PostgreSQL**
   - Имя БД и пользователя — `starspay` (или любое), пароль сгенерируется.
   - Скопируйте *Internal Connection URL* со страницы созданной БД.

4. **В том же проекте создайте Compose-сервис:**
   - **Project → Create → Service → Compose**
   - Укажите git-репозиторий и ветку.
   - Поле "Compose Path" оставьте `docker-compose.yml` (по умолчанию).

5. **Заполните переменные окружения** Compose-сервиса в разделе *Environment*:
   ```
   DATABASE_URL=<Internal Connection URL>?schema=public
   TELEGRAM_BOT_TOKEN=…
   JWT_SECRET=…
   CORS_ORIGINS=https://ваш-домен.com
   VITE_API_BASE=
   ```

6. **Назначьте домен сервису `web`:**
   - Вкладка *Domains* у сервиса `web` → Add Domain.
   - Укажите ваш субдомен (например `app.example.com`), порт `80`, включите *HTTPS* (Dokploy сам выпишет Let's Encrypt через Traefik).

7. **Задеплойте:** кнопка *Deploy*. Dokploy:
   - склонирует репо,
   - соберёт два образа (`api`, `web`),
   - применит миграции (`prisma migrate deploy` идёт в `CMD` контейнера `api`),
   - поднимет контейнеры с healthcheck'ами,
   - подключит Traefik к сервису `web`.

8. **Скажите BotFather про URL Mini App:**
   - `/myapps` → выберите ваше → *Edit Web App URL* → `https://ваш-домен.com`.

9. Готово. Запустите бота в Telegram, нажмите кнопку Mini App — должен появиться экран с вашим именем и аватаркой.

### Что Dokploy делает за вас

- Traefik с автоматическим SSL — labels писать в compose не нужно.
- Healthcheck'и интегрированы в UI.
- Volume'ы (`db-data`, `api-avatars`) автоматически бэкапятся, если включены бэкапы.
- Авто-редеплой при пуше в нужную ветку (включается в настройках сервиса).

## Tasks — как работает верификация

Список заданий определён в коде в `apps/api/src/lib/tasks.ts` (константа `DEFAULT_TASKS`). При старте API он апсертится в таблицу `Task` — править прямо в БД не нужно.

| Задание | Награда | Как проверяется |
|---|---|---|
| Subscribe to @StarsPayChannel | 10★ | Bot API `getChatMember` — бот должен быть **админом канала** |
| Follow on Instagram | 10★ | Self-claim (публичного API подписок у Instagram нет) |
| Buy 50 / 100 / 500 / 1000 stars | 5 / 10 / 50 / 100★ | `Order.findFirst(kind='stars', amount ≥ N, status ∈ {paid, completed})` |
| Buy Premium 3 / 6 / 12 months | 50 / 100 / 200★ | `Order.findFirst(kind='premium', amount = N_months, status ∈ {paid, completed})` |

**Чтобы channel-таска работала:**
1. Откройте `@StarsPayChannel` → Manage channel → Administrators → Add Admin → ваш бот.
2. Минимально нужно право *Add Members* (или любое — для `getChatMember` достаточно админ-статуса).
3. Если бот не админ, Telegram возвращает `member list is inaccessible` — задача показывает сообщение «Channel verification unavailable».

**Чтобы добавить новое задание:** допишите объект в `DEFAULT_TASKS`, перезапустите api. Старые таски с тем же `id` обновятся, лишние — деактивируются (`active=false`). Прогресс существующих юзеров не теряется.

## Безопасность

- `initData` валидируется через HMAC-SHA256 + `WebAppData` ключ → подделать запрос невозможно (если только не утёк токен бота).
- `auth_date` проверяется по TTL (`TELEGRAM_AUTH_TTL`, по умолчанию 24 ч) — защита от replay.
- Сравнение хешей константно по времени.
- API за `trustProxy: true` — корректно читает реальный IP за Traefik.
- Rate-limit 120 req/min (Fastify-плагин).
- БД-порт **не публикуется** наружу — доступна только внутри docker-сети.
- Аватарка отдаётся через `/avatars/:file` с защитой от path-traversal.
- nginx ставит безопасные заголовки (`X-Frame-Options`, CSP, и т.д.).

## Как добавить новый эндпоинт

1. В `apps/api/src/routes/` создайте файл, опишите Fastify-плагин.
2. Подключите в `server.ts` (внутри `register('/api')`).
3. Если нужны новые поля в БД — `apps/api/prisma/schema.prisma` → `npm run db:migrate -w @stars-pay/api -- --name my_change`.
4. На фронте добавьте метод в `apps/web/src/lib/api.ts`.

## Как добавить экран

`apps/web/src/screens/MyScreen.tsx` → импортируйте в `App.tsx` → добавьте в `screens` объект.

## Лицензия

MIT.
