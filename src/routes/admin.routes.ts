import { Router } from "express";
import * as auditLogs from "../controllers/audit-log.controller";
import * as auth from "../controllers/auth.controller";
import * as dashboard from "../controllers/dashboard.controller";
import * as eventImages from "../controllers/admin-event-image.controller";
import * as events from "../controllers/admin-event.controller";
import * as exports_ from "../controllers/export.controller";
import * as orders from "../controllers/admin-order.controller";
import * as participants from "../controllers/admin-participant.controller";
import * as reports from "../controllers/report.controller";
import * as shipping from "../controllers/admin-shipping.controller";
import * as slips from "../controllers/admin-slip.controller";
import * as users from "../controllers/user.controller";
import {
  ALL_ROLES,
  SUPER_ONLY,
  WRITE_ROLES,
  requireAuth,
  requireRole,
} from "../middlewares/auth";
import { requireContentType } from "../middlewares/content-type";
import { addMethodNotAllowed } from "../middlewares/method-not-allowed";
import { originCheck } from "../middlewares/origin-check";
import { loginLimiter, uploadLimiter } from "../middlewares/rate-limit";
import { uploadEventImages } from "../middlewares/upload";
import { validate } from "../middlewares/validate";
import * as v from "../validators/admin.validator";
import { changePasswordBody, loginBody } from "../validators/auth.validator";
import { imageParams, objectIdParam } from "../validators/common.validator";
import {
  adminEventsQuery,
  eventBody,
  patchImageBody,
  reorderBody,
  uploadImagesBody,
} from "../validators/event.validator";
import { createUserBody, updateUserBody } from "../validators/user.validator";

export const adminRoutes = Router();
adminRoutes.use(originCheck);
// Every admin route takes JSON except the event image upload, which is multipart (checked on the route).
const json = requireContentType("json");
const IMAGE_UPLOAD_PATH = /^\/events\/[^/]+\/images\/?$/;
adminRoutes.use((req, res, next) =>
  req.method === "POST" && IMAGE_UPLOAD_PATH.test(req.path)
    ? next()
    : json(req, res, next),
);

// --- auth ---
adminRoutes.post(
  "/auth/login",
  loginLimiter,
  validate({ body: loginBody }),
  auth.login,
);
adminRoutes.post("/auth/logout", auth.logout);

// everything below requires a valid session
adminRoutes.use(requireAuth);
adminRoutes.get("/auth/me", auth.me);
adminRoutes.post(
  "/auth/change-password",
  validate({ body: changePasswordBody }),
  auth.changePassword,
);

const read = requireRole(...ALL_ROLES);
const write = requireRole(...WRITE_ROLES);
const superOnly = requireRole(...SUPER_ONLY);
const id = validate({ params: objectIdParam });

// --- events ---
adminRoutes.get(
  "/events",
  read,
  validate({ query: adminEventsQuery }),
  events.list,
);
adminRoutes.post(
  "/events",
  superOnly,
  validate({ body: eventBody }),
  events.create,
);
adminRoutes.get("/events/:id", read, id, events.get);
adminRoutes.put(
  "/events/:id",
  superOnly,
  validate({ params: objectIdParam, body: eventBody }),
  events.update,
);
adminRoutes.post("/events/:id/archive", superOnly, id, events.archive);
adminRoutes.post("/events/:id/restore", superOnly, id, events.restore);
adminRoutes.delete("/events/:id", superOnly, id, events.remove);

// --- event images (writes: super_admin only; multipart upload runs after auth + role) ---
adminRoutes.get("/events/:id/images", read, id, eventImages.list);
adminRoutes.post(
  "/events/:id/images",
  superOnly,
  id,
  uploadLimiter,
  requireContentType("multipart"),
  uploadEventImages,
  validate({ body: uploadImagesBody }),
  eventImages.upload,
);
// literal "order" is registered before the ":imageId" routes
adminRoutes.put(
  "/events/:id/images/order",
  superOnly,
  validate({ params: objectIdParam, body: reorderBody }),
  eventImages.reorder,
);
adminRoutes.patch(
  "/events/:id/images/:imageId",
  superOnly,
  validate({ params: imageParams, body: patchImageBody }),
  eventImages.patch,
);
adminRoutes.delete(
  "/events/:id/images/:imageId",
  superOnly,
  validate({ params: imageParams }),
  eventImages.remove,
);
adminRoutes.get(
  "/events/:id/images/:imageId/file",
  read,
  validate({ params: imageParams }),
  eventImages.adminFile,
);

// --- orders ---
adminRoutes.get(
  "/orders",
  read,
  validate({ query: v.adminOrdersQuery }),
  orders.list,
);
adminRoutes.get("/orders/:id", read, id, orders.get);
adminRoutes.post(
  "/orders/:id/cancel",
  write,
  validate({ params: objectIdParam, body: v.cancelBody }),
  orders.cancel,
);
adminRoutes.patch(
  "/orders/:id/tracking",
  write,
  validate({ params: objectIdParam, body: v.trackingBody }),
  orders.tracking,
);
adminRoutes.patch(
  "/orders/:id/address",
  write,
  validate({ params: objectIdParam, body: v.addressBody }),
  orders.address,
);
adminRoutes.post(
  "/orders/:id/notes",
  write,
  validate({ params: objectIdParam, body: v.noteBody }),
  orders.addNote,
);
adminRoutes.delete(
  "/orders/:id/notes/:noteId",
  write,
  validate({ params: v.noteParams }),
  orders.removeNote,
);
adminRoutes.post(
  "/orders/:id/approve",
  write,
  validate({ params: objectIdParam, body: v.approveBody }),
  slips.approve,
);
adminRoutes.post(
  "/orders/:id/reject",
  write,
  validate({ params: objectIdParam, body: v.rejectBody }),
  slips.reject,
);

// --- slips ---
adminRoutes.get("/slips", read, validate({ query: v.slipsQuery }), slips.list);
adminRoutes.get("/payments/:id/slip", read, id, slips.file);

// --- participants / shipping ---
adminRoutes.get(
  "/participants",
  read,
  validate({ query: v.participantsQuery }),
  participants.list,
);
adminRoutes.patch(
  "/participants/:id",
  write,
  validate({ params: objectIdParam, body: v.patchParticipantBody }),
  participants.patch,
);
adminRoutes.get(
  "/shipping",
  read,
  validate({ query: v.shippingQuery }),
  shipping.list,
);

// --- dashboard / reports ---
adminRoutes.get(
  "/dashboard",
  read,
  validate({ query: v.dashboardQuery }),
  dashboard.get,
);
adminRoutes.get(
  "/reports/summary",
  read,
  validate({ query: v.summaryQuery }),
  reports.summary,
);
adminRoutes.get(
  "/reports/shirt-sizes",
  read,
  validate({ query: v.shirtSizesQuery }),
  reports.shirtSizes,
);

// --- CSV export ---
adminRoutes.get(
  "/export/orders.csv",
  read,
  validate({ query: v.exportOrdersQuery }),
  exports_.orders,
);
adminRoutes.get(
  "/export/participants.csv",
  read,
  validate({ query: v.exportParticipantsQuery }),
  exports_.participants,
);
adminRoutes.get(
  "/export/fulfillment.csv",
  read,
  validate({ query: v.exportShippingQuery }),
  exports_.fulfillment,
);
adminRoutes.get(
  "/export/overview.csv",
  read,
  validate({ query: v.dashboardQuery }),
  exports_.overview,
);
adminRoutes.get(
  "/export/shirt-sizes.csv",
  read,
  validate({ query: v.shirtSizesQuery }),
  exports_.shirtSizes,
);

// --- users ---
adminRoutes.get("/users", superOnly, users.list);
adminRoutes.post(
  "/users",
  superOnly,
  validate({ body: createUserBody }),
  users.create,
);
adminRoutes.patch(
  "/users/:id",
  superOnly,
  validate({ params: objectIdParam, body: updateUserBody }),
  users.update,
);
adminRoutes.delete("/users/:id", superOnly, id, users.remove);

// --- audit ---
adminRoutes.get(
  "/audit-logs",
  superOnly,
  validate({ query: v.auditLogsQuery }),
  auditLogs.list,
);

addMethodNotAllowed(adminRoutes);
