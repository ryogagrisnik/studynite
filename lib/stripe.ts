import prisma from "@/lib/prisma";
import { env } from "@/lib/env";

async function fetchStripeSubscription(id: string, secret: string) {
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`stripe fetch subscription failed: ${text}`);
  }
  return res.json();
}

async function fetchStripeCustomer(id: string, secret: string) {
  const res = await fetch(`https://api.stripe.com/v1/customers/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`stripe fetch customer failed: ${text}`);
  }
  return res.json();
}

export async function processStripeEvent(event: any) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.client_reference_id as string | undefined;
      const customer = session.customer as string | undefined;
      const subscription = session.subscription as string | undefined;
      if (userId && customer) {
        const updateData: Record<string, any> = {
          stripeCustomerId: customer,
          stripeSubscriptionId: subscription ?? null,
        };
        const secretKey = env.STRIPE_SECRET_KEY;
        if (subscription && secretKey) {
          const sub = await fetchStripeSubscription(subscription, secretKey);
          const now = new Date();
          const currentPeriodStart = sub.current_period_start
            ? new Date(sub.current_period_start * 1000)
            : now;
          const currentPeriodEnd = sub.current_period_end
            ? new Date(sub.current_period_end * 1000)
            : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          const canceled = sub.status === "canceled" || sub.cancel_at_period_end === true;
          updateData.proPlan =
            (sub.items?.data?.[0]?.plan?.nickname as string | undefined) ||
            (sub.items?.data?.[0]?.price?.id as string | undefined) ||
            null;
          updateData.proSince = currentPeriodStart;
          updateData.proExpiresAt = canceled ? currentPeriodEnd : currentPeriodEnd ?? null;
        }
        await prisma.user.update({ where: { id: userId }, data: updateData });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const customer = sub.customer as string | undefined;
      if (customer) {
        let user = await prisma.user.findFirst({
          where: { stripeCustomerId: customer },
          select: { id: true, email: true },
        });

        if (!user) {
          const secretKey = env.STRIPE_SECRET_KEY;
          if (secretKey) {
            const customerObj = await fetchStripeCustomer(customer, secretKey);
            const email = (customerObj?.email as string | undefined)?.toLowerCase();
            if (email) {
              const matched = await prisma.user.findFirst({
                where: { email },
                select: { id: true, email: true },
              });
              if (matched) {
                user = matched;
                await prisma.user.update({
                  where: { id: matched.id },
                  data: { stripeCustomerId: customer },
                });
              }
            }
          }
        }

        if (user) {
          const now = new Date();
          const currentPeriodStart = sub.current_period_start
            ? new Date(sub.current_period_start * 1000)
            : now;
          const currentPeriodEnd = sub.current_period_end
            ? new Date(sub.current_period_end * 1000)
            : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          const canceled = sub.status === "canceled" || sub.cancel_at_period_end === true;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              stripeSubscriptionId: sub.id,
              proPlan:
                (sub.items?.data?.[0]?.plan?.nickname as string | undefined) ||
                (sub.items?.data?.[0]?.price?.id as string | undefined) ||
                null,
              proSince: currentPeriodStart,
              proExpiresAt: canceled ? currentPeriodEnd : currentPeriodEnd ?? null,
            },
          });
        }
      }
      break;
    }
    default:
      break;
  }
}
