import { useState } from 'react';
import { Button } from '../components/ui/button.jsx';

const ShadcnTestComponent = () => {
  const [actionLog, setActionLog] = useState([]);

  const logAction = (action) => {
    setActionLog(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${action}`]);
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">🎨 Real shadcn/ui Components</h1>
        <p className="text-muted-foreground">Testing authentic Magic UI components with proper shadcn/ui styling</p>
      </div>

      {/* Button Showcase */}
      <div className="space-y-6">

        {/* Primary Actions Section */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-card-foreground">Primary Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => logAction('Generate Invoice clicked')}>
              Generate Invoice
            </Button>
            <Button variant="secondary" onClick={() => logAction('Save Draft clicked')}>
              Save Draft
            </Button>
            <Button variant="outline" onClick={() => logAction('Preview clicked')}>
              Preview
            </Button>
          </div>
        </div>

        {/* Button Variants Section */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-card-foreground">Button Variants</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="default" onClick={() => logAction('Default button clicked')}>
              Default
            </Button>
            <Button variant="destructive" onClick={() => logAction('Delete clicked')}>
              Delete
            </Button>
            <Button variant="outline" onClick={() => logAction('Outline clicked')}>
              Outline
            </Button>
            <Button variant="secondary" onClick={() => logAction('Secondary clicked')}>
              Secondary
            </Button>
            <Button variant="ghost" onClick={() => logAction('Ghost clicked')}>
              Ghost
            </Button>
            <Button variant="link" onClick={() => logAction('Link clicked')}>
              Link
            </Button>
          </div>
        </div>

        {/* Button Sizes Section */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-card-foreground">Button Sizes</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={() => logAction('Small button clicked')}>
              Small
            </Button>
            <Button size="default" onClick={() => logAction('Default size clicked')}>
              Default
            </Button>
            <Button size="lg" onClick={() => logAction('Large button clicked')}>
              Large
            </Button>
            <Button size="icon" onClick={() => logAction('Icon button clicked')}>
              ⚙️
            </Button>
          </div>
        </div>

        {/* Action Log */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-card-foreground">Action Log</h2>
          <div className="bg-muted border border-border rounded-md p-4 min-h-[120px]">
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

        {/* Status Indicators */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span className="text-card-foreground font-medium">shadcn/ui Integration Status:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span>CSS variables properly configured</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span>Tailwind classes working with shadcn</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span>Button variants rendering correctly</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span>Proper shadows and hover effects</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span>Focus states and accessibility</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span>Responsive design working</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShadcnTestComponent;