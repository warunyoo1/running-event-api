# Running Event API

API หลังบ้านสำหรับระบบรับสมัครงานวิ่ง (หน้าบ้านสมัคร + หน้าแอดมินตรวจสลิป)

- TypeScript, Node 22, Express 5, Zod
- MongoDB + Mongoose (รองรับ MongoDB แบบ standalone ไม่ต้องเป็น replica set ระบบไม่ใช้ transaction)
- โครงแบบ MVC: `routes` → `controllers` → `services` → `models`
- ชำระเงินด้วยการอัปโหลดสลิป แอดมิน/เจ้าหน้าที่อนุมัติพร้อมเลขอ้างอิง หรือปฏิเสธพร้อมเหตุผล (ไม่มี payment gateway ไม่มีตรวจสลิปอัตโนมัติ)
- แอดมินล็อกอินด้วย JWT ใน httpOnly cookie, bcrypt, role `super_admin` / `reviewer` / `viewer`

## โครงสร้างโปรเจกต์

```
src/
  server.ts              เริ่มระบบ: ต่อ DB, sync index, เปิด port, เริ่ม job หมดอายุออเดอร์
  app.ts                 ประกอบ Express (helmet, cors, cookie, json, routes, error handler)
  config/
    env.ts               ตรวจ env ด้วย Zod (ค่าไม่ครบ = start ไม่ขึ้น)
    database.ts          ต่อ MongoDB
    constants.ts         ค่าคงที่ทั้งหมด: status, role, ไซส์เสื้อ, จังหวัด, EXPORT_LIMIT, EXPIRY_* ฯลฯ
  routes/                กำหนด path + middleware (auth, role, validate) แล้วส่งต่อ controller เท่านั้น
    index.ts             mount /health, /api/v1/public, /api/v1/admin
    public.routes.ts / admin.routes.ts / health.routes.ts
  controllers/           อ่าน input ที่ validate แล้ว → เรียก service → ok()/created() ไม่มี business logic
  services/              business logic ทั้งหมด
    order.service.ts     barrel ให้ controller import (re-export จาก services/order/*)
    order/
      order-create.service.ts   สร้างออเดอร์ฝั่ง public (checkout)
      order-public.service.ts   ค้นหาออเดอร์ด้วย orderNo + phoneLast4
      order-admin.service.ts    list/detail/cancel/tracking ของแอดมิน, adminFilter, findOrderOr404
      order-quota.ts            จอง/คืนโควตา (ใช้ร่วมกันทั้ง create, cancel, expiry)
      order-state.ts            state machine ของสถานะออเดอร์ (transitions, QUOTA_HOLDING, canEditAddress)
      order-detail.service.ts   โหลด notes + timeline ประกอบรายละเอียดออเดอร์ฝั่งแอดมิน
      order-notes.service.ts    เพิ่ม/ลบบันทึกภายในของออเดอร์
      order-address.ts          trimAddress ใช้ร่วมกันระหว่าง checkout และแก้ที่อยู่
    event.service.ts     barrel ให้ controller import (re-export จาก services/event/*)
    event/
      event-read.service.ts     list/detail ของ public และ admin
      event-write.service.ts    create/update/archive/restore/remove พร้อม races (ไม่มี transaction, ทำ compensation เมื่อล้มเหลว)
      event-fields.ts           ฟังก์ชัน pure แยก $set/$unset ของ event และ race (null = ล้างค่า)
    audit-log.service.ts เลือกอ่านประวัติการใช้งาน (GET /admin/audit-logs)
    service-errors.ts    error ที่หลาย service ใช้ร่วมกัน (eventNotFound)
    review / slip / event-image / participant / shipping / dashboard / report / export / user / auth / audit / expiry
  views/                 แปลงเอกสารจาก DB เป็น JSON ของ response: <aggregate>.view.ts, ฟังก์ชัน pure toXxxView/toXxxViews + type ของ view
  models/                Mongoose schema + index + type lean ที่ derive จาก schema (RaceLean, EventLean, OrderLean, ParticipantLean, PaymentLean, EventImageLean), index.ts รวม export ทุก model
  validators/            Zod schema ของ body/query/params พร้อม export type z.infer ของทุก schema
  middlewares/           auth/role, upload, validate (+ validatedParams/Query/Body), error handler (แปลง error → status), rate limit, origin check
    response-envelope.ts ครอบ res.json ให้ทุก response เป็น { statusCode, success, message, ... }
    content-type.ts      415 เมื่อ body ผิดชนิด / method-not-allowed.ts 405 + Allow
  types/api.ts           type ของ envelope: ApiSuccess<T> / ApiFailure / PageMeta
  utils/
    api-error.ts         ApiError (notFound, conflict, validation ...) ให้ errorHandler แปลงเป็น JSON
    response.ts          ok() / created() / done() และ buildEnvelope()
    lean.ts              withId(): แปลงผล .lean() ให้ได้ { id, ...rest } แบบเดียวกับ toJSON
    collections.ts       groupBy()
    date-range.ts, pagination.ts, compensation.ts (runUndo), crypto.ts (AES-256-GCM), csv.ts, slip-file.ts ฯลฯ
  seed/                  seed-admin.ts (สร้าง super admin คนแรก ใช้ใน CI/CD) + ensure-admin.ts + admin-seed-rules.ts
```

ทิศทาง dependency คือ `routes → controllers → services → models` service ห้าม import controller และ controller ห้ามแตะ model โดยตรง

### Project structure / layering

```
routes → controllers → services → models (+ types) ──► views
 path      อ่าน input     DB + business     schema +      JSON ของ response
 + auth    → เรียก        rule + เรียก      type lean     (pure function)
           service        view
```

กฎของแต่ละชั้น

- service ไม่สร้าง response JSON เอง: อ่าน/เขียน DB, ตัดสินตาม business rule, ทำ orchestration/compensation แล้วเรียก `toXxxView()` ที่ `return` ครั้งเดียว
- view (`src/views/<aggregate>.view.ts`) เป็น pure function เท่านั้น: รับข้อมูลที่อ่านมาแล้วคืน JSON ไม่เข้าถึง DB ไม่มี side effect ไม่ใช้ `Date.now()` ไม่ import model (ใช้ได้แค่ `import type`) ตั้งชื่อ `toXxxView` / `toXxxViews` และ export type ของ view (`AdminEventView`, `RaceView` ฯลฯ) ลำดับ key ใน object คือส่วนหนึ่งของ contract ห้ามสลับ
- type lean อยู่ติดกับ model: derive จาก schema ด้วย `InferSchemaType` (เช่น `RaceLean` ใน `race.model.ts`) service ห้ามประกาศ type เอกสาร/lean เอง ถ้าอ่านบาง field ให้ใช้ `Pick<XLean, ...>`
- ค่าคงที่อยู่ใน `config/constants.ts` ส่วน helper ที่ใช้ร่วมกันตั้งแต่ 2 service ขึ้นไปให้ไปอยู่ที่ `utils/` หรือ `views/`

