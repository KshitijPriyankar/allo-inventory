import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateReservationSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const parsed = CreateReservationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity } = parsed.data;

    const reservation = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const expired = await tx.reservation.findMany({
        where: {
          productId,
          warehouseId,
          status: "PENDING",
          expiresAt: { lt: now },
        },
        select: { id: true, quantity: true },
      });

      if (expired.length > 0) {
        const totalExpired = expired.reduce((sum, r) => sum + r.quantity, 0);
        await tx.reservation.updateMany({
          where: { id: { in: expired.map((r) => r.id) } },
          data: { status: "RELEASED" },
        });
        await tx.$executeRaw`
          UPDATE "Stock"
          SET reserved = GREATEST(0, reserved - ${totalExpired})
          WHERE "productId" = ${productId}
            AND "warehouseId" = ${warehouseId}
        `;
      }
      const rowsAffected = await tx.$executeRaw`
        UPDATE "Stock"
        SET reserved = reserved + ${quantity}
        WHERE "productId"   = ${productId}
          AND "warehouseId" = ${warehouseId}
          AND ("totalUnits" - reserved) >= ${quantity}
      `;

      if (rowsAffected === 0) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      return tx.reservation.create({
        data: { productId, warehouseId, quantity, expiresAt },
        include: { product: true, warehouse: true },
      });
    });

    return NextResponse.json(reservation, { status: 201 });

  } catch (error: any) {
    if (error.message === "INSUFFICIENT_STOCK") {
      return NextResponse.json(
        { error: "Not enough stock available. Someone else may have just reserved the last unit." },
        { status: 409 }
      );
    }
    console.error("POST /api/reservations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}