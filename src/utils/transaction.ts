import mongoose, { type ClientSession } from "mongoose";

/** Runs fn in a Mongo transaction (auto-retries transient errors). Requires a replica set. */
export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
