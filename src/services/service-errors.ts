import { ApiError } from "../utils/api-error";

// Errors raised by more than one service live here so each message/code exists once.

export const eventNotFound = (): ApiError =>
  ApiError.notFound("ไม่พบงานวิ่ง", "EVENT_NOT_FOUND");