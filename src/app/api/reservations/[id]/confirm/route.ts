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

      if (reservation.status === "CONFIRMED") {
        return tx.reservation.findUnique({
          where: { id: params.id },
          include: { product: true, warehouse: true },
        });
      }

      if (reservation.status === "RELEASED") {
        throw new Error("ALREADY_RELEASED");
      }

      if (new Date() > reservation.expiresAt) {
        await tx.reservation.update({
          where: { id: params.id },
          data: { status: "RELEASED" },
        });
        await tx.$executeRaw`
          UPDATE "Stock"
          SET reserved = GREATEST(0, reserved - ${reservation.quantity})
          WHERE "productId"   = ${reservation.productId}
            AND "warehouseId" = ${reservation.warehouseId}
        `;
        throw new Error("EXPIRED");
      }

      const confirmed = await tx.reservation.update({
        where: { id: params.id },
        data: { status: "CONFIRMED" },
        include: { product: true, warehouse: true },
      });

      await tx.stock.update({
        where: {
          productId_warehouseId: {
            productId:   reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: {
          totalUnits: { decrement: reservation.quantity },
          reserved:   { decrement: reservation.quantity },
        },
      });

      return confirmed;
    });

    return NextResponse.json(result);

  } catch (error: any) {
    if (error.message === "NOT_FOUND")
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    if (error.message === "EXPIRED")
      return NextResponse.json({ error: "This reservation has expired." }, { status: 410 });
    if (error.message === "ALREADY_RELEASED")
      return NextResponse.json({ error: "This reservation was already released." }, { status: 410 });
    console.error("confirm error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}