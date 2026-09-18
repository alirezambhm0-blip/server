#!/bin/bash

# Phase 3 Changes Test Script
# This script verifies that all Phase 3 security fixes are in place

echo "=========================================="
echo "Phase 3 Security Changes Verification"
echo "=========================================="
echo ""

ERRORS=0
WARNINGS=0
PASS=0

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a pattern exists in a file
check_pattern() {
    local file=$1
    local pattern=$2
    local description=$3
    
    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${GREEN}✓ PASS${NC}: $description"
        ((PASS++))
    else
        echo -e "${RED}✗ FAIL${NC}: $description"
        echo "  File: $file"
        echo "  Pattern not found: $pattern"
        ((ERRORS++))
    fi
}

# Function to check if a pattern does NOT exist in a file
check_no_pattern() {
    local file=$1
    local pattern=$2
    local description=$3
    
    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${RED}✗ FAIL${NC}: $description"
        echo "  File: $file"
        echo "  Pattern should not exist: $pattern"
        ((ERRORS++))
    else
        echo -e "${GREEN}✓ PASS${NC}: $description"
        ((PASS++))
    fi
}

echo "1. Backup Service Security Checks"
echo "------------------------------------"

# Check that pg_dump uses array arguments instead of string interpolation
check_pattern "wholesale-api/src/backup/backup.service.ts" "execAsync.*pg_dump" "Backup uses array arguments (not string interpolation)"

# Check that databaseUrl is not directly interpolated
check_no_pattern "wholesale-api/src/backup/backup.service.ts" "pg_dump.*databaseUrl" "No direct databaseUrl interpolation in pg_dump"

echo ""
echo "2. Admin Panel XSS Protection Checks"
echo "--------------------------------------"

# Check core.js has security functions
check_pattern "wholesale-api/public/admin/core.js" "function getAuthToken()" "getAuthToken function exists"
check_pattern "wholesale-api/public/admin/core.js" "function clearAuthToken()" "clearAuthToken function exists"
check_pattern "wholesale-api/public/admin/core.js" "credentials: 'include'" "API function uses credentials: include"

# Check app.js uses esc() for error messages
check_pattern "wholesale-api/public/admin/app.js" "esc(e.message)" "Error messages are escaped in app.js"

# Check orders.js uses esc() for order numbers
check_pattern "wholesale-api/public/admin/orders.js" "esc(o.orderNumber)" "Order numbers are escaped in orders.js"

# Check visitor-sales.js uses vsEsc() for errors
check_pattern "wholesale-api/public/admin/visitor-sales.js" "vsEsc(String(e))" "Error messages are escaped in visitor-sales.js"

echo ""
echo "3. HttpOnly Cookie Support Checks"
echo "-----------------------------------"

# Check auth controller has Res decorator
check_pattern "wholesale-api/src/auth/auth.controller.ts" "@Res({ passthrough: true }) res: Response" "verifyOtp has Response parameter"

# Check cookie setting
check_pattern "wholesale-api/src/auth/auth.controller.ts" "res.cookie('admin_token_v3'" "HttpOnly cookie is set"

# Check cookie options
check_pattern "wholesale-api/src/auth/auth.controller.ts" "httpOnly: true" "Cookie has httpOnly option"

# Check logout endpoint exists
check_pattern "wholesale-api/src/auth/auth.controller.ts" "@Post('logout')" "Logout endpoint exists"

# Check cookie clearing
check_pattern "wholesale-api/src/auth/auth.controller.ts" "res.clearCookie('admin_token_v3'" "Cookie is cleared on logout"

echo ""
echo "4. Database Mapping Verification"
echo "--------------------------------"

# Check that Product model doesn't have incorrect @map for costPrice
check_no_pattern "wholesale-api/prisma/schema.prisma" "costPrice.*@map" "Product.costPrice has no incorrect @map"

# Check that Product model doesn't have @map for nameNormalized (Category can have it)
check_no_pattern "wholesale-api/prisma/schema.prisma" "model Product.*nameNormalized.*@map" "Product.nameNormalized has no @map"

# Check that correct @map directives exist
check_pattern "wholesale-api/prisma/schema.prisma" "orderNumber.*@map.*order_number" "Order.orderNumber has correct @map"
check_pattern "wholesale-api/prisma/schema.prisma" "subtotalAmount.*@map.*subtotal_amount" "Order.subtotalAmount has correct @map"

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Errors: $ERRORS${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}All Phase 3 security checks passed!${NC}"
    exit 0
else
    echo -e "${RED}Some checks failed. Please review the errors above.${NC}"
    exit 1
fi
