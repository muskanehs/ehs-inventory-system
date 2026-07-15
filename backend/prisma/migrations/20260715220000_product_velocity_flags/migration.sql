-- Persist daily velocity classification for stock filters
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isFastMoving" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isSlowMoving" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "velocityScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "velocityComputedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Product_isFastMoving_idx" ON "Product"("isFastMoving");
CREATE INDEX IF NOT EXISTS "Product_isSlowMoving_idx" ON "Product"("isSlowMoving");
