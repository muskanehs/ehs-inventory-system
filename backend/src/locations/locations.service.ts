import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { LocationType, Prisma, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUserPayload } from "../common/types/auth-user";
import {
  assertGodownAssignment,
  isPrivilegedInventoryRole
} from "../common/utils/location-scope";
import { NOT_DELETED, softDeleteData } from "../common/utils/soft-delete";
import { provisionGodownManager } from "../users/provision-godown-manager";
import { CreateLocationDto } from "./dto/create-location.dto";
import { UpdateLocationDto } from "./dto/update-location.dto";

export type GodownSummary = {
  id: string;
  name: string;
  type: LocationType;
  createdAt: Date;
  updatedAt: Date;
  productCount: number;
  totalUnits: number;
  managerEmail: string | null;
};

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Privileged roles see all locations.
   * Godown managers see their assigned godown plus all STORE locations
   * (needed as transfer destinations) — never other godowns.
   */
  findAll(user: AuthUserPayload) {
    if (user.role === Role.GODOWN_MANAGER) {
      assertGodownAssignment(user);
    }

    const where: Prisma.LocationWhereInput = {
      ...NOT_DELETED,
      ...(user.role === Role.GODOWN_MANAGER
        ? {
            OR: [{ id: user.assignedLocationId! }, { type: LocationType.STORE }]
          }
        : {})
    };

    return this.prisma.location.findMany({
      where,
      orderBy: { createdAt: "asc" }
    });
  }

  async getListEtag(user: AuthUserPayload) {
    const where: Prisma.LocationWhereInput = {
      ...NOT_DELETED,
      ...(user.role === Role.GODOWN_MANAGER
        ? {
            OR: [{ id: user.assignedLocationId! }, { type: LocationType.STORE }]
          }
        : {})
    };

    const [count, latest] = await Promise.all([
      this.prisma.location.count({ where }),
      this.prisma.location.aggregate({
        where,
        _max: { updatedAt: true }
      })
    ]);
    const scope = user.role === Role.GODOWN_MANAGER ? user.assignedLocationId : "all";
    return `"locations-${scope}-${count}-${latest._max.updatedAt?.getTime() ?? 0}"`;
  }

  async godownsSummary(user: AuthUserPayload): Promise<{
    godowns: GodownSummary[];
    totals: { godownCount: number; productCount: number; totalUnits: number };
  }> {
    if (!isPrivilegedInventoryRole(user.role) && user.role !== Role.GODOWN_MANAGER) {
      throw new ForbiddenException("You cannot view godown summaries");
    }

    if (user.role === Role.GODOWN_MANAGER) {
      assertGodownAssignment(user);
    }

    const godowns = await this.prisma.location.findMany({
      where: {
        type: LocationType.GODOWN,
        ...NOT_DELETED,
        ...(user.role === Role.GODOWN_MANAGER ? { id: user.assignedLocationId! } : {})
      },
      orderBy: { name: "asc" }
    });

    if (godowns.length === 0) {
      return {
        godowns: [],
        totals: { godownCount: 0, productCount: 0, totalUnits: 0 }
      };
    }

    const godownIds = godowns.map((g) => g.id);
    const [unitAgg, productRows, managers] = await Promise.all([
      this.prisma.inventory.groupBy({
        by: ["locationId"],
        where: { locationId: { in: godownIds }, product: NOT_DELETED },
        _sum: { quantity: true }
      }),
      this.prisma.inventory.findMany({
        where: { locationId: { in: godownIds }, quantity: { gt: 0 }, product: NOT_DELETED },
        select: { locationId: true, productId: true }
      }),
      this.prisma.user.findMany({
        where: {
          role: Role.GODOWN_MANAGER,
          assignedLocationId: { in: godownIds },
          ...NOT_DELETED,
          isActive: true
        },
        select: { assignedLocationId: true, email: true }
      })
    ]);

    const unitsByLocation = new Map(unitAgg.map((row) => [row.locationId, row._sum.quantity ?? 0]));
    const emailByGodown = new Map(
      managers
        .filter((m) => m.assignedLocationId)
        .map((m) => [m.assignedLocationId!, m.email])
    );
    const productsByLocation = new Map<string, Set<string>>();
    for (const row of productRows) {
      if (!productsByLocation.has(row.locationId)) {
        productsByLocation.set(row.locationId, new Set());
      }
      productsByLocation.get(row.locationId)!.add(row.productId);
    }

    const summaries: GodownSummary[] = godowns.map((godown) => ({
      ...godown,
      productCount: productsByLocation.get(godown.id)?.size ?? 0,
      totalUnits: unitsByLocation.get(godown.id) ?? 0,
      managerEmail: emailByGodown.get(godown.id) ?? null
    }));

    return {
      godowns: summaries,
      totals: {
        godownCount: summaries.length,
        productCount: summaries.reduce((sum, g) => sum + g.productCount, 0),
        totalUnits: summaries.reduce((sum, g) => sum + g.totalUnits, 0)
      }
    };
  }

  async createGodown(dto: CreateLocationDto) {
    const trimmed = dto.name.trim();
    const existing = await this.prisma.location.findFirst({
      where: { name: trimmed, ...NOT_DELETED }
    });
    if (existing) {
      throw new ConflictException(`A location named "${trimmed}" already exists`);
    }

    return this.prisma.$transaction(async (tx) => {
      const godown = await tx.location.create({
        data: {
          name: trimmed,
          type: LocationType.GODOWN
        }
      });
      const manager = await provisionGodownManager(tx, godown);
      return { ...godown, manager };
    });
  }

  async updateGodown(id: string, dto: UpdateLocationDto) {
    const godown = await this.prisma.location.findFirst({
      where: { id, type: LocationType.GODOWN, ...NOT_DELETED }
    });
    if (!godown) {
      throw new NotFoundException("Godown not found");
    }

    const trimmed = dto.name.trim();
    const duplicate = await this.prisma.location.findFirst({
      where: {
        name: trimmed,
        ...NOT_DELETED,
        NOT: { id }
      }
    });
    if (duplicate) {
      throw new ConflictException(`A location named "${trimmed}" already exists`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.location.update({
        where: { id },
        data: { name: trimmed }
      });
      await tx.user.updateMany({
        where: {
          assignedLocationId: id,
          role: Role.GODOWN_MANAGER,
          ...NOT_DELETED
        },
        data: { name: `${trimmed} Manager` }
      });
      return updated;
    });
  }

  async removeGodown(id: string, deletedBy?: string) {
    const godown = await this.prisma.location.findFirst({
      where: { id, type: LocationType.GODOWN, ...NOT_DELETED }
    });
    if (!godown) {
      throw new NotFoundException("Godown not found");
    }

    const stockOnHand = await this.prisma.inventory.aggregate({
      where: { locationId: id, quantity: { gt: 0 }, product: NOT_DELETED },
      _sum: { quantity: true }
    });
    if ((stockOnHand._sum.quantity ?? 0) > 0) {
      throw new ConflictException(
        "Cannot delete godown with stock on hand. Move or clear stock first."
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.inventory.deleteMany({ where: { locationId: id } });

      await tx.user.updateMany({
        where: {
          assignedLocationId: id,
          role: Role.GODOWN_MANAGER,
          ...NOT_DELETED
        },
        data: {
          ...softDeleteData(deletedBy),
          assignedLocationId: null,
          isActive: false
        }
      });

      return tx.location.update({
        where: { id },
        data: softDeleteData(deletedBy)
      });
    });
  }

  assertNotModified(ifNoneMatch: string | undefined, etag: string) {
    if (ifNoneMatch && ifNoneMatch === etag) {
      throw new HttpException("", HttpStatus.NOT_MODIFIED);
    }
  }
}
