// Copied (not imported) from the frontend mocks so the API has no cross-repo dependency.
// Source: run-event-platform/src/lib/events.ts (6 public events) and
//         running-event-admin/src/features/admin/data.ts (admin-only draft event, orders, users).
export type SeedRace = { name: string; price: number; quota: number; start: string };
export type SeedEvent = {
  id: string; name: string; slug: string; date: string; venue: string; province: string;
  status: "draft" | "open" | "closed" | "upcoming";
  category: "road" | "trail" | "fun";
  theme: "orange" | "green" | "blue" | "pink" | "navy" | "sand";
  races: SeedRace[]; subtitle: string; description: string; registrationEnds: string; organizer: string;
};
export const publicEvents: SeedEvent[] = [
  {
    id: "evt-1", name: "Bangkok Morning Run 2027", slug: "bangkok-morning-2027",
    date: "2027-01-17", venue: "สวนหลวง ร.9 กรุงเทพมหานคร", province: "กรุงเทพมหานคร",
    status: "open", category: "road", theme: "orange", subtitle: "เริ่มวันใหม่ ไปด้วยกัน",
    description: "รับแสงแรกของวันบนเส้นทางรอบสวนหลวง ร.9 วิ่งผ่านสวนสวยและริมบึงในบรรยากาศสบาย ๆ เลือกระยะที่ใช่ แล้วมาสร้างเช้าวันอาทิตย์ที่ดีไปด้วยกัน เหมาะทั้งนักวิ่งหน้าใหม่และคนที่อยากทำเวลาของตัวเอง",
    registrationEnds: "2026-12-31", organizer: "Bangkok Running Club",
    races: [{ name: "5 KM", price: 399, quota: 600, start: "06:00" }, { name: "10 KM", price: 599, quota: 400, start: "05:30" }],
  },
  {
    id: "evt-2", name: "Khao Yai Trail & Run", slug: "khaoyai-trail-2027",
    date: "2027-02-07", venue: "ปากช่อง นครราชสีมา", province: "นครราชสีมา",
    status: "open", category: "trail", theme: "green", subtitle: "ออกไปเจอธรรมชาติ ในจังหวะของคุณ",
    description: "เปลี่ยนบรรยากาศจากถนนสู่เส้นทางธรรมชาติที่ปากช่อง สัมผัสลมเย็นและวิวภูเขาบนเส้นทางเทรลที่เต็มไปด้วยความท้าทาย กรุณาเตรียมรองเท้าเทรลและอุปกรณ์ส่วนตัวให้พร้อมตามระยะที่เลือก",
    registrationEnds: "2027-01-15", organizer: "Khao Yai Trail Community",
    races: [{ name: "10 KM", price: 799, quota: 300, start: "06:00" }, { name: "21 KM", price: 1299, quota: 200, start: "05:00" }],
  },
  {
    id: "demo-4", name: "Pattaya Seaside Half Marathon", slug: "pattaya-seaside-2026",
    date: "2026-11-22", venue: "ชายหาดพัทยา ชลบุรี", province: "ชลบุรี",
    status: "open", category: "road", theme: "blue", subtitle: "ให้เสียงคลื่น พาคุณไปถึงเส้นชัย",
    description: "วิ่งเลียบชายทะเลพร้อมแสงอาทิตย์ยามเช้า สนุกกับเส้นทางริมชายหาดพัทยาและเสียงเชียร์ตลอดทาง มีระยะให้เลือกสำหรับทั้งนักวิ่งเพื่อสุขภาพและนักวิ่งฮาล์ฟมาราธอน",
    registrationEnds: "2026-11-05", organizer: "Seaside Running Club",
    races: [{ name: "5 KM", price: 450, quota: 500, start: "06:00" }, { name: "10 KM", price: 650, quota: 500, start: "05:30" }, { name: "21 KM", price: 950, quota: 300, start: "04:30" }],
  },
  {
    id: "demo-5", name: "Run for Little Hearts 2026", slug: "little-hearts-2026",
    date: "2026-12-13", venue: "สวนวชิรเบญจทัศ (สวนรถไฟ) กรุงเทพมหานคร", province: "กรุงเทพมหานคร",
    status: "open", category: "fun", theme: "pink", subtitle: "ทุกก้าวเล็ก ๆ มีความหมาย",
    description: "ชวนครอบครัวและเพื่อน ๆ มาใช้เวลาวันหยุดด้วยกันในสวนรถไฟ กับกิจกรรมวิ่งเพื่อสุขภาพที่ไม่เน้นการแข่งขัน เดินสลับวิ่งได้ตามกำลังและสนุกกับกิจกรรมภายในงาน",
    registrationEnds: "2026-11-30", organizer: "Little Hearts Running",
    races: [{ name: "3 KM", price: 350, quota: 400, start: "06:30" }, { name: "5 KM", price: 450, quota: 600, start: "06:00" }],
  },
  {
    id: "demo-6", name: "Ayutthaya Heritage Run", slug: "ayutthaya-heritage-2026",
    date: "2026-11-08", venue: "อุทยานประวัติศาสตร์พระนครศรีอยุธยา", province: "พระนครศรีอยุธยา",
    status: "closed", category: "road", theme: "sand", subtitle: "วิ่งผ่านเรื่องราวของเมืองเก่า",
    description: "สัมผัสบรรยากาศเมืองมรดกโลกผ่านเส้นทางวิ่งรอบอุทยานประวัติศาสตร์พระนครศรีอยุธยา ชมความงามของโบราณสถานและเสน่ห์เมืองเก่าในยามเช้า",
    registrationEnds: "2026-10-01", organizer: "Heritage Running Club",
    races: [{ name: "5 KM", price: 450, quota: 500, start: "06:00" }, { name: "10 KM", price: 650, quota: 500, start: "05:30" }],
  },
  {
    id: "demo-7", name: "Chiang Mai Night Run 2027", slug: "chiangmai-night-2027",
    date: "2027-04-10", venue: "อุทยานหลวงราชพฤกษ์ เชียงใหม่", province: "เชียงใหม่",
    status: "upcoming", category: "fun", theme: "navy", subtitle: "ค่ำคืนที่เมืองเหนือ มีเราออกวิ่ง",
    description: "พบกับประสบการณ์วิ่งยามค่ำท่ามกลางบรรยากาศเมืองเหนือ เตรียมพบรายละเอียดเส้นทางและการเปิดรับสมัครเร็ว ๆ นี้ บันทึกงานนี้ไว้เพื่อกลับมาตรวจสอบข้อมูลภายหลัง",
    registrationEnds: "2027-03-15", organizer: "Northern Runners",
    races: [{ name: "5 KM", price: 499, quota: 500, start: "18:30" }, { name: "10 KM", price: 699, quota: 400, start: "18:00" }],
  },
];

