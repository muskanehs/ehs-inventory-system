-- Performance indexes for reports, transfers, and inventory scoping
CREATE INDEX IF NOT EXISTS "Inventory_locationId_idx" ON "Inventory"("locationId");
CREATE INDEX IF NOT EXISTS "StockMovement_createdAt_movementType_idx" ON "StockMovement"("createdAt", "movementType");
CREATE INDEX IF NOT EXISTS "Transfer_status_createdAt_idx" ON "Transfer"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Transfer_completedAt_idx" ON "Transfer"("completedAt");
