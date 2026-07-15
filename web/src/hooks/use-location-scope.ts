import { useAuthStore } from "@/store/auth";

export function useLocationScope() {
  const role = useAuthStore((s) => s.role);
  const assignedLocationId = useAuthStore((s) => s.assignedLocationId);
  const assignedLocationName = useAuthStore((s) => s.assignedLocationName);

  const isGodownScoped = role === "GODOWN_MANAGER" && !!assignedLocationId;
  const scopedLocationId = isGodownScoped ? assignedLocationId : null;

  return {
    isGodownScoped,
    scopedLocationId,
    assignedLocationId,
    assignedLocationName
  };
}
