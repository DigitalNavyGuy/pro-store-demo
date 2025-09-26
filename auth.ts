import NextAuth from "next-auth";
import type {
  NextAuthConfig,
  Session,
  User,
  Account,
  Profile,
} from "next-auth";
import type { AdapterUser } from "next-auth/adapters";
import type { JWT } from "next-auth/jwt";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/db/prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import { compareSync } from "bcrypt-ts-edge";
import { cookies } from "next/headers";
import { authConfig } from "./auth.config";
import type { Prisma } from "@/lib/generated/prisma";

// Helper types: derive the official callback param types from NextAuthConfig
type CbMap = NonNullable<NextAuthConfig["callbacks"]>;
type SessionParams = Parameters<NonNullable<CbMap["session"]>>[0];
type JwtParams = Parameters<NonNullable<CbMap["jwt"]>>[0];

export const config: NextAuthConfig = {
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        const user = await prisma.user.findFirst({
          where: { email: credentials.email as string },
        });

        if (user && user.password) {
          const isMatch = compareSync(
            credentials.password as string,
            user.password
          );
          if (isMatch) {
            // Return the AdapterUser shape; custom fields (role) will be added via JWT
            const adapterUser: AdapterUser = {
              id: user.id,
              name: user.name,
              email: user.email,
              emailVerified: null,
              image: null,
            };
            return adapterUser;
          }
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async session(params: SessionParams): Promise<Session> {
      const { session, token, trigger, user } = params;

      // Safely extend session.user with custom fields
      const s = session as Session & {
        user: { id?: string; role?: string; name?: string };
      };

      if (token.sub) s.user.id = token.sub;
      if (typeof token.name === "string") s.user.name = token.name;

      const t = token as JWT & { role?: string };
      if (t.role) s.user.role = t.role;

      if (trigger === "update" && user?.name) {
        s.user.name = user.name;
      }

      return session;
    },

    async jwt(params: JwtParams): Promise<JWT> {
      const { token, user, trigger, session } = params;

      // Add custom fields on a narrowed view of the token
      const t = token as JWT & { id?: string; role?: string; name?: string };

      if (user) {
        // Persist id
        t.id = user.id;

        // Derive and persist display name if needed
        const adapterUser = user as AdapterUser & { email?: string | null };
        const hasNoName = adapterUser.name === "NO_NAME";
        const email = adapterUser.email ?? null;

        t.name =
          hasNoName && email ? email.split("@")[0] : adapterUser.name ?? t.name;

        if (hasNoName && email) {
          await prisma.user.update({
            where: { id: user.id },
            data: { name: t.name },
          });
        }

        // Load and stash custom role on first sign-in
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        if (dbUser?.role) t.role = dbUser.role;

        // --- Merge session cart -> user cart on sign in/up ---
        if (trigger === "signIn" || trigger === "signUp") {
          const jar = await cookies();
          const sessionCartId = jar.get("sessionCartId")?.value;

          if (sessionCartId) {
            await prisma.$transaction(async (tx) => {
              const sessionCart = await tx.cart.findFirst({
                where: { sessionId: sessionCartId },
              });
              if (!sessionCart) return;

              const userCart = await tx.cart.findFirst({
                where: { userId: user.id },
              });

              // If no user cart yet, claim the session cart for this user
              if (!userCart) {
                await tx.cart.update({
                  where: { id: sessionCart.id },
                  data: { userId: user.id }, // keep sessionId (required by your schema)
                });
                return;
              }

              type RawItem = {
                product: string;
                qty: number;
                price: string | number;
                [k: string]: unknown;
              };

              const sItems = (sessionCart.items ?? []) as RawItem[];
              const uItems = (userCart.items ?? []) as RawItem[];

              // Merge by product
              const byProduct = new Map<string, RawItem>();
              for (const it of uItems) byProduct.set(it.product, { ...it });
              for (const it of sItems) {
                const existing = byProduct.get(it.product);
                if (existing) {
                  byProduct.set(it.product, {
                    ...existing,
                    qty: Number(existing.qty) + Number(it.qty),
                  });
                } else {
                  byProduct.set(it.product, { ...it });
                }
              }
              const mergedItems = Array.from(byProduct.values());

              // Recalculate totals (mirror your calcPrice)
              const itemsPriceNum = mergedItems.reduce(
                (acc, it) => acc + Number(it.price) * Number(it.qty),
                0
              );
              const shippingPriceNum = itemsPriceNum > 100 ? 0 : 10;
              const taxPriceNum = Math.round(itemsPriceNum * 0.15 * 100) / 100;
              const totalPriceNum =
                Math.round(
                  (itemsPriceNum + taxPriceNum + shippingPriceNum) * 100
                ) / 100;

              await tx.cart.update({
                where: { id: userCart.id },
                data: {
                  // Prisma JSON array update requires the `{ set: [...] }` wrapper
                  items: {
                    set: mergedItems as unknown as Prisma.InputJsonValue[],
                  },
                  itemsPrice: itemsPriceNum.toFixed(2),
                  shippingPrice: shippingPriceNum.toFixed(2),
                  taxPrice: taxPriceNum.toFixed(2),
                  totalPrice: totalPriceNum.toFixed(2),
                },
              });

              // Remove the old session cart to avoid duplicates
              await tx.cart.delete({ where: { id: sessionCart.id } });
            });

            // Optional: clear cookie after merge
            // jar.set("sessionCartId", "", { path: "/", maxAge: 0 });
          }
        }
      }
      // Handle session updates
      if (session?.user.name && trigger === "update") {
        token.name = session.user.name;
      }
      return token;
    },

    ...authConfig.callbacks,
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
