-- Soft delete columns
ALTER TABLE "User" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deletedBy" TEXT;

ALTER TABLE "Location" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Location" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Location" ADD COLUMN "deletedBy" TEXT;

ALTER TABLE "Category" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Category" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Category" ADD COLUMN "deletedBy" TEXT;

ALTER TABLE "Product" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN "deletedBy" TEXT;

-- Replace global unique constraints with partial unique indexes (active records only)
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";
CREATE UNIQUE INDEX "User_email_active_key" ON "User"("email") WHERE "isDeleted" = false;

ALTER TABLE "Location" DROP CONSTRAINT IF EXISTS "Location_name_key";
CREATE UNIQUE INDEX "Location_name_active_key" ON "Location"("name") WHERE "isDeleted" = false;

ALTER TABLE "Category" DROP CONSTRAINT IF EXISTS "Category_name_key";
CREATE UNIQUE INDEX "Category_name_active_key" ON "Category"("name") WHERE "isDeleted" = false;

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_sku_key";
CREATE UNIQUE INDEX "Product_sku_active_key" ON "Product"("sku") WHERE "isDeleted" = false;

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_barcode_key";
CREATE UNIQUE INDEX "Product_barcode_active_key" ON "Product"("barcode") WHERE "isDeleted" = false AND "barcode" IS NOT NULL;

CREATE INDEX "User_isDeleted_idx" ON "User"("isDeleted");
CREATE INDEX "Location_isDeleted_idx" ON "Location"("isDeleted");
CREATE INDEX "Category_isDeleted_idx" ON "Category"("isDeleted");
CREATE INDEX "Product_isDeleted_idx" ON "Product"("isDeleted");
