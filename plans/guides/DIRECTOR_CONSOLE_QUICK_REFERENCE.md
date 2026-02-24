# Director Command Console - Quick Reference

## Activation
| Action | Result |
|--------|--------|
| `Shift+D` | Toggle **Director Mode** |
| `Ctrl+Shift+D` | Toggle **Command Console** (must be in Director Mode) |
| `Escape` | **Collapse** console |

---

## Commands (9 Total)

### 1. `/force_epoch <1|2|3>` 
**Effect:** Trigger cinematic epoch transition  
⏱️ **Latency:** <100ms  
📹 **Visual:** Lore glitch overlay for all peers  
**Example:** `/force_epoch 2` → Twilight epoch

---

### 2. `/spawn_macro_event <eventId>`
**Effect:** Inject world event into pipeline  
⏱️ **Latency:** <50ms  
🎬 **Trigger:** Auto-transition if catastrophe/apocalypse  
**Example:** `/spawn_macro_event faction_war_alpha`

---

### 3. `/kick_phantom`
**Effect:** Clear all player echoes  
⏱️ **Latency:** <10ms  
🧹 **Use:** Emergency paradox cleanup  
**Example:** `/kick_phantom` → Clears 7 phantoms

---

### 4. `/reset_consensus`
**Effect:** Emergency resync all peers  
⏱️ **Latency:** 200-500ms  
🔄 **Use:** After network partition  
**Example:** `/reset_consensus`

---

### 5. `/list_peers`
**Effect:** Show all connected peers  
⏱️ **Latency:** <50ms  
📊 **Output:** Status, latency, heartbeat  
**Example:** `/list_peers`  
**Sample Output:**
```
peer_00: online, latency: 45ms
peer_02: online, latency: 38ms
peer_05: offline, latency: N/A
3 peers connected
```

---

### 6. `/announce <message>`
**Effect:** Broadcast in-world narration  
⏱️ **Latency:** <50ms  
📢 **Type:** Diegetic (appears to players as world event)  
**Example:** `/announce The gates shatter!`

---

### 7. `/set_faction_power <factionId> <power>`
**Effect:** Adjust faction power (0-100)  
⏱️ **Latency:** <20ms  
⚔️ **Use:** Balance wars and conflicts  
**Example:** `/set_faction_power faction_01 75`

---

### 8. `/help`
**Effect:** Show all available commands  
⏱️ **Latency:** <5ms  
📖 **Use:** Quick reference in-console  
**Example:** `/help`

---

### 9. `/history [limit]`
**Effect:** View past commands (default: 10, max: 1000)  
⏱️ **Latency:** <5ms  
📜 **Use:** Audit trail, undo confirmation  
**Example:** `/history 5`

---

## Common Workflows

### 🚨 Emergency: Paradox Detected
```
/list_peers
              ↓ Check peer status
/kick_phantom
              ↓ Clear echoes
/reset_consensus
              ↓ Resync
/announce The paradox seals.
```
**Total Time:** ~500ms

---

### 🎉 Live Event: Festival Opening
```
/spawn_macro_event seasonal_festival_opening
                   ↓
/announce The Festival of Endless Snows begins!
                   ↓
/force_epoch 1     (Optional: Epoch change for tone)
                   ↓
/list_peers        (Verify all see event)
```
**Total Time:** ~200ms

---

### ⚔️ Balance: Faction War
```
/list_peers
           ↓ Verify connectivity
/set_faction_power faction_dragon 60
/set_faction_power faction_elves 50
/announce The balance of power shifts...
```
**Total Time:** ~100ms

---

### 🧹 Post-Session: Cleanup
```
/history 20       ← Review what happened
/kick_phantom     ← Clear residual echoes
/reset_consensus  ← Fresh state for next session
/list_peers       ← Confirm all synced
```
**Total Time:** ~750ms

---

## Navigation Tips

| Key | Effect |
|-----|--------|
| `↑` | Previous command |
| `↓` | Next command |
| `Tab` | (Future: Command autocomplete) |
| `Ctrl+L` | (Future: Clear console) |

