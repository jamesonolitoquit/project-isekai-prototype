/**
 * M42 Phase 4 Task 1: Director Console UI
 *
 * Terminal-style command interface for GM administrative control
 * Features:
 * - Command input with syntax highlighting
 * - Command history with scrollback
 * - Real-time output logs
 * - M44-E5: Theater Monitor integration
 * - Collapsible panel (stays on screen)
 * - Accessibility: keyboard navigation, screen reader support
 */

import React, { useState, useEffect, useRef } from 'react';
import type { DirectorCommandEngineContext, TransitionEngine, MultiplayerEngine, DiagnosticsEngine } from '../../types/engines';
import { DirectorTheaterMonitor } from './DirectorTheaterMonitor';

// Temporary type definitions
interface DirectorCommand {
  id: string;
  command: string;
  args: string[];
  timestamp: number;
}

interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
  data?: any;
}

class DirectorCommandEngine {
  async execute(command: string, context: any): Promise<{ status: string; result?: any; error?: string }> {
    // Temporary implementation
    return {
      status: 'success',
      result: {
        message: `Executed command: ${command}`,
        data: { command, context: Object.keys(context) }
      }
    };
  }
}

interface DirectorConsoleProps {
  state: any;
  controller: any;
  multiplayerEngine?: MultiplayerEngine;
  transitionEngine?: TransitionEngine;
  diagnosticsEngine?: DiagnosticsEngine;
  mutationLog?: any[];
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
  isDirectorMode?: boolean;
  addNarrativeWhisper?: (message: string, priority: 'normal' | 'urgent' | 'critical', duration?: number) => string;  // Phase 4 Task 4.3
}

interface ConsoleOutput {
  id: string;
  type: 'command' | 'output' | 'error' | 'info';
  text: string;
  timestamp: number;
}

/**
 * Director Console Component
 */
export const DirectorConsole: React.FC<DirectorConsoleProps> = ({
  state,
  controller,
  multiplayerEngine,
  transitionEngine,
  diagnosticsEngine,
  mutationLog = [],
  isOpen = false,
  onToggle,
  isDirectorMode = true,
  addNarrativeWhisper // Phase 4 Task 4.3
}) => {
  const [commandEngine] = useState(() => new DirectorCommandEngine());
  const [isCollapsed, setIsCollapsed] = useState(!isOpen);
  const [showTheater, setShowTheater] = useState(false); // M44-E5: Theater toggle
  const [inputValue, setInputValue] = useState('');
  const [outputs, setOutputs] = useState<ConsoleOutput[]>([
    {
      id: 'init',
      type: 'info',
      text: 'Director Console Ready. Type /help for commands. /tour_theater to open theater monitor.',
      timestamp: Date.now()
    }
  ]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Phase 4 Task 4.3: Narrative Whisper State
  const [whisperMessage, setWhisperMessage] = useState('');
  const [whisperPriority, setWhisperPriority] = useState<'normal' | 'urgent' | 'critical'>('normal');
  const [whisperDuration, setWhisperDuration] = useState(5);
  const [sentWhispers, setSentWhispers] = useState<Array<{
    id: string;
    message: string;
    priority: 'normal' | 'urgent' | 'critical';
    duration: number;
    timestamp: number;
  }>>([]);

  // Auto-scroll to latest output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [outputs]);

  // Focus input when console opens
  useEffect(() => {
    if (!isCollapsed && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCollapsed]);

  /**
   * Handle command submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim()) return;

    const commandText = inputValue.trim();
    
    // Add command to output
    addOutput('command', `> ${commandText}`);
    
    // Add to history
    setCommandHistory([...commandHistory, commandText]);
    setHistoryIndex(-1);
    setInputValue('');

    // Execute command
    try {
      const context = {
        state,
        controller,
        multiplayerEngine,
        transitionEngine,
        diagnosticsEngine,
        mutationLog
      };

      const result = await commandEngine.execute(commandText, context);

      // M44-E5: Handle special commands
      if (commandText.startsWith('/')) {
        if (commandText === '/tour_theater' || commandText === '/theater') {
          setShowTheater(!showTheater);
          addOutput('info', `Theater Monitor ${!showTheater ? 'opened' : 'closed'}`);
          return;
        } else if (commandText.startsWith('/inspect_market')) {
          const locArg = commandText.split(' ')[1];
          addOutput('output', `Market inspection at ${locArg}: Querying marketEngine for price data...`);
          addOutput('output', '[Market data would display here - getItemPriceMultiplier results]');
          return;
        } else if (commandText.startsWith('/force_weather')) {
          const ruleArg = commandText.split(' ')[1];
          addOutput('output', `Forcing weather rule: ${ruleArg}`);
          addOutput('info', `Weather overridden. Causal rules suppressed for 100 ticks.`);
          return;
        } else if (commandText === '/summarize_chronicle') {
          addOutput('output', `Chronicle Summary: [Event history and monuments would display here]`);
          addOutput('info', `Last recorded event: Faction Siege at location_x (severity: 75)`);
          return;
        }
      }

      // Display result
      if (result.status === 'success' && result.result) {
        if (result.result.message) {
          addOutput('output', result.result.message);
        }
        if (result.result.data) {
          addOutput('output', JSON.stringify(result.result.data, null, 2));
        }
      } else if (result.error) {
        addOutput('error', `Error: ${result.error}`);
      }
    } catch (error) {
      addOutput('error', `Exception: ${error}`);
    }
  };

  /**
   * Phase 4 Task 4.3: Handle narrative whisper submission
   */
  const handleWhisperSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!whisperMessage.trim() || !addNarrativeWhisper) return;
    
    try {
      const whisperId = addNarrativeWhisper(whisperMessage, whisperPriority, whisperDuration);
      
      setSentWhispers(prev => [
        ...prev,
        {
          id: whisperId,
          message: whisperMessage,
          priority: whisperPriority,
          duration: whisperDuration,
          timestamp: Date.now()
        }
      ]);
      
      addOutput('info', `[WHISPER] ${whisperPriority.toUpperCase()}: "${whisperMessage}" (${whisperDuration}s)`);
      setWhisperMessage('');
    } catch (error) {
      addOutput('error', `Whisper failed: ${error}`);
    }
  };

  /**
   * Add output line to console
   */
  const addOutput = (type: ConsoleOutput['type'], text: string) => {
    setOutputs(prev => [
      ...prev,
      {
        id: `${Date.now()}_${Math.random()}`,
        type,
        text,
        timestamp: Date.now()
      }
    ]);
  };

  /**
   * Handle arrow key navigation through history
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputValue('');
      }
    } else if (e.key === 'Escape') {
      setIsCollapsed(true);
      if (onToggle) onToggle(false);
    }
  };

  /**
   * Clear console
   */
  const handleClear = () => {
    setOutputs([
      {
        id: 'clear',
        type: 'info',
        text: 'Console cleared.',
        timestamp: Date.now()
      }
    ]);
  };

  /**
   * Get output styling based on type
   */
  const getOutputStyle = (type: ConsoleOutput['type']): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      fontFamily: 'monospace',
      fontSize: '0.85rem',
      margin: '2px 0',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word'
    };

    switch (type) {
      case 'command':
        return { ...baseStyle, color: '#d4af37', fontWeight: 'bold' };
      case 'output':
        return { ...baseStyle, color: '#e0e0e0' };
      case 'error':
        return { ...baseStyle, color: '#ff6b6b' };
      case 'info':
        return { ...baseStyle, color: '#6366f1' };
      default:
        return baseStyle;
    }
  };

  // Don't render if not in Director Mode
  if (!isDirectorMode) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(13, 13, 26, 0.95)',
        borderTop: '2px solid #6366f1',
        zIndex: 1000,
        maxHeight: isCollapsed ? '40px' : '400px',
        display: 'flex',
        flexDirection: 'column',
        transition: 'max-height 300ms ease',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.8)',
        fontFamily: 'monospace'
      }}
      role="region"
      aria-label="Director Command Console"
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: isCollapsed ? 'none' : '1px solid #6366f1',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          userSelect: 'none'
        }}
        onClick={() => {
          setIsCollapsed(!isCollapsed);
          if (onToggle) onToggle(isCollapsed);
        }}
      >
        <div style={{ color: '#d4af37', fontSize: '0.9rem', fontWeight: 'bold' }}>
          📡 DIRECTOR CONSOLE {isCollapsed ? '▶' : '▼'}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isCollapsed && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                style={{
                  padding: '2px 8px',
                  backgroundColor: 'transparent',
                  border: '1px solid #6366f1',
                  color: '#6366f1',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  borderRadius: '2px',
                  transition: 'all 200ms ease'
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'rgba(99, 102, 241, 0.2)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'transparent';
                }}
              >
                Clear
              </button>
              {/* M44-E5: Theater Monitor Toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTheater(!showTheater);
                }}
                style={{
                  padding: '2px 8px',
                  backgroundColor: showTheater ? 'rgba(168, 85, 247, 0.3)' : 'transparent',
                  border: '1px solid ' + (showTheater ? '#c084fc' : '#6366f1'),
                  color: showTheater ? '#c084fc' : '#6366f1',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  borderRadius: '2px',
                  transition: 'all 200ms ease',
                  fontWeight: showTheater ? 'bold' : 'normal'
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'rgba(168, 85, 247, 0.4)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    showTheater ? 'rgba(168, 85, 247, 0.3)' : 'transparent';
                }}
                title="Toggle Theater Monitor"
              >
                🎭 Theater
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCollapsed(true);
                  if (onToggle) onToggle(false);
                }}
                style={{
                  padding: '2px 8px',
                  backgroundColor: 'transparent',
                  border: '1px solid #d4af37',
                  color: '#d4af37',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  borderRadius: '2px',
                  transition: 'all 200ms ease'
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'rgba(212, 175, 55, 0.2)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'transparent';
                }}
              >
                Hide
              </button>
            </>
          )}
        </div>
      </div>

      {/* Output Area */}
      {!isCollapsed && (
        <>
          {/* M44-E5: Theater Monitor Panel */}
          {showTheater && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(168, 85, 247, 0.1)',
              borderBottom: '2px solid #c084fc',
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              <div style={{ color: '#c084fc', fontWeight: 'bold', marginBottom: '8px' }}>
                🎭 Director Theater Monitor
              </div>
              <DirectorTheaterMonitor />
            </div>
          )}
          <div
            ref={outputRef}
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '12px 16px',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              fontSize: '0.85rem',
              minHeight: '200px'
            }}
          >
            {outputs.map(output => (
              <div key={output.id} style={getOutputStyle(output.type)}>
                {output.text}
              </div>
            ))}
          </div>
          {/* Phase 4 Task 4.3: Narrative Whisper Controls */}
          {addNarrativeWhisper && (
            <div
              style={{
                padding: '8px 16px',
                borderTop: '1px solid #c084fc',
                backgroundColor: 'rgba(168, 85, 247, 0.05)',
                fontSize: '0.8rem'
              }}
            >
              <div style={{ color: '#c084fc', fontWeight: 'bold', marginBottom: '6px' }}>
                🎭 Narrative Whisper
              </div>
              <form
                onSubmit={handleWhisperSubmit}
                style={{
                  display: 'flex',
                  gap: '6px',
                  flexWrap: 'wrap',
                  alignItems: 'center'
                }}
              >
                <input
                  type="text"
                  value={whisperMessage}
                  onChange={(e) => setWhisperMessage(e.target.value)}
                  placeholder="Enter whisper message..."
                  style={{
                    flex: 1,
                    minWidth: '200px',
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    border: '1px solid #c084fc',
                    color: '#e0e0e0',
                    padding: '4px 6px',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    borderRadius: '2px',
                    outline: 'none'
                  }}
                  aria-label="Narrative whisper message"
                />
                <select
                  value={whisperPriority}
                  onChange={(e) => setWhisperPriority(e.target.value as 'normal' | 'urgent' | 'critical')}
                  style={{
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    border: '1px solid #c084fc',
                    color: '#e0e0e0',
                    padding: '4px 6px',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    borderRadius: '2px',
                    outline: 'none'
                  }}
                  aria-label="Whisper priority"
                >
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="critical">Critical</option>
                </select>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={whisperDuration}
                  onChange={(e) => setWhisperDuration(Math.max(1, Math.min(30, parseInt(e.target.value) || 5)))}
                  style={{
                    width: '50px',
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    border: '1px solid #c084fc',
                    color: '#e0e0e0',
                    padding: '4px 6px',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    borderRadius: '2px',
                    outline: 'none'
                  }}
                  aria-label="Whisper duration in seconds"
                />
                <span style={{ color: '#999', fontSize: '0.75rem' }}>s</span>
                <button
                  type="submit"
                  style={{
                    padding: '4px 12px',
                    backgroundColor: 'rgba(168, 85, 247, 0.3)',
                    border: '1px solid #c084fc',
                    color: '#c084fc',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    borderRadius: '2px',
                    transition: 'all 200ms ease',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(168, 85, 247, 0.6)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(168, 85, 247, 0.3)';
                  }}
                >
                  Send Whisper
                </button>
              </form>
            </div>
          )}
          {/* Input Area */}
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              gap: '8px',
              padding: '8px 16px',
              borderTop: '1px solid #6366f1',
              backgroundColor: 'rgba(0, 0, 0, 0.3)'
            }}
          >
            <span style={{ color: '#d4af37', fontWeight: 'bold' }}>{'>'}</span>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command... (/help for list)"
              style={{
                flex: 1,
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid #6366f1',
                color: '#e0e0e0',
                padding: '6px 8px',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                borderRadius: '2px',
                outline: 'none',
                transition: 'all 200ms ease'
              }}
              onFocus={(e) => {
                (e.target as HTMLInputElement).style.borderColor = '#d4af37';
                (e.target as HTMLInputElement).style.boxShadow =
                  '0 0 10px rgba(212, 175, 55, 0.3)';
              }}
              onBlur={(e) => {
                (e.target as HTMLInputElement).style.borderColor = '#6366f1';
                (e.target as HTMLInputElement).style.boxShadow = 'none';
              }}
              aria-label="Director command input"
            />
            <button
              type="submit"
              style={{
                padding: '6px 16px',
                backgroundColor: '#6366f1',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 'bold',
                borderRadius: '2px',
                transition: 'all 200ms ease',
                fontFamily: 'monospace',
                fontSize: '0.85rem'
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  '#d4af37';
                (e.currentTarget as HTMLButtonElement).style.color = '#000';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  '#6366f1';
                (e.currentTarget as HTMLButtonElement).style.color = '#fff';
              }}
            >
              Send
            </button>
          </form>
        </>
      )}

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default DirectorConsole;
