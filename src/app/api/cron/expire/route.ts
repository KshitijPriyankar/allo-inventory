export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const expired = await prisma.reservation.findMany({
      where: { status: "PENDING", expiresAt: { lt: now } },
      select: { id: true, productId: true, warehouseId: true, quantity: true },
    });

    if (expired.length === 0) {
      return NextResponse.json({ released: 0, message: "Nothing to release" });
    }

    const stockMap = new Map<string, number>();
    for (const r of expired) {
      const key = `${r.productId}:${r.warehouseId}`;
      stockMap.set(key, (stockMap.get(key) ?? 0) + r.quantity);
    }

    await prisma.$transaction([
      prisma.reservation.updateMany({
        where: { id: { in: expired.map((r) => r.id) } },
        data:  { status: "RELEASED" },
      }),
      ...Array.from(stockMap.entries()).map(([key, qty]) => {
        const [productId, warehouseId] = key.split(":");
        return prisma.stock.update({
          where: { productId_warehouseId: { productId, warehouseId } },
          data:  { reserved: { decrement: qty } },
        });
      }),
    ]);

    console.log(`[cron] Released ${expired.length} expired reservations`);
    return NextResponse.json({ released: expired.length });

  } catch (error) {
    console.error("[cron] Error:", error);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}