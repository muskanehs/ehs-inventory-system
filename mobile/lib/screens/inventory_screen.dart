import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "../providers/app_providers.dart";

class InventoryScreen extends ConsumerStatefulWidget {
  const InventoryScreen({super.key});

  @override
  ConsumerState<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends ConsumerState<InventoryScreen> {
  String _query = "";

  @override
  Widget build(BuildContext context) {
    final inventory = ref.watch(inventoryProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text("Inventory"),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => _showAddStock(context),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: SearchBar(
              hintText: "Search product or SKU",
              onChanged: (v) => setState(() => _query = v.toLowerCase()),
              leading: const Icon(Icons.search),
            ),
          ),
          Expanded(
            child: inventory.when(
              data: (items) {
                final filtered = items.where((item) {
                  if (_query.isEmpty) return true;
                  final product = item["product"] as Map<String, dynamic>?;
                  final name = product?["name"]?.toString().toLowerCase() ?? "";
                  final sku = product?["sku"]?.toString().toLowerCase() ?? "";
                  return name.contains(_query) || sku.contains(_query);
                }).toList();

                if (filtered.isEmpty) {
                  return const Center(child: Text("No stock found"));
                }

                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(inventoryProvider),
                  child: ListView.builder(
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final item = filtered[index];
                      final product = item["product"] as Map<String, dynamic>;
                      final location = item["location"] as Map<String, dynamic>;
                      final qty = item["quantity"] as int? ?? 0;
                      final min = product["minimumStockLevel"] as int? ?? 0;
                      final isLow = min > 0 && qty <= min;

                      return Card(
                        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        child: ListTile(
                          title: Text(product["name"]?.toString() ?? ""),
                          subtitle: Text("${product["sku"]} · ${location["name"]}"),
                          trailing: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text("$qty ${product["unit"]}", style: const TextStyle(fontWeight: FontWeight.bold)),
                              if (isLow)
                                Text("Low stock", style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 12)),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, __) => const Center(child: Text("Failed to load inventory")),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showAddStock(BuildContext context) async {
    final products = await ref.read(productsProvider.future);
    final locations = await ref.read(locationsProvider.future);
    if (!context.mounted || products.isEmpty || locations.isEmpty) return;

    String? productId = products.first["id"] as String?;
    String? locationId = locations.first["id"] as String?;
    final qtyController = TextEditingController(text: "1");

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom, left: 16, right: 16, top: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text("Add Stock", style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: productId,
              items: products
                  .map((p) => DropdownMenuItem(
                        value: p["id"] as String,
                        child: Text(p["name"]?.toString() ?? ""),
                      ))
                  .toList(),
              onChanged: (v) => productId = v,
              decoration: const InputDecoration(labelText: "Product", border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: locationId,
              items: locations
                  .map((l) => DropdownMenuItem(
                        value: l["id"] as String,
                        child: Text(l["name"]?.toString() ?? ""),
                      ))
                  .toList(),
              onChanged: (v) => locationId = v,
              decoration: const InputDecoration(labelText: "Location", border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: qtyController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: "Quantity", border: OutlineInputBorder()),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () async {
                final api = ref.read(apiServiceProvider);
                await api.addStock(
                  productId: productId!,
                  toLocationId: locationId!,
                  quantity: int.parse(qtyController.text),
                );
                ref.invalidate(inventoryProvider);
                if (ctx.mounted) Navigator.pop(ctx);
              },
              child: const Text("Save"),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
