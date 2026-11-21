"""Checks real API with synthetic identities; never enables or calls payments."""
import argparse
import json
from http.cookiejar import MozillaCookieJar
from urllib.parse import urlsplit
from uuid import uuid4

import requests


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--cookie-file")
    parser.add_argument("--service-id", type=int)
    args = parser.parse_args()
    origin = args.base_url.rstrip("/")
    target = urlsplit(origin)
    if target.hostname not in ("localhost", "127.0.0.1", "live-test.studly-help.ru") or target.path or target.query or target.fragment or target.username:
        parser.error("Use only the dedicated synthetic stand origin.")
    if target.scheme != "https" and not (target.scheme == "http" and target.hostname in ("localhost", "127.0.0.1")):
        parser.error("HTTPS required except for local loopback.")
    client = requests.Session()
    client.trust_env = False
    if args.cookie_file:
        jar = MozillaCookieJar(args.cookie_file)
        jar.load(ignore_discard=True)
        client.cookies.update(jar)
    def call(method, path, expected, **kwargs):
        response = client.request(method, origin + path, timeout=15, allow_redirects=False, **kwargs)
        if response.status_code != expected:
            raise RuntimeError(f"{method} {path}: expected {expected}, got {response.status_code}; response omitted")
        print(json.dumps({"method": method, "path": path, "status": response.status_code}))
        return response
    for path in ("/api/v1/health/", "/api/v1/ready/"):
        if call("GET", path, 200).json() != {"status": "ok"}:
            raise RuntimeError("Health/readiness shape mismatch")
    call("GET", "/api/v1/auth/options/", 200)
    call("GET", "/api/v2/services/", 200)
    call("GET", "/media/", 404)
    if not args.cookie_file:
        call("GET", "/api/v1/auth/me/", 403)
        return
    actor = call("GET", "/api/v1/auth/me/", 200).json()["user"]
    if not actor["display_name"].startswith("[ТЕСТ]"):
        raise RuntimeError("Refusing mutations for a non-synthetic actor")
    if not args.service_id:
        return
    service = call("GET", f"/api/v2/services/{args.service_id}/", 200).json()
    if not service["title"].startswith("[ТЕСТ]"):
        raise RuntimeError("Refusing mutations for a non-synthetic service")
    payload = {"service_id": args.service_id, "extra_ids": []}
    call("POST", "/api/v2/quotes/", 403, json=payload)
    token = call("GET", "/api/v1/auth/csrf/", 200).json()["csrf_token"]
    headers = {"X-CSRFToken": token, "Origin": origin, "Referer": origin + "/"}
    call("POST", "/api/v2/quotes/", 403, json=payload, headers={**headers, "Origin": "https://example.invalid"})
    quote = call("POST", "/api/v2/quotes/", 201, json=payload, headers=headers).json()
    order_payload = {"quote_id": quote["quote_id"], "request_key": str(uuid4())}
    order = call("POST", "/api/v2/orders/", 201, json=order_payload, headers=headers).json()
    repeated = call("POST", "/api/v2/orders/", 200, json=order_payload, headers=headers).json()
    if order["id"] != repeated["id"] or order["status"] != "pending_acceptance":
        raise RuntimeError("Order idempotency/lifecycle mismatch")
    call("GET", f"/api/v1/orders/{order['id']}/conversation/", 200)
    print(json.dumps({"synthetic_order_id": order["id"], "payment_executed": False}))


if __name__ == "__main__":
    main()
