# Running Event API

API หลังบ้านสำหรับระบบรับสมัครงานวิ่ง (หน้าบ้านสมัคร + หน้าแอดมินตรวจสลิป)

- TypeScript, Node 22, Express 5, Zod
- MongoDB + Mongoose (ต้องเป็น replica set เพราะใช้ transaction จองโควตา)
- โครงแบบ MVC: `routes` → `controllers` → `services` → `models`
- ชำระเงินด้วยการอัปโหลดสลิป แอดมิน/เจ้าหน้าที่อนุมัติพร้อมเลขอ้างอิง หรือปฏิเสธพร้อมเหตุผล (ไม่มี payment gateway ไม่มีตรวจสลิปอัตโนมัติ)
- แอดมินล็อกอินด้วย JWT ใน httpOnly cookie, bcrypt, role `super_admin` / `reviewer` / `viewer`

## โครงสร้างโปรเจกต์

```
src/
  server.ts            เริ่มระบบ: ต่อ DB, sync index, เปิด port, เริ่ม job หมดอายุออเดอร์
  app.ts               ประกอบ Express (helmet, cors, cookie, json, routes, error handler)
  config/              env (Zod), database, constants (ไซส์เสื้อ, จังหวัด, status)
  routes/              กำหนด endpoint + middleware เท่านั้น
  controllers/         อ่าน request → เรียก service → จัดรูป response
  services/            business logic ทั้งหมด (order, review, event, report ...)
  models/              Mongoose schema + index
  validators/          Zod schema และกฎตรวจข้อมูลที่พอร์ตจาก registration.ts
  middlewares/         auth/role, upload, validate, error handler, rate limit, origin check
  utils/               api-error, crypto (AES-256-GCM), csv, slip-file (magic bytes), transaction ฯลฯ
  seed/                seed.ts + seed-data.ts
```

## ความต้องการ

- Node.js 22 (มี `engines` ใน package.json)
- Docker + Docker Compose (สำหรับ MongoDB replica set และการ deploy)

## ตัวแปร environment

คัดลอก `.env.example` เป็น `.env` แล้วแก้ค่า (`.env` ถูก ignore ใน git ห้าม commit)

| ตัวแปร | จำเป็น | คำอธิบาย |
|---|---|---|
| `NODE_ENV` | | `development` / `production` / `test` |
| `PORT` | | ค่าเริ่มต้น `4000` |
| `MONGODB_URI` | ✔ | ต้องมี `?replicaSet=rs0` (compose ตั้งให้เองสำหรับ container `api`) |
| `JWT_SECRET` | ✔ | อย่างน้อย 32 ตัวอักษร สุ่มเอง |
| `JWT_EXPIRES_IN` | | ค่าเริ่มต้น `8h` |
| `COOKIE_SECURE` | | ว่าง = `true` เมื่อ production ถ้าเทสต์ผ่าน http ล้วนให้ตั้ง `false` |
| `CORS_ORIGINS` | ✔ | origin ของหน้าบ้านและหลังบ้าน คั่นด้วย comma ใช้ทั้ง CORS และตรวจ `Origin` ของ request ที่แก้ไขข้อมูล |
| `ID_ENCRYPTION_KEY` | ✔ | base64 ของ 32 bytes เข้ารหัสเลขบัตรประชาชน (เปลี่ยนภายหลังไม่ได้ ข้อมูลเดิมจะถอดรหัสไม่ได้) |
| `UPLOAD_DIR` | | โฟลเดอร์เก็บสลิป ค่าเริ่มต้น `./uploads` (ใน docker เป็น volume `/app/uploads`) |
| `MAX_SLIP_MB` | | ขนาดสลิปสูงสุด ค่าเริ่มต้น 5 |
| `ORDER_EXPIRE_HOURS` | | ออเดอร์ `pending` หมดอายุกี่ชั่วโมง ค่าเริ่มต้น 24 |
| `SHIPPING_FEE` | | ค่าจัดส่งต่อออเดอร์ ค่าเริ่มต้น 50 บาท |
| `BCRYPT_COST` | | ค่าเริ่มต้น 12 |
| `TRUST_PROXY` | | จำนวน reverse proxy ด้านหน้า (ใช้ caddy ตั้ง `1`) เพื่อให้ rate limit เห็น IP จริง |
| `API_DOMAIN` | | โดเมนสำหรับ caddy (profile `proxy`) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` | ใช้ตอน seed | super admin เริ่มต้น รหัสผ่านอย่างน้อย 10 ตัวอักษร ตั้งเอง ไม่มีค่า hardcode |
| `SEED_MOCK_USERS` / `SEED_MOCK_USER_PASSWORD` | | `true` เพื่อสร้าง reviewer/viewer ตัวอย่าง ต้องตั้งรหัสผ่านอย่างน้อย 10 ตัวอักษร |
| `SEED_ALLOW_PRODUCTION` | | production จะ seed เฉพาะ super admin ตั้ง `true` ถ้าต้องการข้อมูลตัวอย่างด้วย |

สุ่มค่าความลับ:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"      # ID_ENCRYPTION_KEY
```

