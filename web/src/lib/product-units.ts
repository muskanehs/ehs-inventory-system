/** Allowed quantity / unit types for products - keep in sync with backend PRODUCT_UNITS. */
export const PRODUCT_UNITS = [
  "Pc",
  "Box",
  "Carton",
  "Packet",
  "Bag",
  "Kg",
  "Gram",
  "L",
  "ML",
  "Inch",
  "Bucket",
  "Sqft",
  "Bundle",
  "Sheet",
  "Dozen",
  "Meter",
  "Coil",
  "Set",
  "Roll"
] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export const DEFAULT_PRODUCT_UNIT: ProductUnit = "Pc";

export const VELOCITY_REPORT_DAYS = 60;
