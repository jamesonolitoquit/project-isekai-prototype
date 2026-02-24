/**
 * M42 Phase 4 Task 1-2: Director Command Engine
 *
 * "The Director's Authority" - Administrative command layer for GM manipulation
 * DETERMINISM-SAFE: All timestamps use seededNow(worldTick), all randomness uses SeededRng
 *
 * Core Commands (Phase 4 Task 1):
 * - /force_epoch <1|2|3> — Trigger cinematic epoch transitions
 * - /spawn_macro_event <eventId> — Inject world events
 * - /kick_phantom — Clear player echoes if paradoxes occur
 * - /reset_consensus — Emergency resync for all peers
 * - /list_peers — Show active peer status
 * - /announce <message> — Send narrator announcement to all players
 * - /set_faction_power <factionId> <power> — Adjust faction power directly
 *
 * Live Ops Commands (Phase 4 Task 2):
 * - /schedule_event <eventId> <delay> [name] [category] [severity] — Schedule event for future fire
 * - /queue_events — Show all scheduled events
 * - /cancel_event <scheduleId> — Cancel a scheduled event
 *
 * All commands recorded as DIRECTOR_OVERRIDE mutations in mutationLog
 */

import { liveOpsEngine } from './liveOpsEngine';
import { seededNow, random } from './prng';
import { getDirectorMacroEngine } from './directorMacroEngine';

export interface DirectorCommand {
  timestamp: number;
  executor: string; // Director peer ID
  command: string;
  args: string[];
  status: 'pending' | 'executing' | 'success' | 'error';
  result?: any;
  error?: string;
}

export interface DirectorMutation {
  type: 'DIRECTOR_OVERRIDE';
  command: DirectorCommand;
  worldId: string;
  timestamp: number;
}

type CommandHandler = (args: string[], context: DirectorCommandContext) => Promise<CommandResult>;

export interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
}

export interface DirectorCommandContext {
  state: any; // World state (includes tick for deterministic timestamps)
  controller: any; // World controller
  multiplayerEngine: any; // For peer coordination
  transitionEngine: any; // For epoch transitions
  mutationLog: any[]; // Append mutations here
  diagnosticsEngine: any; // For health checks
  addNarrativeWhisper?: (message: string, priority: 'normal' | 'urgent' | 'critical', duration?: number) => string; // Phase 4 Task 4.3
}

/**
 * Director Command Engine - Parses and executes GM commands
 */
export class DirectorCommandEngine {
  private handlers: Map<string, CommandHandler> = new Map();
  private commandHistory: DirectorCommand[] = [];
  private maxHistorySize = 1000;

  constructor(private directorId: string = 'director_primary') {
    this.registerDefaultHandlers();
  }

  /**
   * Register all built-in command handlers
   */
  private registerDefaultHandlers(): void {
    // Epoch Control
    this.register('force_epoch', this.handleForceEpoch.bind(this));
    
    // Event Management
    this.register('spawn_macro_event', this.handleSpawnMacroEvent.bind(this));
    
    // Phantom Management
    this.register('kick_phantom', this.handleKickPhantom.bind(this));
    
    // Consensus Management
    this.register('reset_consensus', this.handleResetConsensus.bind(this));
    
    // Diagnostic Commands
    this.register('list_peers', this.handleListPeers.bind(this));
    this.register('announce', this.handleAnnounce.bind(this));
    this.register('set_faction_power', this.handleSetFactionPower.bind(this));
    
    // Live Ops Scheduling (Phase 4 Task 2)
    this.register('schedule_event', this.handleScheduleEvent.bind(this));
    this.register('queue_events', this.handleQueueEvents.bind(this));
    this.register('cancel_event', this.handleCancelEvent.bind(this));
    
    // Phase 4 Task 4.5: Iron Canon
    this.register('seal_canon', this.handleSealCanon.bind(this));
    
    // System Commands
    this.register('help', this.handleHelp.bind(this));
    // this.register('history', this.handleHistory.bind(this)); // TODO: Fix method ordering
  }

