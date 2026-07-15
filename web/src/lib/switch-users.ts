import type { Role } from "@/lib/types";

export type SwitchUserAccount = {
  id: string;
  label: string;
  email: string;
  password: string;
  role: Role;
};

export const SWITCH_USER_ACCOUNTS: SwitchUserAccount[] = [
  {
    id: "admin",
    label: "Admin",
    email: "admin@inventory.local",
    password: "Admin@123",
    role: "ADMIN"
  },
  {
    id: "godown1",
    label: "Godown 1",
    email: "godown1@inventory.local",
    password: "Godown@123",
    role: "GODOWN_MANAGER"
  },
  {
    id: "godown2",
    label: "Godown 2",
    email: "godown2@inventory.local",
    password: "Godown@123",
    role: "GODOWN_MANAGER"
  }
];