## รันบนเครื่อง (dev)

MongoDB ต้องเป็น replica set ตั้ง `MONGODB_URI` ให้ชี้ไป replica set ที่เข้าถึงได้จากเครื่อง (หรือรันทั้งชุดด้วย Docker Compose ตามหัวข้อถัดไป)

```bash
npm install
cp .env.example .env            # แล้วแก้ JWT_SECRET, ID_ENCRYPTION_KEY, SEED_ADMIN_PASSWORD
npm run seed                    # events 6 งาน + super admin (+ ออเดอร์ตัวอย่างเมื่อไม่ใช่ production)
npm run dev                     # http://localhost:4000/health
```

คำสั่ง npm: `dev`, `build`, `start`, `typecheck`, `seed`

## รันด้วย Docker Compose

```bash
cp .env.example .env            # แก้ค่าที่จำเป็น, CORS_ORIGINS ให้ตรงกับหน้าบ้าน
docker compose build
docker compose up -d            # mongo (replica set) + api
docker compose run --rm api node dist/seed/seed.js     # สร้าง super admin และข้อมูลเริ่มต้น
docker compose ps               # รอให้ทั้งสอง service เป็น healthy
```

- `mongo` ไม่ได้ publish port ออกนอก network ของ compose
- `api` bind ที่ `127.0.0.1:4000` เท่านั้น (เปลี่ยนด้วย `API_HOST_PORT`)
- สลิปเก็บใน volume `uploads` และไม่ถูกเสิร์ฟแบบ static ดูได้ผ่าน endpoint ของแอดมินเท่านั้น
- คอนเทนเนอร์ api รันเป็น user `node` (non-root)

เปิด HTTPS ผ่าน Caddy (ตั้ง `API_DOMAIN` ใน `.env` ให้ DNS ชี้มาที่เครื่อง และตั้ง `TRUST_PROXY=1`):

```bash
docker compose --profile proxy up -d
```

## CI/CD และการ deploy

workflow: `.github/workflows/ci-cd.yml`

- เปิด pull request เข้า `main`: รัน `typecheck`, `build`
- push เข้า `main`: รันตรวจสอบชุดเดียวกัน แล้ว build image และ push ไป `ghcr.io/warunyoo1/running-event-api` (tag `latest` และ commit SHA) ด้วย `GITHUB_TOKEN` (ไม่ต้องตั้ง secret สำหรับ push) จากนั้น SSH เข้า server เพื่อ `docker compose pull api`, `up -d`, รอ healthcheck และ `docker image prune -f`

### GitHub secrets / variables ที่ต้องตั้ง

ตั้งที่ Settings > Secrets and variables > Actions

