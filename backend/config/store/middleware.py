from django.http import JsonResponse
from django.conf import settings
from django.http import HttpResponseForbidden
from django.utils.cache import patch_vary_headers


class ApiCorsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = request.headers.get('Origin')
        is_api = request.path.startswith('/api/')
        if is_api and origin and origin not in settings.CORS_ALLOWED_ORIGINS:
            return HttpResponseForbidden('Origin is not allowed.')
        if is_api and request.method == 'OPTIONS':
            response = JsonResponse({}, status=200)
        else:
            response = self.get_response(request)
        if is_api and origin:
            response['Access-Control-Allow-Origin'] = origin
            response['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
            response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
            response['Access-Control-Max-Age'] = '600'
            patch_vary_headers(response, ('Origin',))
        return response
