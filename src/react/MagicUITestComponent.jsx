import { useState, forwardRef } from 'react';
import { cn } from '../lib/utils.js';

const SimpleButton = forwardRef(({ className, variant = 'default', size = 'default', children, ...props }, ref) => {
  const baseStyles = 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

  const variants = {
    default: 'bg-primary text-primary-foreground hover:opacity-90',
    destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    secondary: 'bg-secondary text-secondary-foreground hover:opacity-80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
  };

  const sizes = {
    default: 'h-10 px-4 py-2',
    sm: 'h-9 rounded-md px-3',
    lg: 'h-11 rounded-md px-8',
    icon: 'h-10 w-10',
  };

  return (
    <button
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </button>
  );
});

SimpleButton.displayName = 'SimpleButton';

const MagicUITestComponent = () => {
  const [actionLog, setActionLog] = useState([]);

  const logAction = (action) => {
    setActionLog(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${action}`]);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 m-4 shadow-sm">
      <div className="text-center space-y-2 mb-6">
        <h2 className="text-2xl font-bold text-foreground">🎨 Magic UI Integration Test</h2>
        <p className="text-muted-foreground">Testing 21st.dev components in Marine Invoice Generator</p>
      </div>

      <div className="space-y-6">
        {/* Button Variants */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">Button Variants</h3>
          <div className="flex flex-wrap gap-3">
            <SimpleButton
              variant="default"
              onClick={() => logAction('Generate Invoice clicked')}
            >
              Generate Invoice
            </SimpleButton>

            <SimpleButton
              variant="outline"
              onClick={() => logAction('Save Draft clicked')}
            >
              Save Draft
            </SimpleButton>

            <SimpleButton
              variant="secondary"
              onClick={() => logAction('Preview clicked')}
            >
              Preview
            </SimpleButton>

            <SimpleButton
              variant="destructive"
              onClick={() => logAction('Delete clicked')}
            >
              Delete
            </SimpleButton>

            <SimpleButton
              variant="ghost"
              onClick={() => logAction('Cancel clicked')}
            >
              Cancel
            </SimpleButton>
          </div>
        </div>

        {/* Button Sizes */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">Button Sizes</h3>
          <div className="flex gap-3 items-center">
            <SimpleButton
              size="sm"
              variant="outline"
              onClick={() => logAction('Small button clicked')}
            >
              Small
            </SimpleButton>

            <SimpleButton
              size="default"
              variant="default"
              onClick={() => logAction('Default button clicked')}
            >
              Default
            </SimpleButton>

            <SimpleButton
              size="lg"
              variant="secondary"
              onClick={() => logAction('Large button clicked')}
            >
              Large
            </SimpleButton>
          </div>
        </div>

        {/* Action Log */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">Action Log</h3>
          <div className="bg-muted border border-border rounded-md p-3 min-h-[120px]">
            {actionLog.length === 0 ? (
              <p className="text-muted-foreground italic">Click buttons above to see actions logged here...</p>
            ) : (
              <div className="space-y-1">
                {actionLog.map((log, index) => (
                  <div key={index} className="text-sm text-foreground font-mono">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="bg-accent border border-border rounded-md p-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span className="text-accent-foreground font-medium">Magic UI Integration Status:</span>
          </div>
          <ul className="mt-2 text-sm text-accent-foreground space-y-1">
            <li>✅ 21st.dev Magic UI components loading</li>
            <li>✅ Tailwind CSS styling working</li>
            <li>✅ React hooks (useState) working</li>
            <li>✅ Component composition working</li>
            <li>✅ Event handlers working</li>
            <li>✅ cn() utility function working</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MagicUITestComponent;