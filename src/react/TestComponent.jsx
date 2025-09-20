import { useState } from 'react';
import MagicUIButtonShowcase from './MagicUIButtonShowcase.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.jsx';

const TestComponent = () => {
  const [count, setCount] = useState(0);

  return (
    <div className="space-y-4">
      {/* React Integration Status */}
      <Card className="m-4">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-foreground">
            🚀 React + Magic UI Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            React components successfully integrated with real Magic UI from 21st.dev!
          </p>
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCount(count - 1)}
            >
              -
            </Button>
            <span className="text-lg font-semibold">Count: {count}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCount(count + 1)}
            >
              +
            </Button>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>✅ React hooks working</div>
            <div>✅ JSX compilation working</div>
            <div>✅ Magic UI components from 21st.dev</div>
            <div>✅ Tailwind v4 with oklch colors</div>
            <div>✅ Component state management working</div>
          </div>
        </CardContent>
      </Card>

      {/* Magic UI Button Showcase */}
      <MagicUIButtonShowcase />
    </div>
  );
};

export default TestComponent;