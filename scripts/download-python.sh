#!/bin/bash

set -e

PYTHON_VERSION="3.13.6"
BUILD_VERSION="20250807"
ARCH="aarch64"
PLATFORM="apple-darwin"
PYTHON_URL="https://github.com/astral-sh/python-build-standalone/releases/download/${BUILD_VERSION}/cpython-${PYTHON_VERSION}+${BUILD_VERSION}-${ARCH}-${PLATFORM}-install_only.tar.gz"

RESOURCES_DIR="./resources"
PYTHON_DIR="${RESOURCES_DIR}/python"

echo "Downloading Python ${PYTHON_VERSION} standalone build..."

if [ -d "${PYTHON_DIR}" ]; then
  echo "Python already exists in ${PYTHON_DIR}"
  exit 0
fi

mkdir -p "${RESOURCES_DIR}"

echo "Downloading from ${PYTHON_URL}..."
curl -L -o /tmp/python.tar.gz "${PYTHON_URL}"

echo "Extracting Python..."
mkdir -p "${PYTHON_DIR}"
tar -xzf /tmp/python.tar.gz -C "${PYTHON_DIR}" --strip-components=1

rm /tmp/python.tar.gz

echo "Python successfully installed to ${PYTHON_DIR}"
echo "Python binary: ${PYTHON_DIR}/bin/python3"