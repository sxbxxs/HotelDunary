import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function logAction(action: string, details?: string) {
  const session = await getSession();
  await prisma.auditLog.create({
    data: {
      userId: session?.userId ?? null,
      username: session?.name ?? "Desconocido",
      action,
      details: details ?? null,
    },
  });
}