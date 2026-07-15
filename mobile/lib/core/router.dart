import "package:flutter/material.dart";
import "package:go_router/go_router.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:inventory_mobile/providers/app_providers.dart";
import "package:inventory_mobile/screens/login_screen.dart";
import "package:inventory_mobile/screens/home_shell.dart";

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: "/login",
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final loggingIn = state.matchedLocation == "/login";
      if (!auth.isAuthenticated && !loggingIn) return "/login";
      if (auth.isAuthenticated && loggingIn) return "/home";
      return null;
    },
    routes: [
      GoRoute(path: "/login", builder: (_, __) => const LoginScreen()),
      GoRoute(path: "/home", builder: (_, __) => const HomeShell()),
    ],
  );
});
