# Telegram Catalog Bot — Specification

verified at 2026-04-30

## 1. Цель проекта

Нужно реализовать backend и Telegram-бота для продаж по каталогу товаров.

Целевой пользовательский сценарий:

1. Пользователь открывает каталог.
2. Просматривает категории и товары.
3. Ищет нужные позиции.
4. Добавляет товары в заявку.
5. Отправляет заявку.
6. Администратор получает заявку в Telegram.

## 2. Границы этапов

### 2.1 Реализовано на текущую дату

Реализованы backend и deploy-блоки:

- health-check API
- read API каталога (категории и товары)
- API заявок (`create` + `get by id`)
- сохранение заявки и позиций заявки в PostgreSQL
- промокоды при оформлении заявки: `PROMO10`, `PROMO15`, `PROMO20`
- выбор способа получения (`SDEC` или `OZON`) и сбор адреса ПВЗ, телефона, ФИО
- отправка уведомления администратору в Telegram после создания заявки
- прикладной Telegram bot UX для пользователя:
  - `/start`, `/catalog`, `/cart`
  - inline-кнопки категорий и товаров
  - in-memory корзина на пользователя
  - кнопка промокода в корзине
  - пошаговое оформление: способ получения -> адрес ПВЗ -> телефон -> ФИО
  - оформление заявки из бота через backend API `POST /orders`
- CLI-импорт каталога из Excel price-list файла:
  - команда `npm run catalog:import -- <path-to-xlsx>`
  - dry-run режим `npm run catalog:import -- <path-to-xlsx> --dry-run`
  - обновление категорий по `name` и товаров по `article`
- production Docker stack
- one-command bootstrap/deploy скрипт для Linux VM
  - интерактивный ввод `POSTGRES_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`
  - автонастройка `DATABASE_URL` на локальную БД контейнера (`db:5432`)
  - создание внешнего persistent Docker volume для БД (`DB_VOLUME_NAME`)

### 2.2 Следующий обязательный этап

Усилить эксплуатационную устойчивость Telegram-слоя:

- persistence корзины (чтобы корзина не терялась при рестарте API)
- retry-механизм для заявок со статусом `NEW` при сбое Telegram-уведомления
- e2e-сценарии для bot UX и API заказов

### 2.3 Вне текущего MVP

Не требуется:

- онлайн-оплата
- личный кабинет
- web-админка
- CRM-интеграции

## 3. Технологический стек (фиксированный)

- Node.js 18+
- TypeScript (strict)
- NestJS
- Prisma
- PostgreSQL
- REST API (`/api/v1/*`)
- class-validator / class-transformer
- Docker / Docker Compose

## 4. Архитектурные правила

Обязательная слоистая архитектура:

- Controller -> Service -> Repository

Ограничения:

- бизнес-логика только в Service
- доступ к БД только в Repository
- DTO обязательны для входа/выхода
- валидация входа обязательна до выполнения Service

## 5. Текущий API-контракт (реализовано)

Префикс всех эндпоинтов: `/api/v1`

### 5.1 Health

- `GET /health`
- Ответ `200`: `{ "status": "ok" }`

### 5.2 Categories

- `GET /categories`
- Ответ `200`: массив категорий

Формат элемента:

- `id: string (uuid)`
- `name: string`

### 5.3 Products list

- `GET /products`

Query-параметры:

- `categoryId?: uuid v4`
- `search?: string` (max 120)
- `limit?: int` (1..100, default 20)
- `offset?: int` (>=0, default 0)

Правила:

- поиск по `name` и `article`, case-insensitive
- сортировка: `name ASC`, затем `article ASC`

Ответ `200`:

- `items: ProductResponse[]`
- `total: number`
- `limit: number`
- `offset: number`

`ProductResponse`:

- `id: string (uuid)`
- `categoryId: string (uuid)`
- `article: string`
- `name: string`
- `price: string` (decimal как строка)
- `imageUrl: string | null`

### 5.4 Product details

- `GET /products/:id`
- `id` валидируется как UUID v4
- `404`, если товар не найден

