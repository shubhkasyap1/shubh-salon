import { supabase } from "@/integrations/supabase/client";

export { supabase };

export type UserRole = "user" | "owner" | "admin";
export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";
export type Gender = "male" | "female" | "unisex";
