import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'authentication_service.dart';

class AuthInterceptor extends Interceptor {
  final Ref ref;
  bool _isRefreshing = false;

  AuthInterceptor(this.ref);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.extra['withCredentials'] = true;
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final path = err.requestOptions.path;

    if (err.response?.statusCode != 401 ||
        path.contains('/auth/refresh') ||
        path.contains('/auth/login') ||
        path.contains('/auth/admin/login')) {
      handler.next(err);
      return;
    }

    if (_isRefreshing) {
      handler.next(err);
      return;
    }

    _isRefreshing = true;
    try {
      await ref.read(apiServiceProvider).refreshToken();
      final retryRes = await ref.read(dioProvider).fetch(err.requestOptions);
      handler.resolve(retryRes);
    } catch (_) {
      handler.next(err);
    } finally {
      _isRefreshing = false;
    }
  }
}
