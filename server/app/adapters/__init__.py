# Domain Adapter Framework
# Plug-and-play integration layer for connecting IVR to domain-specific core systems.

from .base_adapter import BaseDomainAdapter, AdapterResponse, AdapterToolDefinition
from .adapter_registry import AdapterRegistry
from .integration_router import IntegrationRouter

__all__ = [
    "BaseDomainAdapter",
    "AdapterResponse",
    "AdapterToolDefinition",
    "AdapterRegistry",
    "IntegrationRouter",
]
