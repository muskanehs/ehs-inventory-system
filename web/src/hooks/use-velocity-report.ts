import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApiResponse, VelocityReport } from "@/lib/types";
import { VELOCITY_REPORT_DAYS } from "@/lib/product-units";

export function useVelocityReport(
  days = VELOCITY_REPORT_DAYS,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["reports", "velocity", days],
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      const response = await api.get<ApiResponse<VelocityReport>>("/reports/velocity", {
        params: { days }
      });
      return response.data.data;
    }
  });
}
