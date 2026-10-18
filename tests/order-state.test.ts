import { describe, expect, it } from "vitest";
import { deliveryMethods, orderStatuses } from "../src/config/constants";
import { ADDRESS_EDITABLE, canEditAddress } from "../src/services/order/order-state";

describe("canEditAddress", () => {
  const editable = ["pending", "slip_uploaded", "rejected", "paid"];

  it("lists the editable statuses", () => {
    expect([...ADDRESS_EDITABLE].sort()).toEqual([...editable].sort());
  });

  for (const status of orderStatuses) {
    for (const delivery of deliveryMethods) {
      for (const trackingNo of [undefined, null, "", "TH123"]) {
        const expected = delivery === "shipping" && editable.includes(status) && !trackingNo;
        it(`${status} / ${delivery} / tracking ${JSON.stringify(trackingNo)} -> ${expected}`, () => {
          expect(canEditAddress({ status, delivery, trackingNo })).toBe(expected);
        });
      }
    }
  }

  it("is false when status or delivery is missing", () => {
    expect(canEditAddress({ delivery: "shipping" })).toBe(false);
    expect(canEditAddress({ status: "paid" })).toBe(false);
  });
});
