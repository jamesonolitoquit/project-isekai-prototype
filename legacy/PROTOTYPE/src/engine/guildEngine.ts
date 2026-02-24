/**
 * Phase 24 Task 1: Guild & Social Structures Engine
 * 
 * Manages player-led organizations, shared resources, and collective reputation.
 * Guilds function as micro-factions with their own:
 * - Hierarchical member roles and permissions
 * - Shared bank vault with item/gold management
 * - Collective reputation modifier affecting faction power
 * - Guild-wide events and history logging
 * - Treasury management with contribution tracking
 * 
 * Architecture:
 * - Guild: Core organization entity with metadata
 * - Member: Player membership with role-based permissions
 * - Vault: Shared inventory with deposit/withdrawal audit trail
 * - Treasury: Gold pool funded by member contributions
 * - GuildEvent: Immutable log of guild activities
 */

/**
 * Simple UUID generator (no external dependency)
 */
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Guild member roles with permission levels
 */
export enum GuildRole {
  FOUNDER = 'founder',       // Full control, can disband (1)
  COUNCIL = 'council',       // Manage members, treasury (2-3 max)
  LIEUTENANT = 'lieutenant', // Manage lower ranks (unlimited)
  MEMBER = 'member',         // Participate, contribute (unlimited)
  INITIATE = 'initiate',     // Limited permissions, 7-day trial (unlimited)
}

export const roleHierarchy: Record<GuildRole, number> = {
  [GuildRole.FOUNDER]: 5,
  [GuildRole.COUNCIL]: 4,
  [GuildRole.LIEUTENANT]: 3,
  [GuildRole.MEMBER]: 2,
  [GuildRole.INITIATE]: 1,
};

/**
 * Permissions bitmap for role-based access control
 */
export enum GuildPermission {
  INVITE_MEMBER = 1 << 0,      // Invite players to guild
  REMOVE_MEMBER = 1 << 1,      // Remove members
  MANAGE_ROLES = 1 << 2,       // Change member roles
  EDIT_TREASURY = 1 << 3,      // Deposit/withdraw gold
  EDIT_VAULT = 1 << 4,         // Add/remove vault items
  EDIT_GUILD = 1 << 5,         // Change guild name/description
  DISBAND_GUILD = 1 << 6,      // Disband the guild
  USE_VAULT = 1 << 7,          // Access vault items
}

// Role → Permissions mapping
export const rolePermissions: Record<GuildRole, number> = {
  [GuildRole.FOUNDER]:
    GuildPermission.INVITE_MEMBER |
    GuildPermission.REMOVE_MEMBER |
    GuildPermission.MANAGE_ROLES |
    GuildPermission.EDIT_TREASURY |
    GuildPermission.EDIT_VAULT |
    GuildPermission.EDIT_GUILD |
    GuildPermission.DISBAND_GUILD |
    GuildPermission.USE_VAULT,

  [GuildRole.COUNCIL]:
    GuildPermission.INVITE_MEMBER |
    GuildPermission.REMOVE_MEMBER |
    GuildPermission.MANAGE_ROLES |
    GuildPermission.EDIT_TREASURY |
    GuildPermission.EDIT_VAULT |
    GuildPermission.USE_VAULT,

  [GuildRole.LIEUTENANT]:
    GuildPermission.INVITE_MEMBER |
    GuildPermission.REMOVE_MEMBER |
    GuildPermission.EDIT_VAULT |
    GuildPermission.USE_VAULT,

  [GuildRole.MEMBER]:
    GuildPermission.INVITE_MEMBER |
    GuildPermission.EDIT_TREASURY |
    GuildPermission.USE_VAULT,

  [GuildRole.INITIATE]:
    GuildPermission.USE_VAULT,
};

/**
 * Guild member with role and permissions
 */
export interface GuildMember {
  playerId: string;
  playerName: string;
  role: GuildRole;
  joinedAt: number;
  contributedGold: number;
  contributedItems: number;
  lastActiveAt: number;
}

