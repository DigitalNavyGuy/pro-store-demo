"use server";

import { CartItem } from "@/types";
import { cookies } from "next/headers";
import { formatError, prismaToJson, round2 } from "../utils";
import { auth } from "@/auth";
import { prisma } from "@/db/prisma";
import { cartItemSchema, insertCartSchema } from "../validators";
import { revalidatePath } from "next/cache";

// Calculate cart prices
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

export async function addItemToCart(data: CartItem) {
  try {
    // Check for cart cookie
    const sessionCartId = (await cookies()).get("sessionCartId")?.value;
    if (!sessionCartId) throw new Error("Cart session not found");

    // Get session and user ID
    const session = await auth();
    const userId = session?.user?.id ? (session.user.id as string) : undefined;

    // Get cart
    const cart = await getMyCart();

    // Parse and validate item
    const item = cartItemSchema.parse(data);

    // Find product in db
    const product = await prisma.product.findFirst({
      where: { id: item.product },
    });
    if (!product) throw new Error("Product not found");

    if (!cart) {
      // Create new cart object
      const newCart = insertCartSchema.parse({
        userId: userId,
        items: [item],
        sessionId: sessionCartId,
        ...calcPrice([item]),
      });

      // Add to db
      await prisma.cart.create({
        data: newCart,
      });

      // Revalidate product page
      revalidatePath(`/product/${product.slug}`);

      return {
        success: true,
        message: `${product.name} added to cart`,
      };
    } else {
      // We already have a cart in DB
      const items = cart.items as CartItem[];

      // Is this product already in the cart?
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

      // Recalculate totals, using your existing helper
      const totals = calcPrice(items);

      // Persist to DB
      await prisma.cart.update({
        where: { id: cart.id },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          items: cart.items as any, // Json[]
          ...calcPrice(cart.items as CartItem[]),
        },
      });

      // Revalidate product page
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

export async function getMyCart() {
  // Check for cart cookie
  const sessionCartId = (await cookies()).get("sessionCartId")?.value;
  if (!sessionCartId) throw new Error("Cart session not found");

  // Get session and user ID
  const session = await auth();
  const userId = session?.user?.id ? (session.user.id as string) : undefined;

  // Get user cart from db
  const cart = await prisma.cart.findFirst({
    where: userId ? { userId: userId } : { sessionId: sessionCartId },
  });

  if (!cart) return undefined;

  // Convert to decimal and return
  return prismaToJson({
    ...cart,
    items: cart.items as CartItem[],
    itemsPrice: Number(cart.itemsPrice).toFixed(2),
    totalPrice: Number(cart.totalPrice).toFixed(2),
    shippingPrice: Number(cart.shippingPrice).toFixed(2),
    taxPrice: Number(cart.taxPrice).toFixed(2),
  });
}

export async function removeItemFromCart(productId: string) {
  try {
    // Check for cart cookie
    const sessionCartId = (await cookies()).get("sessionCartId")?.value;
    if (!sessionCartId) throw new Error("Cart session not found");

    // Get product
    const product = await prisma.product.findFirst({
      where: { id: productId },
    });

    if (!product) throw new Error("Product not found");

    // Get user cart
    const cart = await getMyCart();
    if (!cart) throw new Error("Cart not found");

    // Check for item
    const exist = (cart.items as CartItem[]).find(
      (x) => x.product === productId
    );
    if (!exist) throw new Error("Item not found");

    // Check if only one in qty
    if (exist.qty === 1) {
      // Remove item from cart
      cart.items = (cart.items as CartItem[]).filter(
        (x) => x.product !== exist.product
      );
    } else {
      // Decrease qty
      (cart.items as CartItem[]).find((x) => x.product === exist.product)!.qty =
        exist.qty - 1;
    }

    // Update or delete cart in DB
    await prisma.cart.update({
      where: { id: cart.id },
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: cart.items as any, // Json[]
        ...calcPrice(cart.items as CartItem[]),
      },
    });

    // Revalidate product page
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
