/**
 * M63-C: Community Mod Browser Component
 * 
 * Displays and loads curated community mods:
 * - JSON legendaries (custom artifact definitions)
 * - NPC templates (character profiles + schedules)
 * - Event definitions (custom macro events)
 * - One-click loading with validation
 */

import React, { useState } from 'react';

/**
 * Community mod types
 */
export type ModCategory = 'legendary' | 'npc' | 'event' | 'world';

/**
 * Mod metadata
 */
export interface CommunityMod {
  id: string;
  name: string;
  category: ModCategory;
  creator: string;
  creatorRank: number;  // 0-5 mythic rank
  version: string;
  releaseDate: string;
  description: string;
  downloads: number;
  rating: number;  // 0-5 stars
  reviews: number;
  tags: string[];
  content: {
    type: ModCategory;
    data: Record<string, any>;  // JSON legendary/NPC/event definition
  };
  requirements?: {
    minTutorialTier?: number;
    minMythRank?: number;
    factionRequired?: string;
  };
  previewImage?: string;  // Base64
}

/**
 * Individual Mod Card Component
 */
export interface ModCardProps {
  mod: CommunityMod;
  onLoad: (mod: CommunityMod) => void;
  isLoading?: boolean;
  isInstalled?: boolean;
}

export const ModCard: React.FC<ModCardProps> = ({
  mod,
  onLoad,
  isLoading = false,
  isInstalled = false
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const cardStyle: React.CSSProperties = {
    border: '1px solid #444',
    borderRadius: '8px',
    padding: '12px',
    backgroundColor: '#1a1a2e',
    marginBottom: '12px',
    transition: 'all 0.2s ease'
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px'
  };

  const titleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const categoryBadgeColors: Record<ModCategory, string> = {
    legendary: '#FFD700',
    npc: '#4ECDC4',
    event: '#FF6B6B',
    world: '#95E1D3'
  };

  const categoryIcons: Record<ModCategory, string> = {
    legendary: '⚔️',
    npc: '👤',
    event: '🎭',
    world: '🌍'
  };

  const getBadgeColor = (category: ModCategory) => categoryBadgeColors[category];
  const getBadgeIcon = (category: ModCategory) => categoryIcons[category];

  const ratingStars = '★'.repeat(Math.floor(mod.rating)) + 
    '☆'.repeat(5 - Math.floor(mod.rating));

  const metaStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '12px',
    color: '#aaa',
    marginBottom: '8px'
  };

  const creatorRankColors = ['#888', '#fff', '#FFD700', '#FF6B6B', '#FF69B4', '#00FFFF'];
  const creatorRankLabels = ['Forgotten', 'Known', 'Remembered', 'Notable', 'Legendary', 'Mythic'];

  const descriptionStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#ccc',
    marginBottom: '8px',
    lineHeight: '1.4'
  };

  const tagsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '6px',
    marginBottom: '8px',
    flexWrap: 'wrap'
  };

  const tagStyle: React.CSSProperties = {
    fontSize: '10px',
    padding: '3px 8px',
    backgroundColor: '#0f0f1e',
    border: '1px solid #444',
    borderRadius: '3px',
    color: '#aaa'
  };

  const requirementsStyle: React.CSSProperties = {
    fontSize: '10px',
    color: '#FF6B6B',
    marginBottom: '8px',
    padding: '6px',
    backgroundColor: '#2a0a0a',
    borderRadius: '4px',
    borderLeft: '3px solid #FF6B6B'
  };

  const buttonGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginTop: '8px'
  };

  const buttonStyle = (color: string, disabled: boolean = false): React.CSSProperties => ({
    flex: 1,
    padding: '8px 12px',
    fontSize: '12px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: color,
    color: '#000',
    fontWeight: 'bold',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'opacity 0.2s ease'
  });

  return (
    <div
      style={cardStyle}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = getBadgeColor(mod.category);
        (e.currentTarget as HTMLDivElement).style.backgroundColor = '#1f1f3a';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#444';
        (e.currentTarget as HTMLDivElement).style.backgroundColor = '#1a1a2e';
      }}
    >
      {/* Header: Category Badge + Title + Stats */}
      <div style={headerStyle}>
        <div style={titleStyle}>
          <span
            style={{
              fontSize: '16px',
              color: getBadgeColor(mod.category)
            }}
          >
            {getBadgeIcon(mod.category)}
          </span>
          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>
            {mod.name}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span style={{ fontSize: '12px', color: '#FFD700' }}>
            {ratingStars}
          </span>
          <span style={{ fontSize: '10px', color: '#888' }}>
            ({mod.reviews})
          </span>
        </div>
      </div>

      {/* Metadata: Creator, Version, Downloads */}
      <div style={metaStyle}>
        <span
          style={{
            color: creatorRankColors[mod.creatorRank] || '#888'
          }}
        >
          By {mod.creator} [{creatorRankLabels[mod.creatorRank] || 'Unknown'}]
        </span>
        <span>v{mod.version}</span>
        <span>📥 {mod.downloads.toLocaleString()}</span>
      </div>

      {/* Description */}
      <div style={descriptionStyle}>
        {mod.description}
      </div>

      {/* Tags */}
      {mod.tags.length > 0 && (
        <div style={tagsStyle}>
          {mod.tags.map((tag, idx) => (
            <div key={idx} style={tagStyle}>
              #{tag}
            </div>
          ))}
        </div>
      )}

      {/* Requirements Alert */}
      {mod.requirements && (
        <div style={requirementsStyle}>
          ⚠️ Requirements:
          {mod.requirements.minTutorialTier && ` Tier ${mod.requirements.minTutorialTier}+`}
          {mod.requirements.minMythRank && ` Myth Rank ${mod.requirements.minMythRank}+`}
          {mod.requirements.factionRequired && ` ${mod.requirements.factionRequired} required`}
        </div>
      )}

      {/* Preview Image */}
      {mod.previewImage && (
        <img
          src={mod.previewImage}
          alt={mod.name}
          style={{
            width: '100%',
            maxHeight: '120px',
            objectFit: 'cover',
            borderRadius: '4px',
            marginBottom: '8px',
            cursor: 'pointer'
          }}
          onClick={() => setShowDetails(!showDetails)}
        />
      )}

      {/* Details Toggle */}
      {showDetails && (
        <div
          style={{
            fontSize: '11px',
            backgroundColor: '#0f0f1e',
            padding: '8px',
            borderRadius: '4px',
            marginBottom: '8px',
            color: '#aaa',
            fontFamily: 'monospace',
            maxHeight: '100px',
            overflow: 'auto'
          }}
        >
          <pre style={{ margin: 0 }}>
            {JSON.stringify(mod.content.data, null, 2).substring(0, 200)}...
          </pre>
        </div>
      )}

      {/* Action Buttons */}
      <div style={buttonGroupStyle}>
        <button
          onClick={() => onLoad(mod)}
          disabled={isLoading || isInstalled}
          style={buttonStyle('#FFD700', isLoading || isInstalled)}
        >
          {isInstalled ? '✓ Installed' : isLoading ? '⏳ Loading...' : '⬇ Load'}
        </button>
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={buttonStyle('#888')}
        >
          {showDetails ? '▲ Less' : '▼ More'}
        </button>
      </div>
    </div>
  );
};

