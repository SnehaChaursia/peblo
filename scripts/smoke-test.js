const API_URL = process.env.API_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: ${data.message || response.statusText}`);
  return data;
}

function pass(name, extra = '') {
  console.log(`PASS ${name}${extra ? ` - ${extra}` : ''}`);
}

async function main() {
  const email = `smoke-${Date.now()}@example.com`;
  const password = 'password123';

  const signup = await request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: 'Smoke User', email, password })
  });
  if (!signup.token || !signup.user?.id) throw new Error('Signup did not return a session');
  pass('signup and persistent token');

  const token = signup.token;
  const authHeaders = { Authorization: `Bearer ${token}` };

  const protectedResponse = await fetch(`${API_URL}/notes`);
  if (protectedResponse.status !== 401) throw new Error('Notes route is not protected');
  pass('protected notes route');

  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  if (!login.token) throw new Error('Login did not return a token');
  pass('login');

  const created = await request('/notes', { method: 'POST', headers: authHeaders });
  const note = created.note;
  if (!note.id || note.title !== 'Untitled') throw new Error('Note creation failed');
  pass('create note');

  const untitledCreated = await request('/notes', { method: 'POST', headers: authHeaders });
  const untitled = await request(`/notes/${untitledCreated.note.id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      content: 'Budget review for Peblo launch. Share updated cost plan.\nSchedule design review.'
    })
  });
  const titledByAi = await request(`/notes/${untitled.note.id}/generate-summary`, {
    method: 'POST',
    headers: authHeaders
  });
  if (!titledByAi.note.title || titledByAi.note.title === 'Untitled') {
    throw new Error('AI did not apply a title to an untitled note');
  }
  pass('AI applies title to untitled note');

  const updated = await request(`/notes/${note.id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Sprint Planning Notes',
      content: 'Sprint planning for Peblo notes. Prepare UI mockups.\nReview API structure.',
      category: 'Work',
      tags: ['planning', 'api']
    })
  });
  if (!updated.note.tags.includes('planning') || updated.note.category !== 'Work') {
    throw new Error('Tags or category were not saved');
  }
  pass('edit note with tags and category');

  const ai = await request(`/notes/${note.id}/generate-summary`, {
    method: 'POST',
    headers: authHeaders
  });
  if (!ai.note.summary || !Array.isArray(ai.note.action_items) || !ai.note.suggested_title) {
    throw new Error('AI output is incomplete');
  }
  pass('AI summary, action items and suggested title');

  const searched = await request('/notes?search=Sprint&tag=planning', { headers: authHeaders });
  if (!searched.notes.some((item) => item.id === note.id)) throw new Error('Search and tag filter did not find the note');
  const sorted = searched.notes.every((item, index, items) => {
    if (index === 0) return true;
    return new Date(items[index - 1].updated_at) >= new Date(item.updated_at);
  });
  if (!sorted) throw new Error('Notes are not sorted by latest update');
  pass('keyword search, tag filter and recent sorting');

  const shared = await request(`/notes/${note.id}/share`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ is_public: true })
  });
  if (!shared.note.is_public || !shared.note.share_id) throw new Error('Public share was not enabled');
  const publicNote = await request(`/shared/${shared.note.share_id}`);
  if (publicNote.note.title !== 'Sprint Planning Notes') throw new Error('Public shared note did not load');
  pass('public share page data');

  const privateShare = await request(`/notes/${note.id}/share`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ is_public: false })
  });
  if (privateShare.note.is_public) throw new Error('Private visibility was not restored');
  const privateResponse = await fetch(`${API_URL}/shared/${shared.note.share_id}`);
  if (privateResponse.status !== 404) throw new Error('Private shared note is still publicly accessible');
  pass('public/private visibility');

  const archived = await request(`/notes/${note.id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ is_archived: true })
  });
  if (!archived.note.is_archived) throw new Error('Archive did not persist');
  pass('archive note');

  const insights = await request('/insights', { headers: authHeaders });
  if (!Array.isArray(insights.recently_edited) || !Array.isArray(insights.most_used_tags) || !insights.ai_usage) {
    throw new Error('Insights response is incomplete');
  }
  pass('productivity insights');

  console.log('Smoke test complete');
}

main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exit(1);
});
