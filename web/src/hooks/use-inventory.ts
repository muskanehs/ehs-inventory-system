import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  ApiProductStockGroup,
  ApiResponse,
  CreateMovementInput,
  InventoryItem,
  PaginatedResult,
  StockMovement
} from "@/lib/types";

export function useInventory(locationId?: string) {
  return useQuery({
    queryKey: ["inventory", locationId ?? "all"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<InventoryItem[]>>("/inventory", {
        params: locationId ? { locationId } : undefined
      });
      return response.data.data;
    }
  });
}

export type StockListFilter = "all" | "low" | "fast" | "slow";

export function useGroupedInventory(params: {
  page: number;
  limit: number;
  search: string;
  locationId?: string;
  filter?: StockListFilter;
  categoryId?: string;
}) {
  return useQuery({
    queryKey: ["inventory", "grouped", params],
    queryFn: async () => {
      const response = await api.get<ApiResponse<PaginatedResult<ApiProductStockGroup>>>(
        "/inventory/grouped",
        {
          params: {
            page: params.page,
            limit: params.limit,
            search: params.search || undefined,
            locationId: params.locationId,
            filter: params.filter && params.filter !== "all" ? params.filter : undefined,
            categoryId: params.categoryId || undefined
          }
        }
      );
      return response.data.data;
    }
  });
}

export function useMovements(limit = 20) {
  return useQuery({
    queryKey: ["movements", limit],
    queryFn: async () => {
      const response = await api.get<ApiResponse<StockMovement[]>>("/movements", {
        params: { limit }
      });
      return response.data.data;
    }
  });
}

export function useCreateMovement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMovementInput) => {
      const response = await api.post<ApiResponse<StockMovement>>("/movements", input);
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["movements"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });
}
