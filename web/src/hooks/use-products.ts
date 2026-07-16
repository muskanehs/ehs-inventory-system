import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  ApiResponse,
  Category,
  CategoryStats,
  CreateProductInput,
  Product,
  ProductPickerItem,
  UpdateProductInput
} from "@/lib/types";

export function useProducts(search?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["products", search ?? ""],
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      const response = await api.get<ApiResponse<Product[]>>("/products", {
        params: search ? { search } : undefined
      });
      return response.data.data;
    }
  });
}

export function useProductPicker(params: {
  locationId?: string;
  search?: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["products", "picker", params.locationId ?? "", params.search ?? ""],
    enabled: params.enabled ?? true,
    queryFn: async () => {
      const response = await api.get<ApiResponse<ProductPickerItem[]>>("/products/picker", {
        params: {
          locationId: params.locationId,
          search: params.search || undefined,
          limit: 50
        }
      });
      return response.data.data;
    }
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<Category[]>>("/categories");
      return response.data.data;
    }
  });
}

export function useCategoryStats() {
  return useQuery({
    queryKey: ["categories", "stats"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<CategoryStats>>("/categories/stats");
      return response.data.data;
    }
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      const response = await api.post<ApiResponse<Product>>("/products", input);
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    }
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateProductInput & { id: string }) => {
      const response = await api.patch<ApiResponse<Product>>(`/products/${id}`, input);
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    }
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    }
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      const response = await api.post<ApiResponse<Category>>("/categories", input);
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      void queryClient.invalidateQueries({ queryKey: ["categories", "stats"] });
    }
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      name?: string;
      description?: string;
    }) => {
      const response = await api.patch<ApiResponse<Category>>(`/categories/${id}`, input);
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      void queryClient.invalidateQueries({ queryKey: ["categories", "stats"] });
    }
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/categories/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    }
  });
}
