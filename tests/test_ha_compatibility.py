"""Focused compatibility checks for legacy Home Assistant APIs."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

pytest.importorskip("homeassistant")

from .helpers import load

ha_compat = load("ha_compat")


def test_runtime_data_uses_sidecar_for_legacy_slotted_config_entry():
    class LegacyConfigEntry:
        __slots__ = ("entry_id",)

        def __init__(self):
            self.entry_id = "legacy-entry"

    hass = SimpleNamespace(data={})
    entry = LegacyConfigEntry()
    value = object()

    ha_compat.set_entry_runtime_data(hass, entry, value)

    assert ha_compat.get_entry_runtime_data(hass, entry) is value
    assert not hasattr(entry, "runtime_data")
    ha_compat.clear_entry_runtime_data(hass, entry)
    assert ha_compat.get_entry_runtime_data(hass, entry) is None


def test_runtime_data_uses_native_slot_when_core_provides_it():
    class CurrentConfigEntry:
        __slots__ = ("entry_id", "runtime_data")

        def __init__(self):
            self.entry_id = "current-entry"

    hass = SimpleNamespace(data={})
    entry = CurrentConfigEntry()
    value = object()

    ha_compat.set_entry_runtime_data(hass, entry, value)

    assert entry.runtime_data is value
    assert ha_compat.get_entry_runtime_data(hass, entry) is value
    assert not hass.data


def test_translated_exceptions_keep_key_and_placeholders():
    error = ha_compat.ServiceValidationError(
        translation_domain="ypsilon_local",
        translation_key="service_entry_not_found",
        translation_placeholders={"entry_id": "example"},
    )

    assert isinstance(error, Exception)
    assert error.translation_domain == "ypsilon_local"
    assert error.translation_key == "service_entry_not_found"
    assert error.translation_placeholders == {"entry_id": "example"}


def test_sensor_precision_supports_both_core_field_names():
    sensor = load("sensor")
    description = next(item for item in sensor.SENSORS if item.key == "daily_water")

    assert description.native_precision == 2
    assert description.suggested_display_precision == 2


def test_integration_only_forwards_time_platform_when_core_provides_it():
    from homeassistant.const import Platform

    integration = load("__init__")
    time_platform = getattr(Platform, "TIME", None)

    assert (time_platform in integration.PLATFORMS) is (time_platform is not None)


def test_legacy_options_flow_receives_its_config_entry():
    flow_module = load("config_flow")
    entry = SimpleNamespace(options={})
    flow = flow_module.YpsilonLocalOptionsFlow(entry)

    assert flow.config_entry is entry


@pytest.mark.asyncio
async def test_diagnostic_collection_falls_back_without_progress_api():
    flow_module = load("config_flow")
    flow = flow_module.YpsilonLocalConfigFlow()
    flow.hass = SimpleNamespace(
        async_create_task=lambda coroutine: asyncio.create_task(coroutine)
    )
    flow.context = {}
    flow.flow_id = "compatibility-test"
    flow._diagnostic_host = "192.0.2.10"
    flow._async_current_entries = Mock(return_value=[])
    flow._async_in_progress = Mock(return_value=[])
    flow._async_collect_report = AsyncMock()
    ready = {"type": "form", "step_id": "diagnostic_ready"}
    flow.async_step_diagnostic_ready = AsyncMock(return_value=ready)

    if hasattr(flow, "async_show_progress"):
        pytest.skip("This Home Assistant release supports progress screens")

    result = await flow.async_step_diagnostic_scan()

    assert result == ready
    flow._async_collect_report.assert_awaited_once()
    flow.async_step_diagnostic_ready.assert_awaited_once()


@pytest.mark.asyncio
async def test_admin_service_fallback_rejects_non_admin_users(monkeypatch):
    registered = {}
    services = SimpleNamespace(
        async_register=lambda domain, service, handler, *, schema: registered.update(
            domain=domain, service=service, handler=handler, schema=schema
        )
    )
    hass = SimpleNamespace(
        services=services,
        auth=SimpleNamespace(
            async_get_user=AsyncMock(return_value=SimpleNamespace(is_admin=False))
        ),
    )
    action = AsyncMock()
    monkeypatch.setattr(ha_compat, "_async_register_admin_service", None)
    ha_compat.async_register_admin_service(
        hass, "ypsilon_local", "test_service", action, schema={}
    )

    call = SimpleNamespace(context=SimpleNamespace(user_id="non-admin"))
    with pytest.raises(ha_compat.HomeAssistantError):
        await registered["handler"](call)
    action.assert_not_awaited()
