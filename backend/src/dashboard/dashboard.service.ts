import { Injectable } from "@nestjs/common";
import { Prisma, TransferStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUserPayload } from "../common/types/auth-user";
import { resolveLocationScope, transferLocationFilter } from "../common/utils/location-scope";
import { NOT_DELETED } from "../common/utils/soft-delete";

export type DashboardSummary = {
  totalProducts: number;
  totalStockUnits: number;
  lowStockCount: number;
  locationCount: number;
  pendingTransfers: number;
  lowStockItems: {
    product: {
      id: string;
      name: string;
      sku: string | null;
      unit: string;
      minimumStockLevel: number;
      category?: { id: string; name: string } | null;
    };
    totalQuantity: number;
  }[];
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(user: AuthUserPayload, requestedLocationId?: string): Promise<DashboardSummary> {
    const locationId = resolveLocationScope(user, requestedLocationId);
    const inventoryWhere: Prisma.InventoryWhereInput = {
      product: NOT_DELETED,
      location: NOT_DELETED,
      ...(locationId ? { locationId } : {})
    };
    const transferWhere: Prisma.TransferWhereInput = locationId
      ? transferLocationFilter(locationId)
      : {};

    const [inventoryAgg, locationCount, pendingTransfers, productsWithMin, inventoryByProduct] =
      await Promise.all([
        this.prisma.inventory.aggregate({
          where: inventoryWhere,
          _sum: { quantity: true }
        }),
        locationId
          ? Promise.resolve(1)
          : this.prisma.inventory
              .groupBy({
                by: ["locationId"],
                where: { quantity: { gt: 0 }, product: NOT_DELETED, location: NOT_DELETED }
              })
              .then((rows) => rows.length),
        this.prisma.transfer.count({
          where: { ...transferWhere, status: TransferStatus.PENDING }
        }),
        this.prisma.product.findMany({
          where: { isActive: true, ...NOT_DELETED, minimumStockLevel: { gt: 0 } },
          include: { category: true }
        }),
        this.prisma.inventory.groupBy({
          by: ["productId"],
          where: inventoryWhere,
          _sum: { quantity: true }
        })
      ]);

    const quantityByProduct = new Map(
      inventoryByProduct.map((row) => [row.productId, row._sum.quantity ?? 0])
    );

    const lowStockAll = productsWithMin
      .filter((product) => {
        const total = quantityByProduct.get(product.id) ?? 0;
        return total <= product.minimumStockLevel;
      })
      .map((product) => ({
        product,
        totalQuantity: quantityByProduct.get(product.id) ?? 0
      }))
      .sort((a, b) => a.totalQuantity - b.totalQuantity);

    const totalProducts = locationId
      ? quantityByProduct.size
      : await this.prisma.product.count({ where: { isActive: true, ...NOT_DELETED } });

    return {
      totalProducts,
      totalStockUnits: inventoryAgg._sum.quantity ?? 0,
      lowStockCount: lowStockAll.length,
      locationCount,
      pendingTransfers,
      lowStockItems: lowStockAll.slice(0, 3)
    };
  }
}
