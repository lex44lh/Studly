"""Контракт из репозитория должен ссылаться на существующие маршруты и поля."""

import json

from django.conf import settings
from django.test import SimpleTestCase
from django.urls import resolve

from .registration import registration_data
from .registration_serializers import GeneralProfilePatch, PerformerProfilePatch, ProgressPatch, RegistrationPatch
from .models import User


class RegistrationContractTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.spec = json.loads((settings.BASE_DIR.parents[1] / "docs" / "registration.openapi.json").read_text())

    def test_documented_routes_methods_and_local_references_exist(self):
        self.assertEqual(self.spec["openapi"], "3.0.3")
        for path, operations in self.spec["paths"].items():
            view = resolve(path).func.view_class
            for method in operations:
                with self.subTest(path=path, method=method):
                    self.assertTrue(callable(getattr(view, method, None)))

        def check_refs(value):
            if isinstance(value, dict):
                if "$ref" in value:
                    current = self.spec
                    self.assertTrue(value["$ref"].startswith("#/"))
                    for key in value["$ref"][2:].split("/"):
                        current = current[key]
                for item in value.values():
                    check_refs(item)
            elif isinstance(value, list):
                for item in value:
                    check_refs(item)
        check_refs(self.spec)

    def test_documented_patch_fields_and_response_fields_match_server(self):
        schemas = self.spec["components"]["schemas"]
        for name, serializer in (("RegistrationPatch", RegistrationPatch), ("ProfilePatch", GeneralProfilePatch),
                                 ("PerformerPatch", PerformerProfilePatch), ("ProgressPatch", ProgressPatch)):
            with self.subTest(schema=name):
                self.assertEqual(set(schemas[name]["properties"]), set(serializer().fields))
        # Без БД: GET нового аккаунта не должен создавать связанные записи.
        data = registration_data(User(display_name="Имя", is_customer=True))
        for name, value in (("Registration", data), ("Profile", data["profile"]),
                            ("Progress", data["progress"]), ("RegistrationStatus", data["status"])):
            self.assertEqual(set(schemas[name]["properties"]), set(value))
