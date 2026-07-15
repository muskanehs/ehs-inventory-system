import { SetMetadata } from "@nestjs/common";

export const ALLOW_DURING_PASSWORD_CHANGE_KEY = "allowDuringPasswordChange";

/** Routes reachable while mustChangePassword is true (e.g. me, change-password). */
export const AllowDuringPasswordChange = () =>
  SetMetadata(ALLOW_DURING_PASSWORD_CHANGE_KEY, true);