เพิ่ม endpoint ใหม่ใน 5 บรรทัด

```
1. validators/thing.validator.ts      export schema + type z.infer
2. views/thing.view.ts                export type ThingView + toThingView(row)  (pure)
3. services/thing.service.ts          อ่าน DB แล้ว return toThingViews(rows)
4. controllers/admin-thing.controller.ts   เรียก service แล้ว ok(res, data, meta)
5. routes/admin.routes.ts             adminRoutes.get("/things", read, validate(...), things.list)
```

## ความต้องการ

- Node.js 22 (มี `engines` ใน package.json)
- Docker + Docker Compose (สำหรับ MongoDB และการ deploy)

## ตัวแปร environment

คัดลอก `.env.example` เป็น `.env` แล้วแก้ค่า (`.env` ถูก ignore ใน git ห้าม commit)

| ตัวแปร | จำเป็น | คำอธิบาย |
|---|---|---|
| `NODE_ENV` | | `development` / `production` / `test` |
| `PORT` | | ค่าเริ่มต้น `4000` |
| `MONGODB_URI` | ✔ | เช่น `mongodb://localhost:27017/running_event` ใช้ standalone ได้ (ถ้าใช้ replica set ก็ใส่ `?replicaSet=...` ได้ตามปกติ แต่ไม่จำเป็น) |
| `JWT_SECRET` | ✔ | อย่างน้อย 32 ตัวอักษร สุ่มเอง |
| `JWT_EXPIRES_IN` | | ค่าเริ่มต้น `8h` |
| `COOKIE_SECURE` | | ว่าง = `true` เมื่อ production ถ้าเทสต์ผ่าน http ล้วนให้ตั้ง `false` |
| `CORS_ORIGINS` | ✔ | origin ของหน้าบ้านและหลังบ้าน คั่นด้วย comma ใช้ทั้ง CORS และตรวจ `Origin` ของ request ที่แก้ไขข้อมูล |
| `ID_ENCRYPTION_KEY` | ✔ | base64 ของ 32 bytes เข้ารหัสเลขบัตรประชาชน (เปลี่ยนภายหลังไม่ได้ ข้อมูลเดิมจะถอดรหัสไม่ได้) |
| `UPLOAD_DIR` | | โฟลเดอร์เก็บสลิป (`slips/`) และรูปงานวิ่ง (`events/`) ค่าเริ่มต้น `./uploads` (ใน docker เป็น volume `/app/uploads` ต้อง persistent) path ต้องไม่มีโฟลเดอร์ที่ขึ้นต้นด้วย `.` |
| `MAX_SLIP_MB` | | ขนาดสลิปสูงสุด ค่าเริ่มต้น 5 |
| `UPLOAD_RATE_MAX` | | จำนวนครั้งอัปโหลดรูปงานวิ่งต่อนาทีต่อผู้ใช้ (admin) ค่าเริ่มต้น 20 |
| `IMAGE_RATE_MAX` | | จำนวนการอ่านไฟล์รูปงานวิ่ง (public) ต่อนาทีต่อ IP ค่าเริ่มต้น 600 |
| `ORDER_EXPIRE_HOURS` | | ออเดอร์ `pending` หมดอายุกี่ชั่วโมง ค่าเริ่มต้น 24 |
| `SHIPPING_FEE` | | ค่าจัดส่งต่อออเดอร์ ค่าเริ่มต้น 50 บาท |
| `BCRYPT_COST` | | ค่าเริ่มต้น 12 |
| `TRUST_PROXY` | | จำนวน reverse proxy ด้านหน้า (ใช้ caddy ตั้ง `1`) เพื่อให้ rate limit เห็น IP จริง |
| `API_DOMAIN` | | โดเมนสำหรับ caddy (profile `proxy`) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` | ใช้ตอน seed | super admin เริ่มต้น รหัสผ่านอย่างน้อย 10 ตัวอักษร ตั้งเอง ไม่มีค่า hardcode |

สุ่มค่าความลับ:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"      # ID_ENCRYPTION_KEY
```

## รันบนเครื่อง (dev)

MongoDB แบบ standalone ใช้ได้เลย ไม่ต้องตั้ง replica set ตั้ง `MONGODB_URI` ให้ชี้ไป MongoDB ที่เข้าถึงได้จากเครื่อง (หรือรันทั้งชุดด้วย Docker Compose ตามหัวข้อถัดไป)

```bash
npm install
cp .env.example .env            # แล้วแก้ JWT_SECRET, ID_ENCRYPTION_KEY, SEED_ADMIN_PASSWORD
npm run seed:admin              # สร้างเฉพาะ super admin คนแรก (ไม่มีข้อมูลตัวอย่าง ต้องสร้าง events ในแอป admin)
npm run dev                     # http://localhost:4000/health
```

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | รัน `src/server.ts` ด้วย tsx แบบ watch (reload เมื่อแก้ไฟล์) |
| `npm run typecheck` | `tsc --noEmit` ตรวจ type ทั้งโปรเจกต์ |
| `npm run build` | compile ไป `dist/` (`tsconfig.build.json`) |
| `npm start` | รัน `dist/server.js` (ต้อง build ก่อน) |
| `npm run seed:admin` | สร้างเฉพาะ super admin คนแรก (ข้ามถ้ามีอยู่แล้ว) ตัวเดียวกับที่ CI/CD รัน |

หมายเหตุ: ระบบไม่มีข้อมูลตัวอย่าง/demo อีกต่อไป ต้องสร้าง events ในแอป admin เอง

ก่อนเปิด PR ให้รัน `npm run typecheck && npm run build` (CI ก็รันสองคำสั่งนี้เหมือนกัน) โปรเจกต์ยังไม่มี test อัตโนมัติ

### MongoDB

ระบบทำงานบน MongoDB standalone ได้ ไม่ใช้ transaction จึงไม่ต้องตั้ง replica set และไม่ต้องแก้ MongoDB บน server

