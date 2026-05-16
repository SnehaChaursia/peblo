import { nanoid } from 'nanoid';
import { db } from './db.js';

export function parseNote(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    tags: JSON.parse(row.tags || '[]'),
    summary: row.summary,
    action_items: JSON.parse(row.action_items || '[]'),
    suggested_title: row.suggested_title,
    is_archived: Boolean(row.is_archived),
    is_public: Boolean(row.is_public),
    share_id: row.share_id,
    ai_runs: row.ai_runs,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export function logActivity(userId, noteId, type) {
  db.prepare('INSERT INTO activity (user_id, note_id, type) VALUES (?, ?, ?)').run(userId, noteId, type);
}

export function getUserNote(userId, noteId) {
  return db.prepare('SELECT * FROM notes WHERE user_id = ? AND id = ?').get(userId, noteId);
}

export function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean);
  return String(tags || '')
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

export function createNote(userId) {
  const note = {
    id: `NOTE_${nanoid(10)}`,
    userId,
    title: 'Untitled',
    content: '',
    category: 'General',
    tags: '[]'
  };

  db.prepare(`
    INSERT INTO notes (id, user_id, title, content, category, tags)
    VALUES (@id, @userId, @title, @content, @category, @tags)
  `).run(note);
  logActivity(userId, note.id, 'created');

  return parseNote(getUserNote(userId, note.id));
}
