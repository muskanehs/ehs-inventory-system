import { Injectable, Logger } from "@nestjs/common";
import { MovementType, TransferStatus } from "@prisma/client";
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
  private readonly logger = new Logger(ReportsService.name);

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

  /**
   * Stock export: every non-deleted product (and locations), including quantity 0
   * when there is no inventory row. Used only by inventory/export.
   */
  async currentInventoryForExport(filters?: { categoryId?: string; locationId?: string }) {
    const [products, locations, inventory] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          ...NOT_DELETED,
          ...(filters?.categoryId ? { categoryId: filters.categoryId } : {})
        },
        include: { category: true },
        orderBy: { name: "asc" }
      }),
      this.prisma.location.findMany({
        where: {
          ...NOT_DELETED,
          ...(filters?.locationId ? { id: filters.locationId } : {})
        },
        orderBy: { name: "asc" }
      }),
      this.prisma.inventory.findMany({
        where: {
          product: {
            ...NOT_DELETED,
            ...(filters?.categoryId ? { categoryId: filters.categoryId } : {})
          },
          location: NOT_DELETED,
          ...(filters?.locationId ? { locationId: filters.locationId } : {})
        }
      })
    ]);

    const qtyByKey = new Map(
      inventory.map((row) => [`${row.productId}:${row.locationId}`, row.quantity])
    );

    type ExportRow = {
      product: (typeof products)[number];
      location: (typeof locations)[number] | null;
      quantity: number;
    };

    const rows: ExportRow[] = [];

    if (locations.length === 0) {
      for (const product of products) {
        rows.push({ product, location: null, quantity: 0 });
      }
      return rows;
    }

    for (const product of products) {
      let hasAnyRow = false;
      for (const location of locations) {
        const key = `${product.id}:${location.id}`;
        if (qtyByKey.has(key)) {
          hasAnyRow = true;
          rows.push({
            product,
            location,
            quantity: qtyByKey.get(key) ?? 0
          });
        }
      }

      // Product never stocked at any selected location — still include with qty 0
      if (!hasAnyRow) {
        if (filters?.locationId) {
          const location = locations[0] ?? null;
          rows.push({ product, location, quantity: 0 });
        } else {
          rows.push({ product, location: null, quantity: 0 });
        }
      }
    }

    return rows;
  }

  async velocityReport(days = VELOCITY_REPORT_DAYS): Promise<VelocityReport> {
    const report = await this.computeVelocity(days);
    return {
      fast: report.fast,
      slow: report.slow,
      periodDays: days
    };
  }

  /** Compute last-N-day velocity and persist flags used by stock filters. */
  async refreshVelocitySnapshot(days = VELOCITY_REPORT_DAYS): Promise<VelocityReport> {
    const report = await this.computeVelocity(days);
    const computedAt = new Date();
    const fastIds = report.fast.map((p) => p.productId);
    const slowIds = report.slow.map((p) => p.productId);
    const scored = [...report.fast, ...report.slow];

    await this.prisma.$transaction(async (tx) => {
      await tx.product.updateMany({
        where: NOT_DELETED,
        data: {
          isFastMoving: false,
          isSlowMoving: false,
          velocityScore: 0,
          velocityComputedAt: computedAt
        }
      });

      if (fastIds.length > 0) {
        await tx.product.updateMany({
          where: { id: { in: fastIds } },
          data: { isFastMoving: true }
        });
      }
      if (slowIds.length > 0) {
        await tx.product.updateMany({
          where: { id: { in: slowIds } },
          data: { isSlowMoving: true }
        });
      }

      for (const item of scored) {
        await tx.product.update({
          where: { id: item.productId },
          data: { velocityScore: item.activityScore }
        });
      }
    });

    this.logger.log(
      `Velocity snapshot refreshed (days=${days}): fast=${fastIds.length}, slow=${slowIds.length}`
    );

    return {
      fast: report.fast,
      slow: report.slow,
      periodDays: days
    };
  }

  private async computeVelocity(days: number): Promise<{
    fast: ProductVelocity[];
    slow: ProductVelocity[];
  }> {
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

    const active = scored
      .filter((p) => p.activityScore > 0)
      .sort((a, b) => b.activityScore - a.activityScore);
    const withStock = scored.filter((p) => p.currentStock > 0);

    const fastCount = Math.max(1, Math.ceil(active.length * 0.25));
    const slowPool = [...withStock].sort((a, b) => a.activityScore - b.activityScore);
    const slowCount = Math.max(1, Math.ceil(slowPool.length * 0.25));

    return {
      fast: active.length === 0 ? [] : active.slice(0, fastCount),
      slow: slowPool.length === 0 ? [] : slowPool.slice(0, slowCount)
    };
  }
}