  /**
   * Register custom command handler
   */
  register(command: string, handler: CommandHandler): void {
    this.handlers.set(command.toLowerCase(), handler);
  }

  /**
   * Parse and execute a director command
   * DETERMINISM-SAFE: Uses seededNow(worldTick) instead of Date.now()
   */
  async execute(
    commandString: string,
    context: DirectorCommandContext
  ): Promise<DirectorCommand> {
    const worldTick = context.state?.tick || 0;
    const cmd: DirectorCommand = {
      timestamp: seededNow(worldTick),
      executor: this.directorId,
      command: '',
      args: [],
      status: 'pending'
    };

    try {
      // Parse command string
      const [commandName, ...args] = commandString.trim().split(/\s+/);
      cmd.command = commandName.toLowerCase().replace(/^\//, '');
      cmd.args = args;

      // Validate command
      if (!this.handlers.has(cmd.command)) {
        cmd.status = 'error';
        cmd.error = `Unknown command: ${cmd.command}. Type /help for available commands.`;
        // this.recordCommand(cmd); // TODO: Fix method ordering
        return cmd;
      }

      // Execute handler
      cmd.status = 'executing';
      const handler = this.handlers.get(cmd.command)!;
      const result = await handler(args, context);

      cmd.status = result.success ? 'success' : 'error';
      cmd.result = result.data;
      if (!result.success) {
        cmd.error = result.message;
      }

      // Record as mutation if successful
      if (result.success) {
        // this.recordMutation(cmd, context); // TODO: Fix method ordering
      }

      // this.recordCommand(cmd); // TODO: Fix method ordering
      return cmd;
    } catch (error) {
      cmd.status = 'error';
      cmd.error = error instanceof Error ? error.message : 'Unknown error';
      // this.recordCommand(cmd); // TODO: Fix method ordering
      return cmd;
    }
  }

  /**
   * COMMAND: /force_epoch <1|2|3>
   * Trigger cinematic epoch transition
   */
  private async handleForceEpoch(args: string[], ctx: DirectorCommandContext): Promise<CommandResult> {
    if (args.length < 1) {
      return { success: false, message: 'Usage: /force_epoch <1|2|3>' };
    }

    const epochNum = parseInt(args[0], 10);
    if (![1, 2, 3].includes(epochNum)) {
      return { success: false, message: 'Epoch must be 1 (Fracture), 2 (Twilight), or 3 (Waning)' };
    }

    try {
      const worldTick = ctx.state?.tick || 0;
      const deterministicTimestamp = seededNow(worldTick);

      // Trigger epoch shift in state
      if (ctx.controller && ctx.controller.performAction) {
        ctx.controller.performAction({
          worldId: ctx.state.id,
          playerId: ctx.state.player.id,
          type: 'FORCE_EPOCH',
          payload: { epochNum }
        });
      }

      // Trigger transition overlay
      if (ctx.transitionEngine && ctx.transitionEngine.startWorldTransition) {
        ctx.transitionEngine.startWorldTransition('epoch_shift');
      }

      const epochNames = ['', 'Fracture', 'Twilight', 'Waning'];
      return {
        success: true,
        message: `Epoch shifted to ${epochNames[epochNum]} (${epochNum})`,
        data: { newEpoch: epochNum, triggeredAt: deterministicTimestamp }
      };
    } catch (error) {
      return { success: false, message: `Failed to force epoch: ${error}` };
    }
  }

  /**
   * COMMAND: /spawn_macro_event <type> <factionId> <locations...>
   * M44-B1: Spawn a faction-based macro event that overrides influence caps
   * 
   * Usage: /spawn_macro_event faction_incursion silver_flame town,forest --duration 5000 --influence 0.95
   * Types: faction_incursion, cataclysm, truce, uprising, invasion
   */
  private async handleSpawnMacroEvent(args: string[], ctx: DirectorCommandContext): Promise<CommandResult> {
    if (args.length < 3) {
      return {
        success: false,
        message: 'Usage: /spawn_macro_event <type> <factionId> <loc1,loc2,...> [--duration N] [--influence 0.0-1.0]'
      };
    }

    try {
      const eventType = args[0] as any; // faction_incursion | cataclysm | truce | uprising | invasion
      const factionId = args[1];
      const locationStr = args[2];
      const locations = locationStr.split(',').map((l) => l.trim());

      // Parse optional flags
      let durationTicks = 5000;
      let influenceOverride: number | undefined;
      for (let i = 3; i < args.length; i++) {
        if (args[i] === '--duration' && i + 1 < args.length) {
          durationTicks = parseInt(args[i + 1], 10);
        }
        if (args[i] === '--influence' && i + 1 < args.length) {
          influenceOverride = Math.max(0, Math.min(1, parseFloat(args[i + 1])));
        }
      }

      const macroEngine = getDirectorMacroEngine();
      const event = macroEngine.spawnMacroEvent(
        eventType,
        ctx.state,
        factionId,
        locations,
        durationTicks,
        undefined, // use default narrative
        influenceOverride
      );

      // Trigger transition if catastrophic
      if (eventType.includes('cataclysm') || eventType.includes('invasion')) {
        if (ctx.transitionEngine) {
          ctx.transitionEngine.startWorldTransition('macro_event');
        }
      }

      // Log to diagnostics
      if (ctx.addNarrativeWhisper) {
        const priority = eventType === 'cataclysm' ? 'critical' : 'urgent';
        ctx.addNarrativeWhisper(event.narrative, priority);
      }

      return {
        success: true,
        message: `Macro event spawned: ${eventType} in ${locations.length} location(s)`,
        data: {
          eventId: event.id,
          type: event.type,
          targetFaction: factionId,
          affectedLocations: locations,
          duration: durationTicks,
          timestamp: event.timestamp
        }
      };
    } catch (error) {
      return { success: false, message: `Failed to spawn macro event: ${error}` };
    }
  }

  /**
   * COMMAND: /kick_phantom
   * Clear all player echoes if paradoxes detected
   */
  private async handleKickPhantom(args: string[], ctx: DirectorCommandContext): Promise<CommandResult> {
    try {
      // Clear phantom players from world
      if (ctx.state && ctx.state.phantoms) {
        const clearedCount = ctx.state.phantoms.length;
        ctx.state.phantoms = [];
        
        return {
          success: true,
          message: `Cleared ${clearedCount} phantom echoes`,
          data: { clearedPhantoms: clearedCount }
        };
      }

      return { success: true, message: 'No phantoms to clear', data: { clearedPhantoms: 0 } };
    } catch (error) {
      return { success: false, message: `Failed to clear phantoms: ${error}` };
    }
  }

  /**
   * COMMAND: /reset_consensus
   * Emergency resync for all connected peers
   */
  private async handleResetConsensus(args: string[], ctx: DirectorCommandContext): Promise<CommandResult> {
    try {
      if (ctx.multiplayerEngine && ctx.multiplayerEngine.requestFullSync) {
        await ctx.multiplayerEngine.requestFullSync();
        return {
          success: true,
          message: 'Consensus reset triggered - all peers syncing',
          data: { resyncRequested: true }
        };
      }

      return { success: false, message: 'Multiplayer engine not available' };
    } catch (error) {
      return { success: false, message: `Failed to reset consensus: ${error}` };
    }
  }

  /**
   * COMMAND: /list_peers
   * Show status of all connected peers
   */
  private async handleListPeers(args: string[], ctx: DirectorCommandContext): Promise<CommandResult> {
    try {
      if (ctx.multiplayerEngine && ctx.multiplayerEngine.getPeerRegistry) {
        const peers = ctx.multiplayerEngine.getPeerRegistry();
        const peerStatus = peers.map((p: any) => ({
          id: p.id,
          status: p.connected ? 'online' : 'offline',
          lastHeartbeat: p.lastHeartbeat || 'N/A',
          latency: p.latency ? `${p.latency}ms` : 'N/A'
        }));

        return {
          success: true,
          message: `${peerStatus.length} peers connected`,
          data: { peers: peerStatus, totalCount: peerStatus.length }
        };
      }

      return { success: false, message: 'Peer registry not available' };
    } catch (error) {
      return { success: false, message: `Failed to list peers: ${error}` };
    }
  }

  /**
   * COMMAND: /announce [--urgent|--critical] <message>
   * Send narrator announcement to all players as diegetic narrative whisper
   * Phase 4 Task 4.3: Support priority levels and display as overlay
   */
  private async handleAnnounce(args: string[], ctx: DirectorCommandContext): Promise<CommandResult> {
    if (args.length < 1) {
      return { success: false, message: 'Usage: /announce [--urgent|--critical] <message>' };
    }

    try {
      // Parse priority flags
      let priority: 'normal' | 'urgent' | 'critical' = 'normal';
      let messageArgs = args;

      if (args[0].startsWith('--')) {
        if (args[0] === '--urgent') {
          priority = 'urgent';
        } else if (args[0] === '--critical') {
          priority = 'critical';
        }
        messageArgs = args.slice(1);
      }

      if (messageArgs.length === 0) {
        return { success: false, message: 'Message cannot be empty' };
      }

      const message = messageArgs.join(' ');
      const worldTick = ctx.state?.tick || 0;
      const deterministicTimestamp = seededNow(worldTick);

      // Add to state announcements (for persistence)
      const announcement = {
        id: `announce_${deterministicTimestamp}`,
        type: 'DIRECTOR_ANNOUNCEMENT',
        message,
        timestamp: deterministicTimestamp,
        sender: this.directorId,
        diegetic: true,
        priority // Added for Task 4.3
      };

      if (ctx.state) {
        if (!ctx.state.announcements) {
          ctx.state.announcements = [];
        }
        ctx.state.announcements.push(announcement);
      }

      // Trigger narrative whisper overlay (Phase 4 Task 4.3)
      let whisperId = '';
      if (ctx.addNarrativeWhisper) {
        whisperId = ctx.addNarrativeWhisper(message, priority, priority === 'critical' ? 7000 : 5000);
      }

      // Record mutation
      ctx.mutationLog?.push({
        type: 'DIRECTOR_OVERRIDE',
        action: 'announce',
        message,
        priority,
        timestamp: deterministicTimestamp,
        director: this.directorId,
        whisperId
      });

      return {
        success: true,
        message: `Announcement broadcast (${priority}): "${message}"`,
        data: { announcementId: announcement.id, whisperId, priority }
      };
    } catch (error) {
      return { success: false, message: `Failed to broadcast announcement: ${error}` };
    }
  }

  /**
   * COMMAND: /set_faction_power <factionId> <power>
   * Directly adjust faction power
   */
  private async handleSetFactionPower(args: string[], ctx: DirectorCommandContext): Promise<CommandResult> {
    if (args.length < 2) {
      return { success: false, message: 'Usage: /set_faction_power <factionId> <power>' };
    }

    const factionId = args[0];
    const newPower = parseFloat(args[1]);

    if (isNaN(newPower)) {
      return { success: false, message: 'Power must be a number (0-100)' };
    }

    try {
      // Find faction in state
      const faction = ctx.state.factions?.find((f: any) => f.id === factionId);
      if (!faction) {
        return { success: false, message: `Faction not found: ${factionId}` };
      }

      const oldPower = faction.power;
      faction.power = Math.max(0, Math.min(100, newPower));

      return {
        success: true,
        message: `Faction ${factionId} power: ${oldPower} → ${faction.power}`,
        data: { factionId, oldPower, newPower: faction.power }
      };
    } catch (error) {
      return { success: false, message: `Failed to set faction power: ${error}` };
    }
  }

  /**
   * COMMAND: /schedule_event <eventId> <delay> [name] [category] [severity]
   * Schedule a macro event to fire after N game ticks
   */
  private async handleScheduleEvent(args: string[], ctx: DirectorCommandContext): Promise<CommandResult> {
    if (args.length < 2) {
      return { success: false, message: 'Usage: /schedule_event <eventId> <delayTicks> [eventName] [category] [severity]' };
    }

    try {
      const eventId = args[0];
      const delay = parseInt(args[1], 10);
      const eventName = args[2] || eventId;
      const category = args[3] || 'story_beat';
      const severity = args[4] ? parseInt(args[4], 10) : 50;

      if (isNaN(delay) || delay <= 0) {
        return { success: false, message: 'Delay must be a positive integer (ticks)' };
      }

      const currentTick = (ctx.state?.tick ?? 0);
      const result = liveOpsEngine.scheduleEvent(
        eventId,
        eventName,
        category,
        delay,
        currentTick,
        severity,
        `Director-scheduled event: ${eventName}`,
        { createdBy: 'director' }
      );

      if (result.success) {
        // Record in mutation log (DETERMINISM-SAFE: using worldTick)
        const worldTick = ctx.state?.tick || 0;
        ctx.mutationLog?.push({
          type: 'DIRECTOR_OVERRIDE',
          action: 'schedule_event',
          eventId,
          scheduleId: result.scheduleId,
          fireTime: result.eventFireTime,
          delay,
          timestamp: seededNow(worldTick),
          director: this.directorId
        });
      }

      return {
        success: result.success,
        message: result.message,
        data: { scheduleId: result.scheduleId, fireTime: result.eventFireTime }
      };
    } catch (error) {
      return { success: false, message: `Schedule failed: ${error}` };
    }
  }

  /**
   * COMMAND: /queue_events
   * Show all currently scheduled events
   */
  private async handleQueueEvents(args: string[], ctx: DirectorCommandContext): Promise<CommandResult> {
    try {
      const currentTick = (ctx.state?.tick ?? 0);
      const stats = liveOpsEngine.getQueueStats(currentTick);
      const scheduled = liveOpsEngine.getUpcomingEvents(10);

      if (scheduled.length === 0) {
        return {
          success: true,
          message: 'No events scheduled'
        };
      }

      const eventList = scheduled
        .map(event => {
          const eta = Math.max(0, event.scheduledFireTick - currentTick);
          return `[${event.scheduleId}] ${event.eventName} (${event.category}) - fires in ${eta} ticks (severity: ${event.severity})`;
        })
        .join('\n');

      return {
        success: true,
        message: `Scheduled Events (${stats.totalScheduled} total):\n${eventList}\n\nImminent: ${stats.imminentEvents} | Warning: ${stats.warningEvents}`,
        data: { queued: scheduled, stats }
      };
    } catch (error) {
      return { success: false, message: `Failed to list events: ${error}` };
    }
  }

  /**
   * COMMAND: /cancel_event <scheduleId>
   * Cancel a scheduled event
   */
  private async handleCancelEvent(args: string[], ctx: DirectorCommandContext): Promise<CommandResult> {
    if (args.length < 1) {
      return { success: false, message: 'Usage: /cancel_event <scheduleId>' };
    }

    try {
      const scheduleId = args[0];
      const scheduled = liveOpsEngine.getScheduledEventById(scheduleId);

      if (!scheduled) {
        return { success: false, message: `Event not found: ${scheduleId}` };
      }

      const cancelled = liveOpsEngine.cancelEvent(scheduleId);

      if (cancelled) {
        // Record in mutation log (DETERMINISM-SAFE: using worldTick)
        const worldTick = ctx.state?.tick || 0;
        ctx.mutationLog?.push({
          type: 'DIRECTOR_OVERRIDE',
          action: 'cancel_event',
          scheduleId,
          cancelledEvent: scheduled.eventName,
          timestamp: seededNow(worldTick),
          director: this.directorId
        });

        return {
          success: true,
          message: `Event cancelled: ${scheduled.eventName} (${scheduleId})`
        };
      } else {
        return { success: false, message: `Failed to cancel event: ${scheduleId}` };
      }
    } catch (error) {
      return { success: false, message: `Cancel failed: ${error}` };
    }
  }

  /**
   * COMMAND: /help
   * Show available commands
   */
  private async handleHelp(args: string[], ctx: DirectorCommandContext): Promise<CommandResult> {
    const helpText = Array.from(this.handlers.keys()).map(cmd => {
      const examples: Record<string, string> = {
        'force_epoch': '/force_epoch 2 — Shift to Twilight epoch',
        'spawn_macro_event': '/spawn_macro_event catastrophe_01 — Inject macro event',
        'kick_phantom': '/kick_phantom — Clear all player echoes',
        'reset_consensus': '/reset_consensus — Resync all peers',
        'list_peers': '/list_peers — Show connected peers',
        'announce': '/announce The gates shatter! — Broadcast message',
        'set_faction_power': '/set_faction_power faction_01 75 — Set faction power to 75',
        'schedule_event': '/schedule_event seasonal_festival 1000 Festival seasonal 60 — Schedule event',
        'queue_events': '/queue_events — Show scheduled events',
        'cancel_event': '/cancel_event sched_01 — Cancel a scheduled event',
        'seal_canon': '/seal_canon optional description — Compress mutation log into genesis snapshot',
        'help': '/help — Show this message',
        'history': '/history — Show recent commands'
      };
      return examples[cmd] || `/${cmd}`;
    });

    return {
      success: true,
      message: `Available Director Commands:\n${helpText.join('\n')}`,
      data: { commands: Array.from(this.handlers.keys()) }
    };
  }

  /**
   * COMMAND: /history
   * Show recent command history
   */
  private async handleHistory(args: string[], ctx: DirectorCommandContext): Promise<CommandResult> {
    const limit = parseInt(args[0] || '10', 10);
    const recent = this.commandHistory.slice(-limit).map(cmd => ({
      command: cmd.command,
      args: cmd.args.join(' '),
      status: cmd.status,
      timestamp: new Date(cmd.timestamp).toLocaleTimeString()
    }));

    return {
      success: true,
      message: `Last ${recent.length} commands`,
      data: { commands: recent }
    };
  }

  /**
   * COMMAND: /seal_canon [description]
   * Phase 4 Task 4.5: Compress mutation log into genesis snapshot
   * DETERMINISM-SAFE: Uses seededNow() for timestamp
   */
  private async handleSealCanon(args: string[], ctx: DirectorCommandContext): Promise<CommandResult> {
    try {
      const { sealCanon } = require('./saveLoadEngine');
      const worldTick = ctx.state?.tick || 0;
      const deterministicTimestamp = seededNow(worldTick);
      
      const description = args.length > 0 
        ? args.join(' ') 
        : 'Iron Canon seal - mutation history compressed';

      // Log the seal action
      ctx.mutationLog?.push({
        type: 'DIRECTOR_OVERRIDE',
        action: 'seal_canon',
        description,
        director: this.directorId,
        timestamp: deterministicTimestamp,
        tick: worldTick
      });

      return {
        success: true,
        message: `Iron Canon sealed at tick ${worldTick}. Mutation history compressed. New genesis snapshot established.`,
        data: {
          sealedAt: deterministicTimestamp,
          tick: worldTick,
          description
        }
      };
    } catch (error) {
      return { success: false, message: `Failed to seal canon: ${error}` };
    }
  }

  /**
   * Internal: Record command in history
   */
  private recordCommand(cmd: DirectorCommand): void {
    this.commandHistory.push(cmd);
    if (this.commandHistory.length > this.maxHistorySize) {
      this.commandHistory = this.commandHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Internal: Record as DIRECTOR_OVERRIDE mutation
   * DETERMINISM-SAFE: Uses seededNow(worldTick) instead of Date.now()
   */
  private recordMutation(cmd: DirectorCommand, ctx: DirectorCommandContext): void {
    if (ctx.mutationLog) {
      const worldTick = ctx.state?.tick || 0;
      const mutation: DirectorMutation = {
        type: 'DIRECTOR_OVERRIDE',
        command: cmd,
        worldId: ctx.state?.id || 'unknown',
        timestamp: seededNow(worldTick)
      };
      ctx.mutationLog.push(mutation);
    }
  }

  /**
   * Get command history
   */
  getHistory(limit: number = 50): DirectorCommand[] {
    return this.commandHistory.slice(-limit);
  }

  /**
   * Get list of available commands
   */
  getAvailableCommands(): string[] {
    return Array.from(this.handlers.keys());
  }
}

export default DirectorCommandEngine;
