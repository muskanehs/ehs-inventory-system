import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApiResponse, Role } from "@/lib/types";

export type SwitchableUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  assignedLocation?: { id: string; name: string } | null;
};

export function useSwitchableUsers(enabled: boolean) {
  return useQuery({
    queryKey: ["switchable-users"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const response = await api.get<ApiResponse<SwitchableUser[]>>("/auth/switchable-users");
      return response.data.data;
    }
  });
}
