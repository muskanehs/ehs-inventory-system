import "package:dio/dio.dart";

class ApiClient {
  final Dio dio;
  ApiClient(String baseUrl)
      : dio = Dio(BaseOptions(baseUrl: baseUrl, connectTimeout: const Duration(seconds: 15)));
}
