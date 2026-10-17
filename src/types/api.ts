import type { FieldErrors } from "../utils/api-error";

/** Pagination block returned as `meta` on list endpoints. */
export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApiErrorBody = {
  code: string;
  message: string;
  fields?: FieldErrors;
};

/** Success envelope. `meta` exists only on paginated lists. */
export type ApiSuccess<T, M = PageMeta> = {
  statusCode: number;
  success: true;
  message: string;
  data: T;
  meta?: M;
};

/** Error envelope (named ApiFailure to avoid clashing with the ApiError class). */
export type ApiFailure = {
  statusCode: number;
  success: false;
  message: string;
  error: ApiErrorBody;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