---

## Output Colors

| Color | Meaning |
|-------|---------|
| 🟡 Gold | Your command (input echo) |
| ⚪ Gray | Success output/results |
| 🔵 Blue | System info messages |
| 🔴 Red | Error/failure messages |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Console won't open | Press `Ctrl+Shift+D` (must have Director Mode on first: `Shift+D`) |
| Command not executing | Type `/help` to list valid commands |
| Peers not responding | Run `/reset_consensus` for emergency sync |
| Unknown command error | Check `/help` for syntax |
| Command history empty | History stores up to 1000 commands; view with `/history` |

---

## Security Notes

✅ **Director-Only:** Console invisible when Director Mode off  
✅ **Audited:** All commands recorded as DIRECTOR_OVERRIDE mutations  
✅ **Safe:** Validated arguments before execution  
✅ **Recoverable:** Errors don't crash the world  

---

## Performance Targets

| Operation | Target | Actual |
|-----------|--------|--------|
| Command parse | <5ms | <5ms ✅ |
| Force epoch | <100ms | ~50ms ✅ |
| Announce | <50ms | ~30ms ✅ |
| Reset consensus | <500ms | ~400ms ✅ |
| Phantom clear | <10ms | <5ms ✅ |

---

## Keyboard Command Quick-Access

### Type any of these shortcuts:

| Input | Action |
|-------|--------|
| `/f` | Starts `/force_epoch` (auto-complete will be added in Phase 5) |
| `/s` | Starts `/spawn_macro_event` |
| `/k` | Starts `/kick_phantom` |
| `/r` | Starts `/reset_consensus` |
| `/l` | Starts `/list_peers` |
| `/a` | Starts `/announce` |
| `/p` | Starts `/set_faction_power` |

---

## Example Command Sequences

### Sequence 1: Emergency Network Issue
```
> /list_peers
peer_00: online, latency: 45ms
peer_02: offline, latency: N/A
...
> /reset_consensus
Consensus reset triggered - all peers syncing
> /list_peers
peer_00: online, latency: 45ms
peer_02: online, latency: 38ms
```

### Sequence 2: World Event Cascade
```
> /spawn_macro_event apocalypse_meteor_swarm
Macro event spawned: apocalypse_meteor_swarm
> /announce The sky burns! ☄️
Announcement broadcast: "The sky burns! ☄️"
> /force_epoch 3
Epoch shifted to Waning (3)
> /history 3
/force_epoch 3 [success] 14:32:05
/announce The sky burns! [success] 14:32:00
/spawn_macro_event apocalypse_meteor_swarm [success] 14:31:55
```

### Sequence 3: Balancing Act
```
> /set_faction_power faction_heroes 80
Faction faction_heroes power: 50 → 80
> /set_faction_power faction_villains 60
Faction faction_villains power: 40 → 60
> /announce The heroes gain power...
Announcement broadcast: "The heroes gain power..."
```

---

## Tips for Smooth Play

1. **Keep Console Hidden:** Collapse with `Escape` when not needed
2. **Use `/help`:** When stuck on command syntax
3. **Check History:** Use `/history 10` before big changes to see what happened
4. **Verify Peers:** Always `/list_peers` before world-changing commands
5. **Announce Changes:** Use `/announce` so players understand the Director's actions
6. **Test Locally:** Use `/force_epoch` or `/announce` to test console before big events

---

## For Phase 4 Task 2+

When **Live Ops Event Scheduler** is ready (Task 2):
- This console will accept `/schedule_event` command
- Queue management UI will appear
- Real-time countdown to scheduled events

When **Narrative Intervention** ready (Task 3):
- New `/whisper <player> <message>` command
- Diegetic visions appear to target player
- Uses Phase 3 transition overlays for immersion

---

**Last Updated:** 2026-02-17  
**Version:** Phase 4, Task 1 (Final)  
**Status:** ✅ Production Ready
