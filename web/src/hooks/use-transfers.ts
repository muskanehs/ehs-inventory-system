import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApiResponse, CreateTransferInput, PaginatedResult, Transfer } from "@/lib/types";

export type TransferListParams = {
  page: number;
  limit: number;
  status?: string;
  fromLocationId?: string;
  toLocationId?: string;
  search?: string;
  days?: string;
};

export function useTransferStats() {
  return useQuery({
    queryKey: ["transfers", "stats"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<{ pending: number; approved: number; completed: number; rejected: number }>>(
        "/transfers/stats"
      );
      return response.data.data;
    }
  });
}

export function useTransfers(
  params?: TransferListParams,
  options?: { enabled?: boolean }
) {
  const isPaginated = !!params;

  return useQuery({
    queryKey: ["transfers", params ?? "all"],
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      const response = await api.get<ApiResponse<PaginatedResult<Transfer> | Transfer[]>>(
        "/transfers",
        {
          params: isPaginated
            ? {
                page: params.page,
                limit: params.limit,
                status: params.status !== "all" ? params.status : undefined,
                fromLocationId:
                  params.fromLocationId && params.fromLocationId !== "all"
                    ? params.fromLocationId
                    : undefined,
                toLocationId:
                  params.toLocationId && params.toLocationId !== "all"
                    ? params.toLocationId
                    : undefined,
                search: params.search || undefined,
                days: params.days && params.days !== "all" ? params.days : undefined
              }
            : undefined
        }
      );
      return response.data.data;
    }
  });
}

export function useCreateTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTransferInput) => {
      const response = await api.post<ApiResponse<Transfer>>("/transfers", input);
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transfers"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });
}

export function useTransferActions() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["transfers"] });
    void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    void queryClient.invalidateQueries({ queryKey: ["movements"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.patch<ApiResponse<Transfer>>(`/transfers/${id}/approve`);
      return response.data.data;
    },
    onSuccess: invalidate
  });

  const approveAll = useMutation({
    mutationFn: async () => {
      const response = await api.patch<
        ApiResponse<{
          total: number;
          approvedCount: number;
          failedCount: number;
          approved: string[];
          failed: { id: string; reason: string }[];
        }>
      >(`/transfers/approve-all`);
      return response.data.data;
    },
    onSuccess: invalidate
  });

  const reject = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const response = await api.patch<ApiResponse<Transfer>>(`/transfers/${id}/reject`, { reason });
      return response.data.data;
    },
    onSuccess: invalidate
  });

  const complete = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.patch<ApiResponse<Transfer>>(`/transfers/${id}/complete`);
      return response.data.data;
    },
    onSuccess: invalidate
  });

  return { approve, approveAll, reject, complete };
}
