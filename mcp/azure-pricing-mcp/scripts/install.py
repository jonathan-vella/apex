#!/usr/bin/env python3
"""
Installation and setup script for Azure Pricing MCP Server
This script sets up the virtual environment and installs the package in development mode.
"""

import os
import subprocess
import sys
from pathlib import Path


def create_venv():
    """Create virtual environment if it doesn't exist."""
    venv_path = Path(".venv")
    if not venv_path.exists():
        print("🔧 Creating virtual environment...")
        subprocess.run([sys.executable, "-m", "venv", ".venv"], check=True)
        print("✅ Virtual environment created")
    else:
        print("✅ Virtual environment already exists")


def get_python_executable():
    """Get the Python executable path for the virtual environment."""
    if os.name == "nt":  # Windows
        return Path(".venv") / "Scripts" / "python.exe"
    else:  # Unix/Linux/Mac
        return Path(".venv") / "bin" / "python"


def install_package():
    """Install the package in development mode."""
    python_exe = get_python_executable()
    print("📦 Installing package in development mode...")
    subprocess.run([str(python_exe), "-m", "pip", "install", "-e", ".[dev]"], check=True)
    print("✅ Package installed")


def verify_installation():
    """Verify the installation was successful."""
    python_exe = get_python_executable()
    print("\n🔍 Verifying installation...")

    try:
        result = subprocess.run(
            [str(python_exe), "-c", "import azure_pricing_mcp; print('2.1.0')"],
            capture_output=True,
            text=True,
            check=True,
        )
        version = result.stdout.strip()
        print(f"✅ Installation verified - version {version}")
        return True
    except subprocess.CalledProcessError:
        print("❌ Installation verification failed")
        return False


def print_next_steps():
    """Print instructions for next steps."""
    print("\n" + "=" * 60)
    print("🎉 Setup complete!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Activate the virtual environment:")
    if os.name == "nt":
        print("   .venv\\Scripts\\activate")
    else:
        print("   source .venv/bin/activate")
    print("\n2. Run the server:")
    print("   python -m azure_pricing_mcp")
    print("\n3. Or use the console script:")
    print("   azure-pricing-mcp")
    print("\n4. Configure your MCP client (VS Code, Claude, etc.)")
    print("   See README.md for configuration examples")
    print("=" * 60)


def main():
    """Main setup function."""
    try:
        print("🔄 Setting up Azure Pricing MCP Server...")
        print()

        create_venv()
        install_package()

        if verify_installation():
            print_next_steps()
        else:
            print("\n⚠️  Installation may have issues. Please check the output above.")
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n👋 Setup cancelled")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Error during setup: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
