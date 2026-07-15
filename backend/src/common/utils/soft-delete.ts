/** Default filter — exclude soft-deleted records from list/search queries. */
export const NOT_DELETED = { isDeleted: false } as const;

export function softDeleteData(deletedBy?: string) {
  return {
    isDeleted: true,
    deletedAt: new Date(),
    deletedBy: deletedBy ?? null
  };
}

export function restoreData() {
  return {
    isDeleted: false,
    deletedAt: null,
    deletedBy: null
  };
}

export function withNotDeleted<T extends Record<string, unknown>>(where?: T) {
  return where ? { ...where, ...NOT_DELETED } : { ...NOT_DELETED };
}
