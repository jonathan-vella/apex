#!/usr/bin/env bash

# Install from HashiCorp's signed APT repository because the upstream feature's
# legacy keyserver flow does not recognize Ubuntu Resolute.
set -euo pipefail

readonly KEYRING_PATH="/usr/share/keyrings/hashicorp-archive-keyring.gpg"
readonly SOURCES_PATH="/etc/apt/sources.list.d/hashicorp.list"

main() {
  local architecture
  local codename

  . /etc/os-release
  architecture="$(dpkg --print-architecture)"
  codename="${VERSION_CODENAME}"

  case "${architecture}" in
    amd64|arm64) ;;
    *)
      echo "Terraform is unsupported on ${architecture}; supported architectures: amd64, arm64." >&2
      exit 1
      ;;
  esac

  apt-get update
  apt-get install -y --no-install-recommends ca-certificates curl gpg
  install -d -m 0755 "$(dirname "${KEYRING_PATH}")"
  curl --fail --silent --show-error --location https://apt.releases.hashicorp.com/gpg \
    | gpg --dearmor --output "${KEYRING_PATH}"
  chmod a+r "${KEYRING_PATH}"
  printf 'deb [arch=%s signed-by=%s] https://apt.releases.hashicorp.com %s main\n' \
    "${architecture}" "${KEYRING_PATH}" "${codename}" > "${SOURCES_PATH}"

  apt-get update
  apt-get install -y --no-install-recommends terraform
  rm -rf /var/lib/apt/lists/*
}

main "$@"
