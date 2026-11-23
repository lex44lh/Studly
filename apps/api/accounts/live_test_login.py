"""Same-origin browser entry for the isolated synthetic rehearsal."""

from django import forms
from django.conf import settings
from django.contrib.auth import login, logout
from django.http import Http404, HttpResponseRedirect
from django.shortcuts import render
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.debug import sensitive_post_parameters, sensitive_variables
from django.views.decorators.http import require_http_methods

from .email_auth import EmailError, login_user


class LiveTestLoginForm(forms.Form):
    identifier = forms.CharField(label="Тестовый email или логин", max_length=254)
    password = forms.CharField(label="Пароль", strip=False, max_length=128,
                               widget=forms.PasswordInput(attrs={"autocomplete": "current-password"}))


@never_cache
@require_http_methods(["GET", "POST"])
@csrf_protect
@sensitive_post_parameters()
@sensitive_variables()
def live_test_login(request):
    if not (getattr(settings, "STUDLY_LIVE_TEST_ENABLED", False) and settings.STUDLY_EMAIL_AUTH_ENABLED):
        raise Http404

    form = LiveTestLoginForm(request.POST if request.method == "POST" else None)
    status = 200
    headers = {"Content-Security-Policy": "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}
    if request.method == "POST":
        status = 400
        if form.is_valid():
            try:
                user = login_user(request, **form.cleaned_data)
            except EmailError as exc:
                form.add_error(None, exc.detail)
                status = exc.status
                if exc.retry_after:
                    headers["Retry-After"] = str(exc.retry_after)
            else:
                logout(request)
                login(request, user, backend="django.contrib.auth.backends.ModelBackend")
                return HttpResponseRedirect("/search", status=303)
    response = render(request, "accounts/live_test_login.html", {"form": form}, status=status)
    for name, value in headers.items():
        response[name] = value
    return response
