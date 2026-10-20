#!/usr/bin/env bash
# Keep uv's managed base untouched and install project packages in a writable environment.
set -euo pipefail

if [[ ! "${VERSION:-}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ || ! "${PIPVERSION:-}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Python and pip require exact stable version options." >&2
    exit 1
fi

export UV_PYTHON_INSTALL_DIR=/usr/local/share/apex-python
uv python install "$VERSION"
install -d -m 0755 /usr/local/python
uv venv --python "$(uv python find --managed-python "$VERSION")" /usr/local/python/current
uv pip install --python /usr/local/python/current/bin/python3 "pip==${PIPVERSION}"
chown -R vscode:vscode /usr/local/python/current
for command in python python3 pip pip3; do
    ln -s "/usr/local/python/current/bin/${command}" "/usr/local/bin/${command}"
done
