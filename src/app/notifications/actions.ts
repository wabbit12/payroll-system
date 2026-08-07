"use server";

import { revalidatePath } from "next/cache";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/notify";

export async function markOneRead(id: string) {
  await markNotificationRead(id);
  revalidatePath("/notifications");
}

export async function markAllRead() {
  await markAllNotificationsRead();
  revalidatePath("/notifications");
}
