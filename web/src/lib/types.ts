export type Role = "ADMIN" | "STORE_MANAGER" | "GODOWN_MANAGER" | "STAFF";

export type LocationType = "STORE" | "GODOWN";

export type MovementType =
  | "PURCHASE"
  | "SALE"
  | "TRANSFER"
  | "DAMAGE"
  | "ADJUSTMENT"
  | "RETURN";

export type TransferStatus = "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";

export type TransferType = "INTERNAL" | "CUSTOMER";

export type ApiResponse<T> = {
  success: true;
  data: T;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type DashboardSummary = {
  totalProducts: number;
  totalStockUnits: number;
  lowStockCount: number;
  locationCount: number;
  pendingTransfers: number;
  lowStockItems: LowStockProduct[];
};

export type CategoryStats = {
  categoryCount: number;
  productsCategorized: number;
  uncategorized: number;
};

export type ProductPickerItem = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  availableQty?: number;
};

export type GodownSummary = Location & {
  productCount: number;
  totalUnits: number;
};

export type GodownsSummaryResponse = {
  godowns: GodownSummary[];
  totals: { godownCount: number; productCount: number; totalUnits: number };
};

export type ApiProductStockGroup = {
  product: Product;
  totalQuantity: number;
  storeTotal: number;
  godownTotal: number;
  items: InventoryItem[];
  isLowStock: boolean;
};

export type Category = {
  id: string;
  name: string;
  description?: string | null;
  _count?: { products: number };
};

export type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode?: string | null;
  categoryId: string;
  unit: string;
  minimumStockLevel: number;
  isActive: boolean;
  category?: Category;
};

export type Location = {
  id: string;
  name: string;
  type: LocationType;
  createdAt?: string;
  updatedAt?: string;
};

export type InventoryItem = {
  id: string;
  productId: string;
  locationId: string;
  quantity: number;
  product: Product;
  location: Location;
};

export type UserSummary = {
  id: string;
  name: string;
  role: Role;
  email?: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email?: string;
  role: Role;
  assignedLocationId?: string | null;
  assignedLocation?: Pick<Location, "id" | "name" | "type"> | null;
  mustChangePassword?: boolean;
  canSwitchUsers?: boolean;
};

export type StockMovement = {
  id: string;
  productId: string;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  quantity: number;
  movementType: MovementType;
  remarks?: string | null;
  performedBy: string;
  createdAt: string;
  product: Product;
  user: UserSummary;
};

export type TransferLineItem = {
  id: string;
  transferId: string;
  productId: string;
  quantity: number;
  product?: Product | null;
};

export type Transfer = {
  id: string;
  transferType: TransferType;
  fromLocationId: string;
  toLocationId?: string | null;
  driverName?: string | null;
  vehicleNumber?: string | null;
  vehicleContact?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  status: TransferStatus;
  requestedBy: string;
  approvedBy?: string | null;
  rejectionReason?: string | null;
  remarks?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items: TransferLineItem[];
  fromLocation: Location | null;
  toLocation: Location | null;
  requestedByUser: UserSummary | null;
  approvedByUser: UserSummary | null;
};

export type ProductVelocity = {
  productId: string;
  name: string;
  sku: string | null;
  category: string;
  activityScore: number;
  currentStock: number;
};

export type VelocityReport = {
  fast: ProductVelocity[];
  slow: ProductVelocity[];
  periodDays: number;
};

export type LowStockProduct = {
  product: Product;
  totalQuantity: number;
};

export type CreateProductInput = {
  name: string;
  sku?: string;
  categoryId: string;
  unit: string;
  barcode?: string;
  minimumStockLevel?: number;
};

export type UpdateProductInput = {
  name?: string;
  sku?: string;
  categoryId?: string;
  unit?: string;
  barcode?: string;
  minimumStockLevel?: number;
  isActive?: boolean;
};

export type CreateMovementInput = {
  productId: string;
  fromLocationId?: string;
  toLocationId?: string;
  quantity: number;
  movementType: MovementType;
  remarks?: string;
};

export type CreateTransferInput = {
  transferType?: TransferType;
  fromLocationId: string;
  toLocationId?: string;
  driverName?: string;
  vehicleNumber?: string;
  vehicleContact?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  remarks?: string;
  items: { productId: string; quantity: number }[];
};
