import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/error-handler";
import { notFound } from "./middlewares/not-found";
import { routes } from "./routes";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (env.TRUST_PROXY > 0) app.set("trust proxy", env.TRUST_PROXY);

  // CORP cross-origin: the admin frontend (another origin) must be able to show slip images via <img>.
  // Access is still guarded by auth cookie + CORS.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  if (!env.isTest) app.use(morgan(env.isProd ? "combined" : "dev"));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.use(routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
