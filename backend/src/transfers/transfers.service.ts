import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { MovementType, Prisma, Role, TransferStatus, TransferType } from "@prisma/client";
import { MovementsService } from "../movements/movements.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTransferDto } from "./dto/create-transfer.dto";
import type { AuthUserPayload } from "../common/types/auth-user";
import { toPaginatedResult, type PaginatedResult } from "../common/types/paginated-result";
import { parsePagination } from "../common/utils/pagination";
import {
  assertCanAccessTransferLocations,
  assertCanCreateTransferFrom,
  resolveLocationScope,
  transferLocationFilter
} from "../common/utils/location-scope";
import { NOT_DELETED } from "../common/utils/soft-delete";

type TransferWithItems = Prisma.TransferGetPayload<{ include: { items: true } }>;

type HydratedTransferItem = TransferWithItems["items"][number] & {
  product: Prisma.ProductGetPayload<{ include: { category: true } }> | null;
};

export type HydratedTransfer = Omit<TransferWithItems, "items"> & {
  items: HydratedTransferItem[];
  fromLocation: Prisma.LocationGetPayload<object> | null;
  toLocation: Prisma.LocationGetPayload<object> | null;
  requestedByUser: { id: string; name: string; role: string } | null;
  approvedByUser: { id: string; name: string; role: string } | null;
};