### 5.5 Create order

- `POST /orders`

Request body:

- `telegramUserId: string` (required, max 64)
- `telegramUsername?: string` (max 64)
- `telegramFullName?: string` (max 120)
- `comment?: string` (max 1000)
- `promoCode?: string` (`PROMO10`, `PROMO15`, `PROMO20`)
- `deliveryMethod: "SDEC" | "OZON"`
- `pickupPointAddress: string` (max 500)
- `customerPhone: string` (max 32)
- `customerFullName: string` (max 120)
- `items: [{ productId: uuid, quantity: int }]` (1..100 позиций)

Бизнес-правила:

- если товар не найден, возвращается ошибка валидации/бизнес-ошибка
- одинаковые `productId` в payload агрегируются по количеству
- цена и subtotal фиксируются в заявке snapshot-значениями на момент создания
- при валидном промокоде фиксируются `subtotal`, `discountTotal`, итоговый `total`
- неизвестный промокод возвращает бизнес-ошибку
- `total` — итог к оплате после скидки
- после сохранения выполняется попытка отправки в Telegram админу
- при ошибке Telegram заявка остается сохраненной (не теряется)

Response `201`:

- данные заявки с позициями и статусом

### 5.6 Get order by id

- `GET /orders/:id`
- `id` валидируется как UUID v4
- `404`, если заявка не найдена

### 5.7 Telegram bot UX (реализовано)

Команды:

- `/start` — главное меню
- `/catalog` — список категорий
- `/cart` — состояние корзины

Inline callback-действия:

- выбор категории -> загрузка товаров через `GET /products?categoryId&limit&offset`
- добавление товара в корзину -> `GET /products/:id` для snapshot карточки
- ввод промокода из корзины
- выбор способа получения: `SDEC` или `OZON`
- ввод адреса ПВЗ
- ввод телефона
- ввод ФИО получателя
- оформление заявки -> `POST /orders`

Правила:

- корзина хранится in-memory по `telegram user id`
- примененный промокод хранится в in-memory корзине до очистки/оформления
- в корзине отображаются подытог, скидка и итог к оплате
- при успешном создании заявки корзина очищается
- если `TELEGRAM_BOT_TOKEN` не задан/placeholder, polling-бот не стартует и API продолжает работу

### 5.8 Catalog Excel import (реализовано)

Операторская команда:

- `npm run catalog:import -- <path-to-xlsx>`
- `npm run catalog:import -- <path-to-xlsx> --dry-run`
- для локальной проверки без предварительной сборки можно использовать
  `npm run catalog:import:dev -- <path-to-xlsx> --dry-run`

Если путь не передан, используется файл по умолчанию:

- `docs/majormodelsprice.xlsx`

Поддерживаемый формат workbook:

- лист по умолчанию: `Продукция`
- строка заголовков содержит обязательные колонки:
  - `Категория`
  - `Артикул`
  - `Наименование`
  - `Цена`
- опциональная колонка для изображения:
  - `Фото`, `Картинка`, `Image`, `ImageUrl`

Правила импорта:

- перед записью в БД файл валидируется на обязательные значения и дубли артикулов
- категории создаются/переиспользуются по уникальному `name`
- товары создаются/обновляются по уникальному `article`
- при обновлении товара меняются категория, название, цена и `imageUrl`
- отсутствующие в Excel товары не удаляются
- dry-run читает и валидирует файл без подключения к БД и без записей

## 6. Модель данных (реализовано)

### 6.1 Category

- `id: uuid` (PK)
- `name: string` (unique)
- `createdAt: datetime`
- `updatedAt: datetime`

### 6.2 Product

- `id: uuid` (PK)
- `categoryId: uuid` (FK -> Category.id, onDelete Restrict)
- `article: string` (unique)
- `name: string`
- `price: decimal(12,2)`
- `imageUrl: string?`
- `createdAt: datetime`
- `updatedAt: datetime`

Индексы:

- `categoryId`
- `name`
- `article`

### 6.3 OrderRequest

