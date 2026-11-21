"""Compatibility helpers for Home Assistant releases supported by this integration."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from homeassistant.exceptions import HomeAssistantError as _HomeAssistantError

try:
    from homeassistant.exceptions import ServiceValidationError as _ServiceValidationError
except ImportError:  # Home Assistant < 2024.8
    _ServiceValidationError = _HomeAssistantError

try:
    from homeassistant.helpers.service import (
        async_register_admin_service as _async_register_admin_service,
    )
except ImportError:
    _async_register_admin_service = None

from .const import DOMAIN

_RUNTIME_DATA_KEY = f"{DOMAIN}_runtime_data"


def entity_description_dataclass(cls=None, *, kw_only: bool = True):
    """Match the mutability of the HA entity-description base across releases."""
    def decorate(description_cls):
        base_params = getattr(description_cls.__bases__[0], "__dataclass_params__", None)
        return dataclass(
            description_cls,
            frozen=bool(base_params and base_params.frozen),
            kw_only=kw_only,
        )

    return decorate(cls) if cls is not None else decorate


def _legacy_error_message(
    translation_key: str | None,
    placeholders: dict[str, str] | None,
) -> str:
    message = (translation_key or "home_assistant_error").replace("_", " ")
    if placeholders:
        details = ", ".join(f"{key}: {value}" for key, value in placeholders.items())
        message = f"{message} ({details})"
    return message


class _TranslatedErrorMixin:
    """Keep translated error metadata when older HA lacks translated exceptions."""

    def _init_translated(
        self,
        *args: Any,
        translation_domain: str | None = None,
        translation_key: str | None = None,
        translation_placeholders: dict[str, str] | None = None,
    ) -> None:
        try:
            super().__init__(
                *args,
                translation_domain=translation_domain,
                translation_key=translation_key,
                translation_placeholders=translation_placeholders,
            )
        except TypeError:
            self.translation_domain = translation_domain
            self.translation_key = translation_key
            self.translation_placeholders = translation_placeholders
            fallback_args = args or (
                _legacy_error_message(translation_key, translation_placeholders),
            )
            super().__init__(*fallback_args)


class HomeAssistantError(_TranslatedErrorMixin, _HomeAssistantError):
    """Home Assistant error that accepts translations on old and new Core releases."""

    def __init__(
        self,
        *args: Any,
        translation_domain: str | None = None,
        translation_key: str | None = None,
        translation_placeholders: dict[str, str] | None = None,
    ) -> None:
        self._init_translated(
            *args,
            translation_domain=translation_domain,
            translation_key=translation_key,
            translation_placeholders=translation_placeholders,
        )


class ServiceValidationError(_TranslatedErrorMixin, _ServiceValidationError):
    """Validation error retaining translated behavior where Core provides it."""

    def __init__(
        self,
        *args: Any,
        translation_domain: str | None = None,
        translation_key: str | None = None,
        translation_placeholders: dict[str, str] | None = None,
    ) -> None:
        self._init_translated(
            *args,
            translation_domain=translation_domain,
            translation_key=translation_key,
            translation_placeholders=translation_placeholders,
        )


def async_register_admin_service(
    hass: Any,
    domain: str,
    service: str,
    service_func: Any,
    *,
    schema: Any = None,
) -> None:
    """Register admin-only services on both legacy and current Core."""
    if _async_register_admin_service is not None:
        _async_register_admin_service(
            hass, domain, service, service_func, schema=schema
        )
        return

    async def require_admin(call: Any) -> None:
        user_id = call.context.user_id
        if user_id is not None:
            user = await hass.auth.async_get_user(user_id)
            if user is None or not user.is_admin:
                raise HomeAssistantError("Administrator privileges are required")
        await service_func(call)

    hass.services.async_register(domain, service, require_admin, schema=schema)


def _supports_entry_attribute(entry: Any, name: str) -> bool:
    """Check whether an entry can store an attribute without mutating its class."""
    if hasattr(entry, name):
        return True

    has_slots = False
    for cls in type(entry).__mro__:
        if "__slots__" not in cls.__dict__:
            continue
        has_slots = True
        slots = cls.__dict__["__slots__"]
        if isinstance(slots, str):
            slots = (slots,)
        if name in slots or "__dict__" in slots:
            return True
    return not has_slots


def get_entry_runtime_data(hass: Any, entry: Any) -> Any:
    """Read config-entry runtime data, including on pre-runtime_data HA releases."""
    if hasattr(entry, "runtime_data"):
        return entry.runtime_data
    if hass is None:
        return None
    return hass.data.get(_RUNTIME_DATA_KEY, {}).get(entry.entry_id)


def set_entry_runtime_data(hass: Any, entry: Any, value: Any) -> None:
    """Store runtime data natively or in a Home Assistant-owned sidecar."""
    if _supports_entry_attribute(entry, "runtime_data"):
        entry.runtime_data = value
        return
    hass.data.setdefault(_RUNTIME_DATA_KEY, {})[entry.entry_id] = value


def clear_entry_runtime_data(hass: Any, entry: Any) -> None:
    """Discard compatibility-side runtime state when a config entry is removed."""
    if _supports_entry_attribute(entry, "runtime_data"):
        return
    runtime_data = hass.data.get(_RUNTIME_DATA_KEY)
    if runtime_data is not None:
        runtime_data.pop(entry.entry_id, None)
        if not runtime_data:
            hass.data.pop(_RUNTIME_DATA_KEY, None)
