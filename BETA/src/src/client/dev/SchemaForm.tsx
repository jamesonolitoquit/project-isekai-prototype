import React from 'react';

interface SchemaFormProps {
  readonly schema?: any;
  readonly value?: any;
  readonly onChange?: (data: any) => void;
  readonly extraContext?: any;
}

export default function SchemaForm({ schema = {}, value = {}, onChange, extraContext }: SchemaFormProps) {
  return (
    <div className="schema-form">
      <h3>Schema Editor</h3>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}
