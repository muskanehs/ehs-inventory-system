import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApiResponse, PaginatedResult, StockMovement } from "@/lib/types";
import { useLocationScope } from "@/hooks/use-location-scope";

export type MovementListParams = {
  page: number;
  limit: number;
  search?: string;
};

export function useMovements(
  params?: MovementListParams,
  options?: { enabled?: boolean }
) {
  const { scopedLocationId } = useLocationScope();
  const isPaginated = !!params;

  return useQuery({
    queryKey: ["movements", params ?? "all", scopedLocationId],
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      const response = await api.get<ApiResponse<PaginatedResult<StockMovement> | StockMovement[]>>(
        "/movements",
        {
          params: isPaginated
            ? {
                page: params.page,
                limit: params.limit,
                search: params.search || undefined,
                ...(scopedLocationId ? { locationId: scopedLocationId } : {})
              }
            : {
                limit: 50,
                ...(scopedLocationId ? { locationId: scopedLocationId } : {})
              }
        }
      );
      return response.data.data;
    }
  });
}
