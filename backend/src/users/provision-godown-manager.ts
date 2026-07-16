import { Role, type Prisma } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { NOT_DELETED } from "../common/utils/soft-delete";

const DEFAULT_GODOWN_PASSWORD = "Godown@123";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function resolveUniqueEmail(
  tx: Prisma.TransactionClient,
  godownName: string
): Promise<string> {
  const base = slugify(godownName) || "godown";
  let candidate = `godown-${base}@inventory.local`;
  let suffix = 2;

  while (
    await tx.user.findFirst({
      where: { email: candidate, ...NOT_DELETED }
    })
  ) {
    candidate = `godown-${base}-${suffix}@inventory.local`;
    suffix += 1;
  }

  return candidate;
}

export async function provisionGodownManager(
  tx: Prisma.TransactionClient,
  godown: { id: string; name: string }
) {
  const email = await resolveUniqueEmail(tx, godown.name);
  const passwordHash = await bcrypt.hash(DEFAULT_GODOWN_PASSWORD, 10);

  return tx.user.create({
    data: {
      name: `${godown.name} Manager`,
      email,
      passwordHash,
      role: Role.GODOWN_MANAGER,
      assignedLocationId: godown.id,
      mustChangePassword: true
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  });
}
