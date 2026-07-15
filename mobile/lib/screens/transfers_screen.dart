import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "../providers/app_providers.dart";

class TransfersScreen extends ConsumerWidget {
  const TransfersScreen({super.key});

  Color _statusColor(BuildContext context, String status) {
    switch (status) {
      case "PENDING":
        return Colors.amber;
      case "APPROVED":
        return Colors.blue;
      case "COMPLETED":
        return Colors.green;
      case "REJECTED":
        return Theme.of(context).colorScheme.error;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final transfers = ref.watch(transfersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text("Transfers"),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => _createTransfer(context, ref),
          ),
        ],
      ),
      body: transfers.when(
        data: (items) {
          if (items.isEmpty) {
            return const Center(child: Text("No transfers yet"));
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(transfersProvider),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              itemBuilder: (context, index) {
                final t = items[index];
                final product = t["product"] as Map<String, dynamic>?;
                final from = t["fromLocation"] as Map<String, dynamic>?;
                final to = t["toLocation"] as Map<String, dynamic>?;
                final status = t["status"] as String? ?? "";

                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                product?["name"]?.toString() ?? "Product",
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                            ),
                            Chip(
                              label: Text(status),
                              backgroundColor: _statusColor(context, status).withValues(alpha: 0.15),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text("${from?["name"]} → ${to?["name"]}"),
                        Text("Quantity: ${t["quantity"]}"),
                        if (status == "PENDING") ...[
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              FilledButton(
                                onPressed: () async {
                                  await ref.read(apiServiceProvider).approveTransfer(t["id"] as String);
                                  ref.invalidate(transfersProvider);
                                },
                                child: const Text("Approve"),
                              ),
                            ],
                          ),
                        ],
                        if (status == "APPROVED") ...[
                          const SizedBox(height: 12),
                          FilledButton(
                            onPressed: () async {
                              await ref.read(apiServiceProvider).completeTransfer(t["id"] as String);
                              ref.invalidate(transfersProvider);
                              ref.invalidate(inventoryProvider);
                            },
                            child: const Text("Complete"),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const Center(child: Text("Failed to load transfers")),
      ),
    );
  }

  Future<void> _createTransfer(BuildContext context, WidgetRef ref) async {
    final products = await ref.read(productsProvider.future);
    final locations = await ref.read(locationsProvider.future);
    if (!context.mounted || products.isEmpty || locations.length < 2) return;

    String? productId = products.first["id"] as String?;
    String? fromId = locations.first["id"] as String?;
    String? toId = locations[1]["id"] as String?;
    final qtyController = TextEditingController(text: "1");

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom, left: 16, right: 16, top: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text("New Transfer", style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: productId,
              items: products
                  .map((p) => DropdownMenuItem(value: p["id"] as String, child: Text(p["name"]?.toString() ?? "")))
                  .toList(),
              onChanged: (v) => productId = v,
              decoration: const InputDecoration(labelText: "Product", border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: fromId,
              items: locations
                  .map((l) => DropdownMenuItem(value: l["id"] as String, child: Text(l["name"]?.toString() ?? "")))
                  .toList(),
              onChanged: (v) => fromId = v,
              decoration: const InputDecoration(labelText: "From", border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: toId,
              items: locations
                  .map((l) => DropdownMenuItem(value: l["id"] as String, child: Text(l["name"]?.toString() ?? "")))
                  .toList(),
              onChanged: (v) => toId = v,
              decoration: const InputDecoration(labelText: "To", border: OutlineInputBorder()),
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
                await ref.read(apiServiceProvider).createTransfer(
                      productId: productId!,
                      fromLocationId: fromId!,
                      toLocationId: toId!,
                      quantity: int.parse(qtyController.text),
                    );
                ref.invalidate(transfersProvider);
                if (ctx.mounted) Navigator.pop(ctx);
              },
              child: const Text("Submit"),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
