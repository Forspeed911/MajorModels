# MajorModels Manual

verified at 2026-05-01

## 1. Где лежат фотографии

В production фотографии нужно класть на сервере в директорию:

```bash
/opt/majormodels-media/products
```

Каждый артикул должен быть отдельной папкой. Имя папки должно совпадать с артикулом товара:

```text
/opt/majormodels-media/products/
  MM309/
    01.jpg
    02.jpg
  ABC-100/
    01.webp
```

Поддерживаемые форматы:

- `.jpg`
- `.jpeg`
- `.png`
- `.webp`

Фотографии сортируются по имени файла. Поэтому лучше называть их так:

```text
01.jpg
02.jpg
03.jpg
```

Первое фото после сортировки становится главным фото товара.

Если у товара несколько фотографий, бот показывает их только внутри карточки товара. В списке товаров фотографии не показываются.

## 2. Разворачивание системы на сервере

Рекомендуемый путь установки на чистый Linux-сервер:

```bash
curl -fsSL https://raw.githubusercontent.com/Forspeed911/MajorModels/main/scripts/bootstrap-server.sh | sudo bash
```

Скрипт установит Docker, скачает проект в `/opt/majormodels`, создаст `.env.production`, спросит секреты и запустит систему.

Во время установки нужно указать:

- `POSTGRES_PASSWORD`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`

После установки проект находится здесь:

```bash
/opt/majormodels
```

Проверка статуса:

```bash
cd /opt/majormodels
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

Проверка API:

```bash
curl -i http://127.0.0.1:3000/api/v1/health
```

Логи API:

```bash
cd /opt/majormodels
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f api
```

## 3. Обновление кода системы

На сервере:

```bash
cd /opt/majormodels
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

При старте API автоматически применит новые Prisma migrations через `prisma migrate deploy`.

## 4. Обновление прайс-листа

Основной Excel-файл каталога:

```bash
docs/majormodelsprice.xlsx
```

Формат Excel:

- лист: `Продукция`
- обязательные колонки:
  - `Категория`
  - `Артикул`
  - `Наименование`
  - `Цена`
- опциональная колонка:
  - `Фото`, `Картинка`, `Image`, `ImageUrl`

Рекомендуемый способ обновления на сервере без пересборки контейнера:

1. Загрузить новый Excel-файл на сервер, например:

```bash
/opt/majormodels-imports/majormodelsprice.xlsx
```

2. Скопировать файл внутрь API-контейнера:

```bash
cd /opt/majormodels
docker cp /opt/majormodels-imports/majormodelsprice.xlsx majormodels_api_prod:/tmp/majormodelsprice.xlsx
```

3. Проверить файл без записи в БД:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec api npm run catalog:import -- /tmp/majormodelsprice.xlsx --dry-run
```

