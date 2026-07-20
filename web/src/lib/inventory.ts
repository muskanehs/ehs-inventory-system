import type { ApiProductStockGroup, InventoryItem, Location, Product } from "@/lib/types";

export type ProductStockGroup = {
  product: Product;
  totalQuantity: number;
  storeTotal: number;
  godownTotal: number;
  storeLocations: { location: Location; quantity: number }[];
  godownLocations: { location: Location; quantity: number }[];
  isLowStock: boolean;
};

export function groupInventoryByProduct(
  inventory: InventoryItem[],
  locations: Location[]
): ProductStockGroup[] {
  const byProduct = new Map<string, InventoryItem[]>();
  for (const item of inventory) {
    const list = byProduct.get(item.productId) ?? [];
    list.push(item);
    byProduct.set(item.productId, list);
  }

  const quantityByProductLocation = new Map<string, number>();
  for (const item of inventory) {
    quantityByProductLocation.set(`${item.productId}:${item.locationId}`, item.quantity);
  }

  const groups: ProductStockGroup[] = [];

  for (const [, items] of byProduct) {
    const product = items[0].product;
    const storeLocations = locations
      .filter((l) => l.type === "STORE")
      .map((location) => ({
        location,
        quantity: quantityByProductLocation.get(`${product.id}:${location.id}`) ?? 0
      }));
    const godownLocations = locations
      .filter((l) => l.type === "GODOWN")
      .map((location) => ({
        location,
        quantity: quantityByProductLocation.get(`${product.id}:${location.id}`) ?? 0
      }));

    const storeTotal = storeLocations.reduce((sum, row) => sum + row.quantity, 0);
    const godownTotal = godownLocations.reduce((sum, row) => sum + row.quantity, 0);
    const totalQuantity = storeTotal + godownTotal;
    const isLowStock =
      product.minimumStockLevel > 0 &&
      items.some((i) => i.quantity <= product.minimumStockLevel);

    groups.push({
      product,
      totalQuantity,
      storeTotal,
      godownTotal,
      storeLocations,
      godownLocations,
      isLowStock
    });
  }

  return groups.sort((a, b) => a.product.name.localeCompare(b.product.name));
}

export function mapApiProductStockGroup(
  group: ApiProductStockGroup,
  locations: Location[]
): ProductStockGroup {
  const quantityByLocation = new Map(group.items.map((item) => [item.locationId, item.quantity]));

  // Merge catalog locations with any locations embedded on inventory rows so
  // godown-scoped location lists still render other sites in "entire stock" view.
  const locationById = new Map<string, Location>();
  for (const location of locations) {
    locationById.set(location.id, location);
  }
  for (const item of group.items) {
    if (item.location && !locationById.has(item.location.id)) {
      locationById.set(item.location.id, item.location);
    }
  }
  const allLocations = Array.from(locationById.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const storeLocations = allLocations
    .filter((l) => l.type === "STORE")
    .map((location) => ({
      location,
      quantity: quantityByLocation.get(location.id) ?? 0
    }));
  const godownLocations = allLocations
    .filter((l) => l.type === "GODOWN")
    .map((location) => ({
      location,
      quantity: quantityByLocation.get(location.id) ?? 0
    }));

  return {
    product: group.product,
    totalQuantity: group.totalQuantity,
    storeTotal: group.storeTotal,
    godownTotal: group.godownTotal,
    storeLocations,
    godownLocations,
    isLowStock: group.isLowStock
  };
}
