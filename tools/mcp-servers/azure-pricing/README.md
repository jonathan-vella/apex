# Azure Pricing MCP Server 💰

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![MCP](https://img.shields.io/badge/MCP-1.0+-green.svg)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://github.com/msftnadavbh/AzurePricingMCP/actions/workflows/test.yml/badge.svg)](https://github.com/msftnadavbh/AzurePricingMCP/actions/workflows/test.yml)

A **Model Context Protocol (MCP)** server that provides AI assistants with real-time access to Azure retail pricing information. Query VM prices, compare costs across regions, estimate monthly bills, and discover available SKUs—all through natural language.

<p align="center">
  <img src="https://img.shields.io/badge/Azure-Pricing-0078D4?style=for-the-badge&logo=microsoft-azure&logoColor=white" alt="Azure Pricing"/>
  <img src="https://img.shields.io/badge/VS_Code-MCP-007ACC?style=for-the-badge&logo=visual-studio-code&logoColor=white" alt="VS Code MCP"/>
</p>

---

## 🚀 Quick Start

```bash
# Clone and setup
git clone https://github.com/msftnadavbh/AzurePricingMCP.git
cd AzurePricingMCP
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Test the server
python -m azure_pricing_mcp
```

Then configure your AI assistant. See [Integrations](#-integrations).

---

## ✨ Features

- **Price Search** - Query Azure prices with flexible filters
- **Price Comparison** - Compare costs across regions or SKUs
- **Cost Estimation** - Calculate monthly/yearly costs
- **Reserved Instances** - Compare RI pricing with break-even analysis
- **Region Recommendations** - Find the cheapest regions for any SKU
- **SKU Discovery** - Fuzzy matching for service names
- **Retirement Warnings** - Alerts for retiring VM SKUs
- **Spot VM Intelligence** - Eviction rates and price history (requires Azure auth)
- **Orphaned Resources** - Detect unused resources with real cost calculation (requires Azure auth)
- **PTU Sizing** - Estimate Provisioned Throughput Units for Azure OpenAI deployments
- **Databricks DBU Pricing** - Search DBU rates, estimate costs, compare workloads
- **GitHub Pricing** - Full GitHub pricing catalog + cost estimation (Plans, Copilot, Actions, Security)

📖 **[Full feature details →](docs/FEATURES.md)**

---

## 🛠️ Tools

18 tools available for AI assistants:

- `azure_price_search` - Search retail prices
- `azure_price_compare` - Compare across regions/SKUs
- `azure_ri_pricing` - Reserved Instance pricing
- `azure_cost_estimate` - Usage-based cost estimation
- `azure_region_recommend` - Find cheapest regions
- `azure_discover_skus` / `azure_sku_discovery` - SKU lookup
- `get_customer_discount` - Customer discount information
- `spot_eviction_rates` / `spot_price_history` / `simulate_eviction` - Spot VM tools
- `find_orphaned_resources` - Detect orphaned resources with cost analysis
- `azure_ptu_sizing` - Estimate PTUs for Azure OpenAI deployments
- `databricks_dbu_pricing` / `databricks_cost_estimate` / `databricks_compare_workloads` - Databricks DBU pricing
- `github_pricing` / `github_cost_estimate` - GitHub pricing catalog and cost estimation

📖 **[Tool documentation →](docs/TOOLS.md)**

---

## 📋 Installation

**Docker (Easiest):**
```bash
docker build -t azure-pricing-mcp .
docker run -i azure-pricing-mcp
```

**Python:**
```bash
pip install -r requirements.txt
```

📖 **[Full installation guide →](INSTALL.md)**

---

## 🔌 Integrations

Works with any MCP-compatible AI assistant:

- **VS Code** with GitHub Copilot
- **Claude Desktop**

📖 **[Integration setup →](docs/INTEGRATIONS.md)**

---

## 📁 Project Structure

```
AzurePricingMCP/
├── src/azure_pricing_mcp/    # Main package
│   ├── server.py             # MCP server
│   ├── handlers.py           # Tool handlers
│   ├── client.py             # Azure API client
│   ├── config.py             # Pricing data & constants
│   ├── tools.py              # Core tool definitions
│   ├── formatters.py         # Response formatters
│   ├── models.py             # Data models
│   ├── services/             # Business logic
│   ├── databricks/           # Databricks DBU tools
│   └── github_pricing/       # GitHub pricing tools
├── tests/                    # Test suite (9 files, 236+ tests)
├── docs/                     # Documentation
└── scripts/                  # Setup & debug scripts
```

📖 **[Detailed structure →](docs/PROJECT_STRUCTURE.md)**

---

## 🔌 API Reference

This server uses the [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices):

```
https://prices.azure.com/api/retail/prices
```

**No authentication required** - The Azure Retail Prices API is publicly accessible.

---

## 🤝 Contributing

We welcome contributions! See **[CONTRIBUTING.md](CONTRIBUTING.md)** for setup instructions, code style, and PR process.

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [INSTALL.md](INSTALL.md) | Installation guide |
| [docs/FEATURES.md](docs/FEATURES.md) | Feature details |
| [docs/TOOLS.md](docs/TOOLS.md) | Tool documentation |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | VS Code & Claude setup |
| [docs/USAGE_EXAMPLES.md](docs/USAGE_EXAMPLES.md) | Detailed examples |
| [docs/ORPHANED_RESOURCES.md](docs/ORPHANED_RESOURCES.md) | Orphaned resources guide |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **Original Author**: [@charris-msft](https://github.com/charris-msft)
- **Current Maintainer**: [@msftnadavbh](https://github.com/msftnadavbh)
- **Contributors**: [@notoriousmic](https://github.com/notoriousmic), [@iditbnaya](https://github.com/iditbnaya), [@roy2392](https://github.com/roy2392)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices)

---

## 📬 Support

- **Issues**: [GitHub Issues](https://github.com/msftnadavbh/AzurePricingMCP/issues)
- **Discussions**: [GitHub Discussions](https://github.com/msftnadavbh/AzurePricingMCP/discussions)

---

<p align="center">
  Made with ❤️ for the Azure community
</p>