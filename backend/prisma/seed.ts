import { PrismaClient, Role } from "@prisma/client";
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

async function main() {
  const adminPassword = await bcrypt.hash("Admin@123", 10);

  await upsertUserByEmail(
    "admin@ehsinventory.in",
    {
      name: "System Admin",
      email: "admin@ehsinventory.in",
      passwordHash: adminPassword,
      role: Role.ADMIN,
      mustChangePassword: true
    },
    {
      name: "System Admin",
      passwordHash: adminPassword,
      role: Role.ADMIN,
      mustChangePassword: true
    }
  );
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
