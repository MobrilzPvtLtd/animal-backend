import { Metadata } from 'next';
import { SubscriptionPlansCrud } from '@/components/crud/subscription-plans/SubscriptionPlansCrud';

export const metadata: Metadata = {
  title: 'Subscription Plans | Animal Click Admin',
  description: 'Manage subscription plans and pricing packages for Animal Click website and app.',
};

export default function SubscriptionPlansPage() {
  return <SubscriptionPlansCrud />;
}
