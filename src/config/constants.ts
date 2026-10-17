export const MAX_PARTICIPANTS = 20;
export const shirtSizes = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const;
export const genders = ["ชาย", "หญิง", "ไม่ระบุ"] as const;
export const applicantTypes = ["บุคคลทั่วไป", "นักเรียน / นักศึกษา", "ผู้สูงอายุ"] as const;
export const provinces = ["กรุงเทพมหานคร", "กระบี่", "กาญจนบุรี", "กาฬสินธุ์", "กำแพงเพชร", "ขอนแก่น", "จันทบุรี", "ฉะเชิงเทรา", "ชลบุรี", "ชัยนาท", "ชัยภูมิ", "ชุมพร", "เชียงราย", "เชียงใหม่", "ตรัง", "ตราด", "ตาก", "นครนายก", "นครปฐม", "นครพนม", "นครราชสีมา", "นครศรีธรรมราช", "นครสวรรค์", "นนทบุรี", "นราธิวาส", "น่าน", "บึงกาฬ", "บุรีรัมย์", "ปทุมธานี", "ประจวบคีรีขันธ์", "ปราจีนบุรี", "ปัตตานี", "พระนครศรีอยุธยา", "พะเยา", "พังงา", "พัทลุง", "พิจิตร", "พิษณุโลก", "เพชรบุรี", "เพชรบูรณ์", "แพร่", "ภูเก็ต", "มหาสารคาม", "มุกดาหาร", "แม่ฮ่องสอน", "ยโสธร", "ยะลา", "ร้อยเอ็ด", "ระนอง", "ระยอง", "ราชบุรี", "ลพบุรี", "ลำปาง", "ลำพูน", "เลย", "ศรีสะเกษ", "สกลนคร", "สงขลา", "สตูล", "สมุทรปราการ", "สมุทรสงคราม", "สมุทรสาคร", "สระแก้ว", "สระบุรี", "สิงห์บุรี", "สุโขทัย", "สุพรรณบุรี", "สุราษฎร์ธานี", "สุรินทร์", "หนองคาย", "หนองบัวลำภู", "อ่างทอง", "อำนาจเจริญ", "อุดรธานี", "อุตรดิตถ์", "อุทัยธานี", "อุบลราชธานี"];

export const roles = ["super_admin", "reviewer", "viewer"] as const;
export type Role = (typeof roles)[number];

export const orderStatuses = ["pending", "slip_uploaded", "paid", "rejected", "expired", "cancelled"] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const eventStatuses = ["draft", "open", "closed", "upcoming"] as const;
/** Event statuses visible on the public site (everything except `draft`). */
export const PUBLIC_EVENT_STATUSES = ["open", "closed", "upcoming"] as const;
export const eventCategories = ["road", "trail", "fun"] as const;
export const eventThemes = ["orange", "green", "blue", "pink", "navy", "sand"] as const;
export const deliveryMethods = ["pickup", "shipping"] as const;

/** Race start time, 24h `HH:mm`. Shared by the API validator and the Race schema. */
export const TIME_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const COOKIE_NAME = "rr_admin_token";
export const API_PREFIX = "/api/v1";

export const MS_PER_HOUR = 3_600_000;

/** Max rows a single CSV export reads. */
export const EXPORT_LIMIT = 50_000;

/** Background job that expires overdue `pending` orders. */
export const EXPIRY_INTERVAL_MS = 60_000;
export const EXPIRY_BATCH_SIZE = 500;
