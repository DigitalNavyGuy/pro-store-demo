import { z } from "zod";
import { formatNumberWithDecimal } from "./utils";

const currency = z
  .string()
  .refine(
    (value) => /^\d+(\.\d{2})?$/.test(formatNumberWithDecimal(Number(value))),
    "Price must be exactly two decimal places"
  );

// Schema for Adding Products
export const insertProductSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 charachters"),
  slug: z.string().min(3, "Slug must be at least 3 charachters"),
  category: z.string().min(3, "Category must be at least 3 charachters"),
  brand: z.string().min(3, "Brand must be at least 3 charachters"),
  description: z.string().min(3, "Description must be at least 3 charachters"),
  stock: z.coerce.number(),
  images: z.array(z.string()).min(1, "Product must have at least one image"),
  isFeatured: z.boolean(),
  banner: z.string().nullable(),
  price: currency,
});

// Schema for User Sign-in
export const signInFormSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: "Invalid email address" })),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Schema for User Sign-up
export const signUpFormSchema = z
  .object({
    name: z.string().min(3, "Name must be at least 3 charachters"),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email({ message: "Invalid email address" })),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z
      .string()
      .min(6, "Confirm password must be at least 6 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// Cart Schemas
export const cartItemSchema = z.object({
  product: z.string().min(1, "Product ID is required"),
  name: z.string().min(1, "Name ID is required"),
  slug: z.string().min(1, "Slug ID is required"),
  qty: z.number().int().nonnegative("Quantity must be a positive number"),
  image: z.string().min(1, "Image is required"),
  price: currency,
});

export const insertCartSchema = z.object({
  items: z.array(cartItemSchema),
  itemsPrice: currency,
  totalPrice: currency,
  shippingPrice: currency,
  taxPrice: currency,
  sessionCartId: z.string().min(1, "Session Cart ID is required"),
  userId: z.string().optional().nullable(),
});
