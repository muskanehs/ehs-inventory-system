import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApiResponse, DashboardSummary } from "@/lib/types";
import { useLocationScope } from "@/hooks/use-location-scope";
import { useAuthStore } from "@/store/auth";

export function useDashboardStats() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const { scopedLocationId } = useLocationScope();
  const canFetch = hasHydrated && isAuthenticated;

  const summaryQuery = useQuery({
    queryKey: ["dashboard", "summary", scopedLocationId],
    enabled: canFetch,
    queryFn: async () => {
      const response = await api.get<ApiResponse<DashboardSummary>>("/dashboard/summary", {
        params: scopedLocationId ? { locationId: scopedLocationId } : undefined
      });
      return response.data.data;
    }
  });

  const stats: DashboardSummary = summaryQuery.data ?? {
    totalProducts: 0,
    totalStockUnits: 0,
    lowStockCount: 0,
    locationCount: 0,
    pendingTransfers: 0,
    lowStockItems: []
  };

  return {
    stats,
    isLoading: summaryQuery.isLoading,
    isError: summaryQuery.isError,
    error: summaryQuery.error,
    refetch: () => {
      void summaryQuery.refetch();
    }
  };
}
