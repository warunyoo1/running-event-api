import { describe, expect, it } from "vitest";
import { createParticipantReference } from "../src/utils/participant-reference";
import { toParticipantView } from "../src/views/participant.view";
import { participantShape } from "../src/validators/order.validator";
import * as F from "./fixtures/view-fixtures";

describe("opt-out participant references", () => {
 it("accepts a preview reference, normalizes its case, and rejects malformed references", () => {
  const reference = createParticipantReference();
  const schema = participantShape.pick({ identityReference: true });
  expect(schema.parse({ identityReference: reference.toLowerCase() }).identityReference).toBe(reference);
  expect(schema.safeParse({ identityReference: "1234567890123" }).success).toBe(false);
  expect(schema.parse({}).identityReference).toBeUndefined();
 });
 it("generates distinct reference identifiers, not numeric government IDs", () => {
  const references = Array.from({ length: 100 }, createParticipantReference);
  expect(new Set(references).size).toBe(100);
  for (const reference of references) expect(reference).toMatch(/^RUN-[2-9A-HJ-NP-Z]{10}$/);
 });
 it("keeps the saved reference stable and never exposes an opted-out identity", () => {
  const p = { ...F.participants[0], declineIdentity: true, identityReference: createParticipantReference() };
  const first = toParticipantView(p);
  expect(first.identityReference).toBe(p.identityReference);
  expect(toParticipantView(p).identityReference).toBe(first.identityReference);
  expect(first.idNumber).toBe("");
  expect(first).not.toHaveProperty("idNumberEnc");
  expect(first).not.toHaveProperty("idLast4");
 });
});
