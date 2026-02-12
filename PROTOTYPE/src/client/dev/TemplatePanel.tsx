import React from 'react';

interface TemplatePanelProps {
  readonly onLoad?: (template: any) => void;
}

export default function TemplatePanel({ onLoad }: TemplatePanelProps) {
  return (
    <div className="template-panel">
      <h3>World Template</h3>
      <button onClick={() => onLoad?.({})}>Load Sample Template</button>
    </div>
  );
}