/**
 * Vault item (shared inventory entry)
 */
export interface VaultItem {
  itemId: string;
  itemType: string;
  quantity: number;
  rarity: string;
  depositedBy: string;
  depositedAt: number;
  expiresAt?: number; // Optional expiry for temporary items
}

/**
 * Guild treasury entry
 */
export interface TreasuryEntry {
  entryId: string;
  timestamp: number;
  type: 'deposit' | 'withdrawal';
  amount: number;
  playerId: string;
  reason: string;
  balanceBefore: number;
  balanceAfter: number;
}

/**
 * Guild event (immutable log entry)
 */
export interface GuildEvent {
  eventId: string;
  timestamp: number;
  type: string;
  description: string;
  affectedPlayers: string[];
  metadata: Record<string, any>;
}

/**
 * Guild reputation modifier based on collective achievements
 */
export interface ReputationModifier {
  baseModifier: number; // -1.0 to +1.0 scale
  overallTierBonus: number; // Based on guild level (0-10)
  raidSuccessBonus: number; // From raid victories
  memberContributionBonus: number; // From treasury/vault activity
  finalModifier: number; // Sum of above
}

/**
 * Guild core entity
 */
export interface Guild {
  guildId: string;
  name: string;
  description: string;
  founderId: string;
  founderName: string;
  createdAt: number;
  tier: number; // 1-10, increases with reputation milestones
  members: Map<string, GuildMember>;
  vault: VaultItem[];
  treasury: {
    currentBalance: number;
    entries: TreasuryEntry[];
  };
  reputationModifier: ReputationModifier;
  events: GuildEvent[];
  disbanded: boolean;
  disbandedAt?: number;
  maxMembers: number;
}

/**
 * Guild Management Engine
 */
export class GuildEngine {
  private guilds = new Map<string, Guild>();
  private playerToGuild = new Map<string, string>(); // playerId → guildId

  /**
   * Create a new guild
   */
  createGuild(
    name: string,
    description: string,
    founderId: string,
    founderName: string
  ): { success: boolean; guildId?: string; reason?: string } {
    try {
      // Validate name
      if (!name || name.length < 3 || name.length > 32) {
        return { success: false, reason: 'Guild name must be 3-32 characters' };
      }

      // Check if founder already in a guild
      if (this.playerToGuild.has(founderId)) {
        return { success: false, reason: 'Player is already in a guild' };
      }

      // Check name uniqueness
      for (const guild of this.guilds.values()) {
        if (guild.name.toLowerCase() === name.toLowerCase() && !guild.disbanded) {
          return { success: false, reason: 'Guild name already taken' };
        }
      }

      const guildId = generateId('guild');
      const founder: GuildMember = {
        playerId: founderId,
        playerName: founderName,
        role: GuildRole.FOUNDER,
        joinedAt: Date.now(),
        contributedGold: 0,
        contributedItems: 0,
        lastActiveAt: Date.now(),
      };

      const guild: Guild = {
        guildId,
        name,
        description,
        founderId,
        founderName,
        createdAt: Date.now(),
        tier: 1,
        members: new Map([[founderId, founder]]),
        vault: [],
        treasury: {
          currentBalance: 0,
          entries: [],
        },
        reputationModifier: {
          baseModifier: 0,
          overallTierBonus: 0,
          raidSuccessBonus: 0,
          memberContributionBonus: 0,
          finalModifier: 0,
        },
        events: [
          {
            eventId: generateId('event'),
            timestamp: Date.now(),
            type: 'GUILD_CREATED',
            description: `Guild "${name}" founded by ${founderName}`,
            affectedPlayers: [founderId],
            metadata: { guildId, founderName },
          },
        ],
        disbanded: false,
        maxMembers: 100,
      };

      this.guilds.set(guildId, guild);
      this.playerToGuild.set(founderId, guildId);

      console.log(`[GuildEngine] Guild created: ${name} (${guildId})`);

      return { success: true, guildId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, reason: message };
    }
  }

