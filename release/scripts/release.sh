#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}========================================"
echo -e "   stock-flow Release Script"
echo -e "========================================${NC}"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed or not in PATH${NC}"
    echo -e "${YELLOW}Please install Node.js from https://nodejs.org/${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}Node.js version: $NODE_VERSION${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed or not in PATH${NC}"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo -e "${GREEN}npm version: $NPM_VERSION${NC}"

echo ""
echo -e "${YELLOW}Starting release process...${NC}"
echo ""

# Run the release script
if node release/scripts/release.js; then
    echo ""
    echo -e "${GREEN}Release completed successfully!${NC}"
    echo ""
else
    echo ""
    echo -e "${RED}Release failed!${NC}"
    exit 1
fi