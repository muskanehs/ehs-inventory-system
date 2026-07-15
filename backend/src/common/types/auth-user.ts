import { Role } from "@prisma/client";

export type AuthUserPayload = {
  sub: string;
  email: string;
  role: Role;
  assignedLocationId?: string | null;
  mustChangePassword?: boolean;
  /** Present when an ADMIN is viewing the app as another user. */
  act?: { sub: string };
};
