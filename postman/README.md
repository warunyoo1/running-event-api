# Postman – Running Event API

## Import
1. Postman > Import > เลือก `running-event-api.postman_collection.json` และ `local.postman_environment.json`
2. เลือก environment **Running Event API - Local** (มุมขวาบน)
3. แก้ค่าใน environment: `adminEmail` / `adminPassword` ให้ตรงกับ super admin ที่สร้างด้วย `npm run seed:admin` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` ใน `.env`) ค่าในไฟล์เป็น placeholder เท่านั้น

`baseUrl` เริ่มต้น `http://localhost:4000` (ตาม `PORT` ใน `.env.example`) path ทั้งหมดอยู่ใต้ `/api/v1` ยกเว้น `/health`

## ลำดับการรัน
1. **Health** ตรวจว่า API ขึ้น
2. **Auth > Login** (ต้องทำก่อนกลุ่ม Admin ทั้งหมด)
3. **Admin - Events > Create Event** สร้างงาน เก็บ `eventSlug`, `eventId` ให้อัตโนมัติ
3.1 **Event images** (ต้องล็อกอิน super_admin และมี `eventId`) เลือกไฟล์ JPG/PNG/WEBP ในช่อง `files` ของ **Upload Images** แล้วรันตามลำดับ: Upload > List > Patch > Reorder > Admin file > Public file > Delete (เก็บ `imageId`, `imageId2`, `imageUrl` ให้อัตโนมัติ)
4. **Public - Events** ดูรายการ/รายละเอียดงาน
5. **Public - Orders > Create Order** เก็บ `orderNo`, `phoneLast4` ให้อัตโนมัติ แล้ว **Find Order**
6. **Public - Orders > Upload Slip** ต้องเลือกไฟล์รูปในช่อง `slip` เอง
7. **Admin - Orders > Resolve orderId from orderNo** เก็บ `orderId` แล้วใช้ Get / Approve / Reject / Cancel / Tracking ต่อได้
8. กลุ่ม Admin อื่น (Slips, Participants, Shipping, Dashboard, Export CSV, Users)
9. **Negative cases** ตรวจ error status ต่าง ๆ
10. **Auth - Run Last** (Change Password, Logout) รันสุดท้ายเท่านั้น เพราะจะทำให้ session/รหัสผ่านเปลี่ยน

Variable ที่ต้องกำหนดเองถ้าจะใช้ request นั้น: `paymentId` (Get Slip File), `participantId` (Patch Participant) ดู id จาก response ของ List ที่เกี่ยวข้อง

## Response envelope และ status code
- Response JSON ทุกอันเป็น `{ statusCode, success, message, data, meta? }` (error: `{ statusCode, success:false, message, error:{ code, message, fields? } }`) ยกเว้น CSV, ไฟล์สลิป และ 304
- Collection มี test ระดับ collection ตรวจทุก response JSON ว่า `body.statusCode` เท่ากับ HTTP status และ `body.success` ตรงกับ 2xx
- Logout และ Change Password ตอบ **200** (`data: null`) ไม่ใช่ 204 อีกแล้ว
- โฟลเดอร์ **Negative cases** ครอบคลุม 400, 401, 403, 404, 405, 409, 415, 422 (รันหลัง Create Event) เคส 403 role ผิดต้องตั้ง `viewerEmail`/`viewerPassword` ใน collection variables ไม่เช่นนั้นจะถูกข้าม
- ตาราง status ทั้งหมดดูใน `README.md` หัวข้อ "HTTP status codes"

## Auth
- Login สำเร็จแล้ว server ตั้ง cookie `rr_admin_token` (httpOnly, JWT) Postman เก็บใน cookie jar และแนบให้ทุก request อัตโนมัติ ไม่ใช้ Authorization header
- Request แก้ไขข้อมูลที่ส่งจาก Postman ไม่มี header `Origin` จึงผ่าน origin check (CSRF)
- สิทธิ์ตาม role: `super_admin` (ทุกอย่าง รวม Create/Update Event และ Users), `reviewer` (อ่าน + อนุมัติ/ปฏิเสธ/ยกเลิก/แก้ข้อมูล), `viewer` (อ่านอย่างเดียว)
- Login และ Public order endpoints มี rate limit ถ้าเจอ 429 ให้รอสักครู่
- ถ้าใช้ HTTP ล้วนใน production ต้องตั้ง `COOKIE_SECURE=false` ไม่เช่นนั้น cookie จะไม่ถูกส่งกลับ