| ชื่อ | ประเภท | จำเป็น | คำอธิบาย |
|---|---|---|---|
| `SSH_HOST` | secret | ใช่ | IP หรือโดเมนของ server |
| `SSH_USER` | secret | ใช่ | user สำหรับ deploy (ไม่ใช่ root) |
| `SSH_KEY` | secret | ใช่ | private key (OpenSSH) ของ user ดังกล่าว |
| `SSH_PORT` | secret | ไม่ | ค่าเริ่มต้น 22 |
| `SSH_KNOWN_HOSTS` | secret | แนะนำ | ผลลัพธ์ของ `ssh-keyscan -p 22 <host>` เพื่อตรึง host key ถ้าไม่ตั้งจะใช้ ssh-keyscan ระหว่างรัน (ไม่ตรวจสอบ ตอนแรกมี warning) |
| `DEPLOY_PATH` | variable หรือ secret | ไม่ | โฟลเดอร์บน server ค่าเริ่มต้น `/opt/running-event-api` |

ไม่ต้องตั้ง token ของ GHCR ใน GitHub: server login ไว้เองครั้งเดียว (ด้านล่าง) และ workflow ไม่ print ค่า secret

### ตั้งค่า server ครั้งแรก

1. ติดตั้ง Docker + Docker Compose plugin
2. สร้าง user สำหรับ deploy (ไม่ใช้ root) และใส่ public key ที่คู่กับ `SSH_KEY` ใน `~/.ssh/authorized_keys`
   ```bash
   sudo adduser --disabled-password deploy
   sudo usermod -aG docker deploy      # สิทธิ์กลุ่ม docker เทียบเท่า root บนเครื่อง ควรจำกัดการเข้าถึง key
   ```
3. สร้างโฟลเดอร์ `DEPLOY_PATH` ให้ user นั้นเป็นเจ้าของ แล้วคัดลอก `docker-compose.prod.yml` และ `Caddyfile` ไปไว้ (ทำเองครั้งแรก และทุกครั้งที่ไฟล์เปลี่ยน workflow ไม่ได้ส่งไฟล์ไปให้)
   ```bash
   sudo mkdir -p /opt/running-event-api && sudo chown deploy:deploy /opt/running-event-api
   ```
4. สร้าง `.env` ใน `DEPLOY_PATH` (`chmod 600`) ตามตัวแปรด้านล่าง
5. login GHCR ด้วย user deploy ครั้งเดียว ใช้ classic PAT ที่มีสิทธิ์ `read:packages` (token ถูกเก็บใน `~/.docker/config.json` ของ user นั้น)
   ```bash
   echo "<PAT>" | docker login ghcr.io -u <github-username> --password-stdin
   ```
   ถ้า package เป็น public ไม่ต้อง login
6. รันครั้งแรกและ seed super admin
   ```bash
   cd /opt/running-event-api
   docker compose -f docker-compose.prod.yml pull api
   docker compose -f docker-compose.prod.yml --profile proxy up -d
   docker compose -f docker-compose.prod.yml run --rm api node dist/seed/seed.js
   ```
   รอบถัดไป workflow จะรัน `up -d` ให้ (service caddy ที่เปิดด้วย `--profile proxy` จะยังคงอยู่ ถ้าต้องการให้ workflow จัดการ caddy ด้วย ให้ตั้ง `COMPOSE_PROFILES=proxy` ใน `.env` บน server)

### ตัวแปรใน `.env` บน server

| ตัวแปร | ค่า |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | สุ่มอย่างน้อย 32 ตัวอักษร |
| `ID_ENCRYPTION_KEY` | base64 ของ 32 bytes (เปลี่ยนภายหลังไม่ได้) |
| `CORS_ORIGINS` | origin ของหน้าบ้านและหลังบ้าน คั่นด้วย comma (ใช้ `https://`) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | super admin สำหรับ seed (รหัสผ่านอย่างน้อย 10 ตัวอักษร) |
| `API_DOMAIN` | โดเมนของ API ที่ DNS ชี้มาที่ server (ใช้โดย caddy) |
| `TRUST_PROXY` | `1` เมื่ออยู่หลัง caddy (`docker-compose.prod.yml` ใช้ `1` เป็นค่าเริ่มต้นอยู่แล้ว ตั้ง `0` ถ้าไม่ใช้ caddy) |

`MONGODB_URI`, `PORT` และ `UPLOAD_DIR` ถูกกำหนดใน `docker-compose.prod.yml` อยู่แล้ว ข้อมูล mongo และสลิปเก็บใน volume `mongo_data` และ `uploads`

## รูปแบบ response

