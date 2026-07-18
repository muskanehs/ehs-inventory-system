/** Allowed quantity / unit types for products. */
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
  "Roll",
  "Drum",
  "Barrel"
] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export const DEFAULT_PRODUCT_UNIT: ProductUnit = "Pc";

export const VELOCITY_REPORT_DAYS = 60;
