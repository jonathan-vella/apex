#!/usr/bin/env python3
"""
Run the Azure Pricing MCP Server
Quick script to run the server after installation
"""

import os
import subprocess
import sys
from pathlib import Path


def get_python_executable():
    """Get the Python executable path for the virtual environment."""
    if os.name == "nt":  # Windows
        return Path(".venv") / "Scripts" / "python.exe"
    else:  # Unix/Linux/Mac
        return Path(".venv") / "bin" / "python"


def run_server():
    """Run the MCP server."""
    python_exe = get_python_executable()

    if not python_exe.exists():
        print("❌ Virtual environment not found!")
        print("Please run: python scripts/install.py")
        sys.exit(1)

    print("🚀 Starting Azure Pricing MCP Server...")
    print("   (Use Ctrl+C to stop)")
    print()

    try:
        subprocess.run([str(python_exe), "-m", "azure_pricing_mcp"], check=True)
    except KeyboardInterrupt:
        print("\n👋 Server stopped")
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Error running server: {e}")
        sys.exit(1)


if __name__ == "__main__":
    run_server()
