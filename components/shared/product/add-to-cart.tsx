"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { CartItem } from "@/types";
import { toast } from "sonner";
import { addItemToCart } from "@/lib/actions/cart.actions";

const AddToCart = ({ item }: { item: CartItem }) => {
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

  return (
    <Button className="w-full" type="button" onClick={handleAddToCart}>
      <Plus /> Add to Cart
    </Button>
  );
};

export default AddToCart;
