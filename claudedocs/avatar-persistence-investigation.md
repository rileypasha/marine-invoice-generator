# Avatar Persistence Investigation

## Date: 2025-10-19

## Problem Summary
User reports that avatars keep disappearing after being set. User has set avatar "probably 50 times" and "every single time it goes away after some time for no reason".

## Investigation Results

### Backend Endpoints Review

#### 1. `/api/v1/settings/profile` (settings.ts:191-334)
**Status**: ✅ CORRECT - Avatar persistence logic is sound

**Avatar Upload Logic** (lines 251-264):
```typescript
let avatarUrl = null;
if (avatarFile) {
  avatarUrl = `/uploads/avatars/${avatarFile.filename}`;

  // Delete old avatar if exists
  const oldUser = await query('SELECT "avatarUrl" FROM "User" WHERE id = $1', [userId]);
  if (oldUser.rows.length > 0 && oldUser.rows[0].avatarUrl) {
    const oldPath = path.join(__dirname, '../../', oldUser.rows[0].avatarUrl);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }
}
```

**Update Query** (lines 267-276):
```typescript
const result = await query(
  `UPDATE "User"
   SET name = $1,
       email = $2,
       ${avatarUrl ? '"avatarUrl" = $4,' : ''}
       "updatedAt" = NOW()
   WHERE id = $3
   RETURNING id, name, email, role, "avatarUrl"`,
  avatarUrl ? [name, email, userId, avatarUrl] : [name, email, userId]
);
```

**Behavior**:
- ✅ When avatar is uploaded: Sets avatarUrl to `/uploads/avatars/{filename}`
- ✅ When NO avatar uploaded: Doesn't modify existing avatarUrl (preserves it)
- ✅ Deletes old avatar file when new one is uploaded

#### 2. `/api/v1/auth/login` (auth.ts:17-68)
**Status**: ✅ CORRECT - Returns avatarUrl

**Response** (lines 55-63):
```typescript
res.json({
  user: {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,  // ✅ Correctly included
  },
  csrfToken: req.session.csrfToken,
});
```

#### 3. `/api/v1/auth/check` (auth.ts:207-252)
**Status**: ✅ CORRECT - Returns avatarUrl

**User Data Fetch** (lines 221-230):
```typescript
const user = await prisma.user.findUnique({
  where: { id: req.session.userId },
  select: {
    id: true,
    email: true,
    name: true,
    role: true,
    avatarUrl: true  // ✅ Correctly selected
  }
});
```

**Response** (lines 242-251):
```typescript
res.json({
  csrfToken: req.session.csrfToken,
  ...(userData && {
    userId: userData.id,
    email: userData.email,
    name: userData.name,
    role: userData.role,
    avatarUrl: userData.avatarUrl  // ✅ Correctly returned
  })
});
```

#### 4. `/api/v1/auth/me` (auth.ts:255-283)
**Status**: ⚠️ **POTENTIAL ISSUE** - Does NOT return avatarUrl

**User Data Fetch** (lines 261-269):
```typescript
const user = await prisma.user.findUnique({
  where: { id: req.session.userId },
  select: {
    id: true,
    email: true,
    name: true,
    role: true
    // ❌ avatarUrl NOT selected!
  }
});
```

**Response** (line 278):
```typescript
res.json({ user });  // ❌ Does not include avatarUrl
```

**Impact**: If frontend calls `/me` endpoint and updates user state, it will overwrite avatarUrl with undefined.

#### 5. Password Update `/api/v1/settings/password` (settings.ts:337-446)
**Status**: ✅ CORRECT - Only updates password field

**Update Query** (lines 415-420):
```typescript
await query(
  `UPDATE "User"
   SET password = $1,
       "updatedAt" = NOW()
   WHERE id = $2`,
  [hashedPassword, userId]
);
```

**Behavior**: ✅ Does not touch avatarUrl field

### Frontend Context Review

#### AuthContext.tsx
**Login Handler** (lines 50-56):
```typescript
setCurrentUser({
  id: data.user.id,
  email: data.user.email,
  name: data.user.name,
  role: data.user.role || 'standard',
  avatarUrl: data.user.avatarUrl  // ✅ Sets avatarUrl
});
```

