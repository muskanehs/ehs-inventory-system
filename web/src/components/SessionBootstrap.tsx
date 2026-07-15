import { useEffect } from "react";
import { api } from "@/lib/api";
import type { ApiResponse, AuthUser } from "@/lib/types";
import { useAuthStore } from "@/store/auth";

export function SessionBootstrap() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clear = useAuthStore((s) => s.clear);
  const setHasHydrated = useAuthStore((s) => s.setHasHydrated);
  const setProfileLoading = useAuthStore((s) => s.setProfileLoading);

  useEffect(() => {
    if (hasHydrated) return;

    let cancelled = false;
    setProfileLoading(true);

    void api
      .get<ApiResponse<AuthUser>>("/auth/me")
      .then((response) => {
        if (cancelled) return;
        const user = response.data.data;
        setAuth(
          user.role,
          user.name,
          user.email,
          user.assignedLocationId ?? null,
          user.assignedLocation?.name ?? null,
          user.mustChangePassword ?? false
        );
      })
      .catch(() => {
        if (!cancelled) clear();
      })
      .finally(() => {
        if (!cancelled) {
          setProfileLoading(false);
          setHasHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasHydrated, setAuth, clear, setHasHydrated, setProfileLoading]);

  return null;
}
