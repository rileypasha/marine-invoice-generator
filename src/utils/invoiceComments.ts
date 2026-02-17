export interface CommentReply {
  id: string;
  author: string;
  initials: string;
  avatarUrl?: string;
  text: string;
  createdAt: string;
}

export interface CommentHighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface InvoiceComment {
  id: string;
  author: string;
  initials: string;
  avatarUrl?: string;
  text: string;
  selectionText: string;
  createdAt: string;
  serviceId?: string;
  highlight: CommentHighlightRect | null;
  replies: CommentReply[];
}

const ensureString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  return '';
};

const ensureNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

export const getInitials = (name: string | undefined | null): string => {
  if (!name) return 'U';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
  return initials.slice(0, 2) || 'U';
};

export const normalizeInvoiceComments = (raw: unknown): InvoiceComment[] => {
  if (!Array.isArray(raw)) return [];

  return (raw as unknown[]).map((comment, index) => {
    const commentAny = comment as Record<string, unknown> | undefined;
    const authorName = ensureString(commentAny?.author) || ensureString(commentAny?.authorEmail) || 'Unknown User';

    const repliesRaw = Array.isArray(commentAny?.replies) ? (commentAny?.replies as unknown[]) : [];
    const replies: CommentReply[] = repliesRaw.map((reply, replyIndex) => {
      const replyAny = reply as Record<string, unknown> | undefined;
      const replyAuthor = ensureString(replyAny?.author) || ensureString(replyAny?.authorEmail) || 'Unknown User';

      return {
        id: ensureString(replyAny?.id) || `reply_${Date.now()}_${index}_${replyIndex}`,
        author: replyAuthor,
        initials: ensureString(replyAny?.initials) || getInitials(replyAuthor),
        avatarUrl: ensureString(replyAny?.avatarUrl) || undefined,
        text: ensureString(replyAny?.text),
        createdAt: ensureString(replyAny?.createdAt) || new Date().toISOString(),
      };
    });

    const highlightAny = (commentAny?.highlight as Record<string, unknown>) || {};

    return {
      id: ensureString(commentAny?.id) || `comment_${Date.now()}_${index}`,
      author: authorName,
      initials: ensureString(commentAny?.initials) || getInitials(authorName),
      avatarUrl: ensureString(commentAny?.avatarUrl) || undefined,
      text: ensureString(commentAny?.text),
      selectionText: ensureString(commentAny?.selectionText),
      createdAt: ensureString(commentAny?.createdAt) || new Date().toISOString(),
      highlight: {
        top: ensureNumber(highlightAny.top, 0),
        left: ensureNumber(highlightAny.left, 0),
        width: ensureNumber(highlightAny.width, 28),
        height: ensureNumber(highlightAny.height, 24),
      },
      replies,
    };
  });
};

