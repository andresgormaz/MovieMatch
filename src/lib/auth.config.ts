import type { NextAuthConfig } from "next-auth";

// Edge-safe config: no providers here (Credentials needs prisma/bcrypt,
// which don't run in the Edge middleware runtime). Shared by both
// src/lib/auth.ts (full, Node runtime) and src/middleware.ts (Edge).
export const authConfig = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) token.id = user.id;
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
