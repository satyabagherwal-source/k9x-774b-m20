# Forensic Learning Record (Deep Inspection): devlikeapro/waha

> **Canonical Artifact**: `07_PROJECT_LEARNING/devlikeapro-waha-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/devlikeapro/waha](https://github.com/devlikeapro/waha))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:22:37.814Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `devlikeapro/waha`
- **Description**: WAHA - WhatsApp HTTP API (REST API) that you can configure in a click! Multiple engines: WEBJS (browser based), NOWEB (websocket nodejs), GOWS (websocket go), WPP (browser)
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 7553 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/api/websocket.gateway.core.ts`
```
import {
  BeforeApplicationShutdown,
  Logger,
  LoggerService,
} from '@nestjs/common';
import { sleep } from '@nestjs/terminus/dist/utils';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { SessionManager } from '@waha/core/abc/manager.abc';
import { WebSocketAuth } from '@waha/core/auth/WebSocketAuth';
import { WebsocketHeartbeatJob } from '@waha/nestjs/ws/WebsocketHeartbeatJob';
import { WebSocket } from '@waha/nestjs/ws/ws';
import { WAHAEvents, WAHAEventsWild } from '@waha/structures/enums.dto';
import { EventWildUnmask } from '@waha/utils/events';
import { generatePrefixedId } from '@waha/utils/ids';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import { Server } from 'ws';
import { CaslAbilityFactory } from '@waha/core/auth/casl.ability';
import { Action, session as SessionName } from '@waha/core/auth/casl.types';

export enum WebSocketCloseCode {
  NORMAL = 1000,
  GOING_AWAY = 1001,
  PROTOCOL_ERROR = 1002,
  UNSUPPORTED_DATA = 1003,
  POLICY_VIOLATION = 1008,
  INTERNAL_ERROR = 1011,
}

@WebSocketGateway({
  path: '/ws',
  cors: true,
})
export class WebsocketGatewayCore
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    BeforeApplicationShutdown
{
  HEARTBEAT_INTERVAL = 60_000;

  @WebSocketServer()
  server: Server;

  private readonly logger: LoggerService;
  private heartbeat: WebsocketHeartbeatJob;
  private eventUnmask = new EventWildUnmask(WAHAEvents, WAHAEventsWild);

  constructor(
    private manager: SessionManager,
    private auth: WebSocketAuth,
    private readonly casl: CaslAbilityFactory,
  ) {
    this.logger = new Logger('WebsocketGateway');
    this.heartbeat = new WebsocketHeartbeatJob(
      this.logger,
      this.HEARTBEAT_INTERVAL,
    );
  }

  async handleConnection(
    socket: WebSocket,
    request: IncomingMessage,
    ...args
  ): Promise<any> {
    // wsc - websocket client
    socket.id = generatePrefixedId('wsc');

    const user = await this.auth.validateRequest(request);
    if (!user) {
      // Not authorized - close connection
      socket.close(WebSocketCloseCode.POLICY_VIOLATION, 'Unauthorized');
      this.logger.debug(
        `Unauthorized websocket connection attempt: ${request.url} - ${socket.id}`,
      );
      return;
    }

    const params = this.getParams(request);
    let session: string = params.session;
    const ability = this.casl.createForUser(user);
    if (session == '*' && !ability.can(Action.Manage, 'all')) {
      // Limit user to listen only the session events
      session = user.session;
    }

    if (!ability.can(Action.Read, new SessionName(session))) {
      socket.close(WebSocketCloseCode.POLICY_VIOLATION, 'Forbidden');
      return;
    }

    this.logger.debug(`New client connected: ${request.url} - ${socket.id}`);
    const events = params.events as WAHAEvents[];
    this.logger.debug(
      `Client connected to session: '${session}', events: ${events}, ${socket.id}`,
    );

    const sub = this.manager
      .getSessionEvents(session, events)
      .subscribe((data) => {
        setImmediate(() => {
          this.logger.debug(
            `Sending data to client, event.id: ${data.id}`,
            data,
          );
          socket.send(JSON.stringify(data), (err) => {
            if (!err) {
              return;
            }
            this.logger.error(`Error sending data to client: ${err}`);
          });
        });
      });
    socket.on('close', () => {
      this.logger.debug(`Client disconnected - ${socket.id}`);
      sub.unsubscribe();
    });
  }

  private getParams(request: IncomingMessage) {
    // We need only search params, so localhost is fine here
    const query = new URL(request.url, 'http://localhost').searchParams;
    const session = query.get('session') || '*';
    const paramsEvents = query.getAll('events');
    const eventsRaw = paramsEvents.length > 0 ? paramsEvents : ['*'];
    const eventsList = eventsRaw.flatMap((value) => value.split(','));
    const result = this.eventUnmask.unmask(eventsList);
    if (result.unknown.length > 0) {
      this.logger.warn(
        `Ignoring unknown websocket events: ${result.unknown.join(', ')}`,
      );
    }
    return { session, events: result.events };
  }

  handleDisconnect(socket: WebSocket): any {
    this.logger.debug(`Client disconnected - ${socket.id}`);
  }

  async beforeApplicationShutdown(signal?: string) {
    this.logger.log('Shutting down websocket server');
    this.heartbeat?.stop();
    // Allow pending messages to be sent, it can be even 1ms, just to release the event loop
    await sleep(100);
    this.logger.log('Websocket server is down');
  }

  afterInit(server: Server) {
    this.logger.debug('Websocket server initialized');

    this.logger.debug('Starting heartbeat service...');
    this.heartbeat.start(server);
    this.logger.debug('Heartbeat service started');
  }
}

```

### Core Architecture Module: `src/apps/app_sdk/BullUtils.ts`
```
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { RegisterQueueOptions } from '@nestjs/bullmq/dist/interfaces/register-queue-options.interface';
import { DynamicModule } from '@nestjs/common';

/**
 * Registers a queue with both BullModule and BullBoardModule
 * This ensures that whenever a queue is registered, it's also added to the Bull Board
 *
 * @param options Queue options including name
 * @returns An array of dynamic modules for both BullModule and BullBoardModule
 */
export function RegisterAppQueue(
  options: RegisterQueueOptions,
): DynamicModule[] {
  return [
    BullModule.registerQueue({
      ...options,
    }),
    BullBoardModule.forFeature({
      name: options.name,
      adapter: BullMQAdapter,
    }),
  ];
}

```

### Core Architecture Module: `src/apps/app_sdk/JobUtils.ts`
```
import { Backoffs, Job } from 'bullmq';
import { FlowJob } from 'bullmq/dist/esm/interfaces';

/**
 * Calculates the delay until the next attempt for a job.
 *
 * @param job The job to calculate the next attempt delay for
 * @returns The delay in milliseconds, or null if there is no next attempt or backoff is not set
 */
export function NextAttemptDelayInMs(job: Job): number | null {
  const attemptsMade = job.attemptsMade + 1;
  const maxAttempts = job.opts?.attempts || 1;
  // If this is the last attempt, return null
  if (attemptsMade >= maxAttempts) {
    return null;
  }
  // Normalize the backoff options
  const backoff = Backoffs.normalize(job.opts.backoff);
  if (!backoff) {
    return null;
  }
  // Calculate the delay using Backoffs.calculate
  const delay = Backoffs.calculate(backoff, attemptsMade, new Error(), job);
  // The delay can be a Promise, a number, or undefined
  if (delay === undefined) {
    return null;
  }
  // If it's a Promise, we can't handle it synchronously, so return null
  if (delay instanceof Promise) {
    return null;
  }
  return delay;
}

export function NextAttemptDelayInWholeSeconds(job: Job) {
  const delay = NextAttemptDelayInMs(job);
  if (delay == null) {
    return null;
  }
  return Math.round(delay / 1000);
}

/**
 * Checks if a job has been retried (not on its first attempt).
 *
 * @param job The job to check
 * @returns True if the job has been retried (attemptsMade > 1), false otherwise
 */
export function HasBeenRetried(job: Job): boolean {
  const attemptsMade = job.attemptsMade + 1;
  return attemptsMade > 1;
}

/**
 * Hide chatwoot and waha from queue name for user faced messages
 */
export function QueueNameRepr(name: string): string {
  // No "chatwoot" in the name always (it start with chatwoot)
  name = name.replace('chatwoot.', '');
  // Replace "waha" with "whatsapp"
  name = name.replace('waha |', 'whatsapp |');
  return name;
}

let base =
  process.env.WAHA_PUBLIC_URL ||
  process.env.WAHA_BASE_URL ||
  'http://localhost:3000';
// cut / at the end
base = base.replace(/\/+$/, '');

export function JobLink(job: Job): { text: string; url: string } {
  // Use repr name for text
  const name = QueueNameRepr(job.queueName);
  const text = `${name} => ${job.id}`;
  // Use original queue name in the URL
  const queue = encodeURIComponent(job.queueName);
  const id = encodeURIComponent(job.id);
  const url = `${base}/jobs/queue/${queue}/${id}`;
  return { text: text, url: url };
}

/**
 * Chain jobs so that they run one at a time
 * A | B | C
 * to
 * A -> B -> C
 */
export function ChainJobsOneAtATime(jobs: FlowJob[]): FlowJob {
  if (jobs.length == 0) {
    throw new Error('No jobs provided');
  }

  for (const job of jobs) {
    if (job.children.length != 0) {
      throw new Error('Jobs with children are not supported');
    }
  }
  const left = [...jobs];
  const root = left.pop();
  let parent = root;
  while (left.length != 0) {
    const job = left.pop();
    parent.children = [job];
    parent = job;
  }
  return root;
}

```