- การจองโควตา/คืนโควตา ใช้ conditional update แบบ atomic ต่อ document แล้วเรียงลำดับเขียน (จองโควตา → สร้างออเดอร์) และลบ/คืนให้เมื่อขั้นตอนหลังล้มเหลว
- ข้อแลกเปลี่ยนที่ยอมรับ: ถ้ามี request พร้อมกันหรือ process ล่มกลางคัน อาจเกิดโควตาค้างหรือจองซ้อนได้ในกรณีที่เกิดยาก
- `docker-compose.yml` มี service `mongo` เป็น standalone ไม่ได้ publish port ถ้าจะรัน `npm run dev` บนเครื่องโดยใช้ mongo ตัวนี้ ให้สร้าง `docker-compose.override.yml` (อย่า commit) แล้ว map `127.0.0.1:27017:27017`
- (ทางเลือก) จะใช้ replica set ก็ได้ ระบบไม่บังคับ
- **ต้องใช้ MongoDB 5.0 ขึ้นไป**: การค้นหาในหน้าจัดส่ง (`GET /admin/shipping?q=`) ใช้ `$lookup` แบบ `localField`/`foreignField` ร่วมกับ `pipeline` และ `$regexMatch` ซึ่งใช้ได้ตั้งแต่ 5.0 (`docker-compose.yml` ใช้ `mongo:7`) ถ้า server จริงเป็นรุ่นเก่ากว่า 5.0 ต้องเปลี่ยน `$lookup` เป็นแบบ `let` + `$expr`

## รันด้วย Docker Compose

```bash
cp .env.example .env            # แก้ค่าที่จำเป็น, CORS_ORIGINS ให้ตรงกับหน้าบ้าน
docker compose build
docker compose up -d            # mongo (standalone) + api
docker compose run --rm api node dist/seed/seed-admin.js     # สร้าง super admin คนแรก
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
   docker compose -f docker-compose.prod.yml run --rm api node dist/seed/seed-admin.js
   ```
   รอบถัดไป workflow จะรัน `up -d` ให้ (service caddy ที่เปิดด้วย `--profile proxy` จะยังคงอยู่ ถ้าต้องการให้ workflow จัดการ caddy ด้วย ให้ตั้ง `COMPOSE_PROFILES=proxy` ใน `.env` บน server)

### ตัวแปรใน `.env` บน server

| ตัวแปร | ค่า |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | สุ่มอย่างน้อย 32 ตัวอักษร |
| `ID_ENCRYPTION_KEY` | base64 ของ 32 bytes (เปลี่ยนภายหลังไม่ได้) |
| `CORS_ORIGINS` | origin ของหน้าบ้านและหลังบ้าน คั่นด้วย comma (ใช้ `https://`) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | super admin ที่ CI/CD สร้างให้ (seed-admin, รหัสผ่านอย่างน้อย 10 ตัวอักษร) |
| `API_DOMAIN` | โดเมนของ API ที่ DNS ชี้มาที่ server (ใช้โดย caddy) |
| `TRUST_PROXY` | `1` เมื่ออยู่หลัง caddy (`docker-compose.prod.yml` ใช้ `1` เป็นค่าเริ่มต้นอยู่แล้ว ตั้ง `0` ถ้าไม่ใช้ caddy) |

### CI/CD seed เฉพาะ super admin

หลัง deploy และ healthcheck ผ่าน workflow จะรัน `node dist/seed/seed-admin.js` ใน container (อ่าน `SEED_ADMIN_*` จาก `.env` บน server ผ่าน `env_file` ไม่ต้องเพิ่ม GitHub secret) สคริปต์นี้สร้างเฉพาะ super admin คนแรกเท่านั้น ไม่สร้าง events/orders/payments/mock users (ระบบไม่มีข้อมูลตัวอย่างอีกต่อไป ต้องสร้าง events ในแอป admin)

กติกา (รันซ้ำได้ ไม่แก้ข้อมูลเดิม):
- ไม่ตั้ง `SEED_ADMIN_EMAIL` หรือ `SEED_ADMIN_PASSWORD` → ข้าม (exit 0)
- config ไม่ถูกต้อง (email ผิดรูปแบบ, รหัสผ่านสั้นกว่า 10 ตัว) → error (exit 1) โดยไม่แสดงรหัสผ่าน
- มี user อีเมลนี้อยู่แล้ว → ข้าม ไม่แก้รหัสผ่าน/ชื่อ/role และไม่เปิดใช้งานใหม่
- ไม่มีอีเมลนี้ แต่มี super admin ที่ active อยู่แล้ว → ข้าม (กันไม่ให้บัญชีเริ่มต้นกลับมาหลังลบ/เปลี่ยนอีเมล admin เดิม)
- นอกนั้นสร้าง super admin (`mustChangePassword: true` ต้องเปลี่ยนรหัสผ่านหลัง login ครั้งแรก) รันพร้อมกันสองครั้งปลอดภัยเพราะอาศัย unique index ของอีเมล

ถ้าสคริปต์ล้มเหลว workflow แค่แสดง `WARNING: seed-admin failed (deploy continues)` และ deploy ยังสำเร็จ

ตั้งใน `.env` บน server (`SEED_ADMIN_NAME` ไม่บังคับ ค่าเริ่มต้น `Super Admin`) แนะนำให้เปลี่ยนรหัสผ่านหลัง login ครั้งแรก แล้วลบ `SEED_ADMIN_PASSWORD` ออกจาก `.env` ภายหลัง

รันเองด้วยมือ:

```bash
docker compose -f docker-compose.prod.yml exec api node dist/seed/seed-admin.js
```

`MONGODB_URI`, `PORT` และ `UPLOAD_DIR` ถูกกำหนดใน `docker-compose.prod.yml` อยู่แล้ว ข้อมูล mongo และสลิปเก็บใน volume `mongo_data` และ `uploads`

## เพิ่ม endpoint / module ใหม่

ตัวอย่างนี้เพิ่ม `GET /api/v1/admin/things` (แอดมินทุก role อ่านได้) ใช้ลำดับ model → validator → view → service → controller → route

