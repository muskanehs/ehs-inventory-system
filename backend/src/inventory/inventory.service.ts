import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUserPayload } from "../common/types/auth-user";
import { toPaginatedResult, type PaginatedResult } from "../common/types/paginated-result";
import { parsePagination } from "../common/utils/pagination";
import { resolveInventoryScope } from "../common/utils/location-scope";
import { NOT_DELETED } from "../common/utils/soft-delete";

export type StockListFilter = "all" | "low" | "fast" | "slow";

export type ProductStockGroup = {
  product: Prisma.ProductGetPayload<{ include: { category: true } }>;
  totalQuantity: number;
  storeTotal: number;
  godownTotal: number;
  items: Prisma.InventoryGetPayload<{ include: { location: true } }>[];
  isLowStock: boolean;
};

function parseStockFilter(value?: string): StockListFilter {
  if (value === "low" || value === "fast" || value === "slow") return value;
  return "all";
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: AuthUserPayload, requestedLocationId?: string) {
    const locationId = resolveInventoryScope(user, requestedLocationId);
    return this.prisma.inventory.findMany({
      where: {
        product: NOT_DELETED,
        location: NOT_DELETED,
        ...(locationId ? { locationId } : {})
      },
      include: { product: { include: { category: true } }, location: true }
    });
  }

  async findGrouped(
    user: AuthUserPayload,
    options: {
      page?: string;
      limit?: string;
      search?: string;
      locationId?: string;
      filter?: string;
    }
  ): Promise<PaginatedResult<ProductStockGroup> | ProductStockGroup[]> {
    const scopeLocationId = resolveInventoryScope(user, options.locationId);
    const { page, limit, skip, isPaginated } = parsePagination(options.page, options.limit);
    const search = options.search?.trim();
    const stockFilter = parseStockFilter(options.filter);

    const searchWhere: Prisma.ProductWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } }
          ]
        }
      : {};

    const productWhere: Prisma.ProductWhereInput = {
      ...NOT_DELETED,
      ...searchWhere
    };

    if (stockFilter === "fast") {
      productWhere.isFastMoving = true;
    } else if (stockFilter === "slow") {
      productWhere.isSlowMoving = true;
    } else if (stockFilter === "low") {
      const lowIds = await this.findLowStockProductIds(scopeLocationId, searchWhere);
      if (lowIds.length === 0) {
        if (!isPaginated) return [];
        return toPaginatedResult([], 0, page, limit);
      }
      productWhere.id = { in: lowIds };
    }

    const [products, total, locations] = await Promise.all([
      this.prisma.product.findMany({
        where: productWhere,
        include: {
          category: true,
          inventory: {
            include: { location: true },
            ...(scopeLocationId ? { where: { locationId: scopeLocationId } } : {})
          }
        },
        orderBy: { name: "asc" },
        ...(isPaginated ? { skip, take: limit } : {})
      }),
      this.prisma.product.count({ where: productWhere }),
      this.prisma.location.findMany({ where: NOT_DELETED, orderBy: { name: "asc" } })
    ]);

    const groups = products.map((product) => this.toProductStockGroup(product, locations));

    if (!isPaginated) {
      return groups;
    }

    return toPaginatedResult(groups, total, page, limit);
  }

  private async findLowStockProductIds(
    scopeLocationId: string | undefined,
    searchWhere: Prisma.ProductWhereInput
  ): Promise<string[]> {
    const products = await this.prisma.product.findMany({
      where: {
        ...NOT_DELETED,
        minimumStockLevel: { gt: 0 },
        ...searchWhere
      },
      select: { id: true, minimumStockLevel: true }
    });
    if (products.length === 0) return [];

    const inventory = await this.prisma.inventory.groupBy({
      by: ["productId"],
      where: {
        productId: { in: products.map((p) => p.id) },
        ...(scopeLocationId ? { locationId: scopeLocationId } : {})
      },
      _sum: { quantity: true }
    });
    const qtyByProduct = new Map(inventory.map((row) => [row.productId, row._sum.quantity ?? 0]));

    return products
      .filter((product) => (qtyByProduct.get(product.id) ?? 0) <= product.minimumStockLevel)
      .map((product) => product.id);
  }

  private toProductStockGroup(
    product: Prisma.ProductGetPayload<{
      include: {
        category: true;
        inventory: { include: { location: true } };
      };
    }>,
    locations: Prisma.LocationGetPayload<object>[]
  ): ProductStockGroup {
    const quantityByLocation = new Map(product.inventory.map((row) => [row.locationId, row.quantity]));
    const storeLocations = locations.filter((l) => l.type === "STORE");
    const godownLocations = locations.filter((l) => l.type === "GODOWN");

    const storeTotal = storeLocations.reduce(
      (sum, loc) => sum + (quantityByLocation.get(loc.id) ?? 0),
      0
    );
    const godownTotal = godownLocations.reduce(
      (sum, loc) => sum + (quantityByLocation.get(loc.id) ?? 0),
      0
    );
    const totalQuantity = product.inventory.reduce((sum, row) => sum + row.quantity, 0);
    const isLowStock =
      product.minimumStockLevel > 0 && totalQuantity <= product.minimumStockLevel;

    return {
      product,
      totalQuantity,
      storeTotal,
      godownTotal,
      items: product.inventory,
      isLowStock
    };
  }

  async applyDeltaTx(
    tx: Prisma.TransactionClient,
    productId: string,
    locationId: string,
    delta: number
  ) {
    const existing = await tx.inventory.findUnique({
      where: { productId_locationId: { productId, locationId } }
    });
    const newQty = (existing?.quantity ?? 0) + delta;
    if (newQty < 0) throw new BadRequestException("Negative inventory is not allowed");
    return tx.inventory.upsert({
      where: { productId_locationId: { productId, locationId } },
      create: { productId, locationId, quantity: newQty },
      update: { quantity: newQty }
    });
  }
}
