import { Router } from "express";
import * as health from "../controllers/health.controller";

export const healthRoutes = Router();
healthRoutes.get("/health", health.check);