### Core Architecture Module: `src/apps/chatwoot/api/chatwoot.webhook.controller.ts`
```
import {
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { IsCommandsChat } from '@waha/apps/chatwoot/client/ids';
import { EventName, MessageType } from '@waha/apps/chatwoot/client/types';
import { InboxData } from '@waha/apps/chatwoot/consumers/types';
import { ChatWootQueueService } from '@waha/apps/chatwoot/services/ChatWootQueueService';
import { SessionManager } from '@waha/core/abc/manager.abc';
import { AppRepository } from '@waha/apps/app_sdk/storage/AppRepository';
import { CommandPrefix } from '@waha/apps/chatwoot/cli';
import { IsExternalEcho } from '@waha/apps/chatwoot/api/webhook.guards';

@Controller('webhooks/chatwoot/')
export class ChatwootWebhookController {
  constructor(
    private readonly chatWootQueueService: ChatWootQueueService,
    private readonly manager: SessionManager,
  ) {}

  @Post(':session/:id')
  @ApiOperation({
    summary: 'Chatwoot Webhook',
    description: 'Chatwoot Webhook',
  })
  async webhook(
    @Param('session') session: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    if (!body || !body?.event) {
      return { success: true };
    }

    // Ignore all incoming messages
    if (body.message_type == MessageType.INCOMING) {
      return { success: true };
    }

    const isCommandsChat = IsCommandsChat(body);
    const deleted = body?.content_attributes?.deleted;
    // Ignore messages that came from WhatsApp, do not send them back
    if (IsExternalEcho(body) && !deleted) {
      return { success: true };
    }

    // Ignore private notes (most of them)
    if (body.private) {
      // Ignore any private note in commands chats
      if (isCommandsChat) {
        return { success: true };
      }
      // keep "deleted" notes
      // So Agent can delete "Sent From API/WhatsApp" messages in ChatWoot
      if (!deleted) {
        return { success: true };
      }
    }

    const data: InboxData = {
      session: session,
      app: id,
      body: body,
    };

    // Skip if app is disabled or does not exist
    const knex = this.manager.store.getWAHADatabase();
    const repo = new AppRepository(knex);
    const app = await repo.findEnabledAppById(id);
    if (!app || app.session !== session) {
      throw new NotFoundException(`App '${id}' not found`);
    }

    // Check if it's a command message (sent to the special inbox contact)
    // Check if it's a deleted message
    if (deleted && !isCommandsChat) {
      await this.chatWootQueueService.addMessageDeletedJob(data);
      return { success: true };
    }

    // Route to specific queues based on an event type
    switch (body.event) {
      case EventName.MESSAGE_CREATED:
        if (isCommandsChat || body.content?.startsWith(CommandPrefix)) {
          await this.chatWootQueueService.addCommandsJob(body.event, data);
        } else {
          await this.chatWootQueueService.addMessageCreatedJob(data);
        }
        return { success: true };
      case EventName.MESSAGE_UPDATED:
        // We handle only "retries" on message_update
        // This is the attribute ChatWoot send
        // There's NO other way to identify "status: read" updates right now
        // There's no "body.status" in message_updated webhook :(
        const isRetryNull = body.content_attributes?.external_error === null;
        const isRetrySomething = Boolean(
          body.content_attributes?.external_error,
        );
        const isRetry = isRetryNull || isRetrySomething;
        if (!isRetry) {
          return { success: true };
        }

        if (isCommandsChat || body.content?.startsWith(CommandPrefix)) {
          await this.chatWootQueueService.addCommandsJob(body.event, data);
        } else {
          await this.chatWootQueueService.addMessageUpdatedJob(data);
        }
        return { success: true };
      default:
        // Ignore other events
        await this.chatWootQueueService.addJobToQueue(body.event, data);
        return { success: true };
    }
  }
}

```

### Core Architecture Module: `src/apps/chatwoot/api/webhook.guards.ts`
```
import { conversation_message_create } from '@figuro/chatwoot-sdk';

/**
 * Mark a message WAHA creates from a WhatsApp message, so the webhook does not send it back
 */
export function SetExternalEcho(body: conversation_message_create) {
  body.content_attributes = { ...body.content_attributes, external_echo: true };
}

/**
 * Message was created by WAHA from a WhatsApp message, not by an agent
 */
export function IsExternalEcho(body: any): boolean {
  return Boolean(body?.content_attributes?.external_echo);
}

```

### Core Architecture Module: `src/apps/chatwoot/cli/cmd.queue.ts`
```
import * as lodash from 'lodash';
import { QueueManager } from '@waha/apps/chatwoot/services/QueueManager';
import { Locale } from '@waha/apps/chatwoot/i18n/locale';
import { Conversation } from '@waha/apps/chatwoot/client/Conversation';
import { QueueRegistry } from '@waha/apps/chatwoot/services/QueueRegistry';
import { QueueNameRepr } from '@waha/apps/app_sdk/JobUtils';

export interface QueueCommandContext {
  queues: {
    registry: QueueRegistry;
  };
  l: Locale;
  conversation: Conversation;
}

export async function QueueStatus(ctx: QueueCommandContext, name: string) {
  const manager = new QueueManager(ctx.queues.registry);
  const names = manager.resolve(name);
  let result = await manager.status(names);
  for (const status of result) {
    status.name = QueueNameRepr(status.name);
  }
  const categoryOrder = ['inbox', 'whatsapp', 'task', 'scheduled'];
  const categoryIndex = (name: string) => {
    const category = name.split(' | ')[0];
    const index = categoryOrder.indexOf(category);
    return index === -1 ? categoryOrder.length : index;
  };
  // locked: true - last, then by category (inbox/whatsapp/task/scheduled), then by name
  result = lodash.sortBy(result, [
    (x) => !!x.locked,
    (x) => categoryIndex(x.name),
    'name',
  ]);
  const msg = ctx.l.r('cli.cmd.queue.status.result', {
    queues: result,
  });
  await ctx.conversation.incoming(msg);
}

export async function QueueStart(ctx: QueueCommandContext, name: string) {
  const manager = new QueueManager(ctx.queues.registry);
  const names = manager.resolve(name);
  await manager.resume(names);
  const msg = ctx.l.r('cli.cmd.queue.resumed');
  await ctx.conversation.activity(msg);
}

export async function QueueStop(ctx: QueueCommandContext, name?: string) {
  const manager = new QueueManager(ctx.queues.registry);
  const names = manager.resolve(name);
  await manager.pause(names);
  const msg = ctx.l.r('cli.cmd.queue.paused');
  await ctx.conversation.activity(msg);
}

```

### Core Architecture Module: `src/apps/chatwoot/cli/program.queue.ts`
```
import { Argument, Command } from 'commander';
import { CommandContext } from '@waha/apps/chatwoot/cli/types';
import { CommandDisabled } from '@waha/apps/chatwoot/cli/cmd.disabled';
import {
  QueueStart,
  QueueStatus,
  QueueStop,
} from '@waha/apps/chatwoot/cli/cmd.queue';

export function AddQueueCommand(
  program: Command,
  ctx: CommandContext,
  enabled: boolean,
) {
  const l = ctx.l;
  const QueueGroup = l.r('cli.cmd.root.sub.queue');
  program.commandsGroup(QueueGroup);

  program
    .command('queue', { hidden: !enabled })
    .alias('q')
    .summary(l.r('cli.cmd.queue.summary'))
    .description(l.r('cli.cmd.queue.description'))
    .helpGroup(QueueGroup)
    .addArgument(
      new Argument('[action]', l.r('cli.cmd.queue.action.description'))
        .choices(['status', 'start', 'stop', 'help'])
        .default('help'),
    )
    .addArgument(
      new Argument('[name]', l.r('cli.cmd.queue.argument.name')).default(''),
    )
    .action(async function (this: Command, action: string, name: string) {
      if (!action) {
        this.outputHelp();
        return;
      }

      if (action === 'help') {
        this.outputHelp();
        return;
      }

      if (!enabled) {
        await CommandDisabled(ctx, 'queue');
        return;
      }

      if (action === 'status') {
        await QueueStatus(ctx, name);
        return;
      }

      if (action === 'start') {
        await QueueStart(ctx, name);
        return;
      }

      if (action === 'stop') {
        await QueueStop(ctx, name);
        return;
      }

      this.outputHelp();
    });
}

```

### Core Architecture Module: `src/apps/chatwoot/cli/utils/BufferedOutput.ts`
```
import { OutputConfiguration } from 'commander';

export class BufferedOutput implements OutputConfiguration {
  private outBuffer: string[] = [];
  private errBuffer: string[] = [];

  writeOut = (str: string): void => {
    this.outBuffer.push(str);
  };

  writeErr = (str: string): void => {
    this.errBuffer.push(str);
  };

  outputError = (str: string, write: (s: string) => void) => {
    this.errBuffer.push(str);
  };

  get out() {
    return this.outBuffer.join('');
  }

  get err() {
    return this.errBuffer.join('');
  }
}

```