4. Если dry-run успешен, импортировать каталог:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec api npm run catalog:import -- /tmp/majormodelsprice.xlsx
```

Правила импорта:

- категории создаются или переиспользуются по `name`
- товары создаются или обновляются по `article`
- при обновлении товара меняются категория, название, цена и `imageUrl`
- товары, которых нет в Excel, не удаляются
- дубли артикулов в Excel считаются ошибкой

Если нужно обновить дефолтный файл в репозитории, заменить:

```bash
/opt/majormodels/docs/majormodelsprice.xlsx
```

После этого можно пересобрать контейнер:

```bash
cd /opt/majormodels
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production exec api npm run catalog:import -- docs/majormodelsprice.xlsx
```

## 5. Обновление фотографий

Production-контейнер читает фотографии из host-директории:

```bash
/opt/majormodels-media
```

Она подключена в контейнер как:

```bash
/app/media
```

Фактическая структура для товаров:

```bash
/opt/majormodels-media/products/<АРТИКУЛ>/<ФАЙЛ>
```

Пример:

```bash
sudo mkdir -p /opt/majormodels-media/products/MM309
sudo cp 01.jpg /opt/majormodels-media/products/MM309/01.jpg
sudo cp 02.jpg /opt/majormodels-media/products/MM309/02.jpg
```

После загрузки или удаления фотографий нужно синхронизировать БД:

```bash
cd /opt/majormodels
docker compose -f docker-compose.prod.yml --env-file .env.production exec api npm run product-images:import -- /app/media/products
```

Перед реальным импортом можно выполнить dry-run:

```bash
cd /opt/majormodels
docker compose -f docker-compose.prod.yml --env-file .env.production exec api npm run product-images:import -- /app/media/products --dry-run
```

Правила синхронизации фотографий:

- папка сопоставляется с товаром по артикулу
- если папка найдена, старые записи фото этого товара в БД заменяются текущим содержимым папки
- если папка артикула существует, но в ней больше нет поддерживаемых фото, фото товара очищаются в БД
- физические файлы команда не удаляет
- папки без товара в каталоге пропускаются

Проверка, что фото отдается API:

```bash
curl -I "http://127.0.0.1:3000/api/v1/media/products/MM309/01.jpg"
```

Ожидаемый результат: HTTP `200`.

## 6. Локальная разработка

Для локальной разработки фотографии кладутся в:

```bash
media/products/<АРТИКУЛ>/<ФАЙЛ>
```

`media/` добавлена в `.gitignore`, чтобы фотографии случайно не попали в git.

Локальная синхронизация:

```bash
npm run product-images:import:dev -- media/products --dry-run
npm run product-images:import:dev -- media/products
```

Если локальный импорт не подключается к Postgres через `localhost`, используйте `127.0.0.1` в `DATABASE_URL`:

```bash
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/majormodels?schema=public' npm run product-images:import:dev -- media/products --dry-run
```

## 7. Частые проверки

Статус контейнеров:

```bash
cd /opt/majormodels
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

Перезапуск API:

```bash
cd /opt/majormodels
docker compose -f docker-compose.prod.yml --env-file .env.production restart api
```

Логи API:

```bash
cd /opt/majormodels
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f api
```

Проверка health:

```bash
curl -i http://127.0.0.1:3000/api/v1/health
```

## 8. Если при обновлении не хватает места

При обновлении система собирает новый Docker image. На маленьком сервере ошибка может выглядеть как:

```text
no space left on device
```

или сборка может падать на `npm ci`, `npm run build`, `COPY`, `extracting`, `write`.

Сначала проверить свободное место:

```bash
df -h
docker system df
```

Безопасная очистка Docker build cache:

```bash
docker builder prune -f
```

Очистка неиспользуемых Docker images:

```bash
docker image prune -f
```

Более сильная очистка неиспользуемых Docker objects без удаления volumes:

```bash
docker system prune -f
```

После очистки повторить обновление:

```bash
cd /opt/majormodels
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Если ошибка снова падает именно на `RUN npm ci`, посмотреть реальные строки ошибки выше `npm notice`:

```bash
cd /opt/majormodels
docker compose -f docker-compose.prod.yml --env-file .env.production build --no-cache api 2>&1 | tee /tmp/majormodels-build.log
tail -n 80 /tmp/majormodels-build.log
```

`npm notice New major version of npm available` не является причиной падения. Причина обычно находится выше: `ENOSPC`, `EACCES`, `ECONNRESET`, `ERESOLVE`, `EINTEGRITY` или другая строка `npm ERR!`.

Если места всё ещё не хватает, проверить самые большие директории:

```bash
sudo du -h --max-depth=1 /opt | sort -h
sudo du -h --max-depth=1 /var/lib/docker | sort -h
```

Важно: не удалять Docker volumes автоматически. В volume хранится PostgreSQL.

Не запускать:

```bash
docker system prune -a --volumes
docker volume prune
docker compose down -v
```

Эти команды могут удалить данные БД.

## 9. Что не делать

Не хранить фотографии в git.

Не класть фотографии внутрь `/opt/majormodels/docs` или в директории исходного кода.

Не запускать `docker compose down -v` в production без явного понимания последствий.

Не удалять Docker volume с PostgreSQL:

```bash
majormodels_postgres_data_prod
```
