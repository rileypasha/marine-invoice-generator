import React, { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";

export interface RowAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  hidden?: boolean;
}

interface RowActionsDropdownProps {
  actions: RowAction[];
  rowId: string;
  ariaLabel?: string;
}

export const RowActionsDropdown = React.memo<RowActionsDropdownProps>(({
  actions,
  rowId,
  ariaLabel = "Row actions"
}) => {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const visibleActions = actions.filter(action => !action.hidden);

  if (visibleActions.length === 0) {
    return null;
  }

  const handleOpenChange = (open: boolean) => {
    setActionsOpen(open);
    if (open) {
      requestAnimationFrame(() => setArmed(true));
    } else {
      setArmed(false);
    }
  };

  const handleActionClick = (action: RowAction) => {
    action.onClick();
    setActionsOpen(false);
  };

  return (
    <DropdownMenu
      open={actionsOpen}
      onOpenChange={handleOpenChange}
      modal={false}
    >
      <DropdownMenuTrigger
        asChild
      >
        <button
          aria-label={ariaLabel}
          data-row-actions-trigger
          data-testid={`row-actions-trigger-${rowId}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setActionsOpen((v) => !v); }}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0 cursor-pointer"
        >
          <MoreHorizontal className="h-4 w-4 pointer-events-none" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuPortal>
        <DropdownMenuContent
          data-row-actions
          data-testid={`row-actions-content-${rowId}`}
          onPointerDown={(e) => e.stopPropagation()}
          onInteractOutside={(e) => {
            const t = (e as any).detail?.originalEvent?.target as HTMLElement | undefined;
            if (!armed || t?.closest('[data-row-actions]') || t?.closest('[data-row-actions-trigger]')) {
              e.preventDefault();
            }
          }}
          onCloseAutoFocus={(e) => e.preventDefault()}
          align="end"
        >
          {visibleActions.map((action, index) => (
            <DropdownMenuItem
              key={`${action.label}-${index}`}
              onSelect={(e) => { e.preventDefault(); handleActionClick(action); }}
              className={action.variant === 'destructive' ? 'text-red-600 focus:text-red-600' : undefined}
            >
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
});

RowActionsDropdown.displayName = "RowActionsDropdown";