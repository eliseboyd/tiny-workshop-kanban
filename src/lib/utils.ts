import { clsx, type ClassValue } from "clsx"

// Joins CSS Module class names; falsy entries are dropped.
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}
