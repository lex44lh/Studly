from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from django.test import TestCase, override_settings
from django.urls import reverse
from PIL import Image, PngImagePlugin
from rest_framework.test import APIClient

from .avatars import MAX_AVATAR_BYTES
from .models import User


def image_upload(fmt="PNG", size=(32, 24), **kwargs):
    output = BytesIO()
    Image.new("RGB", size, "red").save(output, format=fmt, **kwargs)
    return SimpleUploadedFile("../../original." + fmt.lower(), output.getvalue(), content_type="image/" + fmt.lower())


class AvatarTests(TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory(prefix="studly-avatar-test-")
        self.addCleanup(self.directory.cleanup)
        self.override = override_settings(MEDIA_ROOT=self.directory.name)
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.user = User.objects.create_user(73001)
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.user)
        self.token = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        self.url = reverse("registration:avatar")

    def upload(self, file, **extra):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(self.url, {"avatar": file, **extra}, format="multipart", HTTP_X_CSRFTOKEN=self.token)

    def test_supported_formats_are_decoded_to_private_png_with_server_filename(self):
        for fmt in ("PNG", "JPEG", "WEBP"):
            with self.subTest(fmt=fmt):
                response = self.upload(image_upload(fmt))
                self.assertEqual(response.status_code, 200, response.content)
                self.assertEqual(response.json()["profile"]["avatar_url"], self.url)
                self.user.refresh_from_db()
                self.assertRegex(self.user.avatar.name, r"^avatars/[0-9a-f]{32}\.png$")
                response = self.client.get(self.url)
                self.assertEqual(response["Content-Type"], "image/png")
                self.assertEqual(response["X-Content-Type-Options"], "nosniff")
                self.assertIn("no-store", response["Cache-Control"])
                with Image.open(BytesIO(b"".join(response.streaming_content))) as image:
                    self.assertEqual(image.format, "PNG")
                    self.assertEqual(image.size, (32, 24))
        self.assertEqual(len(list(Path(self.directory.name).rglob("*.png"))), 1)

    def test_large_dimensions_are_reduced_and_metadata_removed(self):
        metadata = PngImagePlugin.PngInfo()
        metadata.add_text("secret", "metadata-to-remove")
        response = self.upload(image_upload(size=(1200, 600), pnginfo=metadata))
        self.assertEqual(response.status_code, 200)
        raw = b"".join(self.client.get(self.url).streaming_content)
        with Image.open(BytesIO(raw)) as image:
            self.assertEqual(image.size, (1024, 512))
            self.assertNotIn("secret", image.info)

    def test_invalid_spoofed_oversized_animated_and_bomb_images_are_rejected(self):
        invalid = [
            SimpleUploadedFile("fake.png", b"<svg onload='alert(1)'/>", content_type="image/png"),
            SimpleUploadedFile("empty.png", b"", content_type="image/png"),
            SimpleUploadedFile("big.png", b"x" * (MAX_AVATAR_BYTES + 1), content_type="image/png"),
            image_upload("GIF"), image_upload(size=(5000, 4000)),
        ]
        frames = BytesIO()
        Image.new("RGB", (10, 10), "red").save(frames, "PNG", save_all=True,
                                               append_images=[Image.new("RGB", (10, 10), "blue")])
        invalid.append(SimpleUploadedFile("animated.png", frames.getvalue(), content_type="image/png"))
        truncated = image_upload()
        invalid.append(SimpleUploadedFile("truncated.png", truncated.read()[:40], content_type="image/png"))
        for file in invalid:
            with self.subTest(file=file.name):
                self.assertEqual(self.upload(file).status_code, 400)
        self.user.refresh_from_db()
        self.assertFalse(self.user.avatar)
        self.assertFalse(list(Path(self.directory.name).rglob("*.png")))

    def test_avatar_is_not_accessible_to_anonymous_or_other_user(self):
        self.assertEqual(self.upload(image_upload()).status_code, 200)
        self.client.logout()
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.client.force_login(User.objects.create_user(73002))
        self.assertEqual(self.client.get(self.url, {"user_id": self.user.pk}).status_code, 404)

    def test_upload_delete_require_csrf_and_cannot_set_other_fields(self):
        self.assertEqual(self.client.post(self.url, {"avatar": image_upload()}, format="multipart").status_code, 403)
        self.assertEqual(self.client.delete(self.url).status_code, 403)
        self.assertEqual(self.upload(image_upload(), user_id="73002").status_code, 400)
        self.assertEqual(self.upload([image_upload(), image_upload()]).status_code, 400)
        self.assertEqual(self.client.post(self.url, {}, format="json", HTTP_X_CSRFTOKEN=self.token).status_code, 415)

    def test_delete_is_idempotent_and_removes_stored_file(self):
        self.upload(image_upload())
        for _ in range(2):
            with self.captureOnCommitCallbacks(execute=True):
                self.assertEqual(self.client.delete(self.url, HTTP_X_CSRFTOKEN=self.token).status_code, 204)
        self.assertFalse(list(Path(self.directory.name).rglob("*.png")))
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.assertIsNone(self.client.get(reverse("registration:detail")).json()["profile"]["avatar_url"])

    def test_rejected_replacement_keeps_the_previous_avatar(self):
        self.upload(image_upload())
        before = b"".join(self.client.get(self.url).streaming_content)
        self.assertEqual(self.upload(SimpleUploadedFile("bad.png", b"bad-image")).status_code, 400)
        self.assertEqual(b"".join(self.client.get(self.url).streaming_content), before)
        self.assertEqual(len(list(Path(self.directory.name).rglob("*.png"))), 1)

    def test_failed_database_write_removes_new_file_and_keeps_existing_avatar(self):
        self.upload(image_upload())
        self.user.refresh_from_db()
        previous = self.user.avatar.name
        with patch.object(User, "save", side_effect=IntegrityError("simulated failure")):
            with self.assertRaises(IntegrityError):
                self.upload(image_upload())
        self.user.refresh_from_db()
        self.assertEqual(self.user.avatar.name, previous)
        self.assertEqual([str(p.relative_to(self.directory.name)) for p in Path(self.directory.name).rglob("*.png")], [previous])
