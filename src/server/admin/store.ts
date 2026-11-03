import "server-only";
import { DrizzleAdminStore } from "@/server/admin/drizzle-store";
import { FileAdminStore } from "@/server/admin/file-store";
import type { AdminStore } from "@/server/admin/types";

let store: AdminStore | null = null;

export function getAdminStore(): AdminStore {
  if (store) return store;
  store = process.env.DATABASE_URL ? new DrizzleAdminStore() : new FileAdminStore();
  return store;
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && process.env.AUTH_SECRET);
}