export type TransferListOptions = {
  page?: string;
  limit?: string;
  status?: string;
  fromLocationId?: string;
  toLocationId?: string;
  search?: string;
  days?: string;
  locationId?: string;
};

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movementsService: MovementsService
  ) {}

  async findAll(
    user: AuthUserPayload,
    options: TransferListOptions = {}
  ): Promise<PaginatedResult<HydratedTransfer> | HydratedTransfer[]> {
    const scopeLocationId = resolveLocationScope(user, options.locationId);
    const { page, limit, skip, isPaginated } = parsePagination(options.page, options.limit);
    const search = options.search?.trim().toLowerCase();
    const days = options.days ? Number(options.days) : undefined;

    const baseWhere: Prisma.TransferWhereInput = {
      ...(scopeLocationId ? transferLocationFilter(scopeLocationId) : {}),
      ...(options.status && options.status !== "all"
        ? { status: options.status as TransferStatus }
        : {}),
      ...(options.fromLocationId && options.fromLocationId !== "all"
        ? { fromLocationId: options.fromLocationId }
        : {}),
      ...(options.toLocationId && options.toLocationId !== "all"
        ? { toLocationId: options.toLocationId }
        : {}),
      ...(days && Number.isFinite(days)
        ? { createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } }
        : {})
    };

    const where: Prisma.TransferWhereInput = search
      ? { AND: [baseWhere, await this.buildSearchFilter(search)] }
      : baseWhere;

    const transfers = await this.prisma.transfer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { items: true },
      ...(isPaginated ? { skip, take: limit } : {})
    });

    const hydrated = await this.hydrateTransfers(transfers);

    if (!isPaginated) {
      return hydrated;
    }

    const total = await this.prisma.transfer.count({ where });
    return toPaginatedResult(hydrated, total, page, limit);
  }

  private async buildSearchFilter(search: string): Promise<Prisma.TransferWhereInput> {
    const term = search.trim();
    const [matchingUsers, matchingLocations, matchingProducts] = await Promise.all([
      this.prisma.user.findMany({
        where: { name: { contains: term, mode: "insensitive" }, ...NOT_DELETED },
        select: { id: true }
      }),
      this.prisma.location.findMany({
        where: { name: { contains: term, mode: "insensitive" }, ...NOT_DELETED },
        select: { id: true }
      }),
      this.prisma.product.findMany({
        where: {
          ...NOT_DELETED,
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { sku: { contains: term, mode: "insensitive" } }
          ]
        },
        select: { id: true }
      })
    ]);

    const orConditions: Prisma.TransferWhereInput[] = [
      { driverName: { contains: term, mode: "insensitive" } },
      { vehicleNumber: { contains: term, mode: "insensitive" } },
      { customerName: { contains: term, mode: "insensitive" } },
      { customerPhone: { contains: term, mode: "insensitive" } }
    ];

    if (matchingUsers.length > 0) {
      const userIds = matchingUsers.map((user) => user.id);
      orConditions.push({ requestedBy: { in: userIds } });
      orConditions.push({ approvedBy: { in: userIds } });
    }

    if (matchingLocations.length > 0) {
      const locationIds = matchingLocations.map((location) => location.id);
      orConditions.push({ fromLocationId: { in: locationIds } });
      orConditions.push({ toLocationId: { in: locationIds } });
    }

    if (matchingProducts.length > 0) {
      orConditions.push({
        items: { some: { productId: { in: matchingProducts.map((product) => product.id) } } }
      });
    }

    return { OR: orConditions };
  }

  async findOne(id: string, user?: AuthUserPayload): Promise<HydratedTransfer> {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!transfer) {
      throw new NotFoundException("Transfer not found");
    }

    if (user) {
      assertCanAccessTransferLocations(user, transfer.fromLocationId, transfer.toLocationId);
    }

    const [hydrated] = await this.hydrateTransfers([transfer]);
    return hydrated;
  }

  async findAllForExport(user: AuthUserPayload): Promise<HydratedTransfer[]> {
    const result = await this.findAll(user);
    return Array.isArray(result) ? result : result.items;
  }

  async getStats(user: AuthUserPayload) {
    const scopeLocationId = resolveLocationScope(user);
    const where: Prisma.TransferWhereInput = scopeLocationId
      ? transferLocationFilter(scopeLocationId)
      : {};

    const [pending, approved, completed, rejected] = await Promise.all([
      this.prisma.transfer.count({ where: { ...where, status: TransferStatus.PENDING } }),
      this.prisma.transfer.count({ where: { ...where, status: TransferStatus.APPROVED } }),
      this.prisma.transfer.count({ where: { ...where, status: TransferStatus.COMPLETED } }),
      this.prisma.transfer.count({ where: { ...where, status: TransferStatus.REJECTED } })
    ]);

    return { pending, approved, completed, rejected };
  }

  private async hydrateTransfers(transfers: TransferWithItems[]): Promise<HydratedTransfer[]> {
    if (transfers.length === 0) return [];

    const productIds = [...new Set(transfers.flatMap((t) => t.items.map((i) => i.productId)))];
    const locationIds = [
      ...new Set(
        transfers.flatMap((t) =>
          [t.fromLocationId, t.toLocationId].filter((id): id is string => Boolean(id))
        )
      )
    ];
    const userIds = [
      ...new Set(
        transfers.flatMap((t) =>
          [t.requestedBy, t.approvedBy].filter((id): id is string => Boolean(id))
        )
      )
    ];

    const [products, locations, users] = await Promise.all([
      productIds.length
        ? this.prisma.product.findMany({
            where: { id: { in: productIds } },
            include: { category: true }
          })
        : [],
      locationIds.length
        ? this.prisma.location.findMany({ where: { id: { in: locationIds } } })
        : [],
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, role: true }
          })
        : []
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const locationMap = new Map(locations.map((l) => [l.id, l]));
    const userMap = new Map(users.map((u) => [u.id, u]));

    return transfers.map((transfer) => ({
      ...transfer,
      items: transfer.items.map((item) => ({
        ...item,
        product: productMap.get(item.productId) ?? null
      })),
      fromLocation: locationMap.get(transfer.fromLocationId) ?? null,
      toLocation: transfer.toLocationId ? locationMap.get(transfer.toLocationId) ?? null : null,
      requestedByUser: userMap.get(transfer.requestedBy) ?? null,
      approvedByUser: transfer.approvedBy ? userMap.get(transfer.approvedBy) ?? null : null
    })) as HydratedTransfer[];
  }

  async createRequest(
    data: CreateTransferDto & { requestedBy: string },
    user: AuthUserPayload
  ) {
    assertCanCreateTransferFrom(user, data.fromLocationId);

    const transferType = data.transferType ?? TransferType.INTERNAL;

    if (transferType === TransferType.INTERNAL) {
      if (!data.toLocationId) {
        throw new BadRequestException("Destination location is required for internal transfers");
      }
      if (data.fromLocationId === data.toLocationId) {
        throw new BadRequestException("Source and destination locations must be different");
      }
    }

    const productIds = data.items.map((i) => i.productId);
    const uniqueIds = new Set(productIds);
    if (uniqueIds.size !== productIds.length) {
      throw new BadRequestException("Duplicate products in transfer items are not allowed");
    }

    const [fromLocation, toLocation, activeProducts] = await Promise.all([
      this.prisma.location.findFirst({
        where: { id: data.fromLocationId, ...NOT_DELETED }
      }),
      data.toLocationId
        ? this.prisma.location.findFirst({
            where: { id: data.toLocationId, ...NOT_DELETED }
          })
        : Promise.resolve(null),
      this.prisma.product.findMany({
        where: { id: { in: productIds }, ...NOT_DELETED },
        select: { id: true }
      })
    ]);

    if (!fromLocation) {
      throw new BadRequestException("Source location not found");
    }
    if (transferType === TransferType.INTERNAL && !toLocation) {
      throw new BadRequestException("Destination location not found");
    }
    if (activeProducts.length !== productIds.length) {
      throw new BadRequestException("One or more products are invalid or unavailable");
    }

    const trimOptional = (value?: string) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : null;
    };

    return this.prisma.transfer.create({
      data: {
        transferType,
        fromLocationId: data.fromLocationId,
        toLocationId: transferType === TransferType.INTERNAL ? data.toLocationId! : null,
        driverName: trimOptional(data.driverName),
        vehicleNumber: trimOptional(data.vehicleNumber),
        vehicleContact: trimOptional(data.vehicleContact),
        customerName: trimOptional(data.customerName),
        customerPhone: trimOptional(data.customerPhone),
        customerAddress: trimOptional(data.customerAddress),
        remarks: data.remarks?.trim() || null,
        requestedBy: data.requestedBy,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity
          }))
        }
      },
      include: { items: true }
    });
  }

  async approve(id: string, approvedBy: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!transfer || transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException("Only pending transfers can be approved");
    }

    const productIds = transfer.items.map((item) => item.productId);
    const [stockRows, products] = await Promise.all([
      this.prisma.inventory.findMany({
        where: {
          locationId: transfer.fromLocationId,
          productId: { in: productIds }
        }
      }),
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true }
      })
    ]);

    const stockByProduct = new Map(stockRows.map((row) => [row.productId, row.quantity]));
    const productById = new Map(products.map((p) => [p.id, p]));

    for (const item of transfer.items) {
      const product = productById.get(item.productId);
      const productLabel = product
        ? product.sku
          ? `${product.name} (${product.sku})`
          : product.name
        : item.productId;
      const available = stockByProduct.get(item.productId) ?? 0;
      if (available < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${productLabel} at source location (available: ${available}, requested: ${item.quantity})`
        );
      }
    }

    const customerRemarkParts = [
      transfer.customerName ? `Customer: ${transfer.customerName}` : null,
      transfer.customerPhone ? `Phone: ${transfer.customerPhone}` : null,
      transfer.customerAddress ? `Address: ${transfer.customerAddress}` : null,
      transfer.remarks
    ].filter(Boolean);

    for (const item of transfer.items) {
      if (transfer.transferType === TransferType.CUSTOMER) {
        await this.movementsService.createMovement({
          productId: item.productId,
          fromLocationId: transfer.fromLocationId,
          quantity: item.quantity,
          movementType: MovementType.SALE,
          performedBy: approvedBy,
          remarks: customerRemarkParts.join(" | ") || undefined
        });
      } else {
        await this.movementsService.createMovement({
          productId: item.productId,
          fromLocationId: transfer.fromLocationId,
          toLocationId: transfer.toLocationId!,
          quantity: item.quantity,
          movementType: MovementType.TRANSFER,
          performedBy: approvedBy,
          remarks: transfer.remarks ?? undefined
        });
      }
    }

    return this.prisma.transfer.update({
      where: { id },
      data: {
        status: TransferStatus.COMPLETED,
        approvedBy,
        completedAt: new Date()
      },
      include: { items: true }
    });
  }

  async approveAll(approvedBy: string) {
    const pending = await this.prisma.transfer.findMany({
      where: { status: TransferStatus.PENDING },
      select: { id: true },
      orderBy: { createdAt: "asc" }
    });

    const approved: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    for (const transfer of pending) {
      try {
        await this.approve(transfer.id, approvedBy);
        approved.push(transfer.id);
      } catch (error: unknown) {
        const reason =
          error && typeof error === "object" && "message" in error
            ? String((error as { message: unknown }).message)
            : "Approval failed";
        failed.push({ id: transfer.id, reason });
      }
    }

    return {
      total: pending.length,
      approvedCount: approved.length,
      failedCount: failed.length,
      approved,
      failed
    };
  }

  async reject(id: string, user: AuthUserPayload, rejectionReason?: string) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException("Only admins can reject transfers");
    }

    const transfer = await this.prisma.transfer.findUnique({ where: { id } });
    if (!transfer || transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException("Only pending transfers can be rejected");
    }

    return this.prisma.transfer.update({
      where: { id },
      data: {
        status: TransferStatus.REJECTED,
        approvedBy: user.sub,
        rejectionReason
      }
    });
  }

  async complete(id: string, user: AuthUserPayload) {
    if (user.role !== Role.ADMIN && user.role !== Role.STORE_MANAGER) {
      throw new ForbiddenException("You cannot complete this transfer");
    }

    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!transfer || transfer.status !== TransferStatus.APPROVED) {
      throw new BadRequestException("Only approved transfers can be completed");
    }

    assertCanAccessTransferLocations(user, transfer.fromLocationId, transfer.toLocationId);
    const performedBy = user.sub;

    const customerRemarkParts = [
      transfer.customerName ? `Customer: ${transfer.customerName}` : null,
      transfer.customerPhone ? `Phone: ${transfer.customerPhone}` : null,
      transfer.customerAddress ? `Address: ${transfer.customerAddress}` : null,
      transfer.remarks
    ].filter(Boolean);

    for (const item of transfer.items) {
      if (transfer.transferType === TransferType.CUSTOMER) {
        await this.movementsService.createMovement({
          productId: item.productId,
          fromLocationId: transfer.fromLocationId,
          quantity: item.quantity,
          movementType: MovementType.SALE,
          performedBy,
          remarks: customerRemarkParts.join(" | ") || undefined
        });
      } else {
        await this.movementsService.createMovement({
          productId: item.productId,
          fromLocationId: transfer.fromLocationId,
          toLocationId: transfer.toLocationId!,
          quantity: item.quantity,
          movementType: MovementType.TRANSFER,
          performedBy,
          remarks: transfer.remarks ?? undefined
        });
      }
    }

    return this.prisma.transfer.update({
      where: { id },
      data: { status: TransferStatus.COMPLETED, completedAt: new Date() },
      include: { items: true }
    });
  }
}