- สำเร็จ: `{ "data": ..., "meta": { "page", "pageSize", "total", "totalPages" } }` (`meta` มีเฉพาะรายการแบบแบ่งหน้า)
- ผิดพลาด: `{ "error": { "code": "...", "message": "...", "fields": { ... } } }`
- `fields` ใช้คีย์เดียวกับ `FieldErrors` ของหน้าบ้าน (`firstName`, `birthDate`, `phone`, `identity`, `race`, `size` ...)
  โดยออเดอร์ใช้ `participants.<index>.<field>` และ `delivery.<field>`
- รหัสที่พบบ่อย: `VALIDATION_ERROR` 422, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404,
  `QUOTA_FULL` / `INVALID_STATE` / `SLUG_TAKEN` / `EVENT_HAS_ORDERS` / `DUPLICATE_TRANSACTION_REF` / `DUPLICATE_BIB` / `LAST_SUPER_ADMIN` 409,
  `UNSUPPORTED_FILE_TYPE` 415, `FILE_TOO_LARGE` 413, `RATE_LIMITED` 429

## Endpoints (prefix `/api/v1`)

สิทธิ์: S = super_admin, R = reviewer, V = viewer

### Public

| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/health` (และ `/api/v1/health`) | ตรวจสถานะ + DB |
| GET | `/public/events` | รายการงาน (ไม่รวม draft) filter: `q, province, month (YYYY-MM), distance, category, status` มี `remaining` ต่อระยะ |
| GET | `/public/events/:slug` | รายละเอียดงาน |
| POST | `/public/events/:slug/orders` | สร้างออเดอร์ `{participants[], delivery}` เซิร์ฟเวอร์คำนวณยอดเอง ได้ `orderNo`, `amount`, `expiresAt` |
| GET | `/public/orders/:orderNo?phoneLast4=1234` | ตรวจสถานะออเดอร์ (ไม่มีข้อมูลส่วนบุคคลใน response) |
| POST | `/public/orders/:orderNo/slip` | อัปโหลดสลิป `multipart/form-data` field `slip` + `phoneLast4` (jpg/png/webp ≤ 5MB ตรวจ magic bytes) |

### Admin (ต้องล็อกอิน ยกเว้น login)

| Method | Path | สิทธิ์ | คำอธิบาย |
|---|---|---|---|
| POST | `/admin/auth/login` | - | ตั้ง cookie `rr_admin_token` (httpOnly) จำกัดจำนวนครั้งต่อ IP+email |
| POST | `/admin/auth/logout` | ทุก role | ล้าง cookie |
| GET | `/admin/auth/me` | ทุก role | ข้อมูลผู้ใช้ปัจจุบัน |
| POST | `/admin/auth/change-password` | ทุก role | เปลี่ยนรหัสผ่าน (≥ 10 ตัวอักษร) |
| GET | `/admin/events`, `/admin/events/:id` | S R V | รายการ/รายละเอียดงาน พร้อม `orderCount` |
| POST | `/admin/events` | S | สร้างงาน + ระยะ (409 `SLUG_TAKEN` ถ้า slug ซ้ำ) |
| PUT | `/admin/events/:id` | S | แก้งาน (409 `EVENT_HAS_ORDERS` ถ้าแก้ราคา/โควตา/ลบ/เปลี่ยนชื่อระยะหลังมีออเดอร์) |
| GET | `/admin/orders`, `/admin/orders/:id` | S R V | filter: `eventId, status, q, from, to, page, pageSize` |
| POST | `/admin/orders/:id/cancel` | S R | ยกเลิก (คืนโควตา) |
| PATCH | `/admin/orders/:id/tracking` | S R | เลขพัสดุ (เฉพาะออเดอร์จัดส่งที่ชำระแล้ว) |
| GET | `/admin/slips?tab=waiting\|history&eventId=` | S R V | คิวสลิป (รอตรวจ เก่าสุดก่อน / ประวัติ) |
| GET | `/admin/payments/:id/slip` | S R V | ไฟล์สลิป (ต้องมี cookie) |
| POST | `/admin/orders/:id/approve` | S R | `{ transactionRef }` เลขอ้างอิงห้ามซ้ำกับออเดอร์ที่ชำระแล้ว |
| POST | `/admin/orders/:id/reject` | S R | `{ reason }` จำเป็น |
| GET | `/admin/participants` | S R V | filter: `eventId, q, race, status` เลขบัตรแสดงแบบ mask |
| PATCH | `/admin/participants/:id` | S R | `{ collected?, bibNo? }` (BIB ไม่ซ้ำภายในงาน ตั้งได้เฉพาะออเดอร์ที่ชำระแล้ว) |
| GET | `/admin/shipping?method=pickup\|shipping` | S R V | รายการจัดส่ง/รับของ (ออเดอร์ที่ชำระแล้ว) |
| GET | `/admin/dashboard?eventId=` | S R V | สรุปจำนวนออเดอร์ รายได้ (เฉพาะ paid) โควตาแต่ละระยะ |
| GET | `/admin/reports/summary`, `/admin/reports/shirt-sizes` | S R V | รายงานสรุป / ไซส์เสื้อ (`status` เริ่มต้น `paid`) |
| GET | `/admin/export/orders.csv`, `participants.csv`, `fulfillment.csv` | S R V | CSV UTF-8 BOM ป้องกัน formula injection (ไม่มีเลขบัตรเต็ม) |
| GET/POST/PATCH | `/admin/users`, `/admin/users/:id` | S | จัดการผู้ใช้ (ห้ามลดสิทธิ์/ปิดใช้งาน super_admin คนสุดท้าย) |

หมายเหตุ: endpoint อัปโหลดโปสเตอร์/QR ของงานยังไม่อยู่ในขอบเขตรอบนี้

## ขั้นตอนการชำระเงินและสถานะออเดอร์

```
pending ──อัปโหลดสลิป──▶ slip_uploaded ──อนุมัติ(transactionRef)──▶ paid
   │                         │  ▲                                    (สถานะสุดท้าย)
   │                         │  └──── อัปโหลดสลิปใหม่ ───── rejected ◀── ปฏิเสธ(reason)
   ├── ครบ ORDER_EXPIRE_HOURS ──▶ expired     (เฉพาะ pending)
   └── แอดมินยกเลิก (ก่อน paid) ──▶ cancelled
