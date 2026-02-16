# Contributing to Azure Pricing MCP

Thank you for your interest in contributing to the Azure Pricing MCP Server! 🎉

## 🚀 Getting Started

### Prerequisites

- Python 3.10 or higher
- Git
- Docker (optional, for testing containerized builds)

### Setting Up Development Environment

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/AzurePricingMCP.git
   cd AzurePricingMCP
   ```

2. **Create a virtual environment:**
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Linux/Mac
   .venv\Scripts\activate     # Windows
   ```

3. **Install development dependencies:**
   ```bash
   pip install -e ".[dev]"
   ```

4. **Install pre-commit hooks (optional but recommended):**
   ```bash
   pip install pre-commit
   pre-commit install
   ```

## 🧪 Running Tests

### Run all tests:
```bash
pytest tests/ -v
```

### Run specific test files:
```bash
pytest tests/test_azure_pricing.py -v
```

### Run linters:
```bash
# Format code
black src/ tests/

# Check with Ruff
ruff check src/ tests/

# Type checking
mypy src/
```

### Run pre-commit checks manually:
```bash
pre-commit run --all-files
```

## 📝 Code Style

We follow these guidelines:

- **PEP 8** for Python code style
- **Black** for code formatting (line length: 120)
- **Ruff** for linting
- **MyPy** for type checking
- **Type hints** for all function parameters and return values
- **Docstrings** for public functions and classes

### Example:
```python
async def search_prices(
    service_name: str,
    region: Optional[str] = None,
    limit: int = 50
) -> Dict[str, Any]:
    """Search Azure retail prices with filters.

    Args:
        service_name: The Azure service to search for
        region: Optional region filter
        limit: Maximum number of results

    Returns:
        Dictionary containing search results and metadata
    """
    # Implementation here
```

## 🔄 Pull Request Process

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes:**
   - Write clear, concise commit messages
   - Add tests for new functionality
   - Update documentation as needed
   - Ensure all tests pass

3. **Commit your changes:**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

   We follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` New features
   - `fix:` Bug fixes
   - `docs:` Documentation changes
   - `test:` Test additions or changes
   - `refactor:` Code refactoring
   - `chore:` Maintenance tasks

4. **Push to your fork:**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open a Pull Request:**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your feature branch
   - Fill out the PR template with:
     - Description of changes
     - Related issues (if any)
     - Testing performed
     - Screenshots (if applicable)

6. **Respond to feedback:**
   - Address review comments promptly
   - Push additional commits to the same branch
   - Keep the conversation professional and constructive

## 🐛 Reporting Bugs

When reporting bugs, please include:

1. **Clear description** of the issue
2. **Steps to reproduce** the behavior
3. **Expected behavior** vs actual behavior
4. **Environment details:**
   - OS (Windows/Linux/Mac)
   - Python version
   - Package version
5. **Error messages** or logs (if applicable)
6. **Code samples** to reproduce (if applicable)

## 💡 Suggesting Enhancements

We love feature suggestions! Please include:

1. **Use case** - What problem does it solve?
2. **Proposed solution** - How would it work?
3. **Alternative approaches** - What else did you consider?
4. **Examples** - Show how it would be used

## 🎯 Areas for Contribution

Here are some areas where we'd love contributions:

- [ ] Additional Azure service mappings
- [ ] More comprehensive test coverage
- [ ] Performance optimizations
- [ ] Caching mechanisms
- [ ] Additional pricing tools (e.g., Reserved Instances)
- [ ] Support for more currencies
- [ ] Documentation improvements
- [ ] Example integrations
- [ ] Bug fixes

## 📜 Code of Conduct

### Our Standards

- **Be respectful** and inclusive
- **Be collaborative** and helpful
- **Be professional** in all interactions
- **Accept constructive criticism** gracefully
- **Focus on what's best** for the community

### Unacceptable Behavior

- Harassment or discrimination of any kind
- Trolling or inflammatory comments
- Personal attacks
- Publishing private information
- Any unprofessional conduct

## 🆘 Getting Help

- **Questions?** Open a [Discussion](https://github.com/msftnadavbh/AzurePricingMCP/discussions)
- **Bugs?** Open an [Issue](https://github.com/msftnadavbh/AzurePricingMCP/issues)
- **Stuck?** Ask in the Pull Request comments

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

All contributors will be recognized in our README and release notes!

---

Thank you for contributing to Azure Pricing MCP! Your efforts help make Azure pricing more accessible to everyone. 💙
