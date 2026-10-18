import { describe, expect, it } from "vitest";
import * as F from "../fixtures/view-fixtures";
import { toParticipantView, toParticipantWithOrderView } from "../../src/views/participant.view";

describe("toParticipantView (masking)", () => {
  it("never exposes the encrypted id or the raw last 4 digits", () => {
    const v = toParticipantView(F.participants[0]);
    expect(v).not.toHaveProperty("idNumberEnc");
    expect(v).not.toHaveProperty("idLast4");
    expect(v).not.toHaveProperty("_id");
    expect(JSON.stringify(v)).not.toContain("ENC");
    expect(v.idNumber).toBe("*********1234");
    expect(v.id).toBe(String(F.participants[0]._id));
  });

  it("returns an empty idNumber when the participant declined identity", () => {
    expect(toParticipantView(F.participants[1]).idNumber).toBe("");
  });
});

describe("toParticipantWithOrderView", () => {
  it("adds orderNo and orderStatus", () => {
    const v = toParticipantWithOrderView(F.participants[0], F.paidOrder);
    expect(v).toMatchObject({ orderNo: "RUN-0001", orderStatus: "paid" });
  });

  it("defaults both to an empty string when the order is missing", () => {
    const v = toParticipantWithOrderView(F.participants[0], undefined);
    expect(v).toMatchObject({ orderNo: "", orderStatus: "" });
  });
});