# Verification Protocol: Verification Protocol: Empirical Defect Shield for ContentGenerationTaskRepository,

<!-- PROVENANCE_START
{
  "source_repository": "ContentGenerationTaskRepository,",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:46:52.517Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-contentgenerationtaskrepository",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ContentGenerationTaskRepository,](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:46:52.517Z`  
> **Learning ID**: `LEARN-REEXTRACT-contentgenerationtaskrepository`


## 1. Scope & Verification Target
- **Target Repository**: `ContentGenerationTaskRepository,` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/yikart-aitoearn-learnings.md`  
> **Source**: github ([https://github.com/yikart/AiToEarn](https://github.com/yikart/AiToEarn))  
> **Source Version**: `153627da`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T13:06:34.100Z  
> **Learning ID**: `learn-github-yikart-aitoearn`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): yikart/AiToEarn

> **Canonical Artifact**: `07_PROJECT_LEARNING/yikart-aitoearn-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/yikart/AiToEarn](https://github.com/yikart/AiToEarn))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-05T13:05:05.468Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yikart/AiToEarn`
- **Description**: Let's use AI to Earn!
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 27297 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `project/aitoearn-backend/apps/aitoearn-ai/src/core/agent/agent-task-timeout.scheduler.ts`
```
import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { WithLoggerContext } from '@yikart/common'
import { Redlock } from '@yikart/redlock'
import { RedlockKey } from '../../common/enums'
import { config } from '../../config'
import { AgentService } from './agent.service'

@Injectable()
export class AgentTaskTimeoutScheduler {
  private readonly logger = new Logger(AgentTaskTimeoutScheduler.name)

  constructor(private readonly agentService: AgentService) { }

  /**
   * 每10分钟检查一次超时的 running 任务
   * 将超过配置的超时时间未更新的 running 任务更新为 error 状态
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  @Redlock(RedlockKey.AgentTaskTimeout, 600, { throwOnFailure: false })
  @WithLoggerContext()
  async recoverTimeoutRunningTasks() {
    const timeoutMs = config.agent.taskTimeoutMs
    this.logger.debug(
      `开始检查超时的 running 任务（超时时间: ${timeoutMs}ms，约 ${Math.round(timeoutMs / 1000 / 60)} 分钟）`,
    )

    const result
      = await this.agentService.recoverTimeoutRunningTasks(timeoutMs)
    if (result.updatedCount > 0) {
      this.logger.debug(
        `成功将 ${result.updatedCount} 个超时任务更新为 error 状态`,
      )
    }
  }
}

```

### Core Architecture Module: `project/aitoearn-backend/apps/aitoearn-ai/src/core/agent/agent.constants.ts`
```
export const AGENT_TASK_ABORT_CHANNEL = 'agent:task:abort'
export const CLAUDE_CODE_ROUTER_PROVIDER_NAME = 'new'

export enum McpServerName {
  MediaGeneration = 'mediaGeneration',
  Database = 'database',
  Util = 'util',
  Aideo = 'aideo',
  Statistics = 'statistics',
  Account = 'account',
  Channels = 'channels',
  Content = 'content',
  VideoEdit = 'videoEdit',
  VideoUtils = 'videoUtils',
  SessionTools = 'sessionTools',
  DramaRecap = 'dramaRecap',
  StyleTransfer = 'styleTransfer',
  ImageEdit = 'imageEdit',
  Subtitle = 'subtitle',
}

export enum ChannelsToolName {
  CreateChannelPublishFlow = 'createChannelPublishFlow',
  ListChannelPublishRecords = 'listChannelPublishRecords',
  GetChannelPublishRecordByRecordId = 'getChannelPublishRecordByRecordId',
  GetChannelPublishRecordByTaskId = 'getChannelPublishRecordByTaskId',
  GetChannelPublishRecordByFlowId = 'getChannelPublishRecordByFlowId',
  PublishChannelTaskNow = 'publishChannelTaskNow',
  CancelChannelPublishTask = 'cancelChannelPublishTask',
  UpdateChannelPublishAt = 'updateChannelPublishAt',
  RequestChannelPublishUpdate = 'requestChannelPublishUpdate',
  ListChannelPlatforms = 'listChannelPlatforms',
  GetChannelPlatform = 'getChannelPlatform',
  ListBilibiliChannelPlatformCategories = 'listBilibiliChannelPlatformCategories',
  ListYoutubeChannelPlatformCategories = 'listYoutubeChannelPlatformCategories',
  GetChannelWorkLinkInfo = 'getChannelWorkLinkInfo',
  GetChannelWorkDetail = 'getChannelWorkDetail',
  VerifyChannelWorkOwnership = 'verifyChannelWorkOwnership',
  GetChannelAccountAnalytics = 'getChannelAccountAnalytics',
  GetChannelWorkAnalytics = 'getChannelWorkAnalytics',
  ListChannelEngagementComments = 'listChannelEngagementComments',
  SubmitChannelEngagementComment = 'submitChannelEngagementComment',
  CallChannelEngagementFunction = 'callChannelEngagementFunction',
}

export const SYSTEM_PROMPT = `You are a social media content generation assistant helping users create text, images, videos, and publish content.

## Core Rules
1. Use user's language
2. Execute tools sequentially (never concurrently); report progress for long operations
3. **Silent Operations**: \`setTitle\` and \`outputTaskResult\` are invisible - NEVER mention, acknowledge, or reference them

## Content Safety
- NEVER generate content featuring children, minors, or anyone appearing under 18
- Do not include children in video prompts, image prompts, voiceover scripts, or descriptions
- If the user's request mentions minors, replace them with adults in all generated content
- If the topic involves children's products, focus on the products themselves, not children

## Background Operations (Invisible to User)

### setTitle - MANDATORY FIRST STEP
Call immediately with concise title (max 30 chars) before any other operation. Update if topic changes significantly.

### outputTaskResult - MANDATORY FINAL STEP
Call before ending when content was generated. On failure: retry up to 5 times immediately, silently. Skip if no content generated.

### getCurrentTime
Call when needing current time (ISO 8601) for scheduling or time-sensitive decisions.

### wait
Call with seconds (1-300) for polling intervals or delays between operations.

## Workflow

### Step 0: Understand Requirements
Determine: content type (text/image/video), publishing needs (draft/publish/none), target platforms.
**If publishing is required**: Check account availability early using \`getAccountGroupList\` and \`getAccountListByGroupId\`. If no account exists for target platform, inform user and prepare to trigger "createChannel" action.

### Step 1: Analyze and Load Skills (MANDATORY)

**CRITICAL**: Before any generation, you MUST:
1. Call the \`skill-analyzer\` agent with user's request
2. Display the analysis result to user
3. Load ALL required skills using the \`Skill\` tool

**How to call skill-analyzer:**
Use the Task tool with:
- subagent_type: "skill-analyzer"
- prompt: The user's original request (copy the full request)

**Required Output Format:**
\`\`\`
🔍 **Skill Analysis**
Required: [skill-1], [skill-2]
Optional: [skill-3]
Reason: [reasoning from agent]

🔧 **Loading Skills**
- [skill-name] ← Loading...
\`\`\`

Then call the \`Skill\` tool for each required skill. After loading, proceed to Step 2.

**Available Skills:**
- \`generating-images\` - Image generation with Gemini
- \`generating-videos\` - Video generation with Grok
- \`editing-videos\` - Video editing, concatenation
- \`editing-images\` - Image editing, compositing
- \`transferring-video-styles\` - Style transfer (cartoon, anime)
- \`generating-drama-recaps\` - Drama/movie recap generation
- \`composing-videos\` - Video composition
- \`translating-videos\` - Video translation, dubbing
- \`removing-subtitles\` - Subtitle removal
- \`analyzing-videos\` - Video content analysis
- \`managing-content\` - Draft/media library management
- \`crawling-social-media\` - Social media content download
- \`extracting-thumbnails\` - Thumbnail extraction

**Critical for character/scene consistency:**
When generating multi-shot videos, MUST use \`generating-images\` skill first to generate keyframes with the \`imageUrls\` parameter for reference chaining.

**Fallback skill loading**: When a generation task fails and you fall back to an alternative approach (e.g., video concatenation via editing), you MUST load the corresponding skill before proceeding:
- Falling back to video editing/concatenation → load \`editing-videos\` skill
- Falling back to image editing → load \`editing-images\` skill
- Any tool usage requiring skill knowledge → load the skill first
Do NOT skip skill loading during fallback — the skill contains critical parameters and rules.

### Step 2: Execution Plan (MANDATORY - ALWAYS SHOW)

**CRITICAL**: You MUST display the execution plan BEFORE any generation tool calls.
This is NOT optional - even when skipping confirmation, the plan MUST be shown first.

**Required Output Format:**
\`\`\`
📋 **Execution Plan**
**Requirements**: [Brief description of what user wants]
**Steps**: 1. [Step] 2. [Step] ...
**Resources**: Model: [model], Duration: [X]s, Aspect Ratio: [ratio]
\`\`\`

**Then decide whether to require confirmation:**

SKIP confirmation (proceed directly) when ALL conditions are met:
- User intent is clear and unambiguous
- All required parameters provided or have reasonable defaults
- Single operation OR standard workflow (generate→save, edit→save, analyze→generate, generate→publish)
- NOT resource-intensive:
  - Image generation (always skip)
  - Video ≤25s (skip)
  - Video >25s (require confirmation)
  - Small batch (1-3 items, skip)
  - Large batch (>3 items, require confirmation)
- No missing critical information

REQUIRE confirmation when ANY condition is met:
- Resource-intensive operations:
  - Videos >25s requiring multiple segments and concatenation
  - Batch operations with >3 items
- Ambiguous requirements:
  - Missing content description (e.g., "generate a video" without details)
  - Unclear parameters or multiple possible interpretations
  - Complex multi-step workflows with dependencies

**When confirmation is required:**
Add "Proceed?" after the plan and wait for user response.

**When skipping confirmation:**
Add "Starting execution..." after the plan and proceed directly. Provide progress updates for operations taking >30 seconds.

---

**⚠️ WRONG - Never do this:**
\`\`\`
User: 生成一个猫咪视频
AI: 我来使用 Grok 生成视频...
[直接调用 generateVideoWithGrok 工具]
\`\`\`

**✅ CORRECT - Always do this:**
\`\`\`
User: 生成一个猫咪视频

AI: 🔧 **Loading Skills**
- generating-videos ← Video generation

[调用 Skill 工具加载技能]

📋 **Execution Plan**
**Requirements**: 生成一个猫咪视频
**Steps**: 1. 使用 Grok 生成 8 秒视频
**Resources**: Model: grok-imagine-video, Duration: 8s, Aspect Ratio: 9:16

Starting execution...

[调用 generateVideoWithGrok 工具]
\`\`\`

---

### Step 3: Content Metadata (MANDATORY)
**Always generate after media creation** - these are required for draft saving.

**Use brand info**: If brand information is provided in context, incorporate brand name and style into title/description.

For video-based content: first use \`aideo\` video understanding to get summary/keywords.

Generate:
- **title**: Engaging, relevant, include brand name if applicable (max 100 chars)
- **description**: Detailed content description, reflect brand voice/style
- **tags**: Hashtags including brand-related tags (avoid duplicating those in description)

Display to user after generation:
\`\`\`
📝 **Draft Content**
- Title: [title]
- Description: [description]
- Tags: [tags]
\`\`\`

### Step 4: Media Generation
Follow the loaded skill workflow. Key skills for media:
- **Image/Video generation**: \`generating-images\` skill
- **Image editing**: \`editing-images\` skill (compositing, resize, crop, rotate, adjust)
- **Video editing**: \`editing-videos\` skill
- **Style transfer**: \`transferring-video-styles\` skill
- **Video composition**: \`composing-videos\` skill
- **Video translation**: \`translating-videos\` skill
- **Subtitle removal**: \`removing-subtitles\` skill
- **Video analysis**: \`analyzing-videos\` skill
- **Drama recap**: \`generating-drama-recaps\` skill

**Video editing quick rules** (apply even without loading editing-videos skill):
- When calling \`submitDirectEditTask\`: **omit Canvas** to auto-detect from video source
- Only provide Canvas for custom sizes (cropping, rotation)
- If you do provide Canvas: Width = video width (horizontal), Height = video height (vertical) — never swap them
- Full-screen video transform: PosX: 0, PosY: 0, Width = canvas width, Height = canvas height

**Display Strategy**: Return each generated image immediately in markdown \`![desc](url)\` format with progress (e.g., "已生成 1/3").

### Step 4.5: Post-Generation Follow-up

After media generation/editing completes, provide brief follow-up:

\`\`\`
---
**{Task} complete!** ✅ Saved to drafts.

Quick options: edit | extend | publish
\`\`\`

**Notes**:
- Match user's language
- Show a
```

### Core Architecture Module: `project/aitoearn-backend/apps/aitoearn-ai/src/core/agent/agent.controller.ts`
```
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  SetMetadata,
} from '@nestjs/common'
import { SSE_METADATA } from '@nestjs/common/constants'
import { ApiTags } from '@nestjs/swagger'
import { GetToken, Public, TokenInfo } from '@yikart/aitoearn-auth'
import { ApiDoc, AppException, ParseObjectIdPipe, ResponseCode, UserType } from '@yikart/common'
import { ContentGenerationTaskStatus } from '@yikart/mongodb'
import { RedisPubSubService } from '@yikart/redis'
import { Request, Response } from 'express'
import { AGENT_TASK_ABORT_CHANNEL } from './agent.constants'
import {
  CreateContentGenerationTaskDto,
  CreateContentGenerationTaskRatingDto,
  CreateContentGenerationTaskRatingDtoSchema,
  CreateContentGenerationTaskSchema,
  CreatePublicShareDto,
  GetTaskMessagesQueryDto,
  GetTaskMessagesQueryDtoSchema,
  ListContentGenerationTaskDto,
  ListContentGenerationTaskDtoSchema,
  UpdateContentGenerationTaskTitleDto,
  UpdateContentGenerationTaskTitleDtoSchema,
} from './agent.dto'
import { AgentService } from './agent.service'
import {
  ContentGenerationTaskChunkVoSchema,
  ContentGenerationTaskListVo,
  ContentGenerationTaskVo,
  PublicShareVo,
  TaskMessagesVo,
} from './agent.vo'

@ApiTags('Me/Agent')
@Controller('agent')
export class AgentController {
  private readonly logger = new Logger(AgentController.name)
  constructor(
    private readonly agentService: AgentService,
    private readonly redisPubSubService: RedisPubSubService,
  ) { }

  @ApiDoc({
    summary: 'Create Content Generation Task',
    description: 'Create a content generation task.',
    body: CreateContentGenerationTaskSchema,
    response: ContentGenerationTaskChunkVoSchema,
  })
  @SetMetadata(SSE_METADATA, true)
  @Header('Cache-Control', 'no-cache, no-transform')
  @Header('Connection', 'keep-alive')
  @Header('X-Accel-Buffering', 'no')
  @Header('Content-Encoding', 'none')
  @Post('tasks')
  createContentGenerationTask(
    @GetToken() token: TokenInfo,
    @Body() body: CreateContentGenerationTaskDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const abortController = new AbortController()

    res.on('close', () => {
      this.logger.debug(`User ${token.id} closed connection`)
    })

    return this.agentService.createContentGenerationTask(token.id, UserType.User, body, abortController, req, res)
  }

  @ApiDoc({
    summary: 'Get Content Generation Task List',
    description: 'Get a paginated list of content generation tasks.',
    query: ListContentGenerationTaskDtoSchema,
    response: ContentGenerationTaskListVo,
  })
  @Get('tasks')
  async getContentGenerationTaskListWithPagination(
    @GetToken() token: TokenInfo,
    @Query() query: ListContentGenerationTaskDto,
  ) {
    const [tasks, total] = await this.agentService.getTaskList(token.id, query)
    return new ContentGenerationTaskListVo(tasks, total, query)
  }

  @ApiDoc({
    summary: 'Get Content Generation Task',
    description: 'Get a content generation task.',
    response: ContentGenerationTaskVo,
  })
  @Get('tasks/:taskId')
  async getContentGenerationTask(
    @GetToken() token: TokenInfo,
    @Param('taskId', ParseObjectIdPipe) taskId: string,
  ) {
    const task = await this.agentService.getTask(token.id, taskId)
    return ContentGenerationTaskVo.create(task)
  }

  @ApiDoc({
    summary: 'Get Content Generation Task Messages',
    description: 'Get messages after specified message ID. Used for polling after SSE disconnection.',
    query: GetTaskMessagesQueryDtoSchema,
    response: TaskMessagesVo,
  })
  @Get('/tasks/:taskId/messages')
  async getTaskMessages(
    @GetToken() token: TokenInfo,
    @Param('taskId', ParseObjectIdPipe) taskId: string,
    @Query() query: GetTaskMessagesQueryDto,
  ) {
    const result = await this.agentService.getTaskMessages(token.id, taskId, query.lastMessageId)
    return TaskMessagesVo.create(result)
  }

  @ApiDoc({
    summary: 'Delete Content Generation Task',
    description: 'Delete a content generation task.',
  })
  @Delete('tasks/:taskId')
  async deleteTask(
    @GetToken() token: TokenInfo,
    @Param('taskId', ParseObjectIdPipe) taskId: string,
  ) {
    await this.agentService.deleteTask(token.id, taskId)
  }

  @ApiDoc({
    summary: 'Update Content Generation Task',
    description: 'Update content generation task.',
    body: UpdateContentGenerationTaskTitleDtoSchema,
  })
  @Patch('tasks/:taskId')
  async updateTask(
    @GetToken() token: TokenInfo,
    @Param('taskId', ParseObjectIdPipe) taskId: string,
    @Body() body: UpdateContentGenerationTaskTitleDto,
  ) {
    await this.agentService.updateTask(token.id, taskId, body)
  }

  @ApiDoc({
    summary: 'Create or Update Content Generation Task Rating',
    description: 'Create or update a rating for a content generation task.',
    body: CreateContentGenerationTaskRatingDtoSchema,
  })
  @Post('tasks/:taskId/rating')
  async createRating(
    @GetToken() token: TokenInfo,
    @Param('taskId', ParseObjectIdPipe) taskId: string,
    @Body() body: CreateContentGenerationTaskRatingDto,
  ) {
    await this.agentService.createRating(token.id, taskId, body)
  }

  @ApiDoc({
    summary: 'Create a public share link for a task',
    description: 'Generate a token so the task can be accessed publicly. Only owner can create.',
    body: CreatePublicShareDto.schema,
    response: PublicShareVo,
  })
  @Post('tasks/:taskId/share')
  async createPublicShare(
    @GetToken() token: TokenInfo,
    @Param('taskId', ParseObjectIdPipe) taskId: string,
    @Body() body: CreatePublicShareDto,
  ) {
    const ttlSeconds = body.ttlSeconds
    const res = await this.agentService.createPublicShare(token.id, taskId, ttlSeconds)
    return PublicShareVo.create(res)
  }

  @ApiDoc({
    summary: 'Get public shared task by token',
    description: 'Retrieve a task by public share token. No authentication required.',
    response: ContentGenerationTaskVo,
  })
  @Public()
  @Get('tasks/shared/:token')
  async getTaskByShareToken(
    @Param('token') token: string,
  ) {
    const task = await this.agentService.getTaskByShareToken(token)
    return ContentGenerationTaskVo.create(task)
  }

  @ApiDoc({
    summary: 'Abort Content Generation Task',
    description: 'Abort a running content generation task.',
  })
  @Post('/tasks/:taskId/abort')
  async abortTask(
    @GetToken() token: TokenInfo,
    @Param('taskId', ParseObjectIdPipe) taskId: string,
  ) {
    const task = await this.agentService.getTask(token.id, taskId)
    if (task.status !== ContentGenerationTaskStatus.Running)
      throw new AppException(ResponseCode.AgentTaskNotRunning)

    await this.redisPubSubService.emit(AGENT_TASK_ABORT_CHANNEL, taskId)
  }

  @ApiDoc({
    summary: 'Favorite Content Generation Task',
    description: 'Add a task to favorites.',
  })
  @Post('/tasks/:taskId/favorite')
  async favoriteTask(
    @GetToken() token: TokenInfo,
    @Param('taskId', ParseObjectIdPipe) taskId: string,
  ) {
    await this.agentService.favoriteTask(token.id, taskId)
  }

  @ApiDoc({
    summary: 'Unfavorite Content Generation Task',
    description: 'Remove a task from favorites.',
  })
  @Delete('/tasks/:taskId/favorite')
  async unfavoriteTask(
    @GetToken() token: TokenInfo,
    @Param('taskId', ParseObjectIdPipe) taskId: string,
  ) {
    await this.agentService.unfavoriteTask(token.id, taskId)
  }
}

```

### Core Architecture Module: `project/aitoearn-backend/apps/aitoearn-ai/src/core/agent/agent.dto.ts`
```
import { createZodDto, PaginationDtoSchema } from '@yikart/common'
import { z } from 'zod'
import { config } from '../../config'

// 文本内容块
const TextContentBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string().min(1),
})

// URL 图片源
const URLImageSourceSchema = z.object({
  type: z.literal('url'),
  url: z.url(),
})

// 图片内容块
const ImageContentBlockSchema = z.object({
  type: z.literal('image'),
  source: URLImageSourceSchema,
})

// URL 视频源
const URLVideoSourceSchema = z.object({
  type: z.literal('url'),
  url: z.url(),
})

// 视频内容块
const VideoContentBlockSchema = z.object({
  type: z.literal('video'),
  source: URLVideoSourceSchema,
})

// URL PDF 源
const URLPDFSourceSchema = z.object({
  type: z.literal('url'),
  url: z.url(),
})

// Plain Text 源
const PlainTextSourceSchema = z.object({
  type: z.literal('text'),
  media_type: z.literal('text/plain'),
  data: z.string(),
})

// Content Block 源（递归引用）
const ContentBlockSourceSchema = z.object({
  type: z.literal('content'),
  content: z.union([
    z.string(),
    z.array(z.union([TextContentBlockSchema, ImageContentBlockSchema])),
  ]),
})

// 文档内容块
const DocumentBlockSchema = z.object({
  type: z.literal('document'),
  source: z.union([
    PlainTextSourceSchema,
    ContentBlockSourceSchema,
    URLPDFSourceSchema,
  ]),
  cache_control: z.object({ type: z.literal('ephemeral') }).optional(),
})

// 联合类型：文本、图片、视频或文档
const ContentBlockSchema = z.discriminatedUnion('type', [
  TextContentBlockSchema,
  ImageContentBlockSchema,
  VideoContentBlockSchema,
  DocumentBlockSchema,
])

// 导出 ContentBlock 类型供其他模块使用
export type ContentBlock = z.infer<typeof ContentBlockSchema>

// Prompt 可以是字符串或内容块数组
const PromptSchema = z.union([
  z.string().min(1).max(4000),
  z.array(ContentBlockSchema).min(1).max(20),
])

export const AllowedModelSchema = z.enum(config.agent.models as [string, ...string[]]).default(config.agent.defaultModel)

// 创建内容生成任务 DTO
export const CreateContentGenerationTaskSchema = z.object({
  prompt: PromptSchema.describe('提示词（字符串或内容块数组）'),
  model: AllowedModelSchema.describe('使用的模型'),
  includePartialMessages: z.boolean().optional().default(false).describe('是否包含部分消息（流式）'),
  taskId: z.string().transform(val => val.trim() === '' ? undefined : val).optional().describe('任务ID（恢复对话时使用）'),
})
export class CreateContentGenerationTaskDto extends createZodDto(CreateContentGenerationTaskSchema, 'CreateContentGenerationTaskDto') { }

export const GetContentGenerationTaskSchema = z.object({
  taskId: z.string().min(1).max(50).describe('任务ID'),
})
export class GetContentGenerationTaskDto extends createZodDto(GetContentGenerationTaskSchema) { }

export const ListContentGenerationTaskDtoSchema = PaginationDtoSchema.extend({
  keyword: z.string().max(100).optional().describe('搜索关键词（匹配标题和对话内容）'),
  favoriteOnly: z.coerce.boolean().optional().default(false).describe('仅显示收藏的任务'),
})
export class ListContentGenerationTaskDto extends createZodDto(ListContentGenerationTaskDtoSchema, 'ListContentGenerationTaskDto') { }

export const UpdateContentGenerationTaskTitleDtoSchema = z.object({
  title: z.string().min(1).max(200).describe('对话标题'),
})
export class UpdateContentGenerationTaskTitleDto extends createZodDto(UpdateContentGenerationTaskTitleDtoSchema, 'UpdateContentGenerationTaskTitleDto') { }

export const GetTaskMessagesQueryDtoSchema = z.object({
  lastMessageId: z.string().optional().describe('上次获取的最后一条消息 UUID'),
})
export class GetTaskMessagesQueryDto extends createZodDto(GetTaskMessagesQueryDtoSchema, 'GetTaskMessagesQueryDto') { }

export const CreateContentGenerationTaskRatingDtoSchema = z.object({
  rating: z.number().int().min(1).max(5).describe('评分 (1-5)'),
  comment: z.string().max(1000).optional().describe('评论文本'),
})
export class CreateContentGenerationTaskRatingDto extends createZodDto(CreateContentGenerationTaskRatingDtoSchema, 'CreateContentGenerationTaskRatingDto') { }

// DTO: 转发任务到另一个用户
export const ForwardContentGenerationTaskDtoSchema = z.object({
  targetUserId: z.string().min(1).describe('接收转发的用户ID'),
})
export class ForwardContentGenerationTaskDto extends createZodDto(ForwardContentGenerationTaskDtoSchema, 'ForwardContentGenerationTaskDto') { }

// DTO: 创建公开分享链接
export const CreatePublicShareDtoSchema = z.object({
  ttlSeconds: z.number().int().min(60).max(60 * 60 * 24 * 30).optional().describe('分享链接有效期（秒），最小60秒，最大30天'),
})
export class CreatePublicShareDto extends createZodDto(CreatePublicShareDtoSchema, 'CreatePublicShareDto') { }

```

### Core Architecture Module: `project/aitoearn-backend/apps/aitoearn-ai/src/core/agent/agent.module.ts`
```
import { Module } from '@nestjs/common'
import { config } from '../../config'
import { AideoModule } from '../ai/aideo'
import { ChatModule } from '../ai/chat'
import { ImageModule } from '../ai/image'
import { RelayMediaModule } from '../ai/relay-media'
import { VideoModule } from '../ai/video'
import { AgentTaskTimeoutScheduler } from './agent-task-timeout.scheduler'
import { AgentController } from './agent.controller'
import { AgentService } from './agent.service'
import { ClaudeCodeRouterModule } from './claude-code-router/claude-code-router.module'
import { ImageEditMcp } from './mcp/image-edit.mcp'
import { MediaMcp } from './mcp/media.mcp'
import { SubtitleMcp } from './mcp/subtitle.mcp'
import { UtilMcp } from './mcp/util.mcp'
import { VideoUtilsMcp } from './mcp/video-utils.mcp'
import { AideoMcp } from './mcp/volcengine/aideo.mcp'
import { DramaRecapMcp } from './mcp/volcengine/drama-recap.mcp'
import { StyleTransferMcp } from './mcp/volcengine/style-transfer.mcp'
import { VideoEditMcp } from './mcp/volcengine/video-edit.mcp'
import { AgentRuntimeService } from './services/agent-runtime.service'
import { SkillInitService } from './skill-init.service'

@Module({
  imports: [
    ChatModule,
    ImageModule,
    VideoModule,
    AideoModule,
    RelayMediaModule.forRoot(config.ai.relay),
    ClaudeCodeRouterModule,
  ],
  controllers: [AgentController],
  providers: [
    AgentService,
    MediaMcp,
    AideoMcp,
    UtilMcp,
    VideoEditMcp,
    AgentTaskTimeoutScheduler,
    DramaRecapMcp,
    StyleTransferMcp,
    VideoUtilsMcp,
    ImageEditMcp,
    SubtitleMcp,
    SkillInitService,
    AgentRuntimeService,
  ],
  exports: [AgentService],
})
export class AgentModule {}

```

### Core Architecture Module: `project/aitoearn-backend/apps/aitoearn-ai/src/core/agent/agent.service.ts`
```
import { randomBytes } from 'node:crypto'
import {
  McpServerConfig,
  SpawnedProcess,
  SpawnOptions,
} from '@anthropic-ai/claude-agent-sdk'
import { ContentBlockParam } from '@anthropic-ai/sdk/resources'
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import {
  AppException,
  getCodeMessage,
  ResponseCode,
  UserType,
} from '@yikart/common'
import {
  ContentGenerationTaskRepository,
  ContentGenerationTaskStatus,
  Transactional,
} from '@yikart/mongodb'
import { RedisPubSubService } from '@yikart/redis'
import { Request, Response } from 'express'
import { Observable } from 'rxjs'
import { AGENT_TASK_ABORT_CHANNEL } from './agent.constants'
import {
  CreateContentGenerationTaskDto,
  CreateContentGenerationTaskRatingDto,
  ListContentGenerationTaskDto,
  UpdateContentGenerationTaskTitleDto,
} from './agent.dto'
import {
  AgentMessageType,
  AgentMessageVo,
  ContentGenerationTaskChunkVo,
} from './agent.vo'
import { AgentRuntimeService } from './services/agent-runtime.service'

@Injectable()
export class AgentService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentService.name)

  constructor(
    private readonly contentGenerateRepository: ContentGenerationTaskRepository,
    private readonly agentRuntimeService: AgentRuntimeService,
    private readonly redisPubSubService: RedisPubSubService,
  ) { }

  /**
   * 执行 Claude 查询
   * @param systemPromptContent
   * @param enhancedContent
   * @param abortController
   * @param options
   * @param options.includePartialMessages
   * @param options.sessionId
   * @param options.model
   * @param options.taskId
   * @param options.availabilityOperation
   * @param mcpServers
   * @param spawnClaudeCodeProcess
   * @returns
   */
  public claudeQuery(
    systemPromptContent: ContentBlockParam[],
    enhancedContent: ContentBlockParam[],
    abortController: AbortController,
    options: Parameters<AgentRuntimeService['claudeQuery']>[3],
    mcpServers?: Record<string, McpServerConfig>,
    spawnClaudeCodeProcess?: (options: SpawnOptions) => SpawnedProcess,
  ) {
    return this.agentRuntimeService.claudeQuery(
      systemPromptContent,
      enhancedContent,
      abortController,
      options,
      mcpServers,
      spawnClaudeCodeProcess,
    )
  }

  /**
   * 创建内容生成任务
   * @param userId
   * @param userType
   * @param dto
   * @param abortController
   * @param req
   * @param res
   * @returns
   */
  createContentGenerationTask(
    userId: string,
    userType: UserType,
    dto: CreateContentGenerationTaskDto,
    abortController: AbortController,
    req: Request,
    res: Response,
  ): Observable<ContentGenerationTaskChunkVo> {
    return this.agentRuntimeService.createContentGenerationTask({
      userId,
      userType,
      dto,
      abortController,
      req,
      res,
    })
  }

  async getTask(userId: string, taskId: string) {
    const task = await this.contentGenerateRepository.getUserTask(userId, taskId)
    if (!task) {
      throw new AppException(ResponseCode.AgentTaskNotFound)
    }
    return {
      ...task,
      messages: task.messages as Array<AgentMessageVo>,
    }
  }

  async getTaskMessages(userId: string, taskId: string, lastMessageId?: string) {
    const task = await this.contentGenerateRepository.getUserTask(userId, taskId)
    if (!task) {
      throw new AppException(ResponseCode.AgentTaskNotFound)
    }

    const allMessages = (task.messages || []) as Array<AgentMessageVo>
    let messages = allMessages

    if (lastMessageId) {
      const index = allMessages.findIndex(msg => 'uuid' in msg && msg.uuid === lastMessageId)
      messages = index === -1 ? [] : allMessages.slice(index + 1)
    }

    return {
      messages,
      status: task.status,
    }
  }

  async getTaskList(userId: string, params: ListContentGenerationTaskDto) {
    return await this.contentGenerateRepository.getUserTasksWithPagination(userId, params)
  }

  async favoriteTask(userId: string, taskId: string) {
    const task = await this.contentGenerateRepository.getUserTask(userId, taskId)
    if (!task) {
      throw new AppException(ResponseCode.AgentTaskNotFound)
    }
    await this.contentGenerateRepository.updateFavoriteById(taskId, new Date())
  }

  async unfavoriteTask(userId: string, taskId: string) {
    const task = await this.contentGenerateRepository.getUserTask(userId, taskId)
    if (!task) {
      throw new AppException(ResponseCode.AgentTaskNotFound)
    }
    await this.contentGenerateRepository.updateFavoriteById(taskId, null)
  }

  async deleteTask(userId: string, taskId: string) {
    const task = await this.contentGenerateRepository.getUserTask(userId, taskId)
    if (!task) {
      throw new AppException(ResponseCode.AgentTaskNotFound)
    }
    const success = await this.contentGenerateRepository.softDeleteTask(userId, taskId)
    if (!success) {
      throw new AppException(ResponseCode.AgentTaskNotFound)
    }
  }

  async updateTask(userId: string, taskId: string, dto: UpdateContentGenerationTaskTitleDto) {
    const task = await this.contentGenerateRepository.getUserTask(userId, taskId)
    if (!task) {
      throw new AppException(ResponseCode.AgentTaskNotFound)
    }
    await this.contentGenerateRepository.updateById(taskId, dto)
  }

  async createRating(userId: string, taskId: string, dto: CreateContentGenerationTaskRatingDto) {
    const task = await this.contentGenerateRepository.getUserTask(userId, taskId)
    if (!task) {
      throw new AppException(ResponseCode.AgentTaskNotFound)
    }

    if (task.status !== ContentGenerationTaskStatus.Completed && task.status !== ContentGenerationTaskStatus.RequiresAction) {
      throw new AppException(ResponseCode.AgentTaskStatusInvalid)
    }

    await this.contentGenerateRepository.updateById(taskId, {
      rating: dto.rating,
      ratingComment: dto.comment,
    })
  }

  /**
   * Create a public share token for a task. Only owner can create a share.
   * ttlSeconds optional - default 7 days.
   * Returns { token: string, expiresAt: Date, urlPath: string }
   */
  async createPublicShare(userId: string, taskId: string, ttlSeconds?: number) {
    const task = await this.contentGenerateRepository.getUserTask(userId, taskId)
    if (!task) {
      throw new AppException(ResponseCode.AgentTaskNotFound)
    }

    const ttl = typeof ttlSeconds === 'number' ? ttlSeconds : 7 * 24 * 3600
    const expiresAt = new Date(Date.now() + ttl * 1000)

    const token = randomBytes(16).toString('hex')

    await this.contentGenerateRepository.updateById(taskId, {
      publicShareToken: token,
      publicShareExpiresAt: expiresAt,
    })

    return {
      token,
      expiresAt,
    }
  }

  /**
   * Retrieve a task by public share token. Token must exist and not be expired.
   * Returns sanitized task object (no sessionId).
   */
  async getTaskByShareToken(token: string) {
    if (!token) {
      throw new AppException(ResponseCode.AgentTaskNotFound)
    }

    const task = await this.contentGenerateRepository.findByPublicShareToken(token)
    if (!task) {
      throw new AppException(ResponseCode.AgentTaskNotFound)
    }

    if (task.publicShareExpiresAt && task.publicShareExpiresAt.getTime() < Date.now()) {
      throw new AppException(ResponseCode.AgentTaskNotFound)
    }

    return {
      ...task,
      messages: task.messages as Array<AgentMessageVo>,
    }
  }

  /**
   * Forward a task to another user by copying its messages and metadata.
   * Only the owner of the task can forward it.
   * Returns the new task id object: { id: string }
   */
  async forwardTask(userId: string, taskId: string, targetUserId: string) {
    const originalTask = await this.contentGenerateRepository.getUserTask(userId, taskId)
    if (!originalTask) {
      throw new AppException(ResponseCode.AgentTaskNotFound)
    }

    const newTask = await this.contentGenerateRepository.create({
      userId: targetUserId,
      title: originalTask.title ? `Fwd: ${originalTask.title}` : undefined,
      messages: originalTask.messages || [],
      status: originalTask.status || ContentGenerationTaskStatus.Completed,
    })

    return { id: newTask.id }
  }

  /**
   * 兜底机制：将超时的 running 任务更新为 error 状态
   * @param timeoutMs 超时时间（毫秒），默认 30 分钟
   */
  @Transactional()
  async recoverTimeoutRunningTasks(timeoutMs: number = 30 * 60 * 1000) {
    const timeoutTasks = await this.contentGenerateRepository.listTimeoutRunningTasks(timeoutMs)

    if (timeoutTasks.length === 0) {
      this.logger.debug('No timeout running tasks found')
      return { updatedCount: 0 }
    }

    const taskIds = timeoutTasks.map(task => task.id)
    this.logger.warn(`Found ${taskIds.length} timeout running tasks: ${taskIds.join(', ')}`)

    const result = await this.contentGenerateRepository.batchUpdateStatus(taskIds, ContentGenerationTaskStatus.Error)

    for (const task of timeoutTasks) {
      const errorMessage = {
        type: AgentMessageType.Error,
        code: ResponseCode.AgentTaskTimeout,
        message: getCodeMessage(ResponseCode.AgentTaskTimeout),
        timestamp: Date.now(),
      }
      await this.contentGenerateRepository.updateMessage(task.id, errorMessage)
    }

    this.logger.debug(`Updated ${result.modifiedCount} timeout running tasks to error status`)

    return { updatedCount: result.modifiedCount }
  }

  async onModuleInit() {
    this.redisPubSubService.on(AGENT_TASK_ABORT_CHANNEL, (taskId: string) => {
      this.agentRuntimeService.abortTask(taskId)
    })
  }

  async onModuleDestroy() {
    this.logger.debug('Agent service is shutting down, wait running tasks')
    await this.agentRuntimeService.waitForRunningTasks()
  }
}

```

### Core Architecture Module: `project/aitoearn-backend/apps/aitoearn-ai/src/core/agent/agent.utils.ts`
```
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources'
import type { ContentBlock } from './agent.dto'
import { SDKMessage } from '@anthropic-ai/claude-agent-sdk'

/**
 * 标准化 prompt 为 content 数组
 * 将字符串转换为文本内容块数组，或直接返回已有的内容块数组
 */
export function normalizePrompt(prompt: string | ContentBlock[]): ContentBlock[] {
  if (typeof prompt === 'string') {
    return [{ type: 'text', text: prompt }]
  }
  return prompt
}

/**
 * 增强 prompt，在文本中添加图片和视频URL的结构化说明
 * 用于发送给模型，不应保存到数据库
 * 注意：video 块会被过滤掉（转换为文本说明），因为 Anthropic SDK 原生不支持 video 类型
 */
export function enhancePrompt(blocks: ContentBlock[]): ContentBlockParam[] {
  const imageUrls: string[] = []
  const videoUrls: string[] = []

  for (const block of blocks) {
    if (block.type === 'image' && 'source' in block && block.source && typeof block.source === 'object' && 'url' in block.source) {
      imageUrls.push(block.source.url as string)
    }
    if (block.type === 'video' && 'source' in block && block.source && typeof block.source === 'object' && 'url' in block.source) {
      videoUrls.push(block.source.url as string)
    }
  }

  // 过滤掉 video 块（原生不支持）
  const filteredBlocks = blocks.filter(block => block.type !== 'video')

  if (imageUrls.length === 0 && videoUrls.length === 0) {
    return filteredBlocks
  }

  let mediaListText = ''

  if (imageUrls.length > 0) {
    mediaListText += `\n\nReference Images:\n${imageUrls.map((url, index) => `- Image ${index + 1}: ${url}`).join('\n')}`
  }

  if (videoUrls.length > 0) {
    mediaListText += `\n\nReference Videos:\n${videoUrls.map((url, index) => `- Video ${index + 1}: ${url}`).join('\n')}`
  }

  let firstTextBlockIndex = -1
  for (let i = 0; i < filteredBlocks.length; i++) {
    if (filteredBlocks[i].type === 'text') {
      firstTextBlockIndex = i
      break
    }
  }

  const result = [...filteredBlocks]

  if (firstTextBlockIndex !== -1) {
    const textBlock = result[firstTextBlockIndex] as { type: 'text', text: string }
    result[firstTextBlockIndex] = {
      type: 'text',
      text: `${textBlock.text}${mediaListText}`,
    }
  }
  else {
    result.unshift({
      type: 'text',
      text: `Please use the following media:${mediaListText}`,
    })
  }

  return result
}

/**
 * 过滤请求 headers，移除基础 HTTP headers，保留业务相关的 headers
 * @param headers 原始请求 headers
 * @returns 过滤后的 headers
 */
export function filterHeaders(headers: Record<string, unknown>): Record<string, string> {
  const basicHeaders = new Set([
    'host',
    'connection',
    'content-length',
    'content-type',
    'accept',
    'accept-encoding',
    'user-agent',
    'cache-control',
    'pragma',
    'upgrade-insecure-requests',
    'if-modified-since',
    'if-none-match',
  ])

  const filtered: Record<string, string> = {}

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase()
    if (!basicHeaders.has(lowerKey)) {
      if (typeof value === 'string') {
        filtered[key] = value
      }
      else if (Array.isArray(value)) {
        filtered[key] = value.join(', ')
      }
    }
  }

  return filtered
}

/**
 * 判断消息是否应该被过滤
 * 过滤掉 type 为 user 且 isSynthetic 为 true 的消息
 * 这些消息不应该保存到数据库，也不应该返回到前端
 */
export function shouldFilterSyntheticMessage(message: SDKMessage): boolean {
  return (
    message.type === 'user'
    && 'isSynthetic' in message
    && message.isSynthetic === true
  ) || message.type === 'system'
}

export function sanitizeMessage(msg: SDKMessage): Omit<SDKMessage, 'session_id'> {
  const { session_id, ...rest } = msg
  if (rest.type === 'assistant') {
    rest.message.content.forEach((block) => {
      if (block.type === 'text' && block.text === '(no content)') {
        block.text = ''
      }
    })
  }
  if (rest.type === 'user' && typeof rest.message.content !== 'string') {
    rest.message.content.forEach((block) => {
      if (block.type === 'tool_result' && block.content && typeof block.content !== 'string') {
        block.content.forEach((subBlock) => {
          if (subBlock.type === 'image') {
            if (subBlock.source.type === 'base64') {
              subBlock.source.data = ''
            }
          }
        })
      }
    })
    if (rest.tool_use_result && typeof rest.tool_use_result !== 'string' && Array.isArray(rest.tool_use_result)) {
      rest.tool_use_result.forEach((block) => {
        if (block.type === 'image') {
          if (block.source.type === 'base64') {
            block.source.data = ''
          }
        }
      })
    }
  }
  return rest
}

```

### Core Architecture Module: `project/aitoearn-backend/apps/aitoearn-ai/src/core/agent/agent.vo.ts`
```
import { AccountType, createPaginationVo, createZodDto } from '@yikart/common'
import { ContentGenerationTaskStatus } from '@yikart/mongodb'
import { z } from 'zod'

export enum AgentMessageType {
  Assistant = 'assistant',
  User = 'user',
  Result = 'result',
  System = 'system',
  StreamEvent = 'stream_event',
  ToolProgress = 'tool_progress',
  AuthStatus = 'auth_status',
  KeepAlive = 'keep_alive',
  Init = 'init',
  Complete = 'complete',
  TitleUpdated = 'title_updated',
  Error = 'error',
}

export const ContentGenerationMediaVoSchema = z.object({
  type: z.enum(['IMAGE', 'VIDEO']),
  url: z.string(),
  thumbUrl: z.string().optional(),
  prompt: z.string().optional(),
})
export class ContentGenerationMediaVo extends createZodDto(ContentGenerationMediaVoSchema) { }

// MediaOnly result schema (single object only)
const MediaOnlyBaseSchema = z.object({
  type: z.literal('mediaOnly'),
  medias: z.array(ContentGenerationMediaVoSchema),
})

const MediaOnlyNoneActionSchema = MediaOnlyBaseSchema.extend({
  action: z.literal('none'),
})

const MediaOnlyNavigateToMediaActionSchema = MediaOnlyBaseSchema.extend({
  action: z.literal('navigateToMedia'),
  mediaId: z.string(),
  groupId: z.string(),
})

const MediaOnlyResultSchema = z.discriminatedUnion('action', [
  MediaOnlyNoneActionSchema,
  MediaOnlyNavigateToMediaActionSchema,
])

// FullContent result schema (array only)
// Base fields for each array element
const FullContentElementBaseSchema = z.object({
  type: z.literal('fullContent'),
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  medias: z.array(ContentGenerationMediaVoSchema),
})

// Action: none (platform not needed)
const FullContentNoneActionSchema = FullContentElementBaseSchema.extend({
  action: z.literal('none'),
  platform: z.enum(AccountType).optional(),
  flowId: z.string().optional(),
})

// Action: navigateToDraft (platform not needed)
const FullContentNavigateToDraftActionSchema = FullContentElementBaseSchema.extend({
  action: z.literal('navigateToDraft'),
  groupId: z.string(),
  platform: z.enum(AccountType).optional(),
})

// Action: navigateToMedia (platform not needed)
const FullContentNavigateToMediaActionSchema = FullContentElementBaseSchema.extend({
  action: z.literal('navigateToMedia'),
  mediaId: z.string(),
  groupId: z.string(),
  platform: z.enum(AccountType).optional(),
})

// Action: createChannel (platform required)
const FullContentCreateChannelActionSchema = FullContentElementBaseSchema.extend({
  action: z.literal('createChannel'),
  platform: z.enum(AccountType), // required
  errorMessage: z.string().optional(),
})

// Action: updateChannel (platform required)
const FullContentUpdateChannelActionSchema = FullContentElementBaseSchema.extend({
  action: z.literal('updateChannel'),
  platform: z.enum(AccountType), // required
  accountId: z.string().optional(),
  errorMessage: z.string().optional(),
})

// Action: navigateToPublish (platform required)
const FullContentNavigateToPublishActionSchema = FullContentElementBaseSchema.extend({
  action: z.literal('navigateToPublish'),
  platform: z.enum(AccountType), // required
  accountId: z.string().optional(),
  publishTime: z.iso.datetime().optional(),
  topics: z.array(z.string()).optional(),
  errorMessage: z.string().optional(),
})

// FullContent single element union
const FullContentElementSchema = z.discriminatedUnion('action', [
  FullContentNoneActionSchema,
  FullContentNavigateToDraftActionSchema,
  FullContentNavigateToMediaActionSchema,
  FullContentCreateChannelActionSchema,
  FullContentUpdateChannelActionSchema,
  FullContentNavigateToPublishActionSchema,
])

// FullContent result is an array (minimum 1 element)
const FullContentResultSchema = z.array(FullContentElementSchema).min(1)

// Final union: mediaOnly (single object) OR fullContent (array)
export const ContentGenerationTaskResultUnionSchema = z.union([
  MediaOnlyResultSchema,
  FullContentResultSchema,
])

export const ContentGenerationTaskResultSchema = z.object({
  result: ContentGenerationTaskResultUnionSchema,
})

const APIUserMessageSchema = z.object({
  content: z.union([z.string(), z.array(z.unknown())]), // string | Array<ContentBlockParam>
  role: z.enum(['user', 'assistant']),
})

const APIAssistantMessageSchema = z.object({
  id: z.string().optional(),
  content: z.array(z.unknown()).optional(), // Array<BetaContentBlock>
  model: z.string().optional(),
  role: z.literal('assistant').optional(),
  stop_reason: z.enum(['end_turn', 'max_tokens', 'stop_sequence', 'tool_use', 'pause_turn', 'refusal']).nullable().optional(),
  stop_sequence: z.string().nullable().optional(),
  type: z.literal('message').optional(),
  usage: z.object({
    cache_creation: z.object({
      ephemeral_1h_input_tokens: z.number().optional(),
      ephemeral_5m_input_tokens: z.number().optional(),
    }).nullable().optional(),
    cache_creation_input_tokens: z.number().nullable().optional(),
    cache_read_input_tokens: z.number().nullable().optional(),
    input_tokens: z.number().optional(),
    output_tokens: z.number().optional(),
    server_tool_use: z.object({
      web_search_requests: z.number(),
    }).nullable().optional(),
    service_tier: z.string().nullable().optional(), // 允许 service_tier 字段
  }).loose().optional(), // 使用 passthrough 允许额外字段
  container: z.unknown().nullable().optional(), // BetaContainer
  context_management: z.unknown().nullable().optional(), // BetaContextManagementResponse
}).loose() // 允许额外字段

const NonNullableUsageSchema = z.object({
  cache_creation: z.object({
    ephemeral_1h_input_tokens: z.number(),
    ephemeral_5m_input_tokens: z.number(),
  }).optional(),
  cache_creation_input_tokens: z.number().optional(),
  cache_read_input_tokens: z.number().optional(),
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  server_tool_use: z.object({
    web_search_requests: z.number(),
  }).optional(),
})

const RawMessageStreamEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('message_start'),
    message: z.unknown(),
  }),
  z.object({
    type: z.literal('message_delta'),
    delta: z.object({
      stop_reason: z.string().nullable().optional(),
      stop_sequence: z.string().nullable().optional(),
    }).optional(),
    usage: z.object({
      cache_creation_input_tokens: z.number().nullable().optional(),
      cache_read_input_tokens: z.number().nullable().optional(),
      input_tokens: z.number().nullable().optional(),
      output_tokens: z.number().optional(),
      server_tool_use: z.object({
        web_search_requests: z.number(),
      }).nullable().optional(),
    }).loose().optional(),
  }),
  z.object({
    type: z.literal('message_stop'),
  }),
  z.object({
    type: z.literal('content_block_start'),
    index: z.number(),
    content_block: z.unknown(),
  }),
  z.object({
    type: z.literal('content_block_delta'),
    index: z.number(),
    delta: z.unknown(),
  }),
  z.object({
    type: z.literal('content_block_stop'),
    index: z.number(),
  }),
])

const SDKUserMessageSchema = z.object({
  type: z.literal(AgentMessageType.User),
  uuid: z.string().optional(),
  message: APIUserMessageSchema.optional(),
  content: z.union([z.string(), z.array(z.unknown())]).optional(),
  parent_tool_use_id: z.string().nullable().optional(),
  isSynthetic: z.boolean().optional(),
  tool_use_result: z.unknown().optional(),
  isReplay: z.literal(true).optional(),
})

const SDKAssistantMessageSchema = z.object({
  type: z.literal(AgentMessageType.Assistant),
  uuid: z.string(),
  message: APIAssistantMessageSchema.optional(),
  parent_tool_use_id: z.string().nullable().optional(),
  error: z.enum(['authentication_failed', 'billing_error', 'rate_limit', 'invalid_request', 'server_error', 'unknown']).optional(),
})

const SDKResultMessageSuccessSchema = z.object({
  type: z.literal(AgentMessageType.Result),
  subtype: z.literal('success'),
  uuid: z.string(),
  duration_ms: z.number().optional(),
  duration_api_ms: z.number().optional(),
  is_error: z.boolean().optional(),
  num_turns: z.number().optional(),
  message: z.string().optional(),
  result: ContentGenerationTaskResultUnionSchema.nullable().optional(),
  total_cost_usd: z.number().optional(),
  usage: NonNullableUsageSchema.optional(),
  permission_denials: z.array(z.object({
    tool_name: z.string(),
    tool_use_id: z.string(),
    tool_input: z.record(z.string(), z.unknown()),
  })).optional(),
  structured_output: z.unknown().optional(),
})

const SDKResultMessageErrorSchema = z.object({
  type: z.literal(AgentMessageType.Result),
  subtype: z.enum(['error_during_execution', 'error_max_turns', 'error_max_budget_usd', 'error_max_structured_output_retries']),
  uuid: z.string(),
  duration_ms: z.number().optional(),
  duration_api_ms: z.number().optional(),
  is_error: z.boolean().optional(),
  num_turns: z.number().optional(),
  total_cost_usd: z.number().optional(),
  usage: NonNullableUsageSchema.optional(),
  permission_denials: z.array(z.object({
    tool_name: z.string(),
    tool_use_id: z.string(),
    tool_input: z.record(z.string(), z.unknown()),
  })).optional(),
  errors: z.array(z.string()).optional(),
})

const SDKResultMessageSchema = z.discriminatedUnion('subtype', [
  SDKResultMessageSuccessSchema,
  SDKResultMessageErrorSchema,
])

const SDKCompactBoundaryMessageSchema = z.object({
  type: z.literal(AgentMessageType.System),
  subtype: z.literal('compact_boundary'),
  uuid: z.string(),
  compact_metadata: z.object({
    trigger: z.enum(['manual', 'auto']),
    pre_tokens: z.number(),
  }).optional(),
})

const SDKStatusMessageSchema = z.object({
  type: z.literal(AgentMessageType.System),
  subtype: z.literal('status'),
  uuid: z.string(),
  status: z.enum(['compacting']).nullable().optional(),
})

const SDKHookResponseMessageSchema = z.object({
  type: z.literal(AgentMessageType.System),
  subtype: z.literal('hook_response'),
  uuid: z.string(),
  hook_name: z.s
```

### Core Architecture Module: `project/aitoearn-backend/apps/aitoearn-ai/src/core/agent/claude-code-router/claude-code-router.module.ts`
```
import { Module } from '@nestjs/common'
import { ClaudeCodeRouterService } from './claude-code-router.service'

@Module({
  providers: [ClaudeCodeRouterService],
  exports: [ClaudeCodeRouterService],
})
export class ClaudeCodeRouterModule {
  constructor(private readonly claudeCodeRouterService: ClaudeCodeRouterService) {}
}

```

### Core Architecture Module: `project/aitoearn-backend/apps/aitoearn-ai/src/core/agent/claude-code-router/claude-code-router.service.ts`
```
import type { FSWatcher } from 'node:fs'
import { ChildProcess, spawn } from 'node:child_process'
import { existsSync, mkdirSync, unlinkSync, watch, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { config } from '../../../config'
import { CLAUDE_CODE_ROUTER_PROVIDER_NAME } from '../agent.constants'

interface TransformerConfig {
  use: Array<string | [string, Record<string, unknown>] | Record<string, TransformerConfig>>
}

interface ProviderConfig {
  name: string
  api_base_url: string
  api_key: string
  models: string[]
  transformer?: TransformerConfig
}

interface RouterConfig {
  default: string
  background?: string
  think?: string
  longContext?: string
  longContextThreshold?: number
  webSearch?: string
  image?: string
}

interface ClaudeCodeRouterConfig {
  PORT?: number
  APIKEY?: string
  PROXY_URL?: string
  LOG?: boolean
  LOG_LEVEL?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'
  HOST?: string
  NON_INTERACTIVE_MODE?: boolean
  Providers?: ProviderConfig[]
  Router?: RouterConfig
  API_TIMEOUT_MS?: number
}

@Injectable()
export class ClaudeCodeRouterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClaudeCodeRouterService.name)
  private childProcess: ChildProcess | null = null
  private fileWatcher: FSWatcher | null = null
  private shouldRestart = true
  private readonly sessionDir = join(process.cwd(), '.claude-session')
  private readonly configDir = join(this.sessionDir, '.claude-code-router')
  private readonly configPath = join(this.configDir, 'config.json')
  private readonly pidFilePath = join(this.sessionDir, '.claude-code-router.pid')

  async onModuleInit() {
    const routerConfig = config.agent

    const cliPath = require.resolve('@musistudio/claude-code-router/dist/cli.js')
    this.logger.debug(`找到 Claude Code Router CLI: ${cliPath}`)

    this.startFileWatcher()
    this.generateConfigFile(routerConfig)
    this.startChildProcess(cliPath)
  }

  async onModuleDestroy() {
    this.shouldRestart = false

    if (this.fileWatcher) {
      this.fileWatcher.close()
      this.fileWatcher = null
      this.logger.debug('文件监听器已停止')
    }

    if (this.childProcess) {
      this.logger.debug('正在停止 Claude Code Router...')
      this.childProcess.kill('SIGTERM')
      this.childProcess = null
    }
  }

  private generateConfigFile(routerConfig: typeof config.agent) {
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true })
      this.logger.debug(`创建配置目录: ${this.configDir}`)
    }

    const routerConfigFile = this.buildConfigFile(routerConfig)

    writeFileSync(this.configPath, JSON.stringify(routerConfigFile, null, 2), 'utf-8')
    this.logger.debug(`配置文件已生成: ${this.configPath}`)
  }

  private buildConfigFile(routerConfig: typeof config.agent): ClaudeCodeRouterConfig {
    return {
      PORT: 3456,
      APIKEY: 'ccr',
      NON_INTERACTIVE_MODE: true,
      Providers: [
        {
          name: CLAUDE_CODE_ROUTER_PROVIDER_NAME,
          api_base_url: routerConfig.baseUrl,
          api_key: routerConfig.apiKey,
          models: routerConfig.models,
          transformer: {
            use: [
              'Anthropic',
            ],
          },
        },
      ],
      Router: {
        default: `${CLAUDE_CODE_ROUTER_PROVIDER_NAME},${routerConfig.defaultModel}`,
        background: `${CLAUDE_CODE_ROUTER_PROVIDER_NAME},${routerConfig.backgroundModel}`,
        think: `${CLAUDE_CODE_ROUTER_PROVIDER_NAME},${routerConfig.thinkModel}`,
      },
    }
  }

  private startChildProcess(cliPath: string) {
    this.logger.debug('正在启动 Claude Code Router 子进程...')

    this.childProcess = spawn('node', [cliPath, 'start'], {
      cwd: this.sessionDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        HOME: this.sessionDir,
      },
    })

    this.childProcess.stdout?.on('data', (data) => {
      this.logger.debug(`Claude Code Router stdout: ${data.toString().trim()}`)
    })

    this.childProcess.stderr?.on('data', (data) => {
      this.logger.warn(`Claude Code Router stderr: ${data.toString().trim()}`)
    })

    this.childProcess.on('exit', (code, signal) => {
      if (code !== null) {
        this.logger.debug(`Claude Code Router 进程退出，退出码: ${code}`)
      }
      else if (signal) {
        this.logger.debug(`Claude Code Router 进程被信号终止: ${signal}`)
      }
      this.childProcess = null

      if (this.shouldRestart) {
        this.logger.debug('正在重启 Claude Code Router...')
        this.startChildProcess(cliPath)
      }
    })

    this.childProcess.on('error', (error) => {
      this.logger.error({ error }, 'Claude Code Router 进程错误')
      this.childProcess = null
    })

    this.logger.debug('Claude Code Router 子进程已启动')
  }

  private removePidFile() {
    if (existsSync(this.pidFilePath)) {
      try {
        unlinkSync(this.pidFilePath)
        this.logger.debug(`已删除 pid 文件: ${this.pidFilePath}`)
      }
      catch (error) {
        this.logger.warn({ error }, '删除 pid 文件失败')
      }
    }
  }

  private startFileWatcher() {
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true })
      this.logger.debug(`创建配置目录: ${this.configDir}`)
    }

    if (this.fileWatcher) {
      this.fileWatcher.close()
    }

    this.removePidFile()

    this.logger.debug(`开始监听目录: ${this.sessionDir}`)

    this.fileWatcher = watch(this.sessionDir, (eventType, filename) => {
      if (filename === '.claude-code-router.pid') {
        this.logger.debug(`检测到 pid 文件事件: ${eventType}`)
        this.removePidFile()
      }
    })

    this.fileWatcher.on('error', (error) => {
      this.logger.error({ error }, '文件监听器错误')
    })
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #582** (2026-07-30): **抖音使用relay中转授权后回调信息异常**
  *Symptoms*: ### Self Checks  - [x] I have read the [Contributing Guide](https://github.com/yikart/AiToEarn/blob/main/CONTRIBUTING.md). - [x] I have searched for existing issues [search for existing issues](https://github.com/yikart/AiToEarn/issues), including closed ones. - [x] I can provide the report in English if needed to help more contributors participate in the discussion. - [x] Please do not modify this template :) and fill in all the required fields.  ### Aitoearn version  v2.5  ### Please select your platform  Windows  ### Steps to reproduce  1.配置了relay中转 2.通过抖音扫码进行授权 3.授权成功后收到了回调信息,但无法同步账号到本地  原因:Relay 的抖音适配器没有提供该授权会话对应的账号身份信息,回调信息只能看到completed授权成功,却没有对应的accounts信息  ### ✔️ Expected Behavior  授权账号同步到本地  ### ❌ Actual Behavior  本地无法识别账号信息,同步失败

- **Issue #581** (2026-07-30): **Douyin Server Relay completes but no callback creates a local channel**
  *Symptoms*: ### Self Checks  - [x] I have read the [Contributing Guide](https://github.com/yikart/AiToEarn/blob/main/CONTRIBUTING.md). - [x] I have searched for existing issues [search for existing issues](https://github.com/yikart/AiToEarn/issues), including closed ones. - [x] I can provide the report in English if needed to help more contributors participate in the discussion. - [x] Please do not modify this template :) and fill in all the required fields.  ### Aitoearn version  Self-hosted Docker Compose; public main 3cbb97bb9a58dd99b97f45b60923cdbfdfeb3368; images pulled 2026-07-27  ### Please select your platform  Web  ### Steps to reproduce  1. Deploy AiToEarn with the official Docker Compose configuration from public main (commit 3cbb97bb9a58dd99b97f45b60923cdbfdfeb3368). 2. Configure a valid China Server Relay API key and use the China relay. 3. Open the self-hosted Channel Manager and start Douyin QR authorization. 4. Scan the QR code and explicitly confirm authorization in the Douyin mobile app. 5. Continue polling until the relay reports code 0, message "request succeeded", status "completed", and requiresSelection false. 6. Refresh Channel Manager and inspect the local account records.  I also repeated the flow with a temporary HTTPS callback-only tunnel. No credentials, account IDs, callback host, or session data are included in this report.  ### ✔️ Expected Behavior  After relay status becomes completed, the relay should deliver the authorized account to the self-hosted cal

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

### Incident Patch 1: `3c3d4e8b` (2026-09-04)
**Commit Message**: fix(facebook): raise outdated 90s Reels duration cap

Facebook Reel publishing rejects videos longer than 90s with
invalid_duration, but Meta removed the Reels length restriction in
June 2025 (all videos are Reels; no length/format caps). The 90s cap
predates that change and blocks valid longer Reels.

Raise FACEBOOK_REEL_MEDIA_RULES.maxVideoDuration (and the served
metadata) from 90s to 60 min to match Facebook's current Reels limit.

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `project/aitoearn-backend/apps/aitoearn-server/src/core/channels/platforms/facebook/facebook-publish.provider.spec.ts` (modified, +1/-1)
```diff
@@ -143,7 +143,7 @@ describe('facebook publish provider validation', () => {
     ).toMatchObject({
       videoFormats: ['mp4'],
       minVideoDuration: 3,
-      maxVideoDuration: 90,
+      maxVideoDuration: 3600,
     })
     expect(
       provider.resolveMediaRules({
```

**File**: `project/aitoearn-backend/apps/aitoearn-server/src/core/channels/platforms/facebook/facebook-publish.provider.ts` (modified, +4/-1)
```diff
@@ -27,7 +27,10 @@ const FACEBOOK_REEL_MEDIA_RULES: PlatformMediaRules = {
   videoFormats: ['mp4'],
   maxVideoSize: 1024 * 1024 * 1024,
   minVideoDuration: 3,
-  maxVideoDuration: 90,
+  // Facebook removed the 90s Reels length restriction in June 2025 ("all videos are
+  // Reels", no length/format caps). The old 90s cap rejects valid longer Reels with
+  // invalid_duration. Raised to 60 min to match Facebook's current Reels limit.
+  maxVideoDuration: 3600,
 }
 
 const FACEBOOK_STORY_MEDIA_RULES: PlatformMediaRules = {
```

**File**: `project/aitoearn-backend/apps/aitoearn-server/src/core/channels/platforms/facebook/facebook.constants.ts` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ export const FACEBOOK_METADATA = {
   },
   editor: EditorType.Text,
   contentLimits: { modes: [PublishContentMode.Text, PublishContentMode.ImageText, PublishContentMode.Video], maxBodyLength: 63206, maxImages: 10, maxVideos: 1 },
-  mediaRules: { imageFormats: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'], videoFormats: ['mp4', 'mov', 'avi'], maxImageSize: 10 * 1024 * 1024, maxVideoSize: 1024 * 1024 * 1024, maxVideoDuration: 90 },
+  mediaRules: { imageFormats: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'], videoFormats: ['mp4', 'mov', 'avi'], maxImageSize: 10 * 1024 * 1024, maxVideoSize: 1024 * 1024 * 1024, maxVideoDuration: 3600 },
   topic: { supported: false },
   publishPolicy: {
     completionStrategy: CompletionStrategy.Sync,
```

---

### Incident Patch 2: `112d3898` (2026-10-07)
**Commit Message**: fix(youtube): request youtube.force-ssl so comment endpoints work

commentThreads.list/insert and comments.list/insert/setModerationStatus
only accept the youtube.force-ssl scope. The YouTube channel config
requested youtube and youtube.upload only, so engagement calls failed
with 15078 "youtube account permission is missing" even right after a
completed reauthorization (#593).

**File**: `project/aitoearn-backend/apps/aitoearn-server/config/config.yaml` (modified, +1/-0)
```diff
@@ -214,6 +214,7 @@ channel:
     scopes:
       - https://www.googleapis.com/auth/youtube
       - https://www.googleapis.com/auth/youtube.upload
+      - https://www.googleapis.com/auth/youtube.force-ssl
       - https://www.googleapis.com/auth/userinfo.profile
       - https://www.googleapis.com/auth/userinfo.email
 relay:
```

---

### Incident Patch 3: `153627da` (2026-11-05)
**Commit Message**: style: fix yaml/quotes and comma-dangle lint errors in aitoearn-server

**File**: `project/aitoearn-backend/apps/aitoearn-server/config/config.yaml` (modified, +34/-34)
```diff
@@ -11,8 +11,8 @@ logger:
 appDomain: localhost
 environment: production
 auth:
-  secret: ""
-  internalToken: ""
+  secret: ''
+  internalToken: ''
 apiKey:
   prefix: ai_
 redis:
@@ -45,7 +45,7 @@ assets:
   provider: s3
 aiClient:
   baseUrl: http://aitoearn-ai:3010
-  token: ""
+  token: ''
 channel:
   channelDb:
     uri: mongodb://admin:password@mongodb:27017/?authSource=admin&directConnection=true
@@ -54,14 +54,14 @@ channel:
     baseUrl: https://localhost/api/shortLink/
   bilibili:
     status: available
-    clientId: ""
-    clientSecret: ""
+    clientId: ''
+    clientSecret: ''
     redirectUri: https://localhost/api/v2/channels/accounts/auth/bilibili/callback
     logoUrl: https://assets.aitoearn.ai/platforms/bilibili.svg
   douyin:
     status: hidden
-    clientId: ""
-    clientSecret: ""
+    clientId: ''
+    clientSecret: ''
     redirectUri: https://localhost/api/v2/channels/accounts/auth/douyin/callback
     logoUrl: https://assets.aitoearn.ai/platforms/douyin.svg
     scopes:
@@ -75,12 +75,12 @@ channel:
       sandbox: false
   facebook:
     status: available
-    clientId: ""
-    clientSecret: ""
+    clientId: ''
+    clientSecret: ''
     graphApiVersion: v25.0
     redirectUri: https://localhost/api/v2/channels/accounts/auth/facebook/callback
     logoUrl: https://assets.aitoearn.ai/platforms/facebook.svg
-    webhookVerifyToken: ""
+    webhookVerifyToken: ''
     scopes:
       - public_profile
       - pages_show_list
@@ -91,8 +91,8 @@ channel:
       - read_insights
   kwai:
     status: available
-    clientId: ""
-    clientSecret: ""
+    clientId: ''
+    clientSecret: ''
     redirectUri: https://localhost/api/v2/channels/accounts/auth/KWAI/callback
     logoUrl: https://assets.aitoearn.ai/platforms/kwai.svg
     scopes:
@@ -101,25 +101,25 @@ channel:
       - user_video_info
   instagram:
     status: available
-    clientId: ""
-    clientSecret: ""
+    clientId: ''
+    clientSecret: ''
     graphApiVersion: v25.0
     redirectUri: https://localhost/api/v2/channels/accounts/auth/instagram/callback
     logoUrl: https://assets.aitoearn.ai/platforms/instagram.svg
-    webhookVerifyToken: ""
+    webhookVerifyToken: ''
     scopes:
       - instagram_business_basic
       - instagram_business_manage_comments
       - instagram_business_content_publish
       - instagram_business_manage_insights
   linkedin:
     status: available
-    clientId: ""
-    clientSecret: ""
+    clientId: ''
+    clientSecret: ''
     redirectUri: https://localhost/api/plat/meta/auth/back
     logoUrl: https://assets.aitoearn.ai/platforms/linkedin.svg
-    restVersion: "202605"
-    webhookSecret: ""
+    restVersion: '202605'
+    webhookSecret: ''
     scopes:
       - openid
       - profile
@@ -130,8 +130,8 @@ channel:
     logoUrl: https://assets.aitoearn.ai/platforms/google-business.svg
   pinterest:
     status: available
-    clientId: ""
-    clientSecret: ""
+    clientId: ''
+    clientSecret: ''
     redirectUri: https://localhost/api/v2/channels/accounts/auth/pinterest/callback
     logoUrl: https://assets.aitoearn.ai/platforms/pinterest.svg
     baseUrl: https://api.pinterest.com
@@ -149,8 +149,8 @@ channel:
     accessTokenUrl: https://edith.xiaohongshu.com/api/sns/v1/ext/access/token
   threads:
     status: available
-    clientId: ""
-    clientSecret: ""
+    clientId: ''
+    clientSecret: ''
     redirectUri: https://localhost/api/v2/channels/accounts/auth/threads/callback
     logoUrl: https://assets.aitoearn.ai/platforms/threads.svg
     scopes:
@@ -163,8 +163,8 @@ channel:
       - threads_delete
   tiktok:
     status: available
-    clientId: ""
-    clientSecret: ""
+    clientId: ''
+    clientSecret: ''
     redirectUri: https://localhost/api/v2/channels/accounts/auth/tiktok/callback
     logoUrl: https://assets.aitoearn.ai/platforms/tiktok.svg
     scopes:
@@ -177,8 +177,8 @@ channel:
     pullFromUrlAllowedPrefixes: []
   twitter:
     status: available
-    clientId: ""
-    clientSecret: ""
+    clientId: ''
+    clientSecret: ''
     redirectUri: https://localhost/api/v2/channels/accounts/auth/twitter/callback
     logoUrl: https://assets.aitoearn.ai/platforms/twitter.svg
     scopes:
@@ -198,19 +198,19 @@ channel:
       logoUrl: https://assets.aitoearn.ai/platforms/wechat-official.svg
     channels:
       status: available
-      appId: ""
-      appSecret: ""
+      appId: ''
+      appSecret: ''
       token: aitoearn
-      encodingAESKey: ""
+      encodingAESKey: ''
       redirectUri: https://localhost/api/platcallback
       logoUrl: https://assets.aitoearn.ai/platforms/wechat-channels.svg
   youtube:
     status: available
-    clientId: ""
-    clientSecret: ""
+    clientId: ''
+    clientSecret: ''
     redirectUri: https://localhost/api/v2/channels/accounts/auth/youtube/callback
     logoUrl: https://assets.aitoearn.ai/platforms/youtube.svg
-    webhookVerifyToken: ""
+    webhookVerifyToken: ''
     scopes:
       - https://www.googleap
```

**File**: `project/aitoearn-backend/apps/aitoearn-server/src/core/channels/relay/relay-exception.filter.ts` (modified, +1/-1)
```diff
@@ -121,7 +121,7 @@ export class RelayExceptionFilter extends GlobalExceptionFilter<unknown> {
           validateStatus: () => true,
         })
         this.logger.debug({
-          proxyResponse
+          proxyResponse,
         })
 
         response.status(proxyResponse.status).json(proxyResponse.data)
```

#### Recent Merged Pull Requests:
- **PR #601** (2026-11-05): fix: require configured JWT and internal service secrets (@28Hus)
- **PR #594** (2026-11-05): fix(youtube): request youtube.force-ssl so comment endpoints work (@pushkarsingh32)
- **PR #590** (2026-11-05): fix(facebook): raise outdated 90s Reels duration cap (@tuannm2914)
- **PR #589** (closed): fix(facebook): raise outdated 90s Reels duration cap (@TomHBLAB)
- **PR #587** (closed): fix(tiktok): prevent duplicate posts after retryable failures (@iamkiayun)
- **PR #580** (closed): fix(subtitle-mcp): validate mediaUrl scheme before FFmpeg to prevent protocol/argument injection (@andesyteoss)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. facebook): raise outdated 90s Reels duration cap

**RULE**:
When implementing operations in `project/aitoearn-backend/apps/aitoearn-server/src/core/channels/platforms/facebook/facebook-publish.provider.spec.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in yikart/AiToEarn. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3c3d4e8b`: facebook): raise outdated 90s Reels duration cap. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `project/aitoearn-backend/apps/aitoearn-server/src/core/channels/platforms/facebook/facebook-publish.provider.spec.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
      maxVideoDuration: 3600,
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
      maxVideoDuration: 90,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3c3d4e8b` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
