# Question Caching System

## Overview
The application now includes an intelligent caching system to improve performance and reduce unnecessary API calls to Supabase.

## How It Works

### 1. **Automatic Caching**
- When questions are fetched from Supabase, they are automatically cached in the browser's localStorage
- Cache duration: **1 hour** (configurable in `QuestionContext.js`)
- On subsequent page loads, if valid cache exists, questions load instantly from cache

### 2. **Multi-Batch Fetching**
- Overcomes Supabase's 1000-row limit by fetching questions in batches
- Fetches 1000 questions at a time until all questions are retrieved
- Progress is logged in the browser console

### 3. **Cache Invalidation**
Cache is automatically cleared when:
- A new question is added
- A question is updated
- A question is deleted
- Cache expires (after 1 hour)

### 4. **Manual Refresh**
Users can manually refresh questions from the database:
- Click the "🔄 Refresh from DB" button in the header
- This clears the cache and fetches fresh data from Supabase

## Benefits

✅ **Faster Load Times**: Questions load instantly from cache
✅ **Reduced API Calls**: Fewer requests to Supabase
✅ **Better UX**: No waiting for database queries on every page load
✅ **Offline-Ready**: Cached questions available even with slow/no connection

## Configuration

To modify cache duration, edit `CACHE_DURATION` in `src/context/QuestionContext.js`:

```javascript
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour in milliseconds
```

Examples:
- 30 minutes: `1000 * 60 * 30`
- 2 hours: `1000 * 60 * 120`
- 24 hours: `1000 * 60 * 60 * 24`

## Cache Storage Keys

- `questions_cache`: Stores the question data
- `questions_cache_timestamp`: Stores when the cache was created

## Developer Notes

### Context Methods
The following methods are available via `useQuestions()` hook:

- `refreshQuestions()`: Force refresh from database
- `clearCache()`: Clear the cache manually

### Console Logs
Monitor cache activity in the browser console:
- "Loaded X questions from cache (age: X minutes)"
- "Cache expired, will fetch fresh data"
- "Cached X questions to localStorage"

## Troubleshooting

### Cache Not Working?
1. Check browser console for errors
2. Ensure localStorage is enabled in your browser
3. Clear browser cache and reload

### Questions Not Updating?
- Click the "Refresh from DB" button to force a refresh
- Cache is automatically invalidated on add/update/delete operations

### Performance Issues?
- Consider increasing cache duration for larger datasets
- Monitor batch fetching progress in console
