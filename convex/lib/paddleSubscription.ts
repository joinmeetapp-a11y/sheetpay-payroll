import { ConvexError } from 'convex/values';
import { ACCOUNTANT_PLANS } from '../../shared/accountantPlans';
export const billingError = () => new ConvexError("We couldn't update your subscription. Please try again or contact support@sheetpay.app.");
export function verifiedSubscription(data: any, user: any, subject: string) {
  if (!user?.paddleCustomerId || !user?.paddleSubscriptionId || data?.id !== user.paddleSubscriptionId || data?.customer_id !== user.paddleCustomerId || (data.custom_data?.firebaseUid && data.custom_data.firebaseUid !== subject)) throw billingError();
  const priceId = data.items?.[0]?.price?.id;
  const plan = priceId === (process.env.PADDLE_ACCOUNTANT_MONTHLY_PRICE || ACCOUNTANT_PLANS.accountant_monthly.paddlePriceId) ? 'accountant_monthly' : priceId === (process.env.PADDLE_ACCOUNTANT_YEARLY_PRICE || ACCOUNTANT_PLANS.accountant_yearly.paddlePriceId) ? 'accountant_yearly' : null;
  if (!plan || !['active', 'trialing', 'past_due', 'paused', 'canceled'].includes(data.status)) throw billingError();
  const parsed = (value: any) => { const number = typeof value === 'string' ? Date.parse(value) : NaN; return Number.isFinite(number) ? number : undefined; };
  const scheduledCancelAt = data.scheduled_change?.action === 'cancel' ? parsed(data.scheduled_change.effective_at) : undefined;
  if (data.scheduled_change?.action === 'cancel' && !scheduledCancelAt) throw billingError();
  return { plan, priceId, planStatus: data.status, scheduledCancelAt: scheduledCancelAt ?? null, billingPeriodStart: parsed(data.current_billing_period?.starts_at), billingPeriodEnd: parsed(data.current_billing_period?.ends_at), subscriptionUpdatedAt: parsed(data.updated_at) };
}
