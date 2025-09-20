import { useState } from 'react';
import MagicUITestComponent from './MagicUITestComponent.jsx';

const TestComponent = () => {
  const [count, setCount] = useState(0);

  return (
    <div className="space-y-4">
      {/* Original React Test */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 m-4">
        <h2 className="text-xl font-bold text-blue-800 mb-4">
          🚀 React Integration Test
        </h2>
        <p className="text-blue-700 mb-4">
          This is a React component successfully integrated into the Marine Invoice Generator!
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCount(count - 1)}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            -
          </button>
          <span className="text-lg font-semibold">Count: {count}</span>
          <button
            onClick={() => setCount(count + 1)}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            +
          </button>
        </div>
        <p className="text-sm text-blue-600 mt-4">
          ✅ React hooks working
          <br />
          ✅ JSX compilation working
          <br />
          ✅ Tailwind CSS working
          <br />
          ✅ Component state management working
        </p>
      </div>

      {/* Magic UI Test */}
      <MagicUITestComponent />
    </div>
  );
};

export default TestComponent;