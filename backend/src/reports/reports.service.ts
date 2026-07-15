import { Injectable } from "@nestjs/common";
import { LocationType, MovementType, TransferStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NOT_DELETED } from "../common/utils/soft-delete";
import { VELOCITY_REPORT_DAYS } from "../common/constants/product-units";

export type ProductVelocity = {
  productId: string;
  name: string;
  sku: string | null;
  category: string;
  activityScore: number;
  currentStock: number;
};

export type VelocityReport = {
  fast: ProductVelocity[];
  slow: ProductVelocity[];
  periodDays: number;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  currentInventory(filters?: { categoryId?: string; locationId?: string }) {
    return this.prisma.inventory.findMany({
      where: {
        product: {
          ...NOT_DELETED,
          ...(filters?.categoryId ? { categoryId: filters.categoryId } : {})
        },
        location: NOT_DELETED,
        ...(filters?.locationId ? { locationId: filters.locationId } : {})
      },
      include: { product: { include: { category: true } }, location: true }
    });
  }

  async velocityReport(days = VELOCITY_REPORT_DAYS): Promise<VelocityReport> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [movementActivity, transferActivity, products, inventory] = await Promise.all([
      this.prisma.stockMovement.groupBy({
        by: ["productId"],
        where: {
          createdAt: { gte: since },
          movementType: { in: [MovementType.TRANSFER, MovementType.SALE] }
        },
        _count: { id: true }
      }),
      this.prisma.transferLineItem.groupBy({
        by: ["productId"],
        where: {
          transfer: {
            status: TransferStatus.COMPLETED,
            completedAt: { gte: since }
          }
        },
        _count: { id: true }
      }),
      this.prisma.product.findMany({
        where: NOT_DELETED,
        select: {
          id: true,
          name: true,
          sku: true,
          category: { select: { name: true } }
        }
      }),
      this.prisma.inventory.groupBy({
        by: ["productId"],
        _sum: { quantity: true }
      })
    ]);

    const activityMap = new Map<string, number>();
    for (const row of movementActivity) {
      activityMap.set(row.productId, (activityMap.get(row.productId) ?? 0) + row._count.id);
    }
    for (const row of transferActivity) {
      activityMap.set(row.productId, (activityMap.get(row.productId) ?? 0) + row._count.id);
    }

    const stockMap = new Map(inventory.map((i) => [i.productId, i._sum.quantity ?? 0]));

    const scored: ProductVelocity[] = products.map((p) => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category.name,
      activityScore: activityMap.get(p.id) ?? 0,
      currentStock: stockMap.get(p.id) ?? 0
    }));

    const active = scored.filter((p) => p.activityScore > 0).sort((a, b) => b.activityScore - a.activityScore);
    const withStock = scored.filter((p) => p.currentStock > 0);

    const fastCount = Math.max(1, Math.ceil(active.length * 0.25));
    const slowPool = [...withStock].sort((a, b) => a.activityScore - b.activityScore);
    const slowCount = Math.max(1, Math.ceil(slowPool.length * 0.25));

    return {
      fast: active.slice(0, fastCount),
      slow: slowPool.slice(0, slowCount),
      periodDays: days
    };
  }
}
