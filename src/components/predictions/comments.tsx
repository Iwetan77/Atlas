import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { deleteComment, marketComments, postComment, type PredictionComment } from '@/api/predictions';
import { useMe } from '@/api/send';
import { errorMessage, useAtlasAuth } from '@/auth/context';
import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing, themedStyles } from '@/theme';

const MAX = 280;

// "now", "5m", "3h", "2d", then the date.
function ago(ms: number, now: number): string {
  const s = Math.max(0, (now - ms) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(ms).toLocaleDateString();
}

// What people think about a market, signed with their @handle. Writing needs a handle of your own.
export function MarketComments({ marketId }: { marketId: string }) {
  const { getAccessToken } = useAtlasAuth();
  const { me } = useMe();
  const [comments, setComments] = useState<PredictionComment[] | null>(null);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // The clock the times are shown against, moved on whenever the list changes.
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const page = await marketComments(getAccessToken, marketId);
      setComments(page.comments);
      setNextBefore(page.nextBefore);
      setLoadError(null);
      setNow(Date.now());
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, [getAccessToken, marketId]);
  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const more = async () => {
    if (!nextBefore) return;
    setLoadingMore(true);
    try {
      const page = await marketComments(getAccessToken, marketId, nextBefore);
      setComments((old) => [...(old ?? []), ...page.comments]);
      setNextBefore(page.nextBefore);
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    setProblem(null);
    try {
      const posted = await postComment(getAccessToken, marketId, body);
      setComments((old) => [posted, ...(old ?? [])]);
      setDraft('');
      setNow(Date.now());
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setPosting(false);
    }
  };

  const remove = async (c: PredictionComment) => {
    setComments((old) => old?.filter((x) => x.id !== c.id) ?? null);
    try {
      await deleteComment(getAccessToken, c.id);
    } catch (e) {
      setProblem(errorMessage(e));
      load();
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.heading}>
        <Text variant="heading">Comments</Text>
        {comments?.length ? (
          <Text variant="caption" color="textSecondary">
            {comments.length}
            {nextBefore ? '+' : ''}
          </Text>
        ) : null}
      </View>

      {me?.handle ? (
        <View style={styles.composer}>
          <View style={styles.flex}>
            <Field
              value={draft}
              onChangeText={(t) => setDraft(t.slice(0, MAX))}
              placeholder={`Share your take as @${me.handle}`}
              maxLength={MAX}
              returnKeyType="send"
              onSubmitEditing={send}
              accessibilityLabel="Write a comment"
            />
          </View>
          <Pressable
            onPress={send}
            disabled={posting || !draft.trim()}
            accessibilityRole="button"
            accessibilityLabel="Post comment"
            style={({ pressed }) => [styles.send, (!draft.trim() || posting) && styles.sendOff, pressed && styles.pressed]}>
            {posting ? <ActivityIndicator color={colors.textOnAccent} size="small" /> : <Icon name="arrow-up" size={20} color="textOnAccent" />}
          </Pressable>
        </View>
      ) : me ? (
        <View style={styles.pick}>
          <Text color="textSecondary" style={styles.flex}>
            Pick your @handle to join the conversation.
          </Text>
          <PillButton label="Pick" size="sm" onPress={() => router.push('/handle')} />
        </View>
      ) : null}
      {problem ? <Text variant="caption" color="danger">{problem}</Text> : null}

      {!comments ? (
        loadError ? (
          <Text variant="caption" color="textSecondary">{loadError}</Text>
        ) : (
          <ActivityIndicator color={colors.accentPink} />
        )
      ) : comments.length === 0 ? (
        <Text color="textSecondary">No comments yet. Be the first to share your take.</Text>
      ) : (
        <View style={styles.list}>
          {comments.map((c) => (
            <View key={c.id} style={styles.comment}>
              <View style={styles.avatar}>
                <Text variant="label" color="accentPinkTint">
                  {c.handle.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.flex}>
                <View style={styles.meta}>
                  <Text variant="label">@{c.handle}</Text>
                  <Text variant="caption" color="textSecondary">
                    {ago(c.createdAtUnixMs, now)}
                  </Text>
                  {c.mine ? (
                    <Pressable onPress={() => remove(c)} hitSlop={8} accessibilityRole="button" style={styles.delete}>
                      <Text variant="caption" color="textSecondary">
                        Delete
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text>{c.body}</Text>
              </View>
            </View>
          ))}
          {nextBefore ? (
            <PillButton label="Show older comments" size="sm" tone="secondary" loading={loadingMore} onPress={more} />
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: {
    gap: spacing.md,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentPink,
  },
  sendOff: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.8,
  },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.bgSurface,
  },
  list: {
    gap: spacing.lg,
  },
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentPinkMuted,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxs,
  },
  delete: {
    marginLeft: 'auto',
  },
}));
