import { Router } from "express";
import { API_PREFIX } from "../config/constants";
import { adminRoutes } from "./admin.routes";
import { healthRoutes } from "./health.routes";
import { publicRoutes } from "./public.routes";

export const routes = Router();
routes.use(healthRoutes); // /health
routes.use(API_PREFIX, healthRoutes); // /api/v1/health
routes.use(`${API_PREFIX}/public`, publicRoutes);
routes.use(`${API_PREFIX}/admin`, adminRoutes);
