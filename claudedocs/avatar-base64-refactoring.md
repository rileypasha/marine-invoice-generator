# Avatar Storage Refactoring: File System → Base64 Database Storage

**Date**: 2025-10-19
**Issue**: Avatar images kept disappearing after being set
**Root Cause**: Avatar files stored locally in `uploads/avatars/` directory were not persisted across deployments
**Solution**: Refactor to store avatar images as Base64 data URLs directly in the database

---

## Problem Summary

User reported avatars "keep disappearing after being set" - set avatar "probably 50 times" and "every single time it goes away after some time for no reason."

### Investigation Findings

1. **Database Check**: User had `avatarUrl` field populated with path `/uploads/avatars/avatar-xxx.jpg`
2. **File System Check**: Actual avatar file **didn't exist** on filesystem
3. **Root Cause**:
   - `uploads/` directory is gitignored (line 47 in .gitignore)
   - Files stored locally don't persist across deployments
   - This is a live web application with multiple users on different devices - local file storage doesn't work

---

## Solution: Base64 Database Storage

Store avatar images as Base64 data URLs directly in the database instead of file paths.

### Advantages
✅ Images persist across deployments
✅ No file system dependencies
✅ Works on any deployment platform
✅ Simplifies backup/restore
✅ No orphaned file cleanup needed

### Trade-offs
⚠️ Slightly larger database size (Base64 is ~33% larger than binary)
⚠️ 5MB size limit enforced on backend

---

## Changes Made

### Backend Changes (server/routes/settings.ts)

#### 1. Removed File Upload Infrastructure
**Lines 1-45 (REMOVED)**:
- Removed `multer`, `path`, `fs` imports
- Removed multer storage configuration
- Removed file upload middleware

#### 2. Refactored Profile Update Endpoint
**Lines 152-280 (MODIFIED)**:

**Before**:
```typescript
router.put('/profile', upload.single('avatar'), async (req, res) => {
  const avatarFile = req.file;

  if (avatarFile) {
    avatarUrl = `/uploads/avatars/${avatarFile.filename}`;

    // Delete old avatar file
    const oldPath = path.join(__dirname, '../../', oldUser.rows[0].avatarUrl);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }
});
```

**After**:
```typescript
router.put('/profile', async (req, res) => {
  const { name, email, avatar } = req.body; // avatar is Base64 string

  if (avatar) {
    // Validate Base64 data URL
    const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
    if (!base64Regex.test(avatar)) {
      return res.status(400).json({
        code: 'INVALID_AVATAR',
        message: 'Avatar must be a valid Base64 image data URL'
      });
    }

    // Validate size (5MB max)
    const base64Data = avatar.split(',')[1];
    const sizeInBytes = (base64Data.length * 3) / 4;
    const maxSizeInBytes = 5 * 1024 * 1024;

    if (sizeInBytes > maxSizeInBytes) {
      return res.status(400).json({
        code: 'AVATAR_TOO_LARGE',
        message: 'Avatar image must be less than 5MB'
      });
    }
  }

  // Store Base64 string directly in database
  const result = await query(
    `UPDATE "User"
     SET name = $1,
         email = $2,
         ${avatar ? '"avatarUrl" = $4,' : ''}
         "updatedAt" = NOW()
     WHERE id = $3
     RETURNING id, name, email, role, "avatarUrl"`,
    avatar ? [name, email, userId, avatar] : [name, email, userId]
  );
});
```

**Key Changes**:
- Accept `avatar` as Base64 string in JSON request body
- Validate Base64 format: `data:image/(jpeg|jpg|png|gif|webp);base64,{data}`
- Calculate and validate image size (Base64 is ~33% larger than binary)
- Store Base64 string directly in `avatarUrl` database field
- **Removed all file system operations** (no more fs.unlinkSync, fs.existsSync)

---

### Frontend Changes (src/pages/Settings.tsx)

#### 1. Updated ProfileData Interface
**Lines 25-30 (MODIFIED)**:

**Before**:
```typescript
interface ProfileData {
  name: string;
  email: string;
  avatarFile?: File | null;
  avatarUrl?: string;
}
```

**After**:
```typescript
interface ProfileData {
  name: string;
  email: string;
  avatar?: string; // Base64 data URL
  avatarUrl?: string; // Current avatar from database
}
```

#### 2. Updated State Initialization
**Lines 41-46 (MODIFIED)**:
- Changed `avatarFile: null` → `avatar: undefined`
- Added `avatarUrl: ''` to track current avatar from database

#### 3. Refactored File Upload Handler
**Lines 446-461 (MODIFIED)**:

**Before**:
```typescript
<input
  type="file"
  accept="image/*"
  onChange={(e) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileData({ ...profileData, avatarFile: file });
    }
  }}
/>
```