- `id: uuid` (PK)
- `telegramUserId: string`
- `telegramUsername: string?`
- `telegramFullName: string?`
- `comment: string?`
- `status: enum(OrderStatus)`
- `subtotal: decimal(12,2)`
- `discountTotal: decimal(12,2)`
- `total: decimal(12,2)` — итог к оплате после скидки
- `promoCode: string?`
- `promoDiscountPercent: int?`
- `deliveryMethod: enum(DeliveryMethod)?`
- `pickupPointAddress: string?`
- `customerPhone: string?`
- `customerFullName: string?`
- `notifiedAt: datetime?`
- `notificationError: string?`
- `createdAt: datetime`
- `updatedAt: datetime`

Индексы:

- `telegramUserId`
- `status`
- `createdAt`

### 6.4 OrderItem

- `id: uuid` (PK)
- `orderId: uuid` (FK -> OrderRequest.id, onDelete Cascade)
- `productId: uuid` (FK -> Product.id, onDelete Restrict)
- `quantity: int`
- `unitPrice: decimal(12,2)`
- `subtotal: decimal(12,2)`
- `createdAt: datetime`

Ограничения/индексы:

- `unique(orderId, productId)`
- индексы по `orderId`, `productId`

### 6.5 OrderStatus

- `NEW`
- `NOTIFIED`

### 6.6 DeliveryMethod

- `SDEC`
- `OZON`

## 7. Telegram уведомления (реализовано)

После создания заявки backend:

1. Формирует текстовое сообщение для администратора.
2. Отправляет в `TELEGRAM_ADMIN_CHAT_ID` через Telegram Bot API.
3. При успехе выставляет статус `NOTIFIED`.
4. При ошибке сохраняет `notificationError`, статус остается `NEW`.

## 8. Deploy/Operations (реализовано)

### 8.1 Production stack

- `docker-compose.prod.yml`
- Сервисы: `api`, `db`
- `db`: postgres:16-alpine + external persistent volume
- `api`: build из `Dockerfile`, health-check по `/api/v1/health`

### 8.2 Startup behavior

Entrypoint `scripts/start-prod.sh`:

1. выполняет `prisma migrate deploy` (с retry)
2. запускает `node dist/main.js`

### 8.3 One-command bootstrap

`curl`-bootstrap скрипт: `scripts/bootstrap-server.sh`

Функции:

- проверка/установка `curl`, `git`
- проверка/установка `docker` + compose
- проверка/установка `node`/`npm`
- проверка/установка `postgresql`
- `git clone`/`git pull`
- подготовка `.env.production`
- интерактивный ввод обязательных секретов (при placeholder значениях)
- автоформирование `DATABASE_URL` для same-server DB (`postgresql://<user>:<password>@db:5432/<db>?schema=public`)
- создание внешнего volume для данных БД (`DB_VOLUME_NAME`, default `majormodels_postgres_data_prod`)
- `docker compose up -d --build`

Переменные Telegram bot UX:

- `TELEGRAM_BOT_TOKEN` — токен бота
- `TELEGRAM_BACKEND_BASE_URL` (опционально) — базовый URL backend API для bot-клиента. По умолчанию используется `http://127.0.0.1:${PORT}/api/v1`.
- `PROMPT_FOR_SECRETS` — включает интерактивный ввод секретов в bootstrap (`1` по умолчанию)
- `DB_VOLUME_NAME` — имя внешнего Docker volume для данных PostgreSQL
- данные БД не удаляются при `docker compose down -v`, но могут быть удалены вручную через `docker volume rm`

## 9. Нефункциональные требования

- Детерминированные сервисы
- Валидация всех входных DTO
- Явные и стабильные JSON-ответы
- Обязательная миграционная дисциплина через Prisma migrations
- Совместимость деплоя с Linux VM через docker compose

## 10. Правило актуализации спецификации

После добавления любого нового функционала этот файл должен быть обновлен:

- что реализовано
- какой API контракт добавлен/изменён
- какая модель данных добавлена/изменена
- какие ограничения и бизнес-правила появились
