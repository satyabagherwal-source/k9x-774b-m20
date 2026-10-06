# Forensic Learning Record (Deep Inspection): InsForge/InsForge

> **Canonical Artifact**: `07_PROJECT_LEARNING/insforge-insforge-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/InsForge/InsForge](https://github.com/InsForge/InsForge))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:02:54.195Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `InsForge/InsForge`
- **Description**: The all-in-one, open-source backend platform for agentic coding. InsForge gives your coding agent database, auth, storage, compute, hosting, and AI gateway to ship full-stack apps end-to-end.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 13056 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/src/api/routes/webhooks/index.routes.ts`
```
import { Router } from 'express';
import { razorpayWebhookRouter } from './razorpay.routes.js';
import { stripeWebhookRouter } from './stripe.routes.js';
import { vercelWebhookRouter } from './vercel.routes.js';

const router = Router();

router.use('/stripe', stripeWebhookRouter);
router.use('/razorpay', razorpayWebhookRouter);
router.use('/vercel', vercelWebhookRouter);

export { router as webhooksRouter };

```

### Core Architecture Module: `backend/src/api/routes/webhooks/razorpay.routes.ts`
```
import { Router, type Request, type Response, type NextFunction } from 'express';
import { parseZodSchema } from '@/utils/zod.js';
import { AppError } from '@/utils/errors.js';
import { RazorpayWebhookService } from '@/services/payments/razorpay/webhook.service.js';
import { ERROR_CODES, razorpayWebhookParamsSchema } from '@insforge/shared-schemas';

const router = Router();
const webhookService = RazorpayWebhookService.getInstance();

router.post('/:environment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { environment } = parseZodSchema(razorpayWebhookParamsSchema, req.params);

    const signature = req.headers['x-razorpay-signature'];
    if (!signature || typeof signature !== 'string') {
      throw new AppError('Missing X-Razorpay-Signature header', 401, ERROR_CODES.AUTH_UNAUTHORIZED);
    }

    const rawBodyBuffer = req.body;
    if (!Buffer.isBuffer(rawBodyBuffer)) {
      throw new AppError('Missing raw Razorpay webhook body', 400, ERROR_CODES.INVALID_INPUT);
    }

    const headerEventId = req.headers['x-razorpay-event-id'];
    const result = await webhookService.handleRazorpayWebhook(
      environment,
      rawBodyBuffer,
      signature,
      typeof headerEventId === 'string' ? headerEventId : undefined
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

export { router as razorpayWebhookRouter };

```

### Core Architecture Module: `backend/src/api/routes/webhooks/stripe.routes.ts`
```
import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '@/utils/errors.js';
import { ERROR_CODES, stripeWebhookParamsSchema } from '@insforge/shared-schemas';
import { StripeWebhookService } from '@/services/payments/stripe/webhook.service.js';

const router = Router();
const webhookService = StripeWebhookService.getInstance();

export function normalizeStripeWebhookError(error: unknown) {
  if (error instanceof Error && error.name === 'StripeSignatureVerificationError') {
    return new AppError(error.message, 400, ERROR_CODES.INVALID_INPUT);
  }

  return error;
}

/**
 * Stripe webhook endpoint
 * POST /api/webhooks/stripe/:environment
 *
 * Receives Stripe test/live account events and updates payment runtime projections.
 * Verifies the request using Stripe's signature over the raw request body.
 */
router.post('/:environment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paramsValidation = stripeWebhookParamsSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      throw new AppError('Invalid Stripe environment', 400, ERROR_CODES.INVALID_INPUT);
    }

    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string') {
      throw new AppError('Missing stripe-signature header', 401, ERROR_CODES.AUTH_UNAUTHORIZED);
    }

    if (!Buffer.isBuffer(req.body)) {
      throw new AppError(
        'Stripe webhook requires raw request body',
        400,
        ERROR_CODES.INVALID_INPUT
      );
    }

    const result = await webhookService.handleStripeWebhook(
      paramsValidation.data.environment,
      req.body,
      signature
    );

    res.status(200).json(result);
  } catch (error) {
    next(normalizeStripeWebhookError(error));
  }
});

export { router as stripeWebhookRouter };

```

### Core Architecture Module: `backend/src/api/routes/webhooks/vercel.routes.ts`
```
import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { DeploymentService } from '@/services/deployments/deployment.service.js';
import { SecretService } from '@/services/secrets/secret.service.js';
import { AppError } from '@/utils/errors.js';
import { ERROR_CODES } from '@insforge/shared-schemas';
import {
  VERCEL_EVENT_TO_STATUS,
  type VercelWebhookPayload,
  type VercelDeploymentEventType,
} from '@/types/webhooks.js';
import { dashboardEventService } from '@/services/dashboard/dashboard-event.service.js';
import logger from '@/utils/logger.js';

const router = Router();
const deploymentService = DeploymentService.getInstance();
const secretService = SecretService.getInstance();

/**
 * Vercel webhook endpoint
 * POST /api/webhooks/vercel
 *
 * Receives deployment events from Vercel and updates the database accordingly.
 * Verifies the request using HMAC-SHA1 signature in x-vercel-signature header.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['x-vercel-signature'] as string | undefined;

    if (!signature) {
      throw new AppError('Missing x-vercel-signature header', 401, ERROR_CODES.AUTH_UNAUTHORIZED);
    }

    // Get the webhook secret from secrets service
    const webhookSecret = await secretService.getSecretByKey('VERCEL_WEBHOOK_SECRET');

    if (!webhookSecret) {
      logger.error('VERCEL_WEBHOOK_SECRET not found in secrets');
      throw new AppError('Webhook not configured', 500, ERROR_CODES.INTERNAL_ERROR);
    }

    // req.body is raw Buffer (express.raw middleware applied in server.ts)
    const rawBody = req.body as Buffer;

    // Verify the signature using HMAC-SHA1 on original bytes
    const expectedSignature = crypto
      .createHmac('sha1', webhookSecret)
      .update(rawBody)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      logger.warn('Invalid Vercel webhook signature');
      throw new AppError('Invalid signature', 401, ERROR_CODES.AUTH_UNAUTHORIZED);
    }

    // Parse the webhook payload after signature verification
    const webhookPayload = JSON.parse(rawBody.toString()) as VercelWebhookPayload;
    const eventType = webhookPayload.type;

    // Check if this is a deployment event we handle
    if (!(eventType in VERCEL_EVENT_TO_STATUS)) {
      logger.info('Ignoring unhandled Vercel webhook event', { eventType });
      return res.status(200).json({ received: true, handled: false });
    }

    const status = VERCEL_EVENT_TO_STATUS[eventType as VercelDeploymentEventType];
    const deploymentId = webhookPayload.payload.deployment.id;
    const url = webhookPayload.payload.deployment.url
      ? `https://${webhookPayload.payload.deployment.url}`
      : null;

    // Update the deployment in our database
    const deployment = await deploymentService.updateDeploymentFromWebhook(
      deploymentId,
      status,
      url,
      {
        webhookEventId: webhookPayload.id,
        webhookEventType: eventType,
        target: webhookPayload.payload.target,
        projectId: webhookPayload.payload.project?.id,
      }
    );

    if (!deployment) {
      // Deployment not found in our database - this is ok, might be from another source
      logger.info('Deployment not found for webhook, ignoring', { deploymentId });
      return res.status(200).json({ received: true, handled: false });
    }

    // Notify the dashboard that deployment metadata changed.
    try {
      dashboardEventService.publishDataUpdate({ resource: 'deployments' });
    } catch {
      // Best-effort notification; do not fail webhook response
    }

    logger.info('Vercel webhook processed successfully', {
      eventType,
      deploymentId,
      status,
    });

    res.status(200).json({ received: true, handled: true });
  } catch (error) {
    next(error);
  }
});

export { router as vercelWebhookRouter };

```

### Core Architecture Module: `backend/src/infra/realtime/webhook-sender.ts`
```
import axios, { AxiosError } from 'axios';
import logger from '@/utils/logger.js';
import type { WebhookMessage } from '@insforge/shared-schemas';

export interface WebhookResult {
  url: string;
  success: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * WebhookSender - Handles HTTP delivery of realtime messages to webhook endpoints
 */
export class WebhookSender {
  private readonly timeout = 10000; // 10 seconds
  private readonly maxRetries = 2;

  /**
   * Send message to all webhook URLs in parallel
   */
  async sendToAll(urls: string[], message: WebhookMessage): Promise<WebhookResult[]> {
    const promises = urls.map((url) => this.send(url, message));
    return Promise.all(promises);
  }

  /**
   * Send message to a single webhook URL with retry logic
   */
  private async send(url: string, message: WebhookMessage): Promise<WebhookResult> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.post(url, message.payload, {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
            'X-InsForge-Event': message.eventName,
            'X-InsForge-Channel': message.channel,
            'X-InsForge-Message-Id': message.messageId,
          },
        });

