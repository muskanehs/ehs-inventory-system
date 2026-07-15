import "package:flutter_secure_storage/flutter_secure_storage.dart";

class TokenStorage {
  static const _storage = FlutterSecureStorage();
  static const _accessKey = "access_token";
  static const _refreshKey = "refresh_token";

  Future<void> save(String accessToken, String refreshToken) async {
    await _storage.write(key: _accessKey, value: accessToken);
    await _storage.write(key: _refreshKey, value: refreshToken);
  }

  Future<String?> accessToken() => _storage.read(key: _accessKey);

  Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }
}
