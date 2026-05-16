import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { nanoid } from 'nanoid';
import { createUser, requireAuth, signToken, verifyLogin } from './auth.js';
import { db } from './db.js';
import { generateNoteAI } from './ai.js';
import { createNote, getUserNote, logActivity, normalizeTags, parseNote } from './notes.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.post('/api/auth/signup', (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 8) {
      return res.status(400).json({ message: 'Name, email and an 8 character password are required' });
    }
    const user = createUser({ name, email, password });
    res.status(201).json({ user, token: signToken(user) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', (req, res, next) => {
  try {
    const user = verifyLogin(req.body);
    res.json({ user, token: signToken(user) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/notes', requireAuth, (req, res) => {
  const search = String(req.query.search || '').trim().toLowerCase();
  const tag = String(req.query.tag || '').trim().toLowerCase();
  const includeArchived = req.query.archived === 'true';

  const rows = db
    .prepare(
      `SELECT * FROM notes
       WHERE user_id = ? AND (? = 1 OR is_archived = 0)
       ORDER BY datetime(updated_at) DESC`
    )
    .all(req.user.id, includeArchived ? 1 : 0);

  const notes = rows.map(parseNote).filter((note) => {
    const matchesSearch =
      !search ||
      note.title.toLowerCase().includes(search) ||
      note.content.toLowerCase().includes(search) ||
      note.category.toLowerCase().includes(search);
    const matchesTag = !tag || note.tags.includes(tag);
    return matchesSearch && matchesTag;
  });

  res.json({ notes });
});

app.post('/api/notes', requireAuth, (req, res) => {
  res.status(201).json({ note: createNote(req.user.id) });
});

app.patch('/api/notes/:id', requireAuth, (req, res) => {
  const note = getUserNote(req.user.id, req.params.id);
  if (!note) return res.status(404).json({ message: 'Note not found' });

  const fields = {
    title: req.body.title ?? note.title,
    content: req.body.content ?? note.content,
    category: req.body.category ?? note.category,
    tags: req.body.tags === undefined ? note.tags : JSON.stringify(normalizeTags(req.body.tags)),
    isArchived: req.body.is_archived === undefined ? note.is_archived : Number(Boolean(req.body.is_archived))
  };

  db.prepare(`
    UPDATE notes
    SET title = @title,
        content = @content,
        category = @category,
        tags = @tags,
        is_archived = @isArchived,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = @userId AND id = @id
  `).run({ ...fields, userId: req.user.id, id: req.params.id });

  logActivity(req.user.id, req.params.id, 'edited');
  res.json({ note: parseNote(getUserNote(req.user.id, req.params.id)) });
});

app.post('/api/notes/:id/generate-summary', requireAuth, async (req, res, next) => {
  try {
    const note = getUserNote(req.user.id, req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (!note.content.trim()) return res.status(400).json({ message: 'Write note content before generating AI output' });

    const ai = await generateNoteAI({ title: note.title, content: note.content });
    const nextTitle = !note.title.trim() || note.title.trim().toLowerCase() === 'untitled' ? ai.suggested_title : note.title;
    db.prepare(`
      UPDATE notes
      SET title = @title,
          summary = @summary,
          action_items = @actionItems,
          suggested_title = @suggestedTitle,
          ai_runs = ai_runs + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = @userId AND id = @id
    `).run({
      title: nextTitle,
      summary: ai.summary,
      actionItems: JSON.stringify(ai.action_items),
      suggestedTitle: ai.suggested_title,
      userId: req.user.id,
      id: req.params.id
    });

    logActivity(req.user.id, req.params.id, 'ai_generated');
    res.json({ note: parseNote(getUserNote(req.user.id, req.params.id)), ai });
  } catch (error) {
    next(error);
  }
});

app.post('/api/notes/:id/share', requireAuth, (req, res) => {
  const note = getUserNote(req.user.id, req.params.id);
  if (!note) return res.status(404).json({ message: 'Note not found' });

  const shareId = note.share_id || `SHARE_${nanoid(12)}`;
  const isPublic = req.body.is_public === undefined ? 1 : Number(Boolean(req.body.is_public));
  db.prepare(`
    UPDATE notes
    SET is_public = ?, share_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND id = ?
  `).run(isPublic, shareId, req.user.id, req.params.id);

  const publicUrl = isPublic ? `${req.protocol}://${req.get('host')}/shared/${shareId}` : null;
  res.json({ note: parseNote(getUserNote(req.user.id, req.params.id)), public_url: publicUrl });
});

app.get('/api/shared/:shareId', (req, res) => {
  const row = db.prepare('SELECT title, content, category, tags, summary, action_items, updated_at FROM notes WHERE share_id = ? AND is_public = 1').get(req.params.shareId);
  if (!row) return res.status(404).json({ message: 'Shared note not found' });
  res.json({ note: parseNote({ ...row, id: null, is_archived: 0, is_public: 1, share_id: req.params.shareId, ai_runs: 0, created_at: row.updated_at }) });
});

app.get('/api/insights', requireAuth, (req, res) => {
  const notes = db
    .prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY datetime(updated_at) DESC')
    .all(req.user.id)
    .map(parseNote);
  const activeNotes = notes.filter((note) => !note.is_archived);
  const tagCounts = new Map();
  notes.forEach((note) => note.tags.forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)));

  const activityRows = db
    .prepare(
      `SELECT date(created_at) AS day, COUNT(*) AS count
       FROM activity
       WHERE user_id = ? AND datetime(created_at) >= datetime('now', '-6 days')
       GROUP BY date(created_at)
       ORDER BY day ASC`
    )
    .all(req.user.id);

  res.json({
    total_notes: notes.length,
    active_notes: activeNotes.length,
    archived_notes: notes.length - activeNotes.length,
    recently_edited: activeNotes.slice(0, 5),
    most_used_tags: [...tagCounts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
    ai_usage: {
      total_runs: notes.reduce((sum, note) => sum + note.ai_runs, 0),
      notes_with_summary: notes.filter((note) => note.summary).length
    },
    weekly_activity: activityRows
  });
});

app.use(express.static(path.resolve(__dirname, '../dist')));
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../dist/index.html'));
});

app.use((error, req, res, next) => {
  res.status(error.status || 500).json({ message: error.message || 'Something went wrong' });
});

app.listen(port, () => {
  console.log(`Peblo Notes API running on http://localhost:${port}`);
});
