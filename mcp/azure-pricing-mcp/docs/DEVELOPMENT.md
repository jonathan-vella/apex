# Azure Pricing MCP - Development Guide

## Getting Started

### Prerequisites

- Python 3.10 or higher
- pip (Python package manager)
- Git

### Clone and Setup

```bash
# Clone the repository
git clone https://github.com/msftnadavbh/AzurePricingMCP.git
cd AzurePricingMCP

# Quick setup
python scripts/install.py

# Or manual setup
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e .[dev]
```

## Project Structure

```text
AzurePricingMCP/
├── src/azure_pricing_mcp/   # Source code
│   ├── server.py            # Main server implementation
│   ├── handlers.py          # Tool call handlers
│   ├── __init__.py          # Package initialization
│   └── __main__.py          # Entry point
├── tests/                   # Test files
├── scripts/                 # Utility scripts
├── docs/                    # Documentation
└── pyproject.toml          # Package configuration
```

See [docs/PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for detailed information.

## Development Workflow

### 1. Make Changes

Edit files in `src/azure_pricing_mcp/`:

- `server.py` - Add new API methods or modify server logic
- `handlers.py` - Add new tool handlers or modify existing ones

### 2. Code Quality

#### Format Code

```bash
# Format with black (line length: 120)
black src/ tests/

# Check formatting
black --check src/ tests/
```

#### Lint Code

```bash
# Run ruff linter
ruff check src/ tests/

# Auto-fix issues
ruff check --fix src/ tests/
```

#### Type Checking

```bash
# Run mypy
mypy src/
```

### 3. Testing

```bash
# Run all tests
pytest tests/

# Run specific test file
pytest tests/test_mcp_server.py

# Run with coverage
pytest --cov=azure_pricing_mcp tests/

# Run with verbose output
pytest -v tests/
```

### 4. Run the Server

```bash
# Method 1: Module execution
python -m azure_pricing_mcp

# Method 2: Console script (after pip install)
azure-pricing-mcp

# Method 3: Run script
python scripts/run_server.py
```

### 5. Test with MCP Client

Configure VS Code or Claude Desktop to use your development server:

```json
{
  "servers": {
    "azure-pricing-dev": {
      "type": "stdio",
      "command": "/absolute/path/to/AzurePricingMCP/.venv/bin/python",
      "args": ["-m", "azure_pricing_mcp"]
    }
  }
}
```

## Adding New Features

### Adding a New Tool

1. **Add the tool method to `server.py`**:

    ```python
    class AzurePricingServer:
        async def my_new_feature(self, param1: str, param2: Optional[int] = None) -> Dict[str, Any]:
            """
            Description of what this does.
            
            Args:
                param1: Description
                param2: Description
                
            Returns:
                Dictionary with results
            """
            # Implementation
            return {"result": "data"}
    ```

2. **Register the tool in `server.py` `create_server()`**:

    ```python
    @server.list_tools()
    async def handle_list_tools() -> List[Tool]:
        return [
            # ... existing tools ...
            Tool(
                name="my_new_feature",
                description="Description for AI assistant",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "param1": {
                            "type": "string",
                            "description": "Parameter description"
                        },
                        "param2": {
                            "type": "integer",
                            "description": "Optional parameter"
                        }
                    },
                    "required": ["param1"]
                }
            )
        ]
    ```

3. **Add handler in `handlers.py`**:

    ```python
    async def _handle_my_new_feature(pricing_server, arguments: dict) -> List[TextContent]:
        """Handle my_new_feature tool calls."""
        result = await pricing_server.my_new_feature(**arguments)
        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    # Register in handle_call_tool
    async def handle_call_tool(name: str, arguments: dict) -> list:
        if name == "my_new_feature":
            return await _handle_my_new_feature(pricing_server, arguments)
    ```

4. **Write tests in `tests/`**:

    ```python
    import pytest
    from azure_pricing_mcp import AzurePricingServer

    @pytest.mark.asyncio
    async def test_my_new_feature():
        async with AzurePricingServer() as server:
            result = await server.my_new_feature("test_value")
            assert "result" in result
    ```

5. **Update documentation** in README.md

## Code Style Guidelines

### Python Style

- Follow PEP 8
- Use type hints for all function parameters and return values
- Maximum line length: 120 characters
- Use descriptive variable names
- Add docstrings to all public functions/classes

### Example

```python
from typing import Dict, Optional, List

async def search_pricing(
    service_name: str,
    region: Optional[str] = None,
    limit: int = 50
) -> Dict[str, Any]:
    """
    Search Azure pricing with filters.
    
    Args:
        service_name: The Azure service to search for
        region: Optional region filter
        limit: Maximum number of results to return
        
    Returns:
        Dictionary containing search results and metadata
        
    Raises:
        ValueError: If service_name is empty
        RuntimeError: If API request fails
    """
    if not service_name:
        raise ValueError("service_name cannot be empty")
        
    # Implementation
    return {"items": [], "count": 0}
```

## Debugging

### Enable Debug Logging

```python
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
```

### Debug with VS Code

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug MCP Server",
      "type": "python",
      "request": "launch",
      "module": "azure_pricing_mcp",
      "console": "integratedTerminal"
    }
  ]
}
```

### Test API Calls Directly

Use the debug scripts in `scripts/`:

```bash
python scripts/debug_handler_return.py
python scripts/find_app_service.py
```

## Building and Distribution

### Build Package

```bash
# Build source distribution and wheel
python -m build

# Outputs to dist/
# - azure-pricing-mcp-2.1.0.tar.gz
# - azure_pricing_mcp-2.1.0-py3-none-any.whl
```

### Install from Built Package

```bash
pip install dist/azure_pricing_mcp-2.1.0-py3-none-any.whl
```

### Publish to PyPI (Maintainers Only)

```bash
# Install twine
pip install twine

# Upload to PyPI
python -m twine upload dist/*
```

## Common Tasks

### Update Dependencies

```bash
# Add new dependency to requirements.txt
echo "new-package>=1.0.0" >> requirements.txt

# Reinstall
pip install -e .[dev]

# Update pyproject.toml dependencies section
```

### Version Bump

Update version in:
1. `pyproject.toml` - `[project]` section
2. `setup.py` - `version` parameter
3. `src/azure_pricing_mcp/__init__.py` - `__version__`

### Run Pre-commit Checks

```bash
# Format, lint, type check, and test
black src/ tests/
ruff check --fix src/ tests/
mypy src/
pytest tests/
```

## Resources

- [MCP Documentation](https://modelcontextprotocol.io/)
- [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices)
- [Python Packaging Guide](https://packaging.python.org/)
- [Project Structure Guide](docs/PROJECT_STRUCTURE.md)

## Getting Help

- Check existing documentation in `docs/`
- Review code comments and docstrings
- Open an issue on GitHub
- Review closed issues for similar problems

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the guidelines above
4. Run tests and quality checks
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### PR Checklist

- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] Type hints added
- [ ] Docstrings added/updated
- [ ] CHANGELOG.md updated (if applicable)
