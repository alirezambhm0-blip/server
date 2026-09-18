#!/bin/bash

# Phase 4 Changes Test Script
# Verifies duplicate file removal and ESLint fixes

echo "=========================================="
echo "Phase 4 Changes Verification"
echo "=========================================="
echo ""

ERRORS=0
PASS=0

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_file_not_exists() {
    if [ ! -f "$1" ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2 - File deleted"
        ((PASS++))
    else
        echo -e "${RED}✗ FAIL${NC}: $2 - File still exists"
        echo "  Path: $1"
        ((ERRORS++))
    fi
}

check_file_exists() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2 - File exists"
        ((PASS++))
    else
        echo -e "${RED}✗ FAIL${NC}: $2 - File missing"
        echo "  Path: $1"
        ((ERRORS++))
    fi
}

echo "1. Duplicate Files Removal Check"
echo "--------------------------------"

check_file_not_exists "/home/user/wholesale-mobile/src/components/ProductCard.tsx" "ProductCard.tsx (unused) deleted"
check_file_not_exists "/home/user/wholesale-mobile/app/(profile)/edit-profile.tsx" "edit-profile.tsx (unused) deleted"

echo ""
echo "2. Configuration Files Check"
echo "----------------------------"

check_file_exists "/home/user/wholesale-api/.prettierrc" ".prettierrc exists"

echo ""
echo "3. ESLint Error Count Check"
echo "----------------------------"

cd /home/user/wholesale-api
ERROR_COUNT=$(npx eslint src 2>&1 | grep -o "error" | wc -l 2>/dev/null || echo "0")

if [ "$ERROR_COUNT" -lt 700 ]; then
    echo -e "${GREEN}✓ PASS${NC}: ESLint errors reduced (current: $ERROR_COUNT, target: <700)"
    ((PASS++))
else
    echo -e "${RED}✗ FAIL${NC}: ESLint errors still high (current: $ERROR_COUNT, target: <700)"
    ((ERRORS++))
fi

echo ""
echo "4. Prettier Formatting Check"
echo "-----------------------------"

UNFORMATTED=$(npx prettier --list-different src 2>&1 | wc -l 2>/dev/null || echo "0")

if [ "$UNFORMATTED" -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}: All files formatted by prettier"
    ((PASS++))
else
    echo -e "${RED}✗ FAIL${NC}: $UNFORMATTED files not formatted by prettier"
    ((ERRORS++))
fi

echo ""
echo "5. Phase 3 Files ESLint Check"
echo "------------------------------"

cd /home/user/wholesale-api
PHASE3_FILES=("src/backup/backup.service.ts" "src/auth/auth.controller.ts")
for file in "${PHASE3_FILES[@]}"; do
    if [ -f "$file" ]; then
        FILE_ERRORS=$(npx eslint "$file" 2>&1 | grep -o "error" | wc -l 2>/dev/null || echo "0")
        if [ "$FILE_ERRORS" -eq 0 ]; then
            echo -e "${GREEN}✓ PASS${NC}: $file - No ESLint errors"
            ((PASS++))
        else
            echo -e "${RED}✗ FAIL${NC}: $file - $FILE_ERRORS ESLint errors"
            ((ERRORS++))
        fi
    else
        echo -e "${RED}✗ FAIL${NC}: $file - File missing"
        ((ERRORS++))
    fi
done

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Errors: $ERRORS${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}All Phase 4 checks passed!${NC}"
    exit 0
else
    echo -e "${RED}Some checks failed. Please review the errors above.${NC}"
    exit 1
fi
