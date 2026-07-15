-- Make product SKU optional (nullable).
ALTER TABLE "Product" ALTER COLUMN "sku" DROP NOT NULL;
