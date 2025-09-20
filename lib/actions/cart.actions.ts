"use server";

import type { Prisma } from "@/lib/generated/prisma";
import { CartItem } from "@/types";
import { cookies } from "next/headers";
import { formatError, prismaToJson, round2 } from "../utils";
import { auth } from "@/auth";
import { prisma } from "@/db/prisma";
import { cartItemSchema, insertCartSchema } from "../validators";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

type DBReturnedCart = {
  id: string;
  items: CartItem[];
  itemsPrice: string;
  totalPrice: string;
  shippingPrice: string;
  taxPrice: string;
  sessionId: string;
  userId?: string | null;
};

// Calculate cart prices (unchanged)
const calcPrice = (items: CartItem[]) => {
  const itemsPrice = round2(
      items.reduce((acc, item) => acc + Number(item.price) * item.qty, 0)
    ),
    shippingPrice = itemsPrice > 100 ? 0 : 10,
    taxPrice = round2(0.15 * itemsPrice),
    totalPrice = round2(itemsPrice + taxPrice + shippingPrice);

  return {
    itemsPrice: itemsPrice.toFixed(2),
    shippingPrice: shippingPrice.toFixed(2),
    taxPrice: taxPrice.toFixed(2),
    totalPrice: totalPrice.toFixed(2),
  };
};

export async function getMyCart(): Promise<DBReturnedCart | undefined> {
  const session = await auth();
  const userId = session?.user?.id ? (session.user.id as string) : undefined;

  const jar = await cookies();
  const sessionCartId = jar.get("sessionCartId")?.value;

  // Prefer user cart when logged in
  if (userId) {
    const userCart = await prisma.cart.findFirst({ where: { userId } });
    if (userCart) {
      return prismaToJson({
        id: userCart.id,
        items: (userCart.items ?? []) as CartItem[],
        itemsPrice: Number(userCart.itemsPrice).toFixed(2),
        totalPrice: Number(userCart.totalPrice).toFixed(2),
        shippingPrice: Number(userCart.shippingPrice).toFixed(2),
        taxPrice: Number(userCart.taxPrice).toFixed(2),
      }) as DBReturnedCart;
    }
  }

  if (!sessionCartId) return undefined;

  const sessionCart = await prisma.cart.findFirst({
    where: { sessionId: sessionCartId },
  });
  if (!sessionCart) return undefined;

  return prismaToJson({
    id: sessionCart.id,
    items: (sessionCart.items ?? []) as CartItem[],
    itemsPrice: Number(sessionCart.itemsPrice).toFixed(2),
    totalPrice: Number(sessionCart.totalPrice).toFixed(2),
    shippingPrice: Number(sessionCart.shippingPrice).toFixed(2),
    taxPrice: Number(sessionCart.taxPrice).toFixed(2),
  }) as DBReturnedCart;
}

export async function addItemToCart(data: CartItem) {
  try {
    const jar = await cookies();
    const sessionCartId = jar.get("sessionCartId")?.value;

    const session = await auth();
    const userId = session?.user?.id ? (session.user.id as string) : undefined;

    const cart = await getMyCart();

    // Parse and validate item
    const item = cartItemSchema.parse(data);

    // Find product in db
    const product = await prisma.product.findFirst({
      where: { id: item.product },
    });
    if (!product) throw new Error("Product not found");

    if (!cart) {
      // If creating a brand new cart, require either userId or cookie
      const ensuredSessionId = sessionCartId ?? randomUUID();

      const newCart = insertCartSchema.parse({
        userId: userId ?? undefined,
        items: [item],
        sessionId: ensuredSessionId,
        ...calcPrice([item]),
      });

      await prisma.cart.create({ data: newCart });

      revalidatePath(`/product/${product.slug}`);

      return {
        success: true,
        message: `${product.name} added to cart`,
      };
    } else {
      // We already have a cart in DB
      const items: CartItem[] = (cart.items ?? []).map((x) => ({ ...x }));
      const idx = items.findIndex((x) => x.product === item.product);
      const existed = idx !== -1;

      if (existed) {
        const nextQty = items[idx].qty + 1;
        if (product.stock < nextQty) throw new Error("Not enough stock");
        items[idx] = { ...items[idx], qty: nextQty };
      } else {
        if (product.stock < item.qty) throw new Error("Not enough stock");
        items.push(item);
      }

      const totals = calcPrice(items);

      await prisma.cart.update({
        where: { id: cart.id },
        data: {
          // KEY FIX: use { set: [] } so Prisma sees a JSON array
          items: { set: items as unknown as Prisma.InputJsonValue[] },
          ...totals,
        },
      });

      revalidatePath(`/product/${product.slug}`);

      return {
        success: true,
        message: `${product.name} ${
          existed ? "Quantity Updated" : "Added to Cart"
        }`,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: formatError(error),
    };
  }
}

export async function removeItemFromCart(productId: string) {
  try {
    const product = await prisma.product.findFirst({
      where: { id: productId },
    });
    if (!product) throw new Error("Product not found");

    const cart = await getMyCart();
    if (!cart) throw new Error("Cart not found");

    const items: CartItem[] = (cart.items ?? []).map((x) => ({ ...x }));
    const idx = items.findIndex((x) => x.product === productId);
    if (idx === -1) throw new Error("Item not found");

    if (items[idx].qty === 1) {
      items.splice(idx, 1);
    } else {
      items[idx].qty = items[idx].qty - 1;
    }

    const totals = calcPrice(items);

    await prisma.cart.update({
      where: { id: cart.id },
      data: {
        // KEY FIX: use { set: [] }
        items: { set: items as unknown as Prisma.InputJsonValue[] },
        ...totals,
      },
    });

    revalidatePath(`/product/${product.slug}`);

    return {
      success: true,
      message: `${product.name} was removed from cart`,
    };
  } catch (error) {
    return {
      success: false,
      message: formatError(error),
    };
  }
}