### Core Architecture Module: `src/apps/chatwoot/cli/utils/help.ts`
```
import { Command, Help, Option } from 'commander';
import { Locale } from '@waha/apps/chatwoot/i18n/locale';

export function fullCommandPath(sub: Command): string {
  const parts: string[] = [];
  let cmd: Command | null = sub;
  // collect names up to (but not including) the root program
  const name = cmd.name();
  if (name) parts.push(name);
  while (cmd && cmd.parent) {
    cmd = cmd.parent!;
    const name = cmd.name();
    if (name && name != 'program') parts.push(name);
  }
  return parts.reverse().join(' ');
}

export function buildFormatHelp(l: Locale) {
  /**
   * Commands first, then Arguments, then Options
   * @param cmd
   * @param helper
   */

  return function formatHelp(this: Help, cmd: Command, helper: Help) {
    const termWidth = helper.padWidth(cmd, helper);
    const helpWidth = helper.helpWidth ?? 80;

    const callFormatItem = (term: string, description: string) =>
      helper.formatItem(term, termWidth, description, helper);
    let output: string[] = [];

    const commandDescription = helper.commandDescription(cmd);
    if (commandDescription.length > 0) {
      output = output.concat([
        helper.boxWrap(
          helper.styleCommandDescription(commandDescription),
          helpWidth,
        ),
        '',
      ]);
    }

    const usage = helper.commandUsage(cmd);
    if (usage) {
      output.push(
        `${
          helper.styleTitle(l.r('cli.help.usage.title')) + '\n'
        } ${helper.styleUsage(helper.commandUsage(cmd))}`,
      );
      output.push('');
    }

    const commandGroups = this.groupItems(
      cmd.commands as Command[],
      helper.visibleCommands(cmd),
      (sub) => sub.helpGroup() || l.r('cli.help.commands.defaultGroup'),
    );
    commandGroups.forEach((commands, group) => {
      if (!commands.length) {
        return;
      }

      const commandLines = commands.map((sub) => {
        const commandTerm = helper.styleSubcommandTerm(
          helper.subcommandTerm(sub),
        );
        const description = helper.subcommandDescription(sub);
        const styledDescription = description
          ? helper.styleSubcommandDescription(description)
          : '';
        return `${commandTerm} ${styledDescription}`;
      });

      output.push(helper.styleTitle(group));
      output.push(...commandLines);
      output.push('');
    });

    const argumentList = helper
      .visibleArguments(cmd)
      .map((argument) =>
        callFormatItem(
          helper.styleArgumentTerm(helper.argumentTerm(argument)),
          helper.styleArgumentDescription(helper.argumentDescription(argument)),
        ),
      );
    output = output.concat(
      this.formatItemList(
        l.r('cli.help.arguments.title'),
        argumentList,
        helper,
      ),
    );

    const optionGroups = this.groupItems(
      cmd.options as Option[],
      helper.visibleOptions(cmd),
      (option) =>
        option.helpGroupHeading ?? l.r('cli.help.options.defaultGroup'),
    );
    optionGroups.forEach((options, group) => {
      const optionList = options.map((option) =>
        callFormatItem(
          helper.styleOptionTerm(helper.optionTerm(option)),
          helper.styleOptionDescription(helper.optionDescription(option)),
        ),
      );
      output = output.concat(this.formatItemList(group, optionList, helper));
    });

    if (helper.showGlobalOptions) {
      const globalOptionList = helper
        .visibleGlobalOptions(cmd)
        .map((option) =>
          callFormatItem(
            helper.styleOptionTerm(helper.optionTerm(option)),
            helper.styleOptionDescription(helper.optionDescription(option)),
          ),
        );
      output = output.concat(
        this.formatItemList(
          l.r('cli.help.globalOptions.title'),
          globalOptionList,
          helper,
        ),
      );
    }

    return output.join('\n');
  };
}

```

### Core Architecture Module: `src/apps/chatwoot/cli/utils/options.ts`
```
import * as ms from 'ms';
import { Option } from 'commander';
import { Locale } from '@waha/apps/chatwoot/i18n/locale';

/**
 * Parse human string into milliseconds
 */
export function ParseMS(value: string) {
  const duration = ms(value as ms.StringValue);
  if (duration == null) throw new Error(`Invalid duration: "${value}"`);
  if (duration < 0) throw new Error(`Duration cannot be negative: "${value}"`);
  return duration;
}

export function ParseSeconds(value: string): number {
  const duration = ParseMS(value);
  return Math.floor(duration / 1000);
}

export class JobAttemptsOption extends Option {
  constructor(l: Locale, def: number) {
    super('--at, --attempts <number>', l.r('cli.cmd.options.job.attempts'));
    this.argParser(NotNegativeNumber);
    this.default(def);
  }
}

export class JobTimeoutOption extends Option {
  constructor(l: Locale, def: string) {
    super('-t, --timeout <duration>', l.r('cli.cmd.options.job.timeout'));
    this.argParser(ParseMS);
    this.default(ParseMS(def));
  }
}

export function ProgressOption(
  description: string,
  def: number = 1000,
): Option {
  return new Option('-p, --progress [number]', description)
    .argParser(NotNegativeNumber)
    .default(def);
}

export function NotNegativeNumber(value: string): number {
  const n = parseInt(value, 10);
  if (isNaN(n)) {
    throw new Error(`Invalid number: "${value}"`);
  }
  if (n < 0) {
    throw new Error(`Number must be positive or 0: "${value}"`);
  }
  return n;
}

export function PositiveNumber(value: string): number {
  const n = parseInt(value, 10);
  if (isNaN(n)) {
    throw new Error(`Invalid number: "${value}"`);
  }
  if (n <= 0) {
    throw new Error(`Number must be positive: "${value}"`);
  }
  return n;
}

```

### Core Architecture Module: `src/apps/chatwoot/consumers/QueueName.ts`
```
export enum QueueName {
  //
  // Scheduled
  //
  SCHEDULED_MESSAGE_CLEANUP = 'chatwoot.scheduled | message.cleanup',
  SCHEDULED_CHECK_VERSION = 'chatwoot.scheduled | check.version',
  SCHEDULED_CHECK_TIER = 'chatwoot.scheduled | check.tier',

  //
  // Task
  //
  TASK_CONTACTS_PULL = 'chatwoot.task | contacts.pull',
  TASK_MESSAGES_PULL = 'chatwoot.task | messages.pull',

  //
  // WAHA Events
  //
  WAHA_SESSION_STATUS = 'chatwoot.waha | session.status',
  WAHA_MESSAGE_ANY = 'chatwoot.waha | message.any',
  WAHA_MESSAGE_REACTION = 'chatwoot.waha | message.reaction',
  WAHA_MESSAGE_EDITED = 'chatwoot.waha | message.edited',
  WAHA_MESSAGE_REVOKED = 'chatwoot.waha | message.revoked',
  WAHA_MESSAGE_ACK = 'chatwoot.waha | message.ack',
  WAHA_CALL_RECEIVED = 'chatwoot.waha | call.received',
  WAHA_CALL_ACCEPTED = 'chatwoot.waha | call.accepted',
  WAHA_CALL_REJECTED = 'chatwoot.waha | call.rejected',
  //
  // ChatWoot Events - Real
  //
  INBOX_MESSAGE_CREATED = 'chatwoot.inbox | message_created',
  INBOX_MESSAGE_UPDATED = 'chatwoot.inbox | message_updated',
  INBOX_CONVERSATION_CREATED = 'chatwoot.inbox | conversation_created',
  INBOX_CONVERSATION_STATUS_CHANGED = 'chatwoot.inbox | conversation_status_changed',
  //
  // ChatWoot Events - Artificial
  //
  INBOX_MESSAGE_DELETED = 'chatwoot.inbox | message_deleted',
  INBOX_COMMANDS = 'chatwoot.inbox | commands',
}

export enum FlowProducerName {
  MESSAGES_PULL_FLOW = 'messages.pull.flow',
}

```

