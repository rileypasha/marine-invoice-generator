import React from 'react';
import { formatTimeAgo } from '../../../js/utils/formatters.js';
import { cn } from '../../lib/utils.js';

export const CommentReply = ({
  reply,
  currentUser,
  className,
  ...props
}) => {
  const formatReplyText = (text) => {
    return text.replace(/\n/g, '<br>');
  };

  return (
    <div
      className={cn('comment-reply bg-muted/50 rounded-md p-3 space-y-2', className)}
      {...props}
    >
      {/* Reply Header */}
      <div className="flex items-center gap-2">
        <span className="font-medium text-foreground text-sm">{reply.author}</span>
        <span className="text-xs text-muted-foreground">
          {formatTimeAgo(new Date(reply.timestamp))}
        </span>
      </div>

      {/* Reply Content */}
      <div
        className="text-sm text-foreground whitespace-pre-wrap"
        dangerouslySetInnerHTML={{
          __html: formatReplyText(reply.text)
        }}
      />
    </div>
  );
};

export default CommentReply;