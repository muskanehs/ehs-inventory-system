import "package:flutter/material.dart";
import "package:go_router/go_router.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "../providers/app_providers.dart";

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);

    return Scaffold(
      appBar: AppBar(title: const Text("Profile")),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              child: ListTile(
                leading: CircleAvatar(child: Text((auth.userName ?? "U")[0])),
                title: Text(auth.userName ?? "User"),
                subtitle: Text(auth.role?.replaceAll("_", " ") ?? ""),
              ),
            ),
            const SizedBox(height: 24),
            FilledButton.tonal(
              onPressed: () async {
                await ref.read(authProvider.notifier).logout();
                if (context.mounted) context.go("/login");
              },
              child: const Text("Log out"),
            ),
          ],
        ),
      ),
    );
  }
}
