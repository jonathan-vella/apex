# Azure Pricing MCP Server - Docker Image
FROM python:3.13-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    MCP_HOST=0.0.0.0 \
    MCP_PORT=8080

# Copy source code and configuration
COPY src/ ./src/
COPY pyproject.toml .
COPY MANIFEST.in .
COPY README.md .
COPY scripts/healthcheck.py .

# Install the package (pyproject.toml includes all dependencies)
RUN pip install -e .

# Expose port for HTTP MCP server
# Customers will access this via localhost:8080
EXPOSE 8080

# Health check using custom script
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python healthcheck.py || exit 1

# Set the entrypoint to run the MCP server with HTTP transport
# Customers run: docker run -p 8080:8080 azure-pricing-mcp
# Then connect via: http://localhost:8080
ENTRYPOINT ["python", "-m", "azure_pricing_mcp"]
CMD ["--transport", "http", "--host", "0.0.0.0", "--port", "8080"]