1. Model (`src/models/thing.model.ts`) แล้ว export จาก `src/models/index.ts` และเพิ่มเข้าไปใน `syncAllIndexes`

   ```ts
   import { Schema, model, type InferSchemaType, type Types } from "mongoose";
   import { cleanJson } from "./plugins";
   const thingSchema = new Schema(
     { eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true }, name: { type: String, required: true, trim: true } },
     { timestamps: true },
   );
   cleanJson(thingSchema); // toJSON: _id → id, ตัด __v
   export type ThingDoc = InferSchemaType<typeof thingSchema>;
   export type ThingLean = ThingDoc & { _id: Types.ObjectId };
   export const Thing = model("Thing", thingSchema);
   ```
   ดู `race.model.ts` เป็นตัวอย่าง (plugin `cleanJson`, index, `RaceLean`)

2. Validator (`src/validators/admin.validator.ts` หรือไฟล์ใหม่) ให้ export ทั้ง schema และ type ทุกครั้ง

   ```ts
   export const thingsQuery = pageQuery.extend({ eventId: optObjectId });
   export type ThingsQuery = z.infer<typeof thingsQuery>;
   ```

3. View (`src/views/thing.view.ts`) แปลงเอกสารเป็น JSON ของ response เป็น pure function ไม่แตะ DB

   ```ts
   export type ThingView = { id: string } & Omit<ThingLean, "_id">;
   export const toThingView = (t: ThingLean): ThingView => withId(t);
   export const toThingViews = (rows: readonly ThingLean[]): ThingView[] => rows.map((r) => toThingView(r));
   ```
   - ถ้าใช้ `.lean()` ให้แปลงด้วย `withId()` (ภายใน view) เสมอ เพื่อให้ response ได้ `id` แทน `_id` เหมือน endpoint อื่น

4. Service (`src/services/thing.service.ts`) ใส่ business logic ทั้งหมดไว้ที่นี่ รับ type จาก validator ถ้าไม่เจอข้อมูลหรือข้อมูลผิด ให้ throw `ApiError` (ไม่ต้องจัดการ `res`) และห้ามสร้าง response JSON เอง ให้เรียก view

   ```ts
   export async function list(q: ThingsQuery): Promise<{ data: ThingView[]; meta: PageMeta }> {
     const filter = q.eventId ? { eventId: q.eventId } : {};
     const [rows, total] = await Promise.all([
       Thing.find(filter).sort({ createdAt: -1 }).skip(skipOf(q)).limit(q.pageSize).lean(),
       Thing.countDocuments(filter),
     ]);
     return { data: toThingViews(rows), meta: pageMeta(q, total) };
   }
   ```
    - ห้ามใช้ transaction (production เป็น MongoDB standalone) ถ้าเขียนหลาย collection ให้เรียงลำดับเขียน ใช้ conditional update แบบ atomic ต่อ document และทำ compensating cleanup เมื่อขั้นตอนหลังล้มเหลว (ดู `utils/compensation.ts`, `services/order/order-create.service.ts`)
   - ค่าคงที่ใหม่ (limit, status, ข้อความที่ใช้ซ้ำ) ให้ไปใส่ใน `config/constants.ts`
   - list แบบแบ่งหน้าใช้ `pageQuery` + `skipOf`/`pageMeta` (`utils/pagination.ts`) เพื่อให้ `meta` มีรูปแบบเดียวกันทุก endpoint

5. Controller (`src/controllers/admin-thing.controller.ts`) ให้บางที่สุด อ่าน input ที่ผ่าน validate แล้ว → เรียก service → ส่ง `ok()`/`created()`

   ```ts
   export async function list(_req: Request, res: Response) {
     const { data, meta } = await thingService.list(validatedQuery<ThingsQuery>(res));
     ok(res, data, meta);
   }
   ```
   Express 5 ส่ง promise ที่ reject ต่อให้ `errorHandler` เอง ไม่ต้องใส่ try/catch
   `T` ของ `validatedParams/Query/Body<T>()` ต้องเป็น type `z.infer` ของ schema ที่ใส่ใน `validate()` ของ route นั้น (helper นี้เป็นแค่ cast ถ้าเปลี่ยน schema ต้องเปลี่ยน `T` ด้วย)

6. Route (`src/routes/admin.routes.ts`) ใส่สิทธิ์และ validate ที่นี่

   ```ts
   adminRoutes.get("/things", read, validate({ query: v.thingsQuery }), things.list);
   ```
   ใช้ `read` (ทุก role), `write` (super_admin + reviewer) หรือ `requireRole(...SUPER_ONLY)` route ฝั่ง admin ที่ประกาศหลัง `adminRoutes.use(requireAuth)` ต้องล็อกอินก่อนทุกตัว ถ้าเป็น module ใหม่ทั้งชุดให้สร้าง router แยกแล้ว mount ใน `routes/index.ts`

7. รัน `npm run typecheck && npm run build && npm test` แล้วเพิ่ม endpoint ใหม่ลงในตาราง Endpoints ด้านล่าง

ถ้า service ไฟล์ไหนใหญ่จนรวมหลายหน้าที่ ให้แยกแบบ `services/order/` หรือ `services/event/` แล้วเหลือไฟล์เดิมไว้เป็น barrel เพื่อจะได้ไม่ต้องแก้ import ใน controller

## รูปแบบ response

ทุก response ที่เป็น JSON ถูกห่อด้วย envelope เดียวกัน (เพิ่ม `statusCode`, `success`, `message` นำหน้า key เดิม ไม่ลบ/เปลี่ยนชื่อ key เดิม) ทำที่ศูนย์กลางใน `middlewares/response-envelope.ts` ไม่ต้องแก้ controller
type ฝั่ง TypeScript อยู่ที่ `src/types/api.ts` (`ApiSuccess<T>`, `ApiFailure`)

`message` ของ response สำเร็จเป็นข้อความไทยตาม status จากตารางเดียว (`STATUS_MESSAGE` ใน `config/constants.ts`) เช่น 200 `สำเร็จ`, 201 `สร้างสำเร็จ` ส่วน response ผิดพลาด `message` เท่ากับ `error.message`

สำเร็จ (200):

```json
{
  "statusCode": 200,
  "success": true,
  "message": "สำเร็จ",
  "data": {
    "name": "Super Admin",
    "email": "admin@example.com",
    "role": "super_admin",
    "active": true,
    "createdAt": "2026-10-17T12:11:16.687Z",
    "updatedAt": "2026-10-17T12:11:40.785Z",
    "lastLoginAt": "2026-10-17T12:11:40.741Z",
    "id": "6ad365e450b60c80aa3103bf"
  }
}
```