/**
 * Community Mod Browser Main Component
 */
export interface CommunityModBrowserProps {
  mods: CommunityMod[];
  installedModIds?: string[];
  onLoadMod: (mod: CommunityMod) => void;
  loading?: boolean;
}

export const CommunityModBrowser: React.FC<CommunityModBrowserProps> = ({
  mods,
  installedModIds = [],
  onLoadMod,
  loading = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ModCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<'rating' | 'downloads' | 'recent' | 'newest'>('rating');
  const [loadingModId, setLoadingModId] = useState<string | null>(null);

  const handleLoadMod = (mod: CommunityMod) => {
    setLoadingModId(mod.id);
    onLoadMod(mod);
    // In real implementation, would wait for async load to complete
    setTimeout(() => setLoadingModId(null), 2000);
  };

  // Filter mods
  const filteredMods = mods
    .filter((mod) => {
      const matchesSearch = mod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mod.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mod.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === 'all' || mod.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'downloads':
          return b.downloads - a.downloads;
        case 'recent':
          return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
        case 'newest':
          return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
        default:
          return 0;
      }
    });

  const browserStyle: React.CSSProperties = {
    backgroundColor: '#0a0a14',
    borderRadius: '8px',
    padding: '20px',
    border: '1px solid #333'
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: '20px',
    borderBottom: '1px solid #333',
    paddingBottom: '16px'
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: '12px'
  };

  const controlsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap'
  };

  const searchStyle: React.CSSProperties = {
    flex: 1,
    minWidth: '200px',
    padding: '8px 12px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #444',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '12px'
  };

  const filterStyle: React.CSSProperties = {
    padding: '8px 12px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #444',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer'
  };

  const categoryIcons: Record<ModCategory, string> = {
    legendary: '⚔️',
    npc: '👤',
    event: '🎭',
    world: '🌍'
  };

  const categoryButtons: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginTop: '12px'
  };

  const categoryBtnStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    backgroundColor: isActive ? '#FFD700' : '#1a1a2e',
    border: isActive ? 'none' : '1px solid #444',
    borderRadius: '4px',
    color: isActive ? '#000' : '#fff',
    fontSize: '11px',
    fontWeight: isActive ? 'bold' : 'normal',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  });

  const resultsStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
    gap: '16px',
    marginTop: '16px'
  };

  const statsStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#888',
    marginTop: '12px'
  };

  return (
    <div style={browserStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={titleStyle}>
          🎨 Community Mod Browser
        </div>
        <div style={statsStyle}>
          Showing {filteredMods.length} of {mods.length} mods
          {searchQuery && ` (searching for "${searchQuery}")`}
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div style={controlsStyle}>
        <input
          type="text"
          placeholder="Search mods..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={searchStyle}
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          style={filterStyle}
        >
          <option value="rating">Sort: Rating</option>
          <option value="downloads">Sort: Downloads</option>
          <option value="recent">Sort: Recent</option>
        </select>
      </div>

      {/* Category Tabs */}
      <div style={categoryButtons}>
        <button
          onClick={() => setSelectedCategory('all')}
          style={categoryBtnStyle(selectedCategory === 'all')}
        >
          📦 All
        </button>
        {(['legendary', 'npc', 'event', 'world'] as ModCategory[]).map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            style={categoryBtnStyle(selectedCategory === category)}
          >
            {categoryIcons[category]} {category.charAt(0).toUpperCase() + category.slice(1)}
          </button>
        ))}
      </div>

      {/* Mods Grid */}
      <div style={resultsStyle}>
        {filteredMods.length > 0 ? (
          filteredMods.map((mod) => (
            <ModCard
              key={mod.id}
              mod={mod}
              onLoad={handleLoadMod}
              isLoading={loadingModId === mod.id}
              isInstalled={installedModIds.includes(mod.id)}
            />
          ))
        ) : (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              color: '#666',
              padding: '40px'
            }}
          >
            No mods found matching your criteria
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * M63-C Community Mod Browser - Key Exports:
 * 
 * Features:
 * - Browse 4 mod categories: Legendary, NPC, Event, World
 * - Search by name, description, tags
 * - Sort by: Rating, Downloads, Recently Updated
 * - Filter by category
 * - View creator profile + myth rank
 * - Show requirements (tutorial tier, myth rank, faction)
 * - One-click loading with visual feedback
 * - Preview images for mods
 * - Show download count + reviews
 * 
 * Mod Types:
 * - Legendary: Custom artifact JSON definitions
 * - NPC: Character profiles + schedules + dialogue trees
 * - Event: Macro event definitions (festivals, plagues, etc.)
 * - World: Entire world template + biome layouts
 * 
 * Integration:
 * - Load mods directly into active world
 * - Track installed mods per save
 * - Export personal mods to share
 * - Creator crediting system
 */