### Core Architecture Module: `src/apps/chatwoot/consumers/utils.ts`
```
export function clearContent(attachments) {
  /**
   * Remove actual base64 "content" from attachment
   */
  if (!attachments) {
    return attachments;
  }
  return attachments.map((attachment) => {
    attachment = { ...attachment };
    attachment.content = '';
    return attachment;
  });
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2278** (2026-10-02): **[WEBJS] forwardMessage 500: Cannot read properties of undefined (reading 'forwardMessages') — needs WAWebForwardMessageFlowLoadable**
  *Symptoms*: ### Describe the bug  `POST /api/forwardMessage` on **WEBJS** fails with HTTP 500:  ```text TypeError: Cannot read properties of undefined (reading 'forwardMessages') ```  Stack points to injected `window.WWebJS.forwardMessage` → `window.require('WAWebChatForwardMessage').forwardMessages(...)`.  This is **not** a bad request payload issue: session is `WORKING`, destination `@lid` chat works with `sendText`, and the source `messageId` exists. A control forward of a recent text message to the same chat fails with the **same** error in a few milliseconds.  ### Root cause  On current WhatsApp Web (`2.3000.x`), `WAWebChatForwardMessage` is **no longer preloaded**. It lives in an on-demand loadable bundle.  - `window.require('WAWebChatForwardMessage')` returns `undefined` until the bundle is loaded. - The older lazy-load name `WAWebForwardMessageModalLoadable` (see wwebjs#3972) **hangs** / does not expose the module on current WWeb. - The working bundle name is **`WAWebForwardMessageFlowLoadable`** (`requireBundle()`), then `WAWebChatForwardMessage.forwardMessages` becomes available.  Same underlying issue was fixed in: - https://github.com/leettech/whatsapp-web.js/pull/9 - https://github.com/wppconnect-team/wa-js/pull/3582  Related older WAHA issue (different error `reading 'contact'`): #1546 (fixed in `2025.11.1`).   `2026.9.1` changelog fixes WEBJS media / presence / group invite, but **does not mention forward**.  ### Version  ```json {   "version": "2026.8.2",   "engine": "WEB

- **Issue #2277** (2026-09-24): **[WEBJS] - /api/sendImage fails with "Data passed to getter must include an id property ... but got undefined"**
  *Symptoms*: ### Describe the bug  Sending an image via `POST /api/sendImage` fails with a 500 error.  The failure happens inside the WEBJS engine while evaluating `window.WWebJS.sendMessage` against WhatsApp Web. WhatsApp Web throws:  `Data passed to getter must include an id property (it's how we memoize) but got undefined`  ### Version  ```json {   "version": "2026.7.1",   "engine": "WEBJS",   "tier": "PLUS",   "browser": "Chrome",   "platform": "linux/x64" } ```  ## Steps  **To Reproduce** Steps to reproduce the behavior:  1. Run WAHA with engine `WEBJS`. 2. Start and authenticate a session (QR pairing), state `WORKING`. 3. Send a `POST /api/sendImage` request to a channel chat (`…@newsletter`):  ```json {   "session": "***",   "chatId": "***@newsletter",   "file": {     "mimetype": "image/jpeg",     "filename": "filename.jpg",     "url": "https://***"   },   "caption": "string" } ```  4. Observe the 500 response / log error below.  ### Error Response / Log  ```text [15:15:21.698] INFO (48): request errored {"reqId":260,"req":{"id":260,"method":"POST","url":"/api/sendImage","query":{},"params":{"path":["api","sendImage"]}},"res":{"statusCode":500},"responseTime":1495}     err: {       "type": "Error",       "message": "Data passed to getter must include an id property (it's how we memoize) but got undefined\ns (https://static.whatsapp.net/rsrc.php/v4/y8/r/utfPCwANvyO.js:85:180)",       "stack":           Error: Data passed to getter must include an id property (it's how we memoize) bu
  **Post-Mortem & Fix Analysis**:
  > @devlikepro Hi, can you estimate how long it will take to solve the problem? We've been using WAHA for quite a long time and have some problems with ours customers right now. Looking forward to a good solution as always, thanks :)
  > Topic is urgent for me as well
  > You need to update WAHA; the issue has been fixed in the latest version.  [![patron:PRO](https://img.shields.io/badge/patron-PRO-188a42)](https://waha.devlike.pro/docs/how-to/plus-version/#tiers)

- **Issue #2271** (2026-09-22): **[WEBJS] - Data passed to getter must include an id property (it's how we memoize) but got undefined**
  *Symptoms*: ### Describe the bug  A clear and concise description of what the bug is. Feel free to remove sections that you don't feel to make the text shorter!  ### Version  Get the WAHA version by calling `GET /api/version`  ```json { "version":"2026.8.2", "engine":"WEBJS", "tier":"PLUS","browser":"/usr/bin/google-chrome", "platform":"linux/x64", "worker":  {"id":null} } ```  Try to update to [the latest version](https://github.com/devlikeapro/waha/releases) before creating an issue!  ## Steps  **To Reproduce** Steps to reproduce the behavior:  Send messages  **Error message** ```json "stack\\\":\\\"Error: Data passed to getter must include an id property (it's how we memoize) but got undefined\\ns (https://static.whatsapp.net/rsrc.php/v4/ys/r/cmqMr-wgNWt.js:84:180)\\n    at #evaluate (/app/node_modules/puppeteer-core/lib/cjs/puppeteer/cdp/ExecutionContext.js:391:56)\\n    at async ExecutionContext.evaluate (/app/node_modules/puppeteer-core/lib/cjs/puppeteer/cdp/ExecutionContext.js:277:16)\\n    at async IsolatedWorld.evaluate (/app/node_modules/puppeteer-core/lib/cjs/puppeteer/cdp/IsolatedWorld.js:100:16)\\n    at async CdpFrame.evaluate (/app/node_modules/puppeteer-core/lib/cjs/puppeteer/api/Frame.js:362:20)\\n    at async CdpPage.evaluate (/app/node_modules/puppeteer-core/lib/cjs/puppeteer/api/Page.js:818:20)\\n    at async WPage.evaluate (/app/dist/core/engines/webjs/WPage.js:13:20)\\n    at async WebjsClientCore.sendMessage (/app/node_modules/whatsapp-web.js/src/Client.js:1831:25)
  **Post-Mortem & Fix Analysis**:
  > i had the same issue when use sendFile api  "message": "Data passed to getter must include an id property (it's how we memoize) but got undefined\ns (https://static.whatsapp.net/rsrc.php/v4/ys/r/cmqMr-wgNWt.js:84:180)"
  > I was using it inside an n8n build in Docker Compose, and i am having the same issue when using the SendFile API.  500 - "{\"statusCode\":500,\"timestamp\":\"2026-09-18T12:12:40.919Z\",\"exception\":{\"message\":\"Data passed to getter must include an id property (it's how we memoize) but got undefined\\ns (https://static.whatsapp.net/rsrc.php/v4/yL/r/6-eerGMZKhM.js:84:180)
  > The bug seems to be fixed on the web.js side: https://github.com/wwebjs/whatsapp-web.js/issues/201922. @devlikepro, can we get a hotfix for this?

- **Issue #2269** (2026-09-17): **[WEBJS] - Dashboard sends WHATSAPP_SWAGGER_USERNAME as x-api-key header instead of WAHA_API_KEY**
  *Symptoms*: Environment  WAHA version: 2026.8.2 Engine: WEBJS Tier: CORE Platform: linux/x64 Installed via: Docker (devlikeapro/waha)  Description  When WAHA_API_KEY and WHATSAPP_SWAGGER_USERNAME are both configured, the dashboard sends the value of WHATSAPP_SWAGGER_USERNAME as the x-api-key request header instead of WAHA_API_KEY. This causes all dashboard API requests to return 401 Unauthorized.  Steps to Reproduce  Run WAHA Core with the following environment variables set: WAHA_API_KEY=<some_key> WHATSAPP_SWAGGER_USERNAME=admin WHATSAPP_SWAGGER_PASSWORD=<some_password> Open the dashboard in a browser Complete Basic Auth login with WHATSAPP_SWAGGER_USERNAME / WHATSAPP_SWAGGER_PASSWORD Open browser DevTools → Network tab Inspect the request headers of any API call made by the dashboard (e.g. GET /api/sessions)  Expected Behavior  The dashboard should send the value of WAHA_API_KEY in the x-api-key header.  Actual Behavior  The x-api-key header contains the value of WHATSAPP_SWAGGER_USERNAME instead of WAHA_API_KEY:  x-api-key: admin  This causes all dashboard requests to return 401 Unauthorized when WAHA_API_KEY !== WHATSAPP_SWAGGER_USERNAME.  Workaround  Set WAHA_API_KEY to the same value as WHATSAPP_SWAGGER_USERNAME:  WAHA_API_KEY=admin WHATSAPP_SWAGGER_USERNAME=admin  This is obviously not ideal from a security standpoint, as it forces the API key to be a predictable value.  Additional Notes  The API itself works correctly — requests made directly with curl using the proper X-Api-Key
  **Post-Mortem & Fix Analysis**:
  > https://waha.devlike.pro/docs/how-to/dashboard/#api-key  [![patron:PRO](https://img.shields.io/badge/patron-PRO-188a42)](https://waha.devlike.pro/docs/how-to/plus-version/#tiers)
  > "After reading the docs more carefully, I realized the issue was on my end. The correct environment variables are WAHA_DASHBOARD_USERNAME / WAHA_DASHBOARD_PASSWORD (not WHATSAPP_SWAGGER_*), and the API key needs to be entered manually in the dashboard UI. The dashboard was sending the username as the API key because no key was configured in the UI. Closing as user error — leaving this open for others who might hit the same confusion."

- **Issue #2266** (2026-09-22): **[WEBJS] - POST /api/{session}/groups/join fails with joinGroupViaInvite is undefined**
  *Symptoms*: ### Describe the bug  Joining a WhatsApp group using the documented endpoint fails with HTTP 500 on the WEBJS engine.  The invite code is valid because `groups/join-info` successfully returns the group information, but `groups/join` fails inside whatsapp-web.js.  The issue reproduces on both WAHA 2026.7.1 and 2026.8.2.  ### Version  Get the WAHA version by calling `GET /api/version`  ```json {     "version": "2026.8.2",     "engine": "WEBJS",     "tier": "CORE",     "browser": "/usr/bin/chromium",     "platform": "linux/x64",     "worker": {         "id": null     } } ```  Try to update to [the latest version](https://github.com/devlikeapro/waha/releases) before creating an issue!  ## Steps  **To Reproduce** Steps to reproduce the behavior: 1. Start an authenticated WEBJS session. 2. Obtain a valid WhatsApp group invite link. 3. Verify the invite:     GET /api/{session}/groups/join-info?code=REDACTED  4. The endpoint returns HTTP 200 with valid group information. 5. Attempt to join:     POST /api/{session}/groups/join  The endpoint returns HTTP 500:  Cannot read properties of undefined (reading 'joinGroupViaInvite')  ### Expected behavior  The account should join the group, or a membership approval request should be created when admin approval is enabled  ### Docker Logs  {   "level": 30,   "req": {     "method": "GET",     "url": "/api/{session}/groups/join-info?code=<REDACTED_INVITE_CODE>",     "query": {       "code": "<REDACTED_INVITE_CODE>"     }   },   "res": {     "sta
  **Post-Mortem & Fix Analysis**:
  > It seems the problem is in whatsapp-web.js
  > **Let's try dev image** 🤞🏻  Make sure to select the [**engine**](https://waha.devlike.pro/docs/how-to/engines/) via the environment variable - `WHATSAPP_DEFAULT_ENGINE=WEBJS|GOWS|NOWEB`:  -   `devlikeapro/waha:dev` -   `devlikeapro/waha:dev-chrome` -   `devlikeapro/waha:dev-arm`  🚀 Will be included in the next release!  [![patron:PRO](https://img.shields.io/badge/patron-PRO-188a42)](https://waha.devlike.pro/docs/how-to/plus-version/#tiers)

- **Issue #2246** (2026-09-01): **[GOWS][Chatwoot] #2208 still not fixed in 2026.8.1 – duplicate contact created for same LID without phone number**
  *Symptoms*: ### Related issue  This is a continuation of #2208.  The issue was closed after the fixes released in `2026.8.1`, but unfortunately the original problem is still happening with GOWS + the native Chatwoot integration.  I am currently working around the issue manually, and while doing this I discovered another consequence when the customer already exists in Chatwoot.  ### The original #2208 problem is still happening  Incoming messages are still creating Chatwoot contacts using only the LID, without the correct phone number being passed/resolved by the native integration.  For example, an incoming message creates a contact using:  ```text id="qg61xk" 7876986835002@lid ```  But if I manually query WAHA for exactly the same LID, WAHA correctly resolves it:  ```json id="mlw16a" [   {     "lid": "7876986835002@lid",     "pn": "5511986435945@c.us"   } ] ```  So WAHA knows:  ```text id="q5w0ox" 7876986835002@lid         ↓ 5511986435945@c.us ```  However, this phone number is still not being correctly passed/used by the native Chatwoot integration.  This means the original issue reported in #2208 does not appear to be fully fixed.  ### When the customer does NOT already exist in Chatwoot  If this is a new customer and there is no existing Chatwoot contact with that phone number, I can work around the problem manually.  I resolve the LID using WAHA:  ```text id="5l1qfn" 7876986835002@lid → 5511986435945@c.us ```  and then manually update the Chatwoot contact with:  ```text id="b6rkp6" 
  **Post-Mortem & Fix Analysis**:
  > `2026.8.2` - match existing contacts by resolved phone number for `@lid` chats and backfill missing `phone_number` - [#2208](https://github.com/devlikeapro/waha/issues/2208)  [![patron:PRO](https://img.shields.io/badge/patron-PRO-188a42)](https://waha.devlike.pro/docs/how-to/plus-version/#tiers)

- **Issue #2241** (2026-09-01): **[GOWS][Chatwoot] - 2026.8.1 maps mirrored fromMe messages to the wrong contact/conversation**
  *Symptoms*: ### Describe the bug  After upgrading WAHA GOWS from `2026.7.1` to `2026.8.1`, outgoing messages sent directly from the linked WhatsApp mobile/desktop client to different 1:1 contacts were mirrored into Chatwoot under the same incorrect contact/conversation.  Incoming replies continued to arrive under their own contact conversations. WhatsApp itself displayed the recipients and history correctly; the incorrect association occurred in the WAHA-to-Chatwoot synchronization.  **This affected an existing production integration that had been working correctly on `2026.7.1`. The impact was immediate on ongoing conversations and created a data-integrity/privacy risk, so we could not keep `2026.8.1` deployed. We had to perform an emergency rollback to `2026.7.1`. Without changing configuration or session data, the rollback restored correct conversation routing.**  ### Version  ```json {   "version": "2026.8.1",   "engine": "GOWS",   "tier": "CORE" } ```  - Regressing image: `devlikeapro/waha:gows-2026.8.1` - Regressing manifest: `sha256:853dfeda32bb46f07423b61e562b164b503f242d3fa21aeb8e67e2c42b2087d5` - Known-good image after rollback: `devlikeapro/waha:gows-2026.7.1` - Known-good manifest: `sha256:8f3a7b11310594b973a588b2f7de061864c83532ae2cdff43280db0402bead29` - Deployment: Docker Swarm - Chatwoot-compatible application: v4.20.0 - Existing authenticated session and persistent volumes were preserved.  ### Steps to reproduce  1. Run an authenticated GOWS session on `2026.7.1` with th
  **Post-Mortem & Fix Analysis**:
  > `2026.8.2` - **GOWS** - `fromMe` messages mirrored to the wrong contact/conversation - [#2241](https://github.com/devlikeapro/waha/issues/2241)  [![patron:PRO](https://img.shields.io/badge/patron-PRO-188a42)](https://waha.devlike.pro/docs/how-to/plus-version/#tiers)
  > Please reopen #2241: the same user-visible routing failure occurs with GOWS 2026.8.2 in our existing Chatwoot-compatible integration.  We upgraded from 2026.7.1 to 2026.8.2 on September 10 after the release notes declared this fixed. On September 16 a user reported native WhatsApp outgoing messages to different recipients appearing in one incorrect conversation, while incoming replies appeared separately.  Read-only database checks show the problem is not confined to the reporting account. For mirrored outgoing AgentBot messages during comparable six-day windows before/after the deployment:  | Anonymized inbox | Before: messages / distinct conversations | After: messages / distinct conversations | After: messages assigned to own-number contact | | --- | --- | --- | --- | | A | 472 / 87 | 555 / 1 | 555 | | B | 117 / 15 | 98 / 1 | 98 | | C | 2 / 2 | 3 / 1 | 3 |  Inbox C has too little traffic to establish misrouting independently. Inbox B shows a strong matching pattern, although we have
  > @devlikepro, could you please review our September 16 follow-up above? We reproduced the wrong-conversation routing with GOWS 2026.8.2 in our Chatwoot-compatible native webhook integration and rolled back to 2026.7.1. Issue #2241 is still closed, and the 2026.9.1 release notes do not mention a fix for this recurrence.  Could you confirm whether 2026.9.1 changes the recipient identity fields for native-client `fromMe` events, or advise which sanitized fields you need to distinguish a GOWS event issue from our webhook consumer's normalization? We can provide an anonymized field comparison. We are holding the update until this routing behavior can be verified safely. Thank you.

- **Issue #2239** (2026-09-22): **[NOWEB] - Some webp files fail to download or display correctly.**
  *Symptoms*: ```  {     "id": "evt_01m0xx31cj9qweg9zxaf51mbp9",     "timestamp": 1787709982098,     "event": "message.any",     "session": "036322",     "metadata": {},     "me": {       "id": "xxx@c.us",       "pushName": "leo",       "lid": "172078351257794@lid",       "reachoutTimelock": null,       "messageCapping": {         "cappingStatus": "NONE",         "totalQuota": 0,         "usedQuota": 0,         "cycleStart": 0,         "cycleEnd": 1,         "mvStatus": "NOT_ELIGIBLE",         "oteStatus": "NOT_ELIGIBLE"       }     },     "payload": {       "id": "xxx@g.us_AC6C100E31E2E6127D13CA7EA296C897_172078351257794@lid",       "timestamp": 1787709981,       "from": "xxx@g.us",       "fromMe": true,       "source": "app",       "body": null,       "to": "xxx@g.us",       "participant": "172078351257794@lid",       "hasMedia": true,       "media": {         "url": "http://localhost:3000/api/files/036322/AC6C100E31E2E6127D13CA7EA296C897.webp",         "filename": "AC6C100E31E2E6127D13CA7EA296C897.webp",         "mimetype": "image/webp"       },       "ack": 1,       "ackName": "SERVER",       "location": null,       "vCards": null,       "replyTo": null,       "_data": {         "key": {           "remoteJid": "xxx@g.us",           "fromMe": true,           "id": "AC6C100E31E2E6127D13CA7EA296C897",           "participant": "xxx@lid",           "addressingMode": "lid"         },         "messageTimestamp": 1787709981,         "pushName": "leo",         "broadcast": false,         "statu
  **Post-Mortem & Fix Analysis**:
  > Hi! Is there any logs?  I see webp in `media.url` and I also converted it correctly from `stickerMessage.url` in your example locally, but perhaps there was some error in logs?  [![patron:PRO](https://img.shields.io/badge/patron-PRO-188a42)](https://waha.devlike.pro/docs/how-to/plus-version/#tiers)
  > Could you check if `http://localhost:3000/api/files/036322/AC6C100E31E2E6127D13CA7EA296C897.webp"` is an archive actually?  [![patron:PRO](https://img.shields.io/badge/patron-PRO-188a42)](https://waha.devlike.pro/docs/how-to/plus-version/#tiers)
  > > Could you check if `http://localhost:3000/api/files/036322/AC6C100E31E2E6127D13CA7EA296C897.webp"` is an archive actually? >  > [![patron:PRO](https://camo.githubusercontent.com/f603a6a99a2dbd219edd08c5cfb2b5edf01581c2e2e5e21a5d50298508c04a6f/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f706174726f6e2d50524f2d313838613432)](https://waha.devlike.pro/docs/how-to/plus-version/#tiers)  <img width="510" height="383" alt="Image" src="https://github.com/user-attachments/assets/da644aed-b60f-4e18-8345-ded4e5b633b2" />  This is what it looks like when I access it from Chrome, but I'm not sure why. 

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

### Incident Patch 1: `90ba445a` (2026-10-02)
**Commit Message**: up(dashboard): fix refresh chat on new messages

**File**: `waha.config.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
     },
     "dashboard": {
       "repo": "devlikeapro/dashboard",
-      "ref": "5b27f93682c5465b54e6614401adf06e2e1c2c4e"
+      "ref": "89ba45be91a8493de23aff97b00a2e29df5c9841"
     }
   }
 }
```

---

### Incident Patch 2: `c9ac14e1` (2026-10-02)
**Commit Message**: fix(WEBJS): hide "what's new" modal - use gating days

**File**: `src/core/engines/webjs/WebjsClientCore.ts` (modified, +7/-1)
```diff
@@ -159,7 +159,13 @@ export class WebjsClientCore extends Client {
       if (!WAWebUserPrefsMeUser.getMaybeMePnUser()) {
         return false;
       }
-      const nux = WAWebWhatsNewNux.createWhatsNewNux();
+      // The app checks the cool-off with AB-prop driven days (15 or 30)
+      const WAWebWhatsNewGatingUtils = window.require(
+        'WAWebWhatsNewGatingUtils',
+      );
+      const days =
+        WAWebWhatsNewGatingUtils?.getWhatsNewAutoModalCooldownDays?.();
+      const nux = WAWebWhatsNewNux.createWhatsNewNux(days);
       if (!nux.shouldShow()) {
         return false;
       }
```

---

### Incident Patch 3: `c4f224b7` (2026-10-02)
**Commit Message**: fix(WEBJS): remove hide ux fresh look

**File**: `src/core/engines/webjs/WebjsClientCore.ts` (modified, +0/-20)
```diff
@@ -141,26 +141,6 @@ export class WebjsClientCore extends Client {
     await this.pupPage.evaluate(LoadPaginator);
   }
 
-  /**
-   * @result indicating whether the UX fresh look was successfully hidden.
-   */
-  hideUXFreshLook(): Promise<boolean> {
-    return this.pupPage.evaluate(() => {
-      const WAWebUserPrefsUiRefresh = window.require('WAWebUserPrefsUiRefresh');
-      if (!WAWebUserPrefsUiRefresh) {
-        return false;
-      }
-      if (WAWebUserPrefsUiRefresh.getUiRefreshNuxAcked()) {
-        return false;
-      }
-      WAWebUserPrefsUiRefresh.incrementNuxViewCount();
-      WAWebUserPrefsUiRefresh.setUiRefreshNuxAcked(true);
-      const WAWebModalManager = window.require('WAWebModalManager');
-      WAWebModalManager.ModalManager.close();
-      return true;
-    });
-  }
-
   /**
    * @result indicating whether the "What's New" auto-modal was prevented or dismissed.
    */
```

**File**: `src/core/engines/webjs/session.webjs.core.ts` (modified, +0/-16)
```diff
@@ -686,22 +686,6 @@ export class WhatsappSessionWebJSCore extends WhatsappSession {
       this.logger.info(`Session '${this.name}' is ready!`);
     });
 
-    //
-    // Temp fix for hiding "Fresh look" modal
-    // https://github.com/devlikeapro/waha/issues/987
-    //
-    this.whatsapp.on(Events.READY, async () => {
-      try {
-        const hidden = await this.whatsapp.hideUXFreshLook();
-        if (hidden) {
-          this.logger.info('"Fresh look" modal has been hidden');
-        }
-      } catch (err) {
-        this.logger.warn('Failed to hide "Fresh look" modal');
-        this.logger.warn(err, err.stack);
-      }
-    });
-
     this.whatsapp.on(Events.AUTHENTICATED, async (args) => {
       this.status = WAHASessionStatus.WORKING;
       this.qr.save('');
```

---

### Incident Patch 4: `0da9ef68` (2026-10-02)
**Commit Message**: feat: groups share history mode - fix #2282

**File**: `src/api/groups.controller.ts` (modified, +17/-1)
```diff
@@ -362,13 +362,29 @@ export class GroupsController {
     @WorkingSessionParam session: WhatsappSession,
     @Param('id') id: string,
     @Body() request: SettingsMemberShareHistoryMode,
-  ) {
+  ): Promise<boolean> {
     return session.setMemberShareHistoryMode(
       id,
       request.membersCanShareHistory,
     );
   }
 
+  @Get(':id/settings/security/member-share-history-mode')
+  @SessionApiParam
+  @GroupIdApiParam
+  @CheckPolicies(CanSession(Action.Read, FromParam('session')))
+  @ApiOperation({
+    summary: 'Get settings - members can send message history to new members',
+    description:
+      'The group settings for whether members can share message history with new members, or only admins can.',
+  })
+  getMemberShareHistoryMode(
+    @WorkingSessionParam session: WhatsappSession,
+    @Param('id') id: string,
+  ): Promise<SettingsMemberShareHistoryMode> {
+    return session.getMemberShareHistoryMode(id);
+  }
+
   @Put(':id/settings/security/membership-approval')
   @SessionApiParam
   @GroupIdApiParam
```

**File**: `src/apps/mcp/tools/groups.tools.ts` (modified, +42/-0)
```diff
@@ -9,6 +9,7 @@ import {
   GroupIdInput,
   GroupJoinInput,
   GroupMembershipApprovalInput,
+  GroupMemberShareHistoryInput,
   GroupParticipantsInput,
   GroupPictureInput,
   GroupsListInput,
@@ -405,6 +406,47 @@ export class GroupTools extends McpController {
     });
   }
 
+  @Tool('groups-get-member-share-history', {
+    title: 'Get member share history setting',
+    description:
+      'Get whether all members or only admins can share message history with new members',
+    inputSchema: GroupIdInput,
+    annotations: {
+      readOnlyHint: true,
+      destructiveHint: false,
+      idempotentHint: true,
+    },
+  })
+  async getMemberShareHistory({ session, id }: z.infer<typeof GroupIdInput>) {
+    return this.textRequest({
+      method: 'GET',
+      url: `/api/${session}/groups/${id}/settings/security/member-share-history-mode`,
+    });
+  }
+
+  @Tool('groups-set-member-share-history', {
+    title: 'Set member share history setting',
+    description:
+      'Allow all members or only admins to share message history with new members',
+    inputSchema: GroupMemberShareHistoryInput,
+    annotations: {
+      readOnlyHint: false,
+      destructiveHint: false,
+      idempotentHint: true,
+    },
+  })
+  async setMemberShareHistory({
+    session,
+    id,
+    ...body
+  }: z.infer<typeof GroupMemberShareHistoryInput>) {
+    return this.textRequest({
+      method: 'PUT',
+      url: `/api/${session}/groups/${id}/settings/security/member-share-history-mode`,
+      data: body,
+    });
+  }
+
   @Tool('groups-get-join-requests', {
     title: 'Get pending requests to join the group',
     description: 'Get pending requests to join the group',
```

**File**: `src/apps/mcp/tools/groups.zod.ts` (modified, +8/-0)
```diff
@@ -8,6 +8,7 @@ import {
   JoinGroupRequest,
   ParticipantsRequest,
   SettingsMembershipApproval,
+  SettingsMemberShareHistoryMode,
   SettingsSecurityChangeInfo,
   SubjectRequest,
 } from '@waha/structures/groups.dto';
@@ -72,3 +73,10 @@ export const GroupMembershipApprovalInput = DtoToZod(
   session: SessionField,
   id: GroupIdField,
 });
+
+export const GroupMemberShareHistoryInput = DtoToZod(
+  SettingsMemberShareHistoryMode,
+).extend({
+  session: SessionField,
+  id: GroupIdField,
+});
```

**File**: `src/core/abc/session.abc.ts` (modified, +11/-1)
```diff
@@ -114,6 +114,7 @@ import {
   GroupsListFields,
   ParticipantsRequest,
   SettingsMemberAddMode,
+  SettingsMemberShareHistoryMode,
   SettingsMembershipApproval,
   SettingsSecurityChangeInfo,
 } from '../../structures/groups.dto';
@@ -1025,7 +1026,16 @@ export abstract class WhatsappSession {
     throw new NotImplementedByEngineError();
   }
 
-  public setMemberShareHistoryMode(id, value) {
+  public getMemberShareHistoryMode(
+    id: string,
+  ): Promise<SettingsMemberShareHistoryMode> {
+    throw new NotImplementedByEngineError();
+  }
+
+  public setMemberShareHistoryMode(
+    id: string,
+    value: boolean,
+  ): Promise<boolean> {
     throw new NotImplementedByEngineError();
   }
 
```

**File**: `src/core/engines/gows/grpc/gows.ts` (modified, +13/-0)
```diff
@@ -11726,6 +11726,15 @@ export namespace messages {
                 responseSerialize: (message: Empty) => Buffer.from(message.serialize()),
                 responseDeserialize: (bytes: Buffer) => Empty.deserialize(new Uint8Array(bytes))
             },
+            SetGroupMemberShareHistoryMode: {
+                path: "/messages.MessageService/SetGroupMemberShareHistoryMode",
+                requestStream: false,
+                responseStream: false,
+                requestSerialize: (message: JidBoolRequest) => Buffer.from(message.serialize()),
+                requestDeserialize: (bytes: Buffer) => JidBoolRequest.deserialize(new Uint8Array(bytes)),
+                responseSerialize: (message: Empty) => Buffer.from(message.serialize()),
+                responseDeserialize: (bytes: Buffer) => Empty.deserialize(new Uint8Array(bytes))
+            },
             UpdateGroupParticipants: {
                 path: "/messages.MessageService/UpdateGroupParticipants",
                 requestStream: false,
@@ -12144,6 +12153,7 @@ export namespace messages {
         abstract SetGroupLocked(call: grpc_1.ServerUnaryCall<JidBoolRequest, Empty>, callback: grpc_1.sendUnaryData<Empty>): void;
         abstract SetGroupAnnounce(call: grpc_1.ServerUnaryCall<JidBoolRequest, Empty>, callback: grpc_1.sendUnaryData<Empty>): void;
         abstract SetGroupMemberAddMode(call: grpc_1.ServerUnaryCall<JidBoolRequest, Empty>, callback: grpc_1.sendUnaryData<Empty>): void;
+        abstract SetGroupMemberShareHistoryMode(call: grpc_1.ServerUnaryCall<JidBoolRequest, Empty>, callback: grpc_1.sendUnaryData<Empty>): void;
         abstract UpdateGroupParticipants(call: grpc_1.ServerUnaryCall<UpdateParticipantsRequest, JsonList>, callback: grpc_1.sendUnaryData<JsonList>): void;
         abstract SetGroupJoinApprovalMode(call: grpc_1.ServerUnaryCall<JidBoolRequest, Empty>, callback: grpc_1.sendUnaryData<Empty>): void;
         abstract GetGroupRequestParticipants(call: grpc_1.ServerUnaryCall<JidRequest, JsonList>, callback: grpc_1.sendUnaryData<JsonList>): void;
@@ -12279,6 +12289,9 @@ export namespace messages {
         SetGroupMemberAddMode: GrpcUnaryServiceInterface<JidBoolRequest, Empty> = (message: JidBoolRequest, metadata: grpc_1.Metadata | grpc_1.CallOptions | grpc_1.requestCallback<Empty>, options?: grpc_1.CallOptions | grpc_1.requestCallback<Empty>, callback?: grpc_1.requestCallback<Empty>): grpc_1.ClientUnaryCall => {
             return super.SetGroupMemberAddMode(message, metadata, options, callback);
         };
+        SetGroupMemberShareHistoryMode: GrpcUnaryServiceInterface<JidBoolRequest, Empty> = (message: JidBoolRequest, metadata: grpc_1.Metadata | grpc_1.CallOptions | grpc_1.requestCallback<Empty>, options?: grpc_1.CallOptions | grpc_1.requestCallback<Empty>, callback?: grpc_1.requestCallback<Empty>): grpc_1.ClientUnaryCall => {
+            return super.SetGroupMemberShareHistoryMode(message, metadata, options, callback);
+        };
         UpdateGroupParticipants: GrpcUnaryServiceInterface<UpdateParticipantsRequest, JsonList> = (message: UpdateParticipantsRequest, metadata: grpc_1.Metadata | grpc_1.CallOptions | grpc_1.requestCallback<JsonList>, options?: grpc_1.CallOptions | grpc_1.requestCallback<JsonList>, callback?: grpc_1.requestCallback<JsonList>): grpc_1.ClientUnaryCall => {
             return super.UpdateGroupParticipants(message, metadata, options, callback);
         };
```

**File**: `src/core/engines/gows/grpc/gows_grpc_pb.js` (modified, +12/-0)
```diff
@@ -1073,6 +1073,18 @@ setGroupMemberAddMode: {
     responseDeserialize: deserialize_messages_Empty,
   },
   // who can add members - true - all members, false - admins only
+setGroupMemberShareHistoryMode: {
+    path: '/messages.MessageService/SetGroupMemberShareHistoryMode',
+    requestStream: false,
+    responseStream: false,
+    requestType: gows_pb.JidBoolRequest,
+    responseType: gows_pb.Empty,
+    requestSerialize: serialize_messages_JidBoolRequest,
+    requestDeserialize: deserialize_messages_JidBoolRequest,
+    responseSerialize: serialize_messages_Empty,
+    responseDeserialize: deserialize_messages_Empty,
+  },
+  // who can share message history with new members - true - all members, false - admins only
 updateGroupParticipants: {
     path: '/messages.MessageService/UpdateGroupParticipants',
     requestStream: false,
```

**File**: `src/core/engines/gows/session.gows.core.ts` (modified, +25/-0)
```diff
@@ -133,6 +133,7 @@ import {
   Participant,
   ParticipantsRequest,
   SettingsMemberAddMode,
+  SettingsMemberShareHistoryMode,
   SettingsMembershipApproval,
   SettingsSecurityChangeInfo,
 } from '@waha/structures/groups.dto';
@@ -1804,6 +1805,30 @@ export class WhatsappSessionGoWSCore extends WhatsappSession {
     return;
   }
 
+  public async getMemberShareHistoryMode(
+    id: string,
+  ): Promise<SettingsMemberShareHistoryMode> {
+    const group = await this.getGroup(id);
+    return {
+      membersCanShareHistory:
+        group.MemberShareHistoryMode === 'all_member_share',
+    };
+  }
+
+  @Activity()
+  public async setMemberShareHistoryMode(
+    id: string,
+    value: boolean,
+  ): Promise<boolean> {
+    const req = new messages.JidBoolRequest({
+      session: this.session,
+      jid: id,
+      value: value,
+    });
+    await promisify(this.client.SetGroupMemberShareHistoryMode)(req);
+    return true;
+  }
+
   public async getMembershipApprovalMode(
     id: string,
   ): Promise<SettingsMembershipApproval> {
```

**File**: `src/core/engines/gows/types.group.ts` (modified, +1/-0)
```diff
@@ -101,6 +101,7 @@ export interface GroupInfoFull {
   IsAnnounce: boolean; // specifies whether only admins can send messages in the group
   Participants: GOWSGroupParticipant[];
   MemberAddMode: string; // all_member_add | admin_add
+  MemberShareHistoryMode: string; // all_member_share | admin_share
   IsJoinApprovalRequired: boolean;
 }
 
```

---

### Incident Patch 5: `9c080611` (2026-09-30)
**Commit Message**: fix(NOWEB): fix delete channel message - fix #2038

**File**: `yarn.lock` (modified, +2/-2)
```diff
@@ -7,7 +7,7 @@ __metadata:
 
 "@adiwajshing/baileys@github:devlikeapro/Baileys#fork-master-2026-04-28":
   version: 7.0.0-rc14
-  resolution: "@adiwajshing/baileys@https://github.com/devlikeapro/Baileys.git#commit=94d2d1be16f2a316d388a9a273e43ac38a731b5d"
+  resolution: "@adiwajshing/baileys@https://github.com/devlikeapro/Baileys.git#commit=93433a380977fce781d25c5e40d8f12d8ea8109e"
   dependencies:
     "@cacheable/node-cache": "npm:^1.4.0"
     "@hapi/boom": "npm:^9.1.3"
@@ -32,7 +32,7 @@ __metadata:
       optional: true
     link-preview-js:
       optional: true
-  checksum: 10/6573177fd2fded5a674ae13f397a837ea976a5cde9b3f4021c9700921b986a7c2030ce4cce66008c879ce8e016e94eb67999ae61fa514cae321c32d6c149ff01
+  checksum: 10/3fdf6e7eea36d474a46c70e645872f588d3c47dcdc99898477be1665302844aa3c5da221cd9773380ea66d28deb9e9e565a1507323be5840eba23352c7707583
   languageName: node
   linkType: hard
 
```

---

### Incident Patch 6: `235ec01d` (2026-09-30)
**Commit Message**: fix(NOWEB): fix update contact - mention #2285

**File**: `src/core/engines/noweb/session.noweb.core.ts` (modified, +18/-7)
```diff
@@ -2016,23 +2016,34 @@ export class WhatsappSessionNoWebCore extends WhatsappSession {
   @Activity()
   public async upsertContact(chatId: string, body: ContactUpdateBody) {
     const jid = await this.hooks.wid.chat.promise(chatId, 'upsertContact');
+    const lid = await this.resolveContactLid(jid);
     let fullName = body.firstName;
     if (body.lastName) {
       fullName = `${body.firstName} ${body.lastName}`;
     }
     const action = {
       fullName: fullName,
       firstName: body.firstName,
+      lidJid: lid ?? undefined,
       saveOnPrimaryAddressbook: true,
     };
     await this.sock.addOrEditContact(jid, action);
-    const updates: Partial<Contact>[] = [
-      {
-        id: jid,
-        name: fullName,
-      },
-    ];
-    this.sock.ev.emit('contacts.update', updates);
+    const update: Partial<Contact> = {
+      id: jid,
+      name: fullName,
+    };
+    if (lid) {
+      update.lid = lid;
+    }
+    this.sock.ev.emit('contacts.update', [update]);
+  }
+
+  private async resolveContactLid(pn: string): Promise<string | null> {
+    const lid = await this.sock.signalRepository.lidMapping.getLIDForPN(pn);
+    if (!lid) {
+      return null;
+    }
+    return jidNormalizedUser(lid);
   }
 
   async getContact(query: ContactQuery) {
```

---

### Incident Patch 7: `ce1e42bb` (2026-09-30)
**Commit Message**: up(WEBJS): fix set push name

**File**: `src/core/engines/webjs/WebjsClientCore.ts` (modified, +8/-3)
```diff
@@ -338,9 +338,14 @@ export class WebjsClientCore extends Client {
   async setPushName(name: string) {
     await this.ensureWahaInjected();
     await this.pupPage.evaluate(async (pushName) => {
-      return await window
-        .require('WAWebSetPushnameConnAction')
-        .setPushname(pushName);
+      // @ts-ignore
+      const WAWebSetPushnameConnAction = await window.WWebJS.requireLazy(
+        'WAWebSetPushnameConnAction',
+        {
+          'WAWebProfileDrawer.react': 'WAWebProfileDrawerLoadableRequireBundle',
+        },
+      );
+      return await WAWebSetPushnameConnAction.setPushname(pushName);
     }, name);
     if (this.info) {
       this.info.pushname = name;
```

---

### Incident Patch 8: `7440cfc7` (2026-09-30)
**Commit Message**: up(WEBJS): fix some modules

**File**: `yarn.lock` (modified, +2/-2)
```diff
@@ -14381,7 +14381,7 @@ __metadata:
 
 "whatsapp-web.js@github:devlikeapro/whatsapp-web.js#fork-main-2026-06-26":
   version: 1.34.7
-  resolution: "whatsapp-web.js@https://github.com/devlikeapro/whatsapp-web.js.git#commit=821b7a273c24f818066bcb028f3ef8db379ef63c"
+  resolution: "whatsapp-web.js@https://github.com/devlikeapro/whatsapp-web.js.git#commit=a95362738822bcb670f9e20f79acaf83304a6a2d"
   dependencies:
     archiver: "npm:7.0.1"
     fluent-ffmpeg: "npm:2.1.3"
@@ -14398,7 +14398,7 @@ __metadata:
       optional: true
     unzipper:
       optional: true
-  checksum: 10/69102f721940327286c4ebf9fc574202ff1c0751b0519144788845fb3cc627c7df72550eb60a905e1709c4ab26989f0135c82512b9b54abc6231d2cba6becdab
+  checksum: 10/ee21c2d7cf3e94eccc931fca7f386aaf6fd5ba4d8f362dd79df8f45fab22298538eaedb5fa5c4ae80a622e51a229601f20fd41c90a781428ad681ce821861de6
   languageName: node
   linkType: hard
 
```

---

### Incident Patch 9: `dbb6be38` (2026-09-30)
**Commit Message**: up(WEBJS): fix forward message - fix #2278

**File**: `yarn.lock` (modified, +2/-2)
```diff
@@ -14381,7 +14381,7 @@ __metadata:
 
 "whatsapp-web.js@github:devlikeapro/whatsapp-web.js#fork-main-2026-06-26":
   version: 1.34.7
-  resolution: "whatsapp-web.js@https://github.com/devlikeapro/whatsapp-web.js.git#commit=481db6c749f9ca1a2afad34f520769eace9d8f29"
+  resolution: "whatsapp-web.js@https://github.com/devlikeapro/whatsapp-web.js.git#commit=821b7a273c24f818066bcb028f3ef8db379ef63c"
   dependencies:
     archiver: "npm:7.0.1"
     fluent-ffmpeg: "npm:2.1.3"
@@ -14398,7 +14398,7 @@ __metadata:
       optional: true
     unzipper:
       optional: true
-  checksum: 10/917a28428c55aeaf548b726c4afe1a56100cddac5facc4d9306123a06f34f62f36df19094350bd7623668f5065fa891e81c29c8b7615369f773657bb00fa463a
+  checksum: 10/69102f721940327286c4ebf9fc574202ff1c0751b0519144788845fb3cc627c7df72550eb60a905e1709c4ab26989f0135c82512b9b54abc6231d2cba6becdab
   languageName: node
   linkType: hard
 
```

---

### Incident Patch 10: `7d7d3311` (2026-09-30)
**Commit Message**: fix(NOWEB): fix deleting channel message - fix #2038 (#2284)

**File**: `src/core/engines/noweb/session.noweb.core.ts` (modified, +4/-0)
```diff
@@ -1148,6 +1148,10 @@ export class WhatsappSessionNoWebCore extends WhatsappSession {
     const options = {
       messageId: this.generateMessageID(),
     };
+    if (isJidNewsletter(jid)) {
+      // Newsletter deletes reuse the original message ID
+      options.messageId = key.id;
+    }
     return this.sock.sendMessage(jid, { delete: key }, options);
   }
 
```

---

### Incident Patch 11: `55a7d78e` (2026-09-22)
**Commit Message**: fix(NOWEB): template message with image header — hasMedia:true but download fails - fix #2275

**File**: `src/core/engines/noweb/session.noweb.core.ts` (modified, +16/-2)
```diff
@@ -3794,6 +3794,20 @@ export class NOWEBEngineMediaProcessor implements IMediaEngineProcessor<any> {
       content.url = null;
     }
 
+    // Baileys unwraps hydratedTemplate only, so download the interactive template header as a plain media message
+    const header = extractMessageContent(message.message)?.templateMessage
+      ?.interactiveMessageTemplate?.header;
+    if (header) {
+      message = {
+        key: message.key,
+        message: lodash.pick(header, [
+          'imageMessage',
+          'videoMessage',
+          'documentMessage',
+        ]),
+      };
+    }
+
     // Use 'stream' mode instead of 'buffer' to fix 0-byte audio files
     // 'buffer' mode silently returns empty buffer for audio/voice messages
     // See: https://github.com/devlikeapro/waha/issues/1996
@@ -3826,8 +3840,8 @@ export class NOWEBEngineMediaProcessor implements IMediaEngineProcessor<any> {
   }
 
   getFilename(message: any): string | null {
-    const content = extractMessageContent(message.message);
-    return content?.documentMessage?.fileName || null;
+    const content = extractMediaContent(message.message);
+    return content?.fileName || null;
   }
 }
 
```

**File**: `src/core/engines/noweb/utils.ts` (modified, +4/-1)
```diff
@@ -36,7 +36,10 @@ export function extractMediaContent(
     content?.templateMessage?.hydratedTemplate?.videoMessage ||
     content?.templateMessage?.interactiveMessageTemplate?.header
       ?.imageMessage ||
-    content?.templateMessage?.interactiveMessageTemplate?.header?.videoMessage;
+    content?.templateMessage?.interactiveMessageTemplate?.header
+      ?.videoMessage ||
+    content?.templateMessage?.interactiveMessageTemplate?.header
+      ?.documentMessage;
   if (mediaContent) {
     return mediaContent;
   }
```

---

### Incident Patch 12: `82046700` (2026-09-22)
**Commit Message**: up: WEBJS - fix "Data passed to getter must include an id property (it's how we memoize) but got undefined" - fix #2271 fix #2273

**File**: `yarn.lock` (modified, +2/-2)
```diff
@@ -14381,7 +14381,7 @@ __metadata:
 
 "whatsapp-web.js@github:devlikeapro/whatsapp-web.js#fork-main-2026-06-26":
   version: 1.34.7
-  resolution: "whatsapp-web.js@https://github.com/devlikeapro/whatsapp-web.js.git#commit=55a5d3a58a6cbdb8d6927f7de25c790e26257519"
+  resolution: "whatsapp-web.js@https://github.com/devlikeapro/whatsapp-web.js.git#commit=481db6c749f9ca1a2afad34f520769eace9d8f29"
   dependencies:
     archiver: "npm:7.0.1"
     fluent-ffmpeg: "npm:2.1.3"
@@ -14398,7 +14398,7 @@ __metadata:
       optional: true
     unzipper:
       optional: true
-  checksum: 10/7f74f507c4180b0f4f2e273eded05f09583864004e4bf0af3cc4024b72754bf0df23a6e8f508f8ccc3bced1942d7ab56e9787b1b6e78cdba89affdc96e32c680
+  checksum: 10/917a28428c55aeaf548b726c4afe1a56100cddac5facc4d9306123a06f34f62f36df19094350bd7623668f5065fa891e81c29c8b7615369f773657bb00fa463a
   languageName: node
   linkType: hard
 
```

---

### Incident Patch 13: `0dc745ba` (2026-09-22)
**Commit Message**: docs: mentions is null in example

**File**: `src/structures/properties.dto.ts` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ function MentionsProperty() {
   return ApiProperty({
     description:
       'Chat IDs to mention in the message. Use ["all"] to mention all participants in a group.',
-    example: ['11111111111@c.us'],
+    example: null,
     required: false,
   });
 }
```

---

### Incident Patch 14: `0e73561b` (2026-09-17)
**Commit Message**: fix(openapi): tags for apps

**File**: `src/apps/argentine-phone-numbers/app.module.ts` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ import { ArgentinePhoneNumbersAppService } from '@waha/apps/argentine-phone-numb
 const argentinephonenumbersAppModule: AppModule = {
   name: AppName.argentinePhoneNumbers,
   openapi: {
-    title: 'Argentine Phone Numbers',
+    title: 'Phone Numbers: Argentina',
     description:
       'Resolve Argentine phone numbers (with and without the mobile 9)',
   },
```

**File**: `src/apps/brazilian-phone-numbers/app.module.ts` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ import { BrazilianPhoneNumbersAppService } from '@waha/apps/brazilian-phone-numb
 const brazilianphonenumbersAppModule: AppModule = {
   name: AppName.brazilianPhoneNumbers,
   openapi: {
-    title: 'Brazilian Phone Numbers',
+    title: 'Phone Numbers: Brazil',
     description: 'Resolve Brazilian phone numbers (with and without 9 digit)',
   },
   definition: {
```

---

### Incident Patch 15: `f1f25cf8` (2026-09-16)
**Commit Message**: up(NOWEB): fix thumbnails in history

**File**: `yarn.lock` (modified, +2/-2)
```diff
@@ -7,7 +7,7 @@ __metadata:
 
 "@adiwajshing/baileys@github:devlikeapro/Baileys#fork-master-2026-04-28":
   version: 7.0.0-rc14
-  resolution: "@adiwajshing/baileys@https://github.com/devlikeapro/Baileys.git#commit=50da8378cf23b654334963769b6ca6989e6c47ca"
+  resolution: "@adiwajshing/baileys@https://github.com/devlikeapro/Baileys.git#commit=94d2d1be16f2a316d388a9a273e43ac38a731b5d"
   dependencies:
     "@cacheable/node-cache": "npm:^1.4.0"
     "@hapi/boom": "npm:^9.1.3"
@@ -32,7 +32,7 @@ __metadata:
       optional: true
     link-preview-js:
       optional: true
-  checksum: 10/4e202009324a3c2636c9aac4631da60ff3a908e078f1fb197dff1210687825320366b10145e0c2b71d5e84efd595f409fb814eef9128a4e7db558fbf34d51279
+  checksum: 10/6573177fd2fded5a674ae13f397a837ea976a5cde9b3f4021c9700921b986a7c2030ce4cce66008c879ce8e016e94eb67999ae61fa514cae321c32d6c149ff01
   languageName: node
   linkType: hard
 
```

#### Recent Merged Pull Requests:
- **PR #2286** (closed): Fix/remove gows from image (@hilisevir)
- **PR #2284** (2026-09-30): [core] fix(NOWEB): reuse original message id when deleting channel messages - fix #2038 (@BrianB3)
- **PR #2283** (2026-09-30): [core] feat(NOWEB): expose group member-share-history-mode as a settable endpoint (@alisonmwhite)
- **PR #2280** (closed): feat: First release & production deploy setup (@DECode-studio)
- **PR #2270** (2026-09-22): [core] Expose mentions in the OpenAPI spec (@Jeparre)
- **PR #2264** (closed): [core] Fix native Chatwoot outgoing message delivery status (@lucirlei)
- **PR #2262** (closed): [core] Fix WEBJS presence subscriptions and LID lookup (@vrodriguezf)
- **PR #2260** (closed): [core] Add Argentine Phone Numbers app for outbound resolution (@ropu)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
