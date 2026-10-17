import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { env } from "./config/env";
import { syncAllIndexes } from "./models";
import { startExpiryJob } from "./services/expiry.service";

async function main() {
  await connectDatabase();
  await syncAllIndexes();
  const app = createApp();
  const server = app.listen(env.PORT, () =>
    console.log(`API listening on :${env.PORT} (${env.NODE_ENV})`),
  );
  const timer = startExpiryJob();

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    clearInterval(timer);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
