from app.core.config import ENV_FILE, get_settings
from app.services.task_serializers import with_current_attachment_urls

DOWNLOAD = "/api/v1/tasks/1f6e/attachments/9c2a/download"


def test_settings_read_backend_env_file_from_any_folder():
    assert ENV_FILE.name == ".env"
    assert ENV_FILE.parent.name == "backend"


def test_inline_images_follow_public_base_url(monkeypatch):
    monkeypatch.setattr(get_settings(), "public_base_url", "https://tasks.example.com/")
    content = {
        "type": "doc",
        "content": [
            {"type": "image", "attrs": {"src": f"http://localhost:8000{DOWNLOAD}", "alt": "old host"}},
            {"type": "paragraph", "content": [{"type": "image", "attrs": {"src": DOWNLOAD}}]},
            {"type": "image", "attrs": {"src": "https://cdn.example.org/photo.png"}},
        ],
    }

    result = with_current_attachment_urls(content)

    assert result["content"][0]["attrs"] == {"src": f"https://tasks.example.com{DOWNLOAD}", "alt": "old host"}
    assert result["content"][1]["content"][0]["attrs"]["src"] == f"https://tasks.example.com{DOWNLOAD}"
    # Images from elsewhere are left alone, and stored content is not changed.
    assert result["content"][2]["attrs"]["src"] == "https://cdn.example.org/photo.png"
    assert content["content"][0]["attrs"]["src"] == f"http://localhost:8000{DOWNLOAD}"
    assert with_current_attachment_urls(None) is None