**After**:
```typescript
<input
  type="file"
  accept="image/*"
  onChange={(e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Convert file to Base64
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileData({ ...profileData, avatar: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  }}
/>
```

**Key Changes**:
- Use `FileReader.readAsDataURL()` to convert uploaded file to Base64
- Store Base64 data URL in state (format: `data:image/jpeg;base64,{data}`)
- Display Base64 data URL directly in `<img>` tag

#### 4. Updated Profile Update Request
**Lines 210-256 (MODIFIED)**:

**Before**:
```typescript
const formData = new FormData();
formData.append('name', profileData.name);
formData.append('email', profileData.email);
if (profileData.avatarFile) {
  formData.append('avatar', profileData.avatarFile);
}

const response = await fetch(`${API_BASE_URL}/settings/profile`, {
  method: 'PUT',
  headers: {
    'X-CSRF-Token': csrfToken
  },
  credentials: 'include',
  body: formData
});
```

**After**:
```typescript
const requestBody: { name: string; email: string; avatar?: string } = {
  name: profileData.name,
  email: profileData.email
};

if (profileData.avatar) {
  requestBody.avatar = profileData.avatar;
}

const response = await fetch(`${API_BASE_URL}/settings/profile`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  credentials: 'include',
  body: JSON.stringify(requestBody)
});
```

**Key Changes**:
- Send JSON request instead of FormData
- Include `Content-Type: application/json` header
- Send Base64 avatar string directly in JSON body

#### 5. Updated Avatar Display
**Lines 426-439 (MODIFIED)**:

**Before**:
```typescript
<img
  src={profileData.avatarFile ? URL.createObjectURL(profileData.avatarFile) : profileData.avatarUrl}
  alt="Current avatar"
/>
```

**After**:
```typescript
<img
  src={profileData.avatar || profileData.avatarUrl}
  alt="Current avatar"
/>
```

**Key Changes**:
- Display `avatar` (newly selected Base64) or `avatarUrl` (existing database avatar)
- Both are Base64 data URLs that work directly in `<img>` src

---

## Database Schema

**No changes required** - The existing `avatarUrl` field now stores Base64 data URLs instead of file paths.

```prisma
model User {
  id        String   @id
  email     String   @unique
  name      String?
  avatarUrl String?  @map("avatarUrl")  // Now stores Base64 data URLs
  // ... other fields
}
```

**Example values**:
- **Old (file path)**: `/uploads/avatars/avatar-xxx.jpg`
- **New (Base64)**: `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...`

---

## Testing Checklist

✅ **Upload new avatar**:
1. Go to Settings → Profile Information
2. Click "Choose Image" and select a photo
3. Verify image preview shows immediately
4. Click "Save Changes"
5. Verify success notification
6. Refresh page → avatar should still be visible

✅ **Update profile without changing avatar**:
1. Go to Settings → Profile Information
2. Change name/email (don't upload new avatar)
3. Click "Save Changes"
4. Verify avatar persists (doesn't get cleared)

✅ **Avatar persistence across sessions**:
1. Set avatar
2. Log out
3. Log back in
4. Verify avatar is still visible

✅ **Avatar size validation**:
1. Try uploading image > 5MB
2. Should get error: "Avatar image must be less than 5MB"

✅ **Avatar format validation**:
1. Backend validates: `data:image/(jpeg|jpg|png|gif|webp);base64,{data}`
2. Other formats should be rejected

---

## Migration Notes

**Existing Users with File Path Avatars**:
- Old file paths (e.g., `/uploads/avatars/avatar-xxx.jpg`) will remain in database
- If file doesn't exist, avatar won't display (expected behavior)
- Users can re-upload avatar to get Base64 version
- No automated migration needed - users can fix their own avatars

**Optional Database Cleanup**:
```sql
-- Clear all file path avatarUrls (optional)
UPDATE "User"
SET "avatarUrl" = NULL
WHERE "avatarUrl" LIKE '/uploads/avatars/%';
```

---

## Related Files

- **Backend**: `server/routes/settings.ts` (lines 1-280)
- **Frontend**: `src/pages/Settings.tsx` (lines 25-469)
- **Documentation**:
  - `claudedocs/avatar-persistence-investigation.md` (previous investigation)
  - `claudedocs/avatar-base64-refactoring.md` (this document)

---

## Deployment Notes

✅ **No deployment dependencies**:
- No need for `uploads/` directory
- No file serving configuration required
- Works on any platform (Render, Vercel, AWS, etc.)
- Database is the single source of truth

🎉 **Deployment-ready**: This refactoring makes the application truly cloud-native with no local file storage dependencies.
