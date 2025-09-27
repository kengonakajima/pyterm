#!/bin/bash

set -e

PYTHON_DIR="./resources/python"
PYTHON_BIN="${PYTHON_DIR}/bin/python3"
PIP_BIN="${PYTHON_DIR}/bin/pip3"

if [ ! -f "${PYTHON_BIN}" ]; then
  echo "Python not found. Run 'npm run setup-python' first."
  exit 1
fi

echo "Installing numpy..."
"${PIP_BIN}" install numpy

echo "Packages installed successfully!"
"${PIP_BIN}" list