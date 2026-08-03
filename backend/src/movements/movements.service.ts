import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
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
        include: movementInclude
      });
    });
  }

  async createBatchMovements(
    input: {
      toLocationId: string;
      movementType: MovementType;
      remarks?: string;
      items: { productId: string; quantity: number }[];
      performedBy: string;
    },
    actor: AuthUserPayload
  ) {
    if (input.items.length === 0) {
      throw new BadRequestException("Add at least one product");
    }

    this.assertCanCreateMovement(actor, {
      productId: input.items[0].productId,
      toLocationId: input.toLocationId,
      quantity: input.items[0].quantity,
      movementType: input.movementType
    });

    const productIds = input.items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException("Each product can only appear once");
    }

    const toLocation = await this.prisma.location.findFirst({
      where: { id: input.toLocationId, ...NOT_DELETED }
    });
    if (!toLocation) {
      throw new BadRequestException("Destination location not found");
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, ...NOT_DELETED },
      select: { id: true }
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException("One or more products were not found");
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = [];
      for (const item of input.items) {
        await this.inventoryService.applyDeltaTx(
          tx,
          item.productId,
          input.toLocationId,
          item.quantity
        );
        const movement = await tx.stockMovement.create({
          data: {
            productId: item.productId,
            toLocationId: input.toLocationId,
            quantity: item.quantity,
            movementType: input.movementType,
            remarks: input.remarks,
            performedBy: input.performedBy
          },
          include: movementInclude
        });
        created.push(movement);
      }
      return created;
    });
  }

  async updateQuantity(id: string, quantity: number, actor: AuthUserPayload) {
    const movement = await this.prisma.stockMovement.findUnique({
      where: { id },
      include: movementInclude
    });
    if (!movement) {
      throw new NotFoundException("Stock entry not found");
    }

    const editableTypes: MovementType[] = [
      MovementType.PURCHASE,
      MovementType.RETURN,
      MovementType.ADJUSTMENT
    ];
    if (!editableTypes.includes(movement.movementType)) {
      throw new BadRequestException("Only purchase, return, and adjustment entries can be edited");
    }

    this.assertCanCreateMovement(actor, {
      productId: movement.productId,
      fromLocationId: movement.fromLocationId,
      toLocationId: movement.toLocationId,
      quantity,
      movementType: movement.movementType
    });

    if (quantity === movement.quantity) {
      return movement;
    }

    const delta = quantity - movement.quantity;

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Reverse original effect by the difference: new inventory = old + (newQty - oldQty) on destination,
      // and opposite on source when present.
      if (movement.fromLocationId) {
        await this.inventoryService.applyDeltaTx(
          tx,
          movement.productId,
          movement.fromLocationId,
          -delta
        );
      }
      if (movement.toLocationId) {
        await this.inventoryService.applyDeltaTx(
          tx,
          movement.productId,
          movement.toLocationId,
          delta
        );
      }

      return tx.stockMovement.update({
        where: { id },
        data: { quantity },
        include: movementInclude
      });
    });
  }
}
