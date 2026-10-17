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
    order-state.ts       state machine ของสถานะออเดอร์
    event / review / slip / participant / shipping / dashboard / report / export / user / auth / audit / expiry
  models/                Mongoose schema + index + type lean (เช่น RaceLean), index.ts รวม export ทุก model
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
    date-range.ts, pagination.ts, transaction.ts (withTransaction), crypto.ts (AES-256-GCM), csv.ts, slip-file.ts ฯลฯ
  seed/                  seed.ts + seed-data.ts
```

ทิศทาง dependency คือ `routes → controllers → services → models` service ห้าม import controller และ controller ห้ามแตะ model โดยตรง

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

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | รัน `src/server.ts` ด้วย tsx แบบ watch (reload เมื่อแก้ไฟล์) |
| `npm run typecheck` | `tsc --noEmit` ตรวจ type ทั้งโปรเจกต์ |
| `npm run build` | compile ไป `dist/` (`tsconfig.build.json`) |
| `npm start` | รัน `dist/server.js` (ต้อง build ก่อน) |
| `npm run seed` | สร้าง/อัปเดต super admin และข้อมูลตัวอย่าง (รันซ้ำได้) |

ก่อนเปิด PR ให้รัน `npm run typecheck && npm run build` (CI ก็รันสองคำสั่งนี้เหมือนกัน) โปรเจกต์ยังไม่มี test อัตโนมัติ

### ใช้ MongoDB จาก docker-compose ตอน dev

`docker-compose.yml` มี service `mongo` เป็น single-node replica set `rs0` (healthcheck สั่ง `rs.initiate` ให้เอง) แต่ไม่ได้ publish port ออกมาที่ host ถ้าจะรัน `npm run dev` บนเครื่องโดยใช้ mongo ตัวนี้ ให้สร้างไฟล์ `docker-compose.override.yml` บนเครื่องตัวเอง (อย่า commit):

```yaml
services:
  mongo:
    ports:
      - "127.0.0.1:27017:27017"
```

```bash
docker compose up -d mongo      # รอจน docker compose ps ขึ้น healthy
```

แล้วตั้ง `.env` เป็น `MONGODB_URI=mongodb://localhost:27017/running_event?directConnection=true`
(member ของ replica set ลงทะเบียนไว้เป็น `mongo:27017` ซึ่ง host หาไม่เจอ ถ้าใช้ `?replicaSet=rs0` จาก host จะต่อไม่ได้ `directConnection=true` ต่อเข้า primary ตรงๆ และใช้ transaction ได้ตามปกติ)

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

## เพิ่ม endpoint / module ใหม่

ตัวอย่างนี้เพิ่ม `GET /api/v1/admin/things` (แอดมินทุก role อ่านได้) ใช้ลำดับ model → validator → service → controller → route

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

3. Service (`src/services/thing.service.ts`) ใส่ business logic ทั้งหมดไว้ที่นี่ รับ type จาก validator ถ้าไม่เจอข้อมูลหรือข้อมูลผิด ให้ throw `ApiError` (ไม่ต้องจัดการ `res`)

   ```ts
   export async function list(q: ThingsQuery) {
     const filter = q.eventId ? { eventId: q.eventId } : {};
     const [rows, total] = await Promise.all([
       Thing.find(filter).sort({ createdAt: -1 }).skip(skipOf(q)).limit(q.pageSize).lean(),
       Thing.countDocuments(filter),
     ]);
     return { data: rows.map((r) => withId(r)), meta: pageMeta(q, total) };
   }
   ```
   - ถ้าใช้ `.lean()` ให้แปลงด้วย `withId()` เสมอ เพื่อให้ response ได้ `id` แทน `_id` เหมือน endpoint อื่น
   - ถ้าเขียนหลาย collection หรือมีการแก้โควตา ให้ห่อด้วย `withTransaction` (`utils/transaction.ts`)
   - ค่าคงที่ใหม่ (limit, status, ข้อความที่ใช้ซ้ำ) ให้ไปใส่ใน `config/constants.ts`
   - list แบบแบ่งหน้าใช้ `pageQuery` + `skipOf`/`pageMeta` (`utils/pagination.ts`) เพื่อให้ `meta` มีรูปแบบเดียวกันทุก endpoint

