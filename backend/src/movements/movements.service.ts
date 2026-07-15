import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { MovementType, Prisma, Role } from "@prisma/client";
import { InventoryService } from "../inventory/inventory.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUserPayload } from "../common/types/auth-user";
import { toPaginatedResult, type PaginatedResult } from "../common/types/paginated-result";
import { parsePagination } from "../common/utils/pagination";
import {
  assertCanMutateLocation,
  isPrivilegedInventoryRole,
  resolveLocationScope,
  movementLocationFilter
} from "../common/utils/location-scope";
import { NOT_DELETED } from "../common/utils/soft-delete";

type MoveInput = {
  productId: string;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  quantity: number;
  movementType: MovementType;
  remarks?: string;
  performedBy: string;
};

const movementInclude = {
  product: { include: { category: true } },
  user: { select: { id: true, name: true, role: true } }
} as const;

type MovementRow = Prisma.StockMovementGetPayload<{ include: typeof movementInclude }>;

@Injectable()
export class MovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService
  ) {}

  async findAll(
    user: AuthUserPayload,
    options: {
      page?: string;
      limit?: string;
      search?: string;
      locationId?: string;
    } = {}
  ): Promise<PaginatedResult<MovementRow> | MovementRow[]> {
    const locationId = resolveLocationScope(user, options.locationId);
    const { page, limit, skip, isPaginated } = parsePagination(options.page, options.limit);
    const search = options.search?.trim();

    const where: Prisma.StockMovementWhereInput = {
      ...(locationId ? movementLocationFilter(locationId) : {}),
      ...(search
        ? {
            OR: [
              { product: { name: { contains: search, mode: "insensitive" }, ...NOT_DELETED } },
              { product: { sku: { contains: search, mode: "insensitive" }, ...NOT_DELETED } },
              { user: { name: { contains: search, mode: "insensitive" }, ...NOT_DELETED } },
              { remarks: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const findArgs = {
      where,
      include: movementInclude,
      orderBy: { createdAt: "desc" as const }
    };

    if (!isPaginated) {
      return this.prisma.stockMovement.findMany({ ...findArgs, take: limit });
    }

    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({ ...findArgs, skip, take: limit }),
      this.prisma.stockMovement.count({ where })
    ]);

    return toPaginatedResult(items, total, page, limit);
  }

  findAllForExport(user: AuthUserPayload) {
    const locationId = resolveLocationScope(user);
    return this.prisma.stockMovement.findMany({
      where: locationId ? movementLocationFilter(locationId) : undefined,
      include: {
        product: { include: { category: true } },
        user: { select: { id: true, name: true, role: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  assertCanCreateMovement(user: AuthUserPayload, input: Omit<MoveInput, "performedBy">) {
    if (isPrivilegedInventoryRole(user.role)) {
      return;
    }
    if (user.role !== Role.GODOWN_MANAGER || !user.assignedLocationId) {
      throw new ForbiddenException("You cannot create stock movements");
    }
    if (input.fromLocationId) {
      assertCanMutateLocation(user, input.fromLocationId);
    }
    if (input.toLocationId) {
      assertCanMutateLocation(user, input.toLocationId);
    }
    if (!input.fromLocationId && !input.toLocationId) {
      throw new ForbiddenException("A location is required for this movement");
    }
  }

  async createMovement(input: MoveInput, actor?: AuthUserPayload) {
    if (actor) {
      this.assertCanCreateMovement(actor, input);
    }

    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, ...NOT_DELETED }
    });
    if (!product) {
      throw new BadRequestException("Product not found");
    }

    if (input.fromLocationId) {
      const fromLocation = await this.prisma.location.findFirst({
        where: { id: input.fromLocationId, ...NOT_DELETED }
      });
      if (!fromLocation) {
        throw new BadRequestException("Source location not found");
      }
    }

    if (input.toLocationId) {
      const toLocation = await this.prisma.location.findFirst({
        where: { id: input.toLocationId, ...NOT_DELETED }
      });
      if (!toLocation) {
        throw new BadRequestException("Destination location not found");
      }
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (input.fromLocationId) {
        await this.inventoryService.applyDeltaTx(tx, input.productId, input.fromLocationId, -input.quantity);
      }
      if (input.toLocationId) {
        await this.inventoryService.applyDeltaTx(tx, input.productId, input.toLocationId, input.quantity);
      }
      return tx.stockMovement.create({
        data: {
          productId: input.productId,
          fromLocationId: input.fromLocationId,
          toLocationId: input.toLocationId,
          quantity: input.quantity,
          movementType: input.movementType,
          remarks: input.remarks,
          performedBy: input.performedBy
        },
        include: {
          product: { include: { category: true } },
          user: { select: { id: true, name: true, role: true } }
        }
      });
    });
  }
}
