import { HTTP_STATUS } from "../config/constants";

export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: FieldErrors,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static unauthorized(message = "กรุณาเข้าสู่ระบบ") {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, "UNAUTHORIZED", message);
  }
  static forbidden(message = "ไม่มีสิทธิ์ใช้งานส่วนนี้") {
    return new ApiError(HTTP_STATUS.FORBIDDEN, "FORBIDDEN", message);
  }
  static notFound(message = "ไม่พบข้อมูล", code = "NOT_FOUND") {
    return new ApiError(HTTP_STATUS.NOT_FOUND, code, message);
  }
  static conflict(code: string, message: string, fields?: FieldErrors) {
    return new ApiError(HTTP_STATUS.CONFLICT, code, message, fields);
  }
  static validation(fields: FieldErrors, message = "ข้อมูลไม่ถูกต้อง") {
    return new ApiError(
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      "VALIDATION_ERROR",
      message,
      fields,
    );
  }
}
