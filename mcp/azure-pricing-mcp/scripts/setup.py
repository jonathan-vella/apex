#!/usr/bin/env python3
"""
Setup script for Azure Pricing MCP Server
"""

from pathlib import Path

from setuptools import find_packages, setup

# Read the README for long description
readme_file = Path(__file__).parent / "README.md"
long_description = readme_file.read_text(encoding="utf-8") if readme_file.exists() else ""

# Read requirements
requirements_file = Path(__file__).parent / "requirements.txt"
requirements = []
if requirements_file.exists():
    requirements = [
        line.strip()
        for line in requirements_file.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    ]

setup(
    name="azure-pricing-mcp",
    version="2.1.0",
    description="A Model Context Protocol server for querying Azure retail pricing information",
    long_description=long_description,
    long_description_content_type="text/markdown",
    author="Nadav Ben Haim",
    url="https://github.com/msftnadavbh/AzurePricingMCP",
    license="MIT",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Internet :: WWW/HTTP :: Dynamic Content",
    ],
    keywords=["azure", "pricing", "mcp", "model-context-protocol", "cloud-costs"],
    package_dir={"": "src"},
    packages=find_packages(where="src"),
    python_requires=">=3.10",
    install_requires=requirements,
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "black>=23.0.0",
            "mypy>=1.0.0",
            "ruff>=0.1.0",
        ]
    },
    entry_points={
        "console_scripts": [
            "azure-pricing-mcp=azure_pricing_mcp.server:main",
        ],
    },
    include_package_data=True,
    zip_safe=False,
)
