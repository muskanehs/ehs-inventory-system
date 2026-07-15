import "package:dio/dio.dart";
import "package:inventory_mobile/config/api_config.dart";
import "token_storage.dart";

class ApiService {
  ApiService({String baseUrl = ApiConfig.baseUrl})
      : _dio = Dio(BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 15),
        )) {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _tokenStorage.accessToken();
        if (token != null) {
          options.headers["Authorization"] = "Bearer $token";
        }
        handler.next(options);
      },
    ));
  }

  final Dio _dio;
  final TokenStorage _tokenStorage = TokenStorage();

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await _dio.post("/auth/login", data: {
      "email": email,
      "password": password,
    });
    final data = response.data["data"] as Map<String, dynamic>;
    await _tokenStorage.save(
      data["accessToken"] as String,
      data["refreshToken"] as String,
    );
    return data;
  }

  Future<void> logout() => _tokenStorage.clear();

  Future<String?> get token => _tokenStorage.accessToken();

  Future<List<dynamic>> getProducts({String? search}) async {
    final response = await _dio.get("/products", queryParameters: {
      if (search != null && search.isNotEmpty) "search": search,
    });
    return response.data["data"] as List<dynamic>;
  }

  Future<List<dynamic>> getInventory() async {
    final response = await _dio.get("/inventory");
    return response.data["data"] as List<dynamic>;
  }

  Future<List<dynamic>> getLocations() async {
    final response = await _dio.get("/locations");
    return response.data["data"] as List<dynamic>;
  }

  Future<List<dynamic>> getTransfers() async {
    final response = await _dio.get("/transfers");
    return response.data["data"] as List<dynamic>;
  }

  Future<List<dynamic>> getMovements({int limit = 10}) async {
    final response = await _dio.get("/movements", queryParameters: {"limit": limit});
    return response.data["data"] as List<dynamic>;
  }

  Future<void> addStock({
    required String productId,
    required String toLocationId,
    required int quantity,
    String movementType = "PURCHASE",
    String? remarks,
  }) async {
    await _dio.post("/movements", data: {
      "productId": productId,
      "toLocationId": toLocationId,
      "quantity": quantity,
      "movementType": movementType,
      if (remarks != null) "remarks": remarks,
    });
  }

  Future<void> createTransfer({
    required String productId,
    required String fromLocationId,
    required String toLocationId,
    required int quantity,
    String? remarks,
  }) async {
    await _dio.post("/transfers", data: {
      "productId": productId,
      "fromLocationId": fromLocationId,
      "toLocationId": toLocationId,
      "quantity": quantity,
      if (remarks != null) "remarks": remarks,
    });
  }

  Future<void> approveTransfer(String id) => _dio.patch("/transfers/$id/approve");

  Future<void> completeTransfer(String id) => _dio.patch("/transfers/$id/complete");
}
