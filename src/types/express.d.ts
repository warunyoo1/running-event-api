import type { Role } from "../config/constants";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; name: string; role: Role };
    }
  }
}

export {};
