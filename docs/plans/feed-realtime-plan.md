# Implementation Plan: Feed Realtime + Like/Comment Buttons

## Context

**Problem:**
- `src/app/(app)/feed/page.tsx` lines 78-90: Like and comment `<button>` elements have zero `onClick` handlers.
- Counts (`post.comments_count`, `post.likes_count`) are baked in from initial Server Component fetch and never update.
- No API routes or Server Actions exist for liking, unliking, or commenting.
- Signals page (`src/app/(app)/signals/page.tsx`) is a full Server Component with no Postgres Changes subscription.

---

## 1. Database Layer

### 1.1 Add `likes`, `comments`, `feed_posts` to `supabase_realtime` publication

**File:** `supabase/migrations/202603XX_add_feed_realtime.sql`

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_posts;
```

### 1.2 Add DELETE policy for `comments` table

```sql
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);
```

### 1.3 Database triggers to keep `feed_posts.likes_count` / `comments_count` in sync

```sql
CREATE OR REPLACE FUNCTION public.handle_like_count_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feed_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feed_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_like_change
  AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_like_count_change();

CREATE OR REPLACE FUNCTION public.handle_comment_count_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feed_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feed_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_comment_count_change();
```

---

## 2. Server Actions

**New file:** `src/app/actions/feed.ts`

### 2.1 `toggleLike(postId: string)`

```typescript
export async function toggleLike(postId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { data: existing } = await supabase
    .from("likes")
    .select("id")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .single();

  if (existing) {
    const { error } = await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", postId);
    if (error) return { success: false, error: error.message };
    return { success: true, liked: false };
  } else {
    const { error } = await supabase.from("likes").upsert({ user_id: user.id, post_id: postId }, { onConflict: "user_id,post_id" });
    if (error) return { success: false, error: error.message };
    return { success: true, liked: true };
  }
}
```

### 2.2 `addComment(postId: string, content: string)`

```typescript
export async function addComment(postId: string, content: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  if (!content || content.trim().length === 0) return { success: false, error: "Comment cannot be empty" };
  if (content.trim().length > 1000) return { success: false, error: "Comment must be under 1000 characters" };

  const { data: inserted, error } = await supabase
    .from("comments")
    .insert({ user_id: user.id, post_id: postId, content: content.trim() })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/feed");
  return { success: true, commentId: inserted.id };
}
```

### 2.3 `deleteComment(commentId: string)`

```typescript
export async function deleteComment(commentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { error } = await supabase.from("comments").delete().eq("id", commentId).eq("user_id", user.id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/feed");
  return { success: true };
}
```

---

## 3. Client Components

### 3.1 `FeedCard` — interactive card with optimistic like/comment

**New file:** `src/components/feed/FeedCard.tsx` ("use client")

**Props:**
```typescript
interface FeedCardProps {
  post: { id: string; title: string; content: string | null; type: string; ticker: string | null; created_at: string; likes_count: number; comments_count: number; profiles: {...} | null };
  initialLiked?: boolean;
  currentUserId?: string | null;
}
```

**State:**
```typescript
const [liked, setLiked] = useState(initialLiked ?? false);
const [likesCount, setLikesCount] = useState(post.likes_count ?? 0);
const [isPending, startTransition] = useTransition();
```

**Optimistic like toggle:**
```typescript
function handleToggleLike() {
  if (!currentUserId) { setToast("Sign in to like posts"); return; }
  const prevLiked = liked;
  const prevCount = likesCount;
  setLiked(!liked);
  setLikesCount(liked ? likesCount - 1 : likesCount + 1);

  startTransition(async () => {
    const { toggleLike } = await import("@/app/actions/feed");
    const result = await toggleLike(post.id);
    if (!result.success) {
      setLiked(prevLiked);
      setLikesCount(prevCount);
      setToast(result.error ?? "Failed to like");
    }
  });
}
```

### 3.2 `FeedRealtimeProvider` — realtime subscription owner

**New file:** `src/components/feed/FeedRealtimeProvider.tsx` ("use client")

Subscribes to `postgres_changes` on `likes` (INSERT/DELETE), `comments` (INSERT/DELETE), and `feed_posts` (INSERT). Uses `document.visibilitychange` to pause when tab is hidden. Stores seen IDs in a `Set<string>` for deduplication.

---

## 4. Page Changes

### 4.1 `src/app/(app)/feed/page.tsx`

- Extract the inner `.map()` body into `<FeedCard post={post} />`
- Wrap `<div className="space-y-4">` in `<FeedRealtimeProvider>`
- Pass `currentUserId={user?.id ?? null}` to each `FeedCard`

### 4.2 `src/app/(app)/signals/page.tsx`

- Add `SignalsRealtimeProvider` component ("use client") that subscribes to `postgres_changes` INSERT on `signals` table
- New signals prepend to local state array: `setLiveSignals(prev => [payload.new, ...prev])`
- Merge server data with realtime stream; deduplicate by signal `id`; cap at 50 entries client-side

---

## 5. File Manifest

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/202603XX_add_feed_realtime.sql` | CREATE | Tables in realtime publication, DELETE policy, count triggers |
| `src/app/actions/feed.ts` | CREATE | Server Actions: `toggleLike`, `addComment`, `deleteComment` |
| `src/components/feed/FeedCard.tsx` | CREATE | Interactive "use client" card |
| `src/components/feed/FeedRealtimeProvider.tsx` | CREATE | Realtime subscription owner |
| `src/components/feed/SignalsRealtimeProvider.tsx` | CREATE | Realtime for signals page |
| `src/app/(app)/feed/page.tsx` | MODIFY | Wrap in provider; use FeedCard |
| `src/app/(app)/signals/page.tsx` | MODIFY | Add realtime provider, merge live signals |

---

## Verification Checklist

- [ ] Like button: increments count, persists after reload, toggle works
- [ ] Comment: increments count, comment appears after reload
- [ ] Delete own comment: decrements count
- [ ] Cannot delete another user's comment (RLS blocks it)
- [ ] Two browser tabs on `/feed`: like in tab A → count updates in tab B within ~500ms
- [ ] Two browser tabs on `/signals`: insert new signal → appears in both tabs without refresh
- [ ] Optimistic: click like → state changes immediately; server failure → reverts + toast
- [ ] Tab hidden → subscription pauses; tab visible → reconnects
