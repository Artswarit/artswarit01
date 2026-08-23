/**
 * Canonical notification -> route resolver.
 *
 * Single source of truth for turning a `notifications` row into a URL.
 * Previously NotificationBell and NotificationCenter each had their own
 * copy of this logic, and NotificationCenter's copy only recognized
 * 'like' / 'follow' / a generic project_id fallback. Cross-checked against
 * every `.from('notifications').insert(...)` call in the app, the real
 * `type` values in use also include artwork_purchase, artwork_sold, sale,
 * purchase, milestone_paid, payment_success, revision_requested,
 * dispute_raised, auto_approval and kyc — none of which either copy
 * handled, so clicking those notifications silently did nothing.
 *
 * `role` should come from `profile.role` (the value the app actually reads
 * for dashboard/role decisions), not `user.user_metadata.role` — the latter
 * is set once at signup and can go stale (e.g. after a premium upgrade).
 */

export interface NotificationLinkInput {
  type: string;
  metadata?: Record<string, any> | null;
}

export const getNotificationLink = (
  notification: NotificationLinkInput,
  role: string | null | undefined,
): string => {
  const meta = notification.metadata || {};
  const dashboard = role === 'artist' || role === 'premium' ? '/artist-dashboard' : '/client-dashboard';
  const toProject = (projectId: string) => `${dashboard}?tab=projects&project=${projectId}`;

  switch (notification.type) {
    case 'like':
      return meta.artwork_id ? `/artwork/${meta.artwork_id}` : '#';

    case 'follow':
      return meta.follower_id ? `/artist/${meta.follower_id}` : '#';

    case 'review_response':
    case 'new_review':
      if (meta.artist_id) {
        return `/artist/${meta.artist_id}?tab=about${meta.review_id ? `&review=${meta.review_id}` : ''}`;
      }
      return meta.review_id ? `/review/${meta.review_id}` : '#';

    case 'artwork_purchase':
    case 'artwork_sold':
      return meta.artwork_id ? `/artwork/${meta.artwork_id}` : '#';

    // Project/milestone lifecycle — all deep-link to the project's Projects tab.
    case 'project_accepted':
    case 'project_rejected':
    case 'project_progress':
    case 'project_completed':
    case 'milestone_submitted':
    case 'milestone_approved':
    case 'milestone_revision':
    case 'revision_requested':
    case 'dispute_raised':
    case 'auto_approval':
      return meta.project_id ? toProject(meta.project_id) : `${dashboard}?tab=projects`;

    // No per-event metadata is recorded for these (see stripe-webhook-handler),
    // so route to the closest relevant section rather than a dead end.
    case 'milestone_paid':
    case 'sale':
      return '/artist-dashboard?tab=projects';
    case 'payment_success':
    case 'purchase':
      return '/client-dashboard?tab=collection';

    case 'kyc':
      return '/artist-dashboard?tab=account';

    default:
      // Generic admin/system broadcasts (info/success/warning/error) carry
      // no actionable target — correctly not a link.
      return '#';
  }
};
