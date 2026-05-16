function localSummary(content) {
  const text = content.replace(/\s+/g, ' ').trim();
  const sentences = text.match(/[^.!?]+[.!?]?/g) || [];
  return sentences.slice(0, 2).join(' ').trim() || 'No summary available yet.';
}

function localActionItems(content) {
  const lines = content
    .split(/\n+/)
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

  const signals = /(todo|action|follow up|prepare|review|send|create|finish|schedule|call|share|update)/i;
  return lines.filter((line) => signals.test(line)).slice(0, 6);
}

function localTitle(content) {
  const firstLine = content.split('\n').find((line) => line.trim());
  if (!firstLine) return 'Untitled Note';
  return firstLine.replace(/^#+\s*/, '').trim().slice(0, 60);
}

function cleanJson(value) {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('AI response was not valid JSON');
  return JSON.parse(value.slice(start, end + 1));
}

export async function generateNoteAI({ title, content }) {
  if (!process.env.GROQ_API_KEY) {
    return {
      summary: localSummary(content),
      action_items: localActionItems(content),
      suggested_title: title === 'Untitled' ? localTitle(content) : title
    };
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Return only JSON with summary, action_items, and suggested_title. Keep it concise and useful for a notes app.'
        },
        {
          role: 'user',
          content: `Title: ${title}\n\nNote:\n${content}`
        }
      ]
    })
  });

  if (!response.ok) throw new Error('AI provider request failed');
  const data = await response.json();
  const parsed = cleanJson(data.choices?.[0]?.message?.content || '{}');

  return {
    summary: parsed.summary || localSummary(content),
    action_items: Array.isArray(parsed.action_items) ? parsed.action_items.slice(0, 8) : [],
    suggested_title: parsed.suggested_title || localTitle(content)
  };
}
