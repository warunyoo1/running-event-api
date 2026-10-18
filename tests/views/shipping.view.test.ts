import { describe, expect, it } from "vitest";
import * as F from "../fixtures/view-fixtures";
import { toShippingRowView } from "../../src/views/shipping.view";

describe("toShippingRowView", () => {
  it("allCollected is false for an order without participants", () => {
    expect(toShippingRowView(F.paidOrder, []).allCollected).toBe(false);
  });

  it("allCollected needs every participant collected", () => {
    expect(toShippingRowView(F.paidOrder, F.participants).allCollected).toBe(false);
    expect(toShippingRowView(F.paidOrder, [F.participants[0]]).allCollected).toBe(true);
  });

  it("shapes participants and defaults empty address/tracking to null", () => {
    const v = toShippingRowView({ ...F.paidOrder, address: undefined, trackingNo: undefined }, F.participants);
    expect(v.address).toBeNull();
    expect(v.trackingNo).toBeNull();
    expect(v.participants[0]).toMatchObject({ name: "Som Chai", race: "10K", bibNo: "A001", collected: true });
    expect(v.participants[1].bibNo).toBeNull();
  });
});