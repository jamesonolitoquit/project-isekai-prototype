/**
 * Phase 3 Task 5: Director Command Input
 * 
 * Console-like input for director slash commands
 * Parses and executes commands like /whisper, /reveal, /paradox
 */

import React, { useState, useRef, useEffect } from 'react';
import type { Event } from '../../events/mutationLog';

export interface DirectorCommandInputProps {
  /**
   * World ID for command context
   */
  worldInstanceId: string;

  /**
   * Current player/actor ID
   */
  actorId: string;

  /**
   * Current game tick
   */
  currentTick: number;

  /**
   * Callback when command is executed
   */
  onCommandExecute?: (cmd: string, event: Event | null) => void;

  /**
   * Callback for feedback messages
   */
  onStatusMessage?: (msg: string) => void;
}

/**
 * DirectorCommandInput Component
 * 
 * Provides text input for director commands
 * Supports: /whisper intensity message, /reveal target message, /paradox severity message
 */
export const DirectorCommandInput: React.FC<DirectorCommandInputProps> = ({
  worldInstanceId,
  actorId,
  currentTick,
  onCommandExecute,
  onStatusMessage
}) => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) {
      return;
    }

    const cmd = input.trim();

    // Add to history
    setHistory(prev => [...prev, cmd]);
    setHistoryIndex(-1);

    try {
      // Parse and execute command
      const { executeDirectorCommand, parseDirectorCommand } = require('../../engine/directorCommandEngine');
      const parsed = parseDirectorCommand(cmd);

      if (!parsed) {
        onStatusMessage?.(`❌ Invalid command. Start with "/" (e.g., /whisper 50 Message)`);
        setInput('');
        return;
      }

      const event = executeDirectorCommand(worldInstanceId, actorId, parsed, currentTick);

      if (event) {
        onStatusMessage?.(`✓ Command executed: ${parsed.command}`);
        onCommandExecute?.(cmd, event);
      } else {
        onStatusMessage?.(`⚠️ Command parsed but no event generated`);
      }

      setInput('');
    } catch (err) {
      onStatusMessage?.(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      // Navigate history backwards
      e.preventDefault();
      const nextIndex = historyIndex === -1 ? history.length - 1 : historyIndex - 1;
      if (nextIndex >= 0) {
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      // Navigate history forwards
      e.preventDefault();
      if (historyIndex > -1) {
        const nextIndex = historyIndex + 1;
        if (nextIndex < history.length) {
          setHistoryIndex(nextIndex);
          setInput(history[nextIndex]);
        } else {
          setHistoryIndex(-1);
          setInput('');
        }
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid #6366f1',
        borderRadius: '4px'
      }}
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ color: '#a78bfa', fontWeight: 'bold', fontSize: '12px' }}>/</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setHistoryIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder="whisper 50 Your whisper message here..."
          style={{
            flex: 1,
            padding: '6px 8px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            border: '1px solid #374151',
            color: '#e0e0e0',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '12px',
            outline: 'none'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#a78bfa';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#374151';
          }}
        />
        <button
          type="submit"
          style={{
            padding: '6px 12px',
            backgroundColor: '#6366f1',
            border: '1px solid #a78bfa',
            color: '#e0e0e0',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 'bold'
          }}
        >
          Send
        </button>
      </div>

      {/* Command Help */}
      <div style={{ fontSize: '10px', color: '#6b7280', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <span><strong>/whisper</strong> intensity message</span>
        <span>•</span>
        <span><strong>/reveal</strong> target message</span>
        <span>•</span>
        <span><strong>/paradox</strong> severity message</span>
        <span>•</span>
        <span style={{ color: '#9ca3af' }}>↑↓ for history</span>
      </div>
    </form>
  );
};

export default DirectorCommandInput;
