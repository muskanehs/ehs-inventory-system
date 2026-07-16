import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { toPaginatedResult, type PaginatedResult } from "../common/types/paginated-result";
import { parsePagination } from "../common/utils/pagination";
import { NOT_DELETED, restoreData, softDeleteData, withNotDeleted } from "../common/utils/soft-delete";

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private productInclude = { category: true } as const;

  async findAll(
    search?: string,
    page?: string,
    limit?: string,
    includeDeleted = false
  ): Promise<
    | PaginatedResult<Prisma.ProductGetPayload<{ include: { category: true } }>>
    | Prisma.ProductGetPayload<{ include: { category: true } }>[]
  > {
    const query = search?.trim();
    const { page: parsedPage, limit: parsedLimit, skip, isPaginated } = parsePagination(page, limit);

    const searchFilter: Prisma.ProductWhereInput | undefined = query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { sku: { contains: query, mode: "insensitive" } }
          ]
        }
      : undefined;

    const where = includeDeleted ? searchFilter : withNotDeleted(searchFilter);

    const findArgs = {
      where,
      include: this.productInclude,
      orderBy: { name: "asc" as const }
    };

    if (!isPaginated) {
      return this.prisma.product.findMany(findArgs);
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({ ...findArgs, skip, take: parsedLimit }),
      this.prisma.product.count({ where })
    ]);

    return toPaginatedResult(items, total, parsedPage, parsedLimit);
  }

  async findOne(id: string, includeDeleted = false) {
    const product = await this.prisma.product.findFirst({
      where: includeDeleted ? { id } : { id, ...NOT_DELETED },
      include: this.productInclude
    });
    if (!product) {
      throw new NotFoundException("Product not found");
    }
    return product;
  }

  private normalizeSku(sku?: string | null) {
    const trimmed = sku?.trim();
    return trimmed ? trimmed : null;
  }

  async create(dto: CreateProductDto) {
    const name = dto.name.trim();
    const sku = this.normalizeSku(dto.sku);

    if (sku) {
      const existingSku = await this.prisma.product.findFirst({
        where: { sku, ...NOT_DELETED }
      });
      if (existingSku) {
        throw new ConflictException(`A product with SKU "${sku}" already exists`);
      }
    }

    const existingName = await this.prisma.product.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, ...NOT_DELETED }
    });
    if (existingName) {
      throw new ConflictException(`A product named "${name}" already exists`);
    }

    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, ...NOT_DELETED }
    });
    if (!category) {
      throw new NotFoundException("Category not found");
    }

    const deletedMatch = await this.findDeletedProductMatch(name, sku);
    if (deletedMatch) {
      return this.reactivateFromCreate(deletedMatch.id, dto);
    }

    return this.prisma.product.create({
      data: {
        name,
        sku,
        categoryId: dto.categoryId,
        unit: dto.unit.trim(),
        minimumStockLevel: dto.minimumStockLevel ?? 0
      },
      include: this.productInclude
    });
  }

  private async findDeletedProductMatch(name: string, sku: string | null) {
    if (sku) {
      const bySku = await this.prisma.product.findFirst({
        where: { sku, isDeleted: true }
      });
      if (bySku) return bySku;
    }

    return this.prisma.product.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, isDeleted: true }
    });
  }

  private async reactivateFromCreate(id: string, dto: CreateProductDto) {
    const name = dto.name.trim();
    const sku = this.normalizeSku(dto.sku);

    if (sku) {
      const skuConflict = await this.prisma.product.findFirst({
        where: { sku, NOT: { id }, ...NOT_DELETED }
      });
      if (skuConflict) {
        throw new ConflictException(`A product with SKU "${sku}" already exists`);
      }
    }

    const nameConflict = await this.prisma.product.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, NOT: { id }, ...NOT_DELETED }
    });
    if (nameConflict) {
      throw new ConflictException(`A product named "${name}" already exists`);
    }

    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, ...NOT_DELETED }
    });
    if (!category) {
      throw new NotFoundException("Category not found");
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...restoreData(),
        name,
        sku,
        categoryId: dto.categoryId,
        unit: dto.unit.trim(),
        minimumStockLevel: dto.minimumStockLevel ?? 0
      },
      include: this.productInclude
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);

    const nextName = dto.name !== undefined ? dto.name.trim() : undefined;
    if (nextName) {
      const existingName = await this.prisma.product.findFirst({
        where: { name: { equals: nextName, mode: "insensitive" }, NOT: { id }, ...NOT_DELETED }
      });
      if (existingName) {
        throw new ConflictException(`A product named "${nextName}" already exists`);
      }
    }

    const nextSku = dto.sku !== undefined ? this.normalizeSku(dto.sku) : undefined;
    if (nextSku) {
      const existing = await this.prisma.product.findFirst({
        where: { sku: nextSku, NOT: { id }, ...NOT_DELETED }
      });
      if (existing) {
        throw new ConflictException(`A product with SKU "${nextSku}" already exists`);
      }
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, ...NOT_DELETED }
      });
      if (!category) {
        throw new NotFoundException("Category not found");
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: nextName }),
        ...(nextSku !== undefined && { sku: nextSku }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.unit !== undefined && { unit: dto.unit.trim() }),
        ...(dto.minimumStockLevel !== undefined && { minimumStockLevel: dto.minimumStockLevel })
      },
      include: this.productInclude
    });
  }

  async remove(id: string, deletedBy?: string) {
    await this.findOne(id);

    const stockCount = await this.prisma.inventory.count({
      where: { productId: id, quantity: { gt: 0 } }
    });
    if (stockCount > 0) {
      throw new ConflictException(
        "Cannot delete product with existing stock. Clear stock first."
      );
    }

    const transferRefs = await this.prisma.transferLineItem.count({
      where: { productId: id }
    });
    if (transferRefs > 0) {
      throw new ConflictException(
        "Cannot delete product referenced in transfer history."
      );
    }

    return this.prisma.product.update({
      where: { id },
      data: softDeleteData(deletedBy),
      include: this.productInclude
    });
  }

  async findPicker(locationId?: string, search?: string, limit = 30) {
    const parsedLimit = Math.min(50, Math.max(1, limit));
    const query = search?.trim();

    const where: Prisma.ProductWhereInput = {
      ...NOT_DELETED,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { sku: { contains: query, mode: "insensitive" } }
            ]
          }
        : {}),
      ...(locationId
        ? { inventory: { some: { locationId, quantity: { gt: 0 } } } }
        : {})
    };

    const products = await this.prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        inventory: locationId
          ? { where: { locationId }, select: { quantity: true }, take: 1 }
          : undefined
      },
      orderBy: { name: "asc" },
      take: parsedLimit
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      availableQty: locationId ? (product.inventory?.[0]?.quantity ?? 0) : undefined
    }));
  }

  async restore(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, isDeleted: true },
      include: this.productInclude
    });
    if (!product) {
      throw new NotFoundException("Deleted product not found");
    }

    if (product.sku) {
      const skuConflict = await this.prisma.product.findFirst({
        where: { sku: product.sku, NOT: { id }, ...NOT_DELETED }
      });
      if (skuConflict) {
        throw new ConflictException(`Cannot restore: SKU "${product.sku}" is already in use`);
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: restoreData(),
      include: this.productInclude
    });
  }
}
