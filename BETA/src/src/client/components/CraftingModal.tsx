import React, { useState, useMemo } from 'react';

interface CraftingModalProps {
  isOpen?: boolean;
  state?: any;
  onCraft?: (recipeId: string) => void;
  onClose?: () => void;
}

// Simplified recipe/item database
const RECIPES = [
  {
    id: 'craft-healing-potion',
    name: 'Basic Healing Potion',
    materials: [{ itemId: 'rare-herb', quantity: 2, name: 'Rare Luminous Herb' }],
    result: { itemId: 'healing-potion-minor', quantity: 2, name: 'Minor Healing Potion' },
    difficulty: 5
  },
  {
    id: 'craft-stamina-tonic',
    name: 'Stamina Tonic',
    materials: [
      { itemId: 'rare-herb', quantity: 1, name: 'Rare Luminous Herb' },
      { itemId: 'copper-ingot', quantity: 1, name: 'Copper Ingot' }
    ],
    result: { itemId: 'stamina-tonic', quantity: 1, name: 'Stamina Tonic' },
    difficulty: 8
  },
  {
    id: 'craft-steel-sword',
    name: 'Steel Longsword',
    materials: [
      { itemId: 'iron-ore', quantity: 3, name: 'Iron Ore' },
      { itemId: 'copper-ingot', quantity: 1, name: 'Copper Ingot' }
    ],
    result: { itemId: 'steel-sword', quantity: 1, name: 'Steel Longsword' },
    difficulty: 10
  }
];

export default function CraftingModal({ isOpen = false, state, onCraft, onClose }: CraftingModalProps) {
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const inventory = state?.player?.inventory || [];
  const playerInt = state?.player?.stats?.int || 10;

  const selectedRecipe = RECIPES.find(r => r.id === selectedRecipeId);

  // Check if player can craft selected recipe
  const canCraft = useMemo(() => {
    if (!selectedRecipe) return false;
    return selectedRecipe.materials.every(mat => {
      const inv = inventory.find((i: any) => i.itemId === mat.itemId);
      return inv && inv.quantity >= mat.quantity;
    });
  }, [selectedRecipe, inventory]);

  const handleCraft = () => {
    if (selectedRecipeId && canCraft) {
      onCraft?.(selectedRecipeId);
      setSelectedRecipeId('');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1a1a1a',
          border: '2px solid #ffd700',
          borderRadius: 4,
          padding: 20,
          maxWidth: 600,
          maxHeight: '80vh',
          overflowY: 'auto',
          color: '#e0e0e0',
          fontFamily: 'Arial, sans-serif'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: '#ffd700' }}>🔨 Crafting</h2>
          <button
            onClick={onClose}
            style={{
              background: '#d32f2f',
              color: 'white',
              border: 'none',
              padding: '4px 8px',
              borderRadius: 2,
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
            Your Crafting Skill (INT): {playerInt}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#ffd700' }}>Available Recipes:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {RECIPES.map((recipe) => {
                const canMake = recipe.materials.every(mat => {
                  const inv = inventory.find((i: any) => i.itemId === mat.itemId);
                  return inv && inv.quantity >= mat.quantity;
                });

                return (
                  <div
                    key={recipe.id}
                    onClick={() => setSelectedRecipeId(recipe.id)}
                    style={{
                      padding: 10,
                      border: selectedRecipeId === recipe.id ? '2px solid #ffd700' : '1px solid #444',
                      borderRadius: 4,
                      cursor: 'pointer',
                      backgroundColor: selectedRecipeId === recipe.id ? '#2a2a00' : '#2a2a2a',
                      opacity: canMake ? 1 : 0.6
                    }}
                  >
                    <div style={{ fontWeight: 'bold' }}>{recipe.name}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>Difficulty: {recipe.difficulty} | INT Req: {Math.max(3, Math.ceil(recipe.difficulty * 0.7))}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedRecipe && (
            <div style={{ marginTop: 16, padding: 12, backgroundColor: '#2a2a2a', borderRadius: 4 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 12, color: '#ffd700' }}>Recipe Details</div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ color: '#aaa', marginBottom: 4 }}>Required Materials:</div>
                {selectedRecipe.materials.map((mat) => {
                  const inInv = inventory.find((i: any) => i.itemId === mat.itemId)?.quantity || 0;
                  const hasEnough = inInv >= mat.quantity;
                  return (
                    <div key={mat.itemId} style={{ fontSize: 12, color: hasEnough ? '#66bb6a' : '#d32f2f' }}>
                      • {mat.name} × {mat.quantity} {hasEnough ? `(✓ ${inInv})` : `(✗ have ${inInv})`}
                    </div>
                  );
                })}
              </div>

              <div>
                <div style={{ color: '#aaa', marginBottom: 4 }}>Result:</div>
                <div style={{ fontSize: 12, color: '#ffd700' }}>
                  • {selectedRecipe.result.name} × {selectedRecipe.result.quantity}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#444',
              color: '#e0e0e0',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCraft}
            disabled={!selectedRecipeId || !canCraft}
            style={{
              padding: '8px 16px',
              backgroundColor: canCraft ? '#ffd700' : '#666',
              color: '#000',
              border: 'none',
              borderRadius: 4,
              cursor: canCraft ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
              opacity: canCraft ? 1 : 0.5
            }}
          >
            Craft
          </button>
        </div>
      </div>
    </div>
  );
}
