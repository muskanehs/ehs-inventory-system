import type { InventoryItem, StockMovement, Transfer } from "@/lib/types";

export function filterInventoryByLocation(
  inventory: InventoryItem[],
  locationId: string | null | undefined
): InventoryItem[] {
  if (!locationId) return inventory;
  return inventory.filter((item) => item.locationId === locationId);
}

export function filterTransfersByLocation(
  transfers: Transfer[],
  locationId: string | null | undefined
): Transfer[] {
  if (!locationId) return transfers;
  return transfers.filter(
    (transfer) =>
      transfer.fromLocationId === locationId || transfer.toLocationId === locationId
  );
}

export function filterMovementsByLocation(
  movements: StockMovement[],
  locationId: string | null | undefined
): StockMovement[] {
  if (!locationId) return movements;
  return movements.filter(
    (movement) =>
      movement.fromLocationId === locationId || movement.toLocationId === locationId
  );
}

export function buildStockByProductAtLocation(
  inventory: InventoryItem[],
  locationId: string
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of inventory) {
    if (item.locationId !== locationId) continue;
    map.set(item.productId, item.quantity);
  }
  return map;
}
