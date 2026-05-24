import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        stocks: { include: { warehouse: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const result = products.map((product) => ({
      id:          product.id,
      name:        product.name,
      description: product.description,
      price:       product.price,
      stocks: product.stocks.map((stock) => ({
        warehouseId:       stock.warehouseId,
        warehouseName:     stock.warehouse.name,
        warehouseLocation: stock.warehouse.location,
        totalUnits:        stock.totalUnits,
        reserved:          stock.reserved,
        available:         stock.totalUnits - stock.reserved,
      })),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}