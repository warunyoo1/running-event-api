import { Router } from "express";
import * as events from "../controllers/public-event.controller";
import * as orders from "../controllers/public-order.controller";
import { orderLimiter, publicLimiter } from "../middlewares/rate-limit";
import { uploadSlip } from "../middlewares/upload";
import { validate } from "../middlewares/validate";
import { orderNoParam, slugParam } from "../validators/common.validator";
import { publicEventsQuery } from "../validators/event.validator";
import {
  createOrderBody,
  findOrderQuery,
  slipBody,
} from "../validators/order.validator";

export const publicRoutes = Router();
publicRoutes.use(publicLimiter);

publicRoutes.get(
  "/events",
  validate({ query: publicEventsQuery }),
  events.list,
);
publicRoutes.get(
  "/events/:slug",
  validate({ params: slugParam }),
  events.detail,
);
publicRoutes.post(
  "/events/:slug/orders",
  orderLimiter,
  validate({ params: slugParam, body: createOrderBody }),
  orders.create,
);
publicRoutes.get(
  "/orders/:orderNo",
  orderLimiter,
  validate({ params: orderNoParam, query: findOrderQuery }),
  orders.find,
);
publicRoutes.post(
  "/orders/:orderNo/slip",
  orderLimiter,
  uploadSlip,
  validate({ params: orderNoParam, body: slipBody }),
  orders.uploadSlip,
);
