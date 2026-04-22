"""Azure authentication module for Spot VM tools.

This module provides Azure AD authentication for tools that require it,
such as Spot VM eviction rates and price history queries.

Authentication is optional - existing pricing tools work without authentication.
Spot tools will return a friendly message prompting users to authenticate.
"""

import logging
from typing import TYPE_CHECKING

from .config import AZURE_MANAGEMENT_SCOPE, SPOT_PERMISSIONS

if TYPE_CHECKING:
    from azure.core.credentials import AccessToken

logger = logging.getLogger(__name__)

# Flag to track if azure-identity is available
_AZURE_IDENTITY_AVAILABLE: bool | None = None


def _check_azure_identity_available() -> bool:
    """Check if azure-identity package is installed."""
    global _AZURE_IDENTITY_AVAILABLE
    if _AZURE_IDENTITY_AVAILABLE is None:
        try:
            import azure.identity  # noqa: F401

            _AZURE_IDENTITY_AVAILABLE = True
        except ImportError:
            _AZURE_IDENTITY_AVAILABLE = False
    return _AZURE_IDENTITY_AVAILABLE


class AzureCredentialManager:
    """Manages Azure AD credentials for authenticated API calls.

    Uses DefaultAzureCredential with non-interactive methods only:
    - Environment variables (AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET)
    - Managed Identity (when running in Azure)
    - Azure CLI (az login)
    - Azure PowerShell

    Interactive browser authentication is disabled for MCP server context.
    """

    def __init__(self) -> None:
        """Initialize the credential manager."""
        self._credential = None
        self._cached_token: AccessToken | None = None
        self._initialization_error: str | None = None

        if not _check_azure_identity_available():
            self._initialization_error = (
                "azure-identity package not installed. " "Install with: pip install azure-pricing-mcp[spot]"
            )
            return

        try:
            from azure.identity import DefaultAzureCredential

            # Use non-interactive credentials only
            self._credential = DefaultAzureCredential(
                exclude_interactive_browser_credential=True,
                exclude_developer_cli_credential=False,  # Allow az login
                exclude_powershell_credential=False,  # Allow PowerShell
                exclude_visual_studio_code_credential=True,  # Skip VS Code
                exclude_shared_token_cache_credential=True,  # Skip shared cache
            )
            logger.debug("Azure credential manager initialized successfully")
        except Exception as e:
            self._initialization_error = f"Failed to initialize Azure credentials: {e}"
            logger.warning(self._initialization_error)

    def is_authenticated(self) -> bool:
        """Check if valid Azure credentials are available.

        Attempts to acquire a token silently to verify authentication.

        Returns:
            True if credentials are available and valid, False otherwise.
        """
        if self._initialization_error or self._credential is None:
            return False

        try:
            # Try to get a token to verify credentials work
            token = self._credential.get_token(AZURE_MANAGEMENT_SCOPE)
            self._cached_token = token
            return True
        except Exception as e:
            logger.debug(f"Authentication check failed: {e}")
            return False

    def get_token(self) -> str | None:
        """Get an access token for Azure Management API.

        Returns:
            Access token string if authenticated, None otherwise.
        """
        if self._initialization_error or self._credential is None:
            return None

        try:
            token = self._credential.get_token(AZURE_MANAGEMENT_SCOPE)
            self._cached_token = token
            return str(token.token)
        except Exception as e:
            logger.warning(f"Failed to acquire token: {e}")
            return None

    def get_initialization_error(self) -> str | None:
        """Get any initialization error message.

        Returns:
            Error message if initialization failed, None otherwise.
        """
        return self._initialization_error

    @staticmethod
    def get_required_permissions_message(tool_name: str | None = None) -> str:
        """Get a human-readable message about required permissions.

        Args:
            tool_name: Optional specific tool name (eviction_rates, price_history,
                      simulate_eviction). If None, returns all permissions.

        Returns:
            Formatted string describing required permissions and roles.
        """
        if tool_name and tool_name in SPOT_PERMISSIONS:
            perm = SPOT_PERMISSIONS[tool_name]
            return (
                f"Required permission: {perm['permission']}\n"
                f"Built-in role: {perm['built_in_role']}\n"
                f"Purpose: {perm['description']}"
            )

        # Return all permissions
        lines = ["Required Azure permissions for Spot VM tools:\n"]
        for name, perm in SPOT_PERMISSIONS.items():
            lines.append(f"• {name}:")
            lines.append(f"  - Permission: {perm['permission']}")
            lines.append(f"  - Built-in role: {perm['built_in_role']}")
            lines.append(f"  - Purpose: {perm['description']}")
        return "\n".join(lines)

    @staticmethod
    def get_authentication_help_message() -> str:
        """Get a helpful message for users who need to authenticate.

        Returns:
            Formatted string with authentication instructions.
        """
        return """🔐 Azure Authentication Required

To use Spot VM tools, you need to authenticate with Azure. Choose one method:

**Option 1: Azure CLI (Recommended for development)**
```bash
az login
```

**Option 2: Environment Variables (Recommended for production/CI)**
```bash
export AZURE_TENANT_ID="your-tenant-id"
export AZURE_CLIENT_ID="your-client-id"
export AZURE_CLIENT_SECRET="your-client-secret"
```

**Option 3: Managed Identity (When running in Azure)**
No configuration needed - uses the VM/App Service identity automatically.

**Required Permissions:**
- Spot eviction rates & price history: "Reader" role
- Simulate eviction: "Virtual Machine Contributor" role

For least-privilege access, create a custom role with only:
- Microsoft.ResourceGraph/resources/read
- Microsoft.Compute/virtualMachines/simulateEviction/action (if needed)
"""


# Singleton instance for lazy initialization
_credential_manager: AzureCredentialManager | None = None


def get_credential_manager() -> AzureCredentialManager:
    """Get or create the singleton credential manager instance.

    Returns:
        The AzureCredentialManager singleton instance.
    """
    global _credential_manager
    if _credential_manager is None:
        _credential_manager = AzureCredentialManager()
    return _credential_manager
