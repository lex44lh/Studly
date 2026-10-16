from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .return_paths import validate_return_path


class ReturnPathTests(SimpleTestCase):
    def test_local_paths_queries_fragments_and_unicode_are_allowed(self):
        for value in ("/", "/register/roles", "/register/profile", "/orders/12/?tab=messages#last",
                      "/каталог/", "/search?q=%D0%BC%D0%B0%D1%82%D0%B5%D0%BC", "/price/50%"):
            with self.subTest(value=value):
                self.assertEqual(validate_return_path(value), value)

    def test_external_ambiguous_and_encoded_redirects_are_rejected(self):
        for value in (None, "", "profile", "https://studly.test/register/roles", "https://attacker.invalid/",
                      "//attacker.invalid/", "///attacker.invalid/", "javascript:alert(1)",
                      "/\\attacker.invalid/", "\\attacker.invalid", "/%2fattacker.invalid/",
                      "/%252fattacker.invalid/", "/%5cattacker.invalid/", "/%255cattacker.invalid/",
                      "/register/roles\r\nLocation: https://attacker.invalid/", "/%0d%0aevil",
                      "/%2500evil", "/\x00evil", "/\x7fevil", " /profile/", "/profile/ ",
                      "/%ff", "/" + "x" * 2048):
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_return_path(value)

    def test_invalid_or_duplicate_next_does_not_start_oauth_or_create_session(self):
        client = APIClient()
        with patch("accounts.views.oidc_client") as oidc:
            for data in ({"next": ""}, {"next": "https://attacker.invalid/"},
                         {"next": ["/register/roles", "/profile/"]}):
                with self.subTest(data=data):
                    response = client.get(reverse("accounts:oidc-start"), data)
                    self.assertEqual(response.status_code, 400)
                    self.assertEqual(response.json()["code"], "invalid_return_path")
                    self.assertIn("no-store", response["Cache-Control"])
                    self.assertNotIn("Location", response)
            oidc.assert_not_called()
        self.assertNotIn("sessionid", client.cookies)
