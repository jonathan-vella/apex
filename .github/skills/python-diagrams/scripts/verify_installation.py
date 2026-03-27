#!/usr/bin/env python3
"""
Azure Architecture Diagrams - Installation Verification Script

Run this script to verify all prerequisites are correctly installed.

Usage:
    python verify_installation.py
"""

import sys
import subprocess
import shutil

def check_python_version():
    """Check Python version is 3.9+"""
    print("Checking Python version...", end=" ")
    version = sys.version_info
    if version.major >= 3 and version.minor >= 9:
        print(f"✅ Python {version.major}.{version.minor}.{version.micro}")
        return True
    else:
        print(f"❌ Python {version.major}.{version.minor} (need 3.9+)")
        return False

def check_graphviz():
    """Check Graphviz is installed"""
    print("Checking Graphviz...", end=" ")
    dot_path = shutil.which("dot")
    if dot_path:
        print(f"✅ Found at {dot_path}")
        return True
    else:
        print("❌ Not found")
        print("   Install with:")
        print("   - macOS:   brew install graphviz")
        print("   - Linux:   sudo apt install graphviz")
        print("   - Windows: choco install graphviz")
        return False

def check_diagrams_library():
    """Check diagrams library is installed"""
    print("Checking diagrams library...", end=" ")
    try:
        import diagrams
        print(f"✅ Version {diagrams.__version__ if hasattr(diagrams, '__version__') else 'installed'}")
        return True
    except ImportError:
        print("❌ Not found")
        print("   Install with: pip install diagrams")
        return False

def check_azure_providers():
    """Check Azure providers are available"""
    print("Checking Azure diagram providers...", end=" ")
    try:
        from diagrams.azure.integration import LogicApps, ServiceBus, APIManagement
        from diagrams.azure.compute import FunctionApps
        from diagrams.azure.database import CosmosDb
        from diagrams.azure.storage import BlobStorage
        from diagrams.azure.security import KeyVaults
        print("✅ All core providers available")
        return True
    except ImportError as e:
        print(f"❌ Error: {e}")
        return False

def test_diagram_generation():
    """Test generating a simple diagram"""
    print("Testing diagram generation...", end=" ")
    try:
        from diagrams import Diagram
        from diagrams.azure.integration import LogicApps
        
        import tempfile
        import os
        
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, "test")
            with Diagram("Test", show=False, filename=output_path):
                logic = LogicApps("Test")
            
            # Check file was created
            if os.path.exists(f"{output_path}.png"):
                print("✅ Successfully generated test diagram")
                return True
            else:
                print("❌ Diagram file not created")
                return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    print("=" * 60)
    print("Azure Architecture Diagrams - Installation Verification")
    print("=" * 60)
    print()
    
    results = []
    
    results.append(("Python 3.9+", check_python_version()))
    results.append(("Graphviz", check_graphviz()))
    results.append(("Diagrams library", check_diagrams_library()))
    
    # Only check these if diagrams is installed
    if results[-1][1]:
        results.append(("Azure providers", check_azure_providers()))
        results.append(("Diagram generation", test_diagram_generation()))
    
    print()
    print("=" * 60)
    print("Summary")
    print("=" * 60)
    
    all_passed = all(r[1] for r in results)
    
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {name}: {status}")
    
    print()
    
    if all_passed:
        print("🎉 All checks passed! You're ready to create Azure diagrams.")
        print()
        print("Try it out with Claude Code CLI:")
        print('  "Create a simple Azure diagram with Logic Apps and Service Bus"')
    else:
        print("⚠️  Some checks failed. Please install missing prerequisites.")
        print()
        print("Quick install commands:")
        print("  brew install graphviz     # macOS")
        print("  pip install diagrams      # Python library")
    
    print()
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
