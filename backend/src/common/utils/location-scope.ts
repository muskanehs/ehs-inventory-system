import { ForbiddenException } from "@nestjs/common";
import { Role } from "@prisma/client";
import type { AuthUserPayload } from "../types/auth-user";

const UNASSIGNED_GODOWN_MESSAGE =
  "Godown manager account has no assigned location. Contact an administrator.";

/** Deny-by-default for godown managers missing an assignment (fail closed). */
export function assertGodownAssignment(user: AuthUserPayload): void {
  if (user.role === Role.GODOWN_MANAGER && !user.assignedLocationId) {
    throw new ForbiddenException(UNASSIGNED_GODOWN_MESSAGE);
  }
}

/**
 * Forces godown-manager scope (transfers, movements, dashboard, inventory).
 * Unassigned godown managers are rejected — never treated as unscoped admins.
 */
export function resolveLocationScope(
  user: AuthUserPayload,
  requestedLocationId?: string
): string | undefined {
  if (user.role === Role.GODOWN_MANAGER) {
    assertGodownAssignment(user);
    return user.assignedLocationId!;
  }
  return requestedLocationId?.trim() || undefined;
}

/**
 * Inventory list scope.
 * - Godown managers default to their assigned location.
 * - Passing `locationId=all` lets them view stock across shop + all godowns (read-only list).
 * - Admins/store managers may pass a locationId or omit/"all" for every location.
 */
export function resolveInventoryScope(
  user: AuthUserPayload,
  requestedLocationId?: string
): string | undefined {
  if (user.role === Role.GODOWN_MANAGER) {
    assertGodownAssignment(user);
    if (requestedLocationId === "all") return undefined;
    return user.assignedLocationId!;
  }
  if (requestedLocationId === "all") return undefined;
  return requestedLocationId?.trim() || undefined;
}

export function transferLocationFilter(locationId: string) {
  return {
    OR: [{ fromLocationId: locationId }, { toLocationId: locationId }]
  };
}

export function movementLocationFilter(locationId: string) {
  return {
    OR: [{ fromLocationId: locationId }, { toLocationId: locationId }]
  };
}

export function isPrivilegedInventoryRole(role: Role): boolean {
  return role === Role.ADMIN || role === Role.STORE_MANAGER;
}

/** Roles that may operate on inventory/transfers at location scope. */
export const INVENTORY_OPERATOR_ROLES = [
  Role.ADMIN,
  Role.STORE_MANAGER,
  Role.GODOWN_MANAGER
] as const;

/** Roles that may view org-wide dashboards/reports (no godown-only). */
export const ORG_READER_ROLES = [Role.ADMIN, Role.STORE_MANAGER] as const;

/** Whether a user may access a transfer involving these locations. */
export function canAccessTransferLocations(
  user: AuthUserPayload,
  fromLocationId: string,
  toLocationId?: string | null
): boolean {
  if (isPrivilegedInventoryRole(user.role)) return true;
  if (user.role === Role.GODOWN_MANAGER && user.assignedLocationId) {
    const assigned = user.assignedLocationId;
    return fromLocationId === assigned || toLocationId === assigned;
  }
  return false;
}

export function assertCanAccessTransferLocations(
  user: AuthUserPayload,
  fromLocationId: string,
  toLocationId?: string | null
) {
  if (!canAccessTransferLocations(user, fromLocationId, toLocationId)) {
    throw new ForbiddenException("You do not have access to this transfer");
  }
}

export function assertCanMutateLocation(user: AuthUserPayload, locationId: string) {
  if (isPrivilegedInventoryRole(user.role)) return;
  if (user.role === Role.GODOWN_MANAGER && user.assignedLocationId === locationId) {
    return;
  }
  throw new ForbiddenException("You cannot modify inventory at this location");
}

export function assertCanCreateTransferFrom(user: AuthUserPayload, fromLocationId: string) {
  if (isPrivilegedInventoryRole(user.role)) return;
  if (user.role === Role.GODOWN_MANAGER && user.assignedLocationId === fromLocationId) {
    return;
  }
  throw new ForbiddenException("You can only create transfers from your assigned location");
}
