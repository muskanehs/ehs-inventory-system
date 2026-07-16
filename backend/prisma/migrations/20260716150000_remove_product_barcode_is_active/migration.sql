-- Drop barcode unique index and column; remove isActive from Product
DROP INDEX IF EXISTS "Product_barcode_active_key";
DROP INDEX IF EXISTS "Product_barcode_idx";

ALTER TABLE "Product" DROP COLUMN IF EXISTS "barcode";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "isActive";
