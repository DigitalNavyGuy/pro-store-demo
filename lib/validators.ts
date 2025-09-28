import { email, z } from "zod";
import { formatNumberWithDecimal } from "./utils";
import { PAYMENT_METHODS } from "./constants";
import { da } from "zod/v4/locales";

const currency = z
  .string()
  .refine(
    (value) => /^\d+(\.\d{2})?$/.test(formatNumberWithDecimal(Number(value))),
    "Price must be exactly two decimal places"
  );

const ALLOWED_PAYMENT_METHODS = PAYMENT_METHODS.map((m) => m.trim());

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

// Schema for updating products
export const updateProductSchema = insertProductSchema.extend({
  id: z.string().min(1, "Id is required"),
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
  sessionId: z.string().min(1, "Session Cart ID is required"),
  userId: z.string().optional().nullable(),
});

// Shipping Address Schema
export const shippingAddressSchema = z.object({
  fullName: z.string().min(3, "Name must be at least 3 charachters"),
  streetAddress: z.string().min(3, "Address must be at least 3 charachters"),
  city: z.string().min(3, "City must be at least 3 charachters"),
  postalCode: z.string().min(3, "Postal code must be at least 5 charachters"),
  country: z.string().min(3, "Country must be at least 3 charachters"),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

// Schema for Payment Method
export const paymentMethodSchema = z
  .object({
    type: z
      .string()
      .min(1, "Payment method is required")
      .transform((s) => s.trim()),
  })
  .refine((data) => ALLOWED_PAYMENT_METHODS.includes(data.type), {
    path: ["type"],
    message: "Invalid payment method",
  });

// Schema for inserting orders
export const insertOrderSchema = z.object({
  userId: z.string().min(1, "User is required"),
  itemsPrice: currency,
  shippingPrice: currency,
  taxPrice: currency,
  totalPrice: currency,
  paymentMethod: z.string().refine((data) => PAYMENT_METHODS.includes(data), {
    message: "Invalid payment method",
  }),
  shippingAddress: shippingAddressSchema,
});

// Schema for inserting orderItem
export const insertOrderItemSchema = z.object({
  productId: z.string(),
  slug: z.string(),
  image: z.string(),
  name: z.string(),
  price: currency,
  qty: z.number(),
});

// Schema for payment results
export const paymentResultSchema = z.object({
  id: z.string(),
  status: z.string(),
  email_address: z.string(),
  pricePaid: z.string(),
});

// Schema for updating user profile
export const updateProfileSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 charachters"),
  email: z.string().min(3, "Email must be at least 3 charachters"),
});
