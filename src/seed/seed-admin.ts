import { connectDatabase, disconnectDatabase } from "../config/database";
import { User } from "../models";
import { parseAdminSeedConfig } from "./admin-seed-rules";
import { ensureFirstAdmin } from "./ensure-admin";

// Admin-only seed used by CI/CD. Creates the first super_admin and nothing else.
async function main(): Promise<number> {
  const parsed = parseAdminSeedConfig(process.env);
  if (parsed.kind === "unset") {
    console.log("seed-admin: SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD not set, skipped");
    return 0;
  }
  if (parsed.kind === "invalid") {
    console.error(`seed-admin: invalid config: ${parsed.reason}`);
    return 1;
  }
  const { email } = parsed.config;
  await connectDatabase();
  try {
    // Make sure the unique email index exists before relying on it for race safety.
    await User.init();
    const decision = await ensureFirstAdmin(parsed.config);
    if (decision === "create") console.log(`seed-admin: created super_admin ${email}`);
    else if (decision === "skip-exists") console.log(`seed-admin: user ${email} exists, skipped`);
    else console.log("seed-admin: an active super_admin already exists, skipped");
    return 0;
  } finally {
    await disconnectDatabase();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error("seed-admin failed:", err instanceof Error ? err.message : "unknown error");
    process.exit(1);
  },
);
