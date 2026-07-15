import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApiResponse, GodownsSummaryResponse, Location } from "@/lib/types";

export function useLocations(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["locations"],
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const response = await api.get<ApiResponse<Location[]>>("/locations");
      return response.data.data;
    }
  });
}

export function useGodownsSummary() {
  return useQuery({
    queryKey: ["locations", "godowns", "summary"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<GodownsSummaryResponse>>(
        "/locations/godowns/summary"
      );
      return response.data.data;
    }
  });
}

export function useGodowns() {
  const query = useLocations();
  const godowns = (query.data ?? []).filter((location) => location.type === "GODOWN");
  return { ...query, godowns };
}

export function useCreateGodown() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const response = await api.post<ApiResponse<Location>>("/locations", { name });
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["locations"] });
      void queryClient.invalidateQueries({ queryKey: ["locations", "godowns", "summary"] });
    }
  });
}

export function useUpdateGodown() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await api.patch<ApiResponse<Location>>(`/locations/${id}`, { name });
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["locations"] });
      void queryClient.invalidateQueries({ queryKey: ["locations", "godowns", "summary"] });
      void queryClient.invalidateQueries({ queryKey: ["transfers"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });
}
