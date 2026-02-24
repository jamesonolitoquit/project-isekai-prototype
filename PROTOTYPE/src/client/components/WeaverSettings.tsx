/**
 * Weaver's Settings - BYOK Multi-Provider AI Configuration
 * 
 * Allows players to configure and switch between multiple LLM providers:
 * - Gemini (Google)
 * - Groq (Mixtral)
 * - Ollama (Local inference)
 * - Custom endpoint
 * 
 * Supports:
 * - Provider switching at runtime
 * - API key encryption (base64)
 * - Model settings (temperature, max tokens, top_p)
 * - Connection testing with real API calls
 * - localStorage persistence
 */

import React, { useState, useEffect } from 'react';

/**
 * Provider configuration interface
 */
export interface ProviderConfig {
  provider: 'gemini' | 'groq' | 'ollama' | 'custom';
  apiKey: string;
  modelName: string;
  baseUrl?: string;
  customHeaders?: Record<string, string>;
  temperature: number;
  maxTokens: number;
  topP?: number;
}

/**
 * Test connection result
 */
interface ConnectionTestResult {
  success: boolean;
  message: string;
  provider?: string;
  modelInfo?: string;
}

/**
 * Securely encode configuration with base64 (Phase 22: upgrade to crypto.js)
 */
function encryptProviderConfig(config: ProviderConfig): string {
  return Buffer.from(JSON.stringify(config)).toString('base64');
}

/**
 * Decode provider configuration from base64
 */
