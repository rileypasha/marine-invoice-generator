import React from 'react';
import { motion } from 'framer-motion';
import { MoreVertical, Calendar, DollarSign, Ship, User } from 'lucide-react';
import { useGestures, hapticFeedback } from '../../hooks/useGestures';

interface Request {
  id: string;
  invoice_number?: string;
  customer?: {
    company_name?: string;
    display_name?: string;
    contact_name?: string;
  };
  vessel?: {
    name?: string;
  };
  user?: {
    name?: string;
    email?: string;
  };
  userName?: string;
  total_amount?: number;
  invoice_date?: string;
  updated_at?: string;
  status?: 'requested' | 'change_requested' | 'approved';
}

interface RequestCardProps {
  request: Request;
  onTap?: (request: Request) => void;
  onEdit?: (request: Request) => void;
  onDelete?: (request: Request) => void;
  onView?: (request: Request) => void;
  onPrint?: (request: Request) => void;
}

const statusConfig = {
  requested: {
    label: 'Requested',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  change_requested: {
    label: 'Changes Req.',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  approved: {
    label: 'Approved',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
};

export function RequestCard({
  request,
  onTap,
  onEdit,
  onDelete,
  onView,
  onPrint,
}: RequestCardProps) {
  const [showActions, setShowActions] = React.useState(false);

  const gestureRef = useGestures<HTMLDivElement>({
    onSwipeLeft: () => {
      hapticFeedback(10);
      setShowActions(true);
    },
    onSwipeRight: () => {
      hapticFeedback(10);
      setShowActions(false);
    },
    onLongPress: () => {
      hapticFeedback(50);
      setShowActions(!showActions);
    },
  });

  const handleTap = () => {
    hapticFeedback(10);
    onTap?.(request);
  };

  const handleAction = (action: () => void) => {
    hapticFeedback(20);
    setShowActions(false);
    action();
  };

  const customerName =
    request.customer?.display_name ||
    request.customer?.company_name ||
    request.customer?.contact_name ||
    'Unknown';

  const vesselName = request.vessel?.name || 'N/A';
  const userName = request.userName || request.user?.name || 'Unknown';
  const status = request.status || 'requested';
  const statusInfo = statusConfig[status];

  const formatCurrency = (amount?: number) => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <motion.div
      ref={gestureRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleTap}
      className="relative bg-white border border-border rounded-lg p-4 mb-3 shadow-sm active:shadow-md transition-shadow"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-foreground truncate">
            {request.invoice_number || `REQ-${request.id.slice(0, 8)}`}
          </h3>
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {customerName}
          </p>
        </div>

        {/* Status Badge */}
        <div
          className={`px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ml-2 ${statusInfo.className}`}
        >
          {statusInfo.label}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Vessel */}
        <div className="flex items-start space-x-2 min-w-0">
          <Ship size={16} className="text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Vessel</p>
            <p className="text-sm font-medium truncate">{vesselName}</p>
          </div>
        </div>

        {/* Amount */}
        <div className="flex items-start space-x-2 min-w-0">
          <DollarSign size={16} className="text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Amount</p>
            <p className="text-sm font-medium">{formatCurrency(request.total_amount)}</p>
          </div>
        </div>

        {/* Created By */}
        <div className="flex items-start space-x-2 min-w-0">
          <User size={16} className="text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Created By</p>
            <p className="text-sm font-medium truncate">{userName}</p>
          </div>
        </div>

        {/* Date */}
        <div className="flex items-start space-x-2 min-w-0">
          <Calendar size={16} className="text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Date</p>
            <p className="text-sm font-medium">{formatDate(request.invoice_date)}</p>
          </div>
        </div>
      </div>

      {/* Actions Menu Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          hapticFeedback(10);
          setShowActions(!showActions);
        }}
        className="absolute top-4 right-4 p-2 hover:bg-muted rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="More actions"
      >
        <MoreVertical size={20} className="text-muted-foreground" />
      </button>

      {/* Actions Menu */}
      {showActions && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className="absolute right-4 top-16 z-10 bg-white border border-border rounded-lg shadow-lg py-1 min-w-[160px]"
          onClick={(e) => e.stopPropagation()}
        >
          {onView && (
            <button
              onClick={() => handleAction(() => onView(request))}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors min-h-[44px] flex items-center"
            >
              View Details
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => handleAction(() => onEdit(request))}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors min-h-[44px] flex items-center"
            >
              Edit
            </button>
          )}
          {onPrint && (
            <button
              onClick={() => handleAction(() => onPrint(request))}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors min-h-[44px] flex items-center"
            >
              Print
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => handleAction(() => onDelete(request))}
              className="w-full px-4 py-2.5 text-left text-sm text-destructive hover:bg-destructive/10 transition-colors min-h-[44px] flex items-center"
            >
              Delete
            </button>
          )}
        </motion.div>
      )}

      {/* Swipe Indicator (optional visual feedback) */}
      {showActions && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-lg" />
      )}
    </motion.div>
  );
}

/**
 * Skeleton loading state for RequestCard
 */
export function RequestCardSkeleton() {
  return (
    <div className="bg-white border border-border rounded-lg p-4 mb-3 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-muted rounded w-32" />
          <div className="h-4 bg-muted rounded w-48" />
        </div>
        <div className="h-6 bg-muted rounded-full w-20 ml-2" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 bg-muted rounded w-16" />
            <div className="h-4 bg-muted rounded w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default RequestCard;
