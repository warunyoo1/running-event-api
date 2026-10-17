import { HTTP_STATUS } from "../config/constants";
import { Order, Payment } from "../models";
import { ApiError } from "../utils/api-error";
import {
  deleteSlip,
  detectImage,
  resolveSlipPath,
  saveSlip,
} from "../utils/slip-file";
import { withTransaction } from "../utils/transaction";
import {
  isOverduePending,
  loadByOrderNoAndPhone,
} from "./order/order-public.service";
import { statusesBefore } from "./order-state";

const SLIP_NOT_FOUND = () =>
  ApiError.notFound("ไม่พบสลิป", "SLIP_NOT_FOUND");
const CANNOT_UPLOAD = () =>
  ApiError.conflict(
    "INVALID_STATE",
    "ออเดอร์นี้ไม่สามารถอัปโหลดสลิปได้ในสถานะปัจจุบัน",
  );

export async function submitSlip(
  orderNo: string,
  phoneLast4: string,
  file?: Express.Multer.File,
) {
  const order = await loadByOrderNoAndPhone(orderNo, phoneLast4);
  if (!file) throw ApiError.validation({ slip: "กรุณาแนบไฟล์สลิป" });
  const kind = detectImage(file.buffer);
  if (!kind)
    throw new ApiError(
      HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
      "UNSUPPORTED_FILE_TYPE",
      "รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP",
    );

  if (order.status === "expired" || isOverduePending(order))
    throw ApiError.conflict("ORDER_EXPIRED", "ออเดอร์หมดอายุแล้ว");
  const from = statusesBefore("slip_uploaded");
  if (!from.includes(order.status)) throw CANNOT_UPLOAD();

  const name = await saveSlip(file.buffer, kind.ext);
  try {
    await withTransaction(async (session) => {
      const res = await Order.updateOne(
        { _id: order._id, status: { $in: from } },
        {
          $set: { status: "slip_uploaded", slipUploadedAt: new Date() },
          $unset: { rejectionReason: "" },
        },
        { session },
      );
      if (res.modifiedCount === 0) throw CANNOT_UPLOAD();
      await Payment.updateMany(
        { orderId: order._id, status: "submitted" },
        { $set: { status: "superseded" } },
        { session },
      );
      await Payment.create(
        [
          {
            orderId: order._id,
            slipPath: name,
            slipMime: kind.mime,
            amount: order.amount,
            status: "submitted",
          },
        ],
        { session },
      );
    });
  } catch (err) {
    await deleteSlip(name); // no orphan file
    throw err;
  }
  return { orderNo: order.orderNo, status: "slip_uploaded" as const };
}

/** Resolve a payment's slip to a safe on-disk path. */
export async function getSlipFile(paymentId: string) {
  const payment = await Payment.findById(paymentId).lean();
  if (!payment) throw SLIP_NOT_FOUND();
  try {
    return {
      fullPath: resolveSlipPath(payment.slipPath),
      mime: payment.slipMime,
    };
  } catch {
    throw SLIP_NOT_FOUND();
  }
}
