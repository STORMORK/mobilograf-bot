# mobilograf-bot
Telegram Mini App для мобілографа

## Налаштування Supabase для універсального редактора контенту

Адмінка (`admin.html`) зберігає весь текстовий контент сайту в одній
колонці `content_i18n` (jsonb) таблиці `site_content`. Ця колонка не
створюється автоматично — її потрібно додати **один раз** вручну через
SQL Editor у Supabase:

```sql
ALTER TABLE site_content
ADD COLUMN IF NOT EXISTS content_i18n jsonb NOT NULL DEFAULT '{}'::jsonb;
```

Це суто додаткова зміна: жодна існуюча колонка чи рядок не змінюються.
Без цього кроку збереження в адмінці буде повертати помилку Supabase
про відсутню колонку — читання сайту (`index.html`) при цьому
продовжує працювати на старих даних/дефолтних текстах.

## Мультимовне редагування (UA / RU / EN)

В адмінці кожен текстовий елемент редагується вручну для всіх трьох мов
окремо — автоматичного перекладу немає, жодні зовнішні сервіси не
викликаються. Мовні вкладки UA/RU/EN лише перемикають, яку саме версію
поточного поля видно і можна редагувати; збережені значення завжди
йдуть у ту саму колонку `content_i18n`.

## Фони та портфоліо

Два розділи адмінки — **🌄 Фони** (heroBg — фон першого блоку/Hero, і
restBg — ОДИН спільний фон-зображення/GIF/відео одночасно для всіх
інших блоків сайту, рамок карток робіт у портфоліо та вікна «Замовити
зйомку») та **🖼 Портфоліо** (окрема система робіт з необмеженою
кількістю фото/GIF/відео на роботу). Потребують одноразового ручного
налаштування в Supabase, яке неможливо виконати автоматично.

### 1. Storage bucket

Створіть у Supabase Storage публічний bucket з назвою `site-media`
(Storage → New bucket → назва `site-media`, увімкнути "Public bucket").
Файли зберігаються за шляхами:

```
site-media/blocks/<blockId>/<random-id>.<ext>       — фон блоку сайту
site-media/portfolio/<portfolio-item-id>/<random-id>.<ext>  — медіа роботи
```

Шлях і випадкове ім'я файлу завжди генерує сервер (`api/_lib/mediaValidation.js`),
браузер не може вибрати довільний шлях чи ім'я.

### 2. Таблиці портфоліо

Виконайте один раз у SQL Editor (суто нові таблиці, жодні існуючі дані
не змінюються):

```sql
create table portfolio_items (
  id uuid primary key default gen_random_uuid(),
  title_ua text not null default '',
  title_ru text not null default '',
  title_en text not null default '',
  description_ua text not null default '',
  description_ru text not null default '',
  description_en text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table portfolio_media (
  id uuid primary key default gen_random_uuid(),
  portfolio_item_id uuid not null references portfolio_items(id) on delete cascade,
  url text not null,
  storage_path text not null,
  media_type text not null check (media_type in ('image','gif','video')),
  mime_type text not null,
  file_name text not null,
  file_size integer not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
```

`on delete cascade` — видалення роботи автоматично видаляє її рядки
`portfolio_media`; самі файли у Storage сервер видаляє окремим викликом
перед видаленням рядка роботи.

Доки ці таблиці не створені, `api/portfolio-list.js` (публічний
для сайту) просто повертає порожній список замість помилки — сайт
продовжує працювати, портфоліо-галерея не показується. Адмінські дії
з портфоліо (`api/portfolio.js`, `api/portfolio-media.js`,
`api/portfolio-upload-url.js`) до створення таблиць повертатимуть
помилку Supabase з поясненням.

### 3. Нові API endpoints

Усі — тільки для адміністратора (та ж Telegram initData + `ADMIN_IDS`
перевірка, що й у `admin-content.js`), крім `portfolio-list.js`:

| Endpoint | Призначення |
|---|---|
| `api/media-upload-url.js` | видає підписаний Storage URL для завантаження фону блоку |
| `api/media-commit.js` | зберігає/видаляє metadata фону блоку в `content_i18n.media` |
| `api/portfolio.js` | CRUD робіт портфоліо (створити/оновити/видалити/переставити) |
| `api/portfolio-upload-url.js` | видає підписаний Storage URL для медіа конкретної роботи |
| `api/portfolio-media.js` | додає/видаляє/переставляє окремі файли роботи |
| `api/portfolio-list.js` | **публічний**, без авторизації — список робіт для сайту |

Завантаження файлів іде напряму з браузера в Supabase Storage
(signed upload URL), а не через ці serverless-функції — важливо для
відео до 20 MB, які інакше могли б впертися в ліміти Vercel.
`SUPABASE_SECRET_KEY` при цьому ніколи не потрапляє в браузер.

