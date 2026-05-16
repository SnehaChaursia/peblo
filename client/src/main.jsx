import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Archive,
  Brain,
  CheckCircle2,
  Copy,
  FileText,
  Link,
  LogOut,
  Moon,
  Plus,
  Search,
  Sparkles,
  Tag,
  Zap
} from 'lucide-react';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:4000/api' : '/api');

function App() {
  const [session, setSession] = useState(() => JSON.parse(localStorage.getItem('peblo_session') || 'null'));
  const [route, setRoute] = useState(window.location.pathname);
  const [checkingSession, setCheckingSession] = useState(Boolean(session?.token));

  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!session?.token) {
      setCheckingSession(false);
      return;
    }

    fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${session.token}` }
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        const nextSession = { ...session, user: data.user };
        localStorage.setItem('peblo_session', JSON.stringify(nextSession));
        setSession(nextSession);
      })
      .catch(() => {
        localStorage.removeItem('peblo_session');
        setSession(null);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  if (route.startsWith('/shared/')) return <SharedNote shareId={route.split('/').pop()} />;
  if (checkingSession) return <main className="auth-page"><p className="empty">Loading workspace...</p></main>;

  return session ? (
    <Workspace session={session} setSession={setSession} />
  ) : (
    <AuthScreen setSession={setSession} />
  );
}

function useApi(session) {
  return async (path, options = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        ...options.headers
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Request failed');
    return data;
  };
}

function AuthScreen({ setSession }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const api = useApi();

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const data = await api(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(form)
      });
      localStorage.setItem('peblo_session', JSON.stringify(data));
      setSession(data);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="brand-row">
          <span className="brand-mark">P</span>
          <div>
            <h1>Peblo Notes</h1>
            <p>Collaborative AI notes workspace</p>
          </div>
        </div>

        <div className="segmented">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Signup</button>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && (
            <label>
              Name
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
          )}
          <label>
            Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength="8" required />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit">{mode === 'login' ? 'Login' : 'Create account'}</button>
        </form>
      </section>
    </main>
  );
}

function Workspace({ session, setSession }) {
  const api = useApi(session);
  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [noteView, setNoteView] = useState('active');
  const [insights, setInsights] = useState(null);
  const [saving, setSaving] = useState('Saved');
  const [aiLoading, setAiLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [error, setError] = useState('');

  const selectedNote = useMemo(() => notes.find((note) => note.id === selectedId), [notes, selectedId]);
  const allTags = useMemo(() => [...new Set(notes.flatMap((note) => note.tags))].sort(), [notes]);

  async function loadNotes() {
    const params = new URLSearchParams({
      search: query,
      tag: tagFilter,
      archived: noteView === 'active' ? 'false' : 'true'
    });
    const data = await api(`/notes?${params}`);
    const visibleNotes = data.notes.filter((note) => {
      if (noteView === 'archived') return note.is_archived;
      if (noteView === 'active') return !note.is_archived;
      return true;
    });
    setNotes(visibleNotes);
    if (!visibleNotes.some((note) => note.id === selectedId)) setSelectedId(visibleNotes[0]?.id || null);
  }

  async function loadInsights() {
    const data = await api('/insights');
    setInsights(data);
  }

  useEffect(() => {
    loadNotes().catch((err) => setError(err.message));
  }, [query, tagFilter, noteView]);

  useEffect(() => {
    loadInsights().catch(() => {});
  }, [notes.length]);

  useEffect(() => {
    setDraft(selectedNote || null);
    setShareUrl('');
  }, [selectedNote?.id]);

  useEffect(() => {
    if (!draft || !selectedNote) return;
    const changed =
      draft.title !== selectedNote.title ||
      draft.content !== selectedNote.content ||
      draft.category !== selectedNote.category ||
      draft.tags.join(',') !== selectedNote.tags.join(',');
    if (!changed) return;

    setSaving('Saving...');
    const timeout = setTimeout(async () => {
      try {
        const data = await api(`/notes/${draft.id}`, {
          method: 'PATCH',
          body: JSON.stringify(draft)
        });
        setNotes((items) => items.map((item) => (item.id === data.note.id ? data.note : item)));
        loadInsights().catch(() => {});
        setSaving('Saved');
      } catch (err) {
        setSaving('Not saved');
        setError(err.message);
      }
    }, 650);

    return () => clearTimeout(timeout);
  }, [draft]);

  async function createNewNote() {
    const data = await api('/notes', { method: 'POST' });
    setNoteView('active');
    setNotes([data.note, ...notes]);
    setSelectedId(data.note.id);
    loadInsights().catch(() => {});
  }

  async function toggleArchive() {
    if (!draft) return;
    const data = await api(`/notes/${draft.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_archived: !draft.is_archived })
    });
    const shouldStayVisible =
      noteView === 'all' ||
      (noteView === 'active' && !data.note.is_archived) ||
      (noteView === 'archived' && data.note.is_archived);
    const nextNotes = shouldStayVisible
      ? notes.map((note) => (note.id === data.note.id ? data.note : note))
      : notes.filter((note) => note.id !== data.note.id);
    setNotes(nextNotes);
    setSelectedId(shouldStayVisible ? data.note.id : nextNotes[0]?.id || null);
    setDraft(shouldStayVisible ? data.note : null);
    loadInsights().catch(() => {});
  }

  async function generateAI() {
    if (!draft) return;
    setAiLoading(true);
    setError('');
    try {
      const data = await api(`/notes/${draft.id}/generate-summary`, { method: 'POST' });
      setDraft(data.note);
      setNotes((items) => items.map((item) => (item.id === data.note.id ? data.note : item)));
      loadInsights().catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setAiLoading(false);
    }
  }

  async function toggleShare() {
    if (!draft) return;
    const data = await api(`/notes/${draft.id}/share`, {
      method: 'POST',
      body: JSON.stringify({ is_public: !draft.is_public })
    });
    const url = data.public_url ? data.public_url.replace('http://localhost:4000', window.location.origin) : '';
    setShareUrl(url);
    setDraft(data.note);
    setNotes((items) => items.map((item) => (item.id === data.note.id ? data.note : item)));
    loadInsights().catch(() => {});
  }

  function logout() {
    localStorage.removeItem('peblo_session');
    setSession(null);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="topbar">
          <div className="brand-row compact">
            <span className="brand-mark">P</span>
            <strong>Peblo</strong>
          </div>
          <button className="icon-button" onClick={logout} title="Logout"><LogOut size={18} /></button>
        </div>

        <div className="search-row">
          <Search size={17} />
          <input placeholder="Search notes" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
          <option value="">All tags</option>
          {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
        </select>

        <div className="view-tabs">
          <button className={noteView === 'active' ? 'active' : ''} onClick={() => setNoteView('active')}>Active</button>
          <button className={noteView === 'all' ? 'active' : ''} onClick={() => setNoteView('all')}>All</button>
          <button className={noteView === 'archived' ? 'active' : ''} onClick={() => setNoteView('archived')}>Archived</button>
        </div>

        <button className="primary new-note" onClick={createNewNote}><Plus size={18} /> New note</button>

        <div className="note-list">
          {notes.map((note) => (
            <button key={note.id} className={`note-card ${note.id === selectedId ? 'active' : ''}`} onClick={() => setSelectedId(note.id)}>
              <strong>{note.title}</strong>
              <span>{note.category}{note.is_archived ? ' · Archived' : ''}</span>
              <small>{new Date(note.updated_at).toLocaleString()}</small>
            </button>
          ))}
          {!notes.length && <p className="empty">No notes found.</p>}
        </div>
      </aside>

      <section className="editor">
        {draft ? (
          <>
            <header className="editor-header">
              <div>
                <input className="title-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                <span className="save-state"><CheckCircle2 size={15} /> {saving}</span>
              </div>
              <div className="actions">
                <button className="icon-button" onClick={generateAI} title="Generate AI summary" disabled={aiLoading}><Brain size={18} /></button>
                <button className="icon-button" onClick={toggleShare} title={draft.is_public ? 'Make private' : 'Create public link'}><Link size={18} /></button>
                <button className="icon-button" onClick={toggleArchive} title={draft.is_archived ? 'Restore note' : 'Archive note'}><Archive size={18} /></button>
              </div>
            </header>

            <div className="meta-grid">
              <label>
                Category
                <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
              </label>
              <label>
                Tags
                <input value={draft.tags.join(', ')} onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} />
              </label>
            </div>

            {draft.is_public && (shareUrl || draft.share_id) && (
              <div className="share-box">
                <span>{shareUrl || `${window.location.origin}/shared/${draft.share_id}`}</span>
                <button className="icon-button" onClick={() => navigator.clipboard.writeText(shareUrl || `${window.location.origin}/shared/${draft.share_id}`)} title="Copy link"><Copy size={17} /></button>
              </div>
            )}

            <textarea
              className="note-body"
              value={draft.content}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
              placeholder="Write meeting notes, lesson plans, ideas or project details..."
            />

            <section className="ai-panel">
              <div className="panel-title"><Sparkles size={18} /> AI output</div>
              {aiLoading ? (
                <p>Generating...</p>
              ) : draft.summary ? (
                <>
                  <p>{draft.summary}</p>
                  <strong>Action items</strong>
                  <ul>{draft.action_items.map((item) => <li key={item}>{item}</li>)}</ul>
                  <strong>Suggested title</strong>
                  <p>{draft.suggested_title}</p>
                </>
              ) : (
                <p>Generate a summary after adding note content.</p>
              )}
            </section>
          </>
        ) : (
          <div className="empty editor-empty"><FileText size={42} /> Create a note to begin.</div>
        )}
      </section>

      <aside className="insights">
        <div className="profile">
          <Moon size={18} />
          <div>
            <strong>{session.user.name}</strong>
            <span>{session.user.email}</span>
          </div>
        </div>

        <Metric icon={<FileText size={19} />} label="Total notes" value={insights?.total_notes ?? 0} onClick={() => setNoteView('all')} />
        <Metric icon={<Archive size={19} />} label="Archived" value={insights?.archived_notes ?? 0} onClick={() => setNoteView('archived')} />
        <Metric icon={<Zap size={19} />} label="AI runs" value={insights?.ai_usage?.total_runs ?? 0} />

        <section className="side-panel">
          <div className="panel-title"><FileText size={17} /> Recently edited</div>
          {(insights?.recently_edited || []).map((note) => (
            <button className="recent-note" key={note.id} onClick={() => setSelectedId(note.id)}>
              <span>{note.title}</span>
              <small>{new Date(note.updated_at).toLocaleString()}</small>
            </button>
          ))}
          {!insights?.recently_edited?.length && <p className="empty">Edited notes will appear here.</p>}
        </section>

        <section className="side-panel">
          <div className="panel-title"><Tag size={17} /> Top tags</div>
          {(insights?.most_used_tags || []).map((item) => (
            <div className="tag-row" key={item.tag}><span>{item.tag}</span><strong>{item.count}</strong></div>
          ))}
          {!insights?.most_used_tags?.length && <p className="empty">Tags will appear here.</p>}
        </section>

        <section className="side-panel">
          <div className="panel-title">Weekly activity</div>
          <div className="bars">
            {(insights?.weekly_activity || []).map((day) => (
              <div className="bar" key={day.day} title={`${day.day}: ${day.count}`}>
                <span style={{ height: `${Math.max(12, day.count * 18)}px` }} />
                <small>{new Date(day.day).toLocaleDateString(undefined, { weekday: 'short' })}</small>
              </div>
            ))}
          </div>
        </section>

        {error && <p className="error">{error}</p>}
      </aside>
    </main>
  );
}

function Metric({ icon, label, value, onClick }) {
  const TagName = onClick ? 'button' : 'div';
  return (
    <TagName className={`metric ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </TagName>
  );
}

function SharedNote({ shareId }) {
  const [note, setNote] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/shared/${shareId}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        setNote(data.note);
      })
      .catch((err) => setError(err.message));
  }, [shareId]);

  return (
    <main className="shared-page">
      {note ? (
        <article className="shared-note">
          <span className="brand-mark">P</span>
          <h1>{note.title}</h1>
          <div className="shared-tags">
            <span>{note.category}</span>
            {note.tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          <pre>{note.content}</pre>
          {note.summary && <section><h2>AI summary</h2><p>{note.summary}</p></section>}
        </article>
      ) : (
        <p className="empty">{error || 'Loading shared note...'}</p>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
