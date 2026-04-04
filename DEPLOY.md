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

## 2. Облачная PostgreSQL

Нужна отдельная БД для **продакшена** (не `localhost`).

Подойдут, например:

- [Neon](https://neon.tech) (бесплатный tier)
- [Vercel Postgres](https://vercel.com/storage/postgres)
- Railway, Render и т.д.

Создайте базу, скопируйте **`DATABASE_URL`** (для Node обычно нужен **`?sslmode=require`** в конце URI).

Один раз примените схему **с вашего ПК** (подставьте прод-строку подключения):

```powershell
$env:DATABASE_URL="postgresql://...ваш_прод_урл..."
npx prisma db push
```

Или временно положите прод-`DATABASE_URL` в отдельный файл и: `dotenv -e .env.production.local -- npx prisma db push` (если настроите файл).

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
| `AUTH_SECRET` | Случайная строка, та же идея, что локально: PowerShell см. ниже или `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. |
| `AUTH_URL` | **Точный** URL сайта: `https://ИМЯ-ПРОЕКТА.vercel.app` (без слэша в конце). После кастомного домена — замените на `https://ваш-домен.ru`. |
| `LIVEBLOCKS_SECRET_KEY` | Секретный ключ Liveblocks (для прод лучше отдельный проект/ключ в [dashboard](https://liveblocks.io/dashboard)). |
| `GEMINI_API_KEY` | Ключ Google AI (если нужен агент на холсте). |
| `GEMINI_MODEL` | Необязательно, например `gemini-2.0-flash`. |
| `NEXT_PUBLIC_AGENT_INTERVAL_MS` | Необязательно, например `60000`. |

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
