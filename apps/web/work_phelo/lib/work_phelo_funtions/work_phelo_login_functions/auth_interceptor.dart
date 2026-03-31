import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'authentication_service.dart';
import 'authentication_state.dart';

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
    if (_isRefreshing || err.requestOptions.path.contains('/auth/refresh')) {
      _isRefreshing = false;
      handler.next(err);
      return;
    }

    if (err.response?.statusCode == 401) {
      _isRefreshing = true;
      try {
        await ref.read(apiServiceProvider).refreshToken();
        _isRefreshing = false;
        final retryRes = await ref.read(dioProvider).fetch(err.requestOptions);
        return handler.resolve(retryRes);
      } catch (_) {
        _isRefreshing = false;
        await ref.read(authNotifierProvider.notifier).logout();
      }
    }

    handler.next(err);
  }
}
