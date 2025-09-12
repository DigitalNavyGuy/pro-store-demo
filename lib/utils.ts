import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Convert prisma object to JSON
export function prismaToJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

// Format number with two decimal places
export function formatNumberWithDecimal(num: number): string {
  const [whole, decimal] = num.toString().split(".");
  return decimal ? `${whole}.${decimal.padEnd(2, "0")}` : `${whole}.00`;
}
