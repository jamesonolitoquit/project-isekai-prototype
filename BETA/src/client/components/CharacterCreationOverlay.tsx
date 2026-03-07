import React from 'react';
import CharacterWizard from './CharacterWizard';
import type { WorldTemplate } from '../../types/template';

interface CharacterCreationOverlayProps {
  onCharacterCreated?: (character: any) => void;
  worldTemplate?: WorldTemplate;
}

export default function CharacterCreationOverlay({
  onCharacterCreated,
  worldTemplate
}: CharacterCreationOverlayProps) {
  if (!worldTemplate) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        overflow: 'hidden'
      }}
    >
      <CharacterWizard
        onCharacterCreated={onCharacterCreated}
        worldTemplate={worldTemplate}
        onCancel={() => {
          // Handle cancel - could close overlay here
        }}
      />
    </div>
  );
}