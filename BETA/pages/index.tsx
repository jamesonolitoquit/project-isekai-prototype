import React from "react";

export default function HomePage() {
  return (
    <div>
      <h1>BETA Website is Running!</h1>
      <p>The Next.js development server is working. Runtime issues can now be investigated.</p>
    </div>
  );
}

export const dynamic = 'force-dynamic'; // [M48-A4: Disable static generation for interactive page]
