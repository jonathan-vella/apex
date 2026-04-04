#!/usr/bin/env python3
"""
Find the correct App Service name in Azure Pricing API
"""

import asyncio
import sys

sys.path.insert(0, r"c:\git\mcp\azure_pricing")

from azure_pricing_mcp.server import AzurePricingServer


async def find_app_service():
    """Search for App Service using different name variations."""
    print("🔍 Finding App Service in Azure Pricing API...")
    print("=" * 50)

    async with AzurePricingServer() as server:
        # Try different service name variations
        service_variations = ["App Service", "Azure App Service", "Web App", "App Services", "Azure Web Apps"]

        print("\n1. Testing different service names:")
        for service in service_variations:
            result = await server.search_azure_prices(service_name=service, limit=5)
            print(f'   • {service}: {result["count"]} results')

        # Search by service family
        print('\n2. Searching by service family "Web":')
        result = await server.search_azure_prices(service_family="Web", limit=10)
        print(f'   • Web family: {result["count"]} results')

        if result["items"]:
            print("   Sample Web services found:")
            services = set()
            for item in result["items"][:5]:
                service_name = item.get("serviceName", "Unknown")
                product_name = item.get("productName", "Unknown")
                services.add(f"{service_name} ({product_name})")
            for service in sorted(services):
                print(f"     • {service}")

        # Try broader search for anything with 'app' in the name
        print('\n3. Searching for services containing "app":')
        result = await server.search_azure_prices(limit=200)  # Get more results

        app_services = {}
        for item in result["items"]:
            service_name = item.get("serviceName", "")
            product_name = item.get("productName", "")
            sku_name = item.get("skuName", "")

            # Look for app-related services
            if any(
                keyword in text.lower()
                for text in [service_name, product_name, sku_name]
                for keyword in ["app", "web", "function"]
            ):

                key = f"{service_name}"
                if key not in app_services:
                    app_services[key] = {"service_name": service_name, "products": set(), "skus": set()}
                app_services[key]["products"].add(product_name)
                app_services[key]["skus"].add(sku_name)

        print(f"   Found {len(app_services)} app-related services:")
        for service_key, service_data in sorted(app_services.items()):
            if service_data["service_name"].strip():  # Skip empty names
                print(f'\n     🔷 {service_data["service_name"]}')
                print(f'       Products: {len(service_data["products"])}')
                print(f'       SKUs: {len(service_data["skus"])}')

                # Show sample products and SKUs
                sample_products = list(service_data["products"])[:3]
                sample_skus = list(service_data["skus"])[:5]

                if sample_products:
                    print(f'       Sample products: {", ".join(sample_products)}')
                if sample_skus:
                    print(f'       Sample SKUs: {", ".join(sample_skus)}')


async def test_specific_services():
    """Test specific service names that might be App Service."""
    print("\n4. Testing specific Azure service names:")
    print("-" * 40)

    async with AzurePricingServer() as server:
        # Test service names that might contain App Service
        test_services = ["Azure Functions", "Logic Apps", "API Management", "Container Apps", "Static Web Apps"]

        for service in test_services:
            result = await server.search_azure_prices(service_name=service, limit=10)
            print(f'   • {service}: {result["count"]} results')

            if result["items"] and result["count"] > 0:
                # Show sample SKUs
                skus = set()
                for item in result["items"][:5]:
                    sku = item.get("skuName", "Unknown")
                    skus.add(sku)

                if skus:
                    print(f'     Sample SKUs: {", ".join(sorted(skus))}')


async def main():
    """Main function."""
    print("🚀 Azure App Service Discovery")
    print("🗓️ Date: June 12, 2025")
    print("🎯 Goal: Find App Service SKUs in Azure Pricing API")

    try:
        await find_app_service()
        await test_specific_services()

        print("\n✅ Search completed!")
        print("\n💡 Next steps:")
        print("• Check if App Service might be under 'Azure Functions' or another name")
        print("• App Service plans might be listed under a different service category")
        print("• Some Azure services may not be in the retail pricing API")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