### 4. Формати та ліміти

| Тип | MIME | Ліміт |
|---|---|---|
| Фото | `image/jpeg`, `image/png`, `image/webp` | до 10 MB |
| GIF | `image/gif` | до 5 MB |
| Відео | `video/mp4`, `video/webm` | до 20 MB |

Сервер (`api/_lib/mediaValidation.js`) перевіряє MIME-тип, розширення
файлу (має відповідати заявленому MIME) і розмір — жодному з цих трьох
параметрів окремо від інших не довіряють.

### 5. Нових Environment Variables не потрібно

Все працює на вже наявних `SUPABASE_URL` та `SUPABASE_SECRET_KEY`.

## Календар зайнятості

Розділ **📅 Календар** в адмінці дозволяє позначати дати, коли
мобілограф зайнятий — клієнт на сайті не зможе обрати таку дату (чи
дату в минулому) у формі «Замовити зйомку». Потребує одноразового
ручного створення таблиці в Supabase.

### 1. Таблиця busy_dates

Виконайте один раз у SQL Editor:

```sql
create table busy_dates (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  created_at timestamptz not null default now()
);
```

### 2. Нові API endpoints

| Endpoint | Призначення |
|---|---|
| `api/admin-busy-dates.js` | адмін-only: список зайнятих дат (GET), позначити/зняти зайнятість (POST) |
| `api/busy-dates.js` | **публічний**, без авторизації — список зайнятих дат (сьогодні і пізніше) для форми на сайті |

Доки таблиця не створена, `api/busy-dates.js` повертає порожній список
(форма продовжує працювати без обмежень по датах), а календар в
адмінці показує помилку Supabase з поясненням — той самий підхід, що й
у розділі «Фони та портфоліо» вище.

## Статистика відвідувань (📊 Статистика)

Розділ **📊 Статистика** в адмінці показує реальну серверну статистику
відвідувань і дій на сайті. Обидва адміністратори (`ADMIN_IDS` в
`api/_lib/telegramAuth.js`) повністю виключені з будь-яких цифр —
`api/analytics-collect.js` перевіряє Telegram initData на сервері й
просто нічого не записує, якщо це один з них, незалежно від того, як
саме відкрито Mini App. Потребує одноразового ручного створення
таблиці в Supabase.

### 1. Таблиця analytics_events

Виконайте один раз у SQL Editor:

```sql
create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  visitor_hash text,
  lang text,
  created_at timestamptz not null default now()
);
```

`visitor_hash` — це HMAC-SHA256 (з `BOT_TOKEN` як ключем) від Telegram
user ID, а не сам ID і не raw `initData` — цього достатньо, щоб
розрізнити нового відвідувача від того, хто вже був, без зберігання
зайвих персональних даних. Подія без підтвердженого Telegram-профілю
(Mini App відкрито поза Telegram) записується з `visitor_hash = null`
і враховується лише в загальній кількості відкриттів, не в унікальних/
постійних відвідувачах.

### 2. Нові API endpoints

| Endpoint | Призначення |
|---|---|
| `api/analytics-collect.js` | **публічний**, без авторизації — приймає одну подію від сайту; адмінів мовчки ігнорує |
| `api/analytics-stats.js` | адмін-only: агрегована статистика для розділу «📊 Статистика» |

Доки таблиця не створена, `api/analytics-collect.js` просто нічого не
зберігає (сайт продовжує працювати як завжди), а `api/analytics-stats.js`
повертає нульову статистику — той самий підхід, що й у розділах вище.

## Адміністратори та отримувач заявок

Два незалежних, навмисно не пов'язаних один з одним налаштування:

- **Хто має доступ до адмінки** — масив `ADMIN_IDS` в
  `api/_lib/telegramAuth.js`. Кожен захищений endpoint (усі перелічені
  вище як «тільки для адміністратора») перевіряє Telegram user ID через
  спільну функцію `requireAdmin()`/`isAdmin()` з цього файлу — додати чи
  прибрати адміністратора можна одним рядком там, нічого іншого міняти
  не треба. `index.html` окремо має свій власний `ADMIN_IDS` (лише щоб
  показати чи сховати кнопку «Адмін» у Mini App) — це не перевірка
  доступу, справжня перевірка завжди відбувається на сервері.

- **Хто отримує нові заявки з форми «Замовити зйомку»** —
  `NOTIFICATION_CHAT_ID` (Environment Variable у Vercel, опційно) в
  `api/send-message.js`; якщо не задано, використовується значення
  за замовчуванням у коді того ж файлу. Це не має жодного стосунку до
  того, хто має доступ до адмінки.
