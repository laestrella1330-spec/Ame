/**
 * WarmUp Agent
 *
 * Generates a shared icebreaker prompt for two matched users.
 * Called immediately after createMatch(). Result is emitted to both sockets.
 * Falls back to a curated static prompt if the AI call fails or is disabled.
 *
 * Uses claude-haiku for low-latency (target < 800ms).
 */
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

export interface WarmUpResult {
  icebreaker: string;
  topic: string;
  source: 'ai' | 'static';
}

// Static fallbacks — always available even without an API key
const STATIC_PROMPTS: WarmUpResult[] = [
  { icebreaker: "If you could instantly learn any skill right now, what would it be?", topic: "Dreams & Skills", source: 'static' },
  { icebreaker: "What's something small that made you smile today?", topic: "Good Vibes", source: 'static' },
  { icebreaker: "What's your go-to comfort food when you need a pick-me-up?", topic: "Food & Comfort", source: 'static' },
  { icebreaker: "If you could travel anywhere tomorrow, where would you go?", topic: "Travel", source: 'static' },
  { icebreaker: "What's a show or movie you'd recommend to a stranger?", topic: "Entertainment", source: 'static' },
  { icebreaker: "What song is stuck in your head lately?", topic: "Music", source: 'static' },
  { icebreaker: "Morning person or night owl — and is it by choice?", topic: "Lifestyle", source: 'static' },
  { icebreaker: "What's a random hobby you've picked up recently?", topic: "Hobbies", source: 'static' },
  { icebreaker: "What would your perfect Saturday look like?", topic: "Weekends", source: 'static' },
  { icebreaker: "If you could have dinner with any fictional character, who'd you pick?", topic: "Pop Culture", source: 'static' },
];

function getTimeOfDay(): string {
  const hour = new Date().getUTCHours();
  if (hour < 6)  return 'late night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

function randomStatic(): WarmUpResult {
  return STATIC_PROMPTS[Math.floor(Math.random() * STATIC_PROMPTS.length)];
}

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!config.anthropicApiKey) return null;
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: config.anthropicApiKey });
  return anthropicClient;
}

export async function generateWarmUp(): Promise<WarmUpResult> {
  const client = getClient();
  if (!client) return randomStatic();

  const timeOfDay = getTimeOfDay();

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{
        role: 'user',
        content: `Generate ONE fun, friendly icebreaker question for two strangers starting a random video chat at ${timeOfDay}.
Keep it light, non-invasive, positive. Avoid politics, religion, relationships.
Return ONLY valid JSON (no markdown): {"icebreaker":"...","topic":"..."}`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    // Strip any accidental markdown fences
    const json = text.replace(/^```json?\s*/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(json) as { icebreaker: string; topic: string };
    if (!parsed.icebreaker || !parsed.topic) throw new Error('bad shape');
    return { ...parsed, source: 'ai' };
  } catch {
    return randomStatic();
  }
}
