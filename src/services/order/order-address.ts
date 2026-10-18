import type { OrderAddress } from "../../models/order.model";

type AddressInput = {
  street: string;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
};

/** Stored shape of a shipping address: free-text parts trimmed, province kept as chosen. */
export const trimAddress = (a: AddressInput): OrderAddress => ({
  street: a.street.trim(),
  subdistrict: a.subdistrict.trim(),
  district: a.district.trim(),
  province: a.province,
  postalCode: a.postalCode.trim(),
});
