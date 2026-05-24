import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  const delhi = await prisma.warehouse.create({
    data: { name: "Delhi Hub", location: "New Delhi, India" },
  });
  const mumbai = await prisma.warehouse.create({
    data: { name: "Mumbai Hub", location: "Mumbai, India" },
  });

  const headphones = await prisma.product.create({
    data: {
      name: "Wireless Headphones",
      description: "Noise-cancelling over-ear headphones with 30hr battery",
      price: 2999,
    },
  });
  const keyboard = await prisma.product.create({
    data: {
      name: "Mechanical Keyboard",
      description: "RGB backlit 75% layout with Cherry MX switches",
      price: 4499,
    },
  });
  const hub = await prisma.product.create({
    data: {
      name: "USB-C Hub",
      description: "7-in-1 multiport adapter — HDMI, USB-A, SD card",
      price: 1299,
    },
  });

  await prisma.stock.createMany({
    data: [
      { productId: headphones.id, warehouseId: delhi.id,  totalUnits: 10 },
      { productId: headphones.id, warehouseId: mumbai.id, totalUnits: 5  },
      { productId: keyboard.id,   warehouseId: delhi.id,  totalUnits: 3  },
      { productId: keyboard.id,   warehouseId: mumbai.id, totalUnits: 8  },
      { productId: hub.id,        warehouseId: delhi.id,  totalUnits: 1  },
      { productId: hub.id,        warehouseId: mumbai.id, totalUnits: 15 },
    ],
  });

  console.log("✅ Done! Warehouses: 2, Products: 3, Stock rows: 6");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());