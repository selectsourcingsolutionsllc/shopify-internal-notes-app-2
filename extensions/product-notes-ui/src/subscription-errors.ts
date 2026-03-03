/**
 * Maps subscription error reasons to display properties for the UI banner.
 *
 * Each reason gets the right tone (warning vs critical), a short title,
 * and a call-to-action label for the link button.
 */

type BannerTone = 'warning' | 'critical';

interface SubscriptionErrorDisplay {
  title: string;
  actionLabel: string;
  tone: BannerTone;
  description: string;
}

const ERROR_MAP: Record<string, { title: string; actionLabel: string; tone: BannerTone }> = {
  no_subscription:       { title: 'Subscription required',  actionLabel: 'Start Free Trial',   tone: 'warning'  },
  trial_ended:           { title: 'Free trial ended',       actionLabel: 'Choose a Plan',       tone: 'critical' },
  subscription_expired:  { title: 'Subscription expired',   actionLabel: 'Renew Subscription',  tone: 'critical' },
  subscription_inactive: { title: 'Subscription inactive',  actionLabel: 'Resubscribe',         tone: 'critical' },
  plan_insufficient:     { title: 'Plan upgrade required',  actionLabel: 'Upgrade Plan',        tone: 'critical' },
};

const DEFAULT_ENTRY = { title: 'Subscription required', actionLabel: 'View Plans', tone: 'warning' as BannerTone };

/**
 * Returns the display properties for a subscription error banner.
 *
 * @param reason  - The reason code from the API (e.g. "trial_ended")
 * @param apiMessage - The human-readable message from the API, used as the banner description
 */
export function getSubscriptionError(reason: string | null, apiMessage: string): SubscriptionErrorDisplay {
  const entry = (reason && ERROR_MAP[reason]) || DEFAULT_ENTRY;
  return { ...entry, description: apiMessage };
}
