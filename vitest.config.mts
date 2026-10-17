import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Throwaway values so `config/env.ts` validates; tests never touch Mongo or HTTP.
    env: {
      NODE_ENV: "test",
      MONGODB_URI: "mongodb://localhost:27017/unit-tests",
      JWT_SECRET: "unit-test-secret-unit-test-secret-0000",
      ID_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
      UPLOAD_DIR: "./uploads-unit-test",
    },
  },
});
