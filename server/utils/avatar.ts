export const buildAvatarUrl = (userId: string, updatedAt?: Date | string | null) => {
  if (!userId) {
    return null;
  }

  const base = `/api/v1/users/${userId}/avatar`;

  if (!updatedAt) {
    return base;
  }

  const timestamp = typeof updatedAt === 'string'
    ? new Date(updatedAt).getTime()
    : updatedAt.getTime();

  if (!Number.isFinite(timestamp)) {
    return base;
  }

  return `${base}?v=${timestamp}`;
};
