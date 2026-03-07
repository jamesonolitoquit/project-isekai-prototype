import React, { useState, useEffect } from 'react';
import { useNarrativeCodec } from '../hooks/useNarrativeCodec';
import type { NarrativeCodec } from '../services/themeManager';

/**
 * M55-D1: WeaverSettings Component
 * 
 * Purpose: BYOK (Bring Your Own Key) UI for M55 multi-provider LLM support
 * Allows players to input and store API keys locally (never in global state)
 * 
 * Supported Providers:
 * - Gemini: Google Generative AI (free tier available)
 * - Groq: Fast cloud inference with Llama 3
 * - Ollama: Local inference (requires Ollama running)
 * 
 * Features:
 * - Input fields for API keys (password-masked)
 * - Test connection to each provider
 * - Key validation before storage
 * - Clear/reset functionality
 * - localStorage-only persistence (no state export)
 */
export interface WeaverSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onApply?: () => void;
}

export const WeaverSettings: React.FC<WeaverSettingsProps> = ({ isOpen, onClose, onApply }) => {
  const [activeTab, setActiveTab] = useState<'ai' | 'theme'>('ai');
  const { currentCodec, setCodec, getAllCodecs, codecDefinition } = useNarrativeCodec();
  
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  
  const [geminiStatus, setGeminiStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [groqStatus, setGroqStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [ollamaStatus, setOllamaStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  
  const [statusMessages, setStatusMessages] = useState<Record<string, string>>({});

  // Load keys from localStorage on component mount
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const savedGemini = localStorage.getItem('gemini_api_key');
      const savedGroq = localStorage.getItem('groq_api_key');
      const savedOllama = localStorage.getItem('ollama_base_url');
      
      if (savedGemini) setGeminiKey(savedGemini);
      if (savedGroq) setGroqKey(savedGroq);
      if (savedOllama) setOllamaUrl(savedOllama);
    }
  }, [isOpen]);

  const saveKeysToLocalStorage = () => {
    if (typeof localStorage === 'undefined') return;
    
    if (geminiKey) {
      localStorage.setItem('gemini_api_key', geminiKey);
    }
    if (groqKey) {
      localStorage.setItem('groq_api_key', groqKey);
    }
    if (ollamaUrl) {
      localStorage.setItem('ollama_base_url', ollamaUrl);
    }
    
    // Notify that settings were applied
    if (onApply) {
      onApply();
    }
  };

  const clearAllKeys = () => {
    if (typeof localStorage === 'undefined') return;
    
    localStorage.removeItem('gemini_api_key');
    localStorage.removeItem('groq_api_key');
    localStorage.removeItem('ollama_base_url');
    
    setGeminiKey('');
    setGroqKey('');
    setOllamaUrl('http://localhost:11434');
    
    setStatusMessages({
      ...statusMessages,
      clear: 'All keys cleared from localStorage.'
    });
  };

  /**
   * Test Gemini API connection
   */
  const testGemini = async () => {
    if (!geminiKey) {
      setStatusMessages({ ...statusMessages, gemini: 'Please enter a Gemini API key.' });
      return;
    }

    setGeminiStatus('testing');
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Hello, Weaver.' }] }],
            generationConfig: { maxOutputTokens: 10 }
          })
        }
      );

      if (response.ok) {
        setGeminiStatus('success');
        setStatusMessages({ ...statusMessages, gemini: '✓ Gemini connection successful!' });
      } else {
        setGeminiStatus('error');
        const errorData = await response.json();
        setStatusMessages({
          ...statusMessages,
          gemini: `✗ Gemini error: ${errorData?.error?.message || response.statusText}`
        });
      }
    } catch (error) {
      setGeminiStatus('error');
      setStatusMessages({
        ...statusMessages,
        gemini: `✗ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  /**
   * Test Groq API connection
   */
  const testGroq = async () => {
    if (!groqKey) {
      setStatusMessages({ ...statusMessages, groq: 'Please enter a Groq API key.' });
      return;
    }

    setGroqStatus('testing');
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: 'llama-3-70b-versatile',
          messages: [{ role: 'user', content: 'Hello, Weaver.' }],
          max_tokens: 10
        })
      });

      if (response.ok) {
        setGroqStatus('success');
        setStatusMessages({ ...statusMessages, groq: '✓ Groq connection successful!' });
      } else {
        setGroqStatus('error');
        const errorData = await response.json();
        setStatusMessages({
          ...statusMessages,
          groq: `✗ Groq error: ${errorData?.error?.message || response.statusText}`
        });
      }
    } catch (error) {
      setGroqStatus('error');
      setStatusMessages({
        ...statusMessages,
        groq: `✗ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  /**
   * Test Ollama connection
   */
  const testOllama = async () => {
    if (!ollamaUrl) {
      setStatusMessages({ ...statusMessages, ollama: 'Please enter an Ollama URL.' });
      return;
    }

    setOllamaStatus('testing');
    try {
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama2',
          prompt: 'Hello, Weaver.',
          stream: false,
          num_predict: 10
        })
      });

      if (response.ok) {
        setOllamaStatus('success');
        setStatusMessages({ ...statusMessages, ollama: '✓ Ollama connection successful!' });
      } else {
        setOllamaStatus('error');
        setStatusMessages({
          ...statusMessages,
          ollama: `✗ Ollama error: ${response.statusText}`
        });
      }
    } catch (error) {
      setOllamaStatus('error');
      setStatusMessages({
        ...statusMessages,
        ollama: `✗ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'var(--bg-primary, #1a1a2e)',
        border: '2px solid var(--border-accent, #16213e)',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '550px',
        maxHeight: '90vh',
        overflowY: 'auto',
        color: 'var(--text-primary, #eaeaea)',
        fontFamily: 'var(--font-family-body, monospace)',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <h2 style={{ marginTop: 0, color: 'var(--accent-main, #00d4ff)' }}>⚙️ WEAVER SETTINGS</h2>
        
        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: `2px solid var(--border-secondary, #16213e)` }}>
          <button
            onClick={() => setActiveTab('ai')}
            style={{
              flex: 1,
              padding: '10px 12px',
              backgroundColor: activeTab === 'ai' ? 'var(--accent-main, #00d4ff)' : 'transparent',
              color: activeTab === 'ai' ? '#000' : 'var(--text-secondary, #aaa)',
              border: 'none',
              borderBottom: activeTab === 'ai' ? '3px solid var(--accent-main, #00d4ff)' : 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'ai' ? 'bold' : 'normal',
              fontSize: '0.9em',
              transition: 'all 0.2s ease'
            }}
          >
            🤖 AI PROVIDERS
          </button>
          <button
            onClick={() => setActiveTab('theme')}
            style={{
              flex: 1,
              padding: '10px 12px',
              backgroundColor: activeTab === 'theme' ? 'var(--accent-main, #00d4ff)' : 'transparent',
              color: activeTab === 'theme' ? '#000' : 'var(--text-secondary, #aaa)',
              border: 'none',
              borderBottom: activeTab === 'theme' ? '3px solid var(--accent-main, #00d4ff)' : 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'theme' ? 'bold' : 'normal',
              fontSize: '0.9em',
              transition: 'all 0.2s ease'
            }}
          >
            🎨 NARRATIVE CODEC
          </button>
        </div>
        
        {activeTab === 'ai' && (
          <p style={{ fontSize: '0.9em', color: 'var(--text-secondary, #aaa)', marginBottom: '20px' }}>
            M55-D1: Configure your API keys for multi-provider LLM support. Keys are stored locally in your browser and never sent to the server.
          </p>
        )}
        
        {activeTab === 'theme' && (
          <p style={{ fontSize: '0.9em', color: 'var(--text-secondary, #aaa)', marginBottom: '20px' }}>
            Select your preferred visual lens. The world will render through your chosen narrative codec.
          </p>
        )}

        {/* AI PROVIDERS TAB */}
        {activeTab === 'ai' && (
          <div>
        
        {/* Gemini API Key */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', color: '#00d4ff', fontSize: '0.9em' }}>
            🔷 GEMINI API KEY
          </label>
          <input
            type="password"
            placeholder="AIzaSy... (from Google Cloud)"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#0f3460',
              border: `1px solid ${geminiStatus === 'success' ? '#00ff00' : geminiStatus === 'error' ? '#ff0000' : '#16213e'}`,
              color: '#eaeaea',
              borderRadius: '4px',
              fontFamily: 'monospace',
              boxSizing: 'border-box',
              marginBottom: '6px'
            }}
          />
          <button
            onClick={testGemini}
            disabled={geminiStatus === 'testing'}
            style={{
              padding: '6px 12px',
              backgroundColor: geminiStatus === 'success' ? '#00aa00' : '#0f3460',
              color: '#eaeaea',
              border: '1px solid #16213e',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.85em',
              fontWeight: 'bold'
            }}
          >
            {geminiStatus === 'testing' ? 'Testing...' : 'Test Connection'}
          </button>
          {statusMessages.gemini && (
            <p style={{ fontSize: '0.8em', color: geminiStatus === 'error' ? '#ff6666' : '#66ff66', margin: '6px 0 0 0' }}>
              {statusMessages.gemini}
            </p>
          )}
        </div>

        {/* Groq API Key */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', color: '#00d4ff', fontSize: '0.9em' }}>
            ⚡ GROQ API KEY
          </label>
          <input
            type="password"
            placeholder="gsk_... (from Groq Console)"
            value={groqKey}
            onChange={(e) => setGroqKey(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#0f3460',
              border: `1px solid ${groqStatus === 'success' ? '#00ff00' : groqStatus === 'error' ? '#ff0000' : '#16213e'}`,
              color: '#eaeaea',
              borderRadius: '4px',
              fontFamily: 'monospace',
              boxSizing: 'border-box',
              marginBottom: '6px'
            }}
          />
          <button
            onClick={testGroq}
            disabled={groqStatus === 'testing'}
            style={{
              padding: '6px 12px',
              backgroundColor: groqStatus === 'success' ? '#00aa00' : '#0f3460',
              color: '#eaeaea',
              border: '1px solid #16213e',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.85em',
              fontWeight: 'bold'
            }}
          >
            {groqStatus === 'testing' ? 'Testing...' : 'Test Connection'}
          </button>
          {statusMessages.groq && (
            <p style={{ fontSize: '0.8em', color: groqStatus === 'error' ? '#ff6666' : '#66ff66', margin: '6px 0 0 0' }}>
              {statusMessages.groq}
            </p>
          )}
        </div>

        {/* Ollama URL */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', color: '#00d4ff', fontSize: '0.9em' }}>
            🦙 OLLAMA BASE URL
          </label>
          <input
            type="text"
            placeholder="http://localhost:11434"
            value={ollamaUrl}
            onChange={(e) => setOllamaUrl(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#0f3460',
              border: `1px solid ${ollamaStatus === 'success' ? '#00ff00' : ollamaStatus === 'error' ? '#ff0000' : '#16213e'}`,
              color: '#eaeaea',
              borderRadius: '4px',
              fontFamily: 'monospace',
              boxSizing: 'border-box',
              marginBottom: '6px'
            }}
          />
          <button
            onClick={testOllama}
            disabled={ollamaStatus === 'testing'}
            style={{
              padding: '6px 12px',
              backgroundColor: ollamaStatus === 'success' ? '#00aa00' : '#0f3460',
              color: '#eaeaea',
              border: '1px solid #16213e',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.85em',
              fontWeight: 'bold'
            }}
          >
            {ollamaStatus === 'testing' ? 'Testing...' : 'Test Connection'}
          </button>
          {statusMessages.ollama && (
            <p style={{ fontSize: '0.8em', color: ollamaStatus === 'error' ? '#ff6666' : '#66ff66', margin: '6px 0 0 0' }}>
              {statusMessages.ollama}
            </p>
          )}
        </div>

        {statusMessages.clear && (
          <p style={{ fontSize: '0.8em', color: '#ffff66', margin: '12px 0' }}>
            {statusMessages.clear}
          </p>
        )}
          </div>
        )}
        
        {/* NARRATIVE CODEC TAB */}
        {activeTab === 'theme' && (
          <div>
            <p style={{ fontSize: '0.85em', color: 'var(--text-secondary, #aaa)', marginBottom: '12px', fontStyle: 'italic' }}>
              Current Codec: <span style={{ color: 'var(--accent-main)', fontWeight: 'bold' }}>{currentCodec}</span>
            </p>
            
            <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
              {getAllCodecs().map((codec: NarrativeCodec) => {
                const isSelected = codec === currentCodec;
                const codecColors = {
                  'CODENAME_MEDIEVAL': { bg: '#2a2416', accent: '#d4af37', main: '#b8341d' },
                  'CODENAME_GLITCH': { bg: '#0a0a1a', accent: '#ff00c4', main: '#00ffc8' },
                  'CODENAME_MINIMAL': { bg: '#f5f5f5', accent: '#3498db', main: '#2ecc71' }
                };
                const colors = codecColors[codec] || { bg: '#1a1a2e', accent: '#00d4ff', main: '#ff00c4' };
                
                return (
                  <div
                    key={codec}
                    onClick={() => setCodec(codec)}
                    style={{
                      padding: '14px',
                      backgroundColor: isSelected ? 'rgba(255, 0, 196, 0.1)' : 'var(--bg-secondary, #0f3460)',
                      border: `2px solid ${isSelected ? 'var(--accent-main, #ff00c4)' : 'var(--border-secondary, #16213e)'}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      transform: isSelected ? 'translateX(4px)' : 'translateX(0)',
                      boxShadow: isSelected ? 'var(--shadow-md)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', color: 'var(--accent-main, #00d4ff)', marginBottom: '4px' }}>
                          {codec === 'CODENAME_MEDIEVAL' && '📜 Medieval'}
                          {codec === 'CODENAME_GLITCH' && '⚡ Glitch'}
                          {codec === 'CODENAME_MINIMAL' && '📋 Minimal'}
                        </div>
                        <div style={{ fontSize: '0.8em', color: 'var(--text-secondary, #aaa)' }}>
                          {codec === 'CODENAME_MEDIEVAL' && 'Parchment scrolls and mystical runes'}
                          {codec === 'CODENAME_GLITCH' && 'Void-violet synthwave, living paradox'}
                          {codec === 'CODENAME_MINIMAL' && 'Observer administrative interface'}
                        </div>
                      </div>
                      {isSelected && <span style={{ fontSize: '1.2em' }}>✓</span>}
                    </div>
                    
                    {/* Color preview */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                      <div style={{ width: '20px', height: '20px', backgroundColor: colors.bg, border: '1px solid #999', borderRadius: '2px' }} title="Primary"></div>
                      <div style={{ width: '20px', height: '20px', backgroundColor: colors.accent, border: '1px solid #999', borderRadius: '2px' }} title="Accent"></div>
                      <div style={{ width: '20px', height: '20px', backgroundColor: colors.main, border: '1px solid #999', borderRadius: '2px' }} title="Main"></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {statusMessages.clear && (
          <p style={{ fontSize: '0.8em', color: '#ffff66', margin: '12px 0' }}>
            {statusMessages.clear}
          </p>
        )}
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
          <button
            onClick={saveKeysToLocalStorage}
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: '#00aa00',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.9em'
            }}
          >
            💾 SAVE & APPLY
          </button>
          <button
            onClick={clearAllKeys}
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: '#aa0000',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.9em'
            }}
          >
            🗑️ CLEAR ALL
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: '#0f3460',
              color: '#eaeaea',
              border: '1px solid #16213e',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.9em'
            }}
          >
            ✕ CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeaverSettings;
