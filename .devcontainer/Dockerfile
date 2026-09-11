FROM mcr.microsoft.com/devcontainers/base:ubuntu26.04

USER root
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN export DEBIAN_FRONTEND=noninteractive \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates curl jq tar gzip graphviz dos2unix bats \
    && rm -rf /var/lib/apt/lists/*

COPY install-build-tools.sh download-checksums.json /tmp/apex-build-tools/
RUN bash /tmp/apex-build-tools/install-build-tools.sh \
    && rm -rf /tmp/apex-build-tools \
    && install -d -m 0755 -o vscode -g vscode \
        /home/vscode/.cache /home/vscode/.cache/uv \
        /home/vscode/.local /home/vscode/.local/bin \
        /home/vscode/.terraform.d /home/vscode/.terraform.d/plugin-cache
