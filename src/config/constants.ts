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

/** Named HTTP status codes (no magic numbers in handlers). */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  NOT_MODIFIED: 304,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/** ONE central map of default envelope `message` by status (Thai). */
export const STATUS_MESSAGE: Record<number, string> = {
  [HTTP_STATUS.OK]: "สำเร็จ",
  [HTTP_STATUS.CREATED]: "สร้างสำเร็จ",
  202: "รับคำขอแล้ว",
  [HTTP_STATUS.BAD_REQUEST]: "คำขอไม่ถูกต้อง",
  [HTTP_STATUS.UNAUTHORIZED]: "กรุณาเข้าสู่ระบบ",
  [HTTP_STATUS.FORBIDDEN]: "ไม่มีสิทธิ์ใช้งานส่วนนี้",
  [HTTP_STATUS.NOT_FOUND]: "ไม่พบข้อมูล",
  [HTTP_STATUS.METHOD_NOT_ALLOWED]: "ไม่รองรับ method นี้",
  [HTTP_STATUS.CONFLICT]: "ข้อมูลขัดแย้งกับสถานะปัจจุบัน",
  [HTTP_STATUS.PAYLOAD_TOO_LARGE]: "ข้อมูลที่ส่งมาใหญ่เกินไป",
  [HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE]: "ไม่รองรับชนิดข้อมูลที่ส่งมา",
  [HTTP_STATUS.UNPROCESSABLE_ENTITY]: "ข้อมูลไม่ถูกต้อง",
  [HTTP_STATUS.TOO_MANY_REQUESTS]: "คำขอมากเกินไป กรุณาลองใหม่ภายหลัง",
  [HTTP_STATUS.INTERNAL_SERVER_ERROR]: "เกิดข้อผิดพลาดภายในระบบ",
  [HTTP_STATUS.SERVICE_UNAVAILABLE]: "บริการไม่พร้อมใช้งานชั่วคราว",
};
export const DEFAULT_SUCCESS_MESSAGE = STATUS_MESSAGE[HTTP_STATUS.OK];
/** Seconds suggested in `Retry-After` when Mongo is unavailable. */
export const RETRY_AFTER_UNAVAILABLE_SEC = 5;

/** Max rows a single CSV export reads. */
export const EXPORT_LIMIT = 50_000;

/** Background job that expires overdue `pending` orders. */
export const EXPIRY_INTERVAL_MS = 60_000;
export const EXPIRY_BATCH_SIZE = 500;
