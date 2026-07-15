-- AlterTable: add vehicle fields and migrate to line items
ALTER TABLE "Transfer" ADD COLUMN "driverName" TEXT;
ALTER TABLE "Transfer" ADD COLUMN "vehicleNumber" TEXT;
ALTER TABLE "Transfer" ADD COLUMN "vehicleContact" TEXT;

-- CreateTable
CREATE TABLE "TransferLineItem" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "TransferLineItem_pkey" PRIMARY KEY ("id")
);

-- Migrate existing single-product transfers to line items
INSERT INTO "TransferLineItem" ("id", "transferId", "productId", "quantity")
SELECT
    concat('tli_', "id", '_', "productId"),
    "id",
    "productId",
    "quantity"
FROM "Transfer"
WHERE "productId" IS NOT NULL;

-- Set default vehicle info for legacy transfers
UPDATE "Transfer"
SET
    "driverName" = COALESCE("driverName", 'Unknown'),
    "vehicleNumber" = COALESCE("vehicleNumber", 'N/A'),
    "vehicleContact" = COALESCE("vehicleContact", 'N/A');

ALTER TABLE "Transfer" ALTER COLUMN "driverName" SET NOT NULL;
ALTER TABLE "Transfer" ALTER COLUMN "vehicleNumber" SET NOT NULL;
ALTER TABLE "Transfer" ALTER COLUMN "vehicleContact" SET NOT NULL;

-- Drop old columns
ALTER TABLE "Transfer" DROP COLUMN "productId";
ALTER TABLE "Transfer" DROP COLUMN "quantity";

-- CreateIndex
CREATE INDEX "TransferLineItem_transferId_idx" ON "TransferLineItem"("transferId");
CREATE INDEX "TransferLineItem_productId_idx" ON "TransferLineItem"("productId");

-- AddForeignKey
ALTER TABLE "TransferLineItem" ADD CONSTRAINT "TransferLineItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