/** Admin-only mock event (status draft, never public). */
export const adminOnlyEvents: SeedEvent[] = [
  {
    id: "evt-3", name: "Chiang Mai Sunset Run", slug: "chiangmai-sunset-2027", date: "2027-03-14",
    venue: "อ่างแก้ว เชียงใหม่", province: "เชียงใหม่", status: "draft", category: "road", theme: "blue",
    subtitle: "", description: "", registrationEnds: "2027-02-20", organizer: "",
    races: [{ name: "5 KM", price: 499, quota: 500, start: "17:00" }],
  },
];

export const mockUsers = [
  { name: "ผู้ดูแลระบบสาธิต", email: "admin@example.com", role: "super_admin" as const },
  { name: "เจ้าหน้าที่สาธิต", email: "reviewer@example.com", role: "reviewer" as const },
  { name: "ผู้ดูข้อมูลสาธิต", email: "viewer@example.com", role: "viewer" as const },
];

const names = ["ปณิธาน ใจดี", "ณัฐชา รักวิ่ง", "ธนกฤต มีสุข", "กมลชนก สดใส", "พีรพล วิ่งไกล", "ศิรินทร์ แสงทอง", "อธิชา สายลม", "กิตติพงษ์ สุขใจ", "พรนภา ใจสู้", "วรัญญา รุ่งเรือง", "นที พงษ์ไพร", "ชลธิชา ยิ้มแย้ม", "ภูริณัฐ ตั้งใจ", "อริสา แก้วใส", "ธีรภัทร ก้าวไกล", "ภัทรวดี พูนสุข", "นภัสสร อรุณ", "ธนวัฒน์ เพียรดี"];
const statuses = ["slip_uploaded", "paid", "slip_uploaded", "pending", "paid", "paid", "slip_uploaded", "paid", "rejected", "paid", "pending", "paid", "slip_uploaded", "paid", "expired", "paid", "cancelled", "paid"] as const;

export type SeedOrder = {
  orderNo: string; eventSlug: string; raceName: string; contactName: string; phone: string;
  status: (typeof statuses)[number]; createdAt: Date; transactionRef: string;
  delivery: "pickup" | "shipping"; participants: { firstName: string; lastName: string; size: string; bibNo?: string }[];
  rejectionReason?: string;
};

/** Same generation rules as running-event-admin data.ts (all phone numbers / names are fake). */
export function buildMockOrders(): SeedOrder[] {
  const base = [publicEvents[0], publicEvents[1]]; // evt-1, evt-2
  return names.map((name, index) => {
    const event = base[index % 3 === 1 ? 1 : 0];
    const race = event.races[index % 2];
    const count = index % 4 === 0 ? 2 : 1;
    const status = statuses[index];
    const split = (n: string) => ({ firstName: n.split(" ")[0], lastName: n.split(" ").slice(1).join(" ") || "-" });
    return {
      orderNo: `RR2610-${String(1048 - index).padStart(4, "0")}`,
      eventSlug: event.slug, raceName: race.name, contactName: name,
      phone: `080000${String(index).padStart(4, "0")}`,
      status,
      createdAt: new Date(`2026-10-${String(15 - Math.floor(index / 3)).padStart(2, "0")}T${String(10 + (index % 8)).padStart(2, "0")}:20:00+07:00`),
      transactionRef: `DEMO-REF-${1048 - index}`,
      delivery: index % 3 === 0 ? "shipping" : "pickup",
      participants: Array.from({ length: count }, (_, p) => ({
        ...split(p ? names[(index + 5) % names.length] : name),
        size: ["S", "M", "L", "XL"][index % 4],
        ...(status === "paid" ? { bibNo: String(1001 + index * 2 + p) } : {}),
      })),
      ...(status === "rejected" ? { rejectionReason: "ยอดเงินในสลิปไม่ตรงกับยอดออเดอร์" } : {}),
    };
  });
}
