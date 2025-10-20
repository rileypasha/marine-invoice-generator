# Password Management Policy

**Date**: 2025-10-20
**Issue**: User's personal password was inadvertently reset by running bulk test account reset script
**Resolution**: Scripts modified to prevent this from happening again

---

## Problem

The `npm run reset:passwords` script was resetting ALL accounts including the user's personal account (rpasha@marinegroupbw.com), causing unexpected password changes without explicit consent.

---

## Solution

### 1. Modified reset-user-passwords.ts

**Changed**:
- Removed `rpasha@marinegroupbw.com` from RESET_USERS array
- Added clear warning messages that script only resets TEST accounts
- Added comments explaining to use `reset-single-password.ts` for personal accounts

**Purpose**: This script now ONLY resets test/development accounts:
- test@marinegroupbw.com
- admin@mginvoices.com
- user@mginvoices.com

### 2. Created reset-single-password.ts

**Usage**:
```bash
npx ts-node scripts/reset-single-password.ts <email> <password>
```

**Example**:
```bash
npx ts-node scripts/reset-single-password.ts rpasha@marinegroupbw.com "MySecurePassword123!"
```

**Purpose**: Safe way to reset individual accounts without affecting others

---

## Policy for Claude Code

**NEVER** run `npm run reset:passwords` without:
1. Checking what accounts are in the RESET_USERS array
2. Confirming with the user if their personal account will be affected
3. Using `reset-single-password.ts` instead when only one account needs resetting

**ALWAYS** use `reset-single-password.ts` for:
- Personal accounts (rpasha@marinegroupbw.com)
- Individual password resets
- User-requested password changes

**ONLY** use `npm run reset:passwords` for:
- Resetting all test accounts at once
- Development environment setup
- After explicit user confirmation

---

## Test Account Credentials

After running `npm run reset:passwords`, these accounts will have known passwords:

- **test@marinegroupbw.com** → `TestPassword123!`
- **admin@mginvoices.com** → `AdminPassword123!`
- **user@mginvoices.com** → `UserPassword123!`

Personal accounts (rpasha@marinegroupbw.com) are **excluded** and must be reset individually using `reset-single-password.ts`.

---

## Incident Log

**2025-10-20**: Initial issue discovered
- User reported password not working
- Investigation revealed bulk reset script had changed user's personal password
- Modified scripts to prevent recurrence
- Created this policy document
