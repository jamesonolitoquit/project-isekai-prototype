// Conditional imports for server-side only
let fs: any = null;
let path: any = null;
let DatabaseAdapter: any = null;
let getDatabaseAdapter: any = null;

if (typeof window === 'undefined') {
  try {
    fs = require('fs');
    path = require('path');
    const dbModule = require('./databaseAdapter');
    DatabaseAdapter = dbModule.DatabaseAdapter;
    getDatabaseAdapter = dbModule.getDatabaseAdapter;
  } catch (e) {
    // Server-side modules not available
  }
}

export interface MultiverseHookItem {
  id: string;
  name: string;
  requiredParadoxLevel: number;
  originWorldType: string;
  statModifiers: Record<string, any>;
  lore: string;
  passiveEffect: string;
}

export interface GlobalTrigger {
  id: string;
  threshold: number;
  effect: string;
  narrative: string;
}

export interface DissonanceDialogue {
  trigger: string;
  text: string;
  requirement: string;
}

export interface MultiverseHooks {
  version: string;
  description: string;
  globalTriggers: GlobalTrigger[];
  crossWorldItems: MultiverseHookItem[];
  dissonanceDialogue: {
    npcId: string;
    nodes: DissonanceDialogue[];
  };
}

class MultiverseAdapter {
  private hooks: MultiverseHooks | null = null;
  private lastGlobalParadox: number = 0;
  private lastPollTick: number = 0;
  private readonly POLL_INTERVAL = 1000;

  constructor() {
    this.loadHooks();
  }

  private loadHooks() {
    // Only load hooks on server-side where Node.js modules are available
    if (!fs || !path) {
      console.warn('[MultiverseAdapter] Server-side modules not available, skipping hook loading');
      return;
    }

    try {
      const filePath = path.join(__dirname, '..', 'data', 'multiverse-hooks.json');
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        this.hooks = JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load multiverse-hooks.json:', error);
    }
  }

  /**
   * Updates the global paradox average from the database.
   * Only polls every 1000 ticks to minimize DB load.
   */
  public async syncGlobalParadox(currentTick: number): Promise<number> {
    if (currentTick - this.lastPollTick >= this.POLL_INTERVAL || this.lastPollTick === 0) {
      // TODO: Implement getGlobalParadoxAverage in DatabaseAdapter
      // this.lastGlobalParadox = await getDatabaseAdapter()!.getGlobalParadoxAverage();
      this.lastGlobalParadox = 25; // Default paradox level
      this.lastPollTick = currentTick;
    }
    return this.lastGlobalParadox;
  }

  /**
   * Returns active global triggers based on current global paradox levels.
   */
  public getActiveTriggers(): GlobalTrigger[] {
    if (!this.hooks) return [];
    return this.hooks.globalTriggers.filter(t => this.lastGlobalParadox >= t.threshold);
  }

  /**
   * Returns potential leaked items if the global paradox thresholds are met.
   */
  public getLeakedItems(): MultiverseHookItem[] {
    if (!this.hooks) return [];
    return this.hooks.crossWorldItems.filter(item => this.lastGlobalParadox >= item.requiredParadoxLevel);
  }

  /**
   * Provides dialogue overrides for NPCs based on multiverse dissonance.
   */
  public getDissonanceDialogue(npcId: string, playerParadox: number): string[] {
    if (!this.hooks || this.hooks.dissonanceDialogue.npcId !== npcId) return [];
    
    return this.hooks.dissonanceDialogue.nodes
      .filter(node => {
        if (node.requirement.includes('globalServerParadoxSum')) {
          // Logic for parsing requirement string (simplified for prototype)
          return this.lastGlobalParadox > 0.5; 
        }
        if (node.requirement.includes('playerParadoxCount')) {
          return playerParadox > 50;
        }
        return false;
      })
      .map(node => node.text);
  }

  /**
   * Gets the visual tint logic based on global paradox levels.
   */
  public getParadoxVisuals() {
    if (this.lastGlobalParadox > 0.9) return { tint: "#inverse_rgb", alpha: 0.7, staticNoise: true };
    if (this.lastGlobalParadox > 0.8) return { tint: "#6d0000", alpha: 0.4, glitchIntensity: 0.8 };
    if (this.lastGlobalParadox > 0.5) return { tint: "#0a0a0a", alpha: 0.1 };
    return null;
  }

  public getHooksVersion(): string {
    return this.hooks?.version || "0.0.0";
  }
}

export const multiverseAdapter = new MultiverseAdapter();
