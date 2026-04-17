# syntax=docker/dockerfile:1
# Minimal passthrough Dockerfile — the ONLY reason this exists is to remove a
# broken upstream apt source from mcr.microsoft.com/devcontainers/universal:2-linux.
#
# The universal image ships /etc/apt/sources.list.d/yarn.list with a rotated
# GPG key (NO_PUBKEY 62D54FD4003F6525). Any devcontainer feature whose install
# script runs `apt-get update` under `set -e` (terraform, some others) fails
# hard on the resulting signature error. We don't use yarn anywhere, so we
# delete the broken source list before any feature runs.
#
# When Microsoft fixes the universal image upstream, delete this file and
# switch devcontainer.json back to `"image": "mcr.microsoft.com/..."`.

FROM mcr.microsoft.com/devcontainers/universal:2-linux

# Remove stale/broken third-party apt sources from the base image.
# Keep this list tight: only remove sources we've proven to be broken.
RUN sudo rm -f /etc/apt/sources.list.d/yarn.list
