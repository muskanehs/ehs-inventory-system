import { ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { NOT_DELETED, restoreData, softDeleteData } from "../common/utils/soft-delete";

const categoryInclude = {
  _count: { select: { products: { where: NOT_DELETED } } }
} as const;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(includeDeleted = false) {
    return this.prisma.category.findMany({
      where: includeDeleted ? undefined : NOT_DELETED,
      orderBy: { name: "asc" },
      include: categoryInclude
    });
  }

  async findOne(id: string, includeDeleted = false) {
    const category = await this.prisma.category.findFirst({
      where: includeDeleted ? { id } : { id, ...NOT_DELETED },
      include: categoryInclude
    });
    if (!category) {
      throw new NotFoundException(`Category not found`);
    }
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findFirst({
      where: { name: dto.name.trim(), ...NOT_DELETED }
    });
    if (existing) {
      throw new ConflictException(`Category "${dto.name}" already exists`);
    }

    return this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim()
      },
      include: categoryInclude
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);

    if (dto.name) {
      const existing = await this.prisma.category.findFirst({
        where: { name: dto.name.trim(), NOT: { id }, ...NOT_DELETED }
      });
      if (existing) {
        throw new ConflictException(`Category "${dto.name}" already exists`);
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null })
      },
      include: categoryInclude
    });
  }

  async remove(id: string, deletedBy?: string) {
    const category = await this.findOne(id);
    if (category._count.products > 0) {
      throw new ConflictException(
        `Cannot delete category with ${category._count.products} product(s). Reassign products first.`
      );
    }
    return this.prisma.category.update({
      where: { id },
      data: softDeleteData(deletedBy),
      include: categoryInclude
    });
  }

  async restore(id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, isDeleted: true },
      include: categoryInclude
    });
    if (!category) {
      throw new NotFoundException("Deleted category not found");
    }

    const nameConflict = await this.prisma.category.findFirst({
      where: { name: category.name, NOT: { id }, ...NOT_DELETED }
    });
    if (nameConflict) {
      throw new ConflictException(`Cannot restore: category "${category.name}" already exists`);
    }

    return this.prisma.category.update({
      where: { id },
      data: restoreData(),
      include: categoryInclude
    });
  }

  async getStats() {
    const [categoryCount, productCount, productsCategorized] = await Promise.all([
      this.prisma.category.count({ where: NOT_DELETED }),
      this.prisma.product.count({ where: NOT_DELETED }),
      this.prisma.product.count({
        where: { ...NOT_DELETED, category: NOT_DELETED }
      })
    ]);

    return {
      categoryCount,
      productsCategorized,
      uncategorized: Math.max(0, productCount - productsCategorized)
    };
  }

  findAllForExport() {
    return this.prisma.category.findMany({
      where: NOT_DELETED,
      orderBy: { name: "asc" },
      include: categoryInclude
    });
  }

  async getListEtag() {
    const count = await this.prisma.category.count({ where: NOT_DELETED });
    return `"categories-${count}"`;
  }

  assertNotModified(ifNoneMatch: string | undefined, etag: string) {
    if (ifNoneMatch && ifNoneMatch === etag) {
      throw new HttpException("", HttpStatus.NOT_MODIFIED);
    }
  }
}