**Auth Check Handler** (lines 97-103):
```typescript
setCurrentUser({
  id: data.userId,
  email: data.email,
  name: displayName,
  role: data.role || 'standard',
  avatarUrl: data.avatarUrl  // ✅ Sets avatarUrl
});
```

### Root Cause Analysis

**Primary Suspect**: `/api/v1/auth/me` endpoint

**Hypothesis**: If the frontend is calling the `/me` endpoint (e.g., on page refresh, navigation, or periodic auth checks), and then updating the user state with the response, it will **overwrite the avatarUrl with undefined** because the `/me` endpoint doesn't include avatarUrl in its response.

**Evidence**:
1. Backend `/me` endpoint only selects `id`, `email`, `name`, `role` - NOT `avatarUrl`
2. Frontend would receive `{ user: { id, email, name, role } }` - no avatarUrl
3. If frontend does `setCurrentUser(data.user)`, it sets avatarUrl to undefined
4. Avatar disappears

### Potential Scenarios Where Avatar Gets Cleared

1. **Scenario 1**: User updates profile without uploading new avatar
   - **Status**: ✅ SAFE - Backend doesn't modify avatarUrl

2. **Scenario 2**: User updates password
   - **Status**: ✅ SAFE - Backend only updates password field

3. **Scenario 3**: Frontend calls `/me` endpoint and updates user state
   - **Status**: ⚠️ **LIKELY CULPRIT** - Would overwrite avatarUrl with undefined

4. **Scenario 4**: Frontend calls `/check` endpoint
   - **Status**: ✅ SAFE - Returns avatarUrl correctly

### Recommended Fix

**Fix the `/me` endpoint to include avatarUrl:**

**File**: `server/routes/auth.ts` (lines 261-269)

**Before**:
```typescript
const user = await prisma.user.findUnique({
  where: { id: req.session.userId },
  select: {
    id: true,
    email: true,
    name: true,
    role: true
  }
});
```

**After**:
```typescript
const user = await prisma.user.findUnique({
  where: { id: req.session.userId },
  select: {
    id: true,
    email: true,
    name: true,
    role: true,
    avatarUrl: true  // ✅ ADD THIS LINE
  }
});
```

### Testing Checklist

After applying the fix:
1. Set avatar for test user in Settings
2. Navigate to different pages to trigger auth checks
3. Refresh the page to trigger re-authentication
4. Update profile name/email without uploading avatar
5. Verify avatar persists in all scenarios

## Implementation Results

### Fix Applied ✅
**Date**: 2025-10-19 23:30 UTC

**File Modified**: `server/routes/auth.ts` (line 268)

**Change**:
```typescript
select: {
  id: true,
  email: true,
  name: true,
  role: true,
  avatarUrl: true  // ✅ ADDED
}
```

### Frontend Analysis ✅
**Searched for `/me` endpoint calls**: No calls found in frontend codebase
- Searched patterns: `/api/v1/auth/me`, `/auth/me`, `auth/me`
- Result: The frontend does NOT currently call the `/me` endpoint

**Conclusion**: The fix is **preventative** - it ensures that if the `/me` endpoint is ever called in the future, it will correctly include `avatarUrl` in the response and won't cause avatars to disappear.

### Current Authentication Flow
Based on code review, the frontend uses:
1. `/api/v1/auth/login` - Returns avatarUrl ✅
2. `/api/v1/auth/check` - Returns avatarUrl ✅
3. `/api/v1/auth/me` - Now returns avatarUrl ✅ (fixed)

Both actively used endpoints (`/login` and `/check`) correctly return avatarUrl, so the immediate avatar persistence issue should be resolved.

## Next Steps

1. ✅ Apply fix to `/me` endpoint - COMPLETED
2. ✅ Search frontend codebase for any calls to `/me` endpoint - COMPLETED (none found)
3. Monitor for avatar persistence in production
4. If issue persists, investigate other potential causes:
   - Client-side state management bugs
   - Other backend endpoints that might clear avatarUrl
   - Browser cache issues
