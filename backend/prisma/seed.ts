import { PrismaClient, Role, LocationType, TransferStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function upsertUserByEmail(
  email: string,
  create: Parameters<typeof prisma.user.create>[0]["data"],
  update?: Parameters<typeof prisma.user.update>[0]["data"]
) {
  const existing = await prisma.user.findFirst({ where: { email, isDeleted: false } });
  if (existing) {
    return prisma.user.update({ where: { id: existing.id }, data: update ?? {} });
  }
  return prisma.user.create({ data: create });
}

async function upsertLocationByName(
  name: string,
  type: LocationType
) {
  const existing = await prisma.location.findFirst({ where: { name, isDeleted: false } });
  if (existing) {
    return prisma.location.update({ where: { id: existing.id }, data: { type } });
  }
  return prisma.location.create({ data: { name, type } });
}

async function upsertCategoryByName(name: string, description: string) {
  const existing = await prisma.category.findFirst({ where: { name, isDeleted: false } });
  if (existing) {
    return prisma.category.update({ where: { id: existing.id }, data: { description } });
  }
  return prisma.category.create({ data: { name, description } });
}

async function upsertProductBySku(
  sku: string,
  data: {
    name: string;
    categoryId: string;
    unit: string;
    minimumStockLevel: number;
  }
) {
  const existing = await prisma.product.findFirst({ where: { sku, isDeleted: false } });
  if (existing) {
    return prisma.product.update({ where: { id: existing.id }, data });
  }
  return prisma.product.create({ data: { sku, ...data } });
}

async function main() {
  const adminPassword = await bcrypt.hash("Admin@123", 10);
  const godownPassword = await bcrypt.hash("Godown@123", 10);

  const admin = await upsertUserByEmail("admin@inventory.local", {
    name: "System Admin",
    email: "admin@inventory.local",
    passwordHash: adminPassword,
    role: Role.ADMIN,
    mustChangePassword: true
  });

  const mainStore = await upsertLocationByName("Main Store", LocationType.STORE);

  const godown1 = await upsertLocationByName("Godown 1", LocationType.GODOWN);

  const godown2 = await upsertLocationByName("Godown 2", LocationType.GODOWN);

  const godown1User = await upsertUserByEmail(
    "godown1@inventory.local",
    {
      name: "Godown 1 Manager",
      email: "godown1@inventory.local",
      passwordHash: godownPassword,
      role: Role.GODOWN_MANAGER,
      assignedLocationId: godown1.id,
      mustChangePassword: true
    },
    { assignedLocationId: godown1.id }
  );

  await upsertUserByEmail(
    "godown2@inventory.local",
    {
      name: "Godown 2 Manager",
      email: "godown2@inventory.local",
      passwordHash: godownPassword,
      role: Role.GODOWN_MANAGER,
      assignedLocationId: godown2.id,
      mustChangePassword: true
    },
    { assignedLocationId: godown2.id }
  );

  const grocery = await upsertCategoryByName("Grocery", "Food and daily essentials");

  const electronics = await upsertCategoryByName("Electronics", "Electronic items and accessories");

  const stationery = await upsertCategoryByName("Stationery", "Office and school supplies");

  const products = [
    {
      sku: "RICE-25KG",
      name: "Basmati Rice 25kg",
      categoryId: grocery.id,
      unit: "Bag",
      minimumStockLevel: 20,
      stock: [
        { locationId: mainStore.id, quantity: 45 },
        { locationId: godown1.id, quantity: 120 },
        { locationId: godown2.id, quantity: 8 }
      ]
    },
    {
      sku: "OIL-5L",
      name: "Sunflower Oil 5L",
      categoryId: grocery.id,
      unit: "Bucket",
      minimumStockLevel: 15,
      stock: [
        { locationId: mainStore.id, quantity: 12 },
        { locationId: godown1.id, quantity: 60 },
        { locationId: godown2.id, quantity: 25 }
      ]
    },
    {
      sku: "TEA-500G",
      name: "Premium Tea 500g",
      categoryId: grocery.id,
      unit: "Packet",
      minimumStockLevel: 30,
      stock: [
        { locationId: mainStore.id, quantity: 5 },
        { locationId: godown1.id, quantity: 80 },
        { locationId: godown2.id, quantity: 40 }
      ]
    },
    {
      sku: "USB-C-1M",
      name: "USB-C Cable 1m",
      categoryId: electronics.id,
      unit: "Pc",
      minimumStockLevel: 10,
      stock: [
        { locationId: mainStore.id, quantity: 22 },
        { locationId: godown1.id, quantity: 3 },
        { locationId: godown2.id, quantity: 15 }
      ]
    },
    {
      sku: "EAR-BT",
      name: "Bluetooth Earbuds",
      categoryId: electronics.id,
      unit: "Pc",
      minimumStockLevel: 8,
      stock: [
        { locationId: mainStore.id, quantity: 6 },
        { locationId: godown1.id, quantity: 25 },
        { locationId: godown2.id, quantity: 2 }
      ]
    },
    {
      sku: "NOTE-A4",
      name: "A4 Notebook Pack",
      categoryId: stationery.id,
      unit: "Packet",
      minimumStockLevel: 12,
      stock: [
        { locationId: mainStore.id, quantity: 30 },
        { locationId: godown1.id, quantity: 50 },
        { locationId: godown2.id, quantity: 18 }
      ]
    }
  ];

  const createdProducts = [];
  for (const item of products) {
    const product = await upsertProductBySku(item.sku, {
      name: item.name,
      categoryId: item.categoryId,
      unit: item.unit,
      minimumStockLevel: item.minimumStockLevel
    });
    createdProducts.push(product);

    for (const entry of item.stock) {
      await prisma.inventory.upsert({
        where: {
          productId_locationId: {
            productId: product.id,
            locationId: entry.locationId
          }
        },
        update: { quantity: entry.quantity },
        create: {
          productId: product.id,
          locationId: entry.locationId,
          quantity: entry.quantity
        }
      });
    }
  }

  const riceProduct = createdProducts.find((p) => p.sku === "RICE-25KG");
  if (riceProduct) {
    const existingTransfer = await prisma.transfer.findFirst({
      where: {
        fromLocationId: godown1.id,
        toLocationId: mainStore.id,
        status: TransferStatus.PENDING,
        items: { some: { productId: riceProduct.id } }
      }
    });

    if (!existingTransfer) {
      await prisma.transfer.create({
        data: {
          fromLocationId: godown1.id,
          toLocationId: mainStore.id,
          driverName: "Sample Driver",
          vehicleNumber: "MH-01-AB-1234",
          vehicleContact: "9876543210",
          status: TransferStatus.PENDING,
          requestedBy: godown1User.id,
          remarks: "Restock main store from godown",
          items: {
            create: {
              productId: riceProduct.id,
              quantity: 10
            }
          }
        }
      });
    }
  }

  const movementCount = await prisma.stockMovement.count();
  if (movementCount === 0) {
    await prisma.stockMovement.createMany({
      data: [
        {
          productId: createdProducts[0].id,
          toLocationId: godown1.id,
          quantity: 50,
          movementType: "PURCHASE",
          performedBy: admin.id,
          remarks: "Initial stock purchase"
        },
        {
          productId: createdProducts[3].id,
          fromLocationId: godown2.id,
          toLocationId: mainStore.id,
          quantity: 5,
          movementType: "TRANSFER",
          performedBy: admin.id,
          remarks: "Store replenishment"
        }
      ]
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
