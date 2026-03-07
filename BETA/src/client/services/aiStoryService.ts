/**
 * AI Story Generation Service
 * Generates and refines character origin stories using LLM API
 */

export interface StoryGenerationRequest {
  archetype: string;
  race: string;
  characterName: string;
  additionalContext?: string;
}

export interface StoryRefinementRequest {
  currentStory: string;
  refinementPrompt: string;
  archetype: string;
}

/**
 * Generate an origin story based on character archetype and details
 */
export async function generateOriginStory(req: StoryGenerationRequest): Promise<string> {
  const { archetype, race, characterName, additionalContext } = req;

  const systemPrompt = `You are a creative fantasy writer specializing in character backstories. 
Generate immersive, concise yet evocative origin stories for tabletop RPG characters. 
Stories should be 100-200 characters, written in first person, and capture the essence of the character's archetype.
Keep the tone dark and mystical, befitting a fantasy setting.`;

  const userPrompt = `Generate an origin story for:
- Character Name: ${characterName}
- Race: ${race}
- Archetype: ${archetype}
${additionalContext ? `- Additional Context: ${additionalContext}` : ''}

Write a compelling first-person backstory that explains how they arrived at this moment. Be creative and evocative.`;

  try {
    const response = await callLlmApi(systemPrompt, userPrompt);
    // Extract just the text content, limiting to 500 characters
    const cleanedText = response.trim();
    return cleanedText.substring(0, 500);
  } catch (error) {
    console.error('Failed to generate story:', error);
    throw new Error('Failed to generate origin story. Please try again or write your own.');
  }
}

/**
 * Refine an existing story based on user feedback
 */
export async function refineOriginStory(req: StoryRefinementRequest): Promise<string> {
  const { currentStory, refinementPrompt, archetype } = req;

  const systemPrompt = `You are a creative fantasy writer specializing in refining character backstories. 
Improve stories based on user feedback while maintaining immersion and fitting the character archetype.
Keep refined stories between 100-200 words, written in first person.`;

  const userPrompt = `Please refine this origin story for a ${archetype}:

Current Story: "${currentStory}"

Refinement Request: ${refinementPrompt}

Provide an improved version that incorporates the feedback while keeping it within 100-200 words.`;

  try {
    const response = await callLlmApi(systemPrompt, userPrompt);
    const cleanedText = response.trim();
    return cleanedText.substring(0, 500);
  } catch (error) {
    console.error('Failed to refine story:', error);
    throw new Error('Failed to refine origin story. Please try again.');
  }
}

/**
 * Phase 7: Narrative Interpretation
 * Analyzes a backstory to extract faction tensions and world state seeds.
 */
export async function analyzeStoryForSeeds(story: string, archetype: string): Promise<any> {
  const systemPrompt = `You are the Eye of the Weaver, an AI engine for a high-fidelity RPG. 
Your task is to analyze a player's backstory and extract mechanical seeds for the world state.
Focus specifically on identifying factions the player might have history with and the nature of their relationship.
Factions include: 'noble-house', 'merchant-guild', 'arcane-lodge', 'mercenary-band', 'city-watch', 'clergy', 'druid-circle', 'outcasts', 'traveler-camp', 'shadow-syndicate'.
Output MUST be valid JSON in this format:
{
  "reputation": { "faction-id": repModValue (-50 to 50) },
  "startingLocations": ["location-id"],
  "narrativeFlags": { "flag-name": true },
  "reasoning": "short explanation"
}`;

  const userPrompt = `Analyze this backstory for a ${archetype}:
"${story}"

Extract the corresponding faction reputation modifiers and any narrative seeds.`;

  try {
    const response = await callLlmApi(systemPrompt, userPrompt);
    // Attempt to parse JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not parse AI response as JSON');
  } catch (error) {
    console.warn('AI seed analysis failed, using fallback:', error);
    return { 
      reputation: {}, 
      startingLocations: [], 
      narrativeFlags: { "ai-analysis-failed": true },
      reasoning: "Fallback to static analysis" 
    };
  }
}

/**
 * Call LLM API (supports multiple providers)
 * Falls back gracefully if API is unavailable
 */
async function callLlmApi(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY;
  
  // If no API key, return a placeholder message
  if (!apiKey) {
    console.warn('No LLM API key configured. Using placeholder story.');
    return generatePlaceholderStory();
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 256,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || generatePlaceholderStory();
  } catch (error) {
    console.error('LLM API call failed:', error);
    return generatePlaceholderStory();
  }
}

/**
 * Generate a placeholder story when AI is unavailable
 */
function generatePlaceholderStory(): string {
  const placeholders = [
    "I was born in shadow, raised by fate, and now awakened to something greater than myself.",
    "My path was long and winding, filled with choices and consequences that led me to this moment.",
    "Destiny called in whispers, and I answered with all the strength my soul could muster.",
    "I am a child of circumstance and will, shaped by forces beyond mortal comprehension.",
    "From the ashes of my old life, I rise anew, seeking purpose in an uncertain world.",
  ];
  return placeholders[Math.floor(Math.random() * placeholders.length)];
}
