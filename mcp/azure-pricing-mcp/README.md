# Azure Pricing MCP Server 💰

> **[Version](../../VERSION.md)**

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![MCP](https://img.shields.io/badge/MCP-1.0+-green.svg)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A **Model Context Protocol (MCP)** server that provides AI assistants with real-time access
to Azure retail pricing information. Query VM prices, compare costs across regions, estimate
monthly bills, and discover available SKUs—all through natural language.

> **📍 Location in Repository**: `mcp/azure-pricing-mcp/`
>
> This MCP server is integrated with the GitHub Copilot agent workflow in this repository.
> See [Integration with Agent Workflow](#-integration-with-agent-workflow) below.

<!-- markdownlint-disable MD013 -->
<p align="center">
  <img src="https://img.shields.io/badge/Azure-Pricing-0078D4?style=for-the-badge&logo=microsoft-azure&logoColor=white" alt="Azure Pricing"/>
  <img src="https://img.shields.io/badge/VS_Code-MCP-007ACC?style=for-the-badge&logo=visual-studio-code&logoColor=white" alt="VS Code MCP"/>
</p>
<!-- markdownlint-enable MD013 -->

---

## 🚀 Quick Start

```bash
# From repository root
cd mcp/azure-pricing-mcp

# Set up virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Test the server
cd src && python -m azure_pricing_mcp
```

The MCP server is pre-configured in `.vscode/mcp.json` for this workspace.

---

## 🔗 Integration with Agent Workflow

This MCP server integrates with the custom agents in this repository to provide
**real-time Azure pricing** during infrastructure planning:

| Agent        | Integration                            |
| ------------ | -------------------------------------- |
| `architect`  | Cost estimation during WAF assessments |
| `bicep-plan` | SKU pricing for implementation plans   |

### How It Works

1. **Agents access pricing tools** via the `azure-pricing/*` tool namespace
2. **Real-time queries** to Azure Retail Prices API (no authentication required)
3. **List prices** returned are Azure retail pay-as-you-go rates
4. **Region recommendations** find cheapest Azure regions for any SKU

### Configured Tools

The following tools are available to agents:

| Tool                     | Description                                              | Primary Agent               |
| ------------------------ | -------------------------------------------------------- | --------------------------- |
| `azure_price_search`     | Search prices with filters                               | `@architect`, `@bicep-plan` |
| `azure_price_compare`    | Compare across regions/SKUs                              | `@architect`                |
| `azure_cost_estimate`    | Monthly/yearly cost calculations                         | `@architect`, `@bicep-plan` |
| `azure_region_recommend` | Find cheapest regions                                    | `@architect`                |
| `azure_discover_skus`    | List available SKUs                                      | `@bicep-plan`               |
| `azure_sku_discovery`    | Fuzzy name matching for services                         | `@bicep-plan`               |
| `azure_ri_pricing`       | Reserved Instance pricing (**NEW v3.1.0**)               | `@architect`, `@bicep-plan` |
| `spot_eviction_rates`    | Spot VM eviction rate queries (**NEW v3.1.0**)           | `@architect`                |
| `spot_price_history`     | Up to 90 days Spot pricing history (**NEW v3.1.0**)      | `@architect`                |
| `simulate_eviction`      | Trigger eviction simulation on Spot VMs (**NEW v3.1.0**) | `@diagnose`                 |

---

## ✨ Features

| Feature                       | Description                                                         |
| ----------------------------- | ------------------------------------------------------------------- |
| 🔍 **Price Search**           | Search Azure prices with filters (service, region, SKU, price type) |
| ⚖️ **Price Comparison**       | Compare costs across regions or between different SKUs              |
| 💡 **Cost Estimation**        | Calculate monthly/yearly costs based on usage hours                 |
| 💰 **Savings Plans**          | View 1-year and 3-year savings plan pricing                         |
| 🎯 **Smart SKU Discovery**    | Fuzzy matching for service names ("vm" → "Virtual Machines")        |
| 🌍 **Region Recommendations** | Find the cheapest Azure regions for any SKU with savings analysis   |
| 💱 **Multi-Currency**         | Support for USD, EUR, GBP, and more                                 |
| 📊 **Real-time Data**         | Live data from Azure Retail Prices API                              |
| 🐳 **Docker Support**         | Run in containers for easy deployment and isolation                 |

### Pricing Data Accuracy

> **📊 Data Source**: All prices come from the [Azure Retail Prices API][pricing-api],
> Microsoft's official public pricing endpoint (no authentication required).
>
> **What's included**: Retail list prices (pay-as-you-go), Savings Plan pricing
> (1-year and 3-year), and Spot pricing where available.
>
> **What's NOT included**: Enterprise Agreement (EA) discounts, CSP partner pricing,
> Reserved Instance pricing (separate price type), negotiated contract rates, or
> Azure Hybrid Benefit savings.
>
> **For official quotes**: Always verify with the [Azure Pricing Calculator][calc]
> or your Microsoft account team.

[pricing-api]: https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices
[calc]: https://azure.microsoft.com/pricing/calculator/

---

## 🛠️ Available Tools

| Tool                     | Description                                              |
| ------------------------ | -------------------------------------------------------- |
| `azure_price_search`     | Search Azure retail prices with flexible filtering       |
| `azure_price_compare`    | Compare prices across regions or SKUs                    |
| `azure_cost_estimate`    | Estimate costs based on usage patterns                   |
| `azure_region_recommend` | Find cheapest regions for a SKU with savings percentages |
| `azure_discover_skus`    | List available SKUs for a specific service               |
| `azure_sku_discovery`    | Intelligent SKU discovery with fuzzy name matching       |
| `azure_ri_pricing`       | Reserved Instance pricing (1-year, 3-year) (**NEW**)     |
| `spot_eviction_rates`    | Query Spot VM eviction rates by region (**NEW**)         |
| `spot_price_history`     | Up to 90 days of Spot VM pricing history (**NEW**)       |
| `simulate_eviction`      | Trigger eviction simulation on Spot VMs (**NEW**)        |

### ⚠️ Important: Service and SKU Names

The Azure Retail Prices API requires **exact service names**. Use these mappings:

| Common Name      | Correct `service_name` | Notes                                      |
| ---------------- | ---------------------- | ------------------------------------------ |
| SQL Database     | `SQL Database`         | Not "Azure SQL"                            |
| App Service      | `Azure App Service`    | Include "Azure" prefix                     |
| Container Apps   | `Azure Container Apps` | Include "Azure" prefix                     |
| Service Bus      | `Service Bus`          | No prefix                                  |
| Key Vault        | `Key Vault`            | No prefix                                  |
| Storage          | `Storage`              | General; use specific product for accuracy |
| Virtual Machines | `Virtual Machines`     | No "Azure" prefix                          |
| Log Analytics    | `Log Analytics`        | Or search `Azure Monitor`                  |

**Tier Keywords**: When searching for tiers like `Basic`, `Standard`, `Premium`:

- The server automatically searches both `productName` and `skuName`
- Examples: `sku_name="Basic"` finds SQL Database Basic, Service Bus Basic, etc.
- For specific SKUs (e.g., `B1`, `D4s_v3`), use the exact SKU name

---

## 📋 Installation

> **📝 New to setup?** Check out [INSTALL.md](INSTALL.md) for detailed installation instructions!  
> **🐳 Prefer Docker?** See [DOCKER.md](DOCKER.md) for containerized deployment!

### Prerequisites

- **Python 3.10+** (or Docker for containerized deployment)
- **pip** (Python package manager)

### Option 1: Docker (Easiest)

```bash
# Or with Docker CLI
docker build -t azure-pricing-mcp .
docker run -i azure-pricing-mcp
```

### Option 2: Automated Setup

```bash
# Windows PowerShell
.\scripts\setup.ps1

# Linux/Mac/Cross-platform
python scripts/install.py
```

### Option 2: Manual Setup

```bash
# Clone repository
git clone https://github.com/msftnadavbh/AzurePricingMCP.git
cd AzurePricingMCP

# Create virtual environment
python -m venv .venv

# Activate virtual environment
source .venv/bin/activate    # Linux/Mac
.venv\Scripts\activate       # Windows

# Install dependencies
pip install -r requirements.txt
```

### Dependencies

```
mcp>=1.0.0
aiohttp>=3.9.0
pydantic>=2.0.0
requests>=2.31.0
```

---

## 🖥️ VS Code Integration

### For This Repository (Pre-configured)

The MCP server is already configured in `.vscode/mcp.json`:

```jsonc
{
  "servers": {
    "azure-pricing": {
      "type": "stdio",
      "command": "${workspaceFolder}/mcp/azure-pricing-mcp/.venv/bin/python",
      "args": ["-m", "azure_pricing_mcp"],
      "cwd": "${workspaceFolder}/mcp/azure-pricing-mcp/src",
    },
  },
}
```

**To activate:**

1. Ensure the virtual environment is set up (see Quick Start)
2. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run: **MCP: List Servers**
4. Click refresh next to `azure-pricing`

### For Other Projects

Create `.vscode/mcp.json` in your workspace:

**Option A: Using Python Virtual Environment**

```jsonc
{
  "servers": {
    "azure-pricing": {
      "type": "stdio",
      "command": "/absolute/path/to/mcp/azure-pricing-mcp/.venv/bin/python",
      "args": ["-m", "azure_pricing_mcp"],
      "cwd": "/absolute/path/to/mcp/azure-pricing-mcp/src",
    },
  },
}
```

> **Windows users**: Use the full path with forward slashes:
>
> ```json
> "command": "C:/path/to/mcp/azure-pricing-mcp/.venv/Scripts/python.exe"
> ```

**Option B: Using Docker (stdio)** 🐳

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

### Use in Copilot Chat

Open Copilot Chat and ask:

```
What's the price of Standard_D32s_v6 in East US 2?
```

You'll see the MCP tools being invoked with real Azure pricing data!

---

## 🤖 Claude Desktop Integration

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Option A: Using Python**

```json
{
  "mcpServers": {
    "azure-pricing": {
      "command": "python",
      "args": ["-m", "azure_pricing_mcp"],
      "cwd": "/path/to/AzurePricingMCP"
    }
  }
}
```

**Option B: Using Docker** 🐳

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

---

## 💬 Example Queries

Once configured, ask your AI assistant:

| Query Type        | Example                                                 |
| ----------------- | ------------------------------------------------------- |
| **Basic Pricing** | "What's the price of a D4s_v3 VM in West US 2?"         |
| **Multi-Node**    | "Price for 20 Standard_D32s_v6 nodes in East US 2"      |
| **Comparison**    | "Compare VM prices between East US and West Europe"     |
| **Cost Estimate** | "Estimate monthly cost for D8s_v5 running 12 hours/day" |
| **SKU Discovery** | "What App Service plans are available?"                 |
| **Savings Plans** | "Show savings plan options for virtual machines"        |
| **Storage**       | "What are the blob storage pricing tiers?"              |

### Sample Response

```
Standard_D32s_v6 in East US 2:
- Linux On-Demand: $1.613/hour → $23,550/month for 20 nodes
- 1-Year Savings:  $1.113/hour → $16,250/month (31% savings)
- 3-Year Savings:  $0.742/hour → $10,833/month (54% savings)
```

---

## 🧪 Testing

### Verify Installation

```bash
# Run the server directly (should start without errors)
python -m azure_pricing_mcp

# Run tests
pytest tests/
```

### Test MCP Connection in VS Code

1. Open Command Palette → **MCP: List Servers**
2. Verify `azure-pricing` shows 6 tools
3. Open Copilot Chat and ask a pricing question

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/AzurePricingMCP.git
cd AzurePricingMCP

# Create development environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -e ".[dev]"

# Make your changes
# ...

# Test your changes
pytest tests/
```

### Contribution Guidelines

1. **Fork** the repository
2. **Create a branch** for your feature (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to your branch (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Code Style

- Follow PEP 8 guidelines
- Add type hints for function parameters and return values
- Include docstrings for public functions
- Test your changes before submitting

### Ideas for Contributions

- [ ] Add support for Azure Reserved Instances pricing
- [ ] Implement caching for frequently requested prices
- [ ] Add more currency support
- [ ] Create unit tests for all tools
- [ ] Add support for Azure Government/China regions
- [ ] Implement price alerts/notifications

---

## 📁 Project Structure

```
mcp/azure-pricing-mcp/           # Location within azure-agentic-infraops repo
├── .venv/                       # Virtual environment (auto-created)
├── src/
│   └── azure_pricing_mcp/
│       ├── __init__.py          # Package initialization
│       ├── __main__.py          # Module entry point
│       ├── server.py            # Main MCP server implementation
│       └── handlers.py          # Tool handlers
├── scripts/
│   ├── install.py               # Installation script
│   ├── setup.ps1                # PowerShell setup script
│   ├── healthcheck.py           # Server health check
│   └── run_server.py            # Server runner
├── tests/                       # Test suite (51 tests)
├── docs/                        # Additional documentation
├── .archive/                    # Archived/obsolete files
├── requirements.txt             # Python dependencies
├── pyproject.toml               # Package configuration
├── INSTALL.md                   # Installation instructions
└── README.md                    # This file
```

---

## 🔌 API Reference

This server uses the [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices):

```
https://prices.azure.com/api/retail/prices
```

**No authentication required** - The Azure Retail Prices API is publicly accessible.

---

## 📚 Additional Documentation

- **[INSTALL.md](INSTALL.md)** - Detailed installation instructions
- **[DOCKER.md](DOCKER.md)** - Docker containerization guide 🐳
- **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** - Development setup and guidelines
- **[docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)** - Detailed code structure

---

## ⚠️ Troubleshooting

### Tools not appearing in VS Code

1. **Check Python syntax**: Ensure no syntax errors in `azure_pricing_server.py`
2. **Verify path**: Use absolute paths in `.vscode/mcp.json`
3. **Restart server**: Command Palette → MCP: List Servers → Restart

### "No module named 'mcp'"

```bash
# Ensure you're in the virtual environment
source .venv/bin/activate
pip install mcp>=1.0.0
```

### Connection errors

- Check your internet connection
- The Azure Pricing API may rate-limit requests (automatic retry is built-in)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Original Author**: [@charris-msft](https://github.com/charris-msft)
- **Current Maintainer + Version 2.1**: [@msftnadavbh](https://github.com/msftnadavbh)
- **Contributors**:
  - [@notoriousmic](https://github.com/notoriousmic) - Testing infrastructure and best practices
- [Model Context Protocol](https://modelcontextprotocol.io/) - The protocol that makes this possible
- [Azure Retail Prices API][retail-api] - Microsoft's public pricing API
- All open-source contributors

[retail-api]: https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices

---

## 📬 Support

- **Issues**: [GitHub Issues](https://github.com/msftnadavbh/AzurePricingMCP/issues)
- **Discussions**: [GitHub Discussions](https://github.com/msftnadavbh/AzurePricingMCP/discussions)

---

<p align="center">
  Made with ❤️ for the Azure community
</p>
