import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:inventory_mobile/config/api_config.dart";
import "package:inventory_mobile/services/api_service.dart";

final apiServiceProvider = Provider<ApiService>(
  (ref) => ApiService(baseUrl: ApiConfig.baseUrl),
);

class AuthState {
  final bool isAuthenticated;
  final String? userName;
  final String? role;

  const AuthState({this.isAuthenticated = false, this.userName, this.role});

  AuthState copyWith({bool? isAuthenticated, String? userName, String? role}) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      userName: userName ?? this.userName,
      role: role ?? this.role,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(this._api) : super(const AuthState()) {
    _restore();
  }

  final ApiService _api;

  Future<void> _restore() async {
    final token = await _api.token;
    if (token != null) {
      state = const AuthState(isAuthenticated: true, userName: "User");
    }
  }

  Future<void> login(String email, String password) async {
    final data = await _api.login(email, password);
    final user = data["user"] as Map<String, dynamic>;
    state = AuthState(
      isAuthenticated: true,
      userName: user["name"] as String?,
      role: user["role"] as String?,
    );
  }

  Future<void> logout() async {
    await _api.logout();
    state = const AuthState();
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.read(apiServiceProvider));
});

final inventoryProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  return api.getInventory();
});

final productsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  return api.getProducts();
});

final transfersProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  return api.getTransfers();
});

final movementsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  return api.getMovements(limit: 5);
});

final locationsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  return api.getLocations();
});
