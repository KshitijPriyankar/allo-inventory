import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: params.id },
      });

      if (!reservation) throw new Error("NOT_FOUND");

      if (reservation.status !== "PENDING") {
        return tx.reservation.findUnique({
          where: { id: params.id },
          include: { product: true, warehouse: true },
        });
      }

      const released = await tx.reservation.update({
        where: { id: params.id },
        data: { status: "RELEASED" },
        include: { product: true, warehouse: true },
      });

      await tx.$executeRaw`
        UPDATE "Stock"
        SET reserved = GREATEST(0, reserved - ${reservation.quantity})
        WHERE "productId"   = ${reservation.productId}
          AND "warehouseId" = ${reservation.warehouseId}
      `;

      return released;
    });

    return NextResponse.json(result);

  } catch (error: any) {
    if (error.message === "NOT_FOUND")
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    console.error("release error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}