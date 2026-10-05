# Forensic Learning Record (Deep Inspection): serafimcloud/21st

> **Canonical Artifact**: `07_PROJECT_LEARNING/serafimcloud-21st-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/serafimcloud/21st](https://github.com/serafimcloud/21st))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:54:07.226Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `serafimcloud/21st`
- **Description**: npm for design engineers: largest marketplace of shadcn/ui-based React Tailwind components, blocks and hooks
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5480 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/web/app/(utility)/privacy/page.tsx`
```
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy – 21st.dev",
  description: "Privacy policy for 21st.dev",
}

export default function PrivacyPolicy() {
  return (
    <div className="container max-w-3xl py-6 md:py-10">
      <div className="prose dark:prose-invert max-w-none">
        <h1>Privacy Policy</h1>

        <p className="lead">Last updated: 12/25/2024</p>

        <h2>1. Introduction</h2>
        <p>
          This Privacy Policy explains how 21st.dev ("we", "our", or "us"),
          operated by Serafim Korablev, collects and uses information through
          our website and services.
        </p>

        <h2>2. Information We Collect</h2>
        <h3>2.1 Anonymous Usage Data</h3>
        <p>
          We collect anonymous usage data to improve our services and understand
          how users interact with 21st.dev. This may include:
        </p>
        <ul>
          <li>Pages visited and features used</li>
          <li>
            Technical information such as browser type and device information
          </li>
          <li>Usage patterns and interaction with our components</li>
        </ul>

        <h3>2.2 Newsletter Subscription</h3>
        <p>
          If you opt in to receive our newsletter, we collect and store your
          email address. This is only done with your explicit consent when you:
        </p>
        <ul>
          <li>Subscribe through our website</li>
          <li>Sign up for updates about new components</li>
          <li>Register for an account</li>
        </ul>

        <h2>3. How We Use Your Information</h2>
        <p>We use the collected information for:</p>
        <ul>
          <li>Improving our component library and services</li>
          <li>Sending newsletters and updates (only to subscribed users)</li>
          <li>Analyzing usage patterns to enhance user experience</li>
          <li>Maintaining and optimizing our platform</li>
        </ul>

        <h2>4. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Unsubscribe from our newsletter at any time</li>
          <li>Request information about your data we store</li>
          <li>Request deletion of your email from our database</li>
        </ul>

        <h2>5. Contact Information</h2>
        <p>
          For any privacy-related questions or concerns, please contact:
          <br />
          Serafim Korablev
          <br />
          28 Coates Way
          <br />
          Watford
          <br />
          WD259NS
          <br />
          United Kingdom
          <br />
          Email: support@21st.dev
        </p>
      </div>
    </div>
  )
}

```

### Core Architecture Module: `apps/web/app/(utility)/terms/page.tsx`
```
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service – 21st.dev",
  description: "Terms of service for 21st.dev",
}

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-12 md:py-20">
        <article className="prose dark:prose-invert max-w-none">
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground">
            Terms of Service
          </h1>

          <div className="text-sm text-muted-foreground mb-12">
            Last updated: 04/24/2025
          </div>

          <div className="space-y-16">
            <section className="group">
              <h2 className="text-2xl font-semibold tracking-tight mb-6 text-foreground group-hover:text-primary">
                1. Introduction
              </h2>
              <p className="text-muted-foreground leading-7">
                These Terms of Service ("Terms") govern your access to and use
                of 21st.dev ("we", "our", or "us"), operated by 21st Labs Inc. By accessing or using 21st.dev, you agree to be bound
                by these Terms.
              </p>
            </section>

            <section className="group">
              <h2 className="text-2xl font-semibold tracking-tight mb-6 text-foreground group-hover:text-primary">
                2. Intellectual Property Rights
              </h2>
              <p className="text-muted-foreground leading-7">
                All code, content, and materials published on 21st.dev,
                including but not limited to components, documentation, metadata (such as names and descriptions), and all associated media assets (such as images, videos, and thumbnails), are the sole and exclusive property of their
                respective authors and 21st.dev. Users are granted access to
                view and use the content solely through the official 21st.dev
                platform in accordance with these Terms.
              </p>
            </section>

            <section className="group">
              <h2 className="text-2xl font-semibold tracking-tight mb-6 text-foreground group-hover:text-primary">
                3. Prohibited Activities
              </h2>
              <p className="text-muted-foreground mb-4 leading-7">
                Users are strictly prohibited from:
              </p>
              <ul className="list-none space-y-3 text-muted-foreground pl-6">
                <li className="flex items-start">
                  <span className="mr-3 text-primary">•</span>
                  <span className="leading-7">
                    Scraping or automatically collecting data from 21st.dev
                    through web scraping, bots, crawlers, or any other automated
                    means without explicit written consent from 21st.dev
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="mr-3 text-primary">•</span>
                  <span className="leading-7">
                    Using any content, code, or data from 21st.dev to train
                    artificial intelligence models, machine learning systems, or
                    similar technologies without explicit written consent from
                    21st.dev
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="mr-3 text-primary">•</span>
                  <span className="leading-7">
                    Redistributing, selling, or licensing any content from
                    21st.dev without authorization
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="mr-3 text-primary">•</span>
                  <span className="leading-7">
                    Republishing or reusing media assets (such as images, GIFs, and video previews) or structured metadata (titles, descriptions, tags) from 21st.dev, including manual or automated means, without explicit written permission
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="mr-3 text-primary">•</span>
                  <span className="leading-7">
                    Copying and redistributing components originally published
                    on 21st.dev to other websites, social media platforms, or
                    any other medium without providing a clear and visible link
                    back to the original component page on 21st.dev
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="mr-3 text-primary">•</span>
                  <span className="leading-7">
                    Attempting to circumvent any technical measures implemented
                    to protect our content
                  </span>
                </li>
              </ul>
            </section>

            <section className="group">
              <h2 className="text-2xl font-semibold tracking-tight mb-6 text-foreground group-hover:text-primary">
                4. Enforcement
              </h2>
              <p className="text-muted-foreground mb-4 leading-7">
                We reserve the right to:
              </p>
              <ul className="list-none space-y-3 text-muted-foreground pl-6">
                <li className="flex items-start">
                  <span className="mr-3 text-primary">•</span>
                  <span className="leading-7">
                    Take appropriate legal action against violations of these
                    Terms
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="mr-3 text-primary">•</span>
                  <span className="leading-7">
                    Terminate or suspend access to our services for violations
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="mr-3 text-primary">•</span>
                  <span className="leading-7">
                    Remove or disable access to any content that violates these
                    Terms
                  </span>
                </li>
              </ul>
            </section>

            <section className="group">
              <h2 className="text-2xl font-semibold tracking-tight mb-6 text-foreground group-hover:text-primary">
                5. Changes to Terms
              </h2>
              <p className="text-muted-foreground leading-7">
                We reserve the right to modify these Terms at any time. Changes
                will be effective immediately upon posting on 21st.dev. Your
                continued use of the platform after changes constitutes
                acceptance of the modified Terms.
              </p>
            </section>

            <section className="group">
              <h2 className="text-2xl font-semibold tracking-tight mb-6 text-foreground group-hover:text-primary">
                6. Contact Information
              </h2>
              <p className="text-muted-foreground leading-7">
                For any questions regarding these Terms, please contact:
                <br />
                21st Labs Inc.
                <br />
                1111b S Governors Ave
                <br />
                STE 28395
                <br />
                Dover, DE 19904
                <br />
                United States
                <br />
                Phone: (628) 227-7780
                <br />
                Email: support@21st.dev
              </p>
            </section>
          </div>
        </article>
      </div>
    </div>
  )
}

```

### Core Architecture Module: `apps/web/app/api/stripe/webhook/v1/route.ts`
```
import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { supabaseWithAdminAccess } from "@/lib/supabase"
import { stripeV1, getPlanByStripeId } from "@/lib/stripe"

const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET_V1

async function getSubscriptionPlanDetailsById(planId: string) {
  const plan = await getPlanByStripeId(planId)

  return {
    planId: plan.id,
    planType: plan.type,
    planPeriod: plan.period,
    addUsage: plan.add_usage,
  }
}

async function handleSubscriptionCreatedOrUpdate(event: Stripe.Event) {
  try {
    const subscription = event.data.object as Stripe.Subscription
    const userId = subscription.metadata.userId as string
    const subscriptionId = subscription.id
    const stripePlanId = subscription.items.data[0]?.plan?.id

    if (!stripePlanId) {
      throw new Error("No plan ID found in subscription")
    }

    if (subscription.cancel_at_period_end) {
      const { data: existingUserPlan } = await supabaseWithAdminAccess
        .from("users_to_plans")
        .select("meta")
        .eq("user_id", userId)
        .single()

      if (existingUserPlan) {
        const updatedMeta = {
          ...(existingUserPlan.meta
            ? JSON.parse(JSON.stringify(existingUserPlan.meta))
            : {}),
          will_cancel_at_end: true,
          cancel_at: subscription.cancel_at
            ? new Date(subscription.cancel_at * 1000).toISOString()
            : null,
        }

        await supabaseWithAdminAccess
          .from("users_to_plans")
          .update({
            meta: updatedMeta,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
      }
    }

    const planDetails = await getSubscriptionPlanDetailsById(stripePlanId)

    const { planId, addUsage } = planDetails
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000)

    let usageLimit = addUsage

    const meta = {
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscriptionId,
      stripe_plan_id: stripePlanId,
      period_end: currentPeriodEnd.toISOString(),
      will_cancel_at_end: subscription.cancel_at_period_end || false,
      cancel_at: subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : null,
    }

    const { data: existingUserPlan } = await supabaseWithAdminAccess
      .from("users_to_plans")
      .select()
      .eq("user_id", userId)
      .single()

    if (existingUserPlan) {
      const { data: currentUsageData } = await supabaseWithAdminAccess
        .from("usages")
        .select("limit, usage")
        .eq("user_id", userId)
        .single()

      const currentUsage = currentUsageData?.usage || 0

      const { data: currentPlanData } = await supabaseWithAdminAccess
        .from("users_to_plans")
        .select(
          `
          plans:plan_id (
            id,
            stripe_plan_id,
            price,
            type
          )
        `,
        )
        .eq("user_id", userId)
        .single()

      const { data: newPlanData } = await supabaseWithAdminAccess
        .from("plans")
        .select("price, type")
        .eq("id", planId)
        .single()

      const currentPlanPrice = currentPlanData?.plans
        ? (currentPlanData.plans as any).price || 0
        : 0
      const newPlanPrice = newPlanData ? (newPlanData as any).price || 0 : 0

      const isDowngrade = newPlanPrice < currentPlanPrice

      if (!isDowngrade) {
        await supabaseWithAdminAccess
          .from("usages")
          .upsert(
            {
              user_id: userId,
              limit: usageLimit,
              usage: currentUsage,
            },
            { onConflict: "user_id" },
          )
          .select()

        await supabaseWithAdminAccess
          .from("users_to_plans")
          .update({
            status: "active",
            plan_id: planId,
            updated_at: new Date().toISOString(),
            meta,
            last_paid_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
      } else {
        const updatedMetaWithFutureLimit = {
          ...meta,
          future_limit: usageLimit,
          is_downgrade: true,
        }

        await supabaseWithAdminAccess
          .from("users_to_plans")
          .update({
            status: "active",
            plan_id: planId,
            updated_at: new Date().toISOString(),
            meta: updatedMetaWithFutureLimit,
            last_paid_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
      }
    } else {
      await supabaseWithAdminAccess
        .from("usages")
        .upsert(
          {
            user_id: userId,
            limit: usageLimit,
            usage: 0,
          },
          { onConflict: "user_id" },
        )
        .select()

      await supabaseWithAdminAccess.from("users_to_plans").insert({
        user_id: userId,
        plan_id: planId,
        status: "active",
        meta,
        last_paid_at: new Date().toISOString(),
      })
    }
  } catch (error) {
    throw error
  }
}

async function handleSubscriptionDeleted(event: Stripe.Event) {
  try {
    const subscription = event.data.object as Stripe.Subscription
    const userId = subscription.metadata.userId as string

    const planResult = await supabaseWithAdminAccess
      .from("users_to_plans")
      .update({
        status: "inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)

    if (planResult.error) {
      throw new Error(`Failed to update database: ${planResult.error}`)
    }
  } catch (error) {
    throw error
  }
}

async function handleFraudWarning(event: Stripe.Event) {
  const earlyFraudWarning = event.data.object as Stripe.Radar.EarlyFraudWarning
  const paymentIntentId = earlyFraudWarning.payment_intent

  if (!paymentIntentId) {
    throw new Error("No payment intent found in the event")
  }

  const refund = await stripeV1.refunds.create({
    payment_intent: paymentIntentId as string,
  })
  console.log(`Refund created: ${refund.id}`)

  const paymentIntent = await stripeV1.paymentIntents.retrieve(
    paymentIntentId as string,
  )

  if (paymentIntent.customer) {
    const deletedCustomer = await stripeV1.customers.del(
      paymentIntent.customer as string,
    )
    console.log(
      `Customer ${paymentIntent.customer} deleted: ${deletedCustomer.deleted}`,
    )
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig) {
    return NextResponse.json(
      { error: "No Stripe signature found" },
      { status: 400 },
    )
  }

  let event: Stripe.Event

  try {
    event = stripeV1.webhooks.constructEvent(body, sig, stripeWebhookSecret!)
  } catch (err: any) {
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 },
    )
  }

  const eventObject = event.data.object
  let userId

  if ("metadata" in eventObject && eventObject.metadata?.userId) {
    userId = eventObject.metadata.userId
  } else {
    return NextResponse.json(
      { error: "No userId found in event object metadata" },
      { status: 400 },
    )
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionCreatedOrUpdate(event)
        break
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event)
        break
      case "radar.early_fraud_warning.created":
        await handleFraudWarning(event)
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Error processing webhook" },
      { status: 500 },
    )
  }
}

```

### Core Architecture Module: `apps/web/app/api/stripe/webhook/v2/route.ts`
```
import stripe, { getPlanByStripeId, stripeV2 } from "@/lib/stripe"
import { supabaseWithAdminAccess } from "@/lib/supabase"
import { BundlePaymentStatus } from "@/types/global"
import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET_V2

async function getSubscriptionPlanDetailsById(planId: string) {
  const plan = await getPlanByStripeId(planId)

  return {
    planId: plan.id,
    planType: plan.type,
    planPeriod: plan.period,
    addUsage: plan.add_usage,
  }
}

async function handleSubscriptionCreatedOrUpdate(event: Stripe.Event) {
  try {
    const subscription = event.data.object as Stripe.Subscription
    const userId = subscription.metadata.userId as string
    const subscriptionId = subscription.id
    const stripePlanId = subscription.items.data[0]?.plan?.id

    if (!stripePlanId) {
      throw new Error("No plan ID found in subscription")
    }

    if (subscription.cancel_at_period_end) {
      const { data: existingUserPlan } = await supabaseWithAdminAccess
        .from("users_to_plans")
        .select("meta")
        .eq("user_id", userId)
        .single()

      if (existingUserPlan) {
        const updatedMeta = {
          ...(existingUserPlan.meta
            ? JSON.parse(JSON.stringify(existingUserPlan.meta))
            : {}),
          will_cancel_at_end: true,
          cancel_at: subscription.cancel_at
            ? new Date(subscription.cancel_at * 1000).toISOString()
            : null,
        }

        await supabaseWithAdminAccess
          .from("users_to_plans")
          .update({
            meta: updatedMeta,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
      }
    }

    const planDetails = await getSubscriptionPlanDetailsById(stripePlanId)

    const { planId, addUsage } = planDetails
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000)

    let usageLimit = addUsage

    const meta = {
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscriptionId,
      stripe_plan_id: stripePlanId,
      period_end: currentPeriodEnd.toISOString(),
      will_cancel_at_end: subscription.cancel_at_period_end || false,
      cancel_at: subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : null,
    }

    const { data: existingUserPlan } = await supabaseWithAdminAccess
      .from("users_to_plans")
      .select()
      .eq("user_id", userId)
      .single()

    if (existingUserPlan) {
      const { data: currentUsageData } = await supabaseWithAdminAccess
        .from("usages")
        .select("limit, usage")
        .eq("user_id", userId)
        .single()

      const currentUsage = currentUsageData?.usage || 0

      const { data: currentPlanData } = await supabaseWithAdminAccess
        .from("users_to_plans")
        .select(
          `
          plans:plan_id (
            id,
            stripe_plan_id,
            price,
            type
          )
        `,
        )
        .eq("user_id", userId)
        .single()

      const { data: newPlanData } = await supabaseWithAdminAccess
        .from("plans")
        .select("price, type")
        .eq("id", planId)
        .single()

      const currentPlanPrice = currentPlanData?.plans
        ? (currentPlanData.plans as any).price || 0
        : 0
      const newPlanPrice = newPlanData ? (newPlanData as any).price || 0 : 0

      const isDowngrade = newPlanPrice < currentPlanPrice

      if (!isDowngrade) {
        await supabaseWithAdminAccess
          .from("usages")
          .upsert(
            {
              user_id: userId,
              limit: usageLimit,
              usage: currentUsage,
            },
            { onConflict: "user_id" },
          )
          .select()

        await supabaseWithAdminAccess
          .from("users_to_plans")
          .update({
            status: "active",
            plan_id: planId,
            updated_at: new Date().toISOString(),
            meta,
            last_paid_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
      } else {
        const updatedMetaWithFutureLimit = {
          ...meta,
          future_limit: usageLimit,
          is_downgrade: true,
        }

        await supabaseWithAdminAccess
          .from("users_to_plans")
          .update({
            status: "active",
            plan_id: planId,
            updated_at: new Date().toISOString(),
            meta: updatedMetaWithFutureLimit,
            last_paid_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
      }
    } else {
      await supabaseWithAdminAccess
        .from("usages")
        .upsert(
          {
            user_id: userId,
            limit: usageLimit,
            usage: 0,
          },
          { onConflict: "user_id" },
        )
        .select()

      await supabaseWithAdminAccess.from("users_to_plans").insert({
        user_id: userId,
        plan_id: planId,
        status: "active",
        meta,
        last_paid_at: new Date().toISOString(),
      })
    }
  } catch (error) {
    throw error
  }
}

async function handleSubscriptionDeleted(event: Stripe.Event) {
  try {
    const subscription = event.data.object as Stripe.Subscription
    const userId = subscription.metadata.userId as string

    const planResult = await supabaseWithAdminAccess
      .from("users_to_plans")
      .update({
        status: "inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)

    if (planResult.error) {
      throw new Error(`Failed to update database: ${planResult.error}`)
    }
  } catch (error) {
    throw error
  }
}

async function handleFraudWarning(event: Stripe.Event) {
  const earlyFraudWarning = event.data.object as Stripe.Radar.EarlyFraudWarning
  const paymentIntentId = earlyFraudWarning.payment_intent

  if (!paymentIntentId) {
    throw new Error("No payment intent found in the event")
  }

  const refund = await stripeV2.refunds.create({
    payment_intent: paymentIntentId as string,
  })
  console.log(`Refund created: ${refund.id}`)

  const paymentIntent = await stripeV2.paymentIntents.retrieve(
    paymentIntentId as string,
  )

  if (paymentIntent.customer) {
    const deletedCustomer = await stripeV2.customers.del(
      paymentIntent.customer as string,
    )
    console.log(
      `Customer ${paymentIntent.customer} deleted: ${deletedCustomer.deleted}`,
    )
  }
}

async function handleCheckoutSession(
  event:
    | Stripe.PaymentIntentCanceledEvent
    | Stripe.PaymentIntentPaymentFailedEvent
    | Stripe.PaymentIntentProcessingEvent
    | Stripe.PaymentIntentSucceededEvent,
) {
  let status: BundlePaymentStatus | null = null
  switch (event.type) {
    case "payment_intent.canceled":
    case "payment_intent.payment_failed":
      status = "rejected"
      break
    case "payment_intent.succeeded":
      status = "paid"
      break
    case "payment_intent.processing":
      status = "pending"
      break
  }

  if (!status) {
    throw new Error("No status got from event")
  }

  const paymentIntent = event.data.object
  if (!paymentIntent.metadata) {
    throw new Error("No metadata found in event")
  }

  const { userId, bundleId, planId, fee } = paymentIntent.metadata
  const price = paymentIntent.amount

  if (!userId || !bundleId || !planId || !price || !fee) {
    throw new Error(
      `Not enough data found in metadata: ${JSON.stringify(paymentIntent.metadata)}`,
    )
  }

  const { data: existingBundlePurchase, error: existingBundlePurchaseError } =
    await supabaseWithAdminAccess
      .from("bundle_purchases")
      .select("*")
      .eq("id", paymentIntent.id)
      .maybeSingle()

  if (existingBundlePurchaseError) {
    throw new Error(
      `Failed to get bundle purchase: ${existingBundlePurchaseError}`,
    )
  }

  const { data: lastBundlePurchase, error: lastBundlePurchaseError } =
    await supabaseWithAdminAccess
      .from("bundle_purchases")
      .select("*")
      .eq("user_id", userId)
      .eq("bundle_id", Number(bundleId))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

  if (lastBundlePurchaseError) {
    throw new Error(
      `Failed to get last bundle purchase: ${lastBundlePurchaseError}`,
    )
  }

  // Refund paid -> paid
  if (
    (lastBundlePurchase?.status === "paid" ||
      lastBundlePurchase?.status === "pending") &&
    status === "paid"
  ) {
    stripe.refunds.create({
      payment_intent: paymentIntent.id,
      reason: "duplicate",
    })
    return
  }

  // Prevent non-pending -> pending
  if (
    existingBundlePurchase?.status &&
    existingBundlePurchase.status !== "pending" &&
    status === "pending"
  ) {
    return
  }

  // Upsert only pending/undefined -> non-pending
  if (
    existingBundlePurchase?.status === undefined ||
    existingBundlePurchase.status === "pending"
  ) {
    const { error: upsertError } = await supabaseWithAdminAccess
      .from("bundle_purchases")
      .upsert({
        id: paymentIntent.id,
        user_id: existingBundlePurchase?.user_id || userId,
        bundle_id: existingBundlePurchase?.bundle_id || Number(bundleId),
        plan_id: existingBundlePurchase?.plan_id || Number(planId),
        price: existingBundlePurchase?.price || price,
        status: status,
        fee: existingBundlePurchase?.fee || Number(fee),
        paid_to_user: existingBundlePurchase?.paid_to_user || false,
      })

    if (upsertError) {
      throw new Error(`Failed to upsert bundle purchase: ${upsertError}`)
    }
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig) {
    return NextResponse.json(
      { error: "No Stripe signature found" },
      { status: 400 },
    )
  }

  let
```

### Core Architecture Module: `apps/web/app/api/webhooks/clerk/route.ts`
```
import { NextResponse } from "next/server"
import { Webhook, WebhookRequiredHeaders } from "svix"
import { WebhookEvent } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: Request) {
  const payload = await req.text()
  const headersList = req.headers

  const heads = {
    "svix-id": headersList.get("svix-id"),
    "svix-timestamp": headersList.get("svix-timestamp"),
    "svix-signature": headersList.get("svix-signature"),
  }

  // Check if all required headers are present
  if (
    !heads["svix-id"] ||
    !heads["svix-timestamp"] ||
    !heads["svix-signature"]
  ) {
    return NextResponse.json(
      { error: "Missing required headers" },
      { status: 400 },
    )
  }

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    )
  }

  const wh = new Webhook(webhookSecret)
  let evt: WebhookEvent

  try {
    evt = wh.verify(payload, heads as WebhookRequiredHeaders) as WebhookEvent
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 },
    )
  }

  const { type, data: user } = evt

  switch (type) {
    case "user.created":
    case "user.updated":
      try {
        const username =
          user.external_accounts?.[0]?.username || user.username || user.id
        const name =
          `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || null
        const image_url = user.image_url

        // For new users, initialize display fields with Clerk data
        const { data: existingUser } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("id", user.id)
          .single()

        const userData = {
          id: user.id,
          username,
          image_url,
          email: user.email_addresses[0]?.email_address ?? null,
          name,
          // Only set display fields for new users
          ...(existingUser
            ? {}
            : {
                display_name: name,
                display_username: username,
                display_image_url: image_url,
              }),
        }

        const { data, error } = await supabaseAdmin
          .from("users")
          .upsert(userData)

        if (error) {
          return NextResponse.json(
            { error: "Failed to sync user with Supabase", details: error },
            { status: 500 },
          )
        }
      } catch (error) {
        return NextResponse.json(
          { error: "Unexpected error during user sync", details: error },
          { status: 500 },
        )
      }
      break

    case "user.deleted":
      // eslint-disable-next-line no-case-declarations
      const { error: deleteError } = await supabaseAdmin
        .from("users")
        .delete()
        .match({ id: user.id })

      if (deleteError) {
        return NextResponse.json(
          { error: "Failed to delete user from Supabase" },
          { status: 500 },
        )
      }
      break

    default:
  }
  return NextResponse.json({ message: "Webhook processed successfully" })
}

export async function GET() {
  return NextResponse.json({ message: "Clerk webhook endpoint" })
}

```

### Core Architecture Module: `apps/web/components/features/admin/hooks/useSubmissions.ts`
```
import { useState, useEffect, useCallback } from "react"
import { useClerkSupabaseClient } from "@/lib/clerk"
import { toast } from "sonner"
import { Submission, SubmissionStatus, AdminRpcResponse } from "../types"
import type { PostgrestSingleResponse } from "@supabase/supabase-js"
import { useQuery, useQueryClient } from "@tanstack/react-query"

export interface ContestRound {
  id: number
  week_number: number
  start_at: string
  end_at: string
  seasonal_tag_id: number | null
  created_at: string | null
}

export type DeleteMode = "submission" | "component" | null

export const useSubmissions = (isAdmin: boolean) => {
  const supabase = useClerkSupabaseClient()
  const queryClient = useQueryClient()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("on_review")
  const [selectedSubmission, setSelectedSubmission] =
    useState<Submission | null>(null)
  const [feedback, setFeedback] = useState("")
  const [editingDemo, setEditingDemo] = useState<Submission | null>(null)
  const [editDemoName, setEditDemoName] = useState("")
  const [editDemoSlug, setEditDemoSlug] = useState("")
  const [contestRoundLoading, setContestRoundLoading] = useState(false)
  const [isDeletingComponent, setIsDeletingComponent] = useState(false)
  const [componentToDelete, setComponentToDelete] = useState<Submission | null>(
    null,
  )

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Get current active round
  const { data: currentRound, isLoading: isCurrentRoundLoading } = useQuery({
    queryKey: ["current-contest-round"],
    queryFn: async () => {
      const now = new Date().toISOString()
      // First try to get active round
      const { data: activeRound } = await supabase
        .from("component_hunt_rounds")
        .select("*")
        .lte("start_at", now)
        .gte("end_at", now)
        .single()

      if (activeRound) return activeRound as ContestRound

      // If no active round, get the most recent past round
      const { data: pastRound } = await supabase
        .from("component_hunt_rounds")
        .select("*")
        .lte("start_at", now)
        .order("start_at", { ascending: false })
        .limit(1)
        .single()

      return pastRound as ContestRound
    },
    enabled: isAdmin,
  })

  // Get all contest rounds
  const { data: allRounds = [], isLoading: isAllRoundsLoading } = useQuery({
    queryKey: ["all-contest-rounds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("component_hunt_rounds")
        .select("*")
        .order("start_at", { ascending: false })

      if (error) {
        throw error
      }

      return data as ContestRound[]
    },
    enabled: isAdmin,
  })

  useEffect(() => {
    if (isAdmin) {
      fetchSubmissions()
    } else {
      setLoading(false)
    }
  }, [filter, isAdmin, currentPage, itemsPerPage])

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filter])

  const fetchSubmissions = async () => {
    setLoading(true)
    try {
      // Fetch a large batch to ensure we get all submissions for filtering
      // In production, this should be handled server-side
      const largeBatch = 1000 // Fetch a large number to get all submissions

      let query = supabase.rpc("get_demos_submissions", {
        p_sort_by: "date",
        p_offset: 0,
        p_limit: largeBatch,
        p_include_private: true,
      })

      const { data, error } = await query

      if (error) {
        throw error
      }

      let filteredData = data

      // Apply status filter
      if (filter !== "all") {
        filteredData = data.filter((item: any) =>
          filter === "null"
            ? !item.submission_status
            : item.submission_status === filter,
        )
      }

      // Calculate total count for the current filter
      const totalFilteredCount = filteredData.length
      setTotalCount(totalFilteredCount)
      setTotalPages(Math.ceil(totalFilteredCount / itemsPerPage))

      // Apply pagination to filtered data
      const startIndex = (currentPage - 1) * itemsPerPage
      const endIndex = startIndex + itemsPerPage
      const paginatedData = filteredData.slice(startIndex, endIndex)

      // Check contest participation status for each submission
      const enhancedData = await Promise.all(
        paginatedData.map(async (submission: any) => {
          const roundId = await checkContestParticipation(submission.id)
          const isPublic =
            submission.component_data &&
            typeof submission.component_data === "object"
              ? await checkIsPublic(submission.component_data.id)
              : false
          return {
            ...submission,
            contest_round_id: roundId,
            is_public: isPublic,
          }
        }),
      )

      setSubmissions(enhancedData as unknown as Submission[])
    } catch (error) {
      console.error("Error fetching submissions:", error)
      toast.error("Failed to load submissions")
    } finally {
      setLoading(false)
    }
  }

  // Pagination handlers
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const changeItemsPerPage = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1) // Reset to first page when changing items per page
  }

  // Check if a demo is part of a contest round
  const checkContestParticipation = async (
    demoId: number,
  ): Promise<number | null> => {
    try {
      const { data, error } = await supabase
        .from("demo_hunt_scores")
        .select("round_id")
        .eq("demo_id", demoId)
        .single()

      if (error) {
        if (error.code === "PGRST116") {
          // No data found, not participating in any contest
          return null
        }
        throw error
      }

      return data?.round_id || null
    } catch (error) {
      console.error("Error checking contest participation:", error)
      return null
    }
  }

  // Get contest round details by ID
  const getRoundById = (roundId: number | null): ContestRound | null => {
    if (!roundId) return null
    return allRounds.find((round) => round.id === roundId) || null
  }

  // Add a demo to a specific contest round
  const addToContest = useCallback(
    async (demoId: number, roundId: number) => {
      if (!roundId) {
        toast.error("No contest round selected")
        return false
      }

      // Find round details
      const round = getRoundById(roundId)
      if (!round) {
        toast.error("Selected contest round not found")
        return false
      }

      setContestRoundLoading(true)
      try {
        // First check if it's already in any contest
        const existingRoundId = await checkContestParticipation(demoId)

        // If demo is already in the same round, just return
        if (existingRoundId === roundId) {
          toast.info("This demo is already in this contest round")
          return true
        }

        // If demo is in a different round, update its round_id instead of deleting and recreating
        if (existingRoundId) {
          const { error: updateError } = await supabase
            .from("demo_hunt_scores")
            .update({ round_id: roundId })
            .eq("demo_id", demoId)

          if (updateError) {
            throw updateError
          }

          console.log(
            `Changed demo ${demoId} round from ${existingRoundId} to ${roundId}`,
          )
        } else {
          // Demo is not in any contest yet, add a new record
          const { error } = await supabase.from("demo_hunt_scores").insert({
            demo_id: demoId,
            round_id: roundId,
            final_score: 0,
            installs: 0,
            views: 0,
            votes: 0,
          })

          if (error) {
            throw error
          }
        }

        // Update the local state
        setSubmissions((prevSubmissions) =>
          prevSubmissions.map((sub) =>
            sub.id === demoId ? { ...sub, contest_round_id: roundId } : sub,
          ),
        )

        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: ["demo-hunt-submissions"] })

        // Show appropriate success message based on whether it was a move or a new addition
        if (existingRoundId) {
          toast.success(`Moved to Week #${round.week_number} contest round`)
        } else {
          toast.success(`Added to Week #${round.week_number} contest round`)
        }

        return true
      } catch (error) {
        console.error("Error managing contest participation:", error)
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to manage contest participation"
        toast.error(errorMessage)
        return false
      } finally {
        setContestRoundLoading(false)
      }
    },
    [allRounds, supabase, queryClient],
  )

  const sendStatusNotification = async (
    submission: Submission,
    status: SubmissionStatus,
    feedback?: string,
  ) => {
    try {
      const response = await fetch("/api/emails/submission-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          submission,
          status,
          feedback,
        }),
      })

      const result = await response.json()

      if (!response.
```

### Core Architecture Module: `apps/web/components/features/component-page/legacy-flow-preview-renderer.tsx`
```
"use client"

import {
  SandpackPreview,
  SandpackProviderProps,
  SandpackProvider as SandpackProviderUnstyled,
} from "@codesandbox/sandpack-react"
import { motion } from "motion/react"
import React, { useEffect, useMemo, useState } from "react"

import { useBundleDemo } from "@/hooks/use-bundle-demo"
import { generateBundleFiles } from "@/lib/sandpack"
import { Component, Demo, Tag, User } from "@/types/global"
import { useTheme } from "next-themes"
import { FullScreenButton } from "../../ui/full-screen-button"
import { LoadingSpinner } from "../../ui/loading-spinner"

interface LegacyFlowPreviewRendererProps {
  providerProps: SandpackProviderProps
  component: Component & { user: User } & { tags: Tag[] }
  code: string
  demoCode: string
  dependencies: Record<string, string>
  demoDependencies: Record<string, string>
  demoComponentNames: string[]
  registryDependencies: Record<string, string>
  npmDependenciesOfRegistryDependencies: Record<string, string>
  tailwindConfig?: string
  globalCss?: string
  demo: Demo
  css: string | null
  shellCode: string[]
  allDependencies: Record<string, string>
}

const LoadingDisplay: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center h-full gap-3">
    <LoadingSpinner />
    <p className="text-muted-foreground text-sm">{message}</p>
  </div>
)

const LoadingOverlay: React.FC<{ text: string }> = ({ text }) => (
  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center h-full gap-3 bg-background/80">
    <LoadingSpinner />
    <p className="text-muted-foreground text-sm">{text}</p>
  </div>
)

export function LegacyFlowPreviewRenderer({
  providerProps,
  component,
  code,
  demoCode,
  demoComponentNames,
  registryDependencies,
  tailwindConfig,
  globalCss,
  demo,
  css,
  shellCode,
  allDependencies,
}: LegacyFlowPreviewRendererProps) {
  const { resolvedTheme } = useTheme()
  const isDarkTheme = resolvedTheme === "dark"

  const [contentLoading, setContentLoading] = useState(true)
  const [contentError, setContentError] = useState(false)
  const [showLongLoadMessage, setShowLongLoadMessage] = useState(false)

  const bundleFiles = useMemo(
    () => ({
      ...registryDependencies,
      ...generateBundleFiles({
        demoComponentNames,
        componentSlug: component.component_slug,
        relativeImportPath: `/components/${component.registry}`,
        code,
        demoCode,
        css: css || "",
        customTailwindConfig: tailwindConfig,
        customGlobalCss: globalCss,
      }),
    }),
    [
      registryDependencies,
      demoComponentNames,
      component.component_slug,
      component.registry,
      code,
      demoCode,
      css,
      tailwindConfig,
      globalCss,
    ],
  )

  const { bundle, error: bundleError } = useBundleDemo({
    files: bundleFiles,
    dependencies: allDependencies,
    component,
    shellCode,
    demoId: demo.id,
    tailwindConfig,
    globalCss,
  })

  const demoBundleHash = demo?.bundle_hash

  const urls = useMemo(() => {
    if ((code === "" || demoCode === "") && demo.bundle_html_url) {
      return {
        html: demo.bundle_html_url,
      }
    }
    if (bundle?.html) {
      return bundle
    }
    return null
  }, [bundle?.html, demo.bundle_html_url, code, demoCode])

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined
    const isPreviewDefinitelyUnavailable = !!(
      bundle?.html &&
      demoBundleHash === "0" &&
      !bundleError
    )

    if (isPreviewDefinitelyUnavailable) {
      if (contentLoading) {
        setContentLoading(false)
      }
      setShowLongLoadMessage(false)
    } else if (contentLoading) {
      setShowLongLoadMessage(false)
      timer = setTimeout(() => {
        if (contentLoading && !isPreviewDefinitelyUnavailable) {
          setShowLongLoadMessage(true)
        }
      }, 10000)
    } else {
      setShowLongLoadMessage(false)
    }

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [contentLoading, bundle, demoBundleHash, bundleError])

  const derivedErrorFromBundle = bundleError
  const shouldShowErrorState = contentError || !!derivedErrorFromBundle

  const getCurrentLoadingMessage = () => {
    if (showLongLoadMessage) {
      return "Loading is taking longer than usual... you may want to refresh the page"
    }
    return "Starting preview..."
  }

  let displayContent: React.ReactNode

  if (shouldShowErrorState) {
    displayContent = (
      <>
        {contentLoading && !contentError && (
          <LoadingOverlay text={getCurrentLoadingMessage()} />
        )}
        <SandpackProviderUnstyled {...providerProps}>
          <SandpackPreview
            showSandpackErrorOverlay={false}
            showOpenInCodeSandbox={process.env.NODE_ENV === "development"}
            showRefreshButton={false}
            onLoad={() => setContentLoading(false)}
            onError={() => {
              setContentError(true)
              setContentLoading(false)
            }}
          />
        </SandpackProviderUnstyled>
      </>
    )
  } else if (urls?.html && demoBundleHash !== "0") {
    displayContent = (
      <>
        {contentLoading && <LoadingOverlay text={getCurrentLoadingMessage()} />}
        <iframe
          src={isDarkTheme ? `${urls.html}?dark=true` : urls.html}
          className="w-full h-full"
          onLoad={() => setContentLoading(false)}
          onError={() => {
            setContentError(true)
            setContentLoading(false)
          }}
        />
      </>
    )
  } else {
    let message: string
    const isPreviewUnavailableNonError = !!(
      bundle?.html &&
      demoBundleHash === "0" &&
      !bundleError
    )

    if (isPreviewUnavailableNonError) {
      message = "Preview is not available for this specific demo version."
      if (contentLoading) setContentLoading(false)
    } else if (
      (bundle === null || bundle?.html === null) &&
      !bundleError &&
      contentLoading
    ) {
      message = getCurrentLoadingMessage()
    } else if (
      !bundleError &&
      !bundle?.html &&
      !contentLoading &&
      demoBundleHash !== "0"
    ) {
      message = "Preview content is unavailable."
    } else {
      message = getCurrentLoadingMessage()
    }

    if (
      contentLoading &&
      !shouldShowErrorState &&
      !(bundle?.html && demoBundleHash !== "0")
    ) {
      displayContent = <LoadingDisplay message={getCurrentLoadingMessage()} />
    } else {
      displayContent = <LoadingDisplay message={message} />
    }
  }

  return (
    <motion.div className="relative flex-grow h-full rounded-lg overflow-hidden">
      <FullScreenButton />
      {displayContent}
    </motion.div>
  )
}

```

### Core Architecture Module: `apps/web/components/features/component-page/new-flow-preview-render.tsx`
```
import { Demo } from "@/types/global"
import { useTheme } from "next-themes"
import { motion } from "motion/react"
import { FullScreenButton } from "../../ui/full-screen-button"
import { LoadingSpinner } from "../../ui/loading-spinner"
import React, { useState } from "react"

export function NewFlowPreviewRender({ demo }: { demo: Demo }) {
  const { resolvedTheme } = useTheme()
  const [isLoading, setIsLoading] = useState(true)

  return (
    <motion.div className="relative flex-grow h-full rounded-lg overflow-hidden">
      <FullScreenButton />
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center h-full gap-3 bg-background/80">
          <LoadingSpinner />
          <p className="text-muted-foreground text-sm">Loading preview...</p>
        </div>
      )}
      <iframe
        src={`${demo.bundle_html_url}?theme=${resolvedTheme}`}
        className="w-full h-full"
        onLoad={() => setIsLoading(false)}
        onError={() => setIsLoading(false)} // Optionally handle error differently
      />
    </motion.div>
  )
}

```

### Core Architecture Module: `apps/web/components/features/component-page/preview-renderer.tsx`
```
"use client"

import React, { useState, useEffect, useMemo } from "react"
import { motion } from "motion/react"
import {
  SandpackProvider as SandpackProviderUnstyled,
  SandpackPreview,
  SandpackProviderProps,
} from "@codesandbox/sandpack-react"

import { LoadingSpinner } from "../../ui/loading-spinner"
import { FullScreenButton } from "../../ui/full-screen-button"
import { Component, Demo, Tag, User } from "@/types/global"
import { generateBundleFiles } from "@/lib/sandpack"
import { useBundleDemo } from "@/hooks/use-bundle-demo"

interface PreviewRendererProps {
  isDarkTheme: boolean
  providerProps: SandpackProviderProps
  component: Component & { user: User } & { tags: Tag[] }
  code: string
  demoCode: string
  dependencies: Record<string, string>
  demoDependencies: Record<string, string>
  demoComponentNames: string[]
  registryDependencies: Record<string, string>
  npmDependenciesOfRegistryDependencies: Record<string, string>
  tailwindConfig?: string
  globalCss?: string
  demo: Demo
  css: string | null
  shellCode: string[]
  allDependencies: Record<string, string>
}

const LoadingDisplay: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center h-full gap-3">
    <LoadingSpinner />
    <p className="text-muted-foreground text-sm">{message}</p>
  </div>
)

const LoadingOverlay: React.FC<{ text: string }> = ({ text }) => (
  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center h-full gap-3 bg-background/80">
    <LoadingSpinner />
    <p className="text-muted-foreground text-sm">{text}</p>
  </div>
)

export function PreviewRenderer({
  isDarkTheme,
  providerProps,
  component,
  code,
  demoCode,
  dependencies,
  demoDependencies,
  demoComponentNames,
  registryDependencies,
  npmDependenciesOfRegistryDependencies,
  tailwindConfig,
  globalCss,
  demo,
  css,
  shellCode,
  allDependencies,
}: PreviewRendererProps) {
  const [contentLoading, setContentLoading] = useState(true)
  const [contentError, setContentError] = useState(false)
  const [showLongLoadMessage, setShowLongLoadMessage] = useState(false)

  const bundleFiles = useMemo(
    () => ({
      ...registryDependencies,
      ...generateBundleFiles({
        demoComponentNames,
        componentSlug: component.component_slug,
        relativeImportPath: `/components/${component.registry}`,
        code,
        demoCode,
        css: css || "",
        customTailwindConfig: tailwindConfig,
        customGlobalCss: globalCss,
      }),
    }),
    [
      registryDependencies,
      demoComponentNames,
      component.component_slug,
      component.registry,
      code,
      demoCode,
      css,
      tailwindConfig,
      globalCss,
    ],
  )

  const { bundle, error: bundleError } = useBundleDemo({
    files: bundleFiles,
    dependencies: allDependencies,
    component,
    shellCode,
    demoId: demo.id,
    tailwindConfig,
    globalCss,
  })

  const demoBundleHash = demo?.bundle_hash

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined
    const isPreviewDefinitelyUnavailable = !!(
      bundle?.html &&
      demoBundleHash === "0" &&
      !bundleError
    )

    if (isPreviewDefinitelyUnavailable) {
      if (contentLoading) {
        setContentLoading(false)
      }
      setShowLongLoadMessage(false)
    } else if (contentLoading) {
      setShowLongLoadMessage(false)
      timer = setTimeout(() => {
        if (contentLoading && !isPreviewDefinitelyUnavailable) {
          setShowLongLoadMessage(true)
        }
      }, 10000)
    } else {
      setShowLongLoadMessage(false)
    }

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [contentLoading, bundle, demoBundleHash, bundleError])

  const derivedErrorFromBundle = bundleError
  const shouldShowErrorState = contentError || !!derivedErrorFromBundle

  const getCurrentLoadingMessage = () => {
    if (showLongLoadMessage) {
      return "Loading is taking longer than usual... you may want to refresh the page"
    }
    return "Starting preview..."
  }

  let displayContent: React.ReactNode

  if (shouldShowErrorState) {
    displayContent = (
      <>
        {contentLoading && !contentError && (
          <LoadingOverlay text={getCurrentLoadingMessage()} />
        )}
        <SandpackProviderUnstyled {...providerProps}>
          <SandpackPreview
            showSandpackErrorOverlay={false}
            showOpenInCodeSandbox={process.env.NODE_ENV === "development"}
            showRefreshButton={false}
            onLoad={() => setContentLoading(false)}
            onError={() => {
              setContentError(true)
              setContentLoading(false)
            }}
          />
        </SandpackProviderUnstyled>
      </>
    )
  } else if (bundle?.html && demoBundleHash !== "0") {
    displayContent = (
      <>
        {contentLoading && <LoadingOverlay text={getCurrentLoadingMessage()} />}
        <iframe
          src={isDarkTheme ? `${bundle.html}?dark=true` : bundle.html}
          className="w-full h-full"
          onLoad={() => setContentLoading(false)}
          onError={() => {
            setContentError(true)
            setContentLoading(false)
          }}
        />
      </>
    )
  } else {
    let message: string
    const isPreviewUnavailableNonError = !!(
      bundle?.html &&
      demoBundleHash === "0" &&
      !bundleError
    )

    if (isPreviewUnavailableNonError) {
      message = "Preview is not available for this specific demo version."
      if (contentLoading) setContentLoading(false)
    } else if (
      (bundle === null || bundle?.html === null) &&
      !bundleError &&
      contentLoading
    ) {
      message = getCurrentLoadingMessage()
    } else if (
      !bundleError &&
      !bundle?.html &&
      !contentLoading &&
      demoBundleHash !== "0"
    ) {
      message = "Preview content is unavailable."
    } else {
      message = getCurrentLoadingMessage()
    }

    if (
      contentLoading &&
      !shouldShowErrorState &&
      !(bundle?.html && demoBundleHash !== "0")
    ) {
      displayContent = <LoadingDisplay message={getCurrentLoadingMessage()} />
    } else {
      displayContent = <LoadingDisplay message={message} />
    }
  }

  return (
    <motion.div className="relative flex-grow h-full rounded-lg overflow-hidden">
      <FullScreenButton />
      {displayContent}
    </motion.div>
  )
}

```

### Core Architecture Module: `apps/web/components/features/design-engineers/design-engineer-card.tsx`
```
import Link from "next/link"
import Image from "next/image"
import { Eye, Download } from "lucide-react"
import { motion } from "motion/react"
import { ComponentVideoPreview } from "../list-card/card-video"
import { Database } from "@/types/supabase"
import { DemoWithComponent } from "@/types/global"

type DatabaseAuthor =
  Database["public"]["Functions"]["get_active_authors_with_top_components"]["Returns"][0]

interface DesignEngineerCardProps {
  author: DatabaseAuthor
}

export function DesignEngineerCard({ author }: DesignEngineerCardProps) {
  const totalViews = Number(author.total_views) || 0
  const totalUsages = Number(author.total_usages) || 0
  const totalDownloads = Number(author.total_downloads) || 0
  const topComponents = (author.top_components || []) as DemoWithComponent[]

  return (
    <div className="block p-[1px]">
      <div className="group relative bg-background rounded-lg shadow-base p-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background to-accent/10 group-hover:to-accent/20 transition-colors" />

        <div className="relative flex flex-col lg:flex-row gap-6">
          {/* Author Info Section */}
          <div className="w-full lg:w-1/2 relative z-10">
            <Link
              href={`/${author.display_username || author.username}`}
              className="block"
            >
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full shadow-base shrink-0">
                  {author.display_image_url || author.image_url ? (
                    <Image
                      src={author.display_image_url || author.image_url || ""}
                      alt={
                        author.display_name ||
                        author.name ||
                        author.username ||
                        ""
                      }
                      className="h-12 w-12 rounded-full shadow-base object-cover"
                      width={48}
                      height={48}
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full shadow-base bg-muted flex items-center justify-center">
                      <span className="text-lg font-medium">
                        {(
                          (author.display_name ||
                            author.name ||
                            author.username ||
                            "?")?.[0] || "?"
                        ).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col flex-1">
                  <div className="space-y-1 mb-4">
                    <h2 className="font-semibold text-lg group-hover:text-primary transition-colors">
                      {author.display_name || author.name || author.username}
                    </h2>
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                      {author.bio ||
                        `@${author.display_username || author.username}`}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Eye className="w-4 h-4" />
                      <span className="text-sm">
                        {totalViews.toLocaleString()} views
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Download className="w-4 h-4" />
                      <span className="text-sm">
                        {(totalUsages + totalDownloads).toLocaleString()} usages
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* Components Cards Section */}
          {topComponents.length > 0 && (
            <div className="w-full lg:w-1/2 relative min-h-[150px] flex justify-center">
              <div className="absolute bottom-0 translate-y-12 translate-x-12 min-420:translate-x-0 lg:translate-x-5 flex items-end">
                {topComponents.map((demo, index) => (
                  <motion.div
                    key={demo.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.3,
                      delay: 0.3 + index * 0.15,
                      type: "spring",
                      stiffness: 100,
                    }}
                  >
                    <Link
                      href={`/${demo.component.user?.display_username || demo.component.user?.username}/${demo.component?.component_slug}/${demo.demo_slug || "default"}`}
                      className={`
                        block
                        transition-all duration-300 ease-out
                        hover:z-10
                        hover:-translate-y-5
                        ${index === 0 ? "mr-[-110px]" : ""}
                        w-[240px]
                        relative
                      `}
                    >
                      <div className="relative aspect-[4/3] mb-3">
                        <div className="absolute inset-0">
                          <div className="relative w-full h-full rounded-lg shadow-base overflow-hidden hover:z-10 group/card">
                            <div className="absolute inset-0">
                              <Image
                                src={demo.preview_url || "/placeholder.svg"}
                                alt={demo.name || ""}
                                className="object-cover"
                                fill
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                priority={index === 0}
                              />
                            </div>
                            {demo.video_url && (
                              <div className="absolute inset-0">
                                <ComponentVideoPreview
                                  component={demo}
                                  demo={demo}
                                />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent pointer-events-none opacity-100 group-hover/card:opacity-0 transition-opacity duration-300">
                              <div className="absolute bottom-2 left-0 right-0 p-3">
                                <h3 className="text-white font-medium text-sm mb-0.5 line-clamp-1">
                                  {demo.component?.name}
                                </h3>
                                <p className="text-white/80 text-xs">
                                  {(demo.view_count || 0).toLocaleString()}{" "}
                                  views
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

```

### Core Architecture Module: `apps/web/components/features/design-engineers/design-engineers-list.tsx`
```
"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { DesignEngineerCardSkeleton } from "@/components/ui/skeletons"
import { useClerkSupabaseClient } from "@/lib/clerk"
import { DesignEngineerCard } from "./design-engineer-card"
import { Database } from "@/types/supabase"
import { useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type DatabaseAuthor =
  Database["public"]["Functions"]["get_active_authors_with_top_components"]["Returns"][0]

interface DesignEngineersListProps {
  className?: string
  initialData?: DatabaseAuthor[]
}

export function DesignEngineersList({
  className,
  initialData,
}: DesignEngineersListProps) {
  const supabaseWithAdminAccess = useClerkSupabaseClient()
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, isFetching, hasNextPage, fetchNextPage } =
    useInfiniteQuery({
      queryKey: ["active-authors"],
      queryFn: async ({ pageParam = 0 }) => {
        const { data, error } = await supabaseWithAdminAccess.rpc(
          "get_active_authors_with_top_components",
          {
            p_offset: Number(pageParam) * 10,
            p_limit: 10,
          },
        )

        if (error) {
          throw error
        }

        return {
          data: data || [],
          total_count: data?.[0]?.total_count ?? 0,
        }
      },
      initialData: initialData
        ? {
            pages: [
              {
                data: initialData,
                total_count: initialData.length,
              },
            ],
            pageParams: [0],
          }
        : undefined,
      getNextPageParam: (lastPage, allPages) => {
        if (!lastPage?.data || lastPage.data.length === 0) return undefined
        const loadedCount = allPages.reduce(
          (sum, page) => sum + page.data.length,
          0,
        )
        return loadedCount < lastPage.total_count ? allPages.length : undefined
      },
      initialPageParam: 0,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
    })

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetching) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )

    const currentRef = loadMoreRef.current
    if (currentRef) {
      observer.observe(currentRef)
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef)
      }
    }
  }, [hasNextPage, isFetching, fetchNextPage])

  if (isLoading) {
    return (
      <div
        className={cn(
          "grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 list-none pb-10",
          className,
        )}
      >
        {Array(10)
          .fill(0)
          .map((_, index) => (
            <DesignEngineerCardSkeleton key={index} />
          ))}
      </div>
    )
  }

  const authors = data?.pages.flatMap((page) => page.data) || []

  return (
    <>
      <div
        className={cn(
          "grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 list-none pb-10",
          className,
        )}
      >
        {authors.map((author) => (
          <DesignEngineerCard key={author.id} author={author} />
        ))}
        {hasNextPage && (
          <div ref={loadMoreRef} className="col-span-full h-10 -z-10 -mt-5" />
        )}
      </div>
      {isFetching && (
        <div className="col-span-full flex justify-center pt-2 pb-4">
          <Loader2 className="h-5 w-5 animate-spin text-foreground/20 -mt-6" />
        </div>
      )}
    </>
  )
}

```

### Core Architecture Module: `apps/web/components/features/publish/config/utils.ts`
```
import { UseFormReturn } from "react-hook-form"
import { z } from "zod"

const demoSchema = z.object({
  name: z.string().min(2, {
    message: "Demo name must be at least 2 characters.",
  }),
  demo_code: z.string().min(1, {
    message: "Demo code is required.",
  }),
  demo_slug: z.string().min(1, {
    message: "Demo slug is required.",
  }),
  preview_image_data_url: z.string({
    required_error: "Preview image is required.",
  }),
  preview_image_file: z.instanceof(File, {
    message: "Preview image file is required.",
  }),
  preview_video_data_url: z.string().optional(),
  preview_video_file: z.instanceof(File).optional(),
  tags: z
    .array(
      z.object({
        id: z.number().optional(),
        name: z.string(),
        slug: z.string(),
      }),
    )
    .min(1, {
      message: "At least one tag is required.",
    }),
  demo_direct_registry_dependencies: z.array(z.string()).default([]),
  demo_dependencies: z.record(z.string()).default({}),
  tailwind_config: z.string().optional(),
  global_css: z.string().optional(),
})

export const formSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  component_slug: z.string().min(2, {
    message: "Slug must be at least 2 characters.",
  }),
  code: z.string().min(1, {
    message: "Component code is required.",
  }),
  demos: z.array(demoSchema).default([]),
  description: z.string().optional(),
  license: z.string(),
  website_url: z.string().optional(),
  is_public: z.boolean(),
  unknown_dependencies: z.array(z.string()).default([]),
  unknown_dependencies_with_metadata: z
    .array(
      z.object({
        slugWithUsername: z.string(),
        registry: z.string(),
        isDemoDependency: z.boolean(),
      }),
    )
    .default([]),
  direct_registry_dependencies: z.array(z.string()).default([]),
  registry: z.string(),
  publish_as_username: z.string().optional(),
  slug_available: z.boolean().optional(),
  tailwind_config: z.string().optional(),
  globals_css: z.string().optional(),
})

export type FormData = z.infer<typeof formSchema>

export type DemoFormData = z.infer<typeof demoSchema>

export interface TagOption {
  value: number
  label: string
  __isNew__?: boolean
}

export const formatComponentName = (name: string): string => {
  return name.replace(/([A-Z])/g, " $1").trim()
}

export const isFormValid = (form: UseFormReturn<FormData>): boolean => {
  const {
    name,
    component_slug,
    code,
    demos,
    registry,
    license,
    unknown_dependencies,
  } = form.getValues()

  return Boolean(
    name?.length >= 2 &&
      component_slug?.length >= 2 &&
      code?.length > 0 &&
      demos?.length > 0 &&
      registry &&
      license &&
      unknown_dependencies?.length === 0,
  )
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #282** (2026-06-07): **Integrate Unified AGI System with security and documentation updates**
  *Symptoms*: 

- **Issue #255** (2026-02-20): **Agi system integration 8881604204142371309**
  *Symptoms*: 

- **Issue #250** (2026-02-04): **Report: Site not loading, t2.claude_code_integration does not exists in the current database**
  *Symptoms*: <img width="1912" height="1053" alt="Image" src="https://github.com/user-attachments/assets/622d4dba-95dd-4004-ac82-8c0d0646855e" />  https://21st.dev  Error logs (trpc) 1 - demos.homePopular ```  << query #51 demos.homePopular   Object { input: undefined, result: TRPCClientError, elapsedMs: 468, context: {} } ​ context: Object {  } ​ elapsedMs: 468 ​ input: undefined ​ result: TRPCClientError:  Invalid `prisma.demo.findMany()` invocation:   The column `t2.claude_code_integration` does not exist in the current database. ``` 2 - demos.homeNewest ```  << query #44 demos.homeNewest   Object { input: undefined, result: TRPCClientError, elapsedMs: 480, context: {} } ​ context: Object {  } ​ elapsedMs: 480 ​ input: undefined ​ result: TRPCClientError:  Invalid `prisma.demo.findMany()` invocation:   The column `t3.claude_code_integration` does not exist in the current database. ```   Loc: India Url: https://21st.dev Browser: Zen (FF Fork) Maybe forgot to migrate db?

- **Issue #246** (2026-07-05): **Report: Features 9 component**
  *Symptoms*: Component: Features 9 Author: meschacirung URL: https://21st.dev/community/components/tailark/features-9/default  Please describe the issue:  DependencyNotFoundError Could not find dependency: 'react-is' relative to '/node_modules/recharts/es6/util/ReactUtils.js' 

- **Issue #236** (2025-10-31): **Report: Auth Switch component**
  *Symptoms*: Component: Auth Switch Author: appvibed01 URL: https://21st.dev/community/components/appvibed01/auth-switch/default  Please describe the issue: there is no code here  edit - seems they have a second one with code

- **Issue #224** (2025-09-16): **Report: Share Button component**
  *Symptoms*: Component: Share Button Author: reuno-ui URL: https://21st.dev/reuno-ui/share-button/default  Please describe the issue: he copied my component

- **Issue #210** (2025-07-29): **Report: Creative Pricing component**
  *Symptoms*: 

- **Issue #202** (2025-06-25): **refactor: remove footer from search page**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Related Issue https://github.com/serafimcloud/21st/issues/201

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `beb0fdcf` (2025-05-28)
**Commit Message**: feat: multiple fixes

refactor: new preview

feat: change name in sidebar

feat: highlight bolt copy prompt

add website url submissions

feat: highlight bolt copy prompt

**File**: `apps/web/app/admin/submissions/page.tsx` (modified, +20/-0)
```diff
@@ -664,6 +664,7 @@ const SubmissionsAdminPage: FC = () => {
                         Demo & Actions
                       </TableHead>
                       <TableHead>Author</TableHead>
+                      <TableHead>Website</TableHead>
                       <TableHead>Status</TableHead>
                       <TableHead>Visibility</TableHead>
                       <TableHead>Submitted</TableHead>
@@ -827,6 +828,25 @@ const SubmissionsAdminPage: FC = () => {
                               submission.user_data.username}
                           </TableCell>
 
+                          <TableCell>
+                            {submission.component_data.website_url ? (
+                              <a
+                                href={submission.component_data.website_url}
+                                target="_blank"
+                                rel="noopener noreferrer"
+                                className="text-blue-600 hover:text-blue-800 underline text-sm"
+                                onClick={(e) => e.stopPropagation()}
+                              >
+                                {submission.component_data.website_url.length >
+                                30
+                                  ? `${submission.component_data.website_url.substring(0, 30)}...`
+                                  : submission.component_data.website_url}
+                              </a>
+                            ) : (
+                              <span className="text-gray-400 text-sm">—</span>
+                            )}
+                          </TableCell>
+
                           <TableCell onClick={(e) => e.stopPropagation()}>
                             <TooltipProvider>
                               <Tooltip>
```

**File**: `apps/web/components/features/admin/types.ts` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ export interface Submission {
     likes_count: number
     license: string
     registry: string
+    website_url: string | null
   }
   user_data: {
     id: string
```

**File**: `apps/web/components/features/magic/hero.tsx` (modified, +1/-1)
```diff
@@ -471,7 +471,7 @@ export function Hero() {
               >
                 <div className="relative w-full h-full group">
                   <img
-                    src="/magic-preview.png"
+                    src="/magic-preview.webp"
                     alt="Magic Agent Demo"
                     className="object-cover object-center"
                   />
```

**File**: `apps/web/components/features/main-page/sidebar-layout.tsx` (modified, +2/-2)
```diff
@@ -100,7 +100,7 @@ export function MainSidebar() {
     )
   }
 
-  // Toggle item expansion (like Magic MCP)
+  // Toggle item expansion (like AI Component Builder)
   const toggleExpandItem = (id: string) => {
     setExpandedItems((prev) =>
       prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
@@ -207,7 +207,7 @@ export function MainSidebar() {
                   </SidebarMenuItem>
                 ))}
 
-              {/* Magic MCP collapsible menu */}
+              {/* AI Component Builder collapsible menu */}
               <SidebarMenuItem className="group/menu-item relative">
                 <SidebarMenuButton
                   isActive={false}
```

**File**: `apps/web/components/icons/index.tsx` (modified, +21/-0)
```diff
@@ -53,6 +53,27 @@ export const Icons = {
       />
     </div>
   ),
+  cursorIcon: (props: LucideProps) => (
+    <div className="pointer-events-none relative size-5 mix-blend-multiply dark:mix-blend-lighten">
+      <img
+        alt=""
+        width="20"
+        height="20"
+        decoding="async"
+        className="absolute transition-opacity duration-500"
+        src="https://cursor.com/assets/videos/logo/placeholder-logo.webp"
+      />
+      <video
+        width="20"
+        height="20"
+        playsInline
+        preload="auto"
+        aria-label="Cursor video logo animation"
+        src="https://cursor.com/assets/videos/logo/logo-black.mp4"
+        poster="https://cursor.com/assets/videos/logo/placeholder-logo.webp"
+      />
+    </div>
+  ),
   cursorLogo: (props: LucideProps) => (
     <svg
       fill="currentColor"
```

**File**: `apps/web/components/ui/sidebar.tsx` (modified, +4/-1)
```diff
@@ -428,7 +428,10 @@ const SidebarGroup = React.forwardRef<
     <div
       ref={ref}
       data-sidebar="group"
-      className={cn("relative flex w-full min-w-0 flex-col p-2 pl-3", className)}
+      className={cn(
+        "relative flex w-full min-w-0 flex-col p-2 pl-3",
+        className,
+      )}
       {...props}
     />
   )
```

**File**: `apps/web/lib/navigation.ts` (modified, +7/-3)
```diff
@@ -61,15 +61,15 @@ export const mainNavigationItems: MainNavigationItem[] = [
   },
 ]
 
-// This is a separate navigation item for Magic MCP that will only be used for the sidebar
+// This is a separate navigation item for AI Component Builder that will only be used for the sidebar
 // and won't be part of the tab navigation
 export const magicNavItem = {
-  title: "Magic MCP",
+  title: "AI UI Builder",
   icon: Wand2,
   isNew: true,
   subitems: [
     {
-      title: "About",
+      title: "About Magic MCP",
       href: "/magic",
       externalLink: true,
     },
@@ -81,6 +81,10 @@ export const magicNavItem = {
       title: "Console",
       href: "/magic/console",
     },
+    {
+      title: "Pricing",
+      href: "/pricing",
+    },
   ],
 }
 
```

**File**: `apps/web/lib/prompts.tsx` (modified, +20/-27)
```diff
@@ -24,15 +24,12 @@ type PromptOption = PromptOptionBase | PromptSeparator
 export const promptOptions: PromptOption[] = [
   {
     type: "option",
-    id: PROMPT_TYPES.EXTENDED,
-    label: "For most AI code editors",
-    description: "Optimized for most AI code editors",
+    id: PROMPT_TYPES.BOLT,
+    label: "Bolt.new (Partnership)",
+    description: "Optimized for Bolt.new",
     action: "copy",
     icon: (
-      <Sparkles
-        size={16}
-        className="min-h-[16px] min-w-[16px] max-h-[16px] max-w-[16px]"
-      />
+      <Icons.boltLogo className="min-h-[22px] min-w-[22px] max-h-[22px] max-w-[22px]" />
     ),
   },
   {
@@ -41,22 +38,22 @@ export const promptOptions: PromptOption[] = [
   },
   {
     type: "option",
-    id: PROMPT_TYPES.REPLIT,
-    label: "Replit",
-    description: "Optimized for Replit Agent",
+    id: PROMPT_TYPES.EXTENDED,
+    label: "Cursor (or any AI IDE)",
+    description: "Works with any AI IDE",
     action: "copy",
     icon: (
-      <Icons.replit className="min-h-[22px] min-w-[22px] max-h-[22px] max-w-[22px]" />
+      <Icons.cursorIcon className="min-h-[18px] min-w-[18px] max-h-[18px] max-w-[18px]" />
     ),
   },
   {
     type: "option",
-    id: PROMPT_TYPES.MAGIC_PATTERNS,
-    label: "Magic Patterns",
-    description: "Optimized for Magic Patterns",
+    id: PROMPT_TYPES.LOVABLE,
+    label: "Lovable",
+    description: "Optimized for Lovable.dev",
     action: "copy",
     icon: (
-      <Icons.magicPatterns className="min-h-[18px] min-w-[18px] max-h-[18px] max-w-[18px]" />
+      <Icons.lovableLogo className="min-h-[18px] min-w-[18px] max-h-[18px] max-w-[18px]" />
     ),
   },
   {
@@ -71,22 +68,22 @@ export const promptOptions: PromptOption[] = [
   },
   {
     type: "option",
-    id: PROMPT_TYPES.LOVABLE,
-    label: "Lovable",
-    description: "Optimized for Lovable.dev",
+    id: PROMPT_TYPES.REPLIT,
+    label: "Replit",
+    description: "Optimized for Replit Agent",
     action: "copy",
     icon: (
-      <Icons.lovableLogo className="min-h-[18px] min-w-[18px] max-h-[18px] max-w-[18px]" />
+      <Icons.replit className="min-h-[22px] min-w-[22px] max-h-[22px] max-w-[22px]" />
     ),
   },
   {
     type: "option",
-    id: PROMPT_TYPES.BOLT,
-    label: "Bolt.new",
-    description: "Optimized for Bolt.new",
+    id: PROMPT_TYPES.MAGIC_PATTERNS,
+    label: "Magic Patterns",
+    description: "Optimized for Magic Patterns",
     action: "copy",
     icon: (
-      <Icons.boltLogo className="min-h-[22px] min-w-[22px] max-h-[22px] max-w-[22px]" />
+      <Icons.magicPatterns className="min-h-[18px] min-w-[18px] max-h-[18px] max-w-[18px]" />
     ),
   },
   {
@@ -99,10 +96,6 @@ export const promptOptions: PromptOption[] = [
       <Icons.sitebrewLogo className="min-h-[18px] min-w-[18px] max-h-[18px] max-w-[18px]" />
     ),
   },
-  {
-    id: "separator2",
-    type: "separator",
-  },
 ]
 
 export type { PromptOption, PromptOptionBase }
```

---

### Incident Patch 2: `53085264` (2025-05-25)
**Commit Message**: fix: hide weekly contest

**File**: `apps/web/app/contest/leaderboard/page.client.tsx` (modified, +138/-119)
```diff
@@ -72,6 +72,14 @@ export function LeaderboardClient({
   // Flag to track if initial randomization is done
   const isRandomizationDoneRef = useRef<boolean>(false)
 
+  // Check if current round is active
+  const isCurrentRoundActive = useMemo(() => {
+    const now = new Date()
+    const startDate = new Date(currentRound.start_at)
+    const endDate = new Date(currentRound.end_at)
+    return now >= startDate && now <= endDate
+  }, [currentRound.start_at, currentRound.end_at])
+
   const {
     submissions = [],
     getFilteredSubmissions,
@@ -166,131 +174,142 @@ export function LeaderboardClient({
     <div className="h-full">
       <Header />
       <div className="space-y-8">
-        {/* Prize Information Section */}
-        <div className="space-y-4">
-          <div className="flex justify-between items-center">
-            <h3 className="font-medium flex items-center gap-2">
-              Weekly Prizes
-            </h3>
-            <Button size="sm">
-              <Link href="/publish">Publish your component</Link>
-            </Button>
-          </div>
-          <div className="rounded-lg border border-border">
-            <Table>
-              <TableHeader>
-                <TableRow className="bg-muted/50">
-                  <TableHead>Tier</TableHead>
-                  <TableHead>Prize</TableHead>
-                </TableRow>
-              </TableHeader>
-              <TableBody>
-                <TableRow>
-                  <TableCell className="font-medium">
-                    Global Awards (10)
-                  </TableCell>
-                  <TableCell>
-                    🥇 $700 • 🥈 $400 • 🥉 $250 • 4th-10th $50 each
-                  </TableCell>
-                </TableRow>
-                <TableRow>
-                  <TableCell className="font-medium">
-                    Seasonal Awards (3)
-                  </TableCell>
-                  <TableCell>🥇 $150 • 🥈 $100 • 🥉 $50</TableCell>
-                </TableRow>
-                <TableRow>
-                  <TableCell className="font-medium">
-                    Total Weekly Payout
-                  </TableCell>
-                  <TableCell className="font-bold">$2,000</TableCell>
-                </TableRow>
-              </TableBody>
-            </Table>
-          </div>
-          <p className="text-xs text-muted-foreground italic">
-            Overlap allowed: the same component can win in multiple categories
-          </p>
-        </div>
-
-        {/* Notice about pause after Week 3 */}
-        {currentRound.week_number === 3 && (
-          <div className="space-y-2">
-            <div className="rounded-lg border border-border p-4 bg-muted/20">
-              <div className="flex items-center gap-2 font-medium mb-2">
-                <span>⏸️</span>
-                <span>Important Notice</span>
+        {/* Only show current round sections if the round is active */}
+        {isCurrentRoundActive && (
+          <>
+            {/* Prize Information Section */}
+            <div className="space-y-4">
+              <div className="flex justify-between items-center">
+                <h3 className="font-medium flex items-center gap-2">
+                  Weekly Prizes
+                </h3>
+                <Button size="sm">
+                  <Link href="/publish">Publish your component</Link>
+                </Button>
+              </div>
+              <div className="rounded-lg border border-border">
+                <Table>
+                  <TableHeader>
+                    <TableRow className="bg-muted/50">
+                      <TableHead>Tier</TableHead>
+                      <TableHead>Prize</TableHead>
+                    </TableRow>
+                  </TableHeader>
+                  <TableBody>
+                    <TableRow>
+                      <TableCell className="font-medium">
+                        Global Awards (10)
+                      </TableCell>
+                      <TableCell>
+                        🥇 $700 • 🥈 $400 • 🥉 $250 • 4th-10th $50 each
+                      </TableCell>
+                    </TableRow>
+                    <TableRow>
+                      <TableCell className="font-medium">
+                        Seasonal Awards (3)
+                      </TableCell>
+                      <TableCell>🥇 $150 • 🥈 $100 • 🥉 $50</TableCell>
+                    </TableRow>
+                    <TableRow>
+                      <TableCell className="font-medium">
+                        Total Weekly Payout
+                      </TableCell>
+                      <TableCell className="font-bold">$2,000</TableCell>
+                    </TableRow>
+                  </TableBody>
+                </Table>
               </div>
-              <p className="text-sm">
-                After Week 3, we'll be taking a short pause to evaluate the
-                contest format and gather community feedback. Stay tuned for
-    
```

**File**: `apps/web/app/contest/page.tsx` (modified, +2/-36)
```diff
@@ -92,7 +92,7 @@ export default async function Page() {
             <section className="space-y-4 w-full bg-background antialiased mt-14">
               <div className="flex justify-between items-center">
                 <h2 className="font-medium flex items-center gap-2">
-                  $2000 Weekly Contest
+                  Contest
                 </h2>
                 <Button asChild className="gap-2">
                   <Link href="/contest/leaderboard">View Leaderboard</Link>
@@ -276,41 +276,7 @@ export default async function Page() {
               </div>
             </section>
 
-            <div className="h-px bg-border" />
-
-            <section className="space-y-4">
-              <h2 className="font-medium flex items-center gap-2">
-                🎁 Bonus Category Roadmap (Extra Prizes)
-              </h2>
-              <div className="rounded-lg border border-border">
-                <Table>
-                  <TableHeader>
-                    <TableRow className="bg-muted/50">
-                      <TableHead>Week</TableHead>
-                      <TableHead>Dates (PT)</TableHead>
-                      <TableHead>Bonus Component Theme</TableHead>
-                    </TableRow>
-                  </TableHeader>
-                  <TableBody>
-                    {safeRounds.map((round) => (
-                      <TableRow key={round.id}>
-                        <TableCell className="font-medium">
-                          {round.week_number}
-                        </TableCell>
-                        <TableCell>
-                          {round.start_at && round.end_at
-                            ? formatDateRange(round.start_at, round.end_at)
-                            : "—"}
-                        </TableCell>
-                        <TableCell className="font-medium">
-                          {round.seasonalTag?.name || "—"}
-                        </TableCell>
-                      </TableRow>
-                    ))}
-                  </TableBody>
-                </Table>
-              </div>
-            </section>
+            
 
             <div className="h-px bg-border" />
 
```

**File**: `apps/web/components/features/main-page/sidebar-layout.tsx` (modified, +1/-10)
```diff
@@ -353,16 +353,7 @@ export function MainSidebar() {
 
         <SidebarGroup>
           <SidebarGroupLabel className="text-sm font-semibold text-foreground">
-            <TextShimmer
-              className="font-medium [--base-color:hsl(var(--mono-gradient-start))] [--base-gradient-color:hsl(var(--mono-gradient-end))] dark:[--base-color:hsl(var(--mono-gradient-start))] dark:[--base-gradient-color:hsl(var(--mono-gradient-end))]"
-              duration={1.2}
-              spread={2}
-            >
-              $2000 Weekly Contest
-            </TextShimmer>
-            <span className="ml-2 rounded-md bg-[#adfa1d] px-1.5 py-0.5 text-xs leading-none font-normal text-[#000000]">
-              New
-            </span>
+            Contest
           </SidebarGroupLabel>
           <SidebarGroupContent>
             <SidebarMenu>
```

---

### Incident Patch 3: `4e22eac4` (2025-05-22)
**Commit Message**: fix z-index of magic-banenr

**File**: `apps/web/components/features/magic/magic-banner.tsx` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ const MagicBannerContent = memo(function MagicBannerContent() {
 
   return (
     <div
-      className="fixed top-14 z-50 border-b border-border bg-muted transition-[left] duration-200 ease-in-out"
+      className="fixed top-14 z-[90] border-b border-border bg-muted transition-[left] duration-200 ease-in-out"
       style={{
         left: isSidebarOpen ? "var(--sidebar-width, 0px)" : "0",
         right: "0",
```

---

### Incident Patch 4: `c35fcc90` (2025-05-22)
**Commit Message**: Fix: disabled ContextMenu on touch

**File**: `apps/web/components/features/list-card/card.tsx` (modified, +19/-16)
```diff
@@ -12,32 +12,31 @@ import {
 } from "@/components/ui/context-menu"
 import { promptOptions } from "@/lib/prompts"
 import { PromptType } from "@/types/global"
-import { Bookmark, Eye, ThumbsUp, Video } from "lucide-react"
+import { Bookmark, Eye, Video } from "lucide-react"
 import Link from "next/link"
 import { toast } from "sonner"
 
 import { Button } from "@/components/ui/button"
+import {
+  Tooltip,
+  TooltipContent,
+  TooltipProvider,
+  TooltipTrigger,
+} from "@/components/ui/tooltip"
 import { AMPLITUDE_EVENTS, trackEvent } from "@/lib/amplitude"
 import { useClerkSupabaseClient } from "@/lib/clerk"
 import { bookmarkDemo } from "@/lib/queries"
+import { cn, shouldHideLeaderboardRankings } from "@/lib/utils"
 import { Component, DemoWithComponent, User } from "@/types/global"
 import { useUser } from "@clerk/nextjs"
+import NumberFlow from "@number-flow/react"
+import { motion } from "motion/react"
+import router from "next/router"
+import { UpvoteIcon } from "../../icons/upvote-icon"
 import { ComponentCardSkeleton } from "../../ui/skeletons"
 import { UserAvatar } from "../../ui/user-avatar"
 import ComponentPreviewImage from "./card-image"
 import { ComponentVideoPreview } from "./card-video"
-import { shouldHideLeaderboardRankings } from "@/lib/utils"
-import { UpvoteIcon } from "../../icons/upvote-icon"
-import { motion } from "motion/react"
-import { useState } from "react"
-import { cn } from "@/lib/utils"
-import {
-  Tooltip,
-  TooltipContent,
-  TooltipProvider,
-  TooltipTrigger,
-} from "@/components/ui/tooltip"
-import NumberFlow from "@number-flow/react"
 
 // Extended type to include leaderboard fields
 type LeaderboardDemoWithComponent = DemoWithComponent & {
@@ -77,6 +76,7 @@ export function ComponentCard({
   const componentSlug = isDemo
     ? demo.component?.component_slug
     : demo.component_slug
+  const isTouch = window.matchMedia("(pointer: coarse)").matches
 
   if (!userData || !username || !componentSlug) {
     console.warn("Missing required data:", {
@@ -249,9 +249,12 @@ export function ComponentCard({
 
   return (
     <ContextMenu>
-      <ContextMenuTrigger className="block p-[1px]">
+      <ContextMenuTrigger
+        className="block p-[1px] select-none"
+        disabled={isTouch}
+      >
         <div
-          className="block"
+          className="block select-none"
           onClick={(e) => {
             if (e.metaKey || e.ctrlKey) {
               e.preventDefault()
@@ -265,7 +268,7 @@ export function ComponentCard({
               e.preventDefault()
               onClick()
             } else {
-              window.location.href = componentUrl
+              router.push(componentUrl)
             }
           }}
         >
```

---

### Incident Patch 5: `4c9f74ab` (2025-05-22)
**Commit Message**: Fix legacy deps

**File**: `apps/web/lib/queries.server.ts` (modified, +2/-2)
```diff
@@ -36,7 +36,7 @@ export async function resolveRegistryDependencyTree({
     })
     .join(",")
   const { data: dependencies, error } = await supabase
-    .from("component_dependencies_graph_view_v2")
+    .from("component_dependencies_graph_view_v3")
     .select("*")
     .or(filterConditions)
     .returns<
@@ -114,7 +114,7 @@ export async function resolveRegistryDependencyTree({
       if (stylesPromises.length > 0) {
         const responses = await Promise.all(stylesPromises)
         const texts = await Promise.all(responses.map((r) => r.text()))
-        
+
         styles = {
           tailwindConfig: tailwind_config_extension ? texts[0] : undefined,
           globalCss: global_css_extension ? texts[texts.length - 1] : undefined,
```

**File**: `apps/web/types/supabase.ts` (modified, +272/-3)
```diff
@@ -221,6 +221,13 @@ export type Database = {
             referencedRelation: "component_dependencies_graph_view_v2"
             referencedColumns: ["id"]
           },
+          {
+            foreignKeyName: "bundle_items_component_id_fkey"
+            columns: ["component_id"]
+            isOneToOne: false
+            referencedRelation: "component_dependencies_graph_view_v3"
+            referencedColumns: ["id"]
+          },
           {
             foreignKeyName: "bundle_items_component_id_fkey"
             columns: ["component_id"]
@@ -289,7 +296,7 @@ export type Database = {
           fee: number
           id: string
           paid_to_user: boolean
-          plan_id: number | null
+          plan_id: number
           price: number
           status: Database["public"]["Enums"]["payment_status"]
           user_id: string
@@ -300,7 +307,7 @@ export type Database = {
           fee: number
           id: string
           paid_to_user?: boolean
-          plan_id?: number | null
+          plan_id: number
           price: number
           status: Database["public"]["Enums"]["payment_status"]
           user_id: string
@@ -311,7 +318,7 @@ export type Database = {
           fee?: number
           id?: string
           paid_to_user?: boolean
-          plan_id?: number | null
+          plan_id?: number
           price?: number
           status?: Database["public"]["Enums"]["payment_status"]
           user_id?: string
@@ -504,6 +511,13 @@ export type Database = {
             referencedRelation: "component_dependencies_graph_view_v2"
             referencedColumns: ["id"]
           },
+          {
+            foreignKeyName: "component_analytics_component_id_fkey"
+            columns: ["component_id"]
+            isOneToOne: false
+            referencedRelation: "component_dependencies_graph_view_v3"
+            referencedColumns: ["id"]
+          },
           {
             foreignKeyName: "component_analytics_component_id_fkey"
             columns: ["component_id"]
@@ -575,6 +589,13 @@ export type Database = {
             referencedRelation: "component_dependencies_graph_view_v2"
             referencedColumns: ["id"]
           },
+          {
+            foreignKeyName: "component_dependencies_closure_component_id_fkey"
+            columns: ["component_id"]
+            isOneToOne: false
+            referencedRelation: "component_dependencies_graph_view_v3"
+            referencedColumns: ["id"]
+          },
           {
             foreignKeyName: "component_dependencies_closure_component_id_fkey"
             columns: ["component_id"]
@@ -610,6 +631,13 @@ export type Database = {
             referencedRelation: "component_dependencies_graph_view_v2"
             referencedColumns: ["id"]
           },
+          {
+            foreignKeyName: "component_dependencies_closure_dependency_component_id_fkey"
+            columns: ["dependency_component_id"]
+            isOneToOne: false
+            referencedRelation: "component_dependencies_graph_view_v3"
+            referencedColumns: ["id"]
+          },
           {
             foreignKeyName: "component_dependencies_closure_dependency_component_id_fkey"
             columns: ["dependency_component_id"]
@@ -699,6 +727,13 @@ export type Database = {
             referencedRelation: "component_dependencies_graph_view_v2"
             referencedColumns: ["id"]
           },
+          {
+            foreignKeyName: "component_likes_component_id_fkey"
+            columns: ["component_id"]
+            isOneToOne: false
+            referencedRelation: "component_dependencies_graph_view_v3"
+            referencedColumns: ["id"]
+          },
           {
             foreignKeyName: "component_likes_component_id_fkey"
             columns: ["component_id"]
@@ -764,6 +799,13 @@ export type Database = {
             referencedRelation: "component_dependencies_graph_view_v2"
             referencedColumns: ["id"]
           },
+          {
+            foreignKeyName: "component_tags_component_id_fkey"
+            columns: ["component_id"]
+            isOneToOne: false
+            referencedRelation: "component_dependencies_graph_view_v3"
+            referencedColumns: ["id"]
+          },
           {
             foreignKeyName: "component_tags_component_id_fkey"
             columns: ["component_id"]
@@ -926,6 +968,20 @@ export type Database = {
             referencedRelation: "component_dependencies_graph_view_v2"
             referencedColumns: ["source_author_username"]
           },
+          {
+            foreignKeyName: "components_hunter_username_fkey"
+            columns: ["hunter_username"]
+            isOneToOne: false
+            referencedRelation: "component_dependencies_graph_view_v3"
+            referencedColumns: ["dependency_author_username"]
+          },
+          {
+            foreignKeyName: "components_hunter_username_fkey"
+            columns: ["hunter_username"]
+         
```

---

### Incident Patch 6: `2b1ff597` (2025-05-22)
**Commit Message**: preview fix

**File**: `apps/web/app/[username]/[component_slug]/page.tsx` (modified, +1/-1)
```diff
@@ -151,7 +151,7 @@ export default async function ComponentPageServer(props: {
 
     const [{ data: componentDemos }, hasPurchased] = await Promise.all([
       getComponentDemos(supabaseWithAdminAccess, component.id),
-      userId ? hasUserComponentAccess(userId, component.id) : false,
+      hasUserComponentAccess(userId, component.id),
     ])
 
     if (!hasPurchased) {
```

---

### Incident Patch 7: `87d3ad22` (2025-05-21)
**Commit Message**: Bundling fix

**File**: `apps/web/app/api/bundle/route.ts` (modified, +15/-8)
```diff
@@ -1,11 +1,13 @@
-import { NextResponse } from "next/server"
-import { supabaseWithAdminAccess } from "@/lib/supabase"
-import crypto from "crypto"
-import { defaultTailwindConfig, defaultGlobalCss } from "@/lib/sandpack"
+import { hasUserPurchasedDemo } from "@/lib/api/server/demos"
 import {
   resolveRegistryDependenciesV2,
   transformToFlatDependencyTree,
 } from "@/lib/registry"
+import { defaultGlobalCss, defaultTailwindConfig } from "@/lib/sandpack"
+import { supabaseWithAdminAccess } from "@/lib/supabase"
+import { auth } from "@clerk/nextjs/server"
+import crypto from "crypto"
+import { NextResponse } from "next/server"
 
 export async function POST(request: Request) {
   try {
@@ -93,12 +95,17 @@ export async function POST(request: Request) {
       )
       .digest("hex")
 
+    const { userId } = await auth()
+    const isPurchased = await hasUserPurchasedDemo(userId, demoId)
+
     // If we have a cached bundle with the same hash, return it
+    // Force cache if not purchased
     if (
-      !demoError &&
-      demo &&
-      demo.bundle_hash === contentHash &&
-      demo.bundle_html_url
+      (!demoError &&
+        demo &&
+        demo.bundle_hash === contentHash &&
+        demo.bundle_html_url) ||
+      !isPurchased
     ) {
       return NextResponse.json({
         html: demo.bundle_html_url,
```

**File**: `apps/web/components/features/component-page/legacy-flow-preview-renderer.tsx` (modified, +14/-2)
```diff
@@ -107,6 +107,18 @@ export function LegacyFlowPreviewRenderer({
 
   const demoBundleHash = demo?.bundle_hash
 
+  const urls = useMemo(() => {
+    if ((code === "" || demoCode === "") && demo.bundle_html_url) {
+      return {
+        html: demo.bundle_html_url,
+      }
+    }
+    if (bundle?.html) {
+      return bundle
+    }
+    return null
+  }, [bundle?.html, demo.bundle_html_url, code, demoCode])
+
   useEffect(() => {
     let timer: NodeJS.Timeout | undefined
     const isPreviewDefinitelyUnavailable = !!(
@@ -168,12 +180,12 @@ export function LegacyFlowPreviewRenderer({
         </SandpackProviderUnstyled>
       </>
     )
-  } else if (bundle?.html && demoBundleHash !== "0") {
+  } else if (urls?.html && demoBundleHash !== "0") {
     displayContent = (
       <>
         {contentLoading && <LoadingOverlay text={getCurrentLoadingMessage()} />}
         <iframe
-          src={isDarkTheme ? `${bundle.html}?dark=true` : bundle.html}
+          src={isDarkTheme ? `${urls.html}?dark=true` : urls.html}
           className="w-full h-full"
           onLoad={() => setContentLoading(false)}
           onError={() => {
```

---

### Incident Patch 8: `9105b0b5` (2025-05-21)
**Commit Message**: Token TTL Fix

**File**: `apps/web/components/features/component-page/component-preview.tsx` (modified, +1/-1)
```diff
@@ -379,7 +379,7 @@ const useInstallUrl = (component: Component, user: User) => {
 
   useEffect(() => {
     // TODO: Add custom template to make JWT live longer
-    auth.getToken().then((token) => {
+    auth.getToken({ template: "long-token" }).then((token) => {
       const url = new URL(
         `${process.env.NEXT_PUBLIC_APP_URL}/r/${user.username}/${component.component_slug}`,
       )
```

---

### Incident Patch 9: `d810d915` (2025-05-21)
**Commit Message**: Reverted bundle_html_url in legacy flow

**File**: `apps/web/components/features/component-page/legacy-flow-preview-renderer.tsx` (modified, +0/-5)
```diff
@@ -103,11 +103,6 @@ export function LegacyFlowPreviewRenderer({
     demoId: demo.id,
     tailwindConfig,
     globalCss,
-    existingBundleUrls: demo.bundle_html_url
-      ? {
-          html: demo.bundle_html_url,
-        }
-      : null,
   })
 
   const demoBundleHash = demo?.bundle_hash
```

---

### Incident Patch 10: `5b38d8cb` (2025-05-20)
**Commit Message**: fix: update BoltBanner link to point to hackathon.dev

**File**: `apps/web/components/features/bolt/bolt-banner.tsx` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ import text from "./bolt-text.png"
 const BoltBannerContent = memo(function BoltBannerContent() {
   return (
     <a
-      href="https://bolt.new"
+      href="https://hackathon.dev"
       target="_blank"
       className="h-[110px] rounded-lg z-50 border-b border-border bg-muted transition-[left] duration-200 ease-in-out"
     >
```

---

### Incident Patch 11: `5dc74792` (2025-05-20)
**Commit Message**: fix: update success dialog messages for component submission

**File**: `apps/web/components/features/publish/components/success-dialog.tsx` (modified, +2/-2)
```diff
@@ -29,12 +29,12 @@ export function SuccessDialog({
 
   const title =
     mode === "component"
-      ? "Component Added Successfully"
+      ? "Component Submited for Review"
       : "Demo Added Successfully"
 
   const description =
     mode === "component"
-      ? "Your new component has been successfully added. What would you like to do next?"
+      ? "You can preview your component, it will be public after approval. Review usually takes 24 hours."
       : "Your new demo has been successfully added. What would you like to do next?"
 
   const addAnotherText = mode === "component" ? "Add another" : "Add another"
```

---

### Incident Patch 12: `5e8a729d` (2025-05-16)
**Commit Message**: don't upload empty index.css file to r2

**File**: `apps/web/components/features/studio/publish/hooks/use-submit-component.ts` (modified, +16/-4)
```diff
@@ -282,14 +282,24 @@ export const useSubmitComponent = () => {
 
     console.log("demo", demo)
 
-    const generateIndexCss = (registryJson: string) => {
+    const generateIndexCss = (registryJson: string): string | undefined => {
       try {
         const reg = JSON.parse(registryJson)
         const { cssVars = {}, css = {} } = reg
         const themeVars: Record<string, string> = cssVars.theme ?? {}
         const lightVars: Record<string, string> = cssVars.light ?? {}
         const darkVars: Record<string, string> = cssVars.dark ?? {}
 
+        const hasCustomVars =
+          Object.keys(themeVars).length > 0 ||
+          Object.keys(lightVars).length > 0 ||
+          Object.keys(darkVars).length > 0
+        const hasCustomCss = Object.keys(css).length > 0
+
+        if (!hasCustomVars && !hasCustomCss) {
+          return undefined
+        }
+
         const lines: string[] = []
         lines.push('@import "tailwindcss";')
         lines.push('@import "tw-animate-css";\n')
@@ -340,12 +350,14 @@ export const useSubmitComponent = () => {
         return lines.join("\n")
       } catch (e) {
         console.error("Failed to generate index.css", e)
-        return ""
+        return undefined
       }
     }
 
-    const indexCssContent = generateIndexCss(state.componentRegistryJSON)
-    const hasIndexCss = indexCssContent.trim().length > 0
+    const indexCssContent: string | undefined = generateIndexCss(
+      state.componentRegistryJSON,
+    )
+    const hasIndexCss = typeof indexCssContent === "string"
 
     const [
       codeUrl,
```

---

### Incident Patch 13: `fd7b1065` (2025-05-16)
**Commit Message**: fix: tooltip

**File**: `apps/web/components/ui/full-screen-button.tsx` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ export function FullScreenButton() {
           </motion.button>
         </TooltipTrigger>
         <TooltipContent
-          side="left"
+          side="right"
           className="z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
         >
           <p className="flex items-center gap-1.5">
```

---

### Incident Patch 14: `f713242c` (2025-05-14)
**Commit Message**: set index_css_url to null if not provided

**File**: `apps/web/components/features/studio/publish/hooks/use-submit-component.ts` (modified, +1/-3)
```diff
@@ -530,7 +530,7 @@ export const useSubmitComponent = () => {
       is_public: context.form.is_public,
       sandbox_id: context.sandboxId,
       registry_url: registryJsonUrl,
-      ...(indexCssUrl && { index_css_url: indexCssUrl }),
+      index_css_url: indexCssUrl || null,
     }
 
     let finalComponent: Tables<"components"> | null = null
@@ -629,8 +629,6 @@ export const useSubmitComponent = () => {
         throw submissionFetchError
       }
 
-      console.log("existingSubmission", existingSubmission)
-
       if (!existingSubmission) {
         const { error: insertError } = await context.supabase
           .from("submissions")
```

---

### Incident Patch 15: `c6906dc2` (2025-05-14)
**Commit Message**: add index.css support to component and API

**File**: `apps/web/app/[username]/[component_slug]/page.client.tsx` (modified, +3/-0)
```diff
@@ -347,6 +347,7 @@ type ComponentPageProps = {
   globalCss?: string
   compiledCss?: string
   submission?: Submission
+  tailwind4IndexCss?: string
   hasPurchased?: boolean
 }
 
@@ -366,6 +367,7 @@ export default function ComponentPage({
   componentDemos = [],
   submission,
   hasPurchased = false,
+  tailwind4IndexCss,
 }: ComponentPageProps) {
   const [component, setComponent] = useState(initialComponent)
   const demo = initialDemo ?? null
@@ -1152,6 +1154,7 @@ export default function ComponentPage({
         <ComponentPagePreview
           key={theme}
           component={component}
+          tailwind4IndexCss={tailwind4IndexCss}
           code={code}
           demoCode={demoCode}
           dependencies={dependencies}
```

**File**: `apps/web/app/[username]/[component_slug]/page.tsx` (modified, +5/-0)
```diff
@@ -180,6 +180,9 @@ export default async function ComponentPageServer(props: {
       demo.compiled_css
         ? fetchFileTextContent(demo.compiled_css)
         : Promise.resolve({ data: null, error: null }),
+      component.index_css_url
+        ? fetchFileTextContent(component.index_css_url)
+        : Promise.resolve({ data: null, error: null }),
     ]
 
     const demoRegistryDeps = Array.isArray(
@@ -196,6 +199,7 @@ export default async function ComponentPageServer(props: {
       tailwindConfigResult,
       globalCssResult,
       compiledCssResult,
+      indexCssResult,
       registryDependenciesResult,
     ] = await Promise.all([
       ...componentAndDemoCodePromises,
@@ -257,6 +261,7 @@ export default async function ComponentPageServer(props: {
           component={component}
           demo={demo}
           componentDemos={componentDemos}
+          tailwind4IndexCss={indexCssResult?.data as string}
           code={codeResult?.data as string}
           demoCode={demoResult?.data as string}
           dependencies={dependencies}
```

**File**: `apps/web/app/api/prompts/route.ts` (modified, +3/-1)
```diff
@@ -106,12 +106,13 @@ export async function POST(request: NextRequest) {
       )
     }
 
-    const [demoCode, componentCode, tailwindConfig, globalCss] =
+    const [demoCode, componentCode, tailwindConfig, globalCss, indexCss] =
       await Promise.all([
         fetchCode(demo.demo_code),
         fetchCode(demo.component.code),
         fetchCode(demo.component.tailwind_config_extension),
         fetchCode(demo.component.global_css_extension),
+        fetchCode(demo.component.index_css_url),
       ])
 
     const resolvedComponentRegistryDependencies =
@@ -199,6 +200,7 @@ export async function POST(request: NextRequest) {
       tailwindConfig: tailwindConfig,
       // TODO: aggregate global css from all dependencies
       globalCss: globalCss,
+      indexCss: indexCss,
       userAdditionalContext: additional_context,
       ...(ruleData && {
         promptRule: {
```

**File**: `apps/web/components/features/component-page/component-preview.tsx` (modified, +4/-0)
```diff
@@ -73,6 +73,7 @@ export function ComponentPagePreview({
   compiledCss,
   showPaywall,
   accessState,
+  tailwind4IndexCss,
 }: {
   component: Component & { user: User } & { tags: Tag[] }
   code: string
@@ -83,6 +84,7 @@ export function ComponentPagePreview({
   registryDependencies: Record<string, string>
   npmDependenciesOfRegistryDependencies: Record<string, string>
   tailwindConfig?: string
+  tailwind4IndexCss?: string
   globalCss?: string
   compiledCss?: string | null
   canEdit: boolean
@@ -141,6 +143,7 @@ export function ComponentPagePreview({
   )
 
   const files = {
+    ...(tailwind4IndexCss ? { "index.css": tailwind4IndexCss } : []),
     ...registryDependencies,
     ...generateSandpackFiles({
       demoComponentNames,
@@ -196,6 +199,7 @@ export function ComponentPagePreview({
   const visibleFiles = [
     demoComponentFile,
     mainComponentFile,
+    ...(tailwind4IndexCss ? ["index.css"] : []),
     ...(tailwindConfig ? ["tailwind.config.js"] : []),
     ...(globalCss ? ["globals.css"] : []),
     ...Object.keys(registryDependencies).filter(
```

**File**: `apps/web/lib/prompts.tsx` (modified, +14/-0)
```diff
@@ -131,6 +131,7 @@ export const getComponentInstallPrompt = ({
   globalCss,
   promptRule,
   userAdditionalContext,
+  indexCss,
 }: {
   promptType: PromptType
   codeFileName: string
@@ -144,6 +145,7 @@ export const getComponentInstallPrompt = ({
   globalCss?: string
   promptRule?: PromptRule
   userAdditionalContext?: string
+  indexCss?: string
 }) => {
   const componentFileName = codeFileName.split("/").slice(-1)[0]
   const componentDemoFileName = demoCodeFileName.split("/").slice(-1)[0]
@@ -438,6 +440,18 @@ export const getComponentInstallPrompt = ({
       "\n"
   }
 
+  if (indexCss) {
+    prompt +=
+      "\n" +
+      endent`
+        Extend existing Tailwind 4 index.css with this code (or if project uses Tailwind 3, extend tailwind.config.js or globals.css):
+        \`\`\`css
+        ${indexCss}
+        \`\`\`
+      ` +
+      "\n"
+  }
+
   if (globalCss) {
     prompt +=
       "\n" +
```

**File**: `apps/web/types/supabase.ts` (modified, +3/-0)
```diff
@@ -779,6 +779,7 @@ export type Database = {
           user_id: string
           video_url: string | null
           website_url: string | null
+          index_css_url: string | null
         }
         Insert: {
           code?: string
@@ -812,6 +813,7 @@ export type Database = {
           user_id: string
           video_url?: string | null
           website_url?: string | null
+          index_css_url?: string | null
         }
         Update: {
           code?: string
@@ -845,6 +847,7 @@ export type Database = {
           user_id?: string
           video_url?: string | null
           website_url?: string | null
+          index_css_url?: string | null
         }
         Relationships: [
           {
```

#### Recent Merged Pull Requests:
- **PR #282** (closed): Integrate Unified AGI System with security and documentation updates (@OneFineStarstuff)
- **PR #255** (closed): Agi system integration 8881604204142371309 (@OneFineStarstuff)
- **PR #202** (closed): refactor: remove footer from search page (@lucien-loua)
- **PR #195** (2025-05-20): Bundles (@Danverr)
- **PR #185** (2025-05-13): New flow registry 2 (@bunasQ)
- **PR #183** (2025-05-13): Registry install (@bunasQ)
- **PR #179** (closed): Toogle Sidebar in Header Client (@designali-com)
- **PR #178** (2025-05-09): Sandboxes publishing features (@bunasQ)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
