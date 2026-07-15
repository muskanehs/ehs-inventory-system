import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { InventoryService } from "../src/inventory/inventory.service";
import { PrismaService } from "../src/prisma/prisma.service";

describe("InventoryService", () => {
  it("should be defined", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: PrismaService,
          useValue: {
            inventory: { findMany: jest.fn() },
            product: { findMany: jest.fn(), count: jest.fn() },
            location: { findMany: jest.fn() }
          }
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 0) }
        }
      ]
    }).compile();
    const service = moduleRef.get(InventoryService);
    expect(service).toBeDefined();
  });
});
