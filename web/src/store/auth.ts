import { create } from "zustand";
import type { Role } from "@/lib/types";

const LEGACY_AUTH_STORAGE_KEY = "inventory-auth";

/** Remove previously persisted tokens/PII from localStorage (one-time cleanup). */
if (typeof window !== "undefined") {
  try {
    window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  } catch {
    // ignore quota / private-mode errors
  }
}

type AuthState = {
  isAuthenticated: boolean;
  role: Role | null;
  userName: string | null;
  email: string | null;
  assignedLocationId: string | null;
  assignedLocationName: string | null;
  mustChangePassword: boolean;
  canSwitchUsers: boolean;
  hasHydrated: boolean;
  profileLoading: boolean;
  setAuth: (
    role: Role,
    userName?: string,
    email?: string,
    assignedLocationId?: string | null,
    assignedLocationName?: string | null,
    mustChangePassword?: boolean,
    canSwitchUsers?: boolean
  ) => void;
  hydrateProfile: (
    assignedLocationId: string | null,
    assignedLocationName: string | null,
    userName?: string,
    email?: string,
    mustChangePassword?: boolean,
    canSwitchUsers?: boolean
  ) => void;
  clear: () => void;
  setHasHydrated: (value: boolean) => void;
  setProfileLoading: (value: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  role: null,
  userName: null,
  email: null,
  assignedLocationId: null,
  assignedLocationName: null,
  mustChangePassword: false,
  canSwitchUsers: false,
  hasHydrated: false,
  profileLoading: true,
  setAuth: (
    role,
    userName,
    email,
    assignedLocationId,
    assignedLocationName,
    mustChangePassword,
    canSwitchUsers
  ) =>
    set({
      isAuthenticated: true,
      role,
      userName: userName ?? null,
      email: email ?? null,
      assignedLocationId: assignedLocationId ?? null,
      assignedLocationName: assignedLocationName ?? null,
      mustChangePassword: mustChangePassword ?? false,
      canSwitchUsers: canSwitchUsers ?? false
    }),
  hydrateProfile: (
    assignedLocationId,
    assignedLocationName,
    userName,
    email,
    mustChangePassword,
    canSwitchUsers
  ) =>
    set((state) => ({
      isAuthenticated: true,
      assignedLocationId,
      assignedLocationName,
      userName: userName ?? state.userName,
      email: email ?? state.email,
      mustChangePassword:
        mustChangePassword !== undefined ? mustChangePassword : state.mustChangePassword,
      canSwitchUsers:
        canSwitchUsers !== undefined ? canSwitchUsers : state.canSwitchUsers
    })),
  clear: () =>
    set({
      isAuthenticated: false,
      role: null,
      userName: null,
      email: null,
      assignedLocationId: null,
      assignedLocationName: null,
      mustChangePassword: false,
      canSwitchUsers: false
    }),
  setHasHydrated: (hasHydrated) => set({ hasHydrated }),
  setProfileLoading: (profileLoading) => set({ profileLoading })
}));
