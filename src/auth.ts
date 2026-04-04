import { compare } from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

/** Auth.js требует секрет; без него в браузере будет ClientFetchError (configuration). */
function resolveAuthSecret(): string {
  const v = process.env.AUTH_SECRET?.trim();
  if (v && v.length >= 16) return v;
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[auth] AUTH_SECRET не задан в .env — для npm run dev используется временный ключ. Добавьте в .env / .env.local строку из: openssl rand -base64 32"
    );
    return "dev-only-auth-secret-min-32-chars-do-not-use-in-prod!!";
  }
  throw new Error(
    "Задайте AUTH_SECRET в окружении (openssl rand -base64 32). Нужен для production и для next build."
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: resolveAuthSecret(),
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      id: "credentials",
      name: "Email и пароль",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const ok = await compare(password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name?.trim() || user.email.split("@")[0] || "Участник",
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.email = (token.email as string) ?? "";
        session.user.name = (token.name as string) ?? null;
      }
      return session;
    },
  },
});
