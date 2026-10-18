import type { PaymentLean } from "../models/payment.model";
import { withId } from "../utils/lean";

/** Admin view of a payment: the slip path stays on the server. */
export type PaymentView = { id: string } & Omit<PaymentLean, "_id" | "slipPath">;

export const toPaymentView = (p: PaymentLean): PaymentView =>
  withId(p, ["slipPath"]);