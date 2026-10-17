# Postman – Running Event API

## Import
1. Postman > Import > เลือก `running-event-api.postman_collection.json` และ `local.postman_environment.json`
2. เลือก environment **Running Event API - Local** (มุมขวาบน)
3. แก้ค่าใน environment: `adminEmail` / `adminPassword` ให้ตรงกับ super admin ที่สร้างด้วย `npm run seed` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` ใน `.env`) ค่าในไฟล์เป็น placeholder เท่านั้น

`baseUrl` เริ่มต้น `http://localhost:4000` (ตาม `PORT` ใน `.env.example`) path ทั้งหมดอยู่ใต้ `/api/v1` ยกเว้น `/health`

## ลำดับการรัน
1. **Health** ตรวจว่า API ขึ้น
2. **Auth > Login** (ต้องทำก่อนกลุ่ม Admin ทั้งหมด)
3. **Admin - Events > Create Event** สร้างงาน เก็บ `eventSlug`, `eventId` ให้อัตโนมัติ
4. **Public - Events** ดูรายการ/รายละเอียดงาน
5. **Public - Orders > Create Order** เก็บ `orderNo`, `phoneLast4` ให้อัตโนมัติ แล้ว **Find Order**
6. **Public - Orders > Upload Slip** ต้องเลือกไฟล์รูปในช่อง `slip` เอง
7. **Admin - Orders > Resolve orderId from orderNo** เก็บ `orderId` แล้วใช้ Get / Approve / Reject / Cancel / Tracking ต่อได้
8. กลุ่ม Admin อื่น (Slips, Participants, Shipping, Dashboard, Export CSV, Users)
9. **Auth - Run Last** (Change Password, Logout) รันสุดท้ายเท่านั้น เพราะจะทำให้ session/รหัสผ่านเปลี่ยน

Variable ที่ต้องกำหนดเองถ้าจะใช้ request นั้น: `paymentId` (Get Slip File), `participantId` (Patch Participant) ดู id จาก response ของ List ที่เกี่ยวข้อง

## Auth
- Login สำเร็จแล้ว server ตั้ง cookie `rr_admin_token` (httpOnly, JWT) Postman เก็บใน cookie jar และแนบให้ทุก request อัตโนมัติ ไม่ใช้ Authorization header
- Request แก้ไขข้อมูลที่ส่งจาก Postman ไม่มี header `Origin` จึงผ่าน origin check (CSRF)
- สิทธิ์ตาม role: `super_admin` (ทุกอย่าง รวม Create/Update Event และ Users), `reviewer` (อ่าน + อนุมัติ/ปฏิเสธ/ยกเลิก/แก้ข้อมูล), `viewer` (อ่านอย่างเดียว)
- Login และ Public order endpoints มี rate limit ถ้าเจอ 429 ให้รอสักครู่
- ถ้าใช้ HTTP ล้วนใน production ต้องตั้ง `COOKIE_SECURE=false` ไม่เช่นนั้น cookie จะไม่ถูกส่งกลับ
