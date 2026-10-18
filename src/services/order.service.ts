// Public entry point for order use cases. Implementation lives in ./order/*:
//   order-create  – public checkout (validation, quota reservation, persistence)
//   order-public  – order lookup by orderNo + phone for the public site
//   order-admin   – admin list/detail, cancel, tracking, address edit
//   order-detail  – notes, timeline and reviewer name appended to the admin detail
//   order-notes   – internal order notes (add, delete)
//   order-quota   – quota reserve/release shared by create, cancel and expiry
//   order-state   – state machine (transitions, QUOTA_HOLDING)
// Response JSON is built in ../views/*.view.ts, never here.
export { createOrder } from "./order/order-create.service";
export {
  findPublic,
  isOverduePending,
  loadByOrderNoAndPhone,
} from "./order/order-public.service";
export {
  adminFilter,
  cancel,
  decorateOrders,
  findOrderOr404,
  getAdmin,
  listAdmin,
  setTracking,
  updateAddress,
} from "./order/order-admin.service";
export { addNote, removeNote } from "./order/order-notes.service";
export { transitionAndRelease } from "./order/order-quota";
