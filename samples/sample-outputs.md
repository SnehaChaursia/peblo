# Sample Outputs

## Note Object

```json
{
  "id": "NOTE_9vLwQ2f4kx",
  "title": "Sprint Planning Notes",
  "content": "Review API structure...\nPrepare UI mockups...",
  "category": "Work",
  "tags": ["planning", "api"],
  "summary": "The note captures sprint planning decisions around API structure and UI mockups.",
  "action_items": ["Review API structure", "Prepare UI mockups"],
  "suggested_title": "Sprint Planning Notes",
  "is_archived": false,
  "is_public": true,
  "share_id": "SHARE_VyHk4rM1dX2a",
  "ai_runs": 1,
  "updated_at": "2026-05-17 00:55:20"
}
```

## AI Response

```json
{
  "summary": "The team discussed sprint priorities, API design and the first version of the notes workspace UI.",
  "action_items": [
    "Prepare UI mockups",
    "Review API structure",
    "Share demo notes with the team"
  ],
  "suggested_title": "Sprint Planning Notes"
}
```

## Insights Response

```json
{
  "total_notes": 8,
  "archived_notes": 2,
  "most_used_tags": [
    { "tag": "planning", "count": 4 },
    { "tag": "research", "count": 3 }
  ],
  "ai_usage": {
    "total_runs": 6,
    "notes_with_summary": 5
  },
  "weekly_activity": [
    { "day": "2026-05-11", "count": 2 },
    { "day": "2026-05-12", "count": 5 }
  ]
}
```

## Database Schema

```sql
users(id, name, email, password_hash, created_at)
notes(id, user_id, title, content, category, tags, summary, action_items, suggested_title, is_archived, is_public, share_id, ai_runs, created_at, updated_at)
activity(id, user_id, note_id, type, created_at)
```
