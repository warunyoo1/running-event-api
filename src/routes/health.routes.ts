import { Router } from "express";
import * as health from "../controllers/health.controller";
import { addMethodNotAllowed } from "../middlewares/method-not-allowed";

export const healthRoutes = Router();
healthRoutes.get("/health", health.check);
addMethodNotAllowed(healthRoutes);
