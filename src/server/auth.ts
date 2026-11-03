import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: "admin";
  }

  interface Session {
    user: {
      role?: "admin";
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: "admin";
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = process.env.ADMIN_EMAIL;
        const password = process.env.ADMIN_PASSWORD;
        if (!email || !password) return null;

        const givenEmail = String(credentials?.email ?? "");
        const givenPassword = String(credentials?.password ?? "");
        const emailMatches = safeEqual(givenEmail.toLowerCase(), email.toLowerCase());
        const passwordMatches = safeEqual(givenPassword, password);
        if (!emailMatches || !passwordMatches) return null;

        return { id: "admin", email, name: "Admin", role: "admin" };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.role === "admin") token.role = "admin";
      return token;
    },
    session({ session, token }) {
      if (token.role === "admin" && session.user) session.user.role = "admin";
      return session;
    },
  },
});

export async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") return null;
  return session;
}

function safeEqual(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}