        return {
          url,
          success: response.status >= 200 && response.status < 300,
          statusCode: response.status,
        };
      } catch (error) {
        const axiosError = error as AxiosError;
        lastError = axiosError.message;

        if (axiosError.response) {
          // Server responded with error status - don't retry
          return {
            url,
            success: false,
            statusCode: axiosError.response.status,
            error: `HTTP ${axiosError.response.status}`,
          };
        }

        // Network error - retry with backoff
        if (attempt < this.maxRetries) {
          await this.delay(1000 * (attempt + 1)); // 1s, 2s
        }
      }
    }
    logger.warn('Webhook delivery failed after retries', { url, error: lastError });

    return {
      url,
      success: false,
      error: lastError,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

```

### Core Architecture Module: `backend/src/services/payments/razorpay/webhook.service.ts`
```
import type { Pool } from 'pg';
import { DatabaseManager } from '@/infra/database/database.manager.js';
import { getBillingSubjectFromProviderAttributes } from '@/services/payments/helpers.js';
import { RazorpayConfigService } from '@/services/payments/razorpay/config.service.js';
import { WebhookStoreService } from '@/services/payments/webhook-store.service.js';
import {
  RazorpayTransactionService,
  type RazorpayTransactionStatus,
} from '@/services/payments/razorpay/transaction.service.js';
import { AppError } from '@/utils/errors.js';
import logger from '@/utils/logger.js';
import type {
  RazorpayInvoice,
  RazorpayPayment,
  RazorpayRefund,
  RazorpaySubscription,
  RazorpayWebhookPayload,
} from '@/providers/payments/razorpay.provider.js';
import type { RazorpayEnvironment } from '@/types/payments.js';
import { ERROR_CODES, type RazorpayWebhookResponse } from '@insforge/shared-schemas';

export type RazorpayWebhookProcessingStatus = 'pending' | 'processed' | 'failed' | 'ignored';

export interface RazorpayWebhookEventRow {
  id: string;
  environment: RazorpayEnvironment;
  eventId: string;
  eventType: string;
  processingStatus: RazorpayWebhookProcessingStatus;
  attemptCount: number;
  lastError: string | null;
  receivedAt: Date | string;
  processedAt: Date | string | null;
}

interface ShouldProcessResult {
  shouldProcess: boolean;
  row: RazorpayWebhookEventRow;
}

interface RazorpayPaymentContext {
  invoice?: RazorpayInvoice | null;
  subscription?: RazorpaySubscription | null;
}

export class RazorpayWebhookService {
  private static instance: RazorpayWebhookService;
  private pool: Pool | null = null;
  private readonly configService = RazorpayConfigService.getInstance();
  private readonly transactionService = RazorpayTransactionService.getInstance();
  private readonly webhookStore = WebhookStoreService.getInstance();

  static getInstance(): RazorpayWebhookService {
    if (!RazorpayWebhookService.instance) {
      RazorpayWebhookService.instance = new RazorpayWebhookService();
    }
    return RazorpayWebhookService.instance;
  }

  private getPool(): Pool {
    if (!this.pool) {
      this.pool = DatabaseManager.getInstance().getPool();
    }
    return this.pool;
  }

  async handleRazorpayWebhook(
    environment: RazorpayEnvironment,
    rawBodyBuffer: Buffer,
    signature: string,
    headerEventId?: string
  ): Promise<RazorpayWebhookResponse> {
    const webhookSecret = await this.configService.getRazorpayWebhookSecret(environment);
    if (!webhookSecret) {
      throw new AppError(
        `Razorpay ${environment} webhook secret is not configured`,
        500,
        ERROR_CODES.INTERNAL_ERROR
      );
    }

    const provider = await this.configService.createRazorpayProvider(environment);
    const isValid = provider.verifyWebhookSignature(rawBodyBuffer, signature, webhookSecret);
    if (!isValid) {
      throw new AppError(
        `Invalid Razorpay webhook signature. Confirm the Razorpay Dashboard webhook secret matches the ${environment} InsForge webhook setup and the webhook URL points to /api/webhooks/razorpay/${environment}.`,
        400,
        ERROR_CODES.INVALID_INPUT
      );
    }

    const payload = this.parseWebhookPayload(rawBodyBuffer.toString('utf8'));
    const eventId = this.getWebhookEventId(payload, headerEventId);
    const eventStart = await this.recordWebhookEventStart(
      environment,
      eventId,
      payload.event,
      payload
    );

    if (!eventStart.shouldProcess) {
      return { received: true, handled: false };
    }

    const handled = await this.processRecordedRazorpayWebhookEvent(environment, eventId, payload);

    return { received: true, handled };
  }

  private async processRecordedRazorpayWebhookEvent(
    environment: RazorpayEnvironment,
    eventId: string,
    payload: RazorpayWebhookPayload
  ): Promise<boolean> {
    if (!this.isHandledEvent(payload.event)) {
      await this.markWebhookEvent(environment, eventId, 'ignored', null);
      return false;
    }

    let handled: boolean;

    try {
      handled = await this.applyRazorpayWebhookEvent(environment, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.markWebhookEvent(environment, eventId, 'failed', message).catch((markError) => {
        logger.error('Failed to mark Razorpay webhook event as failed', {
          environment,
          eventId,
          error: markError instanceof Error ? markError.message : String(markError),
          originalError: message,
        });
      });
      throw error;
    }

    try {
      await this.markWebhookEvent(environment, eventId, handled ? 'processed' : 'ignored', null);
      return handled;
    } catch (error) {
      logger.error('Failed to finalize Razorpay webhook event after processing', {
        environment,
        eventId,
        handled,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Record the start of a webhook event. Returns whether it should be processed
   * (i.e. it's not a duplicate already successfully processed).
   */
  async recordWebhookEventStart(
    environment: RazorpayEnvironment,
    eventId: string,
    eventType: string,
    payload: RazorpayWebhookPayload
  ): Promise<ShouldProcessResult> {
    const result = await this.webhookStore.recordStart({
      provider: 'razorpay',
      environment,
      eventId,
      eventType,
      livemode: environment === 'live',
      payload,
    });

    if (!result.shouldProcess) {
      logger.info('Razorpay webhook event already processed or currently processing; skipping', {
        environment,
        eventId,
        eventType,
      });
    }

    return result;
  }

  async markWebhookEvent(
    environment: RazorpayEnvironment,
    eventId: string,
    status: RazorpayWebhookProcessingStatus,
    error: string | null
  ): Promise<RazorpayWebhookEventRow> {
    return this.webhookStore.mark('razorpay', environment, eventId, status, error);
  }

  private parseWebhookPayload(rawBody: string): RazorpayWebhookPayload {
    try {
      return JSON.parse(rawBody) as RazorpayWebhookPayload;
    } catch {
      throw new AppError('Invalid Razorpay webhook payload', 400, ERROR_CODES.INVALID_INPUT);
    }
  }

  private getWebhookEventId(payload: RazorpayWebhookPayload, headerEventId: string | undefined) {
    if (headerEventId) {
      return headerEventId;
    }

    const entityType = payload.contains?.[0];
    const entityId = this.getPayloadEntityId(payload, entityType);
    return `${payload.account_id}.${payload.event}.${entityId}.${payload.created_at}`;
  }

  private getPayloadEntityId(
    payload: RazorpayWebhookPayload,
    entityType: string | undefined
  ): string {
    if (!entityType) {
      return 'no_entity';
    }

    const entityPayload = payload.payload[entityType];
    if (!this.isRecord(entityPayload)) {
      return 'no_entity';
    }

    const entity = entityPayload.entity;
    if (!this.isRecord(entity) || typeof entity.id !== 'string') {
      return 'no_entity';
    }

    return entity.id;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isHandledEvent(event: string): boolean {
    return HANDLED_RAZORPAY_EVENTS.has(event);
  }

  private async applyRazorpayWebhookEvent(
    environment: RazorpayEnvironment,
    payload: RazorpayWebhookPayload
  ): Promise<boolean> {
    switch (payload.event) {
      case 'payment.authorized':
      case 'payment.captured':
        return this.handlePaymentUpsert(environment, payload, payload.event);
      case 'payment.failed':
        return this.handlePaymentUpsert(environment, payload, payload.event);
      case 'refund.created':
      case 'refund.processed':
      case 'refund.failed':
        return this.handleRefund(environment, payload, payload.event);
      case 'subscription.created':
      case 'subscription.activated':
      case 'subscription.charged':
      case 'subscription.updated':
      case 'subscription.cancelled':
      case 'subscription.paused':
      case 'subscription.resumed':
      case 'subscription.halted':
      case 'subscription.completed':
      case 'subscription.expired':
        return this.handleSubscriptionUpsert(environment, payload);
      case 'invoice.paid':
      case 'invoice.expired':
        return this.handleInvoice(environment, payload, payload.event);
      case 'order.paid':
        return this.handleOrderPaid(environment, payload);
      default:
        return false;
    }
  }

  private async handlePaymentUpsert(
    environment: RazorpayEnvironment,
    payload: RazorpayWebhookPayload,
    event: string,
    context: RazorpayPaymentContext = {}
  ): Promise<boolean> {
    const payment = this.getEntity<RazorpayPayment>(payload, 'payment');
    if (!payment) {
      logger.warn('[Razorpay Webhook] payment event: no payment entity', { event });
      return false;
    }

    const subscription =
      context.subscription ?? this.getEntity<RazorpaySubscription>(payload, 'subscription');
    const invoice = context.invoice ?? this.getEntity<RazorpayInvoice>(payload, 'invoice') ?? null;
    if (subscription && event.startsWith('payment.')) {
      await this.upsertSubscription(environment, subscription);
    }

    const invoiceNotes = invoice ? this.normalizeNotes(invoice.notes) : null;
    const subscriptionNotes = subscription ? this.normalizeNotes(subscription.notes) : null;
    const subjectFallback =
      (invoiceNotes ? getBillingSubjectFromProviderAttributes(invoiceNotes) : null) ??
      (subscriptionNotes ? getBillingSubjectFromProviderAttributes(subscriptionNotes) : null);
    const descriptionFallback =
      invoice?.description ??
      invoice?.line_items?.[0]?.name ??
      invoice?.line_items?.[0]?.description ??
      null;

    const s
```

### Core Architecture Module: `backend/src/services/payments/stripe/webhook.service.ts`
```
import type { Pool } from 'pg';
import { AppError } from '@/utils/errors.js';
import { DatabaseManager } from '@/infra/database/database.manager.js';
import { StripeConfigService } from '@/services/payments/stripe/config.service.js';
import { StripeCheckoutService } from '@/services/payments/stripe/checkout.service.js';
import { PaymentCustomerService } from '@/services/payments/payment-customer.service.js';
import { StripeTransactionService } from '@/services/payments/stripe/transaction.service.js';
import { StripeSubscriptionService } from '@/services/payments/stripe/subscription.service.js';
import { getStripeWebhookSecretName } from '@/services/payments/stripe/constants.js';
import { WebhookStoreService } from '@/services/payments/webhook-store.service.js';
import {
  fromStripeTimestamp,
  getBillingSubjectFromProviderAttributes,
  getStripeObjectId,
} from '@/services/payments/helpers.js';
import { toISOString, toISOStringOrNull } from '@/utils/dates.js';
import logger from '@/utils/logger.js';
import type {
  StripeCharge,
  StripeCheckoutSession,
  StripeEnvironment,
  StripeEvent,
  StripeInvoice,
  StripePaymentIntent,
  StripeRefund,
  StripeSubscription,
  StripeWebhookEventRow,
} from '@/types/payments.js';
import type { StripeProvider } from '@/providers/payments/stripe.provider.js';
import {
  ERROR_CODES,
  type StripeWebhookEvent,
  type StripeWebhookResponse,
} from '@insforge/shared-schemas';

export class StripeWebhookService {
  private static instance: StripeWebhookService;
  private pool: Pool | null = null;
  private readonly configService = StripeConfigService.getInstance();
  private readonly checkoutService = StripeCheckoutService.getInstance();
  private readonly customerService = PaymentCustomerService.getInstance();
  private readonly stripeTransactionService = StripeTransactionService.getInstance();
  private readonly subscriptionService = StripeSubscriptionService.getInstance();
  private readonly webhookStore = WebhookStoreService.getInstance();

  static getInstance(): StripeWebhookService {
    if (!StripeWebhookService.instance) {
      StripeWebhookService.instance = new StripeWebhookService();
    }

    return StripeWebhookService.instance;
  }

  private getPool(): Pool {
    if (!this.pool) {
      this.pool = DatabaseManager.getInstance().getPool();
    }

    return this.pool;
  }

  async handleStripeWebhook(
    environment: StripeEnvironment,
    rawBody: Buffer,
    signature: string
  ): Promise<StripeWebhookResponse> {
    const webhookSecret = await this.configService.getStripeWebhookSecret(environment);
    if (!webhookSecret) {
      throw new AppError(
        `${getStripeWebhookSecretName(environment)} is not configured`,
        500,
        ERROR_CODES.INTERNAL_ERROR
      );
    }

    const provider = await this.configService.createStripeProvider(environment);
    const event = provider.constructWebhookEvent(rawBody, signature, webhookSecret);
    const eventStart = await this.recordWebhookEventStart(environment, event);

    if (!eventStart.shouldProcess) {
      return {
        received: true,
        handled: false,
        event: this.normalizeWebhookEventRow(eventStart.row),
      };
    }

    let handled: boolean;

    try {
      handled = await this.applyStripeWebhookEvent(environment, event, provider);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.markWebhookEvent(environment, event.id, 'failed', message).catch((markError) => {
        logger.error('Failed to mark Stripe webhook event as failed', {
          environment,
          eventId: event.id,
          error: markError instanceof Error ? markError.message : String(markError),
          originalError: message,
        });
      });
      throw error;
    }

    try {
      const row = await this.markWebhookEvent(
        environment,
        event.id,
        handled ? 'processed' : 'ignored',
        null
      );

      return {
        received: true,
        handled,
        event: this.normalizeWebhookEventRow(row),
      };
    } catch (error) {
      logger.error('Failed to finalize Stripe webhook event after processing', {
        environment,
        eventId: event.id,
        handled,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async recordWebhookEventStart(
    environment: StripeEnvironment,
    event: StripeEvent
  ): Promise<{ row: StripeWebhookEventRow; shouldProcess: boolean }> {
    const object = event.data.object as unknown;
    return this.webhookStore.recordStart({
      provider: 'stripe',
      environment,
      eventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
      accountId: typeof event.account === 'string' ? event.account : null,
      objectType: this.getStripeObjectType(object),
      objectId: getStripeObjectId(object),
      payload: event,
    });
  }

  async markWebhookEvent(
    environment: StripeEnvironment,
    eventId: string,
    processingStatus: 'processed' | 'failed' | 'ignored',
    error: string | null
  ): Promise<StripeWebhookEventRow> {
    return this.webhookStore.mark('stripe', environment, eventId, processingStatus, error);
  }

  normalizeWebhookEventRow(row: StripeWebhookEventRow): StripeWebhookEvent {
    return {
      environment: row.environment,
      eventId: row.eventId,
      eventType: row.eventType,
      livemode: row.livemode,
      accountId: row.accountId ?? null,
      objectType: row.objectType ?? null,
      objectId: row.objectId ?? null,
      processingStatus: row.processingStatus,
      attemptCount: Number(row.attemptCount),
      lastError: row.lastError ?? null,
      receivedAt: toISOString(row.receivedAt),
      processedAt: toISOStringOrNull(row.processedAt),
      createdAt: toISOString(row.createdAt),
      updatedAt: toISOString(row.updatedAt),
    };
  }

  private async upsertStripeCustomerMappingFromCheckout(
    environment: StripeEnvironment,
    checkoutSession: StripeCheckoutSession
  ): Promise<boolean> {
    const subject = getBillingSubjectFromProviderAttributes(checkoutSession.metadata);
    const customerId = getStripeObjectId(checkoutSession.customer);
    if (!subject || !customerId) {
      return false;
    }

    await this.getPool().query(
      `INSERT INTO payments.customer_mappings (
         provider,
         environment,
         subject_type,
         subject_id,
         provider_customer_id
       )
       VALUES ('stripe', $1, $2, $3, $4)
       ON CONFLICT (provider, environment, subject_type, subject_id) DO UPDATE SET
         provider_customer_id = EXCLUDED.provider_customer_id,
         updated_at = NOW()`,
      [environment, subject.type, subject.id, customerId]
    );

    return true;
  }

  private async deleteStripeCustomerMappingsByCustomerId(
    environment: StripeEnvironment,
    customerId: string
  ): Promise<boolean> {
    const result = await this.getPool().query(
      `DELETE FROM payments.customer_mappings
       WHERE provider = 'stripe'
         AND environment = $1
         AND provider_customer_id = $2`,
      [environment, customerId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  private async applyStripeWebhookEvent(
    environment: StripeEnvironment,
    event: StripeEvent,
    provider: StripeProvider
  ): Promise<boolean> {
    const eventCreatedAt = fromStripeTimestamp(event.created);

    switch (event.type) {
      case 'customer.created':
      case 'customer.updated':
        return this.customerService.upsertCustomerProjection(
          environment,
          event.data.object as { id: string; deleted?: boolean }
        );
      case 'customer.deleted': {
        const customer = event.data.object as { id?: string; deleted?: boolean };
        if (!customer.id) {
          return false;
        }

        const deletedCustomer = {
          id: customer.id,
          deleted: customer.deleted,
        };

        const [projectionHandled, mappingsDeleted] = await Promise.all([
          this.customerService.upsertCustomerProjection(environment, deletedCustomer),
          this.deleteStripeCustomerMappingsByCustomerId(environment, customer.id),
        ]);

        return projectionHandled || mappingsDeleted;
      }
      case 'checkout.session.completed': {
        const checkoutSession = event.data.object as StripeCheckoutSession;
        const [checkoutRow, mapped, transactionHandled] = await Promise.all([
          this.checkoutService.updateCheckoutSessionFromStripe(
            environment,
            checkoutSession,
            'completed'
          ),
          this.upsertStripeCustomerMappingFromCheckout(environment, checkoutSession),
          this.stripeTransactionService.processCheckoutSessionCompleted(
            environment,
            checkoutSession,
            undefined,
            eventCreatedAt
          ),
        ]);

        return Boolean(checkoutRow) || mapped || transactionHandled;
      }
      case 'checkout.session.async_payment_succeeded': {
        const checkoutSession = event.data.object as StripeCheckoutSession;
        const [checkoutRow, mapped, transactionHandled] = await Promise.all([
          this.checkoutService.updateCheckoutSessionFromStripe(
            environment,
            checkoutSession,
            'completed'
          ),
          this.upsertStripeCustomerMappingFromCheckout(environment, checkoutSession),
          this.stripeTransactionService.processCheckoutSessionCompleted(
            environment,
            checkoutSession,
            'succeeded',
            eventCreatedAt
          ),
        ]);

        return Boolean(checkoutRow) || mapped || transactionHandled;
      }
      case 'checkout.session.async_payment_failed': {
        const checkoutSession = event.data.object as StripeCheckoutSession;
        const checkoutRow = await this.checkoutService.updateCheckoutSessionFromStripe(
        
```

### Core Architecture Module: `backend/src/services/payments/webhook-store.service.ts`
```
import type { Pool } from 'pg';
import { AppError } from '@/utils/errors.js';
import { DatabaseManager } from '@/infra/database/database.manager.js';
import type { PaymentEnvironment, PaymentProvider } from '@/types/payments.js';
import { ERROR_CODES } from '@insforge/shared-schemas';

/**
 * How long a row may sit in `pending` before another delivery of the same event
 * is allowed to reclaim and retry it. Guards against a crashed handler wedging
 * an event as permanently pending.
 */
const WEBHOOK_PENDING_RECLAIM_WINDOW_MS = 5 * 60 * 1000;

export type PaymentWebhookProcessingStatus = 'pending' | 'processed' | 'failed' | 'ignored';

/**
 * A row from `payments.webhook_events`. The table is provider-scoped, so this is
 * the superset of columns both Stripe and Razorpay use; columns a given provider
 * doesn't populate (e.g. Razorpay leaves `accountId`/`objectType`/`objectId`
 * null) come back null.
 */
export interface PaymentWebhookEventRow {
  id: string;
  environment: PaymentEnvironment;
  provider: PaymentProvider;
  eventId: string;
  eventType: string;
  livemode: boolean;
  accountId: string | null;
  objectType: string | null;
  objectId: string | null;
  processingStatus: PaymentWebhookProcessingStatus;
  attemptCount: number;
  lastError: string | null;
  receivedAt: Date | string;
  processedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface RecordWebhookEventInput {
  provider: PaymentProvider;
  environment: PaymentEnvironment;
  eventId: string;
  eventType: string;
  livemode: boolean;
  /** Full provider event/payload, stored verbatim in the `payload` jsonb column. */
  payload: unknown;
  /** Stripe-only; left null for providers that don't record them. */
  accountId?: string | null;
  objectType?: string | null;
  objectId?: string | null;
}

export interface RecordWebhookEventResult {
  row: PaymentWebhookEventRow;
  shouldProcess: boolean;
}

const RETURNING_COLUMNS = `
  id,
  environment,
  provider,
  provider_event_id    AS "eventId",
  event_type           AS "eventType",
  livemode,
  provider_account_id  AS "accountId",
  object_type          AS "objectType",
  object_id            AS "objectId",
  processing_status    AS "processingStatus",
  attempt_count        AS "attemptCount",
  last_error           AS "lastError",
  received_at          AS "receivedAt",
  processed_at         AS "processedAt",
  created_at           AS "createdAt",
  updated_at           AS "updatedAt"`;

/**
 * Shared idempotent store for inbound payment webhook events. Owns the
 * `payments.webhook_events` lifecycle (record-with-idempotency, retry reclaim,
 * status marking) that Stripe and Razorpay previously duplicated. Provider
 * specifics — signature verification, event-id derivation, and event-type
 * dispatch — stay in each provider's webhook service.
 */
export class WebhookStoreService {
  private static instance: WebhookStoreService;
  private pool: Pool | null = null;

  static getInstance(): WebhookStoreService {
    if (!WebhookStoreService.instance) {
      WebhookStoreService.instance = new WebhookStoreService();
    }
    return WebhookStoreService.instance;
  }

  private getPool(): Pool {
    if (!this.pool) {
      this.pool = DatabaseManager.getInstance().getPool();
    }
    return this.pool;
  }

  /**
   * Record the arrival of an event and decide whether it should be processed.
   * Returns `shouldProcess: false` when the event is a duplicate that's already
   * been processed (or is being processed within the reclaim window).
   *
   * Three steps, all keyed on `(provider, environment, provider_event_id)`:
   *   1. INSERT … ON CONFLICT DO NOTHING — wins for a brand-new event.
   *   2. UPDATE … WHERE failed OR stale-pending — reclaims for a retry.
   *   3. SELECT — the event is already terminal/in-flight, so skip it.
   */
  async recordStart(input: RecordWebhookEventInput): Promise<RecordWebhookEventResult> {
    const pool = this.getPool();
    const pendingReclaimCutoff = new Date(Date.now() - WEBHOOK_PENDING_RECLAIM_WINDOW_MS);
    const { provider, environment, eventId, eventType, livemode, payload } = input;
    const accountId = input.accountId ?? null;
    const objectType = input.objectType ?? null;
    const objectId = input.objectId ?? null;

    const insertResult = await pool.query<PaymentWebhookEventRow>(
      `INSERT INTO payments.webhook_events (
         provider,
         environment,
         provider_event_id,
         event_type,
         livemode,
         provider_account_id,
         object_type,
         object_id,
         processing_status,
         attempt_count,
         payload
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 1, $9)
       ON CONFLICT (provider, environment, provider_event_id) DO NOTHING
       RETURNING ${RETURNING_COLUMNS}`,
      [
        provider,
        environment,
        eventId,
        eventType,
        livemode,
        accountId,
        objectType,
        objectId,
        payload,
      ]
    );

    const inserted = insertResult.rows[0];
    if (inserted) {
      return { row: inserted, shouldProcess: true };
    }

    const retryResult = await pool.query<PaymentWebhookEventRow>(
      `UPDATE payments.webhook_events
       SET processing_status = 'pending',
           attempt_count = attempt_count + 1,
           last_error = NULL,
           processed_at = NULL,
           payload = $4,
           updated_at = NOW()
       WHERE provider = $1
         AND environment = $2
         AND provider_event_id = $3
         AND (
           processing_status = 'failed'
           OR (processing_status = 'pending' AND updated_at < $5)
         )
       RETURNING ${RETURNING_COLUMNS}`,
      [provider, environment, eventId, payload, pendingReclaimCutoff]
    );

    const retried = retryResult.rows[0];
    if (retried) {
      return { row: retried, shouldProcess: true };
    }

    const existingResult = await pool.query<PaymentWebhookEventRow>(
      `SELECT ${RETURNING_COLUMNS}
       FROM payments.webhook_events
       WHERE provider = $1
         AND environment = $2
         AND provider_event_id = $3`,
      [provider, environment, eventId]
    );

    const existing = existingResult.rows[0];
    if (!existing) {
      // The conflicting row that blocked the INSERT/reclaim should still be
      // here; if it isn't, it was deleted concurrently and we can't proceed.
      throw new AppError(
        `Webhook event ${provider}/${environment}/${eventId} vanished during recording`,
        500,
        ERROR_CODES.INTERNAL_ERROR
      );
    }

    return { row: existing, shouldProcess: false };
  }

  /** Transition an event to a terminal status, stamping `processed_at` on success. */
  async mark(
    provider: PaymentProvider,
    environment: PaymentEnvironment,
    eventId: string,
    status: PaymentWebhookProcessingStatus,
    error: string | null
  ): Promise<PaymentWebhookEventRow> {
    const result = await this.getPool().query<PaymentWebhookEventRow>(
      `UPDATE payments.webhook_events
       SET processing_status = $4,
           last_error = $5,
           processed_at = CASE WHEN $4 IN ('processed', 'ignored') THEN NOW() ELSE processed_at END,
           updated_at = NOW()
       WHERE provider = $1
         AND environment = $2
         AND provider_event_id = $3
       RETURNING ${RETURNING_COLUMNS}`,
      [provider, environment, eventId, status, error]
    );

    const row = result.rows[0];
    if (!row) {
      // The event is marked only after it was recorded, so the row must exist;
      // a no-op UPDATE means it was deleted out from under us.
      throw new AppError(
        `Webhook event ${provider}/${environment}/${eventId} not found while marking ${status}`,
        500,
        ERROR_CODES.INTERNAL_ERROR
      );
    }

    return row;
  }
}

```

### Core Architecture Module: `backend/src/types/webhooks.ts`
```
// Webhook types for external integrations

// ============================================================================
// Vercel Webhooks
// ============================================================================

/**
 * Vercel webhook event types we handle for deployments
 */
export type VercelDeploymentEventType =
  | 'deployment.created'
  | 'deployment.succeeded'
  | 'deployment.error'
  | 'deployment.canceled';

/**
 * Map Vercel webhook event types to our deployment status
 */
export const VERCEL_EVENT_TO_STATUS: Record<VercelDeploymentEventType, string> = {
  'deployment.created': 'BUILDING',
  'deployment.succeeded': 'READY',
  'deployment.error': 'ERROR',
  'deployment.canceled': 'CANCELED',
};

/**
 * Vercel webhook payload structure for deployment events
 */
export interface VercelWebhookPayload {
  type: string;
  id: string;
  createdAt: string;
  payload: {
    team?: { id: string };
    user?: { id: string };
    deployment: {
      id: string;
      url: string;
      name: string;
      meta?: Record<string, unknown>;
    };
    target?: string;
    project?: { id: string };
  };
}

```

### Core Architecture Module: `backend/src/utils/constants.ts`
```
/** PostgreSQL data types that should preserve empty strings instead of stripping them. */
export const TEXT_LIKE_DATA_TYPES = new Set(['text', 'character varying', 'character', 'citext']);

```

### Core Architecture Module: `backend/src/utils/cookies.ts`
```
import { Response } from 'express';

export const REFRESH_TOKEN_COOKIE_NAME = 'insforge_refresh_token';
export const ADMIN_REFRESH_TOKEN_COOKIE_NAME = 'insforge_admin_refresh_token';

/**
 * Set refresh token cookie on response
 */
export function setRefreshTokenCookie(res: Response, value: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, value, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/**
 * Set admin dashboard refresh token cookie on response
 */
export function setAdminRefreshTokenCookie(res: Response, value: string): void {
  res.cookie(ADMIN_REFRESH_TOKEN_COOKIE_NAME, value, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/api/auth/admin',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/**
 * Clear refresh token cookie on response
 * IMPORTANT: Must use the same options (especially path) as when setting the cookie
 */
export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/api/auth',
  });
}

/**
 * Clear admin dashboard refresh token cookie on response
 * IMPORTANT: Must use the same options (especially path) as when setting the cookie
 */
export function clearAdminRefreshTokenCookie(res: Response): void {
  res.clearCookie(ADMIN_REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/api/auth/admin',
  });
}

```

### Core Architecture Module: `backend/src/utils/dates.ts`
```
export function toISOString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function toISOStringOrNull(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return toISOString(value);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2049** (2026-09-26): **[Bug]: Outage & Permanent Data Loss Window during Container Updates**
  *Symptoms*: ### What's the bug?  Target file: `backend/src/providers/compute/docker.provider.ts`  ### Architectural Flaw DockerProvider.updateMachine() uses a "Destroy-Before-Create" approach. It stops and deletes the running, healthy container before verifying if the replacement container can pull or start.  If the new build or image pull fails, the original container is already destroyed, causing immediate total service downtime with no rollback capability. Relying on MachineGoneError DB cleanup post-failure is reactive and does not prevent the outage.  Availability & Disaster Recovery Impact: If container creation or startup fails during updateMachine() (e.g., corrupt image tag, missing registry credentials, host port collision, or container exit code 1), the original container has ALREADY been deleted. The service drops completely offline without an active container, destroying availability promises.  ### Implemented (current code) ``` const name = (current.Name ?? '').replace(/^\//, '') || params.appId;       await dockerRequest('POST', `/containers/${encodeURIComponent(params.machineId)}/stop`).catch(         () => undefined       );       await dockerRequest(         'DELETE',         `/containers/${encodeURIComponent(params.machineId)}?force=true`       );        const launched = await this.launchMachine({         appId: name,         image: params.image,         port: params.port,         cpu: params.cpu,         memory: params.memory,         envVars: params.envVars,         re
  **Post-Mortem & Fix Analysis**:
  > i would like to work on this issue 
  > Assigned to @prakharsingh-74. Thanks for taking this on. (2 more slots available.)  Your open assigned issues (1/3): - [InsForge#2049](https://github.com/InsForge/InsForge/issues/2049) — Outage & Permanent Data Loss Window during Container Updates
  > hey @Fermionic-Lyu @jwfing and @CarmenDou what do you think about this bug?

- **Issue #2015** (2026-08-29): **[Bug]: Streaming token usage double-counts due to accumulation instead of replacement**
  *Symptoms*: ### What's the bug?  There is a token accounting bug in `**ChatCompletionService.streamChat**`.   According to the OpenAI API streaming spec (and OpenRouter's `include_usage` flag), the `usage` object returned in a streaming chunk represents the **cumulative total tokens consumed so far**, not a delta for that specific chunk.   Currently, the code accumulates these totals using `+=`, which results in severe overcounting if the provider emits multiple usage chunks. For example, if a 100-token request sends 3 usage chunks (10, 50, 100), the system currently logs 160 tokens instead of 100.  The service should replace (`=`) the usage values with the latest chunk's values rather than accumulating (`+=`) them. I have tracked down the exact lines in `**chat-completion.service.ts**` causing this.   ### How to reproduce  1. Run a streaming request (`**streamChat**`) against a provider (like OpenRouter) that is capable of emitting multiple usage chunks. 2. Observe the returned `tokenUsage` in the final SSE stream payloads. 3. The reported total will be a multiple of the actual usage because it adds the cumulative chunks together.   ### Environment (optional)  _No response_
  **Post-Mortem & Fix Analysis**:
  > I'd like to work on this, please assign it to me!
  > Assigned to @sankar-chaitanya2025. Thanks for taking this on. (2 more slots available.)  Your open assigned issues (1/3): - [InsForge#2015](https://github.com/InsForge/InsForge/issues/2015) — Streaming token usage double-counts due to accumulation instead of replacement
  > @hemanthreddykoduru this issue is already assigned to @sankar-chaitanya2025. I won't reassign it automatically.

- **Issue #2005** (2026-08-25): **[Bug]: Users table: row content bleeds through the frozen "User" column on hover when grid is horizontally scrolled**
  *Symptoms*: ### What's the bug?  ## Summary  In the Authentication → Users table (`UsersDataGrid`), when the dashboard window/tab is narrower than the table's full column width (so the grid has to scroll horizontally), hovering over a row makes the ID/Email/Phone column text visually bleed through and overlap the frozen "User" column (checkbox + avatar + name). The two texts render stacked on top of each other, looking like corrupted/overlapping UI.  **Screenshot:**   <img width="2478" height="1636" alt="Image" src="https://github.com/user-attachments/assets/e48c353d-0c9a-414a-badd-4744f774f7f3" />  ## Root cause  The "User" column (`selectionColumnWidth`) is a `frozen: true` column in `react-data-grid`, which pins it via `position: sticky`. Frozen columns rely on having an **opaque** background so that content from the non-frozen columns scrolled underneath is fully hidden behind it.  In `packages/dashboard/src/rdg.css`:  ```css .rdg-cell {   ...   /* no background-color set here */ } ```  Cells get their background via react-data-grid's own base rule `background-color: inherit`, which pulls from `.rdg-row`'s background. Normally that's opaque:  ```css .rdg-row {   background-color: rgb(var(--semantic-0)); } ```  But on hover, `.rdg-row:hover` overrides it with a **translucent** color instead of layering a tint on top of the opaque background:  ```css .rdg-row:hover, .rdg-row[aria-selected='true'], .rdg-row[aria-selected='true']:hover {   background-color: var(--rdg-row-hover-color); /*
  **Post-Mortem & Fix Analysis**:
  > i would like to work on these  
  > Assigned to @vraj00222. Thanks for taking this on. (1 more slot available.)  Your open assigned issues (2/3): - [InsForge#1941](https://github.com/InsForge/InsForge/issues/1941) — Add phone number (SMS) OTP sign-in - [InsForge#2005](https://github.com/InsForge/InsForge/issues/2005) — Users table: row content bleeds through the frozen "User" column on hover when g

- **Issue #1981** (2026-08-25): **[Bug]: `embedding_model` is recorded on insert, never set on update, and never checked on read**
  *Symptoms*: ### What's the bug?  `memory.memories.embedding_model` is written once and then never used. Nothing reads it, and the one path that replaces a stored vector doesn't maintain it. Changing the embedding model is currently not a shippable change: it corrupts recall instead of failing.  Grep across the repo returns exactly two references to the column, the schema default and the insert.  ## Where it stands on `main`  The insert sets it (`memory.service.ts:224-235`):  ``` INSERT INTO memory.memories (scope, kind, title, content, embedding, embedding_model, source) VALUES ($1, $2, $3, $4, $5::vector, $6, $7) ``` with `EMBED_MODEL` bound to `$6`.  The reconcile UPDATE computes a fresh vector and writes it without touching the column (`memory.service.ts:243-246`):  ``` const newEmbedding = await this.embed(`${title}\n${content}`); UPDATE memory.memories    SET kind = $1, title = $2, content = $3, embedding = $4::vector, source = $5 ```  So the moment `EMBED_MODEL` changes, any row that later goes through a reconcile UPDATE ends up holding a new-model vector under the old model's label. At that point the column isn't merely unread, it's wrong, and it's wrong in the one place someone would later look to write a backfill.  The read paths never mention it. `findSimilar` and `recall` compare the query vector against every row in the scope regardless of which model produced it.  ## The column type doesn't cover this  `embedding VECTOR(1536)` catches a change in dimension. It doesn't catch 
  **Post-Mortem & Fix Analysis**:
  > I'd like to work on this
  > Assigned to @ssrajadh. Thanks for taking this on. (1 more slot available.)  Your open assigned issues (2/3): - [InsForge#1929](https://github.com/InsForge/InsForge/issues/1929) — a forget endpoint for agent memory, /api/memory has no way to remove a stored fa - [InsForge#1981](https://github.com/InsForge/InsForge/issues/1981) — `embedding_model` is recorded on insert, never set on update, and never checked 

- **Issue #1944** (2026-08-21): **[Bug]: Fix observability chart x-axis labels for unordered metric data**
  *Symptoms*: ### What's the bug?  Description  The observability metric chart can display incorrect x-axis time labels when metric data is returned in an unordered sequence.  Currently, the chart's end time label can be derived from the last item in the response array rather than the newest valid timestamp. When metric responses are not chronological, this can cause the x-axis labels to mismatch the actual chart data.  Expected Behavior  The chart should derive its time window from the newest finite metric timestamp, regardless of the order in which metric readings are returned.  Proposed Fix  Update the observability chart logic to:  Determine the newest finite metric timestamp from the response data. Use that timestamp when calculating the chart's x-axis time window. Ignore non-finite timestamp values. Testing  Add a regression test covering unordered metric responses and non-finite timestamp values.  ### How to reproduce  _No response_  ### Environment (optional)  _No response_
  **Post-Mortem & Fix Analysis**:
  > Assign this to me
  > Assigned to @Gautam-aman. Thanks for taking this on. You're now at the 3-issue limit.  Your open assigned issues (3/3): - [InsForge#1920](https://github.com/InsForge/InsForge/issues/1920) — the disk chart never renders the newest reading, so the last bar disagrees with  - [InsForge#1881](https://github.com/InsForge/InsForge/issues/1881) — D_TEST feature flag does not update UI when PostHog finishes loading - [InsForge#1944](https://github.com/InsForge/InsForge/issues/1944) — Fix observability chart x-axis labels for unordered metric data
  > unassign me 

- **Issue #1891** (2026-08-14): **[Bug]: AI Quick Start scripts load .env, but the setup step tells you to use .env.local**
  *Symptoms*: ### What's the bug?  Every generated AI Quick Start script begins with a bare `import 'dotenv/config'`, which loads **`.env`**. But step 3 of the same page tells you to put your key somewhere else:  - `AIQuickStartPage.tsx:275`: *"Add your OpenRouter API key to a `.env.local` file."* - `AIQuickStartPage.tsx:279`: a badge rendering the literal string `.env.local`  So a user who follows the Quick Start exactly ends up with `OPENROUTER_API_KEY` in `.env.local`, a script that never reads it, and an authentication failure on the first request, with nothing on the page to indicate why.  This affects **all four modes**. The `import 'dotenv/config'` lines are `constants.ts` 136, 157, 189, and 207, text, image, video, and embeddings alike. It is not specific to any one snippet.  Surfaced during review of #1889, where @greptile-apps and @cubic-dev-ai both flagged it against the new Embeddings snippet. It predates that PR, so it was left out to keep the diff scoped; @coderabbitai and @greptile-apps both suggested a separate issue covering all four modes together.   ### How to reproduce  1. Open **Model Gateway → Quick Start** in the dashboard. 2. Pick any mode (Text, Image, Video, or Embeddings). 3. Follow step 3 as written and put `OPENROUTER_API_KEY` in a `.env.local` file. 4. Copy the generated script and run it. 5. The request fails authentication, `dotenv/config` loaded `.env`, so the key is undefined.  I can open a PR for this once #1147 / #1889 is settled.
  **Post-Mortem & Fix Analysis**:
  > I'd like to work on this.  The fix can go one of two ways:  A: make the scripts read .env.local. Replace the bare import in all four snippets with import { config } from 'dotenv'; config({ path: '.env.local' });. Keeps the existing UI  copy and badge, and .env.local is the conventional choice for local secrets. B: change the guidance to .env. Update step3Description and the .env.local badge in AIQuickStartPage.tsx:275,279 plus all four locale files, leaving the scripts alone. Smaller diff.  A matches what the page already promises; B is less code. Let me know which direction works and I can open a PR.
  > Assigned to @ssrajadh. Thanks for taking this on. (1 more slot available.)  Your open assigned issues (2/3): - [InsForge#1147](https://github.com/InsForge/InsForge/issues/1147) — Embedding Models are not available in AI gateway - [InsForge#1891](https://github.com/InsForge/InsForge/issues/1891) — AI Quick Start scripts load .env, but the setup step tells you to use .env.local
  > Going with A, opening PR shortly

- **Issue #1883** (2026-08-20): **[Bug]: DTest install page does not redirect when onboarding is already complete**
  *Symptoms*: ### What's the bug?  I noticed that DTestInstallPage only redirects when onboarding transitions from incomplete to complete during the current session.  If hasCompletedOnboarding is already true on the initial render (for example, after revisiting or refreshing /dashboard/install), the redirect never occurs because the previous value is initialized to the current state.  Before submitting a fix, I wanted to confirm the intended behavior:  Should users who have already completed onboarding always be redirected away from /dashboard/install, or should they still be able to access the install page?  ### How to reproduce  _No response_  ### Environment (optional)  _No response_
  **Post-Mortem & Fix Analysis**:
  > Your reading of the mechanism is exactly right — `prevOnboarding` is seeded from the current value, so when `hasCompletedOnboarding` is already true on mount the `!prevOnboarding.current && hasCompletedOnboarding` condition never holds and no redirect fires.  On the question you actually asked, though, I think the current behaviour is intended and the redirect should **not** be broadened. Checked against `268d79d`.  The effect documents its own scope, `DTestInstallPage.tsx:26`:  ```ts // Auto-jump back to dashboard once onboarding flips false → true (e.g. an // MCP call lands while the user is mid-install). ```  That is a narrow job: the user is sitting on the install page, their first MCP call lands, and the page gets out of the way. Seeding the ref from the current value is what restricts it to that transition, so it reads as deliberate rather than accidental.  The reason I would not widen it is that `/dashboard/install` is a first-class destination, not just an onboarding step:  - `
  > @Chirag6722 Thanks for the detailed investigation. That makes sense ! .My initial concern was specifically about the initial hasCompletedOnboarding === true case, but I understand now that the current redirect is intentionally scoped to the false → true transition during the install flow.  I’ll close this issue as expected behavior. The ref naming/readability improvement is a good suggestion as well.

- **Issue #1832** (2026-08-03): **[Bug]: Schedule search duplicates function URL check instead of searching cron schedule**
  *Symptoms*: ### What's the bug?  ## Summary  The schedule search currently checks `functionUrl` twice instead of searching another schedule field.  Current implementation:  ```ts s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.functionUrl.toLowerCase().includes(searchQuery.toLowerCase()) || s.functionUrl.toLowerCase().includes(searchQuery.toLowerCase())  ### How to reproduce  _No response_  ### Environment (optional)  _No response_
  **Post-Mortem & Fix Analysis**:
  > Assign me this issue
  > Assigned to @Gautam-aman. Thanks for taking this on. (2 more slots available.)  Your open assigned issues (1/3): - [InsForge#1832](https://github.com/InsForge/InsForge/issues/1832) — Schedule search duplicates function URL check instead of searching cron schedule

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

### Incident Patch 1: `d9df58e0` (2026-10-04)
**Commit Message**: Merge pull request #2062 from InsForge/docs/2026-09-13-fix-mintlify-junwen

2026-09-13 fix mintlify docs

**File**: `docs/es/faq.mdx` (modified, +2/-0)
```diff
@@ -203,6 +203,8 @@ description: "Respuestas sobre llamadas a la base de datos, edge functions, cust
 
     Si solo necesitas la key, por ejemplo para ejecutar la CLI en CI, abre el menú de tu cuenta y ve a **Profile → API Keys**, luego crea una key (ponle una caducidad, o **Never**). Guárdala como secreto de CI y ejecuta `login --user-api-key` con ella. Añade `--json` para una salida legible por máquina.
 
+    El valor que genera el dashboard empieza por `uak_`. Ese prefijo identifica una **user API key** (un token personal que autentica como tu cuenta), distinta de la `ik_` API Key de un proyecto. Por eso, un token que empieza por `uak_` es una user API key que creas aquí, no algo que generas por proyecto.
+
     La key da acceso completo a tu cuenta, así que mantenla en secreto y rótala si se filtra.
   </Accordion>
 
```

**File**: `docs/faq.mdx` (modified, +2/-0)
```diff
@@ -203,6 +203,8 @@ description: "Answers to common InsForge questions on database calls, edge funct
 
     If you only need the key, for example to run the CLI in CI, open your account menu and go to **Profile → API Keys**, then create a key (set an expiry, or **Never**). Store it as a CI secret and run `login --user-api-key` with it. Add `--json` for machine-readable output.
 
+    The value the dashboard generates starts with `uak_`. That prefix marks a **user API key** — a personal token that authenticates as your account — which is different from a project's `ik_` API Key. So a token beginning with `uak_` is a user API key you create here, not something you generate per project.
+
     The key grants full access to your account, so keep it secret and rotate it if it leaks.
   </Accordion>
 
```

**File**: `docs/zh-Hant/faq.mdx` (modified, +2/-0)
```diff
@@ -203,6 +203,8 @@ description: "InsForge 常見問題：解說資料庫呼叫、Edge Function 與
 
     如果你只需要那把 key（例如在 CI 裡跑 CLI），打開帳號選單，進入 **Profile → API Keys**，建立一把 key（設個有效期，或選 **Never**）。把它存成 CI secret，再用它跑 `login --user-api-key`。加上 `--json` 可以得到機器可讀的輸出。
 
+    dashboard 產生的值以 `uak_` 開頭。這個前綴代表它是一把**使用者 API key（user API key）**——也就是以你帳號身分進行驗證的個人權杖，和專案的 `ik_` API Key 不同。所以，凡是以 `uak_` 開頭的權杖，都是你在這裡建立的使用者 API key，而不是按專案產生的 key。
+
     這把 key 擁有你帳號的完整權限，所以要保密，一旦外洩就輪換掉。
   </Accordion>
 
```

**File**: `docs/zh/faq.mdx` (modified, +2/-0)
```diff
@@ -203,6 +203,8 @@ description: "InsForge 常见问题：数据库调用、Edge Function 与 Custom
 
     如果你只需要那把 key（比如在 CI 里跑 CLI），打开账号菜单，进入 **Profile → API Keys**，创建一把 key（设个有效期，或选 **Never**）。把它存成 CI secret，再用它跑 `login --user-api-key`。加上 `--json` 可以得到机器可读的输出。
 
+    dashboard 生成的值以 `uak_` 开头。这个前缀表示它是一把**用户 API key（user API key）**——即以你账号身份进行认证的个人令牌，和项目的 `ik_` API Key 不同。所以，凡是以 `uak_` 开头的令牌，都是你在这里创建的用户 API key，而不是按项目生成的 key。
+
     这把 key 拥有你账号的完整权限，所以要保密，一旦泄露就轮换掉。
   </Accordion>
 
```

---

### Incident Patch 2: `1063e773` (2026-10-01)
**Commit Message**: Merge pull request #2090 from InsForge/fix/prod-image-csv-parse

fix(docker): ship csv-parse and multer in the production image

**File**: `package-lock.json` (modified, +29/-29)
```diff
@@ -209,31 +209,6 @@
         "undici-types": "~6.21.0"
       }
     },
-    "backend/node_modules/csv-parse": {
-      "version": "7.0.2",
-      "resolved": "https://registry.npmjs.org/csv-parse/-/csv-parse-7.0.2.tgz",
-      "integrity": "sha512-uKZghv9UmPkMVLYy//KZ9HFAIJsl7wkhoEdIL0+rhuSY9pZQlhaeGEDPIe+/w7eh81MOql8Q/9+inAGWG6ZHYA==",
-      "license": "MIT"
-    },
-    "backend/node_modules/multer": {
-      "version": "2.3.0",
-      "resolved": "https://registry.npmjs.org/multer/-/multer-2.3.0.tgz",
-      "integrity": "sha512-cjNbm3sttszgZeGfJR124D+jFEfkXCVAsoPBmFn9X7UxmDSFHWqE2CoEj0vrmSpuAFnqWR1Szcm9QTsiHr60Xw==",
-      "license": "MIT",
-      "dependencies": {
-        "append-field": "^1.0.0",
-        "busboy": "^1.6.0",
-        "concat-stream": "^2.0.0",
-        "type-is": "^1.6.18"
-      },
-      "engines": {
-        "node": ">= 10.16.0"
-      },
-      "funding": {
-        "type": "opencollective",
-        "url": "https://opencollective.com/express"
-      }
-    },
     "frontend": {
       "name": "insforge-dashboard",
       "version": "1.0.0",
@@ -9843,10 +9818,9 @@
       "license": "MIT"
     },
     "node_modules/csv-parse": {
-      "version": "6.2.1",
-      "resolved": "https://registry.npmjs.org/csv-parse/-/csv-parse-6.2.1.tgz",
-      "integrity": "sha512-LRLMV+UCyfMokp8Wb411duBf1gaBKJfOfBWU9eHMJ+b+cJYZsNu3AFmjJf3+yPGd59Exz1TsMjaSFyxnYB9+IQ==",
-      "dev": true,
+      "version": "7.0.2",
+      "resolved": "https://registry.npmjs.org/csv-parse/-/csv-parse-7.0.2.tgz",
+      "integrity": "sha512-uKZghv9UmPkMVLYy//KZ9HFAIJsl7wkhoEdIL0+rhuSY9pZQlhaeGEDPIe+/w7eh81MOql8Q/9+inAGWG6ZHYA==",
       "license": "MIT"
     },
     "node_modules/csv-parser": {
@@ -13588,6 +13562,25 @@
       "integrity": "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==",
       "license": "MIT"
     },
+    "node_modules/multer": {
+      "version": "2.3.0",
+      "resolved": "https://registry.npmjs.org/multer/-/multer-2.3.0.tgz",
+      "integrity": "sha512-cjNbm3sttszgZeGfJR124D+jFEfkXCVAsoPBmFn9X7UxmDSFHWqE2CoEj0vrmSpuAFnqWR1Szcm9QTsiHr60Xw==",
+      "license": "MIT",
+      "dependencies": {
+        "append-field": "^1.0.0",
+        "busboy": "^1.6.0",
+        "concat-stream": "^2.0.0",
+        "type-is": "^1.6.18"
+      },
+      "engines": {
+        "node": ">= 10.16.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/express"
+      }
+    },
     "node_modules/mz": {
       "version": "2.7.0",
       "resolved": "https://registry.npmjs.org/mz/-/mz-2.7.0.tgz",
@@ -14270,6 +14263,13 @@
         "pg-copy-streams": "^7.0.0"
       }
     },
+    "node_modules/pg-seed/node_modules/csv-parse": {
+      "version": "6.2.1",
+      "resolved": "https://registry.npmjs.org/csv-parse/-/csv-parse-6.2.1.tgz",
+      "integrity": "sha512-LRLMV+UCyfMokp8Wb411duBf1gaBKJfOfBWU9eHMJ+b+cJYZsNu3AFmjJf3+yPGd59Exz1TsMjaSFyxnYB9+IQ==",
+      "dev": true,
+      "license": "MIT"
+    },
     "node_modules/pg-types": {
       "version": "2.2.0",
       "resolved": "https://registry.npmjs.org/pg-types/-/pg-types-2.2.0.tgz",
```

---

### Incident Patch 3: `fc0e124a` (2026-10-01)
**Commit Message**: fix(deployments): stop the vercel.json drain wait on client disconnect

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `backend/src/services/deployments/deployment.service.ts` (modified, +1/-1)
```diff
@@ -438,7 +438,7 @@ export class DeploymentService {
       });
       if (capturesConfig) {
         // Vercel can answer 409 for a known digest before reading the body, so drain it here.
-        await finished(validatedStream.resume(), { readable: false });
+        await finished(validatedStream.resume(), { readable: false, signal: options.signal });
       }
 
       const configRegions = vercelConfig.content
```

**File**: `backend/tests/unit/deployment-direct-flow.test.ts` (modified, +24/-0)
```diff
@@ -509,6 +509,30 @@ describe('DeploymentService direct deployment flow', () => {
       ]);
     });
 
+    it('stops waiting for an unread vercel.json when the client disconnects', async () => {
+      const content = Buffer.from('{"regions":["sin1"]}');
+      mockPool.query.mockResolvedValueOnce({ rows: [runRow({})] }).mockResolvedValue({
+        rows: [fileRow('vercel.json', content, null)],
+      });
+      mockVercelProvider.uploadFileStream.mockImplementationOnce(
+        async (input: { sha: string }) => input.sha
+      );
+      const disconnect = new AbortController();
+      const neverEnds = new Readable({ read() {} });
+      neverEnds.push(content.subarray(0, 4));
+
+      const upload = DeploymentService.getInstance().uploadDeploymentFileContent(
+        deploymentId,
+        fileId,
+        neverEnds,
+        { signal: disconnect.signal }
+      );
+      disconnect.abort();
+
+      await expect(upload).rejects.toThrow();
+      expect(recordRegionsCall()).toBeUndefined();
+    });
+
     it('records nothing when vercel.json has no usable regions', async () => {
       for (const config of ['{"rewrites":[]}', '{not json', '{"regions":[]}', '{"regions":[1]}']) {
         await uploadFile('vercel.json', Buffer.from(config));
```

---

### Incident Patch 4: `5f3ddbd4` (2026-10-01)
**Commit Message**: fix(deployments): wait for vercel.json validation before reading regions

Vercel can answer 409 for a known digest before reading the request body, so
uploadFileStream may resolve before the validation transform has flushed.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `backend/src/services/deployments/deployment.service.ts` (modified, +17/-10)
```diff
@@ -2,6 +2,7 @@ import { Pool, type PoolClient } from 'pg';
 import AdmZip from 'adm-zip';
 import crypto from 'crypto';
 import { Transform, type Readable, type TransformCallback } from 'stream';
+import { finished } from 'stream/promises';
 import { DatabaseManager } from '@/infra/database/database.manager.js';
 import {
   VercelProvider,
@@ -417,22 +418,28 @@ export class DeploymentService {
         lastFileUploadStartedAt: new Date().toISOString(),
       });
 
+      const capturesConfig = isVercelConfigPath(file.path);
       const vercelConfig: { content: Buffer | null } = { content: null };
+      const validatedStream = this.createValidatedFileStream(
+        content,
+        file.sha,
+        file.size,
+        capturesConfig
+          ? (validated) => {
+              vercelConfig.content = validated;
+            }
+          : undefined
+      );
       await this.vercelProvider.uploadFileStream({
-        content: this.createValidatedFileStream(
-          content,
-          file.sha,
-          file.size,
-          isVercelConfigPath(file.path)
-            ? (validated) => {
-                vercelConfig.content = validated;
-              }
-            : undefined
-        ),
+        content: validatedStream,
         sha: file.sha,
         size: file.size,
         signal: options.signal,
       });
+      if (capturesConfig) {
+        // Vercel can answer 409 for a known digest before reading the body, so drain it here.
+        await finished(validatedStream.resume(), { readable: false });
+      }
 
       const configRegions = vercelConfig.content
         ? parseVercelConfigRegions(vercelConfig.content)
```

**File**: `backend/tests/unit/deployment-direct-flow.test.ts` (modified, +15/-3)
```diff
@@ -429,7 +429,7 @@ describe('DeploymentService direct deployment flow', () => {
       uploadedAt,
     });
 
-    const uploadFile = async (path: string, content: Buffer) => {
+    const uploadFile = async (path: string, content: Buffer, { drain = true } = {}) => {
       mockPool.query.mockImplementation(async (sql: string) => {
         if (sql.includes('FROM deployments.runs')) return { rows: [runRow({})] };
         if (sql.includes('UPDATE deployments.files'))
@@ -439,8 +439,10 @@ describe('DeploymentService direct deployment flow', () => {
       });
       mockVercelProvider.uploadFileStream.mockImplementationOnce(
         async (input: { content: Readable; sha: string }) => {
-          for await (const chunk of input.content) {
-            void chunk;
+          if (drain) {
+            for await (const chunk of input.content) {
+              void chunk;
+            }
           }
           return input.sha;
         }
@@ -497,6 +499,16 @@ describe('DeploymentService direct deployment flow', () => {
       );
     });
 
+    it('records regions when Vercel accepts vercel.json without reading the body', async () => {
+      await uploadFile('vercel.json', Buffer.from('{"regions":["sin1"]}'), { drain: false });
+
+      expect(recordRegionsCall()?.[1]).toEqual([
+        deploymentId,
+        'vercel.json',
+        JSON.stringify(['sin1']),
+      ]);
+    });
+
     it('records nothing when vercel.json has no usable regions', async () => {
       for (const config of ['{"rewrites":[]}', '{not json', '{"regions":[]}', '{"regions":[1]}']) {
         await uploadFile('vercel.json', Buffer.from(config));
```

---

### Incident Patch 5: `59c92038` (2026-10-01)
**Commit Message**: fix(deployments): record regions before marking vercel.json uploaded

Resolve regions at the call sites, drop the unused createDeployment and
metadata.regions plumbing, word the docs around the project's default
region, and cover the legacy zip path and parser guards in tests.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.agents/docs/deployment.md` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ Important:
 - `sourceDirectory` must be an absolute path.
 - Upload app source files, not only `dist`, unless the project is intentionally a plain static site.
 - Include framework files needed by Vercel, such as `package.json`, lock file, framework config, and `vercel.json` when needed.
-- Server functions run in Vercel's `iad1` (Washington, D.C.) by default. To run them elsewhere, set `regions` in `vercel.json` at the app root, for example `{ "regions": ["sin1"] }`, or pass `regions` to `POST /api/deployments/:id/start`, which takes precedence.
+- Server functions run in the Vercel project's default region, usually `iad1` (Washington, D.C.). To run them elsewhere, set `regions` in `vercel.json` at the app root, for example `{ "regions": ["sin1"] }`.
 - Prefix browser-exposed variables correctly, for example `VITE_` for Vite and `NEXT_PUBLIC_` for Next.js.
 - Do not put service-role keys, admin tokens, or private provider keys in browser-exposed variables.
 - Tailwind projects should stay on Tailwind CSS 3.4 unless the app already supports v4.
```

**File**: `backend/src/providers/deployments/vercel.provider.ts` (modified, +0/-4)
```diff
@@ -43,7 +43,6 @@ export interface VercelDeploymentResult {
   readyState: string;
   name: string;
   createdAt: Date;
-  regions?: string[];
   error?: {
     code: string;
     message: string;
@@ -408,7 +407,6 @@ export class VercelProvider {
               files: options.files,
               projectSettings: options.projectSettings,
               meta: options.meta,
-              regions: options.regions,
             },
             { headers: { Authorization: `Bearer ${credentials.token}` } }
           ),
@@ -430,7 +428,6 @@ export class VercelProvider {
         readyState: deployment.readyState,
         name: deployment.name,
         createdAt: new Date(deployment.createdAt),
-        regions: deployment.regions,
       };
     } catch (error) {
       if (error instanceof AppError) {
@@ -1266,7 +1263,6 @@ export class VercelProvider {
         readyState: deployment.readyState,
         name: deployment.name,
         createdAt: new Date(deployment.createdAt),
-        regions: deployment.regions,
       };
     } catch (error) {
       logger.error('Failed to create Vercel deployment with files', {
```

**File**: `backend/src/services/deployments/deployment.service.ts` (modified, +25/-48)
```diff
@@ -58,23 +58,23 @@ const getVercelConfigPath = (rootDirectory?: string | null) => {
   return root === '' || root === '.' ? VERCEL_CONFIG_FILE : `${root}/${VERCEL_CONFIG_FILE}`;
 };
 
-const parseVercelConfigRegions = (content: Buffer): string[] | null => {
+const parseVercelConfigRegions = (content: Buffer): string[] | undefined => {
   let config: unknown;
   try {
     config = JSON.parse(content.toString('utf8'));
   } catch {
-    return null;
+    return undefined;
   }
   if (typeof config !== 'object' || config === null || !('regions' in config)) {
-    return null;
+    return undefined;
   }
   const { regions } = config;
   if (
     !Array.isArray(regions) ||
     regions.length === 0 ||
     !regions.every((region): region is string => typeof region === 'string')
   ) {
-    return null;
+    return undefined;
   }
   return regions;
 };
@@ -434,6 +434,13 @@ export class DeploymentService {
         signal: options.signal,
       });
 
+      const configRegions = vercelConfig.content
+        ? parseVercelConfigRegions(vercelConfig.content)
+        : undefined;
+      if (configRegions) {
+        await this.recordVercelConfigRegions(id, file.path, configRegions);
+      }
+
       const updateResult = await this.getPool().query<DeploymentFileRow>(
         `UPDATE deployments.files
          SET uploaded_at = NOW()
@@ -457,13 +464,6 @@ export class DeploymentService {
         );
       }
 
-      const configRegions = vercelConfig.content
-        ? parseVercelConfigRegions(vercelConfig.content)
-        : null;
-      if (configRegions) {
-        await this.recordVercelConfigRegions(id, uploadedFile.path, configRegions);
-      }
-
       await this.updateDeploymentStatus(id, DeploymentStatus.UPLOADING, {
         lastFileUploadedAt: new Date().toISOString(),
       });
@@ -522,12 +522,12 @@ export class DeploymentService {
       const uploadMode = this.getUploadMode(deployment, files.length);
 
       if (uploadMode === 'direct') {
-        return await this.startDirectDeployment(
-          id,
-          input,
-          files,
-          this.getRecordedVercelConfigRegions(deployment, input)
-        );
+        const recorded = deployment.metadata?.vercelConfigRegions as
+          | Record<string, string[]>
+          | undefined;
+        const regions =
+          input.regions ?? recorded?.[getVercelConfigPath(input.projectSettings?.rootDirectory)];
+        return await this.startDirectDeployment(id, { ...input, regions }, files);
       }
 
       return await this.startLegacyDeployment(id, input);
@@ -559,25 +559,10 @@ export class DeploymentService {
     return registeredFileCount > 0 ? 'direct' : 'legacy';
   }
 
-  private getRecordedVercelConfigRegions(
-    deployment: DeploymentRecord,
-    input: StartDeploymentRequest
-  ): string[] | null {
-    const recorded = deployment.metadata?.vercelConfigRegions;
-    if (typeof recorded !== 'object' || recorded === null) {
-      return null;
-    }
-    const regions = (recorded as Record<string, unknown>)[
-      getVercelConfigPath(input.projectSettings?.rootDirectory)
-    ];
-    return Array.isArray(regions) ? (regions as string[]) : null;
-  }
-
   private async startDirectDeployment(
     id: string,
     input: StartDeploymentRequest,
-    files: DeploymentFileRow[],
-    configRegions: string[] | null
+    files: DeploymentFileRow[]
   ): Promise<DeploymentRecord> {
     if (files.length === 0) {
       throw new AppError(
@@ -608,13 +593,7 @@ export class DeploymentService {
       size: file.size,
     }));
 
-    return await this.createVercelDeploymentFromUploadedFiles(
-      id,
-      input,
-      uploadedFiles,
-      'direct',
-      configRegions
-    );
+    return await this.createVercelDeploymentFromUploadedFiles(id, input, uploadedFiles, 'direct');
   }
 
   private async startLegacyDeployment(
@@ -668,15 +647,15 @@ export class DeploymentService {
 
     const configPath = getVercelConfigPath(input.projectSettings?.rootDirectory);
     const configFile = files.find((file) => file.path === configPath);
-    const configRegions = configFile ? parseVercelConfigRegions(configFile.content) : null;
+    const regions =
+      input.regions ?? (configFile ? parseVercelConfigRegions(configFile.content) : undefined);
 
     const uploadedFiles = await this.vercelProvider.uploadFiles(files);
     const deployment = await this.createVercelDeploymentFromUploadedFiles(
       id,
-      input,
+      { ...input, regions },
       uploadedFiles,
-      'legacy',
-      configRegions
+      'legacy'
     );
 
     await this.s3Provider.deleteObject(DEPLOYMENT_BUCKET, getDeploymentKey(id)).catch((error) => {
@@ -721,16 +700,15 @@ export class DeploymentService {
     id: string,
     input: StartDeploymentRequest,
     uploadedFiles: Array<{ file: string; sha: string; size: number }>,
-    uploadMode: 'direct' | 'legacy',
-    configRegions: string[] | null
+    uploadMode: 'direct' | 'legacy'
   ): Promise<Deplo
```

**File**: `backend/tests/unit/deployment-direct-flow.test.ts` (modified, +65/-25)
```diff
@@ -1,4 +1,5 @@
 import { describe, it, expect, vi, beforeEach } from 'vitest';
+import AdmZip from 'adm-zip';
 import { createHash } from 'crypto';
 import { Readable } from 'stream';
 
@@ -14,6 +15,7 @@ const { mockPool, mockClient, mockVercelProvider, mockIsCloudEnvironment } = vi.
   mockVercelProvider: {
     isConfigured: vi.fn(() => true),
     uploadFileStream: vi.fn(),
+    uploadFiles: vi.fn(),
     createDeploymentWithFiles: vi.fn(),
     getEnvironmentVariableKeys: vi.fn(),
     listCustomDomains: vi.fn(),
@@ -46,7 +48,7 @@ vi.mock('../../src/providers/storage/s3.provider.js', () => ({
 
 import { DeploymentService } from '../../src/services/deployments/deployment.service';
 import { DeploymentStatus } from '../../src/types/deployments';
-import { ERROR_CODES } from '@insforge/shared-schemas';
+import { ERROR_CODES, type StartDeploymentRequest } from '@insforge/shared-schemas';
 
 describe('DeploymentService direct deployment flow', () => {
   beforeEach(() => {
@@ -428,12 +430,13 @@ describe('DeploymentService direct deployment flow', () => {
     });
 
     const uploadFile = async (path: string, content: Buffer) => {
-      mockPool.query
-        .mockResolvedValueOnce({ rows: [runRow({})] })
-        .mockResolvedValueOnce({ rows: [fileRow(path, content, null)] })
-        .mockResolvedValueOnce({ rows: [] })
-        .mockResolvedValueOnce({ rows: [fileRow(path, content, new Date())] })
-        .mockResolvedValue({ rows: [] });
+      mockPool.query.mockImplementation(async (sql: string) => {
+        if (sql.includes('FROM deployments.runs')) return { rows: [runRow({})] };
+        if (sql.includes('UPDATE deployments.files'))
+          return { rows: [fileRow(path, content, new Date())] };
+        if (sql.includes('FROM deployments.files')) return { rows: [fileRow(path, content, null)] };
+        return { rows: [] };
+      });
       mockVercelProvider.uploadFileStream.mockImplementationOnce(
         async (input: { content: Readable; sha: string }) => {
           for await (const chunk of input.content) {
@@ -449,58 +452,70 @@ describe('DeploymentService direct deployment flow', () => {
       );
     };
 
-    const recordRegionsCall = () =>
-      mockPool.query.mock.calls.find((call) => String(call[0]).includes('vercelConfigRegions'));
+    const queryIndex = (fragment: string) =>
+      mockPool.query.mock.calls.findIndex((call) => String(call[0]).includes(fragment));
 
-    const startWithRecorded = async (
-      vercelConfigRegions: Record<string, string[]>,
-      input: Parameters<DeploymentService['startDeployment']>[1] = {}
-    ) => {
-      const content = Buffer.from('x');
-      mockPool.query
-        .mockResolvedValueOnce({ rows: [runRow({ vercelConfigRegions })] })
-        .mockResolvedValueOnce({ rows: [fileRow('index.html', content, new Date())] })
-        .mockResolvedValueOnce({ rows: [] })
-        .mockResolvedValueOnce({ rows: [runRow({})] });
+    const recordRegionsCall = () => mockPool.query.mock.calls[queryIndex('vercelConfigRegions')];
+
+    const mockVercelCreate = () => {
       mockVercelProvider.createDeploymentWithFiles.mockResolvedValueOnce({
         id: 'dpl_1',
         url: null,
         state: 'BUILDING',
         readyState: 'BUILDING',
         name: 'deployment',
         createdAt: new Date(),
-        regions: ['sin1'],
       });
       mockVercelProvider.getEnvironmentVariableKeys.mockResolvedValueOnce([]);
+    };
+
+    const startWithRecorded = async (
+      vercelConfigRegions: Record<string, string[]>,
+      input: StartDeploymentRequest = {}
+    ) => {
+      const content = Buffer.from('x');
+      mockPool.query
+        .mockResolvedValueOnce({ rows: [runRow({ vercelConfigRegions })] })
+        .mockResolvedValueOnce({ rows: [fileRow('index.html', content, new Date())] })
+        .mockResolvedValueOnce({ rows: [] })
+        .mockResolvedValueOnce({ rows: [runRow({})] });
+      mockVercelCreate();
       await DeploymentService.getInstance().startDeployment(deploymentId, input);
       return mockVercelProvider.createDeploymentWithFiles.mock.calls[0][1];
     };
 
-    it('records regions from an uploaded vercel.json by path', async () => {
+    it('records regions from an uploaded vercel.json by path before marking it uploaded', async () => {
       await uploadFile('apps/web/vercel.json', Buffer.from('{"regions":["sin1","bom1"]}'));
 
       expect(recordRegionsCall()?.[1]).toEqual([
         deploymentId,
         'apps/web/vercel.json',
         JSON.stringify(['sin1', 'bom1']),
       ]);
+      expect(queryIndex('vercelConfigRegions')).toBeLessThan(
+        queryIndex('UPDATE deployments.files')
+      );
     });
 
     it('records nothing when vercel.json has no usable regions', async () => {
-      await uploadFile('vercel.json', Buffer.from('{"rewrites":[]}'));
-      await uploadFile('vercel.json', Buffer.from('{not json'));
+      for (const config of ['{"rewrites":[]}', '{not json', '{"regions":[]}'
```

**File**: `docs/core-concepts/sites/overview.mdx` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ Deploy React, Vue, Svelte, Next.js, static sites, and other frontend projects. I
 
 ### Function regions
 
-Server-side code such as Next.js API routes and server-rendered pages runs in Vercel's `iad1` region (Washington, D.C.) unless you choose otherwise. Put your functions near your users or your database by listing region IDs in `vercel.json`:
+Server-side code such as Next.js API routes and server-rendered pages runs in the Vercel project's default region, which is `iad1` (Washington, D.C.) unless it has been changed. Put your functions near your users or your database by listing region IDs in `vercel.json`:
 
 ```json
 {
```

---

### Incident Patch 6: `89a0dfd7` (2026-10-01)
**Commit Message**: fix(deployments): honor function regions for API deployments

Vercel only places functions in the regions sent with the create-deployment
request; vercel.json `regions` is ignored for API deployments, so every site
ran in the provider project's default region (iad1).

- Add optional `regions` to the start-deployment request.
- Fall back to `regions` from the uploaded vercel.json (respecting
  projectSettings.rootDirectory) for both direct and legacy uploads.
- Record the regions Vercel assigned in the run metadata.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.agents/docs/deployment.md` (modified, +1/-0)
```diff
@@ -53,6 +53,7 @@ Important:
 - `sourceDirectory` must be an absolute path.
 - Upload app source files, not only `dist`, unless the project is intentionally a plain static site.
 - Include framework files needed by Vercel, such as `package.json`, lock file, framework config, and `vercel.json` when needed.
+- Server functions run in Vercel's `iad1` (Washington, D.C.) by default. To run them elsewhere, set `regions` in `vercel.json` at the app root, for example `{ "regions": ["sin1"] }`, or pass `regions` to `POST /api/deployments/:id/start`, which takes precedence.
 - Prefix browser-exposed variables correctly, for example `VITE_` for Vite and `NEXT_PUBLIC_` for Next.js.
 - Do not put service-role keys, admin tokens, or private provider keys in browser-exposed variables.
 - Tailwind projects should stay on Tailwind CSS 3.4 unless the app already supports v4.
```

**File**: `backend/src/providers/deployments/vercel.provider.ts` (modified, +6/-0)
```diff
@@ -43,6 +43,7 @@ export interface VercelDeploymentResult {
   readyState: string;
   name: string;
   createdAt: Date;
+  regions?: string[];
   error?: {
     code: string;
     message: string;
@@ -64,6 +65,7 @@ export interface CreateDeploymentOptions {
     rootDirectory?: string | null;
   };
   meta?: Record<string, string>;
+  regions?: string[];
 }
 
 export interface DeploymentFile {
@@ -406,6 +408,7 @@ export class VercelProvider {
               files: options.files,
               projectSettings: options.projectSettings,
               meta: options.meta,
+              regions: options.regions,
             },
             { headers: { Authorization: `Bearer ${credentials.token}` } }
           ),
@@ -427,6 +430,7 @@ export class VercelProvider {
         readyState: deployment.readyState,
         name: deployment.name,
         createdAt: new Date(deployment.createdAt),
+        regions: deployment.regions,
       };
     } catch (error) {
       if (error instanceof AppError) {
@@ -1241,6 +1245,7 @@ export class VercelProvider {
           files: files,
           projectSettings: options.projectSettings,
           meta: options.meta,
+          regions: options.regions,
         },
         { headers: { Authorization: `Bearer ${credentials.token}` } }
       );
@@ -1261,6 +1266,7 @@ export class VercelProvider {
         readyState: deployment.readyState,
         name: deployment.name,
         createdAt: new Date(deployment.createdAt),
+        regions: deployment.regions,
       };
     } catch (error) {
       logger.error('Failed to create Vercel deployment with files', {
```

**File**: `backend/src/services/deployments/deployment.service.ts` (modified, +118/-9)
```diff
@@ -48,6 +48,37 @@ export type {
 const DEPLOYMENT_BUCKET = '_deployments';
 const getDeploymentKey = (id: string) => `${id}.zip`;
 
+const VERCEL_CONFIG_FILE = 'vercel.json';
+
+const isVercelConfigPath = (filePath: string) =>
+  filePath === VERCEL_CONFIG_FILE || filePath.endsWith(`/${VERCEL_CONFIG_FILE}`);
+
+const getVercelConfigPath = (rootDirectory?: string | null) => {
+  const root = (rootDirectory ?? '').replace(/^(\.\/)+/, '').replace(/\/+$/, '');
+  return root === '' || root === '.' ? VERCEL_CONFIG_FILE : `${root}/${VERCEL_CONFIG_FILE}`;
+};
+
+const parseVercelConfigRegions = (content: Buffer): string[] | null => {
+  let config: unknown;
+  try {
+    config = JSON.parse(content.toString('utf8'));
+  } catch {
+    return null;
+  }
+  if (typeof config !== 'object' || config === null || !('regions' in config)) {
+    return null;
+  }
+  const { regions } = config;
+  if (
+    !Array.isArray(regions) ||
+    regions.length === 0 ||
+    !regions.every((region): region is string => typeof region === 'string')
+  ) {
+    return null;
+  }
+  return regions;
+};
+
 interface DeploymentFileRow {
   fileId: string;
   deploymentId: string;
@@ -386,8 +417,18 @@ export class DeploymentService {
         lastFileUploadStartedAt: new Date().toISOString(),
       });
 
+      const vercelConfig: { content: Buffer | null } = { content: null };
       await this.vercelProvider.uploadFileStream({
-        content: this.createValidatedFileStream(content, file.sha, file.size),
+        content: this.createValidatedFileStream(
+          content,
+          file.sha,
+          file.size,
+          isVercelConfigPath(file.path)
+            ? (validated) => {
+                vercelConfig.content = validated;
+              }
+            : undefined
+        ),
         sha: file.sha,
         size: file.size,
         signal: options.signal,
@@ -416,6 +457,13 @@ export class DeploymentService {
         );
       }
 
+      const configRegions = vercelConfig.content
+        ? parseVercelConfigRegions(vercelConfig.content)
+        : null;
+      if (configRegions) {
+        await this.recordVercelConfigRegions(id, uploadedFile.path, configRegions);
+      }
+
       await this.updateDeploymentStatus(id, DeploymentStatus.UPLOADING, {
         lastFileUploadedAt: new Date().toISOString(),
       });
@@ -474,7 +522,12 @@ export class DeploymentService {
       const uploadMode = this.getUploadMode(deployment, files.length);
 
       if (uploadMode === 'direct') {
-        return await this.startDirectDeployment(id, input, files);
+        return await this.startDirectDeployment(
+          id,
+          input,
+          files,
+          this.getRecordedVercelConfigRegions(deployment, input)
+        );
       }
 
       return await this.startLegacyDeployment(id, input);
@@ -506,10 +559,25 @@ export class DeploymentService {
     return registeredFileCount > 0 ? 'direct' : 'legacy';
   }
 
+  private getRecordedVercelConfigRegions(
+    deployment: DeploymentRecord,
+    input: StartDeploymentRequest
+  ): string[] | null {
+    const recorded = deployment.metadata?.vercelConfigRegions;
+    if (typeof recorded !== 'object' || recorded === null) {
+      return null;
+    }
+    const regions = (recorded as Record<string, unknown>)[
+      getVercelConfigPath(input.projectSettings?.rootDirectory)
+    ];
+    return Array.isArray(regions) ? (regions as string[]) : null;
+  }
+
   private async startDirectDeployment(
     id: string,
     input: StartDeploymentRequest,
-    files: DeploymentFileRow[]
+    files: DeploymentFileRow[],
+    configRegions: string[] | null
   ): Promise<DeploymentRecord> {
     if (files.length === 0) {
       throw new AppError(
@@ -540,7 +608,13 @@ export class DeploymentService {
       size: file.size,
     }));
 
-    return await this.createVercelDeploymentFromUploadedFiles(id, input, uploadedFiles, 'direct');
+    return await this.createVercelDeploymentFromUploadedFiles(
+      id,
+      input,
+      uploadedFiles,
+      'direct',
+      configRegions
+    );
   }
 
   private async startLegacyDeployment(
@@ -592,12 +666,17 @@ export class DeploymentService {
       await this.vercelProvider.upsertEnvironmentVariables(input.envVars);
     }
 
+    const configPath = getVercelConfigPath(input.projectSettings?.rootDirectory);
+    const configFile = files.find((file) => file.path === configPath);
+    const configRegions = configFile ? parseVercelConfigRegions(configFile.content) : null;
+
     const uploadedFiles = await this.vercelProvider.uploadFiles(files);
     const deployment = await this.createVercelDeploymentFromUploadedFiles(
       id,
       input,
       uploadedFiles,
-      'legacy'
+      'legacy',
+      configRegions
     );
 
     await this.s3Provider.deleteObject(DEPLOYMENT_BUCKET, getDeploymentKey(id)).catch((error) => {
@@ -642,13 +721,16 @@ export class DeploymentService {
     id: string,
     input: StartDeploymentRequest,
     uploadedFil
```

**File**: `backend/tests/unit/deployment-direct-flow.test.ts` (modified, +126/-0)
```diff
@@ -14,6 +14,8 @@ const { mockPool, mockClient, mockVercelProvider, mockIsCloudEnvironment } = vi.
   mockVercelProvider: {
     isConfigured: vi.fn(() => true),
     uploadFileStream: vi.fn(),
+    createDeploymentWithFiles: vi.fn(),
+    getEnvironmentVariableKeys: vi.fn(),
     listCustomDomains: vi.fn(),
     getCustomDomainConfig: vi.fn(),
   },
@@ -400,4 +402,128 @@ describe('DeploymentService direct deployment flow', () => {
       code: 'INVALID_INPUT',
     });
   });
+
+  describe('function regions', () => {
+    const deploymentId = '11111111-1111-4111-8111-111111111111';
+    const fileId = '22222222-2222-4222-8222-222222222222';
+
+    const runRow = (metadata: Record<string, unknown>) => ({
+      id: deploymentId,
+      providerDeploymentId: null,
+      provider: 'vercel',
+      status: DeploymentStatus.UPLOADING,
+      url: null,
+      metadata: { uploadMode: 'direct', ...metadata },
+      createdAt: new Date(),
+      updatedAt: new Date(),
+    });
+
+    const fileRow = (path: string, content: Buffer, uploadedAt: Date | null) => ({
+      fileId,
+      deploymentId,
+      path,
+      sha: createHash('sha1').update(content).digest('hex'),
+      size: content.length,
+      uploadedAt,
+    });
+
+    const uploadFile = async (path: string, content: Buffer) => {
+      mockPool.query
+        .mockResolvedValueOnce({ rows: [runRow({})] })
+        .mockResolvedValueOnce({ rows: [fileRow(path, content, null)] })
+        .mockResolvedValueOnce({ rows: [] })
+        .mockResolvedValueOnce({ rows: [fileRow(path, content, new Date())] })
+        .mockResolvedValue({ rows: [] });
+      mockVercelProvider.uploadFileStream.mockImplementationOnce(
+        async (input: { content: Readable; sha: string }) => {
+          for await (const chunk of input.content) {
+            void chunk;
+          }
+          return input.sha;
+        }
+      );
+      await DeploymentService.getInstance().uploadDeploymentFileContent(
+        deploymentId,
+        fileId,
+        Readable.from([content])
+      );
+    };
+
+    const recordRegionsCall = () =>
+      mockPool.query.mock.calls.find((call) => String(call[0]).includes('vercelConfigRegions'));
+
+    const startWithRecorded = async (
+      vercelConfigRegions: Record<string, string[]>,
+      input: Parameters<DeploymentService['startDeployment']>[1] = {}
+    ) => {
+      const content = Buffer.from('x');
+      mockPool.query
+        .mockResolvedValueOnce({ rows: [runRow({ vercelConfigRegions })] })
+        .mockResolvedValueOnce({ rows: [fileRow('index.html', content, new Date())] })
+        .mockResolvedValueOnce({ rows: [] })
+        .mockResolvedValueOnce({ rows: [runRow({})] });
+      mockVercelProvider.createDeploymentWithFiles.mockResolvedValueOnce({
+        id: 'dpl_1',
+        url: null,
+        state: 'BUILDING',
+        readyState: 'BUILDING',
+        name: 'deployment',
+        createdAt: new Date(),
+        regions: ['sin1'],
+      });
+      mockVercelProvider.getEnvironmentVariableKeys.mockResolvedValueOnce([]);
+      await DeploymentService.getInstance().startDeployment(deploymentId, input);
+      return mockVercelProvider.createDeploymentWithFiles.mock.calls[0][1];
+    };
+
+    it('records regions from an uploaded vercel.json by path', async () => {
+      await uploadFile('apps/web/vercel.json', Buffer.from('{"regions":["sin1","bom1"]}'));
+
+      expect(recordRegionsCall()?.[1]).toEqual([
+        deploymentId,
+        'apps/web/vercel.json',
+        JSON.stringify(['sin1', 'bom1']),
+      ]);
+    });
+
+    it('records nothing when vercel.json has no usable regions', async () => {
+      await uploadFile('vercel.json', Buffer.from('{"rewrites":[]}'));
+      await uploadFile('vercel.json', Buffer.from('{not json'));
+
+      expect(recordRegionsCall()).toBeUndefined();
+    });
+
+    it('does not inspect files other than vercel.json', async () => {
+      await uploadFile('src/vercel.json.bak', Buffer.from('{"regions":["sin1"]}'));
+
+      expect(recordRegionsCall()).toBeUndefined();
+    });
+
+    it('forwards the root vercel.json regions when starting', async () => {
+      const options = await startWithRecorded({ 'vercel.json': ['sin1'] });
+
+      expect(options).toMatchObject({ regions: ['sin1'] });
+    });
+
+    it('uses the vercel.json inside projectSettings.rootDirectory', async () => {
+      const options = await startWithRecorded(
+        { 'vercel.json': ['iad1'], 'apps/web/vercel.json': ['sin1'] },
+        { projectSettings: { rootDirectory: './apps/web/' } }
+      );
+
+      expect(options).toMatchObject({ regions: ['sin1'] });
+    });
+
+    it('prefers explicit regions over vercel.json', async () => {
+      const options = await startWithRecorded({ 'vercel.json': ['sin1'] }, { regions: ['fra1'] });
+
+      expect(options).toMatchObject({ regions: ['fra1'] });
+    });
+
+    it('leaves regions to the project default when none are set', async () => {
+      
```

**File**: `docs/core-concepts/sites/overview.mdx` (modified, +12/-0)
```diff
@@ -58,6 +58,18 @@ npx @insforge/cli deployments deploy ./frontend
 
 Deploy React, Vue, Svelte, Next.js, static sites, and other frontend projects. InsForge sends the source files to Vercel, where framework detection and project files such as `package.json` and `vercel.json` decide how the app builds.
 
+### Function regions
+
+Server-side code such as Next.js API routes and server-rendered pages runs in Vercel's `iad1` region (Washington, D.C.) unless you choose otherwise. Put your functions near your users or your database by listing region IDs in `vercel.json`:
+
+```json
+{
+  "regions": ["sin1"]
+}
+```
+
+The setting only moves server-side code; static assets are always served from Vercel's global CDN. See [Vercel's region list](https://vercel.com/docs/regions#region-list) for the available IDs.
+
 ### Environment variables
 
 Manage provider environment variables from the dashboard. Use public prefixes such as `VITE_` or `NEXT_PUBLIC_` only for values that are safe to expose in browser code.
```

**File**: `openapi/deployments.yaml` (modified, +8/-0)
```diff
@@ -868,6 +868,14 @@ components:
           type: object
           additionalProperties:
             type: string
+        regions:
+          type: array
+          minItems: 1
+          description: Vercel region IDs the deployment's functions run in. Overrides `regions` in the uploaded `vercel.json`; when both are absent, the provider project's default region is used.
+          items:
+            type: string
+            pattern: '^[a-z]{3}\d$'
+            example: sin1
 
     DeploymentMetadata:
       type: object
```

**File**: `packages/shared-schemas/src/deployments-api.schema.ts` (modified, +8/-0)
```diff
@@ -100,6 +100,14 @@ export const startDeploymentRequestSchema = z.object({
   projectSettings: projectSettingsSchema.optional(),
   envVars: z.array(envVarSchema).optional(),
   meta: z.record(z.string()).optional(),
+  /**
+   * Vercel region IDs (for example `sin1`) the deployment's functions run in.
+   * Takes precedence over `regions` in the uploaded `vercel.json`.
+   */
+  regions: z
+    .array(z.string().regex(/^[a-z]{3}\d$/, 'region must be a Vercel region ID such as sin1'))
+    .min(1)
+    .optional(),
 });
 
 /**
```

---

### Incident Patch 7: `5cc66c0e` (2026-10-01)
**Commit Message**: fix(docker): keep the fix to the lockfile move

Drop the build-time dependency guard, the lib-storage devDependency move and
the @types/multer hoist; hoisting csv-parse and multer is what makes the
runner start.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `Dockerfile` (modified, +0/-4)
```diff
@@ -163,10 +163,6 @@ COPY --from=build --chown=node:node /app/packages/shared-schemas/src ./packages/
 COPY --from=build --chown=node:node /app/backend/package.json ./backend/package.json
 COPY --from=build --chown=node:node /app/package.json ./package.json
 
-# The runner ships only the root node_modules, so a backend dependency npm nested under backend/ is missing at startup.
-COPY docker/check-runtime-deps.mjs /tmp/check-runtime-deps.mjs
-RUN cd /app/dist && node --input-type=module -e "$(cat /tmp/check-runtime-deps.mjs)" && rm /tmp/check-runtime-deps.mjs
-
 # Deliberately still root at this point. The entrypoint reads the group off a mounted
 # Docker socket — a host-specific id that cannot be baked in and should not have to be
 # supplied — then execs the command as `node`. Nothing in the app runs as root.
```

**File**: `backend/package.json` (modified, +1/-1)
```diff
@@ -39,6 +39,7 @@
     "@aws-sdk/client-cloudwatch-logs": "^3.713.0",
     "@aws-sdk/client-s3": "^3.713.0",
     "@aws-sdk/cloudfront-signer": "^3.901.0",
+    "@aws-sdk/lib-storage": "^3.1035.0",
     "@aws-sdk/s3-presigned-post": "^3.879.0",
     "@aws-sdk/s3-request-presigner": "^3.879.0",
     "@databases/split-sql-query": "^1.0.4",
@@ -79,7 +80,6 @@
     "zod": "^3.23.8"
   },
   "devDependencies": {
-    "@aws-sdk/lib-storage": "^3.1035.0",
     "@types/adm-zip": "^0.5.7",
     "@types/cookie-parser": "^1.4.8",
     "@types/cors": "^2.8.17",
```

**File**: `docker/check-runtime-deps.mjs` (removed, +0/-24)
```diff
@@ -1,24 +0,0 @@
-// Run with cwd /app/dist via `node --input-type=module -e`, so packages resolve the way dist/server.js does.
-import console from 'node:console';
-import { readFileSync } from 'node:fs';
-import process from 'node:process';
-
-const { dependencies } = JSON.parse(readFileSync('/app/backend/package.json', 'utf8'));
-const missing = Object.keys(dependencies)
-  .filter((name) => !name.startsWith('@types/'))
-  .filter((name) => {
-    try {
-      import.meta.resolve(name);
-      return false;
-    } catch {
-      return true;
-    }
-  });
-
-if (missing.length > 0) {
-  console.error(
-    `Runtime dependencies not resolvable from /app/dist: ${missing.join(', ')}.\n` +
-      'npm nested them under backend/node_modules, which the runner stage does not ship.'
-  );
-  process.exit(1);
-}
```

**File**: `package-lock.json` (modified, +10/-14)
```diff
@@ -41,6 +41,7 @@
         "@aws-sdk/client-cloudwatch-logs": "^3.713.0",
         "@aws-sdk/client-s3": "^3.713.0",
         "@aws-sdk/cloudfront-signer": "^3.901.0",
+        "@aws-sdk/lib-storage": "^3.1035.0",
         "@aws-sdk/s3-presigned-post": "^3.879.0",
         "@aws-sdk/s3-request-presigner": "^3.879.0",
         "@databases/split-sql-query": "^1.0.4",
@@ -81,7 +82,6 @@
         "zod": "^3.23.8"
       },
       "devDependencies": {
-        "@aws-sdk/lib-storage": "^3.1035.0",
         "@types/adm-zip": "^0.5.7",
         "@types/cookie-parser": "^1.4.8",
         "@types/cors": "^2.8.17",
@@ -172,7 +172,6 @@
       "version": "3.1035.0",
       "resolved": "https://registry.npmjs.org/@aws-sdk/lib-storage/-/lib-storage-3.1035.0.tgz",
       "integrity": "sha512-VkC0kDql0qkv+h6nIZOAxmek3VMCNGsq2v74QT9Zf/WbPlyM5PqyGp1dsPxNSv2iMtoWXzHvqzkZ55ZiJCgq4Q==",
-      "dev": true,
       "license": "Apache-2.0",
       "dependencies": {
         "@smithy/middleware-endpoint": "^4.4.31",
@@ -191,6 +190,15 @@
         "@aws-sdk/client-s3": "^3.1035.0"
       }
     },
+    "backend/node_modules/@types/multer": {
+      "version": "2.2.0",
+      "resolved": "https://registry.npmjs.org/@types/multer/-/multer-2.2.0.tgz",
+      "integrity": "sha512-3U1troeqGV8Ntp7Q3klwf4zr23VEoqYVocYXaswm9+8z3O9UHDYAqLxjJ/h550iRADTjKdOdhhasXw6gD6kYtg==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/express": "*"
+      }
+    },
     "backend/node_modules/@types/node": {
       "version": "20.19.37",
       "resolved": "https://registry.npmjs.org/@types/node/-/node-20.19.37.tgz",
@@ -7888,15 +7896,6 @@
       "dev": true,
       "license": "MIT"
     },
-    "node_modules/@types/multer": {
-      "version": "2.2.0",
-      "resolved": "https://registry.npmjs.org/@types/multer/-/multer-2.2.0.tgz",
-      "integrity": "sha512-3U1troeqGV8Ntp7Q3klwf4zr23VEoqYVocYXaswm9+8z3O9UHDYAqLxjJ/h550iRADTjKdOdhhasXw6gD6kYtg==",
-      "license": "MIT",
-      "dependencies": {
-        "@types/express": "*"
-      }
-    },
     "node_modules/@types/node": {
       "version": "25.5.0",
       "resolved": "https://registry.npmjs.org/@types/node/-/node-25.5.0.tgz",
@@ -9161,7 +9160,6 @@
       "version": "5.6.0",
       "resolved": "https://registry.npmjs.org/buffer/-/buffer-5.6.0.tgz",
       "integrity": "sha512-/gDYp/UtU0eA1ys8bOs9J6a+E/KWIY+DZ+Q2WESNUA0jFRsJOc0SNUO6xJ5SGA1xueg3NL65W6s+NY5l9cunuw==",
-      "dev": true,
       "license": "MIT",
       "dependencies": {
         "base64-js": "^1.0.2",
@@ -11062,7 +11060,6 @@
       "version": "3.3.0",
       "resolved": "https://registry.npmjs.org/events/-/events-3.3.0.tgz",
       "integrity": "sha512-mQw+2fkQbALzQ7V0MY0IqdnXNOeTtP4r0lN9z7AAawCXgqea7bDii20AYrIBrFd/Hx0M2Ocz6S111CaFkUcb0Q==",
-      "dev": true,
       "license": "MIT",
       "engines": {
         "node": ">=0.8.x"
@@ -15991,7 +15988,6 @@
       "version": "3.0.0",
       "resolved": "https://registry.npmjs.org/stream-browserify/-/stream-browserify-3.0.0.tgz",
       "integrity": "sha512-H73RAHsVBapbim0tU2JwwOiXUj+fikfiaoYAKHF3VJfA0pe2BCzkhAHBlLG6REzE+2WNZcxOXjK7lkso+9euLA==",
-      "dev": true,
       "license": "MIT",
       "dependencies": {
         "inherits": "~2.0.4",
```

---

### Incident Patch 8: `ffd96af0` (2026-10-01)
**Commit Message**: fix(docker): ship csv-parse and multer in the production image

The runner stage copies only the hoisted root node_modules. After the
csv-parse 7 and multer 2.3 bumps, npm left both nested under
backend/node_modules (a dev-only csv-parse 6 held the root slot), so every
image built from main crash-loops at startup with ERR_MODULE_NOT_FOUND.

- Move csv-parse 7.0.2, multer 2.3.0 and @types/multer 2.2.0 to the root
  in the lockfile at their locked versions; pg-seed keeps its own csv-parse 6.
- Move @aws-sdk/lib-storage to devDependencies; only a test imports it.
- Fail the image build when a backend runtime dependency cannot be resolved
  from /app/dist.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `Dockerfile` (modified, +4/-0)
```diff
@@ -163,6 +163,10 @@ COPY --from=build --chown=node:node /app/packages/shared-schemas/src ./packages/
 COPY --from=build --chown=node:node /app/backend/package.json ./backend/package.json
 COPY --from=build --chown=node:node /app/package.json ./package.json
 
+# The runner ships only the root node_modules, so a backend dependency npm nested under backend/ is missing at startup.
+COPY docker/check-runtime-deps.mjs /tmp/check-runtime-deps.mjs
+RUN cd /app/dist && node --input-type=module -e "$(cat /tmp/check-runtime-deps.mjs)" && rm /tmp/check-runtime-deps.mjs
+
 # Deliberately still root at this point. The entrypoint reads the group off a mounted
 # Docker socket — a host-specific id that cannot be baked in and should not have to be
 # supplied — then execs the command as `node`. Nothing in the app runs as root.
```

**File**: `backend/package.json` (modified, +1/-1)
```diff
@@ -39,7 +39,6 @@
     "@aws-sdk/client-cloudwatch-logs": "^3.713.0",
     "@aws-sdk/client-s3": "^3.713.0",
     "@aws-sdk/cloudfront-signer": "^3.901.0",
-    "@aws-sdk/lib-storage": "^3.1035.0",
     "@aws-sdk/s3-presigned-post": "^3.879.0",
     "@aws-sdk/s3-request-presigner": "^3.879.0",
     "@databases/split-sql-query": "^1.0.4",
@@ -80,6 +79,7 @@
     "zod": "^3.23.8"
   },
   "devDependencies": {
+    "@aws-sdk/lib-storage": "^3.1035.0",
     "@types/adm-zip": "^0.5.7",
     "@types/cookie-parser": "^1.4.8",
     "@types/cors": "^2.8.17",
```

**File**: `docker/check-runtime-deps.mjs` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+// Run with cwd /app/dist via `node --input-type=module -e`, so packages resolve the way dist/server.js does.
+import console from 'node:console';
+import { readFileSync } from 'node:fs';
+import process from 'node:process';
+
+const { dependencies } = JSON.parse(readFileSync('/app/backend/package.json', 'utf8'));
+const missing = Object.keys(dependencies)
+  .filter((name) => !name.startsWith('@types/'))
+  .filter((name) => {
+    try {
+      import.meta.resolve(name);
+      return false;
+    } catch {
+      return true;
+    }
+  });
+
+if (missing.length > 0) {
+  console.error(
+    `Runtime dependencies not resolvable from /app/dist: ${missing.join(', ')}.\n` +
+      'npm nested them under backend/node_modules, which the runner stage does not ship.'
+  );
+  process.exit(1);
+}
```

**File**: `package-lock.json` (modified, +43/-39)
```diff
@@ -41,7 +41,6 @@
         "@aws-sdk/client-cloudwatch-logs": "^3.713.0",
         "@aws-sdk/client-s3": "^3.713.0",
         "@aws-sdk/cloudfront-signer": "^3.901.0",
-        "@aws-sdk/lib-storage": "^3.1035.0",
         "@aws-sdk/s3-presigned-post": "^3.879.0",
         "@aws-sdk/s3-request-presigner": "^3.879.0",
         "@databases/split-sql-query": "^1.0.4",
@@ -82,6 +81,7 @@
         "zod": "^3.23.8"
       },
       "devDependencies": {
+        "@aws-sdk/lib-storage": "^3.1035.0",
         "@types/adm-zip": "^0.5.7",
         "@types/cookie-parser": "^1.4.8",
         "@types/cors": "^2.8.17",
@@ -172,6 +172,7 @@
       "version": "3.1035.0",
       "resolved": "https://registry.npmjs.org/@aws-sdk/lib-storage/-/lib-storage-3.1035.0.tgz",
       "integrity": "sha512-VkC0kDql0qkv+h6nIZOAxmek3VMCNGsq2v74QT9Zf/WbPlyM5PqyGp1dsPxNSv2iMtoWXzHvqzkZ55ZiJCgq4Q==",
+      "dev": true,
       "license": "Apache-2.0",
       "dependencies": {
         "@smithy/middleware-endpoint": "^4.4.31",
@@ -190,15 +191,6 @@
         "@aws-sdk/client-s3": "^3.1035.0"
       }
     },
-    "backend/node_modules/@types/multer": {
-      "version": "2.2.0",
-      "resolved": "https://registry.npmjs.org/@types/multer/-/multer-2.2.0.tgz",
-      "integrity": "sha512-3U1troeqGV8Ntp7Q3klwf4zr23VEoqYVocYXaswm9+8z3O9UHDYAqLxjJ/h550iRADTjKdOdhhasXw6gD6kYtg==",
-      "license": "MIT",
-      "dependencies": {
-        "@types/express": "*"
-      }
-    },
     "backend/node_modules/@types/node": {
       "version": "20.19.37",
       "resolved": "https://registry.npmjs.org/@types/node/-/node-20.19.37.tgz",
@@ -209,31 +201,6 @@
         "undici-types": "~6.21.0"
       }
     },
-    "backend/node_modules/csv-parse": {
-      "version": "7.0.2",
-      "resolved": "https://registry.npmjs.org/csv-parse/-/csv-parse-7.0.2.tgz",
-      "integrity": "sha512-uKZghv9UmPkMVLYy//KZ9HFAIJsl7wkhoEdIL0+rhuSY9pZQlhaeGEDPIe+/w7eh81MOql8Q/9+inAGWG6ZHYA==",
-      "license": "MIT"
-    },
-    "backend/node_modules/multer": {
-      "version": "2.3.0",
-      "resolved": "https://registry.npmjs.org/multer/-/multer-2.3.0.tgz",
-      "integrity": "sha512-cjNbm3sttszgZeGfJR124D+jFEfkXCVAsoPBmFn9X7UxmDSFHWqE2CoEj0vrmSpuAFnqWR1Szcm9QTsiHr60Xw==",
-      "license": "MIT",
-      "dependencies": {
-        "append-field": "^1.0.0",
-        "busboy": "^1.6.0",
-        "concat-stream": "^2.0.0",
-        "type-is": "^1.6.18"
-      },
-      "engines": {
-        "node": ">= 10.16.0"
-      },
-      "funding": {
-        "type": "opencollective",
-        "url": "https://opencollective.com/express"
-      }
-    },
     "frontend": {
       "name": "insforge-dashboard",
       "version": "1.0.0",
@@ -7921,6 +7888,15 @@
       "dev": true,
       "license": "MIT"
     },
+    "node_modules/@types/multer": {
+      "version": "2.2.0",
+      "resolved": "https://registry.npmjs.org/@types/multer/-/multer-2.2.0.tgz",
+      "integrity": "sha512-3U1troeqGV8Ntp7Q3klwf4zr23VEoqYVocYXaswm9+8z3O9UHDYAqLxjJ/h550iRADTjKdOdhhasXw6gD6kYtg==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/express": "*"
+      }
+    },
     "node_modules/@types/node": {
       "version": "25.5.0",
       "resolved": "https://registry.npmjs.org/@types/node/-/node-25.5.0.tgz",
@@ -9185,6 +9161,7 @@
       "version": "5.6.0",
       "resolved": "https://registry.npmjs.org/buffer/-/buffer-5.6.0.tgz",
       "integrity": "sha512-/gDYp/UtU0eA1ys8bOs9J6a+E/KWIY+DZ+Q2WESNUA0jFRsJOc0SNUO6xJ5SGA1xueg3NL65W6s+NY5l9cunuw==",
+      "dev": true,
       "license": "MIT",
       "dependencies": {
         "base64-js": "^1.0.2",
@@ -9843,10 +9820,9 @@
       "license": "MIT"
     },
     "node_modules/csv-parse": {
-      "version": "6.2.1",
-      "resolved": "https://registry.npmjs.org/csv-parse/-/csv-parse-6.2.1.tgz",
-      "integrity": "sha512-LRLMV+UCyfMokp8Wb411duBf1gaBKJfOfBWU9eHMJ+b+cJYZsNu3AFmjJf3+yPGd59Exz1TsMjaSFyxnYB9+IQ==",
-      "dev": true,
+      "version": "7.0.2",
+      "resolved": "https://registry.npmjs.org/csv-parse/-/csv-parse-7.0.2.tgz",
+      "integrity": "sha512-uKZghv9UmPkMVLYy//KZ9HFAIJsl7wkhoEdIL0+rhuSY9pZQlhaeGEDPIe+/w7eh81MOql8Q/9+inAGWG6ZHYA==",
       "license": "MIT"
     },
     "node_modules/csv-parser": {
@@ -11086,6 +11062,7 @@
       "version": "3.3.0",
       "resolved": "https://registry.npmjs.org/events/-/events-3.3.0.tgz",
       "integrity": "sha512-mQw+2fkQbALzQ7V0MY0IqdnXNOeTtP4r0lN9z7AAawCXgqea7bDii20AYrIBrFd/Hx0M2Ocz6S111CaFkUcb0Q==",
+      "dev": true,
       "license": "MIT",
       "engines": {
         "node": ">=0.8.x"
@@ -13588,6 +13565,25 @@
       "integrity": "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==",
       "license": "MIT"
     },
+    "node_modules/multer": {
+      "version": "2.3.0",
+      "resolved": "https://registry.npmjs.org/multer/-/multer-2.3.0.tgz",
+      "integrity": "sha512-cjNbm3sttszgZeGfJR124D+jFEfkXCVAsoPBmFn9X7UxmDSFHWqE2CoEj0vrmSpuAFnqWR1Sz
```

---

### Incident Patch 9: `87058283` (2026-09-26)
**Commit Message**: Merge pull request #2076 from prakharsingh-74/BUG/outage-permanent-data-loss-window

BUG: Adopt staged blue-green strategy for container updates

**File**: `backend/src/providers/compute/compute.provider.ts` (modified, +2/-0)
```diff
@@ -5,6 +5,8 @@ import { ERROR_CODES } from '@insforge/shared-schemas';
 
 export interface LaunchMachineParams {
   appId: string;
+  /** Logical service name when different from container name/appId (e.g. during staged updates). */
+  serviceName?: string;
   /**
    * Image URL — image-mode (any registry) or source-mode (digest-pinned
    * registry.fly.io ref produced by the CLI's `flyctl deploy --build-only --push`).
```

**File**: `backend/src/providers/compute/docker.provider.ts` (modified, +149/-19)
```diff
@@ -41,7 +41,12 @@ const LABEL_SPEC = 'insforge.spec';
 type ContainerInspect = {
   Id: string;
   Name: string;
-  State: { Status: string; ExitCode: number; Running: boolean };
+  State: {
+    Status: string;
+    ExitCode: number;
+    Running: boolean;
+    Health?: { Status: 'starting' | 'healthy' | 'unhealthy' | string };
+  };
   Config: { Image: string; Labels?: Record<string, string> };
   HostConfig?: { NanoCpus?: number; Memory?: number };
   NetworkSettings: {
@@ -313,8 +318,9 @@ export class DockerProvider implements ComputeProvider {
   async launchMachine(
     params: LaunchMachineParams
   ): Promise<{ machineId: string; endpointUrl: string | null }> {
+    const serviceName = params.serviceName ?? params.appId;
     // Must precede create — see ensureImage.
-    await this.ensureImage(params.image, params.appId);
+    await this.ensureImage(params.image, serviceName);
 
     const network = await this.resolveNetwork();
     const ingress = this.ingressFor(params.ingress);
@@ -325,7 +331,7 @@ export class DockerProvider implements ComputeProvider {
       Labels: {
         [LABEL_MANAGED]: 'true',
         [LABEL_PROJECT]: this.projectKey(),
-        [LABEL_SERVICE]: params.appId,
+        [LABEL_SERVICE]: serviceName,
         [LABEL_SPEC]: this.specHash(params),
       },
       Env: Object.entries(params.envVars ?? {}).map(([k, v]) => `${k}=${v}`),
@@ -419,21 +425,16 @@ export class DockerProvider implements ComputeProvider {
         return {};
       }
 
-      // Recreate under the same name. Stop and remove first because the name is
-      // taken; if creating the replacement then fails, the row is left pointing
-      // at a removed container, which the existing MachineGoneError healing turns
-      // into a clean relaunch on the next request.
-      const name = (current.Name ?? '').replace(/^\//, '') || params.appId;
-      await dockerRequest('POST', `/containers/${encodeURIComponent(params.machineId)}/stop`).catch(
-        () => undefined
-      );
-      await dockerRequest(
-        'DELETE',
-        `/containers/${encodeURIComponent(params.machineId)}?force=true`
-      );
+      // Recreate using a Create-Before-Destroy (Staged Blue-Green) pattern.
+      // Launch the replacement container under a temporary staging identifier alongside
+      // the existing workload. If pulling the image, creating the container, or starting
+      // it fails, the original container is untouched and remains online serving live traffic.
+      const primaryName = (current.Name ?? '').replace(/^\//, '') || params.appId;
+      const stagingName = `${primaryName}-stage-${Date.now()}`;
 
       const launched = await this.launchMachine({
-        appId: name,
+        appId: stagingName,
+        serviceName: primaryName,
         image: params.image,
         port: params.port,
         cpu: params.cpu,
@@ -444,13 +445,88 @@ export class DockerProvider implements ComputeProvider {
         protocol: params.protocol,
         scaleToZero: params.scaleToZero,
       });
+
+      // Readiness Gate: verify the staging container is genuinely running and healthy
+      // before touching the original. Docker POST /start returns 204 immediately when
+      // the process starts; if the entrypoint crashes right after, state flips to
+      // 'exited'/'dead'. When the image defines a HEALTHCHECK, the initial status is
+      // 'starting' — accepting that would destroy the original before the first probe
+      // completes. Poll until health resolves or a timeout expires.
+      try {
+        await this.awaitStagingReady(launched.machineId);
+      } catch (err) {
+        await dockerRequest(
+          'DELETE',
+          `/containers/${encodeURIComponent(launched.machineId)}?force=true`
+        ).catch(() => undefined);
+        throw err;
+      }
+
+      // Promotion via rename-swap: the old container is never destroyed until the
+      // staging container successfully assumes the primary name. If any step fails,
+      // the old container is restored under its original name so the service stays
+      // online.
+      const retireName = `${primaryName}-retire-${Date.now()}`;
+
+      // Step 1: Move the old container out of the way by renaming to a retire name.
+      // This frees the primary name for the staging container without deleting anything.
+      try {
+        await dockerRequest(
+          'POST',
+          `/containers/${encodeURIComponent(params.machineId)}/rename?name=${encodeURIComponent(retireName)}`
+        );
+      } catch (err) {
+        // Old container could not be renamed — it is still running under the primary
+        // name. Clean up staging and surface the error; service remains online.
+        await dockerRequest(
+          'DELETE',
+          `/containers/${encodeURIComponent(launched.machineId)}?force=true`
+        ).catch(() => undefined);
+        throw new Error(
+          `Failed to retire old container ${params.machineId}: ${err ins
```

**File**: `backend/tests/unit/compute/docker-provider.test.ts` (modified, +403/-18)
```diff
@@ -436,7 +436,7 @@ describe('DockerProvider', () => {
     // The bug this guards: Docker cannot swap a running container's image, so
     // applying only cpu/memory would report success while the old image keeps
     // serving and the database records the new one.
-    it('recreates the container when the image changes, and reports the new id', async () => {
+    it('recreates the container when the image changes using staged blue-green strategy, and reports the new id', async () => {
       const oldSpec = await hashFor(baseSpec);
       mockRequest
         .mockResolvedValueOnce(
@@ -452,10 +452,15 @@ describe('DockerProvider', () => {
             },
           })
         )
-        .mockResolvedValueOnce(undefined) // stop
-        .mockResolvedValueOnce(undefined) // remove
-        .mockResolvedValueOnce({ Id: 'container-new' }) // create
-        .mockResolvedValueOnce(undefined); // start
+        .mockResolvedValueOnce({ Id: 'container-new' }) // create staging
+        .mockResolvedValueOnce(undefined) // start staging
+        .mockResolvedValueOnce(
+          ownedContainer({ Id: 'container-new', State: { Status: 'running' } })
+        ) // readiness check (no HEALTHCHECK — passes immediately)
+        .mockResolvedValueOnce(undefined) // rename old → retire
+        .mockResolvedValueOnce(undefined) // rename staging → primary
+        .mockResolvedValueOnce(undefined) // stop retired
+        .mockResolvedValueOnce(undefined); // delete retired
       imageAlreadyPresent();
 
       const result = await provider.updateMachine({
@@ -466,15 +471,390 @@ describe('DockerProvider', () => {
 
       expect(result).toEqual({ machineId: 'container-new', endpointUrl: null });
       const paths = mockRequest.mock.calls.map((c) => `${c[0]} ${c[1]}`);
-      expect(paths).toEqual([
-        'GET /containers/container-abc/json',
-        'POST /containers/container-abc/stop',
-        'DELETE /containers/container-abc?force=true',
-        'POST /containers/create?name=insforge-testkey1-api',
-        'POST /containers/container-new/start',
-      ]);
-      // Replacement runs the requested image, under the original name.
-      expect(mockRequest.mock.calls[3][2].body.Image).toBe('nginx:1.27-alpine');
+      expect(paths[0]).toBe('GET /containers/container-abc/json');
+      expect(paths[1]).toMatch(/^POST \/containers\/create\?name=insforge-testkey1-api-stage-\d+$/);
+      expect(paths[2]).toBe('POST /containers/container-new/start');
+      expect(paths[3]).toBe('GET /containers/container-new/json');
+      // Rename-swap: old renamed to retire, staging renamed to primary, then old torn down.
+      expect(paths[4]).toMatch(
+        /^POST \/containers\/container-abc\/rename\?name=insforge-testkey1-api-retire-\d+$/
+      );
+      expect(paths[5]).toBe('POST /containers/container-new/rename?name=insforge-testkey1-api');
+      expect(paths[6]).toBe('POST /containers/container-abc/stop');
+      expect(paths[7]).toBe('DELETE /containers/container-abc?force=true');
+
+      // Replacement runs requested image and carries logical service name.
+      expect(mockRequest.mock.calls[1][2].body.Image).toBe('nginx:1.27-alpine');
+      expect(mockRequest.mock.calls[1][2].body.Labels['insforge.service']).toBe(
+        'insforge-testkey1-api'
+      );
+    });
+
+    it('preserves old container untouched if staging launch fails (zero downtime)', async () => {
+      const oldSpec = await hashFor(baseSpec);
+      mockRequest
+        .mockResolvedValueOnce(
+          ownedContainer({
+            Name: '/insforge-testkey1-api',
+            Config: {
+              Image: 'nginx:alpine',
+              Labels: {
+                'insforge.managed': 'true',
+                'insforge.project': 'testkey1',
+                'insforge.spec': oldSpec,
+              },
+            },
+          })
+        )
+        .mockResolvedValueOnce({ Id: 'container-doomed' }) // create staging succeeds
+        .mockRejectedValueOnce(new Error('container entrypoint crashed')) // start staging fails
+        .mockResolvedValueOnce(undefined); // cleanup doomed staging container
+
+      imageAlreadyPresent();
+
+      await expect(
+        provider.updateMachine({
+          ...baseSpec,
+          machineId: 'container-abc',
+          image: 'nginx:1.27-alpine',
+        })
+      ).rejects.toThrow('container entrypoint crashed');
+
+      const paths = mockRequest.mock.calls.map((c) => `${c[0]} ${c[1]}`);
+      // Must NOT contain stop or delete for the old container-abc
+      expect(paths).not.toContain('POST /containers/container-abc/stop');
+      expect(paths).not.toContain('DELETE /containers/container-abc?force=true');
+      // Must clean up the broken staging container
+      expect(paths).toContain('DELETE /containers/container-doomed?force=true');
+    });
+
+    it('aborts cutover if staging container exits/fails readiness check right after start', async () => {
+      const oldSpec = await has
```

---

### Incident Patch 10: `d6ab4266` (2026-09-26)
**Commit Message**: prettier fixed

**File**: `backend/tests/unit/compute/docker-provider.test.ts` (modified, +7/-5)
```diff
@@ -476,7 +476,9 @@ describe('DockerProvider', () => {
       expect(paths[2]).toBe('POST /containers/container-new/start');
       expect(paths[3]).toBe('GET /containers/container-new/json');
       // Rename-swap: old renamed to retire, staging renamed to primary, then old torn down.
-      expect(paths[4]).toMatch(/^POST \/containers\/container-abc\/rename\?name=insforge-testkey1-api-retire-\d+$/);
+      expect(paths[4]).toMatch(
+        /^POST \/containers\/container-abc\/rename\?name=insforge-testkey1-api-retire-\d+$/
+      );
       expect(paths[5]).toBe('POST /containers/container-new/rename?name=insforge-testkey1-api');
       expect(paths[6]).toBe('POST /containers/container-abc/stop');
       expect(paths[7]).toBe('DELETE /containers/container-abc?force=true');
@@ -758,9 +760,7 @@ describe('DockerProvider', () => {
       await vi.advanceTimersByTimeAsync(35_000);
       vi.useRealTimers();
 
-      await expect(promise).rejects.toThrow(
-        /health check did not resolve within 30000ms/
-      );
+      await expect(promise).rejects.toThrow(/health check did not resolve within 30000ms/);
       const paths = mockRequest.mock.calls.map((c) => `${c[0]} ${c[1]}`);
       expect(paths).not.toContain('POST /containers/container-abc/stop');
       expect(paths).toContain('DELETE /containers/container-slow?force=true');
@@ -847,7 +847,9 @@ describe('DockerProvider', () => {
       const paths = mockRequest.mock.calls.map((c) => `${c[0]} ${c[1]}`);
       // The old container must be restored to its primary name — service stays online.
       expect(paths).toContainEqual(
-        expect.stringMatching(/^POST \/containers\/container-abc\/rename\?name=insforge-testkey1-api$/)
+        expect.stringMatching(
+          /^POST \/containers\/container-abc\/rename\?name=insforge-testkey1-api$/
+        )
       );
       // Staging must be cleaned up.
       expect(paths).toContain('DELETE /containers/container-new?force=true');
```

---

### Incident Patch 11: `c7cf0356` (2026-09-26)
**Commit Message**: Eslint Fixed

**File**: `backend/src/providers/compute/docker.provider.ts` (modified, +4/-8)
```diff
@@ -512,10 +512,9 @@ export class DockerProvider implements ComputeProvider {
       // Step 3: Tear down the retired container. It is now safely renamed and the
       // staging container owns the primary name. A failure here is non-fatal — the
       // retired container is just an orphan that stop/force-remove will clean up.
-      await dockerRequest(
-        'POST',
-        `/containers/${encodeURIComponent(params.machineId)}/stop`
-      ).catch(() => undefined);
+      await dockerRequest('POST', `/containers/${encodeURIComponent(params.machineId)}/stop`).catch(
+        () => undefined
+      );
       await dockerRequest(
         'DELETE',
         `/containers/${encodeURIComponent(params.machineId)}?force=true`
@@ -573,10 +572,7 @@ export class DockerProvider implements ComputeProvider {
    * status. `running` is accepted immediately because there is no further
    * readiness probe to wait for.
    */
-  private async awaitStagingReady(
-    machineId: string,
-    timeoutMs = 30_000
-  ): Promise<void> {
+  private async awaitStagingReady(machineId: string, timeoutMs = 30_000): Promise<void> {
     const start = Date.now();
     const pollMs = 1_000;
 
```

---

### Incident Patch 12: `fbae0614` (2026-09-26)
**Commit Message**: Merge branch 'main' into BUG/outage-permanent-data-loss-window

**File**: `README.md` (modified, +3/-3)
```diff
@@ -256,9 +256,9 @@ See the [self-hosted storage guide](https://docs.insforge.dev/deployment/self-ho
 
 In addition to running InsForge locally, you can also launch InsForge using a pre-configured setup. This allows you to get up and running quickly with InsForge without installing Docker on your local machine.
 
-| Railway | Zeabur | Sealos | RepoCloud |
-| --- | --- | --- | --- |
-| [![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/insforge) | [![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/Q82M3Y) | [![Deploy on Sealos](https://sealos.io/Deploy-on-Sealos.svg)](https://sealos.io/products/app-store/insforge) | [![Deploy on RepoCloud](https://d16t0pc4846x52.cloudfront.net/deploylobe.svg)](https://repocloud.io/details/InsForge/) |
+| Railway | Zeabur | Sealos | RepoCloud | ZopDay |
+| --- | --- | --- | --- | --- |
+| [![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/insforge) | [![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/Q82M3Y) | [![Deploy on Sealos](https://sealos.io/Deploy-on-Sealos.svg)](https://sealos.io/products/app-store/insforge) | [![Deploy on RepoCloud](https://d16t0pc4846x52.cloudfront.net/deploylobe.svg)](https://repocloud.io/details/InsForge/) | [![Deploy on ZopDay](https://zop.dev/deploytozopday-inkhard.svg)](https://zop.dev/zopday/app/deploy?image=ghcr.io/insforge/insforge-oss:latest&port=7130) |
 
 
 ## Contributing
```

---

### Incident Patch 13: `1cad3567` (2026-09-26)
**Commit Message**: fix(docker): poll health readiness and use rename-swap for safe cutover

**File**: `backend/src/providers/compute/docker.provider.ts` (modified, +95/-22)
```diff
@@ -446,20 +446,14 @@ export class DockerProvider implements ComputeProvider {
         scaleToZero: params.scaleToZero,
       });
 
-      // Readiness Gate: Verify raw Docker status is strictly 'running' and health is not 'unhealthy'.
-      // Docker POST /start returns HTTP 204 immediately when process starts. If entrypoint crashes right after,
-      // state will be non-running ('exited'/'stopped'/'dead'/'failed'/'restarting').
-      // Catch inspection failures so transient errors do not leak untracked staging containers.
+      // Readiness Gate: verify the staging container is genuinely running and healthy
+      // before touching the original. Docker POST /start returns 204 immediately when
+      // the process starts; if the entrypoint crashes right after, state flips to
+      // 'exited'/'dead'. When the image defines a HEALTHCHECK, the initial status is
+      // 'starting' — accepting that would destroy the original before the first probe
+      // completes. Poll until health resolves or a timeout expires.
       try {
-        const inspect = await this.assertOwned(launched.machineId);
-        const status = inspect.State?.Status;
-        const health = inspect.State?.Health?.Status;
-
-        if (status !== 'running' || health === 'unhealthy') {
-          throw new Error(
-            `Staging container failed readiness check (status: ${status}${health ? `, health: ${health}` : ''})`
-          );
-        }
+        await this.awaitStagingReady(launched.machineId);
       } catch (err) {
         await dockerRequest(
           'DELETE',
@@ -468,34 +462,44 @@ export class DockerProvider implements ComputeProvider {
         throw err;
       }
 
-      // Teardown superseded container once replacement is verified up and healthy.
+      // Promotion via rename-swap: the old container is never destroyed until the
+      // staging container successfully assumes the primary name. If any step fails,
+      // the old container is restored under its original name so the service stays
+      // online.
+      const retireName = `${primaryName}-retire-${Date.now()}`;
+
+      // Step 1: Move the old container out of the way by renaming to a retire name.
+      // This frees the primary name for the staging container without deleting anything.
       try {
         await dockerRequest(
           'POST',
-          `/containers/${encodeURIComponent(params.machineId)}/stop`
-        ).catch(() => undefined);
-        await dockerRequest(
-          'DELETE',
-          `/containers/${encodeURIComponent(params.machineId)}?force=true`
+          `/containers/${encodeURIComponent(params.machineId)}/rename?name=${encodeURIComponent(retireName)}`
         );
       } catch (err) {
+        // Old container could not be renamed — it is still running under the primary
+        // name. Clean up staging and surface the error; service remains online.
         await dockerRequest(
           'DELETE',
           `/containers/${encodeURIComponent(launched.machineId)}?force=true`
         ).catch(() => undefined);
         throw new Error(
-          `Failed to remove superseded container ${params.machineId}: ${err instanceof Error ? err.message : String(err)}`
+          `Failed to retire old container ${params.machineId}: ${err instanceof Error ? err.message : String(err)}`
         );
       }
 
-      // Atomic rename of staging container to primary application name (Promotion).
-      // If rename fails (e.g. name conflict), remove staging container and throw so success is never reported on failed promotion.
+      // Step 2: Promote staging container to the primary name.
       try {
         await dockerRequest(
           'POST',
           `/containers/${encodeURIComponent(launched.machineId)}/rename?name=${encodeURIComponent(primaryName)}`
         );
       } catch (err) {
+        // Promotion failed — restore the old container to its original name so the
+        // service remains available, then clean up staging.
+        await dockerRequest(
+          'POST',
+          `/containers/${encodeURIComponent(params.machineId)}/rename?name=${encodeURIComponent(primaryName)}`
+        ).catch(() => undefined);
         await dockerRequest(
           'DELETE',
           `/containers/${encodeURIComponent(launched.machineId)}?force=true`
@@ -505,6 +509,18 @@ export class DockerProvider implements ComputeProvider {
         );
       }
 
+      // Step 3: Tear down the retired container. It is now safely renamed and the
+      // staging container owns the primary name. A failure here is non-fatal — the
+      // retired container is just an orphan that stop/force-remove will clean up.
+      await dockerRequest(
+        'POST',
+        `/containers/${encodeURIComponent(params.machineId)}/stop`
+      ).catch(() => undefined);
+      await dockerRequest(
+        'DELETE',
+        `/containers/${encodeURIComponent(params.machineId)}?force=true`
+      ).catch(() => undefined);
+
       logg
```

**File**: `backend/tests/unit/compute/docker-provider.test.ts` (modified, +231/-17)
```diff
@@ -456,10 +456,11 @@ describe('DockerProvider', () => {
         .mockResolvedValueOnce(undefined) // start staging
         .mockResolvedValueOnce(
           ownedContainer({ Id: 'container-new', State: { Status: 'running' } })
-        ) // readiness check
-        .mockResolvedValueOnce(undefined) // stop old
-        .mockResolvedValueOnce(undefined) // remove old
-        .mockResolvedValueOnce(undefined); // rename staging
+        ) // readiness check (no HEALTHCHECK — passes immediately)
+        .mockResolvedValueOnce(undefined) // rename old → retire
+        .mockResolvedValueOnce(undefined) // rename staging → primary
+        .mockResolvedValueOnce(undefined) // stop retired
+        .mockResolvedValueOnce(undefined); // delete retired
       imageAlreadyPresent();
 
       const result = await provider.updateMachine({
@@ -474,9 +475,11 @@ describe('DockerProvider', () => {
       expect(paths[1]).toMatch(/^POST \/containers\/create\?name=insforge-testkey1-api-stage-\d+$/);
       expect(paths[2]).toBe('POST /containers/container-new/start');
       expect(paths[3]).toBe('GET /containers/container-new/json');
-      expect(paths[4]).toBe('POST /containers/container-abc/stop');
-      expect(paths[5]).toBe('DELETE /containers/container-abc?force=true');
-      expect(paths[6]).toBe('POST /containers/container-new/rename?name=insforge-testkey1-api');
+      // Rename-swap: old renamed to retire, staging renamed to primary, then old torn down.
+      expect(paths[4]).toMatch(/^POST \/containers\/container-abc\/rename\?name=insforge-testkey1-api-retire-\d+$/);
+      expect(paths[5]).toBe('POST /containers/container-new/rename?name=insforge-testkey1-api');
+      expect(paths[6]).toBe('POST /containers/container-abc/stop');
+      expect(paths[7]).toBe('DELETE /containers/container-abc?force=true');
 
       // Replacement runs requested image and carries logical service name.
       expect(mockRequest.mock.calls[1][2].body.Image).toBe('nginx:1.27-alpine');
@@ -602,7 +605,168 @@ describe('DockerProvider', () => {
       expect(paths).toContain('DELETE /containers/container-inspect-fail?force=true');
     });
 
-    it('cleans up staging container and rejects when promotion rename fails', async () => {
+    it('polls until health check resolves from starting to healthy before cutover', async () => {
+      const oldSpec = await hashFor(baseSpec);
+      mockRequest
+        .mockResolvedValueOnce(
+          ownedContainer({
+            Name: '/insforge-testkey1-api',
+            Config: {
+              Image: 'nginx:alpine',
+              Labels: {
+                'insforge.managed': 'true',
+                'insforge.project': 'testkey1',
+                'insforge.spec': oldSpec,
+              },
+            },
+          })
+        )
+        .mockResolvedValueOnce({ Id: 'container-new' }) // create staging
+        .mockResolvedValueOnce(undefined) // start staging
+        // First readiness poll: health is 'starting' — must not proceed yet.
+        .mockResolvedValueOnce(
+          ownedContainer({
+            Id: 'container-new',
+            State: { Status: 'running', Health: { Status: 'starting' } },
+          })
+        )
+        // Second readiness poll: health resolves to 'healthy' — proceed.
+        .mockResolvedValueOnce(
+          ownedContainer({
+            Id: 'container-new',
+            State: { Status: 'running', Health: { Status: 'healthy' } },
+          })
+        )
+        .mockResolvedValueOnce(undefined) // rename old → retire
+        .mockResolvedValueOnce(undefined) // rename staging → primary
+        .mockResolvedValueOnce(undefined) // stop retired
+        .mockResolvedValueOnce(undefined); // delete retired
+      imageAlreadyPresent();
+
+      vi.useFakeTimers();
+      const promise = provider.updateMachine({
+        ...baseSpec,
+        machineId: 'container-abc',
+        image: 'nginx:1.27-alpine',
+      });
+      // Advance past the poll delay so awaitStagingReady re-inspects.
+      await vi.advanceTimersByTimeAsync(1_500);
+      vi.useRealTimers();
+
+      const result = await promise;
+      expect(result).toEqual({ machineId: 'container-new', endpointUrl: null });
+      // Two readiness inspections: starting, then healthy.
+      const inspects = mockRequest.mock.calls.filter(
+        (c) => c[0] === 'GET' && c[1] === '/containers/container-new/json'
+      );
+      expect(inspects).toHaveLength(2);
+    });
+
+    it('aborts cutover when health transitions from starting to unhealthy', async () => {
+      const oldSpec = await hashFor(baseSpec);
+      mockRequest
+        .mockResolvedValueOnce(
+          ownedContainer({
+            Name: '/insforge-testkey1-api',
+            Config: {
+              Image: 'nginx:alpine',
+              Labels: {
+                'insforge.managed': 'true',
+                'insforge.project': 'testkey1',
+                'insforge.spec': oldSpec,
+              },
+            },

```

---

### Incident Patch 14: `4b0924aa` (2026-09-23)
**Commit Message**: fix Prettier code formatting in docker-provider unit test

**File**: `backend/tests/unit/compute/docker-provider.test.ts` (modified, +10/-3)
```diff
@@ -454,7 +454,9 @@ describe('DockerProvider', () => {
         )
         .mockResolvedValueOnce({ Id: 'container-new' }) // create staging
         .mockResolvedValueOnce(undefined) // start staging
-        .mockResolvedValueOnce(ownedContainer({ Id: 'container-new', State: { Status: 'running' } })) // readiness check
+        .mockResolvedValueOnce(
+          ownedContainer({ Id: 'container-new', State: { Status: 'running' } })
+        ) // readiness check
         .mockResolvedValueOnce(undefined) // stop old
         .mockResolvedValueOnce(undefined) // remove old
         .mockResolvedValueOnce(undefined); // rename staging
@@ -540,7 +542,10 @@ describe('DockerProvider', () => {
         .mockResolvedValueOnce({ Id: 'container-crashed' }) // create staging succeeds
         .mockResolvedValueOnce(undefined) // start staging returns 204
         .mockResolvedValueOnce(
-          ownedContainer({ Id: 'container-crashed', State: { Status: 'exited', ExitCode: 1, Running: false } })
+          ownedContainer({
+            Id: 'container-crashed',
+            State: { Status: 'exited', ExitCode: 1, Running: false },
+          })
         ) // readiness check returns exited
         .mockResolvedValueOnce(undefined); // delete staging
 
@@ -579,7 +584,9 @@ describe('DockerProvider', () => {
         )
         .mockResolvedValueOnce({ Id: 'container-new' })
         .mockResolvedValueOnce(undefined)
-        .mockResolvedValueOnce(ownedContainer({ Id: 'container-new', State: { Status: 'running' } }))
+        .mockResolvedValueOnce(
+          ownedContainer({ Id: 'container-new', State: { Status: 'running' } })
+        )
         .mockResolvedValueOnce(undefined)
         .mockResolvedValueOnce(undefined)
         .mockResolvedValueOnce(undefined);
```

---

### Incident Patch 15: `4255df35` (2026-09-23)
**Commit Message**: fix(backend): adopt staged blue-green strategy for container updates in DockerProvider

**File**: `backend/src/providers/compute/compute.provider.ts` (modified, +2/-0)
```diff
@@ -5,6 +5,8 @@ import { ERROR_CODES } from '@insforge/shared-schemas';
 
 export interface LaunchMachineParams {
   appId: string;
+  /** Logical service name when different from container name/appId (e.g. during staged updates). */
+  serviceName?: string;
   /**
    * Image URL — image-mode (any registry) or source-mode (digest-pinned
    * registry.fly.io ref produced by the CLI's `flyctl deploy --build-only --push`).
```

**File**: `backend/src/providers/compute/docker.provider.ts` (modified, +35/-17)
```diff
@@ -313,8 +313,9 @@ export class DockerProvider implements ComputeProvider {
   async launchMachine(
     params: LaunchMachineParams
   ): Promise<{ machineId: string; endpointUrl: string | null }> {
+    const serviceName = params.serviceName ?? params.appId;
     // Must precede create — see ensureImage.
-    await this.ensureImage(params.image, params.appId);
+    await this.ensureImage(params.image, serviceName);
 
     const network = await this.resolveNetwork();
     const ingress = this.ingressFor(params.ingress);
@@ -325,7 +326,7 @@ export class DockerProvider implements ComputeProvider {
       Labels: {
         [LABEL_MANAGED]: 'true',
         [LABEL_PROJECT]: this.projectKey(),
-        [LABEL_SERVICE]: params.appId,
+        [LABEL_SERVICE]: serviceName,
         [LABEL_SPEC]: this.specHash(params),
       },
       Env: Object.entries(params.envVars ?? {}).map(([k, v]) => `${k}=${v}`),
@@ -419,21 +420,16 @@ export class DockerProvider implements ComputeProvider {
         return {};
       }
 
-      // Recreate under the same name. Stop and remove first because the name is
-      // taken; if creating the replacement then fails, the row is left pointing
-      // at a removed container, which the existing MachineGoneError healing turns
-      // into a clean relaunch on the next request.
-      const name = (current.Name ?? '').replace(/^\//, '') || params.appId;
-      await dockerRequest('POST', `/containers/${encodeURIComponent(params.machineId)}/stop`).catch(
-        () => undefined
-      );
-      await dockerRequest(
-        'DELETE',
-        `/containers/${encodeURIComponent(params.machineId)}?force=true`
-      );
+      // Recreate using a Create-Before-Destroy (Staged Blue-Green) pattern.
+      // Launch the replacement container under a temporary staging identifier alongside
+      // the existing workload. If pulling the image, creating the container, or starting
+      // it fails, the original container is untouched and remains online serving live traffic.
+      const primaryName = (current.Name ?? '').replace(/^\//, '') || params.appId;
+      const stagingName = `${primaryName}-stage-${Date.now()}`;
 
       const launched = await this.launchMachine({
-        appId: name,
+        appId: stagingName,
+        serviceName: primaryName,
         image: params.image,
         port: params.port,
         cpu: params.cpu,
@@ -444,14 +440,36 @@ export class DockerProvider implements ComputeProvider {
         protocol: params.protocol,
         scaleToZero: params.scaleToZero,
       });
+
+      // Teardown superseded container once replacement is up and healthy.
+      await dockerRequest('POST', `/containers/${encodeURIComponent(params.machineId)}/stop`).catch(
+        () => undefined
+      );
+      await dockerRequest(
+        'DELETE',
+        `/containers/${encodeURIComponent(params.machineId)}?force=true`
+      ).catch(() => undefined);
+
+      // Atomic rename of staging container to primary application name.
+      await dockerRequest(
+        'POST',
+        `/containers/${encodeURIComponent(launched.machineId)}/rename?name=${encodeURIComponent(primaryName)}`
+      );
+
+      const endpointUrl = await this.resolvePublishedUrl(
+        launched.machineId,
+        params.port,
+        params.ingress
+      );
+
       logger.info('Docker compute: recreated container to apply a spec change', {
-        name,
+        name: primaryName,
         previous: params.machineId.slice(0, 12),
         replacement: launched.machineId.slice(0, 12),
       });
       // The replacement's published port is newly assigned, so the URL has to
       // travel with the new id.
-      return { machineId: launched.machineId, endpointUrl: launched.endpointUrl };
+      return { machineId: launched.machineId, endpointUrl };
     });
   }
 
```

**File**: `backend/tests/unit/compute/docker-provider.test.ts` (modified, +58/-15)
```diff
@@ -436,7 +436,7 @@ describe('DockerProvider', () => {
     // The bug this guards: Docker cannot swap a running container's image, so
     // applying only cpu/memory would report success while the old image keeps
     // serving and the database records the new one.
-    it('recreates the container when the image changes, and reports the new id', async () => {
+    it('recreates the container when the image changes using staged blue-green strategy, and reports the new id', async () => {
       const oldSpec = await hashFor(baseSpec);
       mockRequest
         .mockResolvedValueOnce(
@@ -452,10 +452,11 @@ describe('DockerProvider', () => {
             },
           })
         )
-        .mockResolvedValueOnce(undefined) // stop
-        .mockResolvedValueOnce(undefined) // remove
-        .mockResolvedValueOnce({ Id: 'container-new' }) // create
-        .mockResolvedValueOnce(undefined); // start
+        .mockResolvedValueOnce({ Id: 'container-new' }) // create staging
+        .mockResolvedValueOnce(undefined) // start staging
+        .mockResolvedValueOnce(undefined) // stop old
+        .mockResolvedValueOnce(undefined) // remove old
+        .mockResolvedValueOnce(undefined); // rename staging
       imageAlreadyPresent();
 
       const result = await provider.updateMachine({
@@ -466,15 +467,56 @@ describe('DockerProvider', () => {
 
       expect(result).toEqual({ machineId: 'container-new', endpointUrl: null });
       const paths = mockRequest.mock.calls.map((c) => `${c[0]} ${c[1]}`);
-      expect(paths).toEqual([
-        'GET /containers/container-abc/json',
-        'POST /containers/container-abc/stop',
-        'DELETE /containers/container-abc?force=true',
-        'POST /containers/create?name=insforge-testkey1-api',
-        'POST /containers/container-new/start',
-      ]);
-      // Replacement runs the requested image, under the original name.
-      expect(mockRequest.mock.calls[3][2].body.Image).toBe('nginx:1.27-alpine');
+      expect(paths[0]).toBe('GET /containers/container-abc/json');
+      expect(paths[1]).toMatch(/^POST \/containers\/create\?name=insforge-testkey1-api-stage-\d+$/);
+      expect(paths[2]).toBe('POST /containers/container-new/start');
+      expect(paths[3]).toBe('POST /containers/container-abc/stop');
+      expect(paths[4]).toBe('DELETE /containers/container-abc?force=true');
+      expect(paths[5]).toBe('POST /containers/container-new/rename?name=insforge-testkey1-api');
+
+      // Replacement runs requested image and carries logical service name.
+      expect(mockRequest.mock.calls[1][2].body.Image).toBe('nginx:1.27-alpine');
+      expect(mockRequest.mock.calls[1][2].body.Labels['insforge.service']).toBe(
+        'insforge-testkey1-api'
+      );
+    });
+
+    it('preserves old container untouched if staging launch fails (zero downtime)', async () => {
+      const oldSpec = await hashFor(baseSpec);
+      mockRequest
+        .mockResolvedValueOnce(
+          ownedContainer({
+            Name: '/insforge-testkey1-api',
+            Config: {
+              Image: 'nginx:alpine',
+              Labels: {
+                'insforge.managed': 'true',
+                'insforge.project': 'testkey1',
+                'insforge.spec': oldSpec,
+              },
+            },
+          })
+        )
+        .mockResolvedValueOnce({ Id: 'container-doomed' }) // create staging succeeds
+        .mockRejectedValueOnce(new Error('container entrypoint crashed')) // start staging fails
+        .mockResolvedValueOnce(undefined); // cleanup doomed staging container
+
+      imageAlreadyPresent();
+
+      await expect(
+        provider.updateMachine({
+          ...baseSpec,
+          machineId: 'container-abc',
+          image: 'nginx:1.27-alpine',
+        })
+      ).rejects.toThrow('container entrypoint crashed');
+
+      const paths = mockRequest.mock.calls.map((c) => `${c[0]} ${c[1]}`);
+      // Must NOT contain stop or delete for the old container-abc
+      expect(paths).not.toContain('POST /containers/container-abc/stop');
+      expect(paths).not.toContain('DELETE /containers/container-abc?force=true');
+      // Must clean up the broken staging container
+      expect(paths).toContain('DELETE /containers/container-doomed?force=true');
     });
 
     // Removing an env var is invisible if you only check that the requested ones
@@ -494,9 +536,10 @@ describe('DockerProvider', () => {
             },
           })
         )
+        .mockResolvedValueOnce({ Id: 'container-new' })
+        .mockResolvedValueOnce(undefined)
         .mockResolvedValueOnce(undefined)
         .mockResolvedValueOnce(undefined)
-        .mockResolvedValueOnce({ Id: 'container-new' })
         .mockResolvedValueOnce(undefined);
       imageAlreadyPresent();
 
```

#### Recent Merged Pull Requests:
- **PR #2091** (2026-10-01): fix(deployments): honor function regions for API deployments (@Fermionic-Lyu)
- **PR #2090** (2026-10-01): fix(docker): ship csv-parse and multer in the production image (@Fermionic-Lyu)
- **PR #2078** (2026-09-26): docs(readme): add ZopDay to the One-click Deployment table (@muskanbandta23)
- **PR #2076** (2026-09-26): BUG: Adopt staged blue-green strategy for container updates (@prakharsingh-74)
- **PR #2062** (2026-10-04): 2026-09-13 fix mintlify docs (@insforge-docs-bot[bot])
- **PR #2061** (2026-09-11): chore(deps): bump qs and body-parser (@dependabot[bot])
- **PR #2057** (2026-09-10): chore(deps): vitest 4.1.11, nodemailer 9.1.1, js-yaml 4.3.2 (@tonychang04)
- **PR #2052** (2026-09-08): Bump version to 2.3.2 (@agent-zhang-beihai[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
