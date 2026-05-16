import { describe, expect, it } from 'vitest';
import { generateNoteAI } from './ai.js';

describe('generateNoteAI fallback', () => {
  it('returns summary, action items and title without an API key', async () => {
    const previousKey = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;

    const result = await generateNoteAI({
      title: 'Untitled',
      content: 'Sprint planning for the notes app. Prepare UI mockups.\nReview API structure.'
    });

    if (previousKey) process.env.GROQ_API_KEY = previousKey;

    expect(result.summary).toContain('Sprint planning');
    expect(result.action_items.some((item) => item.includes('Prepare UI mockups'))).toBe(true);
    expect(result.suggested_title).toContain('Sprint planning');
  });
});