```

- `expired` / `cancelled` คืนโควตา, `rejected` ยังถือโควตาไว้ (ลูกค้าอัปโหลดสลิปใหม่ได้)
- ออเดอร์ที่อัปโหลดสลิปแล้วจะไม่หมดอายุอัตโนมัติ
- งานหมดอายุทำงานใน process ทุก 60 วินาที
- ยอดรวม = ราคาระยะ × จำนวนผู้สมัคร + ค่าจัดส่ง 50 บาท (ครั้งเดียวต่อออเดอร์ เฉพาะเลือกจัดส่ง)
- จองโควตาแบบ atomic: `findOneAndUpdate` เงื่อนไข `reserved + n <= quota` ภายใน transaction เดียวกับการสร้างออเดอร์

## ความปลอดภัย

- เลขบัตรประชาชนเข้ารหัส AES-256-GCM และแสดงแบบ mask (`*********1234`) ใน admin; ไม่อยู่ใน CSV; ผู้สมัครที่เลือกไม่ให้ข้อมูลจะไม่ถูกเก็บ
- สลิปตรวจ magic bytes (ไม่เชื่อ mime/นามสกุลจาก client) ตั้งชื่อไฟล์ฝั่งเซิร์ฟเวอร์ เสิร์ฟเฉพาะผ่าน endpoint แอดมิน
- cookie: httpOnly, SameSite=Lax, Secure เมื่อ production; request ที่แก้ไขข้อมูลจาก browser ต้องมี `Origin` ตรงกับ `CORS_ORIGINS`
- ไม่ commit `.env`; อย่าเก็บรหัสผ่าน/คีย์ใน repo; ควรเปลี่ยนรหัสผ่าน super admin หลัง seed
- หน้าบ้านที่เรียกด้วย cookie ต้องใช้ `credentials: "include"` และโดเมนต้องอยู่ใน `CORS_ORIGINS`

