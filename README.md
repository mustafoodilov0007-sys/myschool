# Physics Exam Pro

Fizika fanidan haftalik nazorat imtihonlari uchun: **Telegram bot + Telegram Mini App (o'quvchi) + admin web-panel (o'qituvchi) + API + PostgreSQL**.

> **Joriy holat: 1-bosqich** (asosiy tizim). Savollar banki, imtihonlar, monitoring, hisobotlar — 2–4-bosqichlarda.
> Nima tayyor, nima tekshirilgan va nima hali yo'q: [`docs/STAGE1_STATUS.md`](docs/STAGE1_STATUS.md). Arxitektura va xavfsizlik qarorlari: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 1-bosqichda nima bor

- **Bot**: `/start` (sinf tanlash → ID kiritish → ism ko'rsatish → tasdiqlash), `/menu`, `/exam`, `/results`, `/profile`, `/help`, `/admin`.
- **ID himoyasi**: ketma-ket 5 xato → 10 daqiqa blok (bazada, bot qayta ishga tushsa ham saqlanadi); bir ID — bir akkaunt, bir akkaunt — bir ID (DB UNIQUE); tasdiqlash tugmasi takroran bosilsa ham bir marta ishlaydi.
- **Mini App**: Telegram `initData` serverda rasmiy algoritm bilan tekshiriladi; bosh sahifa, imtihon/natijalar (bo'sh holatlar), profil; yorug'/qorong'i mavzu.
- **Admin panel**: `/admin` buyrug'i bergan bir martalik havola orqali kirish; sinflar, o'quvchilar (qo'shish, ro'yxatdan ommaviy qo'shish + preview, faolsizlantirish, Telegram bog'lanishini uzish, yangi ID berish, ID lar CSV), harakatlar tarixi (audit).
- **Baza**: versiyalangan SQL migratsiyalar; imtihon/savol/urinish jadvallari ham tayyor (2-bosqich uchun), cheklovlar real PostgreSQL'da sinalgan.

## Talablar (Windows 11)

PowerShell'da (bir marta):

```powershell
winget install OpenJS.NodeJS.LTS          # Node 22 LTS
winget install Docker.DockerDesktop       # PostgreSQL uchun (yoki o'zingizning PostgreSQL 16 ingiz)
winget install Git.Git
```

Keyin PowerShell/Docker Desktop'ni qayta ishga tushiring. `node -v` (>= 20.11) va `docker --version` tekshiring.

## Lokal ishga tushirish

```powershell
cd physics-exam-pro
copy .env.example .env
notepad .env
```

`.env` da to'ldiring:

| O'zgaruvchi | Qanday olinadi |
|---|---|
| `BOT_TOKEN` | Telegramda **@BotFather** → `/newbot` |
| `ADMIN_TELEGRAM_IDS` | Telegram ID ingiz (raqam): **@userinfobot** ga `/start` yuboring. Admin huquqining yagona manbai shu |
| `INTERNAL_API_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `POSTGRES_PASSWORD` va `DATABASE_URL` dagi parol | O'zingiz o'ylab toping; ikkalasida **bir xil** bo'lsin |
| `ALLOW_DEV_AUTH=true`, `DEV_STUDENT_TELEGRAM_ID` | Faqat lokal sinov uchun (pastga qarang) |

```powershell
npm install                       # birinchi marta; package-lock.json ni git'ga qo'shing
docker compose up -d db           # PostgreSQL
npm run db:migrate                # migratsiyalar
npm run db:seed                   # (ixtiyoriy) namunaviy sinf va 3 o'quvchi; ID lar ekranga chiqadi
```

To'rtta alohida terminalda:

```powershell
npm run dev:api        # http://localhost:3000   (tekshiruv: /healthz)
npm run dev:bot        # polling rejimida
npm run dev:admin      # http://localhost:5174
npm run dev:student    # http://localhost:5173
```

### Birinchi kirish (admin)

1. Botga `/admin` yuboring → bot havola beradi.
2. Havolani shu kompyuter brauzerida oching → admin panel.
3. Bot ishlamasa/Telegram'siz sinash: `.env` da `ALLOW_DEV_AUTH=true` bo'lsa, kirish sahifasida "DEV kirish" chiqadi.

### Mini Appni Telegramsiz sinash (faqat lokal)

`.env`: `ALLOW_DEV_AUTH=true`, `DEV_STUDENT_TELEGRAM_ID=<istalgan raqam>`. Shu `telegram_id` ga bog'langan o'quvchi kerak: botda `/start` orqali ro'yxatdan o'ting (ID ni admin paneldan oling), so'ng `DEV_STUDENT_TELEGRAM_ID` ni o'z Telegram ID ingizga qo'ying. Brauzerda http://localhost:5173 oching. **Production'da `ALLOW_DEV_AUTH=true` bo'lsa server ishga tushmaydi.**

### Mini Appni Telegram ichida sinash

Telegram Mini App uchun **HTTPS** majburiy. Lokal uchun tunnel (masalan `cloudflared tunnel --url http://localhost:5173`) ishlating, olingan `https://...` manzilni `STUDENT_APP_URL` ga yozing va `CORS_ORIGINS` ga qo'shing; Vite `server.allowedHosts` ga tunnel domenini qo'shish kerak bo'lishi mumkin. Keyin botni qayta ishga tushiring — u menyu tugmasini o'zi o'rnatadi.

## Testlar

```powershell
npm test                          # birlik testlar (integratsiya testlar TEST_DATABASE_URL bo'lmasa o'tkazib yuboriladi)
npm run typecheck
npm run lint

# Integratsiya + SQL testlar (alohida TEST bazasi — tarkibi TOZALANADI, nomi _test bilan tugashi shart)
docker compose exec db psql -U pep -d postgres -c "CREATE DATABASE physics_exam_test"
$env:TEST_DATABASE_URL = "postgresql://pep:PAROL@localhost:5432/physics_exam_test"
npm run test:integration
npm run test:sql                  # migratsiyalar + DB cheklovlari (bir tranzaksiya, ROLLBACK; psql yoki docker kerak)
```

## Production (docker compose)

1. Server (Linux, Docker) va ikki domen (masalan `app.example.uz`, `admin.example.uz`) — A yozuvi serverga.
2. `.env`: `NODE_ENV=production`, `STUDENT_DOMAIN`, `ADMIN_DOMAIN`, `STUDENT_APP_URL=https://app.example.uz`, `ADMIN_WEB_URL=https://admin.example.uz`, `BOT_MODE=webhook`, `BOT_WEBHOOK_URL=https://app.example.uz/telegram-webhook`, `BOT_WEBHOOK_SECRET` (24+ belgi), kuchli `POSTGRES_PASSWORD`, `ALLOW_DEV_AUTH=false`.
3. `docker compose --profile full up -d --build` — Caddy HTTPS sertifikatni o'zi oladi; API ishga tushishda migratsiyalarni o'zi qo'llaydi.
4. Mini App/menyu: bot ishga tushganda menyu tugmasini o'zi o'rnatadi. @BotFather → `/mybots` → Bot Settings → Menu Button orqali qo'lda ham o'zgartirsa bo'ladi.
5. Loglar: `docker compose logs -f api bot web`. Yangilash: `git pull && docker compose --profile full up -d --build`. Orqaga qaytish: oldingi git tegiga `git checkout` + qayta build (migratsiyalar faqat oldinga: orqaga qaytarishdan oldin bazani zaxiralang).
6. Zaxira (qo'lda, avtomatlashtirish 4-bosqichda): `docker compose exec -T db pg_dump -U pep -Fc physics_exam > backup.dump`; tiklash: `pg_restore -U pep -d physics_exam_restore backup.dump`.

## Railway (4 servis)
Servislar: `api`, `bot`, `student`, `admin` (+ Postgres). Muhim:
- Bot `API_INTERNAL_URL` ga **Railway private network** manzilini qo'ying (masalan `http://api.railway.internal:PORT`), ommaviy domenni emas — production'da `/internal` `X-Forwarded-For` bilan kelgan so'rovni rad etadi.
- `INTERNAL_API_KEY` va `BOT_TOKEN` faqat Railway Variables'da; kodga/chatga yozmang. Ular chatda ochiq qolgan bo'lsa — almashtiring.
- Zaxira: `docs/BACKUP.md`.
- Imtihon fayllari (rasm/PDF) bazada saqlanadi — Volume kerak emas.

## Tuzilma

```
apps/api          Express API (admin, o'quvchi, ichki bot endpointlari)
apps/bot          grammY bot (mantiq flow.ts da, Telegramdan mustaqil — testlanadi)
apps/student-app  Telegram Mini App (React + Vite + Tailwind)
apps/admin-web    Admin web-panel (React + Vite + Tailwind + React Router)
packages/shared   Umumiy Zod sxemalar, ID/bloklash/vaqt yordamchilari, o'zbekcha matnlar
db/migrations     Versiyalangan SQL migratsiyalar (0001–0003)
tests/sql         DB cheklovlari testi
deploy            Caddyfile, web Dockerfile
docs              Arxitektura va holat
```

## Admin panel tuzilmasi
Yon menyu 9 ta asosiy modulga bo'lingan: Dashboard, O'quvchilar bazasi, Sinflar va fanlar, Elektron jurnal, Davomat, Dars jadvali, Hisobotlar, Xabarnomalar, Sozlamalar. Imtihon vositalari (Imtihonlar, Savollar banki, Materiallar, Shikoyatlar) «Fizika nazorati» guruhida saqlangan. Jurnal, davomat va dars jadvali bo'limlari avval sinflar to'rini (1–11 ustunlar, faqat qo'shilgan sinflar) ko'rsatadi; sinfni bossangiz o'sha sinf ochiladi. **Administratsiya** (yon menyu burchagi va Dashboard tugmasi): sinf, o'quvchi va dars qo'shish vazifalari. Tuzilma `apps/admin-web/src/lib/modules.ts` da.

Hali yo'q: o'qituvchi hisobi va rollar (direktor, sinf rahbari, ota-ona), «fanlar» jadvali (fan hozir matn sifatida), qo'ng'iroqlar jadvali va xonalar ro'yxati.