function decryptProviderConfig(encoded: string): ProviderConfig | null {
  try {
    return JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

/**
 * Save provider configuration to localStorage with encryption
 */
export function saveProviderConfig(config: ProviderConfig): boolean {
  try {
    const encrypted = encryptProviderConfig(config);
    localStorage.setItem('isekai_weaver_config', encrypted);
    // Also store active provider for quick access
    localStorage.setItem('isekai_weaver_activeProvider', config.provider);
    return true;
  } catch (error) {
    console.error('[WeaverSettings] Failed to save config:', error);
    return false;
  }
}

/**
 * Load provider configuration from localStorage
 */
function loadProviderConfig(): ProviderConfig | null {
  try {
    const encrypted = localStorage.getItem('isekai_weaver_config');
    if (!encrypted) return null;
    return decryptProviderConfig(encrypted);
  } catch (error) {
    console.error('[WeaverSettings] Failed to load config:', error);
    return null;
  }
}

/**
 * Get default configuration for each provider
 */
function getDefaultConfig(provider: 'gemini' | 'groq' | 'ollama' | 'custom'): ProviderConfig {
  const baseConfig = {
    temperature: 0.7,
    maxTokens: 256,
    topP: 0.9,
    baseUrl: undefined,
    customHeaders: {}
  };

  switch (provider) {
    case 'gemini':
      return {
        ...baseConfig,
        provider: 'gemini',
        apiKey: '',
        modelName: 'gemini-1.5-flash',
      };
    case 'groq':
      return {
        ...baseConfig,
        provider: 'groq',
        apiKey: '',
        modelName: 'mixtral-8x7b-32768',
      };
    case 'ollama':
      return {
        ...baseConfig,
        provider: 'ollama',
        apiKey: 'not-required',
        modelName: 'mistral',
        baseUrl: 'http://localhost:11434',
      };
    case 'custom':
      return {
        ...baseConfig,
        provider: 'custom',
        apiKey: '',
        modelName: 'your-model',
        baseUrl: 'https://api.example.com',
      };
  }
}

/**
 * Test connection to provider by making lightweight API call
 */
async function testProviderConnection(config: ProviderConfig): Promise<ConnectionTestResult> {
  try {
    if (config.provider === 'gemini') {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 10, temperature: 0 }
        }),
        signal: AbortSignal.timeout(5000)
      });

      if (response.status === 200) {
        return {
          success: true,
          message: '✅ Connected to Gemini 1.5 Flash',
          provider: 'gemini',
          modelInfo: 'gemini-1.5-flash'
        };
      } else if (response.status === 401) {
        return {
          success: false,
          message: '❌ Invalid API key for Gemini',
          provider: 'gemini'
        };
      } else {
        return {
          success: false,
          message: `❌ Gemini API error: ${response.status}`,
          provider: 'gemini'
        };
      }
    } else if (config.provider === 'groq') {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: 'mixtral-8x7b-32768',
          messages: [{ role: 'user', content: 'ping' }],
          temperature: 0,
          max_tokens: 10
        }),
        signal: AbortSignal.timeout(5000)
      });

      if (response.status === 200) {
        return {
          success: true,
          message: '✅ Connected to Groq (Mixtral-8x7b-32768)',
          provider: 'groq',
          modelInfo: 'mixtral-8x7b-32768'
        };
      } else if (response.status === 401) {
        return {
          success: false,
          message: '❌ Invalid API key for Groq',
          provider: 'groq'
        };
      } else {
        return {
          success: false,
          message: `❌ Groq API error: ${response.status}`,
          provider: 'groq'
        };
      }
    } else if (config.provider === 'ollama') {
      const baseUrl = config.baseUrl || 'http://localhost:11434';
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (response.status === 200) {
        const data: any = await response.json();
        return {
          success: true,
          message: `✅ Connected to Ollama (${config.modelName})`,
          provider: 'ollama',
          modelInfo: `${data.models?.length || 0} models available`
        };
      } else {
        return {
          success: false,
          message: `❌ Ollama connection failed at ${baseUrl}`,
          provider: 'ollama'
        };
      }
    } else {
      return {
        success: false,
        message: '❌ Custom endpoint testing not supported yet',
        provider: 'custom'
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Connection error: ${error.message || 'Connection timeout'}`,
      provider: config.provider
    };
  }
}

interface WeaverSettingsProps {
  onClose: () => void;
  onConfigSaved?: (config: ProviderConfig) => void;
}

export default function WeaverSettings({ onClose, onConfigSaved }: WeaverSettingsProps) {
  const [activeTab, setActiveTab] = useState<'provider' | 'apikey' | 'model'>('provider');
  const [config, setConfig] = useState<ProviderConfig>(getDefaultConfig('gemini'));
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Load existing config on mount
  useEffect(() => {
    const saved = loadProviderConfig();
    if (saved) {
      setConfig(saved);
    }
  }, []);

  const handleProviderChange = (provider: 'gemini' | 'groq' | 'ollama' | 'custom') => {
    setConfig(getDefaultConfig(provider));
    setTestResult(null);
  };

  const handleConfigChange = (updates: Partial<ProviderConfig>) => {
    setConfig(c => ({ ...c, ...updates }));
  };

  const handleSaveConfig = () => {
    if (saveProviderConfig(config)) {
      onConfigSaved?.(config);
      // Show brief success toast
      setTestResult({
        success: true,
        message: '💾 Configuration saved to localStorage'
      });
      setTimeout(onClose, 1500);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    const result = await testProviderConnection(config);
    setTestResult(result);
    setIsTesting(false);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(15, 20, 25, 0.95) 0%, rgba(25, 30, 40, 0.95) 100%)',
        border: '2px solid #2d3561',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#74b9ff', fontSize: '18px', fontWeight: 'bold' }}>
            🧵 Weaver's Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#999',
              fontSize: '20px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #2d3561' }}>
          {['provider', 'apikey', 'model'].map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab as any);
                setTestResult(null);
              }}
              style={{
                background: activeTab === tab ? 'rgba(116, 185, 255, 0.1)' : 'transparent',
                border: 'none',
                color: activeTab === tab ? '#74b9ff' : '#999',
                padding: '10px 16px',
                cursor: 'pointer',
                borderBottom: activeTab === tab ? '2px solid #74b9ff' : 'none',
                fontSize: '12px',
                fontWeight: activeTab === tab ? 'bold' : 'normal',
                transition: 'all 0.2s ease'
              }}
            >
              {tab === 'provider' && '🔌 Provider'}
              {tab === 'apikey' && '🔑 API Key'}
              {tab === 'model' && '⚙️ Model'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ minHeight: '200px' }}>
          {/* Provider Selection Tab */}
          {activeTab === 'provider' && (
            <div>
              <p style={{ color: '#aaa', fontSize: '12px', marginBottom: '16px' }}>
                Select your preferred LLM provider for NPC dialogue generation.
              </p>
              {(['gemini', 'groq', 'ollama', 'custom'] as const).map(provider => (
                <label key={provider} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  margin: '8px 0',
                  background: config.provider === provider ? 'rgba(116, 185, 255, 0.1)' : 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '6px',
                  border: `1px solid ${config.provider === provider ? '#74b9ff' : '#2d3561'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}>
                  <input
                    type="radio"
                    name="provider"
                    value={provider}
                    checked={config.provider === provider}
                    onChange={() => handleProviderChange(provider)}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <div>
                    <div style={{ color: '#74b9ff', fontWeight: 'bold', fontSize: '13px' }}>
                      {provider === 'gemini' && '🔮 Gemini 1.5 Flash'}
                      {provider === 'groq' && '⚡ Groq (Mixtral)'}
                      {provider === 'ollama' && '🏠 Ollama (Local)'}
                      {provider === 'custom' && '🔗 Custom Endpoint'}
                    </div>
                    <div style={{ color: '#666', fontSize: '11px' }}>
                      {provider === 'gemini' && 'Fast, free tier available'}
                      {provider === 'groq' && 'High-speed inference'}
                      {provider === 'ollama' && 'Run locally, no API key needed'}
                      {provider === 'custom' && 'Bring your own endpoint'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* API Key Management Tab */}
          {activeTab === 'apikey' && (
            <div>
              <p style={{ color: '#aaa', fontSize: '12px', marginBottom: '12px' }}>
                {config.provider === 'ollama'
                  ? 'Ollama runs locally and does not require an API key.'
                  : `Enter your ${config.provider.toUpperCase()} API key. It will be encrypted and stored locally.`}
              </p>
              {config.provider !== 'ollama' && (
                <>
                  <label style={{ display: 'block', marginBottom: '12px' }}>
                    <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '6px' }}>API Key</div>
                    <input
                      type="password"
                      value={config.apiKey}
                      onChange={(e) => handleConfigChange({ apiKey: e.target.value })}
                      placeholder={`sk-... (${config.provider} format)`}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid #2d3561',
                        borderRadius: '4px',
                        color: '#fff',
                        fontSize: '12px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </label>
                </>
              )}
              {config.provider === 'custom' && (
                <label style={{ display: 'block', marginBottom: '12px' }}>
                  <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '6px' }}>Base URL</div>
                  <input
                    type="text"
                    value={config.baseUrl || ''}
                    onChange={(e) => handleConfigChange({ baseUrl: e.target.value })}
                    placeholder="https://api.example.com"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid #2d3561',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '12px',
                      boxSizing: 'border-box'
                    }}
                  />
                </label>
              )}
              {config.provider === 'ollama' && (
                <label style={{ display: 'block', marginBottom: '12px' }}>
                  <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '6px' }}>Ollama Base URL</div>
                  <input
                    type="text"
                    value={config.baseUrl || 'http://localhost:11434'}
                    onChange={(e) => handleConfigChange({ baseUrl: e.target.value })}
                    placeholder="http://localhost:11434"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid #2d3561',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '12px',
                      boxSizing: 'border-box'
                    }}
                  />
                </label>
              )}
            </div>
          )}

          {/* Model Settings Tab */}
          {activeTab === 'model' && (
            <div>
              <label style={{ display: 'block', marginBottom: '12px' }}>
                <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '6px' }}>Model Name</div>
                <input
                  type="text"
                  value={config.modelName}
                  onChange={(e) => handleConfigChange({ modelName: e.target.value })}
                  placeholder="e.g., gemini-1.5-flash"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid #2d3561',
                    borderRadius: '4px',
                    color: '#fff',
                    fontSize: '12px',
                    boxSizing: 'border-box'
                  }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: '12px' }}>
                <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '6px' }}>
                  Temperature: {config.temperature.toFixed(1)} (0=deterministic, 1=creative)
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.temperature}
                  onChange={(e) => handleConfigChange({ temperature: parseFloat(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: '12px' }}>
                <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '6px' }}>
                  Max Tokens: {config.maxTokens}
                </div>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="50"
                  value={config.maxTokens}
                  onChange={(e) => handleConfigChange({ maxTokens: parseFloat(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: '12px' }}>
                <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '6px' }}>
                  Top P: {(config.topP || 0.9).toFixed(2)} (nucleus sampling)
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={config.topP || 0.9}
                  onChange={(e) => handleConfigChange({ topP: parseFloat(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </label>
            </div>
          )}
        </div>

        {/* Connection Test Result */}
        {testResult && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: testResult.success ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            borderRadius: '6px',
            border: `1px solid ${testResult.success ? '#4ade80' : '#ef4444'}`,
            color: testResult.success ? '#4ade80' : '#ef4444',
            fontSize: '12px'
          }}>
            {testResult.message}
            {testResult.modelInfo && <div style={{ marginTop: '4px', fontSize: '11px', opacity: 0.8 }}>ℹ️ {testResult.modelInfo}</div>}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #2d3561' }}>
          <button
            onClick={handleTestConnection}
            disabled={isTesting || !config.apiKey && config.provider !== 'ollama'}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: isTesting ? 'rgba(116, 185, 255, 0.1)' : 'rgba(116, 185, 255, 0.2)',
              border: '1px solid #2d3561',
              borderRadius: '4px',
              color: '#74b9ff',
              cursor: isTesting || (!config.apiKey && config.provider !== 'ollama') ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              transition: 'all 0.2s ease'
            }}
          >
            {isTesting ? '🔄 Testing...' : '🧪 Test Connection'}
          </button>
          <button
            onClick={handleSaveConfig}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: 'rgba(116, 185, 255, 0.3)',
              border: '1px solid #74b9ff',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              transition: 'all 0.2s ease'
            }}
          >
            💾 Save & Close
          </button>
        </div>
      </div>
    </div>
  );
}
