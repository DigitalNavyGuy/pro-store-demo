"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import type { Cart, CartItem } from "@/types";
import { toast } from "sonner";
import { addItemToCart, removeItemFromCart } from "@/lib/actions/cart.actions";

const AddToCart = ({ cart, item }: { cart?: Cart; item: CartItem }) => {
  const router = useRouter();

  const handleAddToCart = async () => {
    const res = await addItemToCart(item);

    if (!(res?.success ?? false)) {
      toast.error(res!.message, {
        style: { backgroundColor: "red", color: "white" },
      });
      return;
    }

    // Handle successful add to cart
    toast.success(res.message, {
      style: { backgroundColor: "green", color: "white" },
      action: {
        label: "Go to Cart",
        onClick: () => router.push("/cart"),
      },
    });
  };

  // Handle remove from cart
  const handleRemoveFromCart = async () => {
    const res = await removeItemFromCart(item.product);
    const message =
      res?.message ?? (res?.success ? "Cart updated" : "Something went wrong");

    toast(message, {
      style: {
        backgroundColor: res?.success ? "green" : "red",
        color: "white",
      },
    });

    return;
  };
  // Check if the item is already in the cart
  const existItem = cart && cart.items.find((x) => x.product === item.product);

  return existItem ? (
    <div>
      <Button type="button" variant="outline" onClick={handleRemoveFromCart}>
        <Minus className="h-4 w-4" />
      </Button>
      <span className="px-2">{existItem.qty}</span>
      <Button type="button" variant="outline" onClick={handleAddToCart}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  ) : (
    <Button className="w-full" type="button" onClick={handleAddToCart}>
      <Plus /> Add to Cart
    </Button>
  );
};

export default AddToCart;
