import { useState } from "react";
import { Check, ChevronsUpDown, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { useSwitchableUsers, type SwitchableUser } from "@/hooks/use-switchable-users";
import type { ApiResponse, AuthUser } from "@/lib/types";
import { useAuthStore } from "@/store/auth";

type SwitchResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

function formatRole(role: SwitchableUser["role"]) {
  return role.replace(/_/g, " ");
}

function accountLabel(user: SwitchableUser) {
  if (user.role === "GODOWN_MANAGER" && user.assignedLocation?.name) {
    return user.assignedLocation.name;
  }
  return user.name;
}

export function UserSwitcher() {
  const [switching, setSwitching] = useState(false);
  const email = useAuthStore((s) => s.email);
  const canSwitchUsers = useAuthStore((s) => s.canSwitchUsers);
  const mustChangePassword = useAuthStore((s) => s.mustChangePassword);
  const setAuth = useAuthStore((s) => s.setAuth);

  const { data: users = [], isLoading: loadingUsers } = useSwitchableUsers(
    canSwitchUsers && !mustChangePassword
  );

  if (!canSwitchUsers || mustChangePassword) {
    return null;
  }

  const currentAccount = users.find((account) => account.email === email);

  const handleSwitch = async (userId: string) => {
    const account = users.find((item) => item.id === userId);
    if (!account || account.email === email) return;

    setSwitching(true);
    try {
      const response = await api.post<ApiResponse<SwitchResponse>>("/auth/switch-user", {
        userId: account.id
      });
      const { user } = response.data.data;
      setAuth(
        user.role,
        user.name,
        user.email ?? account.email,
        user.assignedLocationId,
        user.assignedLocation?.name,
        user.mustChangePassword ?? false,
        user.canSwitchUsers ?? true
      );
      toast.success(`Switched to ${accountLabel(account)}`, {
        description: `Now viewing as ${user.name}`
      });
      window.location.assign("/");
    } catch {
      toast.error("Switch failed", {
        description: `Could not switch to ${accountLabel(account)}.`
      });
    } finally {
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-border/60 text-muted-foreground"
          disabled={switching || loadingUsers}
          aria-label="Switch user"
        >
          {switching || loadingUsers ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Users className="h-4 w-4" />
          )}
          <span className="max-w-[88px] truncate sm:max-w-[120px]">
            {currentAccount ? accountLabel(currentAccount) : "Switch user"}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Switch user</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {users.length === 0 ? (
          <DropdownMenuItem disabled>No users available</DropdownMenuItem>
        ) : (
          users.map((account) => (
            <DropdownMenuItem
              key={account.id}
              onClick={() => handleSwitch(account.id)}
              disabled={switching || account.email === email}
              className="flex items-center justify-between"
            >
              <div className="flex flex-col">
                <span>{accountLabel(account)}</span>
                <span className="text-xs text-muted-foreground">{formatRole(account.role)}</span>
              </div>
              {account.email === email && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
