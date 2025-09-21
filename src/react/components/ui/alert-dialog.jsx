import React from 'react';

export const AlertDialog = ({ open, onOpenChange, children }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => onOpenChange?.(false)}
      />
      <div className="relative z-50">
        {children}
      </div>
    </div>
  );
};

export const AlertDialogContent = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-background border border-border rounded-lg shadow-xl p-6 w-full max-w-lg mx-4 transform scale-95 animate-in duration-200 ${className}`}
      style={{ animation: 'scale-in 0.2s ease-out forwards' }}
      {...props}
    >
      {children}
    </div>
  );
};

export const AlertDialogHeader = ({ children, className = '', ...props }) => (
  <div className={`flex items-center gap-3 mb-4 ${className}`} {...props}>
    {children}
  </div>
);

export const AlertDialogTitle = ({ children, className = '', ...props }) => (
  <h2 className={`text-lg font-semibold leading-none tracking-tight ${className}`} {...props}>
    {children}
  </h2>
);

export const AlertDialogDescription = ({ children, className = '', ...props }) => (
  <p className={`text-sm text-muted-foreground mb-4 ${className}`} {...props}>
    {children}
  </p>
);

export const AlertDialogFooter = ({ children, className = '', ...props }) => (
  <div className={`flex justify-end gap-2 mt-6 ${className}`} {...props}>
    {children}
  </div>
);

export const AlertDialogCancel = ({ children, onClick, className = '', ...props }) => (
  <button
    className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 ${className}`}
    onClick={onClick}
    {...props}
  >
    {children}
  </button>
);

export const AlertDialogAction = ({ children, onClick, variant = 'default', className = '', ...props }) => {
  const variants = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  };

  return (
    <button
      className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 ${variants[variant]} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};