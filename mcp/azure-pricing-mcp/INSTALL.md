# Installation Guide

This guide will help you install and configure the Azure Pricing MCP Server.

## Quick Install (Recommended)

### Option 1: Docker 🐳 (Easiest - No Python Setup Required)

```bash
# Build the Docker image
docker build -t azure-pricing-mcp .

docker run -i azure-pricing-mcp
```

### Option 2: Python Virtual Environment

**Windows (PowerShell):**
```powershell
# Run from the project root directory
.\scripts\setup.ps1
```

**Linux/Mac/Cross-Platform:**
```bash
# Run from the project root directory
python scripts/install.py
```

## Manual Installation

### Step 1: Create Virtual Environment
```bash
python -m venv .venv
```

### Step 2: Activate Virtual Environment

**Windows:**
```powershell
.venv\Scripts\activate
```

**Linux/Mac:**
```bash
source .venv/bin/activate
```

### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

## Verify Installation

Test that the server starts correctly:
```bash
python -m azure_pricing_mcp
```

Press `Ctrl+C` to stop the server. If it starts without errors, the installation was successful!

## Configuration

### VS Code

**Option A: With Docker (stdio)** 🐳

1. Create `.vscode/mcp.json`:
    ```json
    {
      "servers": {
        "azure-pricing": {
          "type": "stdio",
          "command": "docker",
          "args": ["run", "-i", "--rm", "azure-pricing-mcp:latest"]
        }
      }
    }
    ```

2. Make sure Docker is running
3. Restart VS Code or reload the MCP server

**Option B: With Docker (SSE - Server-Sent Events)** 🐳

1. Build and run the Docker container with port mapping:
    ```powershell
    # Build the image
    docker build -t azure-pricing-mcp .

    # Run with port mapping
    docker run -d -p 8080:8080 --name azure-pricing azure-pricing-mcp

    # Verify it's running with correct port mapping
    docker ps
    # Should show: 0.0.0.0:8080->8080/tcp
    ```

2. Create `.vscode/mcp.json` or add to VS Code User settings:
    ```json
    {
      "servers": {
        "azure-pricing": {
          "type": "sse",
          "url": "http://localhost:8080/sse"
        }
      }
    }
    ```

3. Restart VS Code or reload the MCP server

**Option C: With Python Virtual Environment**

1. Copy `.vscode/mcp.json.example` to `.vscode/mcp.json`
2. Edit the file and update the Python path to your actual virtual environment path
3. Restart VS Code or reload the MCP server

**Find your Python path:**

**Windows:**
```powershell
# In PowerShell, from project root
(Resolve-Path .venv\Scripts\python.exe).Path
```

**Linux/Mac:**
```bash
# From project root
readlink -f .venv/bin/python
```

### Claude Desktop

1. Open your Claude Desktop config file:
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
   - **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux:** `~/.config/Claude/claude_desktop_config.json`

2. Add configuration:

    **Option A: With Docker** 🐳
    ```json
    {
      "mcpServers": {
        "azure-pricing": {
          "command": "docker",
          "args": ["run", "-i", "--rm", "azure-pricing-mcp:latest"]
        }
      }
    }
    ```

    **Option B: With Python**
    ```json
    {
      "mcpServers": {
        "azure-pricing": {
          "command": "python",
          "args": ["-m", "azure_pricing_mcp"],
          "cwd": "/absolute/path/to/AzurePricingMCP"
        }
      }
    }
    ```

3. Replace `/absolute/path/to/AzurePricingMCP` with the actual path (Python option only)
4. Restart Claude Desktop

## Troubleshooting

### "No module named 'mcp'"

Make sure you activated the virtual environment and installed dependencies:
```bash
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### Tools not appearing in VS Code

1. Check that the Python path in `.vscode/mcp.json` is absolute and correct
2. Open Command Palette (`Ctrl+Shift+P`) → **MCP: List Servers** → Restart
3. Check for Python syntax errors: `python -c "import azure_pricing_mcp"`

### Server crashes on startup

Check the Python version (requires 3.10+):
```bash
python --version
```

## Next Steps

- See [README.md](README.md) for full documentation
- See [QUICK_START.md](QUICK_START.md) for usage guide
- See [USAGE_EXAMPLES.md](USAGE_EXAMPLES.md) for example queries
- Run tests: `pytest tests/`
