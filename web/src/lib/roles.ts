import type { Role } from "@/lib/types";

/** Read-only account: Categories, Stock, Transfers — no mutations or exports. */
export function isViewerRole(role: Role | null | undefined): boolean {
  return role === "VIEWER";
}

export function canMutateInventory(role: Role | null | undefined): boolean {
  return role === "ADMIN" || role === "STORE_MANAGER" || role === "GODOWN_MANAGER";
}

export function canManageCatalog(role: Role | null | undefined): boolean {
  return role === "ADMIN" || role === "STORE_MANAGER";
}