  /**
   * Get guild by ID
   */
  getGuild(guildId: string): Guild | undefined {
    return this.guilds.get(guildId);
  }

  /**
   * Get guild for player
   */
  getPlayerGuild(playerId: string): Guild | undefined {
    const guildId = this.playerToGuild.get(playerId);
    return guildId ? this.guilds.get(guildId) : undefined;
  }

  /**
   * Invite player to guild
   */
  inviteToGuild(
    guildId: string,
    inviterId: string,
    newPlayerId: string,
    newPlayerName: string
  ): { success: boolean; reason?: string } {
    try {
      const guild = this.guilds.get(guildId);
      if (!guild) {
        return { success: false, reason: 'Guild not found' };
      }

      // Check inviter permissions
      const inviter = guild.members.get(inviterId);
      if (!inviter) {
        return { success: false, reason: 'Inviter not in guild' };
      }

      if (!this.hasPermission(inviter.role, GuildPermission.INVITE_MEMBER)) {
        return { success: false, reason: 'Insufficient permissions' };
      }

      // Check if new player already in guild
      if (this.playerToGuild.has(newPlayerId)) {
        return { success: false, reason: 'Player is already in a guild' };
      }

      // Check guild capacity
      if (guild.members.size >= guild.maxMembers) {
        return { success: false, reason: 'Guild is at maximum capacity' };
      }

      // Add member as INITIATE (7-day trial)
      const newMember: GuildMember = {
        playerId: newPlayerId,
        playerName: newPlayerName,
        role: GuildRole.INITIATE,
        joinedAt: Date.now(),
        contributedGold: 0,
        contributedItems: 0,
        lastActiveAt: Date.now(),
      };

      guild.members.set(newPlayerId, newMember);
      this.playerToGuild.set(newPlayerId, guildId);

      // Log event
      this.logGuildEvent(guildId, {
        type: 'MEMBER_INVITED',
        timestamp: Date.now(),
        description: `${inviter.playerName} invited ${newPlayerName} to the guild`,
        affectedPlayers: [inviterId, newPlayerId],
        metadata: { inviterId, newPlayerId, role: GuildRole.INITIATE },
      });

      console.log(`[GuildEngine] ${newPlayerName} invited to ${guild.name}`);

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, reason: message };
    }
  }

  /**
   * Promote guild member
   */
  promoteMember(
    guildId: string,
    promoterId: string,
    targetPlayerId: string,
    newRole: GuildRole
  ): { success: boolean; reason?: string } {
    try {
      const guild = this.guilds.get(guildId);
      if (!guild) {
        return { success: false, reason: 'Guild not found' };
      }

      const promoter = guild.members.get(promoterId);
      if (!promoter) {
        return { success: false, reason: 'Promoter not in guild' };
      }

      if (!this.hasPermission(promoter.role, GuildPermission.MANAGE_ROLES)) {
        return { success: false, reason: 'Insufficient permissions' };
      }

      const target = guild.members.get(targetPlayerId);
      if (!target) {
        return { success: false, reason: 'Target member not found' };
      }

      // Prevent demotion/promotion beyond role hierarchy
      if (roleHierarchy[newRole] <= roleHierarchy[target.role]) {
        return { success: false, reason: 'Cannot demote member' };
      }

      // Enforce role limits (e.g., max 3 council members)
      if (newRole === GuildRole.COUNCIL) {
        const councilCount = Array.from(guild.members.values()).filter(
          (m) => m.role === GuildRole.COUNCIL
        ).length;
        if (councilCount >= 3) {
          return { success: false, reason: 'Guild already has maximum council members (3)' };
        }
      }

      const oldRole = target.role;
      target.role = newRole;

      // Log event
      this.logGuildEvent(guildId, {
        type: 'MEMBER_PROMOTED',
        timestamp: Date.now(),
        description: `${promoter.playerName} promoted ${target.playerName} from ${oldRole} to ${newRole}`,
        affectedPlayers: [promoterId, targetPlayerId],
        metadata: { promoterId, targetPlayerId, oldRole, newRole },
      });

      console.log(`[GuildEngine] ${target.playerName} promoted to ${newRole}`);

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, reason: message };
    }
  }

  /**
   * Deposit item to guild vault
   */
  depositToVault(
    guildId: string,
    playerId: string,
    itemId: string,
    itemType: string,
    quantity: number,
    rarity: string
  ): { success: boolean; reason?: string } {
    try {
      const guild = this.guilds.get(guildId);
      if (!guild) {
        return { success: false, reason: 'Guild not found' };
      }

      const member = guild.members.get(playerId);
      if (!member) {
        return { success: false, reason: 'Player not in guild' };
      }

      if (!this.hasPermission(member.role, GuildPermission.EDIT_VAULT)) {
        return { success: false, reason: 'Insufficient permissions' };
      }

      // Check if item already in vault
      const existing = guild.vault.find(
        (v) => v.itemType === itemType && v.rarity === rarity
      );

      if (existing) {
        existing.quantity += quantity;
      } else {
        guild.vault.push({
          itemId: generateId('item'),
          itemType,
          quantity,
          rarity,
          depositedBy: playerId,
          depositedAt: Date.now(),
        });
      }

      member.contributedItems += quantity;

      this.logGuildEvent(guildId, {
        type: 'ITEM_DEPOSITED',
        timestamp: Date.now(),
        description: `${member.playerName} deposited ${quantity}x ${itemType} (${rarity})`,
        affectedPlayers: [playerId],
        metadata: { itemType, quantity, rarity },
      });

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, reason: message };
    }
  }

  /**
   * Withdraw item from vault
   */
  withdrawFromVault(
    guildId: string,
    playerId: string,
    itemType: string,
    quantity: number
  ): { success: boolean; reason?: string } {
    try {
      const guild = this.guilds.get(guildId);
      if (!guild) {
        return { success: false, reason: 'Guild not found' };
      }

      const member = guild.members.get(playerId);
      if (!member) {
        return { success: false, reason: 'Player not in guild' };
      }

      if (!this.hasPermission(member.role, GuildPermission.USE_VAULT)) {
        return { success: false, reason: 'Insufficient permissions' };
      }

      const vaultItem = guild.vault.find((v) => v.itemType === itemType);
      if (!vaultItem || vaultItem.quantity < quantity) {
        return { success: false, reason: 'Insufficient items in vault' };
      }

      vaultItem.quantity -= quantity;
      if (vaultItem.quantity === 0) {
        guild.vault = guild.vault.filter((v) => v.itemType !== itemType);
      }

      this.logGuildEvent(guildId, {
        type: 'ITEM_WITHDRAWN',
        timestamp: Date.now(),
        description: `${member.playerName} withdrew ${quantity}x ${itemType} from vault`,
        affectedPlayers: [playerId],
        metadata: { itemType, quantity },
      });

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, reason: message };
    }
  }

  /**
   * Deposit gold to treasury
   */
  depositToTreasury(
    guildId: string,
    playerId: string,
    amount: number,
    reason: string = 'Member contribution'
  ): { success: boolean; reason?: string } {
    try {
      const guild = this.guilds.get(guildId);
      if (!guild) {
        return { success: false, reason: 'Guild not found' };
      }

      const member = guild.members.get(playerId);
      if (!member) {
        return { success: false, reason: 'Player not in guild' };
      }

      if (!this.hasPermission(member.role, GuildPermission.EDIT_TREASURY)) {
        return { success: false, reason: 'Insufficient permissions' };
      }

      const balanceBefore = guild.treasury.currentBalance;
      guild.treasury.currentBalance += amount;
      member.contributedGold += amount;

      const entry: TreasuryEntry = {
        entryId: generateId('entry'),
        timestamp: Date.now(),
        type: 'deposit',
        amount,
        playerId,
        reason,
        balanceBefore,
        balanceAfter: guild.treasury.currentBalance,
      };

      guild.treasury.entries.push(entry);

      // Recalculate reputation (treasury activity boosts group modifier)
      this.updateReputationModifier(guild);

      this.logGuildEvent(guildId, {
        type: 'GOLD_DEPOSITED',
        timestamp: Date.now(),
        description: `${member.playerName} deposited ${amount} gold to treasury`,
        affectedPlayers: [playerId],
        metadata: { amount, reason },
      });

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, reason: message };
    }
  }

  /**
   * Check if member has permission
   */
  private hasPermission(role: GuildRole, permission: GuildPermission): boolean {
    return (rolePermissions[role] & permission) === permission;
  }

  /**
   * Log immutable guild event
   */
  private logGuildEvent(
    guildId: string,
    event: Omit<GuildEvent, 'eventId'>
  ): void {
    const guild = this.guilds.get(guildId);
    if (!guild) return;

    guild.events.push({
      ...event,
      eventId: generateId('event'),
    });

    // Keep only last 1000 events
    if (guild.events.length > 1000) {
      guild.events.shift();
    }
  }

  /**
   * Update guild reputation modifier based on activity
   */
  private updateReputationModifier(guild: Guild): void {
    const modifier = guild.reputationModifier;

    // Base: tier bonus (+0.5 per tier, max +5.0 at tier 10)
    modifier.overallTierBonus = (guild.tier - 1) * 0.5;

    // Treasury bonus: larger treasuries indicate stability (+0 to +1.0)
    const treasuryBonus = Math.min(1.0, guild.treasury.currentBalance / 10000);
    modifier.memberContributionBonus = treasuryBonus;

    // Raid bonus (will be updated by raid engine)
    // modifier.raidSuccessBonus already set

    // Final modifier: sum with cap -1.0 to +1.0
    modifier.finalModifier = Math.max(
      -1.0,
      Math.min(
        1.0,
        modifier.baseModifier +
          modifier.overallTierBonus +
          modifier.raidSuccessBonus +
          modifier.memberContributionBonus
      )
    );
  }

  /**
   * Disband guild
   */
  disbandGuild(guildId: string, playerId: string): { success: boolean; reason?: string } {
    try {
      const guild = this.guilds.get(guildId);
      if (!guild) {
        return { success: false, reason: 'Guild not found' };
      }

      // Only founder can disband
      if (guild.founderId !== playerId) {
        return { success: false, reason: 'Only the founder can disband the guild' };
      }

      guild.disbanded = true;
      guild.disbandedAt = Date.now();

      // Remove all members from guild mapping
      for (const memberId of guild.members.keys()) {
        this.playerToGuild.delete(memberId);
      }

      this.logGuildEvent(guildId, {
        type: 'GUILD_DISBANDED',
        timestamp: Date.now(),
        description: `Guild disbanded by founder`,
        affectedPlayers: Array.from(guild.members.keys()),
        metadata: { founderId: playerId },
      });

      console.log(`[GuildEngine] Guild disbanded: ${guild.name}`);

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, reason: message };
    }
  }

  /**
   * Get guild statistics
   */
  getGuildStats(guildId: string): {
    memberCount: number;
    treasury: number;
    vaultItems: number;
    reputationModifier: number;
    tier: number;
  } | null {
    const guild = this.guilds.get(guildId);
    if (!guild) return null;

    return {
      memberCount: guild.members.size,
      treasury: guild.treasury.currentBalance,
      vaultItems: guild.vault.length,
      reputationModifier: guild.reputationModifier.finalModifier,
      tier: guild.tier,
    };
  }

  /**
   * Get all active guilds
   */
  getAllGuilds(): Guild[] {
    return Array.from(this.guilds.values()).filter((g) => !g.disbanded);
  }
}

/**
 * Global singleton guild engine
 */
let globalGuildEngine: GuildEngine | null = null;

export function getGuildEngine(): GuildEngine {
  if (!globalGuildEngine) {
    globalGuildEngine = new GuildEngine();
  }
  return globalGuildEngine;
}
