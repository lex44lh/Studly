from urllib.parse import urlsplit

from django.test import SimpleTestCase
from django.urls import resolve, reverse
from rest_framework.test import APIClient


class ApiNavigationTests(SimpleTestCase):
    client_class = APIClient

    def test_public_navigation_returns_existing_links_without_database(self):
        response = self.client.get(reverse("api-root"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/json")
        links = response.json()
        self.assertEqual(links["services"], "http://testserver/api/v1/services/")
        for url in links.values():
            resolve(urlsplit(url).path)

    def test_browser_can_follow_links_and_read_responses_as_html(self):
        response = self.client.get(reverse("api-root"), HTTP_ACCEPT="text/html")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/html", response["Content-Type"])
        self.assertContains(response, "/api/v1/services/")
        self.assertContains(response, "STUDLY API")

    def test_navigation_does_not_accept_writes(self):
        response = self.client.post(reverse("api-root"), {}, format="json")
        self.assertEqual(response.status_code, 405)
