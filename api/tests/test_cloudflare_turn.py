import api.routes.webrtc_signaling as webrtc_signaling
from api.services.turn.cloudflare import (
    _ice_servers_to_credentials,
    clear_cloudflare_turn_cache,
    fetch_cloudflare_turn_credentials,
)


def _cf_payload():
    return {
        "iceServers": [
            {"urls": ["stun:stun.cloudflare.com:3478"]},
            {
                "urls": [
                    "turn:turn.cloudflare.com:3478?transport=udp",
                    "turns:turn.cloudflare.com:443?transport=tcp",
                ],
                "username": "cf-user",
                "credential": "cf-pass",
            },
        ]
    }


def test_ice_servers_to_credentials_drops_stun_and_keeps_turn():
    creds = _ice_servers_to_credentials(_cf_payload(), ttl=3600)
    assert creds["username"] == "cf-user"
    assert creds["password"] == "cf-pass"
    assert creds["ttl"] == 3600
    assert creds["uris"] == [
        "turn:turn.cloudflare.com:3478?transport=udp",
        "turns:turn.cloudflare.com:443?transport=tcp",
    ]


def test_ice_servers_to_credentials_rejects_stun_only_payload():
    try:
        _ice_servers_to_credentials(
            {"iceServers": [{"urls": ["stun:stun.cloudflare.com:3478"]}]},
            ttl=3600,
        )
    except ValueError as exc:
        assert "credentialed" in str(exc)
    else:
        raise AssertionError("expected ValueError")


def test_fetch_cloudflare_turn_credentials_caches_http_result(monkeypatch):
    clear_cloudflare_turn_cache()
    monkeypatch.setattr(
        "api.services.turn.cloudflare.CLOUDFLARE_TURN_KEY_ID", "key123"
    )
    monkeypatch.setattr(
        "api.services.turn.cloudflare.CLOUDFLARE_TURN_API_TOKEN", "token123"
    )

    calls = {"n": 0}

    class _Response:
        def raise_for_status(self):
            return None

        def json(self):
            return _cf_payload()

    class _Client:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, url, json, headers):
            calls["n"] += 1
            assert "key123" in url
            assert json["ttl"] == 86400
            assert json["customIdentifier"] == "user-1"
            assert headers["Authorization"] == "Bearer token123"
            return _Response()

    monkeypatch.setattr("api.services.turn.cloudflare.httpx.Client", _Client)

    first = fetch_cloudflare_turn_credentials("user-1", ttl=86400)
    second = fetch_cloudflare_turn_credentials("user-1", ttl=86400)
    assert first["username"] == "cf-user"
    assert second["uris"] == first["uris"]
    assert calls["n"] == 1
    clear_cloudflare_turn_cache()


def test_generate_turn_credentials_prefers_cloudflare(monkeypatch):
    monkeypatch.setattr(
        "api.routes.turn_credentials.cloudflare_turn_configured", lambda: True
    )
    monkeypatch.setattr(
        "api.routes.turn_credentials.fetch_cloudflare_turn_credentials",
        lambda user_id, ttl=86400: {
            "username": "cf-user",
            "password": "cf-pass",
            "ttl": ttl,
            "uris": ["turns:turn.cloudflare.com:443?transport=tcp"],
        },
    )
    from api.routes.turn_credentials import generate_turn_credentials

    creds = generate_turn_credentials("42")
    assert creds["uris"] == ["turns:turn.cloudflare.com:443?transport=tcp"]
    assert creds["username"] == "cf-user"


def test_get_ice_servers_uses_cloudflare_and_omits_stun_in_relay_mode(monkeypatch):
    monkeypatch.setattr(webrtc_signaling, "FORCE_TURN_RELAY", True)
    monkeypatch.setattr(webrtc_signaling, "ENABLE_COTURN", True)
    monkeypatch.setattr(webrtc_signaling, "TURN_HOST", "")
    monkeypatch.setattr(webrtc_signaling, "TURN_SECRET", None)
    monkeypatch.setattr(webrtc_signaling, "cloudflare_turn_configured", lambda: True)
    monkeypatch.setattr(
        webrtc_signaling,
        "generate_turn_credentials",
        lambda user_id: {
            "uris": ["turns:turn.cloudflare.com:443?transport=tcp"],
            "username": "cf-user",
            "password": "cf-pass",
            "ttl": 86400,
        },
    )

    servers = webrtc_signaling.get_ice_servers(user_id="1")
    urls = []
    for server in servers:
        urls.extend(server.urls if isinstance(server.urls, list) else [server.urls])
    assert urls == ["turns:turn.cloudflare.com:443?transport=tcp"]
    assert servers[0].username == "cf-user"


def test_turn_credentials_available_accepts_cloudflare(monkeypatch):
    monkeypatch.setattr("api.services.turn.ENABLE_COTURN", True)
    monkeypatch.setattr("api.services.turn.TURN_SECRET", None)
    monkeypatch.setattr("api.services.turn.CLOUDFLARE_TURN_KEY_ID", "key")
    monkeypatch.setattr("api.services.turn.CLOUDFLARE_TURN_API_TOKEN", "token")
    from api.services.turn import turn_credentials_available

    assert turn_credentials_available() is True


def test_turn_credentials_available_false_without_provider(monkeypatch):
    monkeypatch.setattr("api.services.turn.ENABLE_COTURN", True)
    monkeypatch.setattr("api.services.turn.TURN_SECRET", None)
    monkeypatch.setattr("api.services.turn.CLOUDFLARE_TURN_KEY_ID", None)
    monkeypatch.setattr("api.services.turn.CLOUDFLARE_TURN_API_TOKEN", None)
    from api.services.turn import turn_credentials_available

    assert turn_credentials_available() is False
