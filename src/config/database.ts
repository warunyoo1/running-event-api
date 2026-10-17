import mongoose from "mongoose";
import { env } from "./env";

export async function connectDatabase(retries = 10, delayMs = 3000): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      return;
    } catch (err) {
      if (attempt >= retries) throw err;
      console.warn(`MongoDB connect failed (attempt ${attempt}/${retries}), retrying...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
