# AI Weaver Beta Testing & Validation Plan

**Date**: February 26, 2026  
**Status**: DRAFT  
**Phase**: BETA

---

## 1. Objective
Integrate the "AI Weaver" (Deployment AI Service) into the BETA runtime to test viability, latency, and narrative quality before full release. This ensures the BYOK (Bring Your Own Key) and Multi-provider strategy works in a live environment.

## 2. Technical Goals
- **Real-time Synthesis**: Transition from static stubs to live narrative generation for Character Origins and Quest Prologues.
- **Provider Resilience**: Verify fallback logic between Gemini (Primary) and Template-based mock responses.
- **Cost/Latency Audit**: Track token usage and response times to optimize player experience.
- **Prompt Isolation**: Test the "System Instructions" for the AI DM to ensure it adheres to the World Canon and 7-Stat limits.

## 3. Integration Targets

### 3.1 Character Awakening (Phase 5)
- **Input**: `originStory` text provided by the player.
- **AI Task**: Summarize the backstory and extract initial `SocialScars` or `ReputationModifiers`.
- **Validation**: Ensure the AI doesn't grant illegal starting items or impossible stats.

### 3.2 Quest Prologue (Phase 6)
- **Input**: Archetype, Location, and Faction status.
- **AI Task**: Synthesize a unique starting quest (The "Prologue Quest") that feels personal to the player's origin.
- **Validation**: Quest objectives must be mechanically actionable by the `QuestEngine`.

### 3.3 Dynamic NPC Dialogue
- **Input**: NPC Persona, World Paradox Level, and Player Reputation.
- **AI Task**: Generate context-aware dialogue that reflects the world's current state (e.g., glitchy speech if Paradox is high).

## 4. Testing & Stress Methods
1. **Connectivity Check**: `/api/ai/test` endpoint to verify API health.
2. **Backstory Stress**: Provide "chaotic" or "nonsense" backstories to see if the AI can gracefully handle or reject them while maintaining immersion.
3. **Latency Simulation**: Test how the UI handles 2-5 second delays during "The Weaver is thinking..." states.

## 5. Risk Assessment
| Risk | Mitigation |
|---|---|
| API Downtime | Automatic fallback to `MOCK` stubs or local `Template` responses. |
| Narrative Hallucination | Strict JSON schema output enforcement for AI responses. |
| Cost Overrun | Implement local caching via `DialogueCache` for repeated prompts. |

---

## 6. Success Criteria
- [ ] AI successfully interprets a player backstory and modifies initial repo.
- [ ] First "Prologue Quest" generated is valid and playable in the Quest Journal.
- [ ] UI provides immediate feedback during AI generation (loading states).
- [ ] Zero engine crashes during AI failure (graceful fallback).
