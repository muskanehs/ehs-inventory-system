import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NOT_DELETED } from "../common/utils/soft-delete";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      where: NOT_DELETED,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: "desc" }
    });
  }
}
