"""Regression coverage for the synchronous Core BroadLink transport."""

from __future__ import annotations

import socket
import threading

import pytest

from .helpers import broadlink_reply, load

transport_mod = load("transport.broadlink_bl3372")


class LegacyDevice:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.count = 0x8000
        self.devtype = 0x520F
        self.mac = bytes.fromhex("020000000009")
        self.id = 1
        self.host = ("127.0.0.1", 80)
        self.timeout = 0.1
        self.sent = []

    def encrypt(self, payload: bytes) -> bytes:
        return payload

    def decrypt(self, _payload: bytes) -> bytes:
        return b"\x05\x00reply" + bytes(9)

    def send_packet(self, packet_type: int, payload: bytes) -> bytes:
        self.count = ((self.count + 1) | 0x8000) & 0xFFFF
        self.sent.append((packet_type, payload))
        return broadlink_reply(self)

    def auth(self) -> bool:
        self.send_packet(0x65, b"auth")
        return True

    def get_fwversion(self) -> int:
        return 62016


class FakeSocket:
    def __init__(self, device: LegacyDevice, *, timeout: bool = False) -> None:
        self.device = device
        self.timeout = timeout
        self.datagrams = []

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def settimeout(self, value: float) -> None:
        assert value == self.device.timeout

    def sendto(self, packet: bytes, host: tuple[str, int]) -> None:
        self.datagrams.append((bytes(packet), host))

    def recvfrom(self, _size: int):
        if self.timeout:
            raise socket.timeout("no response")
        return broadlink_reply(self.device, bytes(16)), self.device.host


@pytest.mark.asyncio
async def test_legacy_connect_calls_sync_library_off_event_loop(monkeypatch):
    device = LegacyDevice()
    transport = transport_mod.BroadlinkBL3372Transport("127.0.0.1")
    monkeypatch.setattr(transport_mod, "IS_ASYNC_BROADLINK", False)
    monkeypatch.setattr(transport_mod.broadlink, "hello", lambda *_args, **_kwargs: device)

    assert await transport._connect() is device
    assert device.sent == [(0x65, b"auth")]
    assert transport.firmware == 62016
    assert transport.identifier == "020000000009"


@pytest.mark.asyncio
async def test_legacy_write_sends_exactly_one_udp_datagram(monkeypatch):
    device = LegacyDevice()
    transport = transport_mod.BroadlinkBL3372Transport("127.0.0.1")
    transport._device = device
    monkeypatch.setattr(transport_mod, "IS_ASYNC_BROADLINK", False)
    connection = FakeSocket(device)
    monkeypatch.setattr(transport_mod.socket, "socket", lambda *_args: connection)

    assert await transport.transact_write(b"runxin-write") == b"reply"
    assert len(connection.datagrams) == 1
    packet, host = connection.datagrams[0]
    assert host == device.host
    assert int.from_bytes(packet[0x26:0x28], "little") == 0x6A


@pytest.mark.asyncio
async def test_legacy_write_timeout_is_not_replayed(monkeypatch):
    device = LegacyDevice()
    transport = transport_mod.BroadlinkBL3372Transport("127.0.0.1")
    transport._device = device
    monkeypatch.setattr(transport_mod, "IS_ASYNC_BROADLINK", False)
    connection = FakeSocket(device, timeout=True)
    monkeypatch.setattr(transport_mod.socket, "socket", lambda *_args: connection)

    with pytest.raises(transport_mod.RunxinTransportError):
        await transport.transact_write(b"runxin-write")
    assert len(connection.datagrams) == 1
