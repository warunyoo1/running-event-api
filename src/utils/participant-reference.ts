import { randomBytes } from "node:crypto";

/** 50 random bits; the database unique index prevents reference reuse. */
export const createParticipantReference = () => {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return `RUN-${Array.from(randomBytes(10), byte => alphabet[byte & 31]).join("")}`;
};
