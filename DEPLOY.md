# Деплой (Vercel + PostgreSQL)

Стек: Next.js 16, Prisma, Auth.js, Liveblocks, API Gemini.

## 1. Репозиторий

```bash
git init
git add .
git commit -m "Initial commit"
```

Создайте репозиторий на GitHub/GitLab и отправьте код:

```bash
git remote add origin https://github.com/ВАШ_АККАУНТ/ai-brainstorm-canvas.git
git branch -M main
git push -u origin main
```

Убедитесь, что в репозитории есть **`package.json`**, **`prisma/schema.prisma`**, нет закоммиченных **`.env`** / **`.env.local`** (секреты только в Vercel).

## 2. База: Neon через Vercel (рекомендуется)

1. В Vercel откройте проект → **Storage** → **Create Database** → **Neon** (или вкладка Marketplace).
2. Создайте базу, затем **Connect** / **Connect Project** — привяжите к Next.js-проекту.
3. В интерфейсе Neon (как на Quickstart) откройте сниппет **`.env.local`**: там будут как минимум:
   - **`DATABASE_URL`** — обычно **pooled** (через PgBouncer), для запросов приложения;
   - **`DATABASE_URL_UNPOOLED`** — **прямое** подключение к Postgres.

В проекте Prisma настроен так: **`url`** = pooled, **`directUrl`** = unpooled (так советуют для Neon + Prisma).

4. В **Vercel → Project → Settings → Environment Variables** добавьте **обе** переменные для **Production** (значения из Neon, **Show secret** → **Copy**). Имена должны совпадать: `DATABASE_URL` и `DATABASE_URL_UNPOOLED`.

5. Один раз примените схему к облачной БД **с вашего ПК**:

```powershell
$env:DATABASE_URL="вставьте_pooled_из_Neon"
$env:DATABASE_URL_UNPOOLED="вставьте_unpooled_из_Neon"
npx prisma db push
```

Либо сохраните обе строки в файл **`.env.production.local`** (не коммитьте) и выполните:

```powershell
npx dotenv-cli -e .env.production.local -- npx prisma db push
```

(`dotenv-cli` подтянется через `npx`; при желании установите `npm i -D dotenv-cli`.)

### Локальная разработка (PostgreSQL на ПК)

В **`.env`** и **`.env.local`** задайте **`DATABASE_URL`** и **`DATABASE_URL_UNPOOLED`** одинаковыми (один и тот же URI к `localhost`) — см. **`.env.example`**.

## 3. Проект на Vercel

1. Зайдите на [vercel.com](https://vercel.com) → **Add New** → **Project** → импорт репозитория.
2. **Framework Preset:** Next.js (по умолчанию).
3. **Build Command:** `npm run build` (уже включает `prisma generate`).
4. **Install Command:** `npm install` (по умолчанию; `postinstall` выполнит `prisma generate` ещё раз — это нормально).

## 4. Переменные окружения (Settings → Environment Variables)

Добавьте для **Production** (и при необходимости Preview):

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | URI прод-Postgres (`sslmode=require`). |
| `AUTH_SECRET` | Случайная строка (PowerShell / Node см. ниже). **Обязательно для работы входа на проде.** На этапе `next build` без переменной сборка всё равно может пройти (в коде есть заглушка только для фазы build), но без `AUTH_SECRET` на **runtime** сессии не будут работать. |
| `AUTH_URL` | **Точный** URL сайта: `https://ИМЯ-ПРОЕКТА.vercel.app` (без слэша в конце). После кастомного домена — замените на `https://ваш-домен.ru`. |
| `LIVEBLOCKS_SECRET_KEY` | Секретный ключ Liveblocks (для прод лучше отдельный проект/ключ в [dashboard](https://liveblocks.io/dashboard)). |
| `GEMINI_API_KEY` | Ключ Google AI (если нужен агент на холсте). |
| `GEMINI_MODEL` | Необязательно, например `gemini-2.0-flash`. |
| `NEXT_PUBLIC_AGENT_INTERVAL_MS` | Необязательно, например `60000`. |
| `LIVEKIT_API_KEY` | Ключ API [LiveKit Cloud](https://cloud.livekit.io/) (только сервер). |
| `LIVEKIT_API_SECRET` | Секрет того же проекта (только сервер). |
| `NEXT_PUBLIC_LIVEKIT_URL` | WebSocket URL, например `wss://xxxx.livekit.cloud` (из настроек проекта). |

**Не задавайте** `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` одновременно с секретным режимом для этого приложения — у вас в коде при наличии публичного ключа идёт другой путь авторизации Liveblocks. Для прод с именами пользователей из аккаунта используйте **`LIVEBLOCKS_SECRET_KEY`** без публичного ключа на клиенте.

После сохранения переменных сделайте **Redeploy** (Deployments → ⋮ → Redeploy).

### Секрет в PowerShell (как локально)

```powershell
$b = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
[Convert]::ToBase64String($b)
```

## 5. После первого деплоя

1. Откройте **`https://ваш-проект.vercel.app`**, проверьте регистрацию/вход.
2. В **Liveblocks Dashboard** при необходимости добавьте домен продакшена в настройки, если появятся ограничения по origin (зависит от плана и документации Liveblocks).
3. Если сессия не сохраняется: проверьте, что **`AUTH_URL`** совпадает с адресом в браузере (включая `https`).

## 6. Кастомный домен

Vercel → Project → **Settings → Domains** → добавьте домен. Затем обновите **`AUTH_URL`** на `https://ваш-домен` и пересоберите/ redeploy.

## 7. Типичные ошибки

| Симптом | Что проверить |
|---------|----------------|
| Build: Prisma Client | `postinstall` / `build` содержат `prisma generate`. |
| Runtime: Prisma P1001 к БД | `DATABASE_URL` в Vercel, файрвол облака, SSL. |
| Auth.js / вход не работает | `AUTH_SECRET`, **`AUTH_URL`** = реальный URL сайта. |
| Liveblocks не коннектится | Ключи, что в прод не смешаны публичный и секретный режимы без понимания. |

## 8. Альтернатива: Docker / VPS

Сборка: `npm run build`, старт: `npm start`, переменные те же, порт обычно `3000` за reverse proxy (nginx) с HTTPS.

---

Краткий чеклист: **репозиторий → облако Postgres → `prisma db push` с прод-URL → Vercel → все env → deploy → проверка логина и холста.**
