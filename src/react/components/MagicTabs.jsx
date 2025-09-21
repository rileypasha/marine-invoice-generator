import React, { createContext, useContext, useState } from 'react';

// Create a context for tab state management
const TabsContext = createContext();

// Main Tabs component with state management
export const Tabs = ({ children, defaultValue, className = '', ...props }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);

  // Very visible startup logging
  console.log('🚀🚀🚀 MAGIC TABS COMPONENT LOADED! 🚀🚀🚀');
  console.log(`🎯 Tabs initialized with defaultValue: ${defaultValue}`);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={`w-full ${className}`} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

// TabsList component - container for tab triggers
export const TabsList = ({ children, className = '', ...props }) => (
  <div className={`inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground ${className}`} {...props}>
    {children}
  </div>
);

// TabsTrigger component - individual tab button with click handling
export const TabsTrigger = ({ children, value, className = '', ...props }) => {
  const { activeTab, setActiveTab } = useContext(TabsContext);
  const isActive = activeTab === value;

  console.log(`🔥🔥🔥 TABS TRIGGER COMPONENT LOADED! value=${value}, isActive=${isActive} 🔥🔥🔥`);

  const handleClick = () => {
    console.log(`🎯 TabsTrigger CLICKED! Switching to: ${value}`);
    setActiveTab(value);
  };

  return (
    <button
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        isActive
          ? 'bg-background text-foreground shadow'
          : 'hover:bg-background/50'
      } ${className}`}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
};

// TabsContent component - content panel that shows/hides based on active tab
export const TabsContent = ({ children, value, className = '', ...props }) => {
  const { activeTab } = useContext(TabsContext);
  const isActive = activeTab === value;

  // Very visible debug logs
  console.log(`💥💥💥 TABS CONTENT COMPONENT LOADED! value=${value} 💥💥💥`);
  console.log(`🎯 TabsContent rendering: value=${value}, activeTab=${activeTab}, isActive=${isActive}`);

  // Render all content but control visibility with CSS instead of conditional rendering
  // This ensures all form containers exist in the DOM for initialization
  return (
    <div
      className={`mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        isActive ? '' : 'hidden'
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};