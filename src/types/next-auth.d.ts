import type { DefaultSession } from "next-auth";

import type { Role, UserStatus } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
      status: UserStatus;
      mfaEnabled: boolean;
    };
  }

  interface User {
    id: string;
    role: Role;
    status: UserStatus;
    mfaEnabled: boolean;
    rememberMe?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    status?: UserStatus;
    mfaEnabled?: boolean;
    rememberMe?: boolean;
  }
}
