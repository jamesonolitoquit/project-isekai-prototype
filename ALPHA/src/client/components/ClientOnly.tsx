import React, { useEffect, useState, ReactNode } from 'react';

/**
 * ClientOnly: Wrapper component that only renders content on the client side.
 * Prevents SSR/static generation from attempting to render interactive components.
 * [M48-A5: Pre-rendering stabilization]
 */
export const ClientOnly: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null; // Return nothing during SSR/pre-rendering
  }

  return <>{children}</>;
};

export default ClientOnly;
