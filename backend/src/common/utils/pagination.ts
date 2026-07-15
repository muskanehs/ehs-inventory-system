const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePagination(
  page?: string,
  limit?: string
): { page: number; limit: number; skip: number; isPaginated: boolean } {
  const hasPage = page !== undefined && page !== "";
  const hasLimit = limit !== undefined && limit !== "";

  if (!hasPage && !hasLimit) {
    return { page: DEFAULT_PAGE, limit: MAX_LIMIT, skip: 0, isPaginated: false };
  }

  const parsedPage = Math.max(1, Number(page) || DEFAULT_PAGE);
  const parsedLimit = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || DEFAULT_LIMIT));

  return {
    page: parsedPage,
    limit: parsedLimit,
    skip: (parsedPage - 1) * parsedLimit,
    isPaginated: true
  };
}