4. Controller (`src/controllers/admin-thing.controller.ts`) ให้บางที่สุด อ่าน input ที่ผ่าน validate แล้ว → เรียก service → ส่ง `ok()`/`created()`

   ```ts
   export async function list(_req: Request, res: Response) {
     const { data, meta } = await thingService.list(validatedQuery<ThingsQuery>(res));
     ok(res, data, meta);
   }
   ```
   Express 5 ส่ง promise ที่ reject ต่อให้ `errorHandler` เอง ไม่ต้องใส่ try/catch
   `T` ของ `validatedParams/Query/Body<T>()` ต้องเป็น type `z.infer` ของ schema ที่ใส่ใน `validate()` ของ route นั้น (helper นี้เป็นแค่ cast ถ้าเปลี่ยน schema ต้องเปลี่ยน `T` ด้วย)

5. Route (`src/routes/admin.routes.ts`) ใส่สิทธิ์และ validate ที่นี่

   ```ts
   adminRoutes.get("/things", read, validate({ query: v.thingsQuery }), things.list);
   ```
   ใช้ `read` (ทุก role), `write` (super_admin + reviewer) หรือ `requireRole(...SUPER_ONLY)` route ฝั่ง admin ที่ประกาศหลัง `adminRoutes.use(requireAuth)` ต้องล็อกอินก่อนทุกตัว ถ้าเป็น module ใหม่ทั้งชุดให้สร้าง router แยกแล้ว mount ใน `routes/index.ts`

6. รัน `npm run typecheck && npm run build` แล้วเพิ่ม endpoint ใหม่ลงในตาราง Endpoints ด้านล่าง

ถ้า service ไฟล์ไหนใหญ่จนรวมหลายหน้าที่ ให้แยกแบบ `services/order/` แล้วเหลือไฟล์เดิมไว้เป็น barrel เพื่อจะได้ไม่ต้องแก้ import ใน controller

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
| 201 | สร้างสำเร็จ (งาน + `Location`, ออเดอร์, ผู้ใช้) | - |
| 400 | input อ่านไม่ได้: JSON เสีย, id/slug/orderNo ใน URL ผิดรูปแบบ, multipart เสีย, Mongoose CastError | `INVALID_JSON`, `INVALID_PARAM`, `UPLOAD_ERROR`, `BAD_REQUEST` |
| 401 | ยังไม่ล็อกอิน / token หมดอายุหรือไม่ถูกต้อง / รหัสผ่านผิด | `UNAUTHORIZED`, `INVALID_CREDENTIALS` |
| 403 | role ไม่พอ หรือ Origin ไม่อยู่ใน `CORS_ORIGINS` (เฉพาะ method ที่แก้ข้อมูล) | `FORBIDDEN` |
| 404 | ไม่พบข้อมูลหรือไม่พบ route | `NOT_FOUND`, `EVENT_NOT_FOUND`, `ORDER_NOT_FOUND` |
| 405 | path มีอยู่แต่ไม่รองรับ method (มี header `Allow`) | `METHOD_NOT_ALLOWED` |
| 409 | ขัดแย้งกับสถานะปัจจุบัน: ข้อมูลซ้ำ, state ไม่ถูกต้อง, โควตาเต็ม, งานมีออเดอร์แล้ว | `SLUG_TAKEN`, `EMAIL_TAKEN`, `DUPLICATE_TRANSACTION_REF`, `INVALID_STATE`, `QUOTA_FULL`, `EVENT_HAS_ORDERS` |
| 413 | body JSON เกิน 100kb หรือไฟล์สลิปเกิน `MAX_SLIP_MB` | `PAYLOAD_TOO_LARGE`, `FILE_TOO_LARGE` |
| 415 | Content-Type ไม่ตรง (ต้อง JSON / multipart) หรือไฟล์สลิปไม่ใช่รูป | `UNSUPPORTED_MEDIA_TYPE`, `UNSUPPORTED_FILE_TYPE` |
| 422 | Zod / Mongoose validation ไม่ผ่าน (มี `fields`) รวม query string | `VALIDATION_ERROR` |
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
| POST | `/admin/auth/logout` | ทุก role | ล้าง cookie (200 พร้อม envelope, `data: null`) |
| GET | `/admin/auth/me` | ทุก role | ข้อมูลผู้ใช้ปัจจุบัน |
| POST | `/admin/auth/change-password` | ทุก role | เปลี่ยนรหัสผ่าน (≥ 10 ตัวอักษร) 200 พร้อม envelope, `data: null` |
| GET | `/admin/events`, `/admin/events/:id` | S R V | รายการ/รายละเอียดงาน พร้อม `orderCount` |
| POST | `/admin/events` | S | สร้างงาน + ระยะ ตอบ 201 + header `Location` (409 `SLUG_TAKEN` ถ้า slug ซ้ำ) |
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

