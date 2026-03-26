"""
Adapter Registry
================
Central registry that manages domain adapter instances.
Supports plug-and-play registration of new domain adapters
and dynamic resolution at runtime.

The registry:
- Maintains a mapping of adapter_type → adapter_class
- Creates adapter instances from domain configuration
- Caches adapter instances per domain_id for reuse
- Supports hot-reloading of adapter configs
"""

from __future__ import annotations

import importlib
import logging
from threading import Lock
from typing import Any, Type

from .base_adapter import AdapterConfig, BaseDomainAdapter

logger = logging.getLogger(__name__)


class AdapterRegistry:
    """
    Singleton-style registry for domain adapters.

    Usage:
        registry = AdapterRegistry()
        registry.register("hospital", HospitalAdapter)
        registry.register("banking", BankingAdapter)

        adapter = registry.get_adapter("hospital", config)
        tools = adapter.get_tool_definitions()
    """

    def __init__(self):
        self._adapter_classes: dict[str, Type[BaseDomainAdapter]] = {}
        self._adapter_instances: dict[str, BaseDomainAdapter] = {}
        self._lock = Lock()

    def register(self, adapter_type: str, adapter_class: Type[BaseDomainAdapter]) -> None:
        """
        Register an adapter class for a given adapter type.
        This is called at startup to register all available adapters.
        """
        with self._lock:
            self._adapter_classes[adapter_type.lower()] = adapter_class
            logger.info(f"Registered adapter: {adapter_type} -> {adapter_class.__name__}")

    def unregister(self, adapter_type: str) -> None:
        """Remove an adapter type from the registry."""
        with self._lock:
            self._adapter_classes.pop(adapter_type.lower(), None)
            # Remove cached instances of this type
            to_remove = [
                k for k, v in self._adapter_instances.items()
                if v.adapter_type == adapter_type.lower()
            ]
            for key in to_remove:
                del self._adapter_instances[key]

    def get_adapter(self, domain_id: str, config: AdapterConfig) -> BaseDomainAdapter:
        """
        Get or create an adapter instance for the given domain.
        Instances are cached by domain_id for reuse within the same session.
        """
        with self._lock:
            # Return cached instance if available
            if domain_id in self._adapter_instances:
                existing = self._adapter_instances[domain_id]
                # Verify adapter type hasn't changed
                if existing.adapter_type == config.adapter_type.lower():
                    return existing
                # Type changed, remove stale instance
                del self._adapter_instances[domain_id]

            adapter_type = config.adapter_type.lower()
            adapter_class = self._adapter_classes.get(adapter_type)

            if not adapter_class:
                # Try dynamic import as fallback
                adapter_class = self._try_dynamic_import(adapter_type)

            if not adapter_class:
                # Fall back to generic adapter
                from .generic_adapter import GenericAdapter
                logger.warning(
                    f"No adapter registered for type '{adapter_type}', "
                    f"falling back to GenericAdapter for domain '{domain_id}'."
                )
                adapter_class = GenericAdapter

            instance = adapter_class(config)
            self._adapter_instances[domain_id] = instance
            logger.info(
                f"Created adapter instance: {adapter_class.__name__} "
                f"for domain '{domain_id}' (type: {adapter_type})"
            )
            return instance

    def _try_dynamic_import(self, adapter_type: str) -> Type[BaseDomainAdapter] | None:
        """
        Attempt to dynamically import an adapter module.
        Looks for: server.app.adapters.{adapter_type}_adapter.{AdapterType}Adapter
        """
        module_name = f"server.app.adapters.{adapter_type}_adapter"
        class_name = f"{adapter_type.title().replace('_', '')}Adapter"
        try:
            module = importlib.import_module(module_name)
            adapter_class = getattr(module, class_name, None)
            if adapter_class and issubclass(adapter_class, BaseDomainAdapter):
                self.register(adapter_type, adapter_class)
                return adapter_class
        except (ImportError, AttributeError) as exc:
            logger.debug(f"Dynamic import failed for adapter '{adapter_type}': {exc}")
        return None

    def invalidate(self, domain_id: str) -> None:
        """Remove cached adapter instance for a domain (e.g., after config change)."""
        with self._lock:
            self._adapter_instances.pop(domain_id, None)

    def invalidate_all(self) -> None:
        """Clear all cached adapter instances."""
        with self._lock:
            self._adapter_instances.clear()

    def list_registered_types(self) -> list[str]:
        """Return all registered adapter types."""
        return list(self._adapter_classes.keys())

    def list_active_instances(self) -> dict[str, str]:
        """Return mapping of domain_id → adapter_type for active instances."""
        return {
            domain_id: instance.adapter_type
            for domain_id, instance in self._adapter_instances.items()
        }

    def get_adapter_class(self, adapter_type: str) -> Type[BaseDomainAdapter] | None:
        """Get the registered adapter class for a type."""
        return self._adapter_classes.get(adapter_type.lower())
