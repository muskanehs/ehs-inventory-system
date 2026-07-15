import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "../providers/app_providers.dart";

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inventory = ref.watch(inventoryProvider);
    final transfers = ref.watch(transfersProvider);
    final movements = ref.watch(movementsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text("Dashboard")),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(inventoryProvider);
          ref.invalidate(transfersProvider);
          ref.invalidate(movementsProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            inventory.when(
              data: (items) {
                final total = items.fold<int>(0, (sum, i) => sum + (i["quantity"] as int? ?? 0));
                final lowStock = items.where((i) {
                  final product = i["product"] as Map<String, dynamic>?;
                  final min = product?["minimumStockLevel"] as int? ?? 0;
                  final qty = i["quantity"] as int? ?? 0;
                  return min > 0 && qty <= min;
                }).length;
                return Row(
                  children: [
                    Expanded(child: _MetricCard(title: "Stock Units", value: "$total", icon: Icons.inventory)),
                    const SizedBox(width: 12),
                    Expanded(child: _MetricCard(title: "Low Stock", value: "$lowStock", icon: Icons.warning_amber)),
                  ],
                );
              },
              loading: () => const LinearProgressIndicator(),
              error: (_, __) => const Text("Failed to load metrics"),
            ),
            const SizedBox(height: 16),
            transfers.when(
              data: (items) {
                final pending = items.where((t) => t["status"] == "PENDING").length;
                return _MetricCard(title: "Pending Transfers", value: "$pending", icon: Icons.swap_horiz);
              },
              loading: () => const SizedBox(),
              error: (_, __) => const SizedBox(),
            ),
            const SizedBox(height: 24),
            Text("Recent Activity", style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            movements.when(
              data: (items) => items.isEmpty
                  ? const Card(child: Padding(padding: EdgeInsets.all(16), child: Text("No recent movements")))
                  : Column(
                      children: items.map((m) {
                        final product = m["product"] as Map<String, dynamic>?;
                        return Card(
                          child: ListTile(
                            title: Text(product?["name"]?.toString() ?? "Product"),
                            subtitle: Text("${m["movementType"]} · qty ${m["quantity"]}"),
                          ),
                        );
                      }).toList(),
                    ),
              loading: () => const CircularProgressIndicator(),
              error: (_, __) => const Text("Failed to load activity"),
            ),
          ],
        ),
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;

  const _MetricCard({required this.title, required this.value, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 8),
            Text(value, style: Theme.of(context).textTheme.headlineSmall),
            Text(title, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}