รายการแบบแบ่งหน้า (200) `meta` อยู่ระดับเดียวกับ `data`:

```json
{
  "statusCode": 200,
  "success": true,
  "message": "สำเร็จ",
  "data": [ { "id": "..." } ],
  "meta": { "page": 1, "pageSize": 20, "total": 3, "totalPages": 1 }
}
```

ผิดพลาด (422) object `error` เหมือนเดิมทุกประการ:

```json
{
  "statusCode": 422,
  "success": false,
  "message": "ข้อมูลไม่ถูกต้อง",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "ข้อมูลไม่ถูกต้อง",
    "fields": { "email": "รูปแบบอีเมลไม่ถูกต้อง" }
  }
}
```

ข้อยกเว้น:
- CSV export (`text/csv`) และไฟล์สลิป (`image/*`) ส่งเป็นไฟล์ดิบ ไม่มี envelope
- 304 (conditional GET ผ่าน ETag) ไม่มี body
- `GET /health` ตอบ envelope เช่นกัน เมื่อ DB ไม่พร้อมจะเป็น 503 `success:false` และ `data.status = "unavailable"` (ไม่มี object `error`)
- logout และ change-password ตอบ 200 พร้อม `data: null` (เดิม 204 ไม่มี body)
- ถ้า body เดิมมี key ระดับบนชื่อ `statusCode`/`success`/`message` อยู่แล้ว จะถูกซ้อนไว้ใต้ `data` แทนการทับ

### HTTP status codes

| Status | ใช้เมื่อ | ตัวอย่าง `error.code` |
|---|---|---|
| 200 | อ่าน/แก้ไข/ดำเนินการสำเร็จ (รวม login, logout, อัปโหลดสลิป) | - |
| 201 | สร้างสำเร็จ (งาน + `Location`, ออเดอร์, ผู้ใช้, รูปงานวิ่ง) | - |
| 400 | input อ่านไม่ได้: JSON เสีย, id/slug/orderNo ใน URL ผิดรูปแบบ, multipart เสีย, Mongoose CastError | `INVALID_JSON`, `INVALID_PARAM`, `UPLOAD_ERROR`, `BAD_REQUEST` |
| 401 | ยังไม่ล็อกอิน / token หมดอายุหรือไม่ถูกต้อง / รหัสผ่านผิด | `UNAUTHORIZED`, `INVALID_CREDENTIALS` |
| 403 | role ไม่พอ หรือ Origin ไม่อยู่ใน `CORS_ORIGINS` (เฉพาะ method ที่แก้ข้อมูล) | `FORBIDDEN` |
| 404 | ไม่พบข้อมูลหรือไม่พบ route | `NOT_FOUND`, `EVENT_NOT_FOUND`, `ORDER_NOT_FOUND`, `IMAGE_NOT_FOUND` |
| 405 | path มีอยู่แต่ไม่รองรับ method (มี header `Allow`) | `METHOD_NOT_ALLOWED` |
| 409 | ขัดแย้งกับสถานะปัจจุบัน: ข้อมูลซ้ำ, state ไม่ถูกต้อง, โควตาเต็ม, งานมีออเดอร์แล้ว | `SLUG_TAKEN`, `EMAIL_TAKEN`, `DUPLICATE_TRANSACTION_REF`, `INVALID_STATE`, `QUOTA_FULL`, `EVENT_HAS_ORDERS`, `IMAGE_ORDER_STALE` |
| 413 | body JSON เกิน 100kb, ไฟล์สลิปเกิน `MAX_SLIP_MB` หรือรูปงานวิ่งเกิน 5 MB | `PAYLOAD_TOO_LARGE`, `FILE_TOO_LARGE` |
| 415 | Content-Type ไม่ตรง (ต้อง JSON / multipart) หรือไฟล์สลิป/รูปงานวิ่งไม่ใช่ JPG, PNG, WEBP | `UNSUPPORTED_MEDIA_TYPE`, `UNSUPPORTED_FILE_TYPE` |
| 422 | Zod / Mongoose validation ไม่ผ่าน (มี `fields`) รวม query string, อัปโหลดรูปเกิน 10 ไฟล์/ครั้ง หรืองานมีรูปครบ 30 | `VALIDATION_ERROR`, `TOO_MANY_FILES`, `IMAGE_LIMIT_REACHED` |
| 429 | เกิน rate limit (มี header `Retry-After`) | `RATE_LIMITED` |
| 500 | error ที่ไม่คาดคิด (ข้อความทั่วไป ไม่เปิดเผย stack) | `INTERNAL_ERROR` |
| 503 | MongoDB ไม่พร้อม/timeout (มี `Retry-After: 5`) และ `/health` ตอน DB ล่ม | `SERVICE_UNAVAILABLE` |

ไม่ใช้ 410 และไม่มี redirect (3xx) ค่า status ทั้งหมดอยู่ใน `HTTP_STATUS` ที่ `config/constants.ts`

หมายเหตุการเปลี่ยนแปลง: id/slug/orderNo ใน URL ที่ผิดรูปแบบเปลี่ยนจาก 404 เป็น 400 `INVALID_PARAM`, request ที่ส่ง body ผิด Content-Type ได้ 415 แทน 422, และ logout/change-password เปลี่ยนจาก 204 เป็น 200

### Fields และรหัสอื่น ๆ

- `fields` ใช้คีย์เดียวกับ `FieldErrors` ของหน้าบ้าน (`firstName`, `birthDate`, `phone`, `identity`, `race`, `size` ...)
  โดยออเดอร์ใช้ `participants.<index>.<field>` และ `delivery.<field>`
- รหัสที่พบบ่อย: `VALIDATION_ERROR` 422, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404,
  `QUOTA_FULL` / `INVALID_STATE` / `SLUG_TAKEN` / `EVENT_HAS_ORDERS` / `DUPLICATE_TRANSACTION_REF` / `DUPLICATE_BIB` / `LAST_SUPER_ADMIN` 409,
  `UNSUPPORTED_FILE_TYPE` 415, `FILE_TOO_LARGE` 413, `RATE_LIMITED` 429

### รหัส error ของส่วนแอดมิน

