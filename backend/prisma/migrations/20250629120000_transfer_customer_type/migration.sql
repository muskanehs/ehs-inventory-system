-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('INTERNAL', 'CUSTOMER');

-- AlterTable
ALTER TABLE "Transfer" ADD COLUMN "transferType" "TransferType" NOT NULL DEFAULT 'INTERNAL';
ALTER TABLE "Transfer" ADD COLUMN "customerName" TEXT;
ALTER TABLE "Transfer" ADD COLUMN "customerPhone" TEXT;
ALTER TABLE "Transfer" ADD COLUMN "customerAddress" TEXT;
ALTER TABLE "Transfer" ALTER COLUMN "toLocationId" DROP NOT NULL;
ALTER TABLE "Transfer" ALTER COLUMN "driverName" DROP NOT NULL;
ALTER TABLE "Transfer" ALTER COLUMN "vehicleNumber" DROP NOT NULL;
ALTER TABLE "Transfer" ALTER COLUMN "vehicleContact" DROP NOT NULL;
