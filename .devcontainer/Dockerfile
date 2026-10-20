FROM mcr.microsoft.com/azurelinux-beta/base/core:4.0@sha256:63ef5dda2fb5681ae3aa5c9597a8c4b24364da91ec459b419fa3c38160595fae

USER root
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN dnf upgrade -y --refresh \
    && dnf install -y \
        bash ca-certificates curl jq tar gzip xz unzip graphviz bats \
        git openssh-clients procps-ng sudo shadow-utils util-linux findutils coreutils-single diffutils \
        icu krb5-libs libatomic openssl-libs zlib-ng-compat \
    && dnf clean all \
    && groupadd --gid 1000 vscode \
    && useradd --uid 1000 --gid vscode --create-home --shell /bin/bash vscode \
    && printf 'vscode ALL=(root) NOPASSWD:ALL\n' > /etc/sudoers.d/vscode \
    && chmod 0440 /etc/sudoers.d/vscode \
    && visudo --check --file /etc/sudoers.d/vscode

COPY install-build-tools.sh download-checksums.json /tmp/apex-build-tools/
RUN bash /tmp/apex-build-tools/install-build-tools.sh \
    && rm -rf /tmp/apex-build-tools \
    && install -d -m 0755 -o vscode -g vscode \
        /home/vscode/.cache /home/vscode/.cache/uv \
        /home/vscode/.config /home/vscode/.config/gh \
        /home/vscode/.local /home/vscode/.local/bin \
        /home/vscode/.terraform.d /home/vscode/.terraform.d/plugin-cache