| Status | `error.code` | เมื่อ |
|---|---|---|
| 403 | `FORBIDDEN` | reviewer ลบบันทึกของคนอื่น หรือ role ไม่พอ |
| 404 | `NOTE_NOT_FOUND`, `USER_NOT_FOUND` | ไม่พบบันทึก/ผู้ใช้ |
| 409 | `EVENT_HAS_ORDERS` | ลบงานถาวรไม่ได้เพราะมีออเดอร์ (ให้เก็บถาวรแทน) |
| 409 | `EVENT_QUOTA_RESERVED` | ลบงานไม่ได้เพราะมีโควตาถูกจองค้าง |
| 409 | `USER_HAS_HISTORY` | ลบผู้ใช้ไม่ได้เพราะมีประวัติ (audit, ตรวจสลิป, บันทึกออเดอร์) |
| 409 | `USER_STILL_ACTIVE` | ต้องปิดใช้งานผู้ใช้ก่อนลบ |
| 409 | `CANNOT_DELETE_SELF`, `CANNOT_MODIFY_SELF` | ลบ/ปิดใช้งาน/เปลี่ยนบทบาทบัญชีตัวเองไม่ได้ |
| 422 | `NOTE_LIMIT_REACHED` | ออเดอร์มีบันทึกครบ 100 รายการ |

## Endpoints (prefix `/api/v1`)

สิทธิ์: S = super_admin, R = reviewer, V = viewer

### Public

| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/health` (และ `/api/v1/health`) | ตรวจสถานะ + DB |
| GET | `/public/events` | รายการงาน (ไม่รวม draft) filter: `q, province, month (YYYY-MM), distance, category, status` มี `remaining` ต่อระยะ และ `images` |
| GET | `/public/events/:slug` | รายละเอียดงาน (มี `images`) |
| GET | `/public/event-images/:imageId` | ไฟล์รูปงานวิ่ง ไม่ต้องล็อกอิน เฉพาะงานที่ไม่ใช่ draft ส่งไบต์ตรง ๆ ไม่ห่อ envelope: `Content-Type` ตามที่เก็บ, `X-Content-Type-Options: nosniff`, `Cache-Control: public, max-age=31536000, immutable` (draft/ไม่พบ → 404 `IMAGE_NOT_FOUND`) |
| POST | `/public/events/:slug/orders` | สร้างออเดอร์ `{participants[], delivery}` เซิร์ฟเวอร์คำนวณยอดเอง ได้ `orderNo`, `amount`, `expiresAt` |
| GET | `/public/orders/:orderNo?phoneLast4=1234` | ตรวจสถานะออเดอร์ (ไม่มีข้อมูลส่วนบุคคลใน response) |
| POST | `/public/orders/:orderNo/slip` | อัปโหลดสลิป `multipart/form-data` field `slip` + `phoneLast4` (jpg/png/webp ≤ 5MB ตรวจ magic bytes) |

### Admin (ต้องล็อกอิน ยกเว้น login)

| Method | Path | สิทธิ์ | คำอธิบาย |
|---|---|---|---|
| POST | `/admin/auth/login` | - | ตั้ง cookie `rr_admin_token` (httpOnly) จำกัดจำนวนครั้งต่อ IP+email |
| POST | `/admin/auth/logout` | ทุก role | ล้าง cookie (200 พร้อม envelope, `data: null`) |
| GET | `/admin/auth/me` | ทุก role | ข้อมูลผู้ใช้ปัจจุบัน |
| POST | `/admin/auth/change-password` | ทุก role | เปลี่ยนรหัสผ่าน (≥ 10 ตัวอักษร) 200 พร้อม envelope, `data: null` |
| GET | `/admin/events`, `/admin/events/:id` | S R V | รายการ/รายละเอียดงาน พร้อม `orderCount` list รับ `archived=true\|false` (ค่าเริ่มต้น false) ส่วน `:id` เปิดดูงานที่เก็บถาวรได้ `category`/`theme` มีใน response เสมอ (ค่าเริ่มต้น `road` / `orange`) |
| POST | `/admin/events/:id/archive`, `/admin/events/:id/restore` | S | เก็บถาวร/กู้คืนงาน (ซ้ำได้ ไม่เกิดผลเพิ่ม) |
| DELETE | `/admin/events/:id` | S | ลบงานถาวรพร้อมระยะและไฟล์รูป ตอบ 200 `data: null` (409 `EVENT_HAS_ORDERS` ถ้ามีออเดอร์ใด ๆ, 409 `EVENT_QUOTA_RESERVED` ถ้ามีโควตาถูกจองค้าง) |
| POST | `/admin/events` | S | สร้างงาน + ระยะ ตอบ 201 + header `Location` (409 `SLUG_TAKEN` ถ้า slug ซ้ำ) |
| PUT | `/admin/events/:id` | S | แก้งาน (409 `EVENT_HAS_ORDERS` ถ้าแก้ราคา/โควตา/ลบ/เปลี่ยนชื่อระยะหลังมีออเดอร์) ส่ง `null` เพื่อล้าง `registrationEnds` และ `races[].start` ส่วน `category`/`theme` เป็น `null` จะกลับเป็นค่าเริ่มต้น |
| GET | `/admin/orders`, `/admin/orders/:id` | S R V | filter: `eventId, status, q, from, to, page, pageSize` รายละเอียดมี `reviewedByName`, `canEditAddress`, `notes`, `timeline` เพิ่มท้าย |
| POST | `/admin/orders/:id/cancel` | S R | ยกเลิก (คืนโควตา) |
| PATCH | `/admin/orders/:id/tracking` | S R | เลขพัสดุ (เฉพาะออเดอร์จัดส่งที่ชำระแล้ว) |
| PATCH | `/admin/orders/:id/address` | S R | แก้ที่อยู่จัดส่ง (เฉพาะออเดอร์จัดส่งสถานะ pending / slip_uploaded / rejected / paid ที่ยังไม่มีเลขพัสดุ; 409 `INVALID_STATE`, 422 `fields`) |
| POST | `/admin/orders/:id/notes` | S R | `{ text }` 1-1000 ตัวอักษร บันทึกภายใน ตอบ 201 รายละเอียดออเดอร์ (422 `NOTE_LIMIT_REACHED` เมื่อครบ 100 รายการ) |
| DELETE | `/admin/orders/:id/notes/:noteId` | S R | ลบบันทึก: super_admin ลบได้ทุกอัน reviewer ลบได้เฉพาะของตัวเอง (403, 404 `NOTE_NOT_FOUND`) |
| GET | `/admin/slips?tab=waiting\|history&eventId=` | S R V | คิวสลิป (รอตรวจ เก่าสุดก่อน / ประวัติ) |
| GET | `/admin/payments/:id/slip` | S R V | ไฟล์สลิป (ต้องมี cookie) |
| POST | `/admin/orders/:id/approve` | S R | `{ transactionRef }` เลขอ้างอิงห้ามซ้ำกับออเดอร์ที่ชำระแล้ว |
| POST | `/admin/orders/:id/reject` | S R | `{ reason }` จำเป็น |
| GET | `/admin/participants` | S R V | filter: `eventId, q, race, status` เลขบัตรแสดงแบบ mask |
| PATCH | `/admin/participants/:id` | S R | `{ collected?, bibNo? }` (BIB ไม่ซ้ำภายในงาน ตั้งได้เฉพาะออเดอร์ที่ชำระแล้ว) |
| GET | `/admin/shipping?method=pickup\|shipping&q=` | S R V | รายการจัดส่ง/รับของ (ออเดอร์ที่ชำระแล้ว) `q` ค้นหาทุกหน้าจากชื่อผู้สมัคร เลข BIB เลขออเดอร์ ชื่อ/เบอร์ผู้ติดต่อ หรือเลขพัสดุ (ต้องใช้ MongoDB 5.0+) |
| GET | `/admin/dashboard?eventId=` | S R V | สรุปจำนวนออเดอร์ รายได้ (เฉพาะ paid) โควตาแต่ละระยะ |
| GET | `/admin/reports/summary`, `/admin/reports/shirt-sizes` | S R V | รายงานสรุป / ไซส์เสื้อ (`status` เริ่มต้น `paid`) |
| GET | `/admin/export/orders.csv`, `participants.csv`, `fulfillment.csv` | S R V | CSV UTF-8 BOM ป้องกัน formula injection (ไม่มีเลขบัตรเต็ม) `fulfillment.csv` รับ `q` เหมือนหน้าจัดส่ง |
| GET | `/admin/export/overview.csv?eventId=`, `/admin/export/shirt-sizes.csv?eventId=&status=` | S R V | CSV ภาพรวม (ค่าเดียวกับ dashboard) / จำนวนเสื้อตามไซส์ |
| GET | `/admin/audit-logs` | S | ประวัติการใช้งาน ใหม่สุดก่อน filter: `userId, action, entity, entityId, from, to, page, pageSize` |
| GET | `/admin/events/:id/images` | S R V | รายการรูปของงาน (เรียงตาม `sortOrder`) |
| POST | `/admin/events/:id/images` | S | อัปโหลดรูป `multipart/form-data`: `files` (1-10 ไฟล์) + `kind` + `alt` (ไม่บังคับ) ตอบ 201 `data: Image[]` (400 `UPLOAD_ERROR`, 404 `EVENT_NOT_FOUND`, 413 `FILE_TOO_LARGE`, 415 `UNSUPPORTED_FILE_TYPE`, 422 `TOO_MANY_FILES` / `IMAGE_LIMIT_REACHED` / `VALIDATION_ERROR`) |
| PUT | `/admin/events/:id/images/order` | S | จัดลำดับใหม่ `{ ids: [...] }` ต้องครบทุกรูปของงาน (400, 401, 403, 404 `EVENT_NOT_FOUND`, 409 `IMAGE_ORDER_STALE`, 422) |
| PATCH | `/admin/events/:id/images/:imageId` | S | แก้ `{ kind?, alt?, sortOrder? }` |
| DELETE | `/admin/events/:id/images/:imageId` | S | ลบรูปและไฟล์ในดิสก์ ตอบ 200 `data: null` (ไฟล์หายไปแล้วก็ยังตอบ 200) |
| GET | `/admin/events/:id/images/:imageId/file` | S R V | ไฟล์รูปสำหรับพรีวิวหลังบ้าน (ดูรูปของงาน draft ได้) ต้องมี cookie |
| GET/POST/PATCH | `/admin/users`, `/admin/users/:id` | S | จัดการผู้ใช้ (ห้ามลดสิทธิ์/ปิดใช้งาน super_admin คนสุดท้าย) แก้ `email` ได้ (409 `EMAIL_TAKEN`) ผู้ใช้ใหม่/ถูกรีเซ็ตรหัสผ่านจะมี `mustChangePassword: true` ห้ามแก้บทบาท/ปิดใช้งานตัวเอง (409 `CANNOT_MODIFY_SELF`) |
| DELETE | `/admin/users/:id` | S | ลบผู้ใช้ถาวร ต้องปิดใช้งานแล้วและไม่มีประวัติอ้างอิง ตอบ 200 `data: null` (409 `CANNOT_DELETE_SELF`, `USER_STILL_ACTIVE`, `USER_HAS_HISTORY`, `INVALID_STATE`) |

### รูปภาพงานวิ่ง (Event images)

งานหนึ่งมีรูปได้หลายรูป เก็บเป็น subdocument `images` ใน `Event` (ค่าเริ่มต้น `[]` งานเดิมไม่ต้อง migrate) และ `PUT /admin/events/:id` ไม่แตะ `images` เลย

- ประเภทรูป (`kind`): `cover`, `poster`, `gallery`, `route_map`, `shirt`, `medal`, `sponsor`, `other` (กำหนดที่เดียวใน `config/constants.ts` → `eventImageKinds`)
- ข้อจำกัด: ไฟล์ละไม่เกิน 5 MB, ไม่เกิน 10 ไฟล์ต่อ request, ไม่เกิน 30 รูปต่องาน, `alt` ไม่เกิน 200 ตัวอักษร
- ชนิดไฟล์: JPG, PNG, WEBP เท่านั้น ตรวจจาก magic bytes (ไม่เชื่อนามสกุล/mime ที่ client ส่ง) ไม่รับ SVG/GIF
- การเก็บไฟล์: `UPLOAD_DIR/events/<eventId>/<uuid>.<ext>` ชื่อไฟล์สร้างโดย server (ไม่ใช้ชื่อไฟล์จาก client) mode `0640`
- ตรวจขนาด/จำนวนระหว่างรับ multipart (multer memory storage) และตรวจ magic bytes ครบทุกไฟล์ก่อนเขียนดิสก์ ถ้ามีไฟล์ใดไม่ผ่านจะไม่เขียนไฟล์ใดเลย ถ้าเขียนไฟล์/บันทึก DB พลาดจะลบไฟล์ที่เขียนไปแล้ว
- ลำดับ middleware ของ upload: origin → login → role `super_admin` → ตรวจ `:id` → rate limit (`UPLOAD_RATE_MAX`) → Content-Type multipart → multer
- route ไฟล์ public ค้นจาก image id ใน DB แล้วประกอบ path จาก `_id` ของงาน + ชื่อไฟล์ที่เก็บ จึงไม่มีทาง path traversal และไม่เปิดสลิปหรือไฟล์อื่น

`images` อยู่ใน `GET /public/events`, `GET /public/events/:slug` และ `GET /admin/events[/:id]` เป็น key สุดท้าย เรียงตาม `sortOrder` (key เดิมไม่เปลี่ยน):

```json
{ "images": [{ "id": "6ad3...a1", "kind": "cover", "alt": "ปก", "url": "/api/v1/public/event-images/6ad3...a1", "sortOrder": 0 }] }
```

`url` เป็น path สัมพัทธ์กับ API (ใช้ `API_ORIGIN + url`) ฝั่ง admin แต่ละรูปมี `previewUrl`, `mime`, `size`, `createdAt` เพิ่ม

> **Volume `uploads` ต้อง persistent และต้องสำรองข้อมูล** รูปงานวิ่งอยู่ในโฟลเดอร์เดียวกับสลิป (`events/` และ `slips/`) ถ้า volume หาย รูปและสลิปจะหาย และ DB จะชี้ไปยังไฟล์ที่ไม่มีอยู่ (ตอบ 404 `IMAGE_NOT_FOUND`) `docker-compose.prod.yml` mount volume `uploads` ที่ `/app/uploads` อยู่แล้ว ห้ามเปลี่ยนเป็น mount ชั่วคราว

ทดสอบ: `npm test` (vitest unit tests) และโฟลเดอร์ **Event images** ใน Postman collection

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
- จองโควตาแบบ atomic ต่อ race: `findOneAndUpdate` เงื่อนไข `reserved + n <= quota` (ไม่มี transaction) จองโควตาก่อนสร้างออเดอร์ และคืนโควตา/ลบข้อมูลเมื่อขั้นตอนหลังล้มเหลว ยกเลิก/หมดอายุคืนโควตาครั้งเดียวด้วย `quotaReleased`

## ความปลอดภัย

- เลขบัตรประชาชนเข้ารหัส AES-256-GCM และแสดงแบบ mask (`*********1234`) ใน admin; ไม่อยู่ใน CSV; ผู้สมัครที่เลือกไม่ให้ข้อมูลจะไม่ถูกเก็บ
- สลิปตรวจ magic bytes (ไม่เชื่อ mime/นามสกุลจาก client) ตั้งชื่อไฟล์ฝั่งเซิร์ฟเวอร์ เสิร์ฟเฉพาะผ่าน endpoint แอดมิน
- cookie: httpOnly, SameSite=Lax, Secure เมื่อ production; request ที่แก้ไขข้อมูลจาก browser ต้องมี `Origin` ตรงกับ `CORS_ORIGINS`
- ไม่ commit `.env`; อย่าเก็บรหัสผ่าน/คีย์ใน repo; ควรเปลี่ยนรหัสผ่าน super admin หลัง seed
- หน้าบ้านที่เรียกด้วย cookie ต้องใช้ `credentials: "include"` และโดเมนต้องอยู่ใน `CORS_ORIGINS`


### วันเปิดรับสมัคร
Event create/update accepts optional registrationStarts as YYYY-MM-DD (Bangkok calendar date). Omitted on update preserves the stored date; null clears it. Opening must be on/before the event date and closing date when supplied. Public/admin event responses include it when set. Order creation before this date returns HTTP 409 REGISTRATION_NOT_OPEN, even if status is open. Existing events without the field retain prior behavior; this field does not automatically publish a draft or change status.


### Per-race prizes
Event create/update accepts races[].prizes: an optional list of {rank, amount}. Rank is an integer 1–100, unique within its race; amount is a nonnegative integer in THB. Ranks may repeat across different distances. Omitted prizes preserve an existing schedule on update; [] clears it. Returned event races include nonempty prizes sorted by rank. These are prize schedules, not recorded finisher results, and do not change registration prices or quotas.


### Start point
Event create/update accepts optional startPoint (trimmed text, maximum 300 characters). Omitted on update preserves the stored value; an empty string clears it. Public/admin event responses include the value when stored. This is the physical start location within the venue, separate from each race start time.


Each prize also accepts trophy (optional boolean). true means this rank receives a trophy; false or an omitted value means no trophy. Event views return the trophy choice, defaulting older prizes to false. A trophy-only reward can use amount: 0.


### Organizer contact phones
Event create/update accepts optional contactPhones: up to 10 unique phone strings. Spaces, parentheses and hyphens are stripped; normalized numbers must have 7–15 digits with an optional leading +. Omitted on update preserves stored numbers; [] clears them. These are public organizer contact numbers included in event views, separate from private participant contacts.


### Organizer links
Event create/update supports optional websiteUrl (event information) and locationUrl (custom venue/map link), each maximum 2048 characters and absolute http/https only. Omitted on update preserves stored values; empty string clears them. The platform uses locationUrl when supplied, otherwise Google Maps search from the venue. websiteUrl is presented separately from the event description.


### Per-distance inclusions
Each race accepts optional benefits (up to 20 unique nonempty trimmed strings, each max 100 characters) and extraDetails (trimmed text, max 2000 characters). Omitted fields preserve stored data on update; [] and empty string clear them. Nonempty values are returned in public/admin race views and displayed on the platform under race fees. Race compensation restores both fields if an event update fails.


Event create/update also accepts optional `shirtPickupPoint` (trimmed text, maximum 300 characters). Omitted updates preserve the stored value; an empty string clears it. Public/admin event responses include this shirt collection location.

Optional `shirtPickupUrl` accepts an HTTP(S) map link up to 2048 characters. Omitted updates preserve it; an empty string clears it. The platform opens this link, or searches Google Maps using the pickup point and venue when absent.

Race capacity: optional `unlimitedQuota: true` bypasses the capacity limit while still counting and releasing reservations. `quota` remains a positive integer for backward compatibility (admin sends 1 when unlimited); ignore quota/remaining as capacity limits when the flag is true. Responses include `unlimitedQuota: true` and the actual `reserved` count for unlimited races. Omitted updates preserve the previous mode; false restores the supplied finite quota. Capacity changes retain the existing restriction against changes after active orders exist.
