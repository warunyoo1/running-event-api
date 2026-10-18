import { HTTP_STATUS } from "../config/constants";
import { Order, Payment } from "../models";
import { ApiError } from "../utils/api-error";
import {
  deleteSlip,
  detectImage,
  resolveSlipPath,
  saveSlip,
} from "../utils/slip-file";
import { toSlipSubmittedView, type SlipSubmittedView } from "../views/slip.view";
import {
  isOverduePending,
  loadByOrderNoAndPhone,
} from "./order/order-public.service";
import { statusesBefore } from "./order/order-state";

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
): Promise<SlipSubmittedView> {
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
  // No transaction: create the new payment first, then flip the order (the guarded step), then
  // supersede older payments. A failure before the flip removes the new payment and the file.
  let paymentId: unknown;
  try {
    const payment = await Payment.create({
      orderId: order._id,
      slipPath: name,
      slipMime: kind.mime,
      amount: order.amount,
      status: "submitted",
    });
    paymentId = payment._id;
    const res = await Order.updateOne(
      { _id: order._id, status: { $in: from } },
      {
        $set: { status: "slip_uploaded", slipUploadedAt: new Date() },
        $unset: { rejectionReason: "" },
      },
    );
    if (res.modifiedCount === 0) throw CANNOT_UPLOAD();
  } catch (err) {
    await deleteSlip(name); // no orphan file
    if (paymentId)
      await Payment.deleteOne({ _id: paymentId }).catch((e) =>
        console.error("payment cleanup failed", e),
      );
    throw err;
  }
  await Payment.updateMany(
    { orderId: order._id, status: "submitted", _id: { $ne: paymentId } },
    { $set: { status: "superseded" } },
  );
  return toSlipSubmittedView(order);
}

/** Resolve a payment's slip to a safe on-disk path. */
export async function getSlipFile(
  paymentId: string,
): Promise<{ fullPath: string; mime: string }> {
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
