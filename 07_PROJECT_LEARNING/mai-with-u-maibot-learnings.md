# Forensic Learning Record (Deep Inspection): Mai-with-u/MaiBot

> **Canonical Artifact**: `07_PROJECT_LEARNING/mai-with-u-maibot-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Mai-with-u/MaiBot](https://github.com/Mai-with-u/MaiBot))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:22:18.708Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Mai-with-u/MaiBot`
- **Description**: MaiSaka, an LLM-based intelligent agent, is a digital lifeform devoted to understanding you and interacting in the style of a real human. She does not pursue perfection, nor does she seek efficiency; instead, she values warmth, authenticity, and genuine connection.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 6114 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `dashboard/src/components/local-cache-image-utils.ts`
```
export const LOCAL_CACHE_IMAGE_PAGE_SIZE = 40

export type ImageDateFilters = {
  endDate: string
  startDate: string
}

export function formatLocalCacheBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** unitIndex
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

export function formatLocalCacheCleanupDescription(result: {
  removed_bytes?: number
  removed_files?: number
  removed_records?: number
  reclaimed_bytes?: number
  vacuumed?: boolean
}): string {
  const parts: string[] = []
  if (result.removed_files) {
    parts.push(`删除 ${result.removed_files} 个文件`)
  }
  if (result.removed_bytes) {
    parts.push(`释放 ${formatLocalCacheBytes(result.removed_bytes)}`)
  }
  if (result.removed_records) {
    parts.push(`移除 ${result.removed_records} 条记录`)
  }
  if (result.vacuumed) {
    parts.push(`VACUUM 释放 ${formatLocalCacheBytes(result.reclaimed_bytes ?? 0)}`)
  }
  return parts.length > 0 ? `${parts.join('，')}。` : '没有可清理的内容。'
}

```

### Core Architecture Module: `dashboard/src/components/markdown-renderer.tsx`
```
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import 'katex/dist/katex.min.css'
import type { ComponentPropsWithoutRef } from 'react'

interface MarkdownRendererProps {
  content: string
  className?: string
}

type MarkdownComponentProps<T extends 'code' | 'pre'> = ComponentPropsWithoutRef<T> & {
  node?: unknown
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={{
          // 自定义代码样式：块级样式交给 pre，避免行内反引号被渲染成独立代码块。
          code({ className, children, node, ...props }: MarkdownComponentProps<'code'>) {
            void node

            return (
              <code className={`${className ?? ''} bg-muted px-1.5 py-0.5 rounded text-sm font-mono`} {...props}>
                {children}
              </code>
            )
          },
          pre({ children, node, ...props }: MarkdownComponentProps<'pre'>) {
            void node

            return (
              <pre
                className="my-3 overflow-x-auto rounded-lg bg-muted p-4 text-sm [&>code]:block [&>code]:bg-transparent [&>code]:p-0"
                {...props}
              >
                {children}
              </pre>
            )
          },
          // 自定义表格样式
          table({ children, ...props }) {
            return (
              <div className="overflow-x-auto">
                <table className="border-collapse border border-border" {...props}>
                  {children}
                </table>
              </div>
            )
          },
          th({ children, ...props }) {
            return (
              <th className="border border-border bg-muted px-4 py-2 text-left font-semibold" {...props}>
                {children}
              </th>
            )
          },
          td({ children, ...props }) {
            return (
              <td className="border border-border px-4 py-2" {...props}>
                {children}
              </td>
            )
          },
          // 自定义链接样式
          a({ children, ...props }) {
            return (
              <a className="text-primary hover:underline" target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            )
          },
          // 自定义引用块样式
          blockquote({ children, ...props }) {
            return (
              <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground" {...props}>
                {children}
              </blockquote>
            )
          },
          // 自定义标题样式
          h1({ children, ...props }) {
            return (
              <h1 className="text-3xl font-bold mt-6 mb-4" {...props}>
                {children}
              </h1>
            )
          },
          h2({ children, ...props }) {
            return (
              <h2 className="text-2xl font-bold mt-5 mb-3" {...props}>
                {children}
              </h2>
            )
          },
          h3({ children, ...props }) {
            return (
              <h3 className="text-xl font-bold mt-4 mb-2" {...props}>
                {children}
              </h3>
            )
          },
          h4({ children, ...props }) {
            return (
              <h4 className="text-lg font-semibold mt-3 mb-2" {...props}>
                {children}
              </h4>
            )
          },
          // 自定义列表样式
          ul({ children, ...props }) {
            return (
              <ul className="list-disc list-inside space-y-1 my-2" {...props}>
                {children}
              </ul>
            )
          },
          ol({ children, ...props }) {
            return (
              <ol className="list-decimal list-inside space-y-1 my-2" {...props}>
                {children}
              </ol>
            )
          },
          // 自定义段落样式
          p({ children, ...props }) {
            return (
              <p className="my-2 leading-relaxed" {...props}>
                {children}
              </p>
            )
          },
          // 自定义分隔线样式
          hr({ ...props }) {
            return <hr className="my-4 border-border" {...props} />
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

```

### Core Architecture Module: `dashboard/src/components/plugin-webui-renderer.tsx`
```
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { resolveNodeValue } from '@/lib/plugin-webui'
import type { Scalar, WebUINode } from '@/lib/plugin-webui'

interface RendererProps {
  nodes: WebUINode[]
  data: Record<string, unknown>
  values: Record<string, Scalar>
  busy: boolean
  pendingData?: boolean
  onChange: (name: string, value: Scalar) => void
  onAction: (name: string) => void
}

function display(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') throw new Error('Expected a scalar display value')
  return String(value)
}

function NodeRenderer({ node, ...props }: Omit<RendererProps, 'nodes'> & { node: WebUINode }) {
  const { t } = useTranslation()
  const id = useId()
  const [tablePage, setTablePage] = useState(0)
  const awaitingData = props.pendingData && node.value !== null && typeof node.value === 'object'
  const value = awaitingData ? null : resolveNodeValue(node, props.data)
  const children = <PluginWebUIRenderer {...props} nodes={node.children} />
  const fieldValue = node.name === null ? null : props.values[node.name]
  const change = (next: Scalar) => {
    if (node.name !== null) props.onChange(node.name, next)
  }
  const heading = node.label ? <Label htmlFor={id}>{node.label}</Label> : null

  if (awaitingData)
    return (
      <p role="status" className="text-muted-foreground text-sm">
        {props.busy ? t('pluginWebUI.loading') : t('pluginWebUI.empty')}
      </p>
    )

  switch (node.type) {
    case 'stack':
      return (
        <section className="space-y-4">
          {heading}
          {children}
        </section>
      )
    case 'grid': {
      const columns = {
        1: 'md:grid-cols-1',
        2: 'md:grid-cols-2',
        3: 'md:grid-cols-3',
        4: 'md:grid-cols-4',
      }
      return (
        <section>
          {heading}
          <div
            className={`grid grid-cols-1 gap-4 ${columns[node.columns as keyof typeof columns]}`}
          >
            {children}
          </div>
        </section>
      )
    }
    case 'card':
      return (
        <Card>
          {node.label && (
            <CardHeader>
              <CardTitle>{node.label}</CardTitle>
            </CardHeader>
          )}
          <CardContent className="space-y-4 pt-6">{children}</CardContent>
        </Card>
      )
    case 'tabs':
      return (
        <Tabs defaultValue="0">
          <TabsList className="max-w-full overflow-x-auto">
            {node.children.map((child, index) => (
              <TabsTrigger key={index} value={String(index)}>
                {child.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {node.children.map((child, index) => (
            <TabsContent key={index} value={String(index)}>
              <NodeRenderer {...props} node={child} />
            </TabsContent>
          ))}
        </Tabs>
      )
    case 'text':
      return (
        <div className="space-y-2">
          {heading}
          <p className="text-muted-foreground break-words whitespace-pre-wrap">{display(value)}</p>
        </div>
      )
    case 'stat':
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm">{node.label}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{display(value)}</CardContent>
        </Card>
      )
    case 'input':
    case 'date':
      return (
        <div className="space-y-2">
          {heading}
          <Input
            id={id}
            disabled={props.busy}
            type={
              node.type === 'date' ? 'date' : typeof node.value === 'number' ? 'number' : 'text'
            }
            value={fieldValue === null || fieldValue === undefined ? '' : String(fieldValue)}
            maxLength={4000}
            onChange={(event) =>
              change(
                typeof node.value === 'number' && event.target.value !== ''
                  ? Number(event.target.value)
                  : event.target.value
              )
            }
          />
        </div>
      )
    case 'switch':
      return (
        <div className="flex items-center gap-3">
          <Switch
            id={id}
            disabled={props.busy}
            checked={fieldValue === true}
            onCheckedChange={change}
          />
          {heading}
        </div>
      )
    case 'select':
      return (
        <div className="space-y-2">
          {heading}
          <Select
            disabled={props.busy}
            value={typeof fieldValue === 'string' ? fieldValue : undefined}
            onValueChange={change}
          >
            <SelectTrigger id={id}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {node.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    case 'button':
      return (
        <Button
          disabled={props.busy}
          variant={
            node.variant === 'danger'
              ? 'destructive'
              : node.variant === 'muted'
                ? 'secondary'
                : 'default'
          }
          onClick={() => {
            if (node.action !== null) props.onAction(node.action)
          }}
        >
          {node.label}
        </Button>
      )
    case 'table': {
      if (
        !Array.isArray(value) ||
        value.some((row) => row === null || typeof row !== 'object' || Array.isArray(row))
      )
        throw new Error('Table data must be an array of objects')
      const rows = value as Record<string, unknown>[]
      const columns = node.columns as Array<{ field: string; label: string }>
      const lastPage = Math.max(0, Math.ceil(rows.length / 50) - 1)
      const current = Math.min(tablePage, lastPage)
      return (
        <div className="space-y-3">
          {heading}
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.field}>{column.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(current * 50, (current + 1) * 50).map((row, index) => (
                <TableRow key={index}>
                  {columns.map((column) => (
                    <TableCell key={column.field}>{display(row[column.field])}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length === 0 && (
            <p className="text-muted-foreground text-sm">{t('pluginWebUI.empty')}</p>
          )}
          {lastPage > 0 && (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                disabled={current === 0}
                onClick={() => setTablePage(current - 1)}
              >
                {t('pluginWebUI.previous')}
              </Button>
              <span>
                {current + 1} / {lastPage + 1}
              </span>
              <Button
                variant="outline"
                disabled={current === lastPage}
                onClick={() => setTablePage(current + 1)}
              >
                {t('pluginWebUI.next')}
              </Button>
            </div>
          )}
        </div>
      )
    }
    case 'chart': {
      if (
        !Array.isArray(value) ||
        value.length > 2000 ||
        value.some(
          (row) =>
            row === null ||
            typeof row !== 'object' ||
            !node.y ||
            typeof row[node.y] !== 'number' ||
            !Number.isFinite(row[node.y]) ||
            !node.x ||
            !['string', 'number'].includes(typeof row[node.x])
        )
      )
        throw new Error(
          'Chart data must contain scalar x and numeric y fields, with at most 2000 rows'
        )
      const x = node.x as string
      const y = node.y as string
      const chartChildren = (
        <>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={x} />
          <YAxis />
          <ChartTooltip content={<ChartTooltipContent />} />
        </>
      )
      return (
        <div className="space-y-3">
          {heading}
          <ChartContainer
            className="h-72 w-full"
            config={{ [y]: { label: node.label ?? y, color: 'var(--primary)' } }}
          >
            {node.chart_type === 'bar' ? (
              <BarChart data={value}>
                {chartChildren}
                <Bar dataKey={y} fill="var(--primary)" isAnimationActive={false} />
              </BarChart>
            ) : (
              <LineChart data={value}>
                {chartChildren}
                <Line dataKey={y} stroke="var(--primary)" dot={false} isAnimationActive={false} />
              </LineChart>
            )}
          </ChartContainer>
        </div>
      )
    }
  }
}

export function PluginWebUIRende
```

### Core Architecture Module: `dashboard/src/components/survey/survey-renderer.tsx`
```
/**
 * 问卷渲染器组件
 * 读取 JSON 配置并展示问卷界面
 */

import { useState, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { SurveyQuestion } from './survey-question'
import { submitSurvey, checkUserSubmission } from '@/lib/survey-api'
import type { SurveyConfig, QuestionAnswer } from '@/types/survey'

export interface SurveyRendererProps {
  /** 问卷配置 */
  config: SurveyConfig
  /** 初始答案（用于预填充，如自动填写版本号） */
  initialAnswers?: QuestionAnswer[]
  /** 提交成功回调 */
  onSubmitSuccess?: (submissionId: string) => void
  /** 提交失败回调 */
  onSubmitError?: (error: string) => void
  /** 是否显示进度条 */
  showProgress?: boolean
  /** 是否分页显示（每页一题） */
  paginateQuestions?: boolean
  /** 自定义类名 */
  className?: string
}

type AnswerMap = Record<string, string | string[] | number | undefined>

export function SurveyRenderer({
  config,
  initialAnswers,
  onSubmitSuccess,
  onSubmitError,
  showProgress = true,
  paginateQuestions = false,
  className
}: SurveyRendererProps) {
  // 将 initialAnswers 转换为 AnswerMap
  const getInitialAnswerMap = useCallback((): AnswerMap => {
    if (!initialAnswers || initialAnswers.length === 0) return {}
    return initialAnswers.reduce((acc, answer) => {
      acc[answer.questionId] = answer.value
      return acc
    }, {} as AnswerMap)
  }, [initialAnswers])

  const [answers, setAnswers] = useState<AnswerMap>(() => getInitialAnswerMap())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [currentPage, setCurrentPage] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [hasAlreadySubmitted, setHasAlreadySubmitted] = useState(false)
  const [isCheckingSubmission, setIsCheckingSubmission] = useState(true)

  // 当 initialAnswers 变化时更新答案（合并而非替换）
  useEffect(() => {
    if (initialAnswers && initialAnswers.length > 0) {
      setAnswers(prev => ({
        ...prev,
        ...getInitialAnswerMap()
      }))
    }
  }, [initialAnswers, getInitialAnswerMap])

  // 检查是否已提交过
  useEffect(() => {
    const checkSubmission = async () => {
      if (!config.settings?.allowMultiple) {
        const result = await checkUserSubmission(config.id)
        if (result.success && result.hasSubmitted) {
          setHasAlreadySubmitted(true)
        }
      }
      setIsCheckingSubmission(false)
    }
    checkSubmission()
  }, [config.id, config.settings?.allowMultiple])

  // 检查问卷是否在有效期内
  const isWithinTimeRange = useCallback(() => {
    const now = new Date()
    if (config.settings?.startTime && new Date(config.settings.startTime) > now) {
      return false
    }
    if (config.settings?.endTime && new Date(config.settings.endTime) < now) {
      return false
    }
    return true
  }, [config.settings?.startTime, config.settings?.endTime])

  // 计算进度
  const answeredCount = config.questions.filter(q => {
    const answer = answers[q.id]
    if (answer === undefined || answer === null) return false
    if (Array.isArray(answer)) return answer.length > 0
    if (typeof answer === 'string') return answer.trim() !== ''
    return true
  }).length

  const progress = (answeredCount / config.questions.length) * 100

  // 更新答案
  const handleAnswerChange = useCallback((questionId: string, value: string | string[] | number) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
    // 清除该问题的错误
    setErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[questionId]
      return newErrors
    })
  }, [])

  // 验证答案
  const validateAnswers = useCallback(() => {
    const newErrors: Record<string, string> = {}
    
    for (const question of config.questions) {
      if (question.required) {
        const answer = answers[question.id]
        
        if (answer === undefined || answer === null) {
          newErrors[question.id] = '此题为必填项'
          continue
        }
        
        if (Array.isArray(answer) && answer.length === 0) {
          newErrors[question.id] = '请至少选择一项'
          continue
        }
        
        if (typeof answer === 'string' && answer.trim() === '') {
          newErrors[question.id] = '此题为必填项'
          continue
        }
      }
      
      // 文本长度验证
      if (question.minLength && typeof answers[question.id] === 'string') {
        const text = answers[question.id] as string
        if (text.length < question.minLength) {
          newErrors[question.id] = `至少需要 ${question.minLength} 个字符`
        }
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [config.questions, answers])

  // 提交问卷
  const handleSubmit = useCallback(async () => {
    if (!validateAnswers()) {
      // 如果是分页模式，跳转到第一个有错误的问题
      if (paginateQuestions) {
        const firstErrorIndex = config.questions.findIndex(q => errors[q.id])
        if (firstErrorIndex >= 0) {
          setCurrentPage(firstErrorIndex)
        }
      }
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // 构建答案列表
      const answerList: QuestionAnswer[] = config.questions
        .filter(q => answers[q.id] !== undefined)
        .map(q => ({
          questionId: q.id,
          value: answers[q.id]!
        }))

      const result = await submitSurvey(
        config.id,
        config.version,
        answerList,
        { allowMultiple: config.settings?.allowMultiple }
      )

      if (result.success && result.submissionId) {
        setIsSubmitted(true)
        setSubmissionId(result.submissionId)
        onSubmitSuccess?.(result.submissionId)
      } else {
        const error = result.error || '提交失败'
        setSubmitError(error)
        onSubmitError?.(error)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '提交失败'
      setSubmitError(errorMsg)
      onSubmitError?.(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }, [validateAnswers, paginateQuestions, config, answers, errors, onSubmitSuccess, onSubmitError])

  // 分页导航
  const goToPage = useCallback((page: number) => {
    if (page >= 0 && page < config.questions.length) {
      setCurrentPage(page)
    }
  }, [config.questions.length])

  // 检查中
  if (isCheckingSubmission) {
    return (
      <Card className={cn("w-full max-w-2xl mx-auto", className)}>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  // 已提交过
  if (hasAlreadySubmitted && !config.settings?.allowMultiple) {
    return (
      <Card className={cn("w-full max-w-2xl mx-auto", className)}>
        <CardHeader>
          <CardTitle>{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="py-8">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              你已经提交过这份问卷了，感谢参与！
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  // 不在有效期内
  if (!isWithinTimeRange()) {
    return (
      <Card className={cn("w-full max-w-2xl mx-auto", className)}>
        <CardHeader>
          <CardTitle>{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              问卷不在有效期内
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  // 提交成功
  if (isSubmitted) {
    return (
      <Card className={cn("w-full max-w-2xl mx-auto", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-6 w-6" />
            提交成功
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            {config.settings?.thankYouMessage || '感谢你的参与！'}
          </p>
          {submissionId && (
            <p className="text-center text-xs text-muted-foreground mt-4">
              提交编号：{submissionId}
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  // 问卷展示
  const questionsToShow = paginateQuestions
    ? [config.questions[currentPage]]
    : config.questions

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* 问卷头部 */}
      <div className="rounded-lg border bg-card p-4 sm:p-6 mb-4 shrink-0">
        <h2 className="text-xl font-semibold">{config.title}</h2>
        {config.description && (
          <p className="text-muted-foreground mt-1 text-sm">{config.description}</p>
        )}
        {showProgress && (
          <div className="space-y-1 pt-3">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>进度</span>
              <span>{answeredCount} / {config.questions.length}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
      </div>

      {/* 问卷内容 - 可滚动区域 */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-4 pr-4">
          {questionsToShow.map((question, index) => (
            <div 
              key={question.id}
              className={cn(
                "p-4 rounded-lg border bg-card",
                errors[question.id] ? "border-destructive bg-destructive/5" : "border-border"
              )}
            >
      
```

### Core Architecture Module: `dashboard/src/components/tour/lazy-tour-renderer.tsx`
```
import { lazy, Suspense } from 'react'

import { useTour } from './use-tour'

const TourRenderer = lazy(() =>
  import('./tour-renderer').then((module) => ({
    default: module.TourRenderer,
  }))
)

export function LazyTourRenderer() {
  const { state } = useTour()

  if (!state.isRunning) {
    return null
  }

  return (
    <Suspense fallback={null}>
      <TourRenderer />
    </Suspense>
  )
}

```

### Core Architecture Module: `dashboard/src/components/tour/tour-renderer.tsx`
```
import Joyride from 'react-joyride'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTour } from './use-tour'

// Joyride 主题配置
const joyrideStyles = {
  options: {
    // 提到 portal 容器（99999）之上，确保 overlay/spotlight/tooltip 都在最上层；
    // overlay 的 z-index 由 react-joyride 内部基于 options.zIndex 推算，必须大于 floater 才能让 tooltip 按钮可点击。
    zIndex: 100000,
    primaryColor: 'hsl(var(--color-primary))',
    textColor: 'hsl(var(--color-foreground))',
    backgroundColor: 'hsl(var(--color-background))',
    arrowColor: 'hsl(var(--color-background))',
    overlayColor: 'rgba(0, 0, 0, 0.5)',
  },
  tooltip: {
    borderRadius: 'var(--radius)',
    padding: '1rem',
  },
  tooltipContainer: {
    textAlign: 'left' as const,
  },
  tooltipTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  tooltipContent: {
    fontSize: '0.875rem',
    padding: '0.5rem 0',
  },
  buttonNext: {
    backgroundColor: 'hsl(var(--color-primary))',
    color: 'hsl(var(--color-primary-foreground))',
    borderRadius: 'calc(var(--radius) - 2px)',
    fontSize: '0.875rem',
    padding: '0.5rem 1rem',
  },
  buttonBack: {
    color: 'hsl(var(--color-muted-foreground))',
    fontSize: '0.875rem',
    marginRight: '0.5rem',
  },
  buttonSkip: {
    color: 'hsl(var(--color-muted-foreground))',
    fontSize: '0.875rem',
  },
  buttonClose: {
    color: 'hsl(var(--color-muted-foreground))',
  },
  spotlight: {
    borderRadius: 'var(--radius)',
  },
}

// 中文本地化
const locale = {
  back: '上一步',
  close: '关闭',
  last: '完成',
  next: '下一步',
  nextLabelWithProgress: '下一步 ({step}/{steps})',
  open: '打开对话框',
  skip: '跳过',
}

export function TourRenderer() {
  const { state, getCurrentSteps, handleJoyrideCallback } = useTour()
  const steps = getCurrentSteps()
  const [targetReady, setTargetReady] = useState(false)
  const [seenStepIndex, setSeenStepIndex] = useState(state.stepIndex)
  const cleanupRef = useRef<(() => void) | null>(null)

  if (seenStepIndex !== state.stepIndex) {
    setSeenStepIndex(state.stepIndex)
    if (targetReady) {
      setTargetReady(false)
    }
  }

  const currentStep = state.isRunning && steps.length > 0 ? steps[state.stepIndex] : undefined
  if (!state.isRunning || steps.length === 0 || !currentStep) {
    if (targetReady) {
      setTargetReady(false)
    }
  } else if (currentStep.target === 'body' && !targetReady) {
    setTargetReady(true)
  }

  // 等待当前步骤的目标元素出现
  useEffect(() => {
    if (!state.isRunning || steps.length === 0) {
      return
    }

    const step = steps[state.stepIndex]
    if (!step) {
      return
    }

    const target = step.target
    if (target === 'body') {
      return
    }

    queueMicrotask(() => {
      setTargetReady(false)
    })

    // 每次步骤变化时，先等待一段时间让 DOM 更新（弹窗关闭动画等）
    const initialDelay = setTimeout(() => {
      const checkTarget = () => {
        const elements = document.querySelectorAll(target as string)

        return Array.from(elements).some((element) => {
          const rect = element.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0
        })
      }

      if (checkTarget()) {
        // 找到元素后再等一小段时间，确保动画完成
        setTimeout(() => setTargetReady(true), 100)
        return
      }

      // 使用轮询检测元素
      const intervalId = setInterval(() => {
        if (checkTarget()) {
          clearInterval(intervalId)
          // 找到元素后再等一小段时间
          setTimeout(() => setTargetReady(true), 100)
        }
      }, 100)

      const timeout = setTimeout(() => {
        clearInterval(intervalId)
        // 超时后设置 targetReady 为 true，让 Joyride 显示错误提示
        setTargetReady(true)
      }, 5000)

      // 保存清理函数
      const cleanup = () => {
        clearInterval(intervalId)
        clearTimeout(timeout)
      }
      
      // 将清理函数保存到 ref 中以便外部清理
      cleanupRef.current = cleanup
    }, 150) // 等待 150ms 让 DOM 更新和动画完成

    return () => {
      clearTimeout(initialDelay)
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
    }
  }, [state.isRunning, state.stepIndex, steps])

  // 创建一个高层级的容器用于渲染 Joyride
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null)
  if (typeof document !== 'undefined' && portalElement === null) {
    let container = document.getElementById('tour-portal-container') as HTMLDivElement | null
    if (!container) {
      container = document.createElement('div')
      container.id = 'tour-portal-container'
      container.style.cssText = 'position: fixed; top: 0; left: 0; z-index: 99999; pointer-events: none;'
      document.body.appendChild(container)
    }
    setPortalElement(container)
  }

  if (!state.isRunning || steps.length === 0 || !targetReady) {
    return null
  }

  const joyrideElement = (
    <Joyride
      key={`tour-step-${state.stepIndex}`}
      steps={steps}
      stepIndex={state.stepIndex}
      run={state.isRunning}
      continuous
      showSkipButton
      showProgress
      disableOverlayClose
      disableScrolling={false}
      disableScrollParentFix={false}
      callback={handleJoyrideCallback}
      styles={joyrideStyles}
      locale={locale}
      scrollOffset={80}
      scrollToFirstStep
    />
  )

  // 使用 Portal 渲染到高层容器
  if (portalElement) {
    return createPortal(joyrideElement, portalElement)
  }

  return joyrideElement
}

```

### Core Architecture Module: `dashboard/src/hooks/use-animation.ts`
```
import { useContext } from 'react'

import { AnimationContext } from '@/lib/animation-context'

export const useAnimation = () => {
  const context = useContext(AnimationContext)

  if (context === undefined) {
    throw new Error('useAnimation must be used within an AnimationProvider')
  }

  return context
}

```

### Core Architecture Module: `dashboard/src/hooks/use-auth.ts`
```
import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'

import { type AuthStatus, getAuthStatus } from '@/lib/auth'
import { authApi } from '@/lib/http'

const AUTH_STATUS_CACHE_MS = 30_000
let cachedAuthStatus: (AuthStatus & { checkedAt: number }) | null = null
let authStatusPromise: Promise<AuthStatus> | null = null

function readCachedAuthStatus(): AuthStatus | undefined {
  if (!cachedAuthStatus) {
    return undefined
  }
  if (Date.now() - cachedAuthStatus.checkedAt > AUTH_STATUS_CACHE_MS) {
    cachedAuthStatus = null
    return undefined
  }
  return cachedAuthStatus
}

async function resolveEntryRedirect(): Promise<'auth' | 'setup' | null> {
  authStatusPromise ??= getAuthStatus()
    .then((status) => {
      cachedAuthStatus = { ...status, checkedAt: Date.now() }
      return status
    })
    .finally(() => {
      authStatusPromise = null
    })

  const status = await authStatusPromise
  if (!status.authenticated) {
    return 'auth'
  }
  if (status.requires_custom_token) {
    return 'setup'
  }
  return null
}

export function useAuthGuard() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(() => {
    const cached = readCachedAuthStatus()
    return cached?.authenticated !== true || cached.requires_custom_token === true
  })

  useEffect(() => {
    let cancelled = false
    const cached = readCachedAuthStatus()
    if (cached?.authenticated === true && cached.requires_custom_token !== true) {
      setChecking(false)
      return () => {
        cancelled = true
      }
    }

    const verifyAuth = async () => {
      try {
        const redirectTarget = await resolveEntryRedirect()
        if (cancelled) {
          return
        }
        if (redirectTarget === 'auth') {
          navigate({ to: '/auth' })
        } else if (redirectTarget === 'setup') {
          navigate({ to: '/setup' })
        }
      } catch {
        // 发生错误时也跳转到登录页
        if (!cancelled) {
          navigate({ to: '/auth' })
        }
      } finally {
        if (!cancelled) {
          setChecking(false)
        }
      }
    }

    verifyAuth()

    return () => {
      cancelled = true
    }
  }, [navigate])

  return { checking }
}

/**
 * 检查是否已认证（异步）
 */
export async function checkAuth(): Promise<boolean> {
  return (await getAuthStatus()).authenticated
}

/**
 * 检查是否需要首次配置
 */
export async function checkFirstSetup(): Promise<boolean> {
  try {
    const data = await authApi.get<{ is_first_setup: boolean }>('/api/webui/setup/status')
    return data.is_first_setup
  } catch (error) {
    console.error('检查首次配置状态失败:', error)
    return false
  }
}

```

### Core Architecture Module: `dashboard/src/hooks/use-background.ts`
```
import { useTheme } from '@/components/use-theme'

import type { BackgroundConfig } from '@/lib/theme/tokens'
import { DEFAULT_DASHBOARD_STYLE, defaultBackgroundConfig } from '@/lib/theme/tokens'

type BackgroundLayerId = 'page' | 'sidebar' | 'header' | 'card' | 'dialog'

type ResolvedBackgroundState = {
  config: BackgroundConfig
  inheritEnabled: boolean
  inheritedFrom: BackgroundLayerId | null
}

/**
 * 获取指定层级的背景配置
 * 处理继承逻辑：如果 inherit 为 true，返回页面级别配置
 * @param layerId - 背景层级标识
 * @returns 对应层级的背景配置
 */
export function useBackground(layerId: BackgroundLayerId): ResolvedBackgroundState {
  const { themeConfig } = useTheme()
  const dashboardStyle = themeConfig.dashboardStyle ?? DEFAULT_DASHBOARD_STYLE
  const bgMap = themeConfig.styleBackgroundConfig?.[dashboardStyle] ?? {}

  const config = bgMap[layerId] ?? defaultBackgroundConfig

  // 处理继承逻辑：非 page 层级且 inherit 为 true，返回 page 配置
  if (layerId !== 'page' && config.inherit) {
    return {
      config: bgMap.page ?? defaultBackgroundConfig,
      inheritEnabled: true,
      inheritedFrom: 'page',
    }
  }

  return {
    config,
    inheritEnabled: !!config.inherit,
    inheritedFrom: null,
  }
}

```

### Core Architecture Module: `dashboard/src/hooks/use-media-query.ts`
```
import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches
    }
    return false
  })
  const [seenQuery, setSeenQuery] = useState(query)

  if (typeof window !== 'undefined' && seenQuery !== query) {
    setSeenQuery(query)
    setMatches(window.matchMedia(query).matches)
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia(query)

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [query])

  return matches
}

export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 768px)')
}

```

### Core Architecture Module: `dashboard/src/hooks/use-toast.ts`
```
'use client'

// Inspired by react-hot-toast library
import * as React from 'react'

import type { ToastActionElement, ToastProps } from '@/components/ui/toast'

const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 5000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = {
  ADD_TOAST: 'ADD_TOAST'
  UPDATE_TOAST: 'UPDATE_TOAST'
  DISMISS_TOAST: 'DISMISS_TOAST'
  REMOVE_TOAST: 'REMOVE_TOAST'
}

type Action =
  | {
      type: ActionType['ADD_TOAST']
      toast: ToasterToast
    }
  | {
      type: ActionType['UPDATE_TOAST']
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType['DISMISS_TOAST']
      toastId?: ToasterToast['id']
    }
  | {
      type: ActionType['REMOVE_TOAST']
      toastId?: ToasterToast['id']
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: 'REMOVE_TOAST',
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      }

    case 'DISMISS_TOAST': {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case 'REMOVE_TOAST':
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, 'id'>

function toast({ ...props }: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: 'UPDATE_TOAST',
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id })

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  }
}

export { useToast, toast }

```

### Core Architecture Module: `dashboard/src/hooks/useBackendConnections.ts`
```
import { useCallback, useEffect, useState } from 'react'

import { isElectron } from '@/lib/runtime'
import type { BackendConnection } from '@/types/electron'

export function useBackendConnections() {
  const [backends, setBackends] = useState<BackendConnection[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!isElectron()) return
    const [list, active] = await Promise.all([
      window.electronAPI!.getBackends(),
      window.electronAPI!.getActiveBackend(),
    ])
    setBackends(list)
    setActiveId(active?.id ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void refresh()
    })
  }, [refresh])

  const addBackend = useCallback(
    async (conn: Omit<BackendConnection, 'id'>) => {
      if (!isElectron()) return
      await window.electronAPI!.addBackend(conn)
      await refresh()
    },
    [refresh]
  )

  const updateBackend = useCallback(
    async (id: string, patch: Partial<BackendConnection>) => {
      if (!isElectron()) return
      await window.electronAPI!.updateBackend(id, patch)
      await refresh()
    },
    [refresh]
  )

  const removeBackend = useCallback(
    async (id: string) => {
      if (!isElectron()) return
      await window.electronAPI!.removeBackend(id)
      await refresh()
    },
    [refresh]
  )

  const switchBackend = useCallback(async (id: string) => {
    if (!isElectron()) return
    await window.electronAPI!.setActiveBackend(id)
    setActiveId(id)
    // 重新加载页面以使用新后端
    window.location.reload()
  }, [])

  return {
    backends,
    activeId,
    loading,
    addBackend,
    updateBackend,
    removeBackend,
    switchBackend,
    refresh,
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2101** (2026-10-05): **最新dev，私聊无法正常回复（89ca2fd88cb2ae0c6424f721f0519f791cbc80cb）**
  *Symptoms*: ### 检查项  - [x] 我确认此问题在所有分支的最新版本中依旧存在 - [x] 我确认在 Issues 列表中并无其他人已经提出过与此问题相同或相似的问题 - [ ] 我使用了 Docker  ### 使用的分支  dev  ### 具体版本号  最新dev（89ca2fd88cb2ae0c6424f721f0519f791cbc80cb）  ### 遇到的问题  - qq私聊给bot发消息无反应 - 群聊和webui发消息正常回复  ### 报错信息  10-05 22:02:30 [所见] [私聊]检测到私聊消息，路由到 Maisaka 10-05 22:02:30 [MaiSaka] [白泽的私聊] 已恢复最近上下文: 历史消息=12 用户消息缓存=9 10-05 22:02:30 [MaiSaka] [白泽的私聊] 已启动 Maisaka 内部循环任务 10-05 22:02:30 [MaiSaka] [白泽的私聊] Maisaka 运行时已启动 10-05 22:02:30 [聊天工具] 被提及，回复概率设置为100% 10-05 22:02:30 [MaiSaka] [白泽的私聊] 检测到提及消息，下一轮 Planner 将强制触发；消息编号=1064984642 10-05 22:02:30 [读空气] [白泽的私聊] 回复频率调度: 频率=1.000 pending=1 判定=强制触发 10-05 22:02:30 [所见] [私聊]白泽:小酒 10-05 22:02:30 [人物] 用户 白泽 已存在 10-05 22:02:30 [人物] 已从数据库加载用户 a4df8cdf2fe6e92400d769222a9fa392 的信息 10-05 22:02:30 [MaiSaka] [白泽的私聊] 已结束本次强制触发状态；触发原因=提及消息 触发消息编号=1064984642 10-05 22:02:30 [麦麦推理引擎] [白泽的私聊] 检测到新的提及消息（消息编号=1064984642），本轮直接进入 Planner。 10-05 22:02:30 [MaiSaka] [白泽的私聊] MaiSaka 轮次开始: 循环编号=1 回合=1/10 上下文消息数=14  ------------  流程到这里就没了，无法正常触发决策和回复-----------------------------------------------------------  10-05 22:04:55 [所见] [群聊]检测到群聊消息，路由到 Maisaka  ### 如何重现此问题？  - 群聊正常回复  10-05 22:04:55 [所见] [群聊]检测到群聊消息，路由到 Maisaka 10-05 22:04:55 [MaiSaka] [神社茶话会] 已恢复最近上下文: 历史消息=3 用户消息缓存=2 10-05 22:04:55 [MaiSaka] [神社茶话会] 已启动 Maisaka 内部循环任务 10-05 22:04:55 [MaiSaka] [神社茶话会] Maisaka 运行时已启动 10-05 22:04:55 [聊天工具] 被提及，回复概率设置为100% 10-05 22:04:55 [MaiSaka] [神社茶话会] 检测到提及消息，下一轮 Planner 将强制触发；消息编号=57164549 10-05 22:04:55 [读空气] [神社茶话会] 回复频率调度: 频率=0.900 pending=1 判定=强
  **Post-Mortem & Fix Analysis**:
  > 没事了，是我搞错东西了

- **Issue #2074** (2026-10-05): **dev最新人物事实写回处理失败**
  *Symptoms*: ### 检查项  - [x] 我确认此问题在所有分支的最新版本中依旧存在 - [x] 我确认在 Issues 列表中并无其他人已经提出过与此问题相同或相似的问题 - [ ] 我使用了 Docker  ### 使用的分支  dev  ### 具体版本号  最新dev  ### 遇到的问题  - 麦麦生成回复后会报  [记忆流服务] 人物事实写回处理失败  ### 报错信息  09-26 09:43:33 [记忆流服务] 人物事实写回处理失败: Invalid format specifier '"他喜欢打游戏","evidence_message_id":"消息ID","evidence_quote":"我喜欢打游戏"' for object of type 'str' Traceback (most recent call last):   File "/root/dev-maimai/MaiBot/src/services/memory_flow_service.py", line 133, in _worker_loop     await self._handle_message(message)   File "/root/dev-maimai/MaiBot/src/services/memory_flow_service.py", line 157, in _handle_message     facts = await self._extract_facts(target_person, reply_text, user_evidence_text)             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/root/dev-maimai/MaiBot/src/services/memory_flow_service.py", line 430, in _extract_facts     [{"fact":"他喜欢打游戏","evidence_message_id":"消息ID","evidence_quote":"我喜欢打游戏"}]      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ ValueError: Invalid format specifier '"他喜欢打游戏","evidence_message_id":"消息ID","evidence_quote":"我喜欢打游戏"' for object of type 'str'   ### 如何重现此问题？  _No response_  ### 可能造成问题的原因  _No response_  ### 系统环境  ubuntu 24.04  ### Python 版本  Python 3.12.3  ### 补充信息  _No response_
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈，报错信息和 Traceback 都很完整，定位起来很顺利。  这个问题已经修复。原因是 `src/services/memory_flow_service.py` 里 `_extract_facts` 构造的 prompt 是 f-string，示例 JSON 中的花括号没有转义，被当成了格式化占位符，于是触发了 `ValueError: Invalid format specifier`。 提交 05b2070b8 已把示例改为 `[{{"fact":...}}]` 的转义写法，dev 和 main 分支都已包含这个提交，首个包含该修复的发布版本是 1.3.0。  请更新到 1.3.0 或更新的版本（或拉取最新 dev），这个 issue 先关闭。如果更新后仍能复现，欢迎用 Bug 模板附上完整日志重新提交：https://github.com/Mai-with-u/MaiBot/issues/new/choose  --- _Generated by [Claude Code](https://claude.ai/code)_

- **Issue #2063** (2026-10-05): **统计任务全量加载消息导致内存暴增**
  *Symptoms*: ### 检查项  - [x] 我确认此问题在所有分支的最新版本中依旧存在 - [x] 我确认在 Issues 列表中并无其他人已经提出过与此问题相同或相似的问题 - [x] 我使用了 Docker  ### 使用的分支  main  ### 具体版本号  1.2.5  ### 遇到的问题  ## 现象  容器主进程 bot.py 内存周期性暴涨至 2.1~2.2 GB，触发系统 OOM 守护进程 earlyoom 的 SIGTERM 击杀，容器反复重启。  ## 触发规律  - 每次容器启动后立即出现第一次内存暴涨 - 之后每 15 分钟复现一次 - 峰值与统计任务执行时刻严格对应  ## 时间线      19:15:05  [麦麦统计] 正在收集统计数据...   RSS 486 MB 开始上涨     19:15:08  RSS = 569 MB                     3 秒内 +83 MB     19:18:39  [麦麦统计] 统计数据收集完成  ### 报错信息  ## earlyoom 击杀      earlyoom: low memory! at or below SIGTERM limits: mem 5.00%, swap 0.00%     earlyoom: sending SIGTERM to process 3425760 uid 0 "python":               oom_score 946, VmRSS 2194 MiB,               cmdline "/MaiMBot/.venv/bin/python bot.py"     earlyoom: sending SIGTERM to process 3439430 uid 0 "python":               oom_score 944, VmRSS 2102 MiB,               cmdline "/MaiMBot/.venv/bin/python bot.py"  ## 容器退出      docker events: container die ... exitCode=241     程序已退出（退出码 -15）  ## py-spy 调用栈      Thread 48 (active+gil): "ThreadPoolExecutor-0_1"         fetchall                        (sqlalchemy/engine/cursor.py:1197)         _fetchall_impl                  (sqlalchemy/engine/cursor.py:2257)         _raw_all_rows                   (sqlalchemy/engine/result.py:552)         chunks                          (sqlalchemy/orm/loading.py:220)         _fetchall_impl                  (sqlalchemy/engine/result.py:2310)         _allrows                        (sqlalchemy/engine/result.py:560)         all               
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈，也感谢提供的数据量统计、A/B 实测和 py-spy 采样，问题定位非常清晰。  该问题已在 3a3c35639（Fix response splitting and stats memory use）中修复：`src/services/statistics_service.py` 中的 `fetch_messages_since` 现在只查询统计实际用到的 6 列（timestamp、platform、user_id、group_id、group_name、user_nickname），返回轻量的 `StatisticsMessageRow`，不再加载整条 `Messages` ORM 实体，思路与 issue 中的建议一致。 该修复已包含在 1.3.0 及之后的版本中。  另外，统计任务里的 `fetch_tool_records_since` 目前仍会加载完整的 `ToolRecord`，这一点已记录在 #2040 中（见其中第 6 条），可以在那里继续讨论。  因此先关闭此 issue。如果升级到最新版后统计任务仍出现内存暴涨，欢迎按模板重新提交 issue：https://github.com/Mai-with-u/MaiBot/issues/new/choose  --- _Generated by [Claude Code](https://claude.ai/code)_

- **Issue #2061** (2026-10-05): **创建导入任务时显示，创建上传导入任务失败，导入依赖未初始化: vector_store**
  *Symptoms*: ### 检查项  - [x] 我确认此问题在所有分支的最新版本中依旧存在 - [x] 我确认在 Issues 列表中并无其他人已经提出过与此问题相同或相似的问题 - [ ] 我使用了 Docker  ### 使用的分支  main  ### 具体版本号  1.2.5  ### 遇到的问题  创建导入任务时显示，创建上传导入任务失败，导入依赖未初始化: vector_store  ### 报错信息  创建上传导入任务失败 导入依赖未初始化: vector_store  ### 如何重现此问题？  _No response_  ### 可能造成问题的原因  _No response_  ### 系统环境  Windows 10 专业版  ### Python 版本  3.12  ### 补充信息  _No response_
  **Post-Mortem & Fix Analysis**:
  > ```markdown 我这边也遇到了疑似同一类 `vector_store` 未初始化问题，不过触发路径是在 A-Memorix 的聊天摘要自动写回。  环境： - MaiBot 1.2.5 - Windows 10 - Python 3.12  现象： - embedding API 调用正常，返回 `HTTP 200 OK` - A-Memorix 的 GraphStore 也能正常保存 - 但聊天摘要写回时失败，报错：  ```text AttributeError: 'NoneType' object has no attribute 'save'  File "...\\src\\A_memorix\\core\\utils\\summary_importer.py", line 708, in _import_from_stream_unlocked     self.vector_store.save()     ^^^^^^^^^^^^^^^^^^^^^^ ```  对应日志里还能看到：  ```text 图存储已保存到: ...\\data\\a-memorix\\graph  聊天摘要自动写回失败: detail=错误: 'NoneType' object has no attribute 'save' ```  看起来像是 `SummaryImporter` 中的 `self.vector_store` 没有完成初始化，但后续流程仍然执行到了：  ```python self.vector_store.save() self.graph_store.save() ```  另外，embedding 本身是可用的，之前有：  ```text POST https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings "HTTP/1.1 200 OK" ```  因此感觉和本 Issue 提到的 `导入依赖未初始化: vector_store` 很可能是同一个根因，只是触发位置不同。  补充：我在「长期记忆 → 记忆检修 → 检索调优」中点击「开始调优」时，也会直接提示：  创建调优任务失败 调优依赖未初始化: vector_store  同时 A-Memorix 聊天摘要自动写回时会报： 
  > 感谢反馈，也感谢评论区补充的聊天摘要写回日志。这个问题已在 1.3.0 中修复，所以先关闭这个 issue： - ba88acb11 修改了 `src/A_memorix/core/utils/web_import_manager.py` 的 `_ensure_ready`，不再把 `vector_store` 当作必需依赖。只要允许仅写元数据（`allow_metadata_only_write`，默认开启），向量通道不可用时也能创建上传导入任务，段落会先写入元数据，再进入向量回填队列。 - e43974eeb 把 `src/A_memorix/core/utils/summary_importer.py` 中的 `self.vector_store.save()` 改成通过内核统一入口保存。`dual_vector_state_service.py` 的 `_save_vector_store` 遇到空的向量存储会直接跳过，摘要写回不会再报 `'NoneType' object has no attribute 'save'`。  以上两个提交都已包含在 1.3.0 及之后的版本中。另外，检索调优仍需要可用的向量通道；`vector_store` 为空通常是因为向量通道降级了（例如 embedding 指纹无法校验），这部分可以关注 #2010 的后续讨论。  升级到最新版本后如果仍能复现，欢迎按模板重新提交，并附上完整日志：https://github.com/Mai-with-u/MaiBot/issues/new/choose  --- _Generated by [Claude Code](https://claude.ai/code)_

- **Issue #2056** (2026-09-23): **[BUG] 回复后处理时，bot回复分割后重新硬拼接导致丢标点**
  *Symptoms*: ### 检查项  - [x] 我确认此问题在所有分支的最新版本中依旧存在 - [x] 我确认在 Issues 列表中并无其他人已经提出过与此问题相同或相似的问题 - [x] 我使用了 Docker  ### 使用的分支  main  ### 具体版本号  1.2.5  ### 遇到的问题  bot 偶发把回复发成“多句粘连、句与句之间既无标点也无空格”的一条消息，读起来是一整坨字。 部署时群友反馈“说话不断句，不打标点符号”。 回复较短时无此现象，回复越长、逗号越多越容易触发。  ### 报错信息  无日志报错，属于行为缺陷，程序运行无异常。  ### 如何重现此问题？  1. 保持 `response_splitter` 默认配置（`enable=true`、`max_split_num=3`）。 2. 诱导 bot 生成一个含 4 个及以上逗号分句的回复（问一个开放性问题即可，如「你今天都做了什么呀？」）。 3. 观察实际发出的消息。  期望（设计意图）：4+ 条消息，每条一个短句，句间无标点。  实际（bug）：  原始回复： > 今天去上课了，然后回来睡觉，睡醒吃了饭，现在有点无聊，你呢？  分段后（5 段，去标点）： > ['今天去上课了', '然后回来睡觉', '睡醒吃了饭', '现在有点无聊', '你呢？']  压缩为 max_split_num=3 条后实际发出： > 消息1：今天去上课了然后回来睡觉 > 消息2：睡醒吃了饭现在有点无聊 > 消息3：你呢？  前两条内部多句粘连，无标点、无空格。  ### 可能造成问题的原因  两个环节组合（文件 `src/chat/utils/utils.py`，行号基于 1.2.5 / main 与 dev 一致）：  1. `split_into_sentences_w_remove_punctuation`（L279）：    - 按 `，,。; 空格 换行` 分割为 `(内容, 分隔符)` 元组；    - 相邻段**概率合并**时保留分隔符（L434 `current_content + current_sep + next_content`）；    - 但未合并的段在提取结果时只保留内容（L446），**分隔符信息在此永久丢失**。  2. `_merge_processed_segments_to_max_count`（L481-523）：    - 分段数超过 `max_split_num` 时均匀分组压缩；    - L518 用 `"".join(segment.text for segment in group)` 硬拼接——      由于第 1 步已丢失分隔符，拼接处无法恢复任何标点或空格。  即：分段函数丢弃分隔符时隐含「各段将独立发送」的假设，而压缩函数在违背该假设拼接时没有任何补偿。  旧链路中的 `merge_sentences_to_max_count`（L462-478，同样 `"".join` 硬拼接）也存在相同问题（当前 main/dev 未见调用，顺带提请确认）。  ### 修复思路（供参考）  1. 分隔符随段传递（如 `ProcessedResponseSegment` 增加 `separator` 字段），压缩拼接时补回：逗号→空格或原样保留，即「未被拆开的句子之间保留停顿」； 2. 或退一步：拼接处至少插入一个空格； 3. 或放宽/动态化 `max_split_num`，减少触发拼接的场景。  具体取舍涉及拟人化风格与防刷屏的平衡，交由维护者
  **Post-Mortem & Fix Analysis**:
  > 本issue提到的问题已于 3a3c356 修复，故关闭。感谢修复。

- **Issue #2052** (2026-10-05): **出站投递失败在日志里完全无法归因：error= 为空 + 堆栈被降到 debug 级 + 消息静默丢弃**
  *Symptoms*: ### 检查项  - [x] 我确认此问题在所有分支的最新版本中依旧存在 - [x] 我确认在 Issues 列表中并无其他人已经提出过与此问题相同或相似的问题 - [ ] 我使用了 Docker  ### 使用的分支  main  ### 具体版本号  v1.2.5（tag 1.2.5 / commit b8c3940）；已复核 main 与 dev：main 的 send_service.py 与本版本行号完全一致（:821 / :873 / :897 / :1136），plugin_driver.py 三处取错文本的写法也在 :152 / :171 / :183  ### 遇到的问题  24 小时内有 5 次出站消息投递失败（同一秒成对落两条日志），用户侧是真实故障：消息没发出去。但日志给不出任何原因，两条关键线索分别是空的：    [send_service] WARNING src/services/send_service.py:821     [SendService] Platform IO 发送失败: platform=qq driver=gateway:maibot-team.napcat-adapter:napcat_gateway status=DeliveryStatus.FAILED error=            <-- 等号后面是空的   [send_service] ERROR   src/services/send_service.py:1136     [SendService] 发送消息失败                        <-- 没有任何上下文  三个叠加因素导致无法归因： 1) src/platform_io/drivers/plugin_driver.py 的 _build_receipt 用 .get(key, 默认值) 取错误文本：    :152  error = response.error.get("message", "消息网关发送失败")    :171  error=str(payload.get("result", "消息网关发送失败")) ...    :183  error=str(result.get("error", "消息网关发送失败"))    默认值只在「键不存在」时生效。适配器回 {"success": false, "error": ""} 这类**空字符串**时，取到的就是空串。 2) send_service.py:1136 那条 ERROR 根本不是异常路径，而是 _send_via_platform_io 返回 None 的兜底；而真正的堆栈在 :873 / :897 用 logger.debug(traceback.format_exc()) 落盘 —— INFO 级别下永远看不见。 3) 失败后没有任何重试、队列或死信（send_session_message 只返回 ... is not None），消息直接丢弃。  即：日志既说不出为什么失败，也救不回这条消息。  ### 报错信息  09-15 19:58:24 WARNING src.services.send_service:821   [SendService] Platform IO 发送失败: platform=qq driver=gateway:maibot-team.napcat-adapter:napcat_gateway status=DeliveryStatus
  **Post-Mortem & Fix Analysis**:
  > It sounds like the logs aren't giving any useful error information when outbound message deliveries fail. I'd start by checking how errors are being logged in `send_service.py` to see why they're coming up empty. 
  > I read through the log traces in your report. The core issue is that the delivery path only records a WARNING with an empty error field and demotes the traceback to debug, so a real user-facing failure looks identical to a transient warning. I'd fix this with a three-state result contract for the outbound pipeline: every send attempt must resolve to success / failed-with-reason / unknown, and unknown is treated as failed. Concretely: send_service.py catches the adapter exception, wraps it into a DeliveryResult {status, error_type, detail, driver_id}, logs the failure at ERROR with the full chain, and emits a per-24h failure counter so drops are impossible to miss. plugin_driver.py's three text grabs get the same contract. That's mechanical to verify with a regression test asserting no FAILED status ever logs an empty error. Want me to take a crack at it? Happy to open a PR with working code.
  > Your approach sounds solid, especially the idea of ensuring every send attempt resolves to a clear status. It'd be great to see how your changes improve the logging and error handling. Looking forward to your PR! 

- **Issue #2051** (2026-10-03): **reply 工具返回 enum 外的 reply_style（如「简短回复」）触发 KeyError，导致该条消息完全不回复**
  *Symptoms*: ### 检查项  - [x] 我确认此问题在所有分支的最新版本中依旧存在 - [x] 我确认在 Issues 列表中并无其他人已经提出过与此问题相同或相似的问题 - [ ] 我使用了 Docker  ### 使用的分支  main  ### 具体版本号  v1.2.5（tag 1.2.5 / commit b8c3940）；并已在 main 与 dev 最新代码复核，该逻辑均未变化  ### 遇到的问题  生产实例 24 小时日志中，某群一条消息完全没有回复，日志显示提示词构建阶段抛 KeyError。  定位到两处： 1) src/maisaka/builtin_tool/reply.py:134 —— 给模型的 schema 是 "reply_style": {"type":"string","enum":["简短表达","正常回复","长回复"]} 2) src/chat/replyer/maisaka_generator_base.py:636-647 —— 取键处是裸下标，无任何兜底：    normalized_reply_style = reply_style.strip()    if not normalized_reply_style:        return ""    return style_messages[normalized_reply_style]      # <-- 越界值直接 KeyError  模型这次返回了 enum 之外的同义值「简短回复」，于是 style_messages['简短回复'] 抛 KeyError，异常从 :647 -> :718 -> 被 generate_reply_with_context(:1127) 捕获后 error_message 置错并 return，该轮回复彻底不生成。  也就是说：一个「风格名写错了」的小问题，代价是机器人对这条消息装聋。后果分级不对等是本 issue 的重点。  ### 报错信息  构建提示词失败: '简短回复' Traceback (most recent call last):   File ".../src/chat/replyer/maisaka_generator_base.py", line 1118, in generate_reply_with_context     request_messages = self._build_request_messages(   File ".../src/chat/replyer/maisaka_generator_base.py", line 718, in _build_request_messages     requested_reply_style_message = self._build_requested_reply_style_message(   File ".../src/chat/replyer/maisaka_generator_base.py", line 647, in _build_requested_reply_style_message     return style_messages[normalized_reply_style] KeyError: '简短回复'  ### 如何重现此问题？  不需要真实模型、不需要网络：直接调用 _build_requested_reply_style_message("简短回复") 即抛 KeyError；或构

- **Issue #2034** (2026-09-15): **docker最新镜像里面是旧的core**
  *Symptoms*: ### 检查项  - [x] 我确认此问题在所有分支的最新版本中依旧存在 - [x] 我确认在 Issues 列表中并无其他人已经提出过与此问题相同或相似的问题 - [x] 我使用了 Docker  ### 使用的分支  main  ### 具体版本号  latest  ### 遇到的问题  docker最新镜像里面是旧的core 我已硬性清空浏览器缓存  <img width="1709" height="678" alt="Image" src="https://github.com/user-attachments/assets/828df418-b479-42d3-9efc-8488ef6142dd" />  <img width="332" height="117" alt="Image" src="https://github.com/user-attachments/assets/e2a042bd-dee7-4055-870f-1cefda160cfd" />   ### 报错信息  docker最新镜像里面是旧的core  ### 如何重现此问题？  _No response_  ### 可能造成问题的原因  _No response_  ### 系统环境  docker  ### Python 版本  docker  ### 补充信息  _No response_
  **Post-Mortem & Fix Analysis**:
  > I'll work on this. Could you assign it to me?  I'll fix the docs to match the current code and add a short note so this does not rot again. 
  > I am still working on this. I will update the documentation to reflect the current code. Let me know if there are any specific areas you want me to focus on. 
  > I am making progress on updating the documentation. If there are any particular sections you think need more attention, please let me know. 

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

### Incident Patch 1: `6c6f323f` (2026-10-04)
**Commit Message**: fix: webui构建诸多问题

**File**: `changelogs/changelog.md` (modified, +3/-0)
```diff
@@ -4,13 +4,16 @@
 
 ## 主程序
 
+- 修复带图片请求保存失败快照或生成回复结果时报错的问题，统一保存记录及图片，并与图片清理互斥。
+
 - 修复插件更新时意外重启问题
 - 修复插件进程自动重启后误报恢复成功的问题；缺失插件单独按上限重试，保留正常插件运行，主动禁用或卸载的插件除外。
 - 优化bot群昵称和qq名称与bot名称不符时的表现
 
 ## Webui [1.8.2]
 
 - 插件市场现在默认使用新的源，预期有更快的加载速度
+- 修复插件市场统计请求失败时产生未处理异常的问题，保留已加载的插件清单并记录错误。
 - 优化 Webui 可读性，新增字体切换（仅 千禧 主题）
 - 修复 AI 搜索官方文档检索失败的问题。
 - 插件管理新增更多操作菜单，支持从 ZIP 校验并安装插件
```

**File**: `dashboard/src/__tests__/router.test.tsx` (modified, +48/-4)
```diff
@@ -34,7 +34,10 @@ vi.mock('@/hooks/use-auth', () => ({
 vi.mock('@/routes/auth', () => ({ AuthPage: StubPage }))
 vi.mock('@/routes/setup/index.tsx', () => ({ SetupPage: StubPage }))
 vi.mock('@/routes/index', () => ({ IndexPage: StubPage }))
-vi.mock('@/routes/plugin-webui', () => ({ PluginWebUIPage: StubPage, PluginWebUIManagerPage: StubPage }))
+vi.mock('@/routes/plugin-webui', () => ({
+  PluginWebUIPage: StubPage,
+  PluginWebUIManagerPage: StubPage,
+}))
 vi.mock('@/routes/logs', () => ({
   LogViewerPage: StubPage,
   ReasoningLogViewerPage: StubPage,
@@ -128,6 +131,7 @@ type RouteNodeLike = {
   parentRoute?: { id?: string }
   options: {
     id?: string
+    beforeLoad?: unknown
     component?: unknown
     errorComponent?: unknown
   }
@@ -182,18 +186,56 @@ describe('router 路由表', () => {
     expect(actualKeys).toEqual(expectedKeys)
   })
 
-  it('每个页面路径都配置了懒加载组件', () => {
+  it('除兼容跳转入口外，每个页面路径都配置了懒加载组件', () => {
     const routesByPath = router.routesByPath as unknown as Record<
       string,
       { options: { component?: unknown } } | undefined
     >
-    for (const path of expectedPaths.filter((path) => !['/mcp-settings', '/settings'].includes(path))) {
+    for (const path of expectedPaths.filter(
+      (path) => !['/mcp-settings', '/settings', '/extensions'].includes(path)
+    )) {
       const route = routesByPath[path]
       expect(route, `routesByPath 缺少 ${path}`).toBeDefined()
       expect(typeof route?.options.component, `${path} 缺少组件`).toBe('function')
     }
   })
 
+  it('旧扩展入口跳转插件扩展页', () => {
+    const beforeLoad = getRoutesByPath()['/extensions']?.options.beforeLoad as () => void
+    expect(typeof beforeLoad).toBe('function')
+    try {
+      beforeLoad()
+      throw new Error('预期跳转插件扩展页')
+    } catch (error) {
+      expect(isRedirect(error)).toBe(true)
+      if (isRedirect(error)) {
+        expect(error.options).toMatchObject({
+          to: '/plugin-config',
+          hash: 'webui-extensions',
+          replace: true,
+        })
+      }
+    }
+  })
+
+  it.each([
+    { searchStr: '?tab=security', hash: '#other', href: '/config/bot?tab=security&mode=webui' },
+    { searchStr: '', hash: '#other', href: '/config/bot?mode=webui&tab=other' },
+    { searchStr: '', hash: '', href: '/config/bot?mode=webui' },
+  ])('旧设置书签跳转内嵌 WebUI 设置：$href', ({ searchStr, hash, href }) => {
+    const beforeLoad = getRoutesByPath()['/settings']?.options.beforeLoad as (ctx: {
+      location: { searchStr: string; hash: string }
+    }) => void
+    expect(typeof beforeLoad).toBe('function')
+    try {
+      beforeLoad({ location: { searchStr, hash } })
+      throw new Error('预期跳转 WebUI 设置')
+    } catch (error) {
+      expect(isRedirect(error)).toBe(true)
+      if (isRedirect(error)) expect(error.options).toMatchObject({ href, replace: true })
+    }
+  })
+
   it('registeredRoutePaths 现状为空集合（特征化已知缺陷）', () => {
     // 现状缺陷：registeredRoutePaths 在 createRouter 初始化 fullPath 之前采集，
     // 采集时各路由的 fullPath 均为 undefined，因此集合恒为空。
@@ -322,7 +364,9 @@ describe('router 路由表', () => {
 
   it('所有懒加载页面工厂均可 preload 到桩组件', async () => {
     const routesByPath = getRoutesByPath()
-    for (const path of expectedPaths.filter((path) => !['/mcp-settings', '/settings'].includes(path))) {
+    for (const path of expectedPaths.filter(
+      (path) => !['/mcp-settings', '/settings', '/extensions'].includes(path)
+    )) {
       const component = routesByPath[path]?.options.component as LazyRouteComponent | undefined
       expect(typeof component, `${path} 缺少组件`).toBe('function')
       expect(typeof component?.preload, `${path} 不是懒加载组件`).toBe('function')
```

**File**: `dashboard/src/components/__tests__/update-notice-dialog.test.tsx` (modified, +1/-1)
```diff
@@ -308,7 +308,7 @@ describe('UpdateNoticeDialog', () => {
     render(<UpdateNoticeDialog />)
 
     fireEvent.click(await screen.findByRole('button', { name: /知道了/ }))
-    fireEvent.click(await screen.findByRole('button', { name: /前往插件管理/ }))
+    fireEvent.click(await screen.findByRole('button', { name: /前往插件扩展/ }))
 
     await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: '/plugin-config' }))
     expect(ackUpdateNotice).toHaveBeenCalledTimes(1)
```

**File**: `dashboard/src/routes/__tests__/plugin-config.test.tsx` (modified, +31/-9)
```diff
@@ -95,6 +95,13 @@ afterEach(() => {
 })
 
 vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }))
+// 扩展列表新增 MCP 栏目，列表测试提供独立的空配置，避免发出真实后端请求。
+vi.mock('@/lib/config-api', () => ({
+  getBotConfig: async () => ({ mcp: { enabled: true, servers: [] } }),
+}))
+vi.mock('@/lib/mcp-api', () => ({
+  getMCPStatus: async () => ({ servers: [] }),
+}))
 vi.mock('@/lib/restart-context', () => ({
   RestartProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
   useRestart: () => restartState,
@@ -215,6 +222,16 @@ function makeHostPolicyResponse(pluginId: string) {
   return {
     success: true,
     plugin_id: pluginId,
+    active_identity: {
+      adapter_id: `gateway:${pluginId}:gw`,
+      plugin_id: pluginId,
+      gateway_name: 'gw',
+      platform: 'qq',
+      account_id: '123456',
+      scope: null,
+    },
+    has_entry: true,
+    account_entries: [],
     global_defaults: { group: 'allow' as const, private: 'block' as const },
     policy: {
       group: { default_action: 'inherit' as const, allow_ids: [] as string[], deny_ids: [] as string[] },
@@ -283,7 +300,10 @@ beforeEach(() => {
   vi.mocked(pluginApi.getLocalPluginReadme).mockResolvedValue('')
   vi.mocked(pluginApi.getLocalPluginChangelog).mockResolvedValue('')
   vi.mocked(chatApi.getAdapterHostPolicy).mockResolvedValue(makeHostPolicyResponse('adapter.qq') as never)
-  vi.mocked(chatApi.updateAdapterHostPolicy).mockResolvedValue(makeHostPolicyResponse('adapter.qq') as never)
+  vi.mocked(chatApi.updateAdapterHostPolicy).mockImplementation(async (pluginId, policy) => ({
+    ...makeHostPolicyResponse(pluginId),
+    policy,
+  }) as never)
   vi.mocked(chatApi.getAdapterPolicyDefaults).mockResolvedValue({ group: 'allow', private: 'block' })
   vi.mocked(chatApi.updateAdapterPolicyDefaults).mockImplementation(async (defaults) => defaults)
 })
@@ -331,7 +351,7 @@ describe('PluginConfigPage 特征化', () => {
   })
 
   it('插件卡片不显示重复的配置按钮，更新按钮保留原色并标记统一边框', async () => {
-    const { container } = render(<PluginConfigPage />)
+    const { container } = renderPage()
 
     await screen.findByText('Emoji Plugin')
     expect(screen.queryByRole('button', { name: '配置' })).not.toBeInTheDocument()
@@ -350,7 +370,7 @@ describe('PluginConfigPage 特征化', () => {
   it('无插件时显示空态提示', async () => {
     vi.mocked(pluginApi.getInstalledPlugins).mockResolvedValue([] as never)
     renderPage()
-    await waitFor(() => expect(screen.getByText('暂无已安装的插件')).toBeInTheDocument())
+    expect(await screen.findByRole('heading', { name: 'MCP 服务' })).toBeInTheDocument()
   })
 
   it('按照加载成功、加载中、加载失败的顺序分层展示插件', async () => {
@@ -609,9 +629,9 @@ describe('PluginConfigPage 空列表', () => {
     const user = userEvent.setup()
     renderPage()
     await screen.findByText('Emoji Plugin')
-    await user.type(screen.getByPlaceholderText('搜索插件...'), 'zzz-not-found')
-    expect(await screen.findByText('没有找到匹配的插件')).toBeInTheDocument()
-    expect(screen.getByText('尝试其他搜索关键词')).toBeInTheDocument()
+    await user.type(screen.getByPlaceholderText('搜索插件或 MCP 服务...'), 'zzz-not-found')
+    expect(screen.queryByText('Emoji Plugin')).not.toBeInTheDocument()
+    expect(await screen.findByText('没有匹配的 MCP 服务')).toBeInTheDocument()
   })
 
   it('仅看有更新且没有新版本时显示空态', async () => {
@@ -2118,15 +2138,17 @@ describe('PluginConfigPage 列表操作与状态', () => {
     await screen.findByText('Emoji Plugin')
     await user.click(screen.getByRole('button', { name: '刷新' }))
     await waitFor(() => expect(vi.mocked(pluginApi.getInstalledPlugins).mock.calls.length).toBeGreaterThan(1))
-    await user.click(screen.getByRole('button', { name: /重启麦麦/ }))
+    await user.click(screen.getByRole('button', { name: '更多操作' }))
+    await user.click(screen.getByRole('menuitem', { name: /重启麦麦/ }))
     expect(restartState.triggerRestart).toHaveBeenCalled()
   })
 
   it('重启中时禁用重启按钮', async () => {
     restartState.isRestarting = true
     renderPage()
     await screen.findByText('Emoji Plugin')
-    expect(screen.getByRole('button', { name: /重启麦麦/ })).toBeDisabled()
+    await userEvent.setup().click(screen.getByRole('button', { name: '更多操作' }))
+    expect(screen.getByRole('menuitem', { name: /重启麦麦/ })).toHaveAttribute('aria-disabled', 'true')
   })
 
   it('重复插件 ID 只保留第一项', async () => {
@@ -2584,7 +2606,7 @@ describe('PluginConfigPage 覆盖补全', () => {
     themeState.dashboardStyle = 'future-retro'
     vi.mocked(pluginApi.getInstalledPlugins).mockResolvedValue([] as never)
     renderPage()
-    expect(await screen.findByText('暂无已安装的插件')).toBeInTheDocument()
+    expect(await screen.findByRole('heading', { name: 'MCP 服务' })).toBeInTheDocument()
     expect(screen.getByText('已安装 0 个插件，已启用 0 个，已禁用 0 个，加载中 0 个，启动失败 0 个')).toBeInTheDocument()
   })
 })
```

**File**: `dashboard/src/routes/__tests__/plugin-mirrors.test.tsx` (modified, +13/-7)
```diff
@@ -66,7 +66,9 @@ function iconButton(iconClassFragment: string, index = 0): HTMLButtonElement {
 
 beforeEach(() => {
   localStorage.clear()
-  vi.mocked(backendApi.get).mockResolvedValue({ mirrors: [makeMirror()] } as never)
+  vi.mocked(backendApi.get).mockImplementation(async (path) =>
+    (path.endsWith('/source') ? { use_github: false } : { mirrors: [makeMirror()] }) as never
+  )
   vi.mocked(backendApi.post).mockResolvedValue({} as never)
   vi.mocked(backendApi.put).mockResolvedValue({} as never)
   vi.mocked(backendApi.delete).mockResolvedValue({} as never)
@@ -96,17 +98,21 @@ describe('PluginMirrorsPage 特征化', () => {
   })
 
   it('列表加载失败时展示错误信息，点击重新加载会重新请求', async () => {
-    vi.mocked(backendApi.get).mockRejectedValueOnce(new Error('后端不可用'))
+    vi.mocked(backendApi.get).mockImplementation(async (path) => {
+      if (path.endsWith('/source')) return { use_github: false } as never
+      throw new Error('后端不可用')
+    })
     const user = userEvent.setup()
     render(<PluginMirrorsPage />, { wrapper: makeWrapper() })
 
     expect(await screen.findByText('加载失败')).toBeInTheDocument()
     expect(screen.getByText('后端不可用')).toBeInTheDocument()
 
-    // 重新加载后（beforeEach 里的默认 resolved mock 生效）渲染出列表
+    // 重新加载只刷新镜像清单，不重新请求数据源设置。
+    vi.mocked(backendApi.get).mockResolvedValue({ mirrors: [makeMirror()] } as never)
     await user.click(screen.getByRole('button', { name: '重新加载' }))
     expect(await screen.findAllByText('官方镜像源')).not.toHaveLength(0)
-    expect(backendApi.get).toHaveBeenCalledTimes(2)
+    expect(vi.mocked(backendApi.get).mock.calls.filter(([path]) => path === '/api/webui/plugins/mirrors')).toHaveLength(2)
   })
 
   it('返回按钮默认导航到 /plugins', async () => {
@@ -158,16 +164,16 @@ describe('PluginMirrorsPage 特征化', () => {
     await waitFor(() =>
       expect(screen.queryByText('添加新的 Git 镜像源配置')).not.toBeInTheDocument()
     )
-    await waitFor(() => expect(backendApi.get).toHaveBeenCalledTimes(2))
+    await waitFor(() => expect(vi.mocked(backendApi.get).mock.calls.filter(([path]) => path === '/api/webui/plugins/mirrors')).toHaveLength(2))
   })
 
   it('切换镜像源启用状态调用 PUT 取反 enabled', async () => {
     const user = userEvent.setup()
     await renderPage()
 
-    // switch 顺序：桌面表格行 → 移动端卡片
+    // switch 顺序：市场数据源 → 桌面表格行 → 移动端卡片
     const switches = screen.getAllByRole('switch')
-    await user.click(switches[0])
+    await user.click(switches[1])
 
     await waitFor(() =>
       expect(backendApi.put).toHaveBeenCalledWith('/api/webui/plugins/mirrors/official', {
```

**File**: `dashboard/src/routes/__tests__/shell-pages.test.tsx` (modified, +1/-1)
```diff
@@ -112,7 +112,7 @@ describe('嵌入页转发壳', () => {
     [
       <PluginConfigEmbedPage key="config" />,
       'embed-plugin-config',
-      '插件管理 - MaiBot Dashboard',
+      '插件扩展 - MaiBot Dashboard',
       '插件配置内容',
     ],
     [
```

**File**: `dashboard/src/routes/config/__tests__/bot.test.tsx` (modified, +83/-111)
```diff
@@ -25,6 +25,7 @@ afterEach(() => {
 
 vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }))
 vi.mock('@tanstack/react-router', () => ({
+  useNavigate: () => async () => {},
   Link: ({ children }: { children?: ReactNode }) => (
     <span data-testid="router-link">{children}</span>
   ),
@@ -243,6 +244,10 @@ const EXPECTED_FIELD_HOOKS: Array<[string, 'replace' | 'wrapper' | 'hidden']> =
   ['jargon.jargon_groups', 'replace'],
   ['jargon.learning_list', 'replace'],
   ['a_memorix.global_memory_sharing_enabled', 'hidden'],
+  ['a_memorix.plugin.enabled', 'wrapper'],
+  ['a_memorix.person_profile.enabled', 'wrapper'],
+  ['a_memorix.integration.heuristic_memory_recall_enabled', 'wrapper'],
+  ['a_memorix.image_memory.enabled', 'wrapper'],
   ['a_memorix.shared_memory_groups', 'replace'],
   ['a_memorix.filter.chats', 'replace'],
   ['a_memorix.filter.retrieval', 'wrapper'],
@@ -335,7 +340,7 @@ function baseSchema(): { schema: ConfigSchema } {
         }),
         // 无 uiLabel、有 uiParent：应归并进「机器人」tab
         sub_feature: sectionSchema('SubFeatureSection', '子功能配置', { uiParent: 'bot' }),
-        // advanced tab：默认隐藏，点击「更多」后出现
+        // 高级栏目也应直接显示在页面下拉列表中。
         experimental: sectionSchema('ExperimentalSection', '实验性配置', {
           uiLabel: '实验性',
           uiOrder: 3,
@@ -392,15 +397,28 @@ async function enterDetailMode(
   if (screen.getByRole('tab', { name: '详细设置' }).getAttribute('data-state') !== 'active') {
     await user.click(screen.getByRole('tab', { name: '详细设置' }))
   }
+  if (formTestId === 'form-personality' && !screen.queryByTestId(formTestId)) {
+    await selectConfigPage(user, '人格')
+  }
   await screen.findByTestId(formTestId)
 }
 
+async function openConfigMenu(user: ReturnType<typeof userEvent.setup>) {
+  await user.click(screen.getByRole('button', { name: '选择设置页面' }))
+  return screen.findByRole('menu')
+}
+
+async function selectConfigPage(user: ReturnType<typeof userEvent.setup>, name: string) {
+  await openConfigMenu(user)
+  await user.click(screen.getByRole('menuitem', { name }))
+}
+
 describe('BotConfigPage 特征化', () => {
   it('初始加载配置并展示详细设置', async () => {
     await renderBotPage()
     expect(configApi.getBotConfigCached).toHaveBeenCalledTimes(1)
     expect(configApi.getBotConfigSchema).toHaveBeenCalledTimes(1)
-    expect(screen.getByTestId('form-personality')).toBeInTheDocument()
+    expect(screen.getByTestId('form-bot')).toBeInTheDocument()
   })
 
   it('初始加载失败时弹出加载失败 toast', async () => {
@@ -562,33 +580,21 @@ describe('BotConfigPage 特征化', () => {
   })
 
   describe('详细设置模式', () => {
-    it('按 schema 构建 tab 分组：uiOrder 排序、uiParent 归并、advanced 默认隐藏', async () => {
-      localStorage.setItem('bot-config-tabs-guide-dismissed', 'true')
+    it('栏目下拉列表按 uiOrder 排序，包含高级栏目并归并 uiParent', async () => {
       const user = userEvent.setup()
       await renderBotPage()
       await enterDetailMode(user)
-
-      // 详细设置为默认模式，首次加载使用缓存配置。
       expect(configApi.getBotConfig).not.toHaveBeenCalled()
-
-      // tab 按 uiOrder 排序，advanced 的「实验性」默认隐藏
-      const tabList = document.querySelector('[data-config-bot-tab-list="true"]') as HTMLElement
-      const tabNames = within(tabList)
-        .getAllByRole('tab')
-        .map((tab) => tab.textContent)
-      expect(tabNames).toEqual(['人格', '机器人'])
-
-      // 「人格」tab 默认激活，表单仅包含自身分节
       expect(screen.getByTestId('form-personality-sections')).toHaveTextContent('personality')
       expect(screen.getByTestId('form-personality-values')).toHaveTextContent('原始人格')
-
-      // uiParent 指向 bot 的 sub_feature 归并进「机器人」tab
-      await user.click(within(tabList).getByRole('tab', { name: '机器人' }))
+      const menu = await openConfigMenu(user)
+      expect(
+        within(menu)
+          .getAllByRole('menuitem')
+          .map((item) => item.textContent)
+      ).toEqual(['人格', '机器人', '实验性'])
+      await user.click(within(menu).getByRole('menuitem', { name: '机器人' }))
       expect(await screen.findByTestId('form-bot-sections')).toHaveTextContent('bot,sub_feature')
-
-      // 点击「更多」后 advanced tab 出现
-      await user.click(screen.getByRole('button', { name: '更多' }))
-      expect(within(tabList).getByRole('tab', { name: '实验性' })).toBeInTheDocument()
     })
 
     it('表单修改更新分节值，防抖后按分节自动保存', async () => {
@@ -623,7 +629,7 @@ describe('BotConfigPage 特征化', () => {
       await enterDetailMode(user)
 
       expect(screen.getByTestId('form-personality')).toHaveAttribute('data-advanced', 'false')
-      await user.click(screen.getByRole('button', { name: '高级设置' }))
+      await user.click(screen.getByRole('switch', { name: '高级设置' }))
       expect(screen.getByTestId('form-personality')).toHaveAttribute('data-advanced', 'true')
     })
 
@@ -633,8 +639,7 @@ describe('BotConfigPage 特征化', () => {
       await renderBotPage()
       await enterDetailMode(user)
 
-      await user.click(screen.getByRole('button', { name: '更多' }))
-      await user.click(screen.getByRole('tab', { name: '实验性' }))
+      await s
```

**File**: `dashboard/src/routes/config/bot/hooks/__tests__/complexFieldHooks.test.tsx` (modified, +8/-2)
```diff
@@ -254,9 +254,12 @@ describe('complexFieldHooks', () => {
         <AliasNamesHook fieldPath="bot.alias_names" onChange={onChange} schema={fieldSchema} value={[]} />,
       )
 
-      expect(screen.getByText('暂无别名。')).toBeInTheDocument()
+      expect(screen.getByRole('button', { name: '添加别名' })).toBeInTheDocument()
 
       await user.click(screen.getByRole('button', { name: '添加别名' }))
+      const editor = screen.getByRole('dialog', { name: '别名列表' })
+      expect(within(editor).getByText('暂无别名。')).toBeInTheDocument()
+      await user.click(within(editor).getByRole('button', { name: '添加别名' }))
       expect(onChange).toHaveBeenLastCalledWith([''])
 
       rerender(
@@ -2002,8 +2005,11 @@ describe('complexFieldHooks', () => {
       render(
         <AliasNamesHook fieldPath="bot.alias_names" onChange={onChange} schema={fieldSchema} value={null} />,
       )
-      expect(screen.getByText('暂无别名。')).toBeInTheDocument()
+      expect(screen.getByRole('button', { name: '添加别名' })).toBeInTheDocument()
       await user.click(screen.getByRole('button', { name: '添加别名' }))
+      const editor = screen.getByRole('dialog', { name: '别名列表' })
+      expect(within(editor).getByText('暂无别名。')).toBeInTheDocument()
+      await user.click(within(editor).getByRole('button', { name: '添加别名' }))
       expect(onChange).toHaveBeenLastCalledWith([''])
 
       cleanup()
```

---

### Incident Patch 2: `a369d20d` (2026-10-04)
**Commit Message**: webui: 优化webui设置页

**File**: `changelogs/changelog.md` (modified, +2/-0)
```diff
@@ -5,6 +5,7 @@
 ## 主程序
 
 - 修复插件更新时意外重启问题
+- 修复插件进程自动重启后误报恢复成功的问题；缺失插件单独按上限重试，保留正常插件运行，主动禁用或卸载的插件除外。
 - 优化bot群昵称和qq名称与bot名称不符时的表现
 
 ## Webui [1.8.2]
@@ -13,6 +14,7 @@
 - 优化 Webui 可读性，新增字体切换（仅 千禧 主题）
 - 修复 AI 搜索官方文档检索失败的问题。
 - 插件管理新增更多操作菜单，支持从 ZIP 校验并安装插件
+- 设置栏目改为标题旁的页面下拉列表，统一显示全部栏目，取消展开与收起区分。
 
 # [1.3.2] - 2026-10-4
 
```

**File**: `dashboard/src/routes/config/bot.tsx` (modified, +173/-117)
```diff
@@ -2,6 +2,7 @@ import { Fragment, lazy, type ReactNode, Suspense, useCallback, useEffect, useMe
 import { useNavigate, useRouterState } from '@tanstack/react-router'
 import {
   Check,
+  ChevronDown,
   ChevronRight,
   Code2,
   Info,
@@ -26,7 +27,8 @@ import {
   AlertDialogHeader,
   AlertDialogTitle,
 } from '@/components/ui/alert-dialog'
-import { Button } from '@/components/ui/button'
+import { Button, buttonVariants } from '@/components/ui/button'
+import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
 import { DashboardTabBar, DashboardTabTrigger } from '@/components/ui/dashboard-tabs'
 import {
   DropdownMenu,
@@ -36,6 +38,7 @@ import {
   DropdownMenuTrigger,
 } from '@/components/ui/dropdown-menu'
 import { ScrollArea } from '@/components/ui/scroll-area'
+import { Switch } from '@/components/ui/switch'
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
 import { ThinkingIllustration } from '@/components/ui/thinking-illustration'
 import { CodeEditor } from '@/components/CodeEditor'
@@ -82,6 +85,7 @@ import {
 } from './bot/hooks'
 import { CommandPermissions } from './bot/CommandPermissions'
 import { GlobalLearningSettings } from './bot/GlobalLearningSettings'
+import { MemorySwitchGuard, MemorySwitchProvider } from './bot/MemorySwitchGuard'
 
 const WebUISettings = lazy(() =>
   import('@/routes/settings').then((module) => ({ default: module.SettingsPage }))
@@ -100,7 +104,6 @@ const EXPERIMENTAL_FEATURES_NOTICE_DISMISSED_KEY =
 interface TabGroup {
   id: string
   label: string
-  advanced: boolean
   order: number
   sections: string[]
 }
@@ -145,7 +148,6 @@ function buildTabGroupsFromSchema(schema: ConfigSchema): TabGroup[] {
       hosts.set(fieldName, {
         id: fieldName,
         label: fieldSchema.uiLabel,
-        advanced: fieldName === 'visual' || fieldName === 'expression' || Boolean(fieldSchema.uiAdvanced),
         order: fieldSchema.uiOrder ?? Number.POSITIVE_INFINITY,
         sections: [fieldName],
       })
@@ -190,6 +192,8 @@ function BotConfigPageContent() {
   const [autoSaving, setAutoSaving] = useState(false)
   const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
   const [editMode, setEditMode] = useState<BotSettingsMode>('detail')
+  const [advancedVisible, setAdvancedVisible] = useState(false)
+  const [activeConfigTab, setActiveConfigTab] = useState('bot')
   const [sourceCode, setSourceCode] = useState<string>('')
   const [hasTomlError, setHasTomlError] = useState(false)
   const [tomlErrorMessage, setTomlErrorMessage] = useState<string>('')
@@ -413,6 +417,10 @@ function BotConfigPageContent() {
       ['jargon.jargon_groups', JargonGroupsHook],
       ['jargon.learning_list', JargonLearningListHook],
       ['a_memorix.global_memory_sharing_enabled', HiddenFieldHook, 'hidden'],
+      ['a_memorix.plugin.enabled', MemorySwitchGuard, 'wrapper'],
+      ['a_memorix.person_profile.enabled', MemorySwitchGuard, 'wrapper'],
+      ['a_memorix.integration.heuristic_memory_recall_enabled', MemorySwitchGuard, 'wrapper'],
+      ['a_memorix.image_memory.enabled', MemorySwitchGuard, 'wrapper'],
       ['a_memorix.shared_memory_groups', AMemorixSharedMemoryGroupsHook],
       ['a_memorix.filter.chats', AMemorixRetrievalChatsHook],
       ['a_memorix.filter.retrieval', AMemorixRetrievalFilterGroupHook, 'wrapper'],
@@ -660,11 +668,43 @@ function BotConfigPageContent() {
         {/* 页面标题 */}
         <div className="flex flex-col gap-3 sm:gap-4">
           <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
-            <div className="min-w-0">
+            <div className="flex min-w-0 flex-wrap items-center gap-3">
               <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">麦麦设置</h1>
+              {editMode === 'detail' && tabGroups.length > 0 && (
+                <DropdownMenu>
+                  <DropdownMenuTrigger asChild>
+                    <Button variant="outline" className="gap-2 text-base font-semibold ![background-image:none]" aria-label="选择设置页面">
+                      {tabGroups.find((tab) => tab.id === activeConfigTab)?.label ?? tabGroups[0].label}
+                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
+                    </Button>
+                  </DropdownMenuTrigger>
+                  <DropdownMenuContent align="start" className="flex max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-40 flex-col gap-2 overflow-y-auto p-2 ![background-image:none]">
+                    {tabGroups.map((tab) => (
+                      <DropdownMenuItem
+                        key={tab.id}
+                        data-dashboard-button="true"
+                        onSelect={() => setActiveConfigTab(tab.id)}
+                        className={cn(
+                          buttonVariants({ variant: 'outline' }),
+                          'w-full shrink-0 justify-start text-base font-semibold ![background-i
```

**File**: `dashboard/src/routes/config/bot/MemorySwitchGuard.tsx` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
+
+import { getModelConfig } from '@/lib/config-api'
+import type { FieldHookComponentProps } from '@/lib/field-hooks'
+import type { ModelInfo, ModelTaskConfig, ProviderConfig } from '../model/types'
+
+const MemorySwitchContext = createContext({
+  memoryEnabled: false,
+  embeddingStatus: 'loading' as 'loading' | 'ready' | 'missing' | 'error',
+})
+
+export function MemorySwitchProvider({ memoryEnabled, children }: {
+  memoryEnabled: boolean
+  children: ReactNode
+}) {
+  const [embeddingStatus, setEmbeddingStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
+
+  useEffect(() => {
+    let active = true
+    const refresh = async () => {
+      try {
+        const config = await getModelConfig()
+        const tasks = config.model_task_config as ModelTaskConfig
+        const models = config.models as ModelInfo[]
+        const providers = config.api_providers as ProviderConfig[]
+        const configured = tasks.embedding.model_list.some((name) =>
+          models.some((model) => model.name === name && model.model_identifier.trim() &&
+            providers.some((provider) => provider.name === model.api_provider))
+        )
+        if (active) setEmbeddingStatus(configured ? 'ready' : 'missing')
+      } catch (error) {
+        console.error('检查嵌入模型配置失败:', error)
+        if (active) setEmbeddingStatus('error')
+      }
+    }
+    void refresh()
+    window.addEventListener('focus', refresh)
+    return () => {
+      active = false
+      window.removeEventListener('focus', refresh)
+    }
+  }, [])
+
+  return (
+    <MemorySwitchContext.Provider value={{ memoryEnabled, embeddingStatus }}>
+      {children}
+    </MemorySwitchContext.Provider>
+  )
+}
+
+export function MemorySwitchGuard({ fieldPath, value, children }: FieldHookComponentProps) {
+  const { memoryEnabled, embeddingStatus } = useContext(MemorySwitchContext)
+  const isMainSwitch = fieldPath === 'a_memorix.plugin.enabled'
+  // 已开启时允许关闭；检查尚未完成或失败时，不允许开启记忆。
+  const disabled = isMainSwitch
+    ? value !== true && embeddingStatus !== 'ready'
+    : !memoryEnabled
+  const hint = isMainSwitch && disabled
+    ? ({ loading: '正在检查嵌入模型配置…', missing: '请先在模型配置中配置嵌入模型。', error: '嵌入模型配置检查失败，请刷新后重试。', ready: '' })[embeddingStatus]
+    : ''
+
+  return (
+    <div className="space-y-1">
+      <fieldset disabled={disabled} className={disabled ? 'min-w-0 opacity-50 grayscale' : 'min-w-0'}>
+        {children}
+      </fieldset>
+      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
+    </div>
+  )
+}
```

**File**: `pytests/plugin_runtime/test_runner_activation_status.py` (added, +370/-0)
```diff
@@ -0,0 +1,370 @@
+"""Exercise activation classification with real loading, lifecycle and reloads.
+
+Only the Host transport and process logging are isolated. Manifests, config
+files, dependency resolution and activation all use the production paths.
+"""
+
+from __future__ import annotations
+
+from collections import deque
+from pathlib import Path
+from typing import Any, Counter, Dict, List, Set
+
+import json
+import sys
+
+import pytest
+
+from src.plugin_runtime.protocol.envelope import (
+    Envelope,
+    MessageType,
+    ReloadPluginPayload,
+    ReloadPluginResultPayload,
+    ReloadPluginsPayload,
+    ReloadPluginsResultPayload,
+    RunnerReadyPayload,
+)
+from src.plugin_runtime.runner.runner_main import PluginRunner
+
+_DEPENDENCY = "test.activation_dependency"
+_ADAPTER = "test.activation_adapter"
+_CHILD = "test.activation_child"
+_UNRELATED = "test.activation_unrelated"
+_FAILURE = "test.activation_failure"
+
+
+def _request(method: str, payload: Dict[str, Any]) -> Envelope:
+    return Envelope(request_id=1, message_type=MessageType.REQUEST, method=method, payload=payload)
+
+
+def _write_plugin(root: Path, plugin_id: str, dependencies: List[str] | None = None) -> Path:
+    plugin_dir = root / plugin_id
+    plugin_dir.mkdir()
+    (plugin_dir / "plugin.py").write_text(
+        "class Plugin:\n"
+        "    def __init__(self):\n"
+        "        self.loads = 0\n"
+        "        self.unloads = 0\n"
+        "    async def on_load(self):\n"
+        "        self.loads += 1\n"
+        "    async def on_unload(self):\n"
+        "        self.unloads += 1\n"
+        "def create_plugin():\n"
+        "    return Plugin()\n",
+        encoding="utf-8",
+    )
+    (plugin_dir / "_manifest.json").write_text(
+        json.dumps(
+            {
+                "manifest_version": 2,
+                "version": "1.0.0",
+                "name": plugin_id,
+                "description": plugin_id,
+                "author": {"name": "MaiBot", "url": "https://example.com"},
+                "license": "GPL-v3.0-or-later",
+                "urls": {"repository": "https://example.com/repo"},
+                "host_application": {"min_version": "0.0.0", "max_version": "9999.9999.9999"},
+                "sdk": {"min_version": "0.0.0", "max_version": "9999.9999.9999"},
+                "dependencies": [
+                    {"type": "plugin", "id": dependency_id, "version_spec": ">=1.0.0"}
+                    for dependency_id in dependencies or []
+                ],
+                "capabilities": [],
+                "i18n": {"default_locale": "zh-CN", "supported_locales": ["zh-CN"]},
+                "id": plugin_id,
+                "plugin_type": "adapter" if plugin_id == _ADAPTER else "extension",
+            }
+        ),
+        encoding="utf-8",
+    )
+    return plugin_dir
+
+
+def _configure(plugin_dir: Path, *, enabled: bool) -> None:
+    (plugin_dir / "config.toml").write_text(f"[plugin]\nenabled = {'true' if enabled else 'false'}\n", encoding="utf-8")
+
+
+class _HostTransport:
+    def __init__(self, runner: PluginRunner) -> None:
+        self.runner = runner
+        self.ready: RunnerReadyPayload | None = None
+        self.registered: Set[str] = set()
+        self.registration_failures: Counter[str] = Counter()
+        self.handlers: Dict[str, Any] = {}
+        self.disconnected = False
+
+    async def connect_and_handshake(self) -> bool:
+        return True
+
+    def register_method(self, method: str, handler: Any) -> None:
+        self.handlers[method] = handler
+
+    async def disconnect(self) -> None:
+        self.disconnected = True
+
+    async def send_request(self, method: str, **kwargs: Any) -> Envelope:
+        request = _request(method, kwargs["payload"])
+        plugin_id = kwargs.get("plugin_id", "")
+        if method == "plugin.register_components":
+            if self.registration_failures[plugin_id]:
+                self.registration_failures[plugin_id] -= 1
+                return request.make_error_response("E_INTERNAL", "registration refused")
+            self.registered.add(plugin_id)
+        elif method == "plugin.unregister":
+            self.registered.discard(plugin_id)
+        elif method == "runner.ready":
+            self.ready = RunnerReadyPayload.model_validate(request.payload)
+            self.runner._shutting_down = True
+        elif method != "plugin.bootstrap":
+            raise AssertionError(f"Unexpected RPC method: {method}")
+        return request.make_response(payload={"accepted": True})
+
+
+@pytest.fixture
+def activation_runtime(tmp_path: Path, monkeypatch):
+    root = tmp_path / "plugins"
+    root.mkdir()
+    paths = {
+        _DEPENDENCY: _write_plugin(root, _DEPENDENCY),
+        _ADAPTER: _write_plugin(root, _ADAPTER, [_DEPENDENCY]),
+        _CHILD: _write_plugin(root, _CHILD, [_ADAPTER]),
+        _UNRELATED: _write_plugin(root, _UNRELATED),
+    }
+    runner = PluginRunner(host_addres
```

---

### Incident Patch 3: `b00c0f71` (2026-10-04)
**Commit Message**: webui: 优化Webui可读性，添加字体选项，优化图标

**File**: `dashboard/package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "maibot-dashboard",
-  "version": "1.7.5",
+  "version": "1.8.2",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "maibot-dashboard",
-      "version": "1.7.5",
+      "version": "1.8.2",
       "dependencies": {
         "@codemirror/lang-css": "^6.3.1",
         "@codemirror/lang-javascript": "^6.2.4",
```

**File**: `dashboard/package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "maibot-dashboard",
   "private": true,
-  "version": "1.8.1",
+  "version": "1.8.2",
   "type": "module",
   "main": "./out/main/index.cjs",
   "scripts": {
```

**File**: `dashboard/public/fonts/ArkPixel-OFL.txt` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+Ark Pixel Font
+https://github.com/TakWolf/ark-pixel-font
+
+Copyright (c) 2021, TakWolf (https://takwolf.com).
+
+This Font Software is licensed under the SIL Open Font License, Version 1.1.
+This license is copied below, and is also available with a FAQ at:
+https://openfontlicense.org
+
+
+-----------------------------------------------------------
+SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
+-----------------------------------------------------------
+
+PREAMBLE
+The goals of the Open Font License (OFL) are to stimulate worldwide
+development of collaborative font projects, to support the font creation
+efforts of academic and linguistic communities, and to provide a free and
+open framework in which fonts may be shared and improved in partnership
+with others.
+
+The OFL allows the licensed fonts to be used, studied, modified and
+redistributed freely as long as they are not sold by themselves. The
+fonts, including any derivative works, can be bundled, embedded,
+redistributed and/or sold with any software provided that any reserved
+names are not used by derivative works. The fonts and derivatives,
+however, cannot be released under any other type of license. The
+requirement for fonts to remain under this license does not apply
+to any document created using the fonts or their derivatives.
+
+DEFINITIONS
+"Font Software" refers to the set of files released by the Copyright
+Holder(s) under this license and clearly marked as such. This may
+include source files, build scripts and documentation.
+
+"Reserved Font Name" refers to any names specified as such after the
+copyright statement(s).
+
+"Original Version" refers to the collection of Font Software components as
+distributed by the Copyright Holder(s).
+
+"Modified Version" refers to any derivative made by adding to, deleting,
+or substituting -- in part or in whole -- any of the components of the
+Original Version, by changing formats or by porting the Font Software to a
+new environment.
+
+"Author" refers to any designer, engineer, programmer, technical
+writer or other person who contributed to the Font Software.
+
+PERMISSION & CONDITIONS
+Permission is hereby granted, free of charge, to any person obtaining
+a copy of the Font Software, to use, study, copy, merge, embed, modify,
+redistribute, and sell modified and unmodified copies of the Font
+Software, subject to the following conditions:
+
+1) Neither the Font Software nor any of its individual components,
+in Original or Modified Versions, may be sold by itself.
+
+2) Original or Modified Versions of the Font Software may be bundled,
+redistributed and/or sold with any software, provided that each copy
+contains the above copyright notice and this license. These can be
+included either as stand-alone text files, human-readable headers or
+in the appropriate machine-readable metadata fields within text or
+binary files as long as those fields can be easily viewed by the user.
+
+3) No Modified Version of the Font Software may use the Reserved Font
+Name(s) unless explicit written permission is granted by the corresponding
+Copyright Holder. This restriction only applies to the primary font name as
+presented to the users.
+
+4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
+Software shall not be used to promote, endorse or advertise any
+Modified Version, except to acknowledge the contribution(s) of the
+Copyright Holder(s) and the Author(s) or with their explicit written
+permission.
+
+5) The Font Software, modified or unmodified, in part or in whole,
+must be distributed entirely under this license, and must not be
+distributed under any other license. The requirement for fonts to
+remain under this license does not apply to any document created
+using the Font Software.
+
+TERMINATION
+This license becomes null and void if any of the above conditions are
+not met.
+
+DISCLAIMER
+THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
+EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
+MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
+OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
+COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
+INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
+DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
+FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
+OTHER DEALINGS IN THE FONT SOFTWARE.
```

**File**: `dashboard/public/fonts/DepartureMono-OFL.txt` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+Copyright 2022–2024 Helena Zhang (helenazhang.com).
+
+This Font Software is licensed under the SIL Open Font License, Version 1.1.
+This license is copied below, and is also available with a FAQ at:
+https://openfontlicense.org
+
+
+-----------------------------------------------------------
+SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
+-----------------------------------------------------------
+
+PREAMBLE
+The goals of the Open Font License (OFL) are to stimulate worldwide
+development of collaborative font projects, to support the font creation
+efforts of academic and linguistic communities, and to provide a free and
+open framework in which fonts may be shared and improved in partnership
+with others.
+
+The OFL allows the licensed fonts to be used, studied, modified and
+redistributed freely as long as they are not sold by themselves. The
+fonts, including any derivative works, can be bundled, embedded,
+redistributed and/or sold with any software provided that any reserved
+names are not used by derivative works. The fonts and derivatives,
+however, cannot be released under any other type of license. The
+requirement for fonts to remain under this license does not apply
+to any document created using the fonts or their derivatives.
+
+DEFINITIONS
+"Font Software" refers to the set of files released by the Copyright
+Holder(s) under this license and clearly marked as such. This may
+include source files, build scripts and documentation.
+
+"Reserved Font Name" refers to any names specified as such after the
+copyright statement(s).
+
+"Original Version" refers to the collection of Font Software components as
+distributed by the Copyright Holder(s).
+
+"Modified Version" refers to any derivative made by adding to, deleting,
+or substituting -- in part or in whole -- any of the components of the
+Original Version, by changing formats or by porting the Font Software to a
+new environment.
+
+"Author" refers to any designer, engineer, programmer, technical
+writer or other person who contributed to the Font Software.
+
+PERMISSION & CONDITIONS
+Permission is hereby granted, free of charge, to any person obtaining
+a copy of the Font Software, to use, study, copy, merge, embed, modify,
+redistribute, and sell modified and unmodified copies of the Font
+Software, subject to the following conditions:
+
+1) Neither the Font Software nor any of its individual components,
+in Original or Modified Versions, may be sold by itself.
+
+2) Original or Modified Versions of the Font Software may be bundled,
+redistributed and/or sold with any software, provided that each copy
+contains the above copyright notice and this license. These can be
+included either as stand-alone text files, human-readable headers or
+in the appropriate machine-readable metadata fields within text or
+binary files as long as those fields can be easily viewed by the user.
+
+3) No Modified Version of the Font Software may use the Reserved Font
+Name(s) unless explicit written permission is granted by the corresponding
+Copyright Holder. This restriction only applies to the primary font name as
+presented to the users.
+
+4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
+Software shall not be used to promote, endorse or advertise any
+Modified Version, except to acknowledge the contribution(s) of the
+Copyright Holder(s) and the Author(s) or with their explicit written
+permission.
+
+5) The Font Software, modified or unmodified, in part or in whole,
+must be distributed entirely under this license, and must not be
+distributed under any other license. The requirement for fonts to
+remain under this license does not apply to any document created
+using the Font Software.
+
+TERMINATION
+This license becomes null and void if any of the above conditions are
+not met.
+
+DISCLAIMER
+THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
+EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
+MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
+OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
+COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
+INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
+DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
+FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
+OTHER DEALINGS IN THE FONT SOFTWARE.
```

**File**: `dashboard/public/fonts/Jersey20-OFL.txt` (renamed, +2/-2)
```diff
@@ -1,8 +1,8 @@
-Copyright 2021 The Pixelify Sans Project Authors (https://github.com/eifetx/Pixelify-Sans)
+Copyright 2023 The Soft Type Project Authors (https://github.com/scfried/soft-type-jersey)
 
 This Font Software is licensed under the SIL Open Font License, Version 1.1.
 This license is copied below, and is also available with a FAQ at:
-https://scripts.sil.org/OFL
+https://openfontlicense.org
 
 
 -----------------------------------------------------------
```

**File**: `dashboard/src/components/layout/NavItem.tsx` (modified, +33/-0)
```diff
@@ -38,6 +38,10 @@ export function NavItem({
   const flyoutRef = useRef<HTMLDivElement>(null)
   const [flyoutRect, setFlyoutRect] = useState<DOMRect | null>(null)
   const [flyoutMounted, setFlyoutMounted] = useState(false)
+  // 原位按钮和悬浮按钮是两份 DOM。浮层可能在「按下」和「抬起」之间才盖上来（或刚好收走），
+  // 这时两次事件落在不同元素上，浏览器不会派发 click。用这两个标记识别这种情况并补一次点击。
+  const pressStartedRef = useRef(false)
+  const clickDeliveredRef = useRef(false)
 
   const handleFlyoutScroll = useCallback(() => {
     const node = flyoutRef.current
@@ -145,6 +149,7 @@ export function NavItem({
     },
     className: linkClassName,
     onClick: () => {
+      clickDeliveredRef.current = true
       setFlyoutRect(null)
       onMobileMenuClose()
     },
@@ -207,6 +212,34 @@ export function NavItem({
         if (event.pointerType === 'mouse') openFlyout()
       }}
       onPointerLeave={() => setFlyoutRect(null)}
+      onPointerDown={(event) => {
+        const onNavLink = (event.target as Element).closest('[data-dashboard-nav-item]') !== null
+        pressStartedRef.current = event.button === 0 && onNavLink
+        clickDeliveredRef.current = false
+      }}
+      onPointerUp={(event) => {
+        if (!pressStartedRef.current) return
+        pressStartedRef.current = false
+        // 带修饰键的点击（新标签页打开等）交给浏览器默认行为，不代为触发。
+        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
+          return
+        }
+        const releasedLink = (event.target as Element).closest<HTMLElement>(
+          '[data-dashboard-nav-item]'
+        )
+        if (!releasedLink) return
+        window.setTimeout(() => {
+          if (clickDeliveredRef.current) return
+          // 正常情况下 click 已经在这之前送达；没送达说明按下和抬起落在了两份按钮上。
+          const link = releasedLink.isConnected
+            ? releasedLink
+            : (itemRef.current?.firstElementChild as HTMLElement | null)
+          link?.click()
+        }, 0)
+      }}
+      onPointerCancel={() => {
+        pressStartedRef.current = false
+      }}
       onFocus={openFlyout}
       onBlur={(event) => {
         if (!itemRef.current?.contains(event.relatedTarget) && !flyoutRef.current?.contains(event.relatedTarget)) {
```

**File**: `dashboard/src/components/theme-provider.tsx` (modified, +6/-0)
```diff
@@ -13,6 +13,11 @@ import {
   saveThemePartial,
 } from '@/lib/theme/storage'
 import { applyThemePipeline, removeCustomCSS } from '@/lib/theme/pipeline'
+import {
+  applyMillenniumFonts,
+  loadMillenniumCjkFont,
+  loadMillenniumFont,
+} from '@/lib/theme/millennium-font'
 
 type Theme = 'dark' | 'light' | 'system'
 
@@ -87,6 +92,7 @@ export function ThemeProvider({
     }
 
     root.dataset.dashboardStyle = dashboardStyle
+    applyMillenniumFonts(loadMillenniumFont(), loadMillenniumCjkFont())
     root.dataset.retroTextureStyle = futureRetroConfig.textureStyle
     root.style.setProperty('--retro-paper-warmth', `${futureRetroConfig.paperWarmth}%`)
     root.style.setProperty('--retro-panel-depth', String(futureRetroConfig.panelDepth / 100))
```

**File**: `dashboard/src/components/ui/millennium-icons.tsx` (added, +63/-0)
```diff
@@ -0,0 +1,63 @@
+/**
+ * 千禧风格的线条图标：24 网格、方头直角、统一 2.5 线宽，和键帽、像素字的硬朗感一致。
+ * 以未来复古图标集的名称为键，没有登记的名称由调用方退回到备用图标。
+ */
+
+const MILLENNIUM_ICON_PATHS: Record<string, string> = {
+  // 侧栏导航
+  'allergens-fish-remix': 'M3 11l9-8 9 8M6 10v10h12V10M10 20v-5h4v5',
+  'desktop-chat-remix': 'M3 4h18v12H3zM9 20h6M12 16v4M7 8h6M7 12h10',
+  'page-setting-remix': 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6',
+  'module-remix': 'M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10',
+  'script-1-remix': 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7',
+  'happy-face-remix': 'M4 4h16v16H4zM9 9v2M15 9v2M8 15h8',
+  'chat-bubble-square-write-remix': 'M4 4h11M4 4v16h16V9M9 15l10-10 2 2-10 10H9z',
+  'sign-hashtag-solid': 'M9 3L7 21M17 3l-2 18M4 9h17M3 15h17',
+  'cyborg-solid':
+    'M7 7h10v10H7zM10 10h4v4h-4zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4',
+  'user-sticker-square-remix': 'M4 4h16v6H4zM4 10h16v10H4zM8 7h1M8 14h8M8 17h5',
+  'application-add-remix': 'M4 4h7v7H4zM4 13h7v7H4zM13 13h7v7h-7M16.5 4v7M13 7.5h7',
+  'router-wifi-network-solid': 'M3 14h18v6H3zM7 17h1M11 17h1M17 14V8M13 7l4-4 4 4',
+  'store-2-solid': 'M3 9l2-5h14l2 5v3H3zM5 12v8h14v-8M10 20v-5h4v5',
+  // 搜索与通用
+  'file-bookmark-solid': 'M6 3h9l4 4v14H6zM15 3v4h4M9 11h4v6l-2-2-2 2z',
+  'horizontal-slider-2-solid': 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6',
+  'search-bar-solid': 'M4 4h11v11H4zM15 15l6 6',
+  'edit-pdf-solid': 'M4 20h4L20 8l-4-4L4 16z',
+  'delete-2-solid': 'M4 7h16M9 7V4h6v3M6 7v13h12V7M10 11v6M14 11v6',
+  'line-arrow-right-1-remix': 'M9 5l7 7-7 7',
+  'information-circle-solid': 'M4 4h16v16H4zM12 11v6M12 7v1',
+}
+
+// eslint-disable-next-line react-refresh/only-export-components
+export function getMillenniumIconPath(name: string): string | undefined {
+  return MILLENNIUM_ICON_PATHS[name]
+}
+
+interface MillenniumIconProps {
+  path: string
+  className?: string
+  color?: string
+  size?: number | string
+}
+
+export function MillenniumIcon({ path, className, color, size = 20 }: MillenniumIconProps) {
+  return (
+    <svg
+      xmlns="http://www.w3.org/2000/svg"
+      viewBox="0 0 24 24"
+      width={size}
+      height={size}
+      fill="none"
+      stroke={color ?? 'currentColor'}
+      strokeWidth={2.5}
+      strokeLinecap="square"
+      strokeLinejoin="miter"
+      aria-hidden="true"
+      data-millennium-icon="true"
+      className={className}
+    >
+      <path d={path} />
+    </svg>
+  )
+}
```

---

### Incident Patch 4: `7f64e7a9` (2026-10-04)
**Commit Message**: fix: 更新插件时序问题

**File**: `src/plugin_runtime/integration.py` (modified, +34/-16)
```diff
@@ -136,8 +136,14 @@ def __init__(self) -> None:
             hook_spec_registry=self._hook_spec_registry,
         )
         self._adapter_transition_lock = asyncio.Lock()
+        self._plugin_file_update_lock = asyncio.Lock()
         self._offline_adapter_plugin_ids: Set[str] = set()
 
+    async def run_plugin_file_update(self, operation: Callable[[], Awaitable[None]]) -> None:
+        """在主循环串行执行文件替换及运行时恢复，避免源码监听中途重启 Supervisor。"""
+        async with self._plugin_file_update_lock:
+            await operation()
+
     async def _dispatch_platform_inbound(self, envelope: InboundMessageEnvelope) -> None:
         """接收 Platform IO 审核后的入站消息并送入主消息链。
 
@@ -1815,6 +1821,21 @@ async def _handle_plugin_config_changes(self, plugin_id: str, changes: Sequence[
         except Exception as exc:
             logger.warning(f"插件 {plugin_id} 配置文件变更处理失败: {exc}")
 
+    @staticmethod
+    def _is_watchable_plugin_source(path: Path, plugin_dirs: Sequence[Path]) -> bool:
+        """只监听真实插件目录中的源码，排除更新暂存、备份及数据等保留目录。"""
+        if path.name != "_manifest.json" and path.suffix != ".py":
+            return False
+        resolved_path = path.resolve()
+        for plugin_root in plugin_dirs:
+            root = plugin_root.resolve()
+            if resolved_path == root or not resolved_path.is_relative_to(root):
+                continue
+            plugin_directory = root / resolved_path.relative_to(root).parts[0]
+            if not is_reserved_plugin_directory(plugin_directory):
+                return True
+        return False
+
     async def _handle_plugin_source_changes(self, changes: Sequence[FileChange]) -> None:
         """处理插件源码相关变化。
 
@@ -1826,24 +1847,21 @@ async def _handle_plugin_source_changes(self, changes: Sequence[FileChange]) ->
             return
 
         plugin_dirs = list(self._iter_plugin_dirs())
-        relevant_source_changes = [
-            change.path.resolve()
-            for change in changes
-            if change.path.name in {"plugin.py", "_manifest.json"} or change.path.suffix == ".py"
-        ]
-        if not relevant_source_changes:
+        if not any(self._is_watchable_plugin_source(change.path, plugin_dirs) for change in changes):
             return
 
-        dependency_sync_state = await self._sync_plugin_dependencies(plugin_dirs)
-        restart_reason = "file_watcher"
-        if dependency_sync_state.environment_changed:
-            restart_reason = "file_watcher_dependency_install"
-        elif dependency_sync_state.blocked_changed_plugin_ids:
-            restart_reason = "file_watcher_blocklist_changed"
-
-        restarted = await self._restart_supervisors(restart_reason)
-        if not restarted:
-            logger.warning(f"插件源码变更后重启 Supervisor 失败: {restart_reason}")
+        # 下载和备份不参与监听；真实源码变化必须等版本替换及运行时恢复完成后再处理。
+        async with self._plugin_file_update_lock:
+            dependency_sync_state = await self._sync_plugin_dependencies(plugin_dirs)
+            restart_reason = "file_watcher"
+            if dependency_sync_state.environment_changed:
+                restart_reason = "file_watcher_dependency_install"
+            elif dependency_sync_state.blocked_changed_plugin_ids:
+                restart_reason = "file_watcher_blocklist_changed"
+
+            restarted = await self._restart_supervisors(restart_reason)
+            if not restarted:
+                logger.warning(f"插件源码变更后重启 Supervisor 失败: {restart_reason}")
 
     @staticmethod
     def _plugin_dir_matches(path: Path, plugin_dir: Path) -> bool:
```

---

### Incident Patch 5: `aa33a5d7` (2026-10-04)
**Commit Message**: webui: 插件列表使用新的源

**File**: `dashboard/src/lib/plugin-api/__tests__/marketplace.test.ts` (modified, +39/-2)
```diff
@@ -2,7 +2,7 @@ import { beforeEach, describe, expect, it, vi } from 'vitest'
 
 import type { MaimaiVersion, PluginLoadProgress } from '../types'
 
-const MARKET_LIST_STORAGE_KEY = 'maibot-plugin-market-list-cache-v2'
+const MARKET_LIST_STORAGE_KEY = 'maibot-plugin-market-list-cache-v3'
 
 // 稳定的 mock：backendApi 方法与 ApiError 类在 vi.resetModules 后保持同一引用
 const httpMocks = vi.hoisted(() => {
@@ -75,12 +75,49 @@ function mockFetchRawSuccess(items: Array<Record<string, unknown>>): void {
 describe('plugin-api/marketplace', () => {
   beforeEach(() => {
     vi.resetModules()
-    httpMocks.backendApi.get.mockResolvedValue({ plugins: [] })
+    httpMocks.backendApi.get.mockImplementation(async (path: string) =>
+      path === '/api/webui/plugins/marketplace' ? { source: 'github' } : { plugins: [] })
     localStorage.clear()
     vi.spyOn(console, 'warn').mockImplementation(() => {})
   })
 
   describe('fetchPluginList', () => {
+    it('兼容与全部列表分别请求和缓存，切换回来复用对应缓存', async () => {
+      httpMocks.backendApi.get.mockImplementation(async (_path: string, options: { query: { compatible_only: boolean } }) => ({
+        source: 'service',
+        details: options.query.compatible_only ? [createMarketItem()] : [createMarketItem(), createMarketItem({ id: 'market-b' })],
+        catalog: { plugins: [] },
+        stats: {},
+      }))
+      const marketplace = await loadMarketplace()
+      expect(await marketplace.fetchPluginList({ compatibleOnly: true })).toHaveLength(1)
+      expect(await marketplace.fetchPluginList({ compatibleOnly: false })).toHaveLength(2)
+      expect(await marketplace.fetchPluginList({ compatibleOnly: true })).toHaveLength(1)
+      expect(httpMocks.backendApi.get).toHaveBeenCalledTimes(2)
+      expect(marketplace.getCachedPluginList(true)).toHaveLength(1)
+      expect(marketplace.getCachedPluginList(false)).toHaveLength(2)
+      marketplace.invalidatePluginMarketCache()
+      expect(marketplace.getCachedPluginList(true)).toBeNull()
+      expect(marketplace.getCachedPluginList(false)).toBeNull()
+    })
+
+    it('插件中心复合列表保留统计，不再拉取 GitHub 清单，切换来源清空缓存', async () => {
+      httpMocks.backendApi.get.mockResolvedValue({
+        source: 'service',
+        details: [createMarketItem()],
+        catalog: { plugins: [] },
+        stats: { 'plugin-a': { plugin_id: 'plugin-a', downloads: 12, likes: 3, dislikes: 0, rating: 4, rating_count: 2 } },
+      })
+      const marketplace = await loadMarketplace()
+      const plugins = await marketplace.fetchPluginList()
+      expect(plugins[0]).toMatchObject({ market_data_source: 'service', downloads: 12, rating: 4 })
+      expect(plugins[0].marketplace_stats?.likes).toBe(3)
+      expect(httpMocks.backendApi.post).not.toHaveBeenCalled()
+      marketplace.invalidatePluginMarketCache()
+      expect(marketplace.getCachedPluginList()).toBeNull()
+      expect(localStorage.getItem(MARKET_LIST_STORAGE_KEY)).toBeNull()
+    })
+
     it('解析插件列表并做字段归一化', async () => {
       mockFetchRawSuccess([
         createMarketItem({
```

**File**: `dashboard/src/lib/plugin-api/marketplace.ts` (modified, +94/-40)
```diff
@@ -13,7 +13,7 @@ const PLUGIN_REPO_NAME = 'plugin-repo'
 const PLUGIN_REPO_BRANCH = 'main'
 const PLUGIN_DETAILS_FILE = 'plugin_details.json'
 const PLUGIN_LIST_CACHE_TTL = 5 * 60 * 1000
-const PLUGIN_LIST_STORAGE_KEY = 'maibot-plugin-market-list-cache-v2'
+const PLUGIN_LIST_STORAGE_KEY = 'maibot-plugin-market-list-cache-v3'
 const PLUGIN_TYPES = new Set<PluginType>([
   'adapter',
   'chat',
@@ -30,8 +30,17 @@ const PLUGIN_TYPES = new Set<PluginType>([
   'other',
 ])
 
-let pluginListCache: { timestamp: number; result: PluginInfo[] } | null = null
-let pluginListRequest: Promise<PluginInfo[]> | null = null
+const pluginListCaches = new Map<boolean, { timestamp: number; result: PluginInfo[] }>()
+const pluginListRequests = new Map<boolean, Promise<PluginInfo[]>>()
+let cacheGeneration = 0
+
+export function invalidatePluginMarketCache(): void {
+  cacheGeneration += 1
+  pluginListCaches.clear()
+  pluginListRequests.clear()
+  localStorage.removeItem(PLUGIN_LIST_STORAGE_KEY)
+  localStorage.removeItem(`${PLUGIN_LIST_STORAGE_KEY}-compatible`)
+}
 
 interface PluginListStorageCache {
   timestamp: number
@@ -171,13 +180,13 @@ function normalizeDateString(value: unknown): string {
   return ''
 }
 
-function readPluginListStorageCache(): PluginListStorageCache | null {
+function readPluginListStorageCache(compatibleOnly: boolean): PluginListStorageCache | null {
   if (typeof localStorage === 'undefined') {
     return null
   }
 
   try {
-    const rawCache = localStorage.getItem(PLUGIN_LIST_STORAGE_KEY)
+    const rawCache = localStorage.getItem(compatibleOnly ? `${PLUGIN_LIST_STORAGE_KEY}-compatible` : PLUGIN_LIST_STORAGE_KEY)
     if (!rawCache) {
       return null
     }
@@ -197,14 +206,14 @@ function readPluginListStorageCache(): PluginListStorageCache | null {
   }
 }
 
-function writePluginListStorageCache(data: PluginInfo[]): void {
+function writePluginListStorageCache(data: PluginInfo[], compatibleOnly: boolean): void {
   if (typeof localStorage === 'undefined') {
     return
   }
 
   try {
     localStorage.setItem(
-      PLUGIN_LIST_STORAGE_KEY,
+      compatibleOnly ? `${PLUGIN_LIST_STORAGE_KEY}-compatible` : PLUGIN_LIST_STORAGE_KEY,
       JSON.stringify({
         timestamp: Date.now(),
         data,
@@ -215,46 +224,62 @@ function writePluginListStorageCache(data: PluginInfo[]): void {
   }
 }
 
-export function getCachedPluginList(): PluginInfo[] | null {
+export function getCachedPluginList(compatibleOnly = false): PluginInfo[] | null {
+  const pluginListCache = pluginListCaches.get(compatibleOnly)
   if (pluginListCache) {
     return pluginListCache.result
   }
 
-  const storedCache = readPluginListStorageCache()
+  const storedCache = readPluginListStorageCache(compatibleOnly)
   if (!storedCache) {
     return null
   }
 
-  pluginListCache = { timestamp: storedCache.timestamp, result: storedCache.data }
+  pluginListCaches.set(compatibleOnly, { timestamp: storedCache.timestamp, result: storedCache.data })
   return storedCache.data
 }
 
 /**
  * 从远程获取插件列表(通过后端代理避免 CORS)
  */
-async function fetchPluginListUncached(): Promise<PluginInfo[]> {
-  const result = await backendApi.post<{ success: boolean; data: string; error?: string }>(
-    '/api/webui/plugins/fetch-raw',
-    {
-      body: {
-        owner: PLUGIN_REPO_OWNER,
-        repo: PLUGIN_REPO_NAME,
-        branch: PLUGIN_REPO_BRANCH,
-        file_path: PLUGIN_DETAILS_FILE,
-      },
-      errorMessage: '获取插件列表失败',
+async function fetchPluginListUncached(compatibleOnly: boolean): Promise<PluginInfo[]> {
+  const market = await backendApi.get<{
+    source: 'github' | 'service'
+    details: PluginApiResponse[]
+    catalog: { plugins: PluginReleaseCatalog[] }
+    stats: Record<string, import('@/lib/plugin-stats').PluginStatsData>
+  }>('/api/webui/plugins/marketplace', {
+    query: { compatible_only: compatibleOnly }, errorMessage: '获取插件市场数据失败',
+  })
+  let data: PluginApiResponse[]
+  let catalog: { plugins: PluginReleaseCatalog[] }
+  if (market.source === 'github') {
+    const result = await backendApi.post<{ success: boolean; data: string; error?: string }>(
+      '/api/webui/plugins/fetch-raw',
+      {
+        body: {
+          owner: PLUGIN_REPO_OWNER,
+          repo: PLUGIN_REPO_NAME,
+          branch: PLUGIN_REPO_BRANCH,
+          file_path: PLUGIN_DETAILS_FILE,
+        },
+        errorMessage: '获取插件列表失败',
+      }
+    )
+
+    // 业务级失败：该 endpoint 的错误字段是 error 而非 message，不走 requireSuccess
+    if (!result.success || !result.data) {
+      throw new ApiError(result.error || '获取插件列表失败', { detail: result })
     }
-  )
 
-  // 业务级失败：该 endpoint 的错误字段是 error 而非 message，不走 requireSuccess
-  if (!result.success || !result.data) {
-    throw new ApiError(result.error || '获取插件列表失败', { detail: result })
+    data = JSON.parse(result.data)
+    catalog = await backendApi.get<{ plugins: PluginReleaseCatalog[] }>('/api/webui/plugins/releases', {
+      errorMessage: '获取插件发布版本失败',
+    })
+  } else {
+    dat
```

**File**: `dashboard/src/routes/__tests__/plugin-detail.test.tsx` (modified, +1/-0)
```diff
@@ -36,6 +36,7 @@ vi.mock('@/lib/plugin-api', () => ({
   checkGitStatus: vi.fn(),
   checkPluginInstalled: vi.fn(),
   fetchPluginList: vi.fn(),
+  getCachedPluginList: vi.fn(),
   getInstalledPluginVersion: vi.fn(),
   getInstalledPlugins: vi.fn(),
   getMaimaiVersion: vi.fn(),
```

**File**: `dashboard/src/routes/plugin-config.tsx` (modified, +5/-3)
```diff
@@ -1852,9 +1852,11 @@ function PluginConfigPageContent() {
                         <h3 className="min-w-0 text-sm leading-snug font-medium break-words sm:truncate sm:text-base">
                           {plugin.manifest.name}
                         </h3>
-                        <Badge variant="outline" className="flex-shrink-0 text-xs">
-                          {getPluginTypeLabel(plugin)}
-                        </Badge>
+                        {!adapterManagement && (
+                          <Badge variant="outline" className="flex-shrink-0 text-xs">
+                            {getPluginTypeLabel(plugin)}
+                          </Badge>
+                        )}
                         {statusMeta.showsBadge !== false && (
                           <Badge
                             variant="outline"
```

**File**: `dashboard/src/routes/plugin-detail.tsx` (modified, +9/-1)
```diff
@@ -36,6 +36,8 @@ import {
   updatePlugin,
   checkPluginInstalled,
   fetchPluginList,
+  getCachedPluginList,
+  fetchPluginDetail,
   getInstalledPluginVersion,
   getInstalledPlugins,
   type InstalledPlugin,
@@ -319,11 +321,17 @@ export function PluginDetailPage({
   const pluginQuery = useQuery({
     queryKey: ['plugin-detail', pluginId],
     enabled: !!pluginId,
+    staleTime: 5 * 60 * 1000,
     queryFn: async () => {
+      // 从兼容列表进入详情时直接获取该插件，避免先补下载全部插件列表。
+      const cachedPlugin = getCachedPluginList(true)?.find(
+        (p) => p.id === pluginId || p.marketplace_id === pluginId
+      )
+      if (cachedPlugin?.market_data_source === 'service') return fetchPluginDetail(cachedPlugin)
       const list = await fetchPluginList()
       const foundPlugin = list.find((p) => p.id === pluginId || p.marketplace_id === pluginId)
       if (foundPlugin) {
-        return foundPlugin
+        return foundPlugin.market_data_source === 'service' ? fetchPluginDetail(foundPlugin) : foundPlugin
       }
 
       const installed = await getInstalledPlugins()
```

**File**: `src/webui/routers/plugin/__init__.py` (modified, +2/-0)
```diff
@@ -6,6 +6,7 @@
 from .config_routes import router as config_router
 from .icon_routes import router as icon_router
 from .management import router as management_router
+from .marketplace import router as marketplace_router
 from .progress import get_progress_router, update_progress
 from .releases import router as releases_router
 from .runtime_routes import router as runtime_router
@@ -15,6 +16,7 @@
 router = APIRouter(prefix="/plugins", tags=["插件管理"])
 router.include_router(catalog_router)
 router.include_router(management_router)
+router.include_router(marketplace_router)
 router.include_router(releases_router)
 router.include_router(icon_router)
 router.include_router(config_router)
```

**File**: `src/webui/routers/plugin/catalog.py` (modified, +8/-0)
```diff
@@ -83,6 +83,14 @@ def add_mirror(request: AddMirrorRequest, maibot_session: Optional[str] = Cookie
         raise HTTPException(status_code=500, detail=f"服务器错误: {str(e)}") from e
 
 
+@router.post("/mirrors/reset", response_model=AvailableMirrorsResponse)
+def reset_mirrors(maibot_session: Optional[str] = Cookie(None)) -> AvailableMirrorsResponse:
+    require_plugin_token(maibot_session)
+    config = get_git_mirror_service().get_mirror_config()
+    mirrors = [_mirror_to_response(mirror) for mirror in config.reset_default_mirrors()]
+    return AvailableMirrorsResponse(mirrors=mirrors, default_priority=config.get_default_priority_list())
+
+
 @router.put("/mirrors/{mirror_id}", response_model=MirrorConfigResponse)
 def update_mirror(
     mirror_id: str,
```

**File**: `src/webui/routers/plugin/marketplace.py` (added, +107/-0)
```diff
@@ -0,0 +1,107 @@
+"""插件中心 v2 代理与市场数据源设置。"""
+
+from typing import Any, Dict, Optional
+
+from fastapi import APIRouter, Cookie, HTTPException
+from pydantic import BaseModel
+import asyncio
+
+import httpx
+
+from src.config.config import MMC_VERSION
+from src.webui.services.plugin_market_service import (
+    request_market,
+    request_market_detail,
+    save_market_source,
+    use_github_market_data,
+)
+
+from .releases import PluginReleaseEntry, describe_entry, parse_market_release_entry
+from .support import require_plugin_token
+
+router = APIRouter()
+
+
+class MarketSourceSettings(BaseModel):
+    use_github: bool
+
+
+@router.get("/marketplace/source", response_model=MarketSourceSettings)
+def get_market_source(maibot_session: Optional[str] = Cookie(None)) -> MarketSourceSettings:
+    require_plugin_token(maibot_session)
+    return MarketSourceSettings(use_github=use_github_market_data())
+
+
+@router.put("/marketplace/source", response_model=MarketSourceSettings)
+def update_market_source(
+    request: MarketSourceSettings, maibot_session: Optional[str] = Cookie(None)
+) -> MarketSourceSettings:
+    require_plugin_token(maibot_session)
+    save_market_source(request.use_github)
+    return request
+
+
+def market_entry(data: Dict[str, Any]) -> PluginReleaseEntry:
+    """服务端选中的版本仍由宿主校验 SDK、清单格式与依赖声明。"""
+    return PluginReleaseEntry.model_validate(
+        {
+            "id": data["marketplace_id"],
+            "manifest_id": data["id"],
+            "repositoryUrl": data["repository_url"],
+            "mode": data["install_mode"],
+            "versions": [data["release"]] if data.get("release") else [],
+            "sync_error": data.get("sync_error"),
+        }
+    )
+
+
+def describe_market_list(data: Dict[str, Any]) -> Dict[str, Any]:
+    details = []
+    catalog = []
+    stats = {}
+    for item in data["plugins"]:
+        entry = market_entry(item)
+        details.append(
+            {
+                "id": entry.id,
+                "manifest": item["manifest"],
+                "assets": {"icon_64": item["icon_url"]} if item.get("icon_url") else None,
+            }
+        )
+        description = describe_entry(entry)
+        # 未提供可推荐发布版本时不能让空版本列表被误判成分支插件。
+        if entry.mode == "releases" and not entry.versions:
+            description["recommended_version"] = None
+        catalog.append(description)
+        stats[item["id"]] = item["stats"]
+    return {"source": "service", "details": details, "catalog": {"plugins": catalog}, "stats": stats}
+
+
+@router.get("/marketplace")
+async def get_marketplace(compatible_only: bool = False, maibot_session: Optional[str] = Cookie(None)) -> Dict[str, Any]:
+    require_plugin_token(maibot_session)
+    if await asyncio.to_thread(use_github_market_data):
+        return {"source": "github"}
+    try:
+        data = await request_market(
+            "plugins/summary", {"maibot_version": MMC_VERSION, "compatible_only": str(compatible_only).lower()}
+        )
+        return await asyncio.to_thread(describe_market_list, data)
+    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
+        raise HTTPException(status_code=502, detail=f"获取插件中心列表失败：{exc}") from exc
+
+
+@router.get("/marketplace/{plugin_id}")
+async def get_marketplace_detail(plugin_id: str, maibot_session: Optional[str] = Cookie(None)) -> Dict[str, Any]:
+    require_plugin_token(maibot_session)
+    try:
+        data = await request_market_detail(plugin_id, MMC_VERSION)
+        entry = await asyncio.to_thread(parse_market_release_entry, data, plugin_id)
+        catalog = await asyncio.to_thread(describe_entry, entry)
+        return {"manifest": data["manifest"], "releases": catalog}
+    except httpx.HTTPStatusError as exc:
+        if exc.response.status_code == 404:
+            raise HTTPException(status_code=404, detail="插件中心未找到该插件") from exc
+        raise HTTPException(status_code=502, detail=f"获取插件中心详情失败：{exc}") from exc
+    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
+        raise HTTPException(status_code=502, detail=f"获取插件中心详情失败：{exc}") from exc
```

---

### Incident Patch 6: `7c5305e8` (2026-10-03)
**Commit Message**: feat: 优化webui数据导出的可用性

**File**: `changelogs/changelog.md` (modified, +2/-0)
```diff
@@ -14,6 +14,8 @@
 
 ## Webui [1.8.1]
 
+- 修复浏览器取消导出包下载后，后端未及时释放下载保护导致无法删除记录的问题。
+
 - 插件支持声明自定义tab页面。
 - WebUI 记忆需要重建向量时，在页面顶部标签栏右侧显示重建按钮。
 - 重构部分配置项编辑位置
```

**File**: `dashboard/src/lib/__tests__/data-transfer-api.test.ts` (modified, +7/-19)
```diff
@@ -133,38 +133,26 @@ describe('downloadDataExport', () => {
     expect(getMock).not.toHaveBeenCalled()
   })
 
-  it('以 blob 模式下载文件并通过临时链接触发保存', async () => {
-    const blob = new Blob(['zip-bytes'])
-    getMock.mockResolvedValue(blob)
-    const createObjectUrlSpy = vi
-      .spyOn(URL, 'createObjectURL')
-      .mockReturnValue('blob:maibot-test/export')
-    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
+  it('通过后端链接触发浏览器直接下载', async () => {
+    resolveApiPathMock.mockResolvedValue('https://backend.example/export.zip')
     // 捕获被点击的临时 <a> 元素，验证下载属性（mock.contexts 记录每次调用的 this）
     const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
 
     const job = makeJob()
     await downloadDataExport(job)
 
-    expect(getMock).toHaveBeenCalledWith(job.download_url, {
-      parse: 'blob',
-      cache: 'no-store',
-      errorMessage: '下载导出文件失败',
-    })
-    expect(createObjectUrlSpy).toHaveBeenCalledWith(blob)
+    expect(getMock).not.toHaveBeenCalled()
+    expect(resolveApiPathMock).toHaveBeenCalledWith(job.download_url)
     expect(clickSpy).toHaveBeenCalledTimes(1)
     const clickedLink = clickSpy.mock.contexts[0] as HTMLAnchorElement
-    expect(clickedLink.getAttribute('href')).toBe('blob:maibot-test/export')
+    expect(clickedLink.getAttribute('href')).toBe('https://backend.example/export.zip')
     expect(clickedLink.download).toBe('maibot-backup.zip')
-    // 下载完成后临时链接被移除、对象 URL 被回收
+    // 触发浏览器下载后移除临时链接。
     expect(document.body.contains(clickedLink)).toBe(false)
-    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:maibot-test/export')
   })
 
   it('任务未提供文件名时使用默认文件名 maibot-data.zip', async () => {
-    getMock.mockResolvedValue(new Blob(['zip-bytes']))
-    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:maibot-test/fallback')
-    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
+    resolveApiPathMock.mockImplementation(async (path: string) => path)
     const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
 
     await downloadDataExport(makeJob({ filename: null }))
```

**File**: `dashboard/src/lib/data-transfer-api.ts` (modified, +18/-8)
```diff
@@ -17,6 +17,22 @@ export interface DataTransferJob {
   download_url: string | null
   manifest: Record<string, unknown> | null
   error: string | null
+  completed_at?: number | null
+  expires_at?: number | null
+  archive_bytes?: number
+}
+
+export async function getDataExportHistory(): Promise<DataTransferJob[]> {
+  return backendApi.get<DataTransferJob[]>('/api/webui/data-transfer/exports', {
+    cache: 'no-store',
+    errorMessage: '获取导出历史失败',
+  })
+}
+
+export async function deleteDataExport(jobId: string): Promise<void> {
+  await backendApi.delete(`/api/webui/data-transfer/jobs/${encodeURIComponent(jobId)}`, {
+    errorMessage: '删除导出记录失败',
+  })
 }
 
 export interface DataExportOptions {
@@ -52,19 +68,13 @@ export async function downloadDataExport(job: DataTransferJob): Promise<void> {
   if (!job.download_url) {
     throw new Error('导出任务还没有可下载文件')
   }
-  const blob = await backendApi.get<Blob>(job.download_url, {
-    parse: 'blob',
-    cache: 'no-store',
-    errorMessage: '下载导出文件失败',
-  })
-  const objectUrl = URL.createObjectURL(blob)
+  // 让浏览器直接流式下载大文件，避免先把整个压缩包收成 Blob 才触发保存。
   const link = document.createElement('a')
-  link.href = objectUrl
+  link.href = await resolveApiPath(job.download_url)
   link.download = job.filename || 'maibot-data.zip'
   document.body.appendChild(link)
   link.click()
   link.remove()
-  URL.revokeObjectURL(objectUrl)
 }
 
 export async function cancelDataExportJob(jobId: string): Promise<DataTransferJob> {
```

**File**: `dashboard/src/routes/__tests__/data-transfer.test.tsx` (modified, +6/-0)
```diff
@@ -22,6 +22,8 @@ vi.mock('@/lib/data-transfer-api', () => ({
   createDataExportJob: vi.fn(),
   createDataImportJob: vi.fn(),
   downloadDataExport: vi.fn(),
+  getDataExportHistory: vi.fn().mockResolvedValue([]),
+  deleteDataExport: vi.fn(),
   getDataTransferJob: vi.fn(),
 }))
 
@@ -35,6 +37,10 @@ const downloadDataExport = vi.mocked(dataTransferApi.downloadDataExport)
 const cancelDataExportJob = vi.mocked(dataTransferApi.cancelDataExportJob)
 const createDataImportJob = vi.mocked(dataTransferApi.createDataImportJob)
 
+beforeEach(() => {
+  vi.mocked(dataTransferApi.getDataExportHistory).mockResolvedValue([])
+})
+
 /** 构造完整的数据迁移任务，便于按需覆盖字段 */
 function makeJob(overrides: Partial<DataTransferJob> = {}): DataTransferJob {
   return {
```

**File**: `dashboard/src/routes/data-transfer.tsx` (modified, +73/-2)
```diff
@@ -1,5 +1,5 @@
 import type { Dispatch, SetStateAction } from 'react'
-import { Archive, Download, RefreshCw, Upload, X } from 'lucide-react'
+import { Archive, Download, RefreshCw, Trash2, Upload, X } from 'lucide-react'
 import { useCallback, useEffect, useState } from 'react'
 
 import { Badge } from '@/components/ui/badge'
@@ -16,6 +16,8 @@ import {
   createDataExportJob,
   createDataImportJob,
   downloadDataExport,
+  deleteDataExport,
+  getDataExportHistory,
   getDataTransferJob,
   type DataTransferJob,
 } from '@/lib/data-transfer-api'
@@ -67,6 +69,40 @@ export function DataTransferPage() {
   const [exportIncludeLogs, setExportIncludeLogs] = useState(false)
   const [exportJob, setExportJob] = useState<DataTransferJob | null>(null)
   const [exportCreating, setExportCreating] = useState(false)
+  const [exportHistory, setExportHistory] = useState<DataTransferJob[]>([])
+  const [historyError, setHistoryError] = useState<string | null>(null)
+
+  const refreshExportHistory = useCallback(async () => {
+    try {
+      setExportHistory(await getDataExportHistory())
+      setHistoryError(null)
+    } catch (error) {
+      setHistoryError(error instanceof Error ? error.message : '获取导出历史失败')
+    }
+  }, [])
+
+  useEffect(() => {
+    void refreshExportHistory()
+  }, [refreshExportHistory, exportJob?.status])
+
+  const handleHistoryDownload = async (job: DataTransferJob) => {
+    try {
+      await downloadDataExport(job)
+    } catch (error) {
+      toast({ title: '下载失败', description: error instanceof Error ? error.message : '无法下载', variant: 'destructive' })
+    }
+  }
+
+  const handleDeleteExport = async (job: DataTransferJob) => {
+    try {
+      await deleteDataExport(job.job_id)
+      if (exportJob?.job_id === job.job_id) setExportJob(null)
+      await refreshExportHistory()
+      toast({ title: '已删除导出记录和压缩包' })
+    } catch (error) {
+      toast({ title: '删除失败', description: error instanceof Error ? error.message : '无法删除', variant: 'destructive' })
+    }
+  }
   const [importFile, setImportFile] = useState<File | null>(null)
   const [importConfig, setImportConfig] = useState(true)
   const [importData, setImportData] = useState(true)
@@ -292,7 +328,7 @@ export function DataTransferPage() {
                         取消导出
                       </Button>
                     )}
-                    {exportJob.status === 'completed' && (
+                    {exportJob.status === 'completed' && exportJob.download_url && (
                       <Button
                         variant="outline"
                         size="sm"
@@ -305,6 +341,41 @@ export function DataTransferPage() {
                     )}
                   </div>
                 )}
+                <div className="space-y-3 border-t pt-4">
+                  <div className="flex items-center justify-between gap-2">
+                    <h3 className="text-sm font-medium">导出历史</h3>
+                    <Button variant="ghost" size="sm" onClick={() => void refreshExportHistory()}>
+                      <RefreshCw className="mr-2 h-4 w-4" />刷新
+                    </Button>
+                  </div>
+                  <p className="text-muted-foreground text-xs">压缩包保留 24 小时，下载后重新计时；刷新页面仍可重新下载。</p>
+                  {historyError && <p className="text-destructive text-sm">{historyError}</p>}
+                  {!historyError && exportHistory.length === 0 && <p className="text-muted-foreground text-sm">暂无导出记录</p>}
+                  {exportHistory.map((job) => (
+                    <div key={job.job_id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
+                      <div className="min-w-0 space-y-1">
+                        <p className="break-all text-sm font-medium">{job.filename}</p>
+                        <p className="text-muted-foreground text-xs">
+                          {formatStorageBytes(job.archive_bytes ?? 0)}
+                          {job.completed_at != null && ` · 完成于 ${new Date(job.completed_at * 1000).toLocaleString()}`}
+                        </p>
+                        <p className="text-muted-foreground text-xs">
+                          {job.download_url && job.expires_at != null
+                            ? `保留至 ${new Date(job.expires_at * 1000).toLocaleString()}`
+                            : '文件已过期或已删除'}
+                        </p>
+                      </div>
+                      <div className="flex gap-2">
+                        <Button variant="outline" size="sm" disabled={!job.download_url} onClick={() => void handleHistoryDownload(job)}>
+                          <Download className="mr-2 h-4 w-4" />下载
+                        </Button>
+                        <Button variant="ghost" size="sm" onClick={() => void handleDeleteExport(job)}>
+                          <Trash2 className="mr-2 h-4 w-4" />删除
+                        </Button>
+                      </div>
+                    </div>
+              
```

**File**: `src/main.py` (modified, +2/-0)
```diff
@@ -224,6 +224,7 @@ async def schedule_tasks(self) -> None:
                 run_image_path_maintenance_background,
                 should_schedule_image_path_maintenance_background,
             )
+            from src.webui.routers.data_transfer import periodic_transfer_temp_cleanup
 
             # 在独立线程中巡检推理图片，空闲时也能清理旧版本遗留的孤立缓存。
             PromptPreviewLogger.start()
@@ -235,6 +236,7 @@ async def schedule_tasks(self) -> None:
                 emoji_manager.periodic_emoji_maintenance(),
                 periodic_emoji_cache_cleanup(),
                 periodic_image_cache_cleanup(),
+                periodic_transfer_temp_cleanup(),
                 self.app.run(),
                 self.server.run(),
             ]
```

**File**: `src/webui/routers/data_transfer.py` (modified, +306/-27)
```diff
@@ -2,15 +2,22 @@
 
 from datetime import datetime, timezone
 from pathlib import Path
-from typing import Any, Literal
+from typing import Any, Dict, List, Literal, Optional, Set, Tuple
 
 from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
 from fastapi.responses import FileResponse
 from pydantic import BaseModel, Field
+from starlette.types import Receive, Scope, Send
 
+import asyncio
+import anyio
 import json
+import os
+import re
 import shutil
 import tempfile
+import threading
+import time
 import uuid
 import zipfile
 
@@ -36,8 +43,13 @@
     "data/.a_memorix_runtime_writer.lock",
     "data/a-memorix/.a_memorix_runtime_writer.lock",
 }
+_EXCLUDED_EXPORT_DIR_PREFIXES = ("data/prompt_imgs/",)
 _TRANSFER_TEMP_DIR = Path(tempfile.gettempdir()) / "maibot_webui_transfer"
 _CHUNK_SIZE = 1024 * 1024
+_EXPORT_RETENTION_SECONDS = 24 * 60 * 60
+_TEMP_CLEANUP_INTERVAL_SECONDS = 60 * 60
+_TEMP_ENTRY_PATTERN = re.compile(r"(?P<job_id>[0-9a-f]{32})(?:\.zip|-upload\.zip|-snapshots-[a-z0-9_]+)")
+_temp_cleanup_lock = threading.RLock()
 
 TransferJobStatus = Literal["pending", "running", "completed", "failed", "cancelled"]
 
@@ -76,6 +88,9 @@ class DataTransferJobResponse(BaseModel):
     download_url: str | None = None
     manifest: dict[str, Any] | None = None
     error: str | None = None
+    completed_at: float | None = None
+    expires_at: float | None = None
+    archive_bytes: int = 0
 
 
 class _TransferJob:
@@ -96,10 +111,15 @@ def __init__(self, job_id: str, kind: Literal["export", "import"]) -> None:
         self.manifest: dict[str, Any] | None = None
         self.error: str | None = None
         self.cancel_requested = False
+        self.worker_active = False
+        self.active_downloads = 0
+        self.expires_at: float | None = None
+        self.completed_at: float | None = None
+        self.archive_bytes = 0
 
     def to_response(self) -> DataTransferJobResponse:
         download_url = None
-        if self.kind == "export" and self.status == "completed":
+        if self.kind == "export" and self.status == "completed" and self.file_path is not None:
             download_url = f"/api/webui/data-transfer/export/{self.job_id}/download"
 
         return DataTransferJobResponse(
@@ -116,12 +136,145 @@ def to_response(self) -> DataTransferJobResponse:
             download_url=download_url,
             manifest=self.manifest,
             error=self.error,
+            completed_at=self.completed_at,
+            expires_at=self.expires_at,
+            archive_bytes=self.archive_bytes,
         )
 
 
 _jobs: dict[str, _TransferJob] = {}
 
 
+def _save_export_history(job: _TransferJob) -> None:
+    """持久化已完成导出，刷新页面或重启后仍能恢复下载入口和保留期限。"""
+    record_path = _TRANSFER_TEMP_DIR / f"{job.job_id}.export.json"
+    temporary_path = record_path.with_suffix(".tmp")
+    temporary_path.write_text(job.to_response().model_dump_json(), encoding="utf-8")
+    os.replace(temporary_path, record_path)
+
+
+def _restore_export_history() -> None:
+    for record_path in _TRANSFER_TEMP_DIR.glob("*.export.json"):
+        job_id = record_path.name.removesuffix(".export.json")
+        if re.fullmatch(r"[0-9a-f]{32}", job_id) is None or job_id in _jobs or record_path.is_symlink():
+            continue
+        record = DataTransferJobResponse.model_validate_json(record_path.read_text(encoding="utf-8"))
+        if record.job_id != job_id or record.kind != "export" or record.status != "completed":
+            raise ValueError(f"导出历史记录无效: {record_path}")
+        job = _TransferJob(job_id, "export")
+        job.status = "completed"
+        job.progress = 100
+        job.message = record.message
+        job.filename = record.filename
+        job.manifest = record.manifest
+        job.total_files = record.total_files
+        job.processed_files = record.processed_files
+        job.total_bytes = record.total_bytes
+        job.processed_bytes = record.processed_bytes
+        job.completed_at = record.completed_at
+        job.expires_at = record.expires_at
+        job.archive_bytes = record.archive_bytes
+        archive_path = _TRANSFER_TEMP_DIR / f"{job_id}.zip"
+        if archive_path.is_file() and not archive_path.is_symlink():
+            job.file_path = archive_path
+        else:
+            job.message = "导出文件已过期或已删除"
+        _jobs[job_id] = job
+    _recover_legacy_export_history()
+
+
+def _recover_legacy_export_history() -> None:
+    """为升级前已完整生成的包补历史记录；半成品不能获得下载入口。"""
+    for archive_path in _TRANSFER_TEMP_DIR.glob("*.zip"):
+        job_id = archive_path.stem
+        if re.fullmatch(r"[0-9a-f]{32}", job_id) is None or job_id in _jobs or archive_path.is_symlink():
+            continue
+        try:
+            with zipfile.ZipFile(archive_path) as archive:
+                manifest = _load_archive_manifest(archive)
+                entries = [item for item in archive.infolist() if item.filename != "manifest.json"]
+                expect
```

**File**: `tests/webui/routers/test_data_transfer.py` (modified, +200/-0)
```diff
@@ -1,7 +1,11 @@
 from io import BytesIO
 from pathlib import Path
 
+import asyncio
 import errno
+import json
+import os
+import shutil
 import zipfile
 
 import pytest
@@ -46,3 +50,199 @@ def read(self, size=-1):
             )
     assert error.value.filename == str(source_path)
     assert "data/unreadable.db" in str(error.value)
+
+
+def test_export_preserves_graph_pointer_and_snapshot_during_rotation(monkeypatch, tmp_path):
+    data_dir = tmp_path / "data"
+    graph_dir = data_dir / "a-memorix" / "graph"
+    generation = f"graph-{'a' * 32}"
+    snapshot_dir = graph_dir / "graph_snapshots" / generation
+    snapshot_dir.mkdir(parents=True)
+    (snapshot_dir / "graph_metadata.json").write_text(json.dumps({"has_adjacency": True}), encoding="utf-8")
+    (snapshot_dir / "graph_adjacency.npz").write_bytes(b"original graph")
+    (graph_dir / "graph_snapshot.json").write_text(json.dumps({"generation": generation}), encoding="utf-8")
+    old_snapshot = graph_dir / "graph_snapshots" / f"graph-{'b' * 32}"
+    old_snapshot.mkdir()
+    (old_snapshot / "graph_metadata.json").write_bytes(b"old")
+    config_dir = tmp_path / "config"
+    config_dir.mkdir()
+    monkeypatch.setattr(data_transfer, "_EXPORT_DIRS", {"config": config_dir, "data": data_dir})
+    monkeypatch.setattr(data_transfer, "_TRANSFER_TEMP_DIR", tmp_path / "export")
+    monkeypatch.setattr(data_transfer, "_jobs", {})
+    original_stage = data_transfer._stage_graph_snapshots
+
+    def stage_then_rotate(destination, job):
+        result = original_stage(destination, job)
+        shutil.rmtree(snapshot_dir)
+        (graph_dir / "graph_snapshot.json").write_text(
+            json.dumps({"generation": f"graph-{'c' * 32}"}), encoding="utf-8",
+        )
+        return result
+
+    monkeypatch.setattr(data_transfer, "_stage_graph_snapshots", stage_then_rotate)
+    job = data_transfer._new_job("export")
+    data_transfer._run_export_job(job.job_id, data_transfer.DataExportRequest())
+    assert job.status == "completed", job.error
+    with zipfile.ZipFile(job.file_path) as archive:
+        root = "data/a-memorix/graph"
+        assert json.loads(archive.read(f"{root}/graph_snapshot.json"))["generation"] == generation
+        assert archive.read(f"{root}/graph_snapshots/{generation}/graph_adjacency.npz") == b"original graph"
+        assert not any(old_snapshot.name in name for name in archive.namelist())
+
+
+def test_incomplete_active_graph_snapshot_fails_export(monkeypatch, tmp_path):
+    graph_dir = tmp_path / "data" / "a-memorix" / "graph"
+    graph_dir.mkdir(parents=True)
+    (graph_dir / "graph_snapshot.json").write_text(
+        json.dumps({"generation": f"graph-{'a' * 32}"}), encoding="utf-8",
+    )
+    monkeypatch.setattr(data_transfer, "_EXPORT_DIRS", {"data": tmp_path / "data"})
+    with pytest.raises(FileNotFoundError):
+        data_transfer._stage_graph_snapshots(tmp_path / "staging", data_transfer._TransferJob("test", "export"))
+
+
+@pytest.mark.parametrize("cancelled", [False, True])
+def test_unsuccessful_export_removes_partial_archive(monkeypatch, tmp_path, cancelled):
+    config = tmp_path / "config"
+    config.mkdir()
+    (config / "config.toml").write_bytes(b"config")
+    monkeypatch.setattr(data_transfer, "_EXPORT_DIRS", {"config": config, "data": tmp_path / "data"})
+    monkeypatch.setattr(data_transfer, "_TRANSFER_TEMP_DIR", tmp_path / "export")
+    monkeypatch.setattr(data_transfer, "_jobs", {})
+
+    def fail_write(archive, file_path, archive_name, job):
+        archive.writestr(archive_name, b"partial")
+        if cancelled:
+            job.cancel_requested = True
+            data_transfer._raise_if_cancelled(job)
+        raise PermissionError(errno.EACCES, "Permission denied")
+
+    monkeypatch.setattr(data_transfer, "_write_archive_file", fail_write)
+    job = data_transfer._new_job("export")
+    data_transfer._run_export_job(job.job_id, data_transfer.DataExportRequest())
+    assert job.status == ("cancelled" if cancelled else "failed")
+    assert job.file_path is None
+    assert not list(data_transfer._TRANSFER_TEMP_DIR.iterdir())
+
+
+def test_temp_cleanup_preserves_downloads_and_removes_expired_packages(monkeypatch, tmp_path):
+    monkeypatch.setattr(data_transfer, "_TRANSFER_TEMP_DIR", tmp_path)
+    monkeypatch.setattr(data_transfer, "_jobs", {})
+    job = data_transfer._new_job("export")
+    job.file_path = tmp_path / f"{job.job_id}.zip"
+    job.file_path.write_bytes(b"download")
+    job.status = "completed"
+    job.expires_at = 0
+    response = data_transfer.download_data_export(job.job_id)
+    assert response.path == job.file_path
+    job.expires_at = 0
+    assert data_transfer.cleanup_transfer_temp_files() == 0
+    assert job.file_path.exists()
+    data_transfer._finish_export_download(job)
+    assert data_transfer.cleanup_transfer_temp_files() == 0
+    job.expires_at = 0
+    assert data_transfer.cleanup_transfer_temp_files() == 1
+    assert job.file_pa
```

---

### Incident Patch 7: `e0c1c3d1` (2026-10-03)
**Commit Message**: fix: 推理图片没有被正确清理，记忆锁导致无法导出

**File**: `changelogs/changelog.md` (modified, +3/-0)
```diff
@@ -8,6 +8,9 @@
 - 新增适配器与 SDK 的头像查询接口，WebUI 统一使用头像服务。
 - 优化丰富性回复的表情包发送逻辑。
 - 优化配置热重载，大幅加快部分配置保存速度。
+- 修复推理记录自动淘汰或在 WebUI 清空后，未被其他记录引用的预览图片仍占用磁盘的问题。
+- 启动时及每小时检查推理图片缓存，自动清理无记录引用的遗留图片。
+- 修复 Windows 下 WebUI 数据导出误读记忆模块运行锁导致失败的问题，并在导出错误中显示具体文件路径。
 
 ## Webui [1.8.1]
 
```

**File**: `src/main.py` (modified, +3/-0)
```diff
@@ -219,11 +219,14 @@ async def schedule_tasks(self) -> None:
             from src.chat.image_system.image_cache_cleanup import periodic_image_cache_cleanup
             from src.emoji_system.emoji_cache_cleanup import periodic_emoji_cache_cleanup
             from src.emoji_system.emoji_manager import emoji_manager
+            from src.maisaka.display.prompt_preview_logger import PromptPreviewLogger
             from src.services.image_path_maintenance_service import (
                 run_image_path_maintenance_background,
                 should_schedule_image_path_maintenance_background,
             )
 
+            # 在独立线程中巡检推理图片，空闲时也能清理旧版本遗留的孤立缓存。
+            PromptPreviewLogger.start()
             self._register_message_handlers()
             if self.app is None or self.server is None:
                 raise RuntimeError("消息服务未初始化")
```

**File**: `src/maisaka/display/prompt_cli_renderer.py` (modified, +41/-44)
```diff
@@ -281,7 +281,6 @@ def _normalize_image_format(image_format: str) -> str:
     @staticmethod
     def _build_image_cache_path(image_format: str, image_bytes: bytes) -> Path:
         image_format = PromptCLIVisualizer._normalize_image_format(image_format) or "bin"
-        DATA_PROMPT_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
         digest = hashlib.sha256(image_bytes).hexdigest()
         return DATA_PROMPT_IMAGE_DIR / f"{digest}.{image_format}"
 
@@ -297,7 +296,7 @@ def _build_official_image_path(image_format: str, image_bytes: bytes) -> Path |
 
     @staticmethod
     def _build_image_file_link(image_format: str, image_base64: str) -> tuple[str, Path] | None:
-        """优先返回已有 data 图片路径；不存在时落盘到 prompt 图片缓存。"""
+        """优先返回已有 data 图片路径；不存在时登记后台落盘的 prompt 图片。"""
         normalized_format = PromptCLIVisualizer._normalize_image_format(image_format) or "bin"
         try:
             image_bytes = b64decode(image_base64)
@@ -309,11 +308,7 @@ def _build_image_file_link(image_format: str, image_base64: str) -> tuple[str, P
             return build_file_uri(official_path), official_path
 
         path = PromptCLIVisualizer._build_image_cache_path(normalized_format, image_bytes)
-        if not path.exists():
-            try:
-                path.write_bytes(image_bytes)
-            except Exception:
-                return None
+        PromptPreviewLogger.add_image_asset(path, image_bytes)
         return build_file_uri(path), path
 
     @staticmethod
@@ -945,22 +940,23 @@ def build_prompt_preview_access(
     ) -> PromptPreviewAccess:
         """保存 Prompt 预览文件，并返回 CLI 展示入口与浏览器可打开的 URI。"""
 
-        keep_json_base64 = cls._should_keep_prompt_preview_json_base64()
-        return cls._save_structured_preview_access(
-            chat_id=chat_id,
-            category=category,
-            payload=cls._build_structured_preview_payload(
-                request_items,
-                request_kind=request_kind,
-                selection_reason=selection_reason,
-                tool_definitions=tool_definitions,
-                output_title=output_title,
-                output_items=output_items,
-                metadata=metadata,
-                generation_attempts=generation_attempts,
-                keep_base64=keep_json_base64,
-            ),
-        )
+        with PromptPreviewLogger.collect_image_assets():
+            keep_json_base64 = cls._should_keep_prompt_preview_json_base64()
+            return cls._save_structured_preview_access(
+                chat_id=chat_id,
+                category=category,
+                payload=cls._build_structured_preview_payload(
+                    request_items,
+                    request_kind=request_kind,
+                    selection_reason=selection_reason,
+                    tool_definitions=tool_definitions,
+                    output_title=output_title,
+                    output_items=output_items,
+                    metadata=metadata,
+                    generation_attempts=generation_attempts,
+                    keep_base64=keep_json_base64,
+                ),
+            )
 
     @classmethod
     def build_prompt_access_panel(
@@ -1078,24 +1074,25 @@ def build_text_preview_access(
     ) -> PromptPreviewAccess:
         """保存文本型 Prompt 预览文件，并返回对应访问入口。"""
 
-        keep_json_base64 = cls._should_keep_prompt_preview_json_base64()
-        return cls._save_structured_preview_access(
-            chat_id=chat_id,
-            category=category,
-            payload=cls._build_structured_preview_payload(
-                [
-                    UserMessageItem(
-                        meta=ContextItemMeta.create(),
-                        parts=(ContextTextPart(content),),
-                    )
-                ],
-                request_kind=request_kind,
-                selection_reason=subtitle,
-                tool_definitions=None,
-                output_title=output_title,
-                output_items=output_items,
-                metadata=metadata,
-                generation_attempts=generation_attempts,
-                keep_base64=keep_json_base64,
-            ),
-        )
+        with PromptPreviewLogger.collect_image_assets():
+            keep_json_base64 = cls._should_keep_prompt_preview_json_base64()
+            return cls._save_structured_preview_access(
+                chat_id=chat_id,
+                category=category,
+                payload=cls._build_structured_preview_payload(
+                    [
+                        UserMessageItem(
+                            meta=ContextItemMeta.create(),
+                            parts=(ContextTextPart(content),),
+                        )
+                    ],
+                    request_kind=request_kind,
+                    selection_reason=subtitle,
+                    tool_definitions=None,
+                    output_title=output_title,
+                    output_items=output_items,
+                    metadata=me
```

**File**: `src/maisaka/display/prompt_preview_logger.py` (modified, +159/-10)
```diff
@@ -2,11 +2,16 @@
 
 from __future__ import annotations
 
+from contextlib import contextmanager
+from contextvars import ContextVar
 from dataclasses import dataclass
 from pathlib import Path
+from typing import Dict, Iterator, Optional, Set
 
 import os
 import queue
+import re
+import shutil
 import threading
 import time
 
@@ -15,6 +20,7 @@
 from .preview_path_utils import REPO_ROOT, build_preview_chat_dir_name, normalize_preview_name
 
 logger = get_logger("maisaka_prompt_preview")
+_image_assets: ContextVar[Optional[Dict[Path, bytes]]] = ContextVar("prompt_preview_image_assets", default=None)
 
 
 @dataclass(frozen=True)
@@ -24,6 +30,7 @@ class _PreviewWriteTask:
     chat_dir: Path
     file_path: Path
     content: str
+    image_assets: Dict[Path, bytes]
 
 
 class PromptPreviewLogger:
@@ -37,13 +44,38 @@ class PromptPreviewLogger:
     _BASE_DIR = REPO_ROOT / "logs" / "maisaka_prompt"
     _DEFAULT_MAX_PREVIEW_GROUPS_PER_CHAT = 256
     _QUEUE_MAXSIZE = 256
+    _ORPHAN_IMAGE_CHECK_INTERVAL_SECONDS = 60 * 60
 
     _write_queue: "queue.Queue[_PreviewWriteTask]" = queue.Queue(maxsize=_QUEUE_MAXSIZE)
     _writer_lock = threading.Lock()
     _writer_thread: threading.Thread | None = None
     # 记录每个目录最近分配过的时间戳，保证文件名严格递增且不重名
     _stem_lock = threading.Lock()
     _last_stem_by_dir: dict[Path, int] = {}
+    _IMAGE_DIR = REPO_ROOT / "data" / "prompt_imgs"
+    _IMAGE_NAME_PATTERN = re.compile(r"prompt_imgs(?:[/\\]|%2[fF]|%5[cC])+([0-9a-f]{64}\.[A-Za-z0-9]+)")
+    _CACHE_IMAGE_NAME_PATTERN = re.compile(r"[0-9a-f]{64}\.[A-Za-z0-9]+")
+    _storage_lock = threading.RLock()
+    _image_index_ready = False
+    _images_by_preview: Dict[Path, Set[str]] = {}
+    _previews_by_image: Dict[str, Set[Path]] = {}
+
+    @classmethod
+    @contextmanager
+    def collect_image_assets(cls) -> Iterator[None]:
+        """在内存中收集本次预览图片，与 JSON 一起交给后台线程落盘。"""
+        token = _image_assets.set({})
+        try:
+            yield
+        finally:
+            _image_assets.reset(token)
+
+    @classmethod
+    def add_image_asset(cls, path: Path, content: bytes) -> None:
+        assets = _image_assets.get()
+        if assets is None:
+            raise RuntimeError("Prompt 图片必须在预览构建上下文中登记")
+        assets[path] = content
 
     @classmethod
     def save_preview_file(
@@ -60,7 +92,14 @@ def save_preview_file(
         normalized_category = normalize_preview_name(category)
         chat_dir = cls._BASE_DIR / normalized_category / build_preview_chat_dir_name(chat_id)
         file_path = chat_dir / f"{cls._allocate_stem(chat_dir)}.json"
-        cls._submit(_PreviewWriteTask(chat_dir=chat_dir, file_path=file_path, content=content))
+        cls._submit(
+            _PreviewWriteTask(
+                chat_dir=chat_dir,
+                file_path=file_path,
+                content=content,
+                image_assets=dict(_image_assets.get() or {}),
+            )
+        )
         return file_path
 
     @classmethod
@@ -83,9 +122,7 @@ def _submit(cls, task: _PreviewWriteTask) -> None:
         try:
             cls._write_queue.put_nowait(task)
         except queue.Full:
-            logger.error(
-                f"Prompt 预览写入队列已满（上限 {cls._QUEUE_MAXSIZE}），本次预览未落盘: {task.file_path}"
-            )
+            logger.error(f"Prompt 预览写入队列已满（上限 {cls._QUEUE_MAXSIZE}），本次预览未落盘: {task.file_path}")
 
     @classmethod
     def _ensure_writer_thread(cls) -> None:
@@ -102,28 +139,140 @@ def _ensure_writer_thread(cls) -> None:
             )
             cls._writer_thread.start()
 
+    @classmethod
+    def start(cls) -> None:
+        """启动后台写入与巡检线程，即使没有新预览也定期回收遗留图片。"""
+        cls._ensure_writer_thread()
+
     @classmethod
     def _writer_loop(cls) -> None:
-        """串行消费落盘任务；单个任务失败不中断其余预览。"""
+        """串行消费落盘任务并巡检孤立图片；单个任务失败不中断其余预览。"""
 
+        next_image_check = time.monotonic()
         while True:
-            task = cls._write_queue.get()
+            if time.monotonic() >= next_image_check:
+                try:
+                    cls.cleanup_orphan_images()
+                except Exception as exc:
+                    logger.error(f"Prompt 孤立图片巡检失败: error={exc}", exc_info=True)
+                next_image_check = time.monotonic() + cls._ORPHAN_IMAGE_CHECK_INTERVAL_SECONDS
+            # 超时唤醒保证无请求时仍执行巡检；每轮检查时间，持续写入也不会饿死清理任务。
+            try:
+                task = cls._write_queue.get(timeout=max(0, next_image_check - time.monotonic()))
+            except queue.Empty:
+                continue
             try:
                 cls._write_task(task)
             except Exception as exc:
                 logger.error(f"Prompt 预览落盘失败: {task.file_path}, error={exc}", exc_info=True)
+            finally:
+                cls._write_queue.task_done()
+                del task
+
+    @classmethod
+    def cleanup_orphan_images(cls) -> int:
+        """重新核对现存记录，删除专用缓存目录中无人引用的哈希图片。"""
+        with cls._storage_lock:
+            if not cls._IMAGE_DIR.exists():
+                return 0
+           
```

**File**: `src/webui/routers/data_transfer.py` (modified, +18/-11)
```diff
@@ -32,7 +32,10 @@
 _REQUIRED_EXPORT_PARTS = ("config", "data")
 _OPTIONAL_EXPORT_PARTS = ("plugins", "logs")
 _ALLOWED_IMPORT_PARTS = set(_EXPORT_DIRS)
-_EXCLUDED_EXPORT_PATHS = {"data/.a_memorix_runtime_writer.lock"}
+_EXCLUDED_EXPORT_PATHS = {
+    "data/.a_memorix_runtime_writer.lock",
+    "data/a-memorix/.a_memorix_runtime_writer.lock",
+}
 _TRANSFER_TEMP_DIR = Path(tempfile.gettempdir()) / "maibot_webui_transfer"
 _CHUNK_SIZE = 1024 * 1024
 
@@ -212,16 +215,20 @@ def _update_progress(job: _TransferJob) -> None:
 
 def _write_archive_file(archive: zipfile.ZipFile, file_path: Path, archive_name: str, job: _TransferJob) -> int:
     written_bytes = 0
-    with file_path.open("rb") as source_file, archive.open(archive_name, "w") as target_file:
-        while True:
-            _raise_if_cancelled(job)
-            chunk = source_file.read(_CHUNK_SIZE)
-            if not chunk:
-                break
-            target_file.write(chunk)
-            written_bytes += len(chunk)
-            job.processed_bytes += len(chunk)
-            _update_progress(job)
+    try:
+        with file_path.open("rb") as source_file, archive.open(archive_name, "w") as target_file:
+            while True:
+                _raise_if_cancelled(job)
+                chunk = source_file.read(_CHUNK_SIZE)
+                if not chunk:
+                    break
+                target_file.write(chunk)
+                written_bytes += len(chunk)
+                job.processed_bytes += len(chunk)
+                _update_progress(job)
+    except OSError as exc:
+        # Windows 字节区域锁可能直到 read 时才报错，补齐路径以便准确定位。
+        raise OSError(exc.errno, f"导出文件失败 ({archive_name}): {exc.strerror}", str(file_path)) from exc
     return written_bytes
 
 
```

**File**: `src/webui/routers/reasoning_process.py` (modified, +2/-3)
```diff
@@ -9,7 +9,6 @@
 import mimetypes
 import os
 import re
-import shutil
 import time
 
 from fastapi import APIRouter, Depends, HTTPException, Query
@@ -28,6 +27,7 @@
     serialize_generation_attempt,
     serialize_context_item_snapshot,
 )
+from src.maisaka.display.prompt_preview_logger import PromptPreviewLogger
 from src.services.llm_service import generate as generate_llm_response
 from src.services.bot_account_service import get_all_bot_account_pairs
 from src.services.service_task_resolver import get_available_models
@@ -1968,8 +1968,7 @@ def clear_reasoning_prompt_stage(stage: str):
     if not stage_dir.is_dir():
         raise HTTPException(status_code=400, detail="推理过程路径不是目录")
 
-    deleted_files = sum(1 for path in stage_dir.rglob("*") if path.is_file())
-    shutil.rmtree(stage_dir)
+    deleted_files = PromptPreviewLogger.clear_stage(stage_dir)
     return ReasoningPromptClearStageResponse(stage=stage_name, deleted_files=deleted_files)
 
 
```

**File**: `tests/maisaka/test_prompt_preview_image_cleanup.py` (added, +204/-0)
```diff
@@ -0,0 +1,204 @@
+from base64 import b64encode
+from pathlib import Path
+
+import json
+import queue
+
+import pytest
+
+from src.llm_models.payload_content.context_item import ContextImagePart, ContextItemMeta, UserMessageItem
+from src.maisaka.display.prompt_preview_logger import PromptPreviewLogger, _PreviewWriteTask
+from src.maisaka.display.prompt_cli_renderer import PromptCLIVisualizer
+from src.maisaka.display import prompt_preview_logger
+
+
+@pytest.fixture
+def preview_store(monkeypatch, tmp_path):
+    monkeypatch.setattr(PromptPreviewLogger, "_BASE_DIR", tmp_path / "logs" / "maisaka_prompt")
+    monkeypatch.setattr(PromptPreviewLogger, "_IMAGE_DIR", tmp_path / "data" / "prompt_imgs")
+    monkeypatch.setattr(PromptPreviewLogger, "_image_index_ready", False)
+    monkeypatch.setattr(PromptPreviewLogger, "_images_by_preview", {})
+    monkeypatch.setattr(PromptPreviewLogger, "_previews_by_image", {})
+    monkeypatch.setattr(PromptPreviewLogger, "_get_max_preview_groups_per_chat", lambda: 1)
+    return PromptPreviewLogger
+
+
+def write_preview(store, stage: str, stem: str, image: Path):
+    directory = store._BASE_DIR / stage / "chat"
+    task = _PreviewWriteTask(
+        chat_dir=directory,
+        file_path=directory / f"{stem}.json",
+        content=json.dumps({"image_path": image.as_posix()}),
+        image_assets={image: b"image"},
+    )
+    store._write_task(task)
+    return task.file_path
+
+
+def test_overflow_deletes_exclusive_image_but_keeps_shared_image(preview_store):
+    store = preview_store
+    shared = store._IMAGE_DIR / f"{'a' * 64}.png"
+    replacement = store._IMAGE_DIR / f"{'b' * 64}.png"
+    first = write_preview(store, "planner", "1", shared)
+    write_preview(store, "reply", "1", shared)
+    write_preview(store, "planner", "2", replacement)
+    assert not first.exists()
+    assert shared.exists()
+    store.clear_stage(store._BASE_DIR / "reply")
+    assert not shared.exists()
+    assert replacement.exists()
+    write_preview(store, "planner", "3", shared)
+    assert not replacement.exists()
+    assert shared.exists()
+
+
+def test_clear_stage_indexes_existing_json_and_legacy_preview(preview_store):
+    store = preview_store
+    image = store._IMAGE_DIR / f"{'a' * 64}.png"
+    image.parent.mkdir(parents=True)
+    image.write_bytes(b"image")
+    for stage, suffix, content in (
+        ("planner", ".json", json.dumps({"image_path": str(image)})),
+        ("reply", ".html", f'<img src="{image.as_uri()}">'),
+    ):
+        directory = store._BASE_DIR / stage / "chat"
+        directory.mkdir(parents=True)
+        (directory / f"1{suffix}").write_text(content, encoding="utf-8")
+    assert store.clear_stage(store._BASE_DIR / "planner") == 1
+    assert image.exists()
+    assert store.clear_stage(store._BASE_DIR / "reply") == 1
+    assert not image.exists()
+
+
+def test_queued_preview_restores_image_deleted_by_clear(preview_store):
+    store = preview_store
+    image = store._IMAGE_DIR / f"{'a' * 64}.png"
+    write_preview(store, "planner", "1", image)
+    store.clear_stage(store._BASE_DIR / "planner")
+    assert not image.exists()
+    record = write_preview(store, "planner", "2", image)
+    assert image.exists()
+    assert record.exists()
+
+
+@pytest.mark.parametrize("text_preview", [False, True])
+def test_renderer_queues_images_with_record(preview_store, monkeypatch, text_preview):
+    store = preview_store
+    tasks = []
+    monkeypatch.setattr(store, "_submit", tasks.append)
+    monkeypatch.setattr(PromptCLIVisualizer, "_build_official_image_path", lambda *_: None)
+    monkeypatch.setattr(
+        PromptCLIVisualizer,
+        "_build_image_cache_path",
+        lambda *_: store._IMAGE_DIR / f"{'a' * 64}.png",
+    )
+    options = {
+        "category": "planner",
+        "chat_id": "test-chat",
+        "request_kind": "planner",
+        "output_items": [
+            UserMessageItem(
+                meta=ContextItemMeta.create(),
+                parts=(ContextImagePart("png", b64encode(b"image").decode()),),
+            )
+        ],
+    }
+    if text_preview:
+        access = PromptCLIVisualizer.build_text_preview_access("test", subtitle="test", **options)
+    else:
+        access = PromptCLIVisualizer.build_prompt_preview_access([], selection_reason="test", **options)
+    assert len(tasks) == 1
+    assert tasks[0].image_assets
+    assert not access.record_path.exists()
+    for path in tasks[0].image_assets:
+        assert not path.exists()
+    store._write_task(tasks[0])
+    assert access.record_path.exists()
+    for path in tasks[0].image_assets:
+        assert path.read_bytes() == b"image"
+    store.clear_stage(store._BASE_DIR / "planner")
+    for path in tasks[0].image_assets:
+        assert not path.exists()
+
+
+def test_clear_stage_does_not_delete_official_images(preview_store, tmp_path):
+    store = preview_store
+    image = tmp_path / "data" / "images" / f"{'a' * 64}.png"
+    write_pre
```

**File**: `tests/webui/routers/test_data_transfer.py` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+from io import BytesIO
+from pathlib import Path
+
+import errno
+import zipfile
+
+import pytest
+
+from src.webui.routers import data_transfer
+
+
+def test_export_keeps_business_data_and_excludes_runtime_locks(monkeypatch, tmp_path):
+    config_dir = tmp_path / "config"
+    data_dir = tmp_path / "data"
+    memory_dir = data_dir / "a-memorix"
+    config_dir.mkdir()
+    memory_dir.mkdir(parents=True)
+    (config_dir / "bot_config.toml").write_bytes(b"config")
+    (memory_dir / "metadata.db").write_bytes(b"memory")
+    for directory in (data_dir, memory_dir):
+        (directory / ".a_memorix_runtime_writer.lock").write_bytes(b"runtime lock")
+    monkeypatch.setattr(data_transfer, "_EXPORT_DIRS", {"config": config_dir, "data": data_dir})
+    monkeypatch.setattr(data_transfer, "_TRANSFER_TEMP_DIR", tmp_path / "export")
+    monkeypatch.setattr(data_transfer, "_jobs", {})
+    job = data_transfer._new_job("export")
+    data_transfer._run_export_job(job.job_id, data_transfer.DataExportRequest())
+    assert job.status == "completed"
+    with zipfile.ZipFile(job.file_path) as archive:
+        assert archive.read("data/a-memorix/metadata.db") == b"memory"
+        assert archive.read("config/bot_config.toml") == b"config"
+        assert not any(name.endswith(".a_memorix_runtime_writer.lock") for name in archive.namelist())
+
+
+def test_read_permission_error_identifies_source_file(monkeypatch):
+    source_path = Path("data/unreadable.db")
+
+    class LockedSource(BytesIO):
+        def read(self, size=-1):
+            raise PermissionError(errno.EACCES, "Permission denied")
+
+    monkeypatch.setattr(Path, "open", lambda *_: LockedSource())
+    with zipfile.ZipFile(BytesIO(), "w") as archive:
+        with pytest.raises(PermissionError) as error:
+            data_transfer._write_archive_file(
+                archive, source_path, "data/unreadable.db", data_transfer._TransferJob("test", "export"),
+            )
+    assert error.value.filename == str(source_path)
+    assert "data/unreadable.db" in str(error.value)
```

---

### Incident Patch 8: `3507afcf` (2026-10-03)
**Commit Message**: feat: webui支持自定义页面

**File**: `changelogs/changelog.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@
 
 ## Webui [1.8.1]
 
+- 开放插件声明式 WebUI 顶部工作区和侧边页面扩展，统一宿主组件与主题，支持专用 API 网关、操作确认和入口管理。
 - WebUI 记忆需要重建向量时，在页面顶部标签栏右侧显示重建按钮。
 - 重构部分配置项编辑位置
 - 适配器黑白名单面板在群号后显示群头像和已知群名称。
```

**File**: `dashboard/src/__tests__/router.test.tsx` (modified, +5/-2)
```diff
@@ -34,6 +34,7 @@ vi.mock('@/hooks/use-auth', () => ({
 vi.mock('@/routes/auth', () => ({ AuthPage: StubPage }))
 vi.mock('@/routes/setup/index.tsx', () => ({ SetupPage: StubPage }))
 vi.mock('@/routes/index', () => ({ IndexPage: StubPage }))
+vi.mock('@/routes/plugin-webui', () => ({ PluginWebUIPage: StubPage, PluginWebUIManagerPage: StubPage }))
 vi.mock('@/routes/logs', () => ({
   LogViewerPage: StubPage,
   ReasoningLogViewerPage: StubPage,
@@ -93,6 +94,8 @@ const expectedPaths = [
   '/resource/knowledge-graph',
   '/resource/knowledge-base',
   '/plugins',
+  '/extensions',
+  '/extensions/$pluginId/$pageId',
   '/model-presets',
   '/plugin-config',
   '/adapter-management',
@@ -184,7 +187,7 @@ describe('router 路由表', () => {
       string,
       { options: { component?: unknown } } | undefined
     >
-    for (const path of expectedPaths) {
+    for (const path of expectedPaths.filter((path) => !['/mcp-settings', '/settings'].includes(path))) {
       const route = routesByPath[path]
       expect(route, `routesByPath 缺少 ${path}`).toBeDefined()
       expect(typeof route?.options.component, `${path} 缺少组件`).toBe('function')
@@ -319,7 +322,7 @@ describe('router 路由表', () => {
 
   it('所有懒加载页面工厂均可 preload 到桩组件', async () => {
     const routesByPath = getRoutesByPath()
-    for (const path of expectedPaths) {
+    for (const path of expectedPaths.filter((path) => !['/mcp-settings', '/settings'].includes(path))) {
       const component = routesByPath[path]?.options.component as LazyRouteComponent | undefined
       expect(typeof component, `${path} 缺少组件`).toBe('function')
       expect(typeof component?.preload, `${path} 不是懒加载组件`).toBe('function')
```

**File**: `dashboard/src/components/__tests__/plugin-webui-renderer.test.tsx` (added, +106/-0)
```diff
@@ -0,0 +1,106 @@
+import { fireEvent, render, screen } from '@testing-library/react'
+import { describe, expect, it, vi } from 'vitest'
+
+import { PluginWebUIRenderer } from '@/components/plugin-webui-renderer'
+import { resolveNodeValue } from '@/lib/plugin-webui'
+import type { WebUINode } from '@/lib/plugin-webui'
+
+vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
+
+function node(overrides: Partial<WebUINode>): WebUINode {
+  return {
+    type: 'text',
+    label: null,
+    value: null,
+    children: [],
+    columns: null,
+    name: null,
+    options: [],
+    action: null,
+    variant: 'primary',
+    chart_type: 'line',
+    x: null,
+    y: null,
+    ...overrides,
+  }
+}
+
+describe('plugin WebUI renderer', () => {
+  it('renders plugin text as text without interpreting HTML', () => {
+    const content = '<img src=x onerror=alert(1)>'
+    const { container } = render(
+      <PluginWebUIRenderer
+        nodes={[node({ value: content })]}
+        data={{}}
+        values={{}}
+        busy={false}
+        onChange={vi.fn()}
+        onAction={vi.fn()}
+      />
+    )
+    expect(screen.getByText(content)).toBeInTheDocument()
+    expect(container.querySelector('img')).toBeNull()
+  })
+
+  it('resolves only own data fields and exposes invalid bindings', () => {
+    const reference = node({ value: { source: 'summary', field: 'totals.count' } })
+    expect(resolveNodeValue(reference, { summary: { totals: { count: 4 } } })).toBe(4)
+    expect(() => resolveNodeValue(reference, { summary: {} })).toThrow('Missing data field')
+    expect(() =>
+      resolveNodeValue(node({ value: { source: 'summary', field: 'toString' } }), { summary: {} })
+    ).toThrow('Missing data field')
+  })
+
+  it('dispatches declared actions and disables buttons during requests', () => {
+    const onAction = vi.fn()
+    const nodes = [node({ type: 'button', label: 'Recalculate', action: 'recalculate' })]
+    const { rerender } = render(
+      <PluginWebUIRenderer
+        nodes={nodes}
+        data={{}}
+        values={{}}
+        busy={false}
+        onChange={vi.fn()}
+        onAction={onAction}
+      />
+    )
+    fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }))
+    expect(onAction).toHaveBeenCalledWith('recalculate')
+    rerender(
+      <PluginWebUIRenderer
+        nodes={nodes}
+        data={{}}
+        values={{}}
+        busy
+        onChange={vi.fn()}
+        onAction={onAction}
+      />
+    )
+    expect(screen.getByRole('button', { name: 'Recalculate' })).toBeDisabled()
+  })
+
+  it('paginates tables instead of rendering unbounded result rows', () => {
+    const rows = Array.from({ length: 60 }, (_, i) => ({ name: `row-${i}` }))
+    render(
+      <PluginWebUIRenderer
+        nodes={[
+          node({
+            type: 'table',
+            value: { source: 'rows', field: '' },
+            columns: [{ field: 'name', label: 'Name' }],
+          }),
+        ]}
+        data={{ rows }}
+        values={{}}
+        busy={false}
+        onChange={vi.fn()}
+        onAction={vi.fn()}
+      />
+    )
+    expect(screen.getByText('row-0')).toBeInTheDocument()
+    expect(screen.queryByText('row-50')).not.toBeInTheDocument()
+    fireEvent.click(screen.getByRole('button', { name: 'pluginWebUI.next' }))
+    expect(screen.getByText('row-50')).toBeInTheDocument()
+    expect(screen.queryByText('row-0')).not.toBeInTheDocument()
+  })
+})
```

**File**: `dashboard/src/components/layout/Header.test.tsx` (modified, +29/-10)
```diff
@@ -10,6 +10,7 @@ import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-libra
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
 
 import { Header } from './Header'
+import type { WebUIExtension } from '@/lib/plugin-webui'
 
 const mocks = vi.hoisted(() => ({
   pathname: '/',
@@ -220,6 +221,27 @@ function makeProps(
 }
 
 describe('Header', () => {
+  it('插件顶部标签保留原始标题并通过宿主工作区切换导航', () => {
+    const extension: WebUIExtension = { plugin_id: 'test.plugin', workspace_title: '消息统计', pages: [{
+      id: 'overview', title: '概览', description: '', placement: 'workspace', icon: 'chart', queries: {}, actions: {}, content: [],
+    }] }
+    const props = makeProps({ extensions: [extension] })
+    render(<Header {...props} />)
+    fireEvent.click(screen.getByRole('tab', { name: '消息统计' }))
+    expect(props.onWorkspaceNavigate).toHaveBeenCalledWith('/extensions/test.plugin/overview')
+    expect(mocks.t).not.toHaveBeenCalledWith('消息统计')
+  })
+
+  it('当前插件工作区保持可见，其余插件收进更多菜单', () => {
+    const extensions: WebUIExtension[] = ['first', 'second'].map((plugin_id) => ({ plugin_id, workspace_title: plugin_id, pages: [{
+      id: 'overview', title: 'Overview', description: '', placement: 'workspace', icon: 'puzzle', queries: {}, actions: {}, content: [],
+    }] }))
+    render(<Header {...makeProps({ extensions, workspaceMode: 'plugin:second' })} />)
+    expect(screen.getByRole('tab', { name: 'second' })).toBeInTheDocument()
+    expect(screen.queryByRole('tab', { name: 'first' })).not.toBeInTheDocument()
+    expect(screen.getByRole('button', { name: 'pluginWebUI.more' })).toBeInTheDocument()
+    expect(screen.getByRole('button', { name: 'a11y.closeMenu' })).not.toHaveClass('hidden')
+  })
   beforeEach(() => {
     mocks.pathname = '/'
     mocks.electron = false
@@ -306,14 +328,11 @@ describe('Header', () => {
     await waitFor(() => expect(screen.getByText('搜索对话框已打开')).toBeInTheDocument())
   })
 
-  it('当前页为设置且搜索打开时高亮对应顶栏按钮', () => {
+  it('搜索打开时高亮对应顶栏按钮', () => {
     mocks.pathname = '/settings'
     const { rerender } = render(<Header {...makeProps({ searchOpen: false })} />)
 
-    expect(document.querySelector('[data-header-action-highlighted="true"]')).toHaveAttribute(
-      'aria-label',
-      'sidebar.menu.settings'
-    )
+    expect(document.querySelector('[data-header-action-highlighted="true"]')).toBeNull()
 
     rerender(<Header {...makeProps({ searchOpen: true })} />)
     expect(document.querySelector('[data-header-action-highlighted="true"]')).toHaveAttribute(
@@ -396,15 +415,15 @@ describe('Header', () => {
     expect(props.onWorkspaceNavigate).not.toHaveBeenCalled()
   })
 
-  it('悬停工作区会抢占设置高亮，离开延迟后恢复，锁定后不再跟随悬停', () => {
+  it('悬停工作区会抢占当前标签高亮，离开延迟后恢复，锁定后不再跟随悬停', () => {
     vi.useFakeTimers()
     mocks.pathname = '/settings'
     const props = makeProps({ workspaceMode: 'settings' })
     const { rerender, unmount } = render(<Header {...props} />)
 
     const logsTab = screen.getByRole('tab', { name: 'workspace.logs' })
     const settingsTab = screen.getByRole('tab', { name: 'workspace.settings' })
-    const settingsLink = screen.getByRole('link', { name: 'sidebar.menu.settings' })
+    const settingsLink = settingsTab
     const tabs = document.querySelector('[data-dashboard-workspace-tabs="true"]') as HTMLElement
 
     expect(settingsLink.querySelector('[data-layout-id="topbar-selection-pill"]')).toBeInTheDocument()
@@ -609,7 +628,7 @@ describe('Header', () => {
     })
   })
 
-  it('顶栏按钮悬停定时器可被再次进入打断，并触发设置/语言/文档等剩余回调', () => {
+  it('顶栏按钮悬停定时器可被再次进入打断，并触发工作区/语言/文档等剩余回调', () => {
     vi.useFakeTimers()
     const props = makeProps()
     render(<Header {...props} />)
@@ -619,7 +638,7 @@ describe('Header', () => {
     const languageButton = screen.getByRole('button', { name: 'header.switchLanguage' })
     const themeButton = screen.getAllByRole('button', { name: 'header.switchToLight' })[0]
     const logoutButton = screen.getByRole('button', { name: 'header.logout' })
-    const settingsLink = screen.getByRole('link', { name: 'sidebar.menu.settings' })
+    const settingsLink = screen.getByRole('tab', { name: 'workspace.settings' })
 
     fireEvent.pointerEnter(searchButton)
     fireEvent.pointerLeave(searchButton)
@@ -637,7 +656,7 @@ describe('Header', () => {
     fireEvent.click(settingsLink)
     fireEvent.click(screen.getAllByRole('button', { name: 'English' })[1])
 
-    expect(settingsLink).toHaveAttribute('href', '/settings')
+    expect(settingsLink).toHaveAttribute('href', '/')
     expect(mocks.changeLanguage).toHaveBeenCalledWith('en')
 
     act(() => {
```

**File**: `dashboard/src/components/layout/Header.tsx` (modified, +58/-11)
```diff
@@ -46,6 +46,8 @@ import { logout } from '@/lib/auth'
 import { isElectron } from '@/lib/runtime'
 import { ThemeProviderContext } from '@/lib/theme-context'
 import { cn } from '@/lib/utils'
+import { extensionIcons, extensionPath, extensionWorkspace } from '@/lib/plugin-webui'
+import type { WebUIExtension } from '@/lib/plugin-webui'
 
 import type { WorkspaceMode } from './types'
 
@@ -69,7 +71,7 @@ const SearchDialog = lazy(() =>
 
 const WORKSPACE_TABS: Array<{
   value: WorkspaceMode
-  to: '/' | '/chat' | '/logs'
+  to: string
   icon: ComponentType<{ className?: string }>
   labelKey: string
 }> = [
@@ -78,6 +80,7 @@ const WORKSPACE_TABS: Array<{
 ]
 
 interface HeaderProps {
+  extensions?: WebUIExtension[]
   sidebarOpen: boolean
   mobileMenuOpen: boolean
   searchOpen: boolean
@@ -87,14 +90,15 @@ interface HeaderProps {
   onSearchOpenChange: (open: boolean) => void
   onThemeChange: (theme: 'light' | 'dark' | 'system') => void
   onTopbarToggle: () => void
-  onWorkspaceNavigate: (to: '/' | '/chat' | '/logs') => void
+  onWorkspaceNavigate: (to: string) => void
   topbarCollapsed: boolean
   workspaceMode: WorkspaceMode
 }
 
 type HeaderActionId = 'search' | 'docs' | 'language' | 'theme' | 'logout'
 
 export function Header({
+  extensions = [],
   sidebarOpen,
   mobileMenuOpen,
   searchOpen,
@@ -109,6 +113,28 @@ export function Header({
   workspaceMode,
 }: HeaderProps) {
   const { t, i18n: i18nInstance } = useTranslation()
+  const pluginTabs = extensions.flatMap((extension) => {
+    const page = extension.pages.find((page) => page.placement === 'workspace')
+    return page
+      ? [
+          {
+            value: extensionWorkspace(extension.plugin_id),
+            to: extensionPath(extension.plugin_id, page.id),
+            icon: extensionIcons[page.icon],
+            labelKey: extension.workspace_title ?? extension.plugin_id,
+            literal: true,
+          },
+        ]
+      : []
+  })
+  // 顶栏最多直接展示一个插件工作区，其余收进“更多”；当前工作区保持可见。
+  const visiblePluginTab = pluginTabs.find((tab) => tab.value === workspaceMode) ?? pluginTabs[0]
+  const workspaceTabs = [
+    ...WORKSPACE_TABS.map((tab) => ({ ...tab, literal: false })),
+    ...(visiblePluginTab ? [visiblePluginTab] : []),
+  ]
+  const overflowTabs = pluginTabs.filter((tab) => tab !== visiblePluginTab)
+  const workspaceTabsKey = workspaceTabs.map((tab) => `${tab.value}:${tab.labelKey}`).join('|')
   const { themeConfig } = useContext(ThemeProviderContext)
   // 千禧风格的顶栏要放得下键帽，比其它风格高一截；高度由动画驱动，所以在这里按风格取值。
   const expandedTopbarHeight = themeConfig.dashboardStyle === 'millennium' ? 70 : 42
@@ -219,7 +245,7 @@ export function Header({
       window.removeEventListener('resize', updateCompactState)
       resizeObserver.disconnect()
     }
-  }, [workspaceMode])
+  }, [workspaceMode, workspaceTabsKey])
 
   const handleLogout = async () => {
     await logout()
@@ -293,7 +319,7 @@ export function Header({
               title={t('header.switchSidebarToHover')}
               className={cn(
                 'group absolute top-1/2 left-0 z-20 hidden h-5 w-7 -translate-y-1/2 items-center justify-center focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none lg:flex',
-                workspaceMode !== 'settings' && 'lg:hidden'
+                workspaceMode === 'logs' && 'lg:hidden'
               )}
             >
               <ChevronLeft
@@ -339,7 +365,7 @@ export function Header({
               aria-expanded={mobileMenuOpen}
               className={cn(
                 'hover:bg-accent rounded-lg p-2 lg:hidden',
-                workspaceMode !== 'settings' && 'hidden'
+                workspaceMode === 'logs' && 'hidden'
               )}
             >
               <Menu className="h-5 w-5" />
@@ -356,7 +382,7 @@ export function Header({
                 title={t('header.switchSidebarToHover')}
                 className={cn(
                   'group absolute top-1/2 left-0 z-20 hidden h-14 w-7 -translate-y-1/2 items-center justify-center focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none lg:flex',
-                  workspaceMode !== 'settings' && 'lg:hidden'
+                  workspaceMode === 'logs' && 'lg:hidden'
                 )}
               >
                 <ChevronLeft
@@ -378,14 +404,14 @@ export function Header({
                 aria-hidden="true"
                 className="pointer-events-none invisible absolute top-0 left-0 inline-flex h-9 items-center justify-center gap-0.5 rounded-lg p-1"
               >
-                {WORKSPACE_TABS.map(({ value, icon: Icon, labelKey }) => (
+                {workspaceTabs.map(({ value, icon: Icon, labelKey, literal }) => (
                   <div
                     key={value}
                     className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-sm fo
```

**File**: `dashboard/src/components/layout/Layout.test.tsx` (modified, +5/-1)
```diff
@@ -108,7 +108,11 @@ vi.mock('@/components/ui/tooltip', () => ({
   TooltipProvider: ({ children }: { children: ReactNode }) => children,
 }))
 vi.mock('@/components/use-theme', () => ({
-  useTheme: () => ({ setTheme: vi.fn(), theme: layoutMocks.theme }),
+  useTheme: () => ({ setTheme: vi.fn(), theme: layoutMocks.theme, themeConfig: { dashboardStyle: 'default' } }),
+}))
+vi.mock('@/lib/plugin-webui', async (importOriginal) => ({
+  ...await importOriginal<typeof import('@/lib/plugin-webui')>(),
+  usePluginWebUI: () => ({ extensions: [], loading: false, error: null, preferences: { hidden: [], order: [] } }),
 }))
 vi.mock('@/hooks/use-auth', () => ({
   useAuthGuard: () => ({ checking: layoutMocks.checking }),
```

**File**: `dashboard/src/components/layout/Layout.tsx` (modified, +91/-19)
```diff
@@ -1,4 +1,4 @@
-import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
+import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
 import { useTranslation } from 'react-i18next'
 import { useRouter, useRouterState } from '@tanstack/react-router'
 import { AnimatePresence, motion } from 'motion/react'
@@ -17,9 +17,16 @@ import { TitleBar } from '@/components/electron/TitleBar'
 import { matchesShortcut } from '@/lib/keyboard'
 import { isElectron } from '@/lib/runtime'
 import { cn } from '@/lib/utils'
+import {
+  extensionIcons,
+  extensionPath,
+  extensionWorkspace,
+  usePluginWebUI,
+  visibleExtensions,
+} from '@/lib/plugin-webui'
 import { Header } from './Header'
 import { Sidebar } from './Sidebar'
-import type { LayoutProps, WorkspaceMode } from './types'
+import type { LayoutProps, MenuSection, WorkspaceMode } from './types'
 import { useMenuSections } from './use-menu-sections'
 
 const SIDEBAR_OPEN_STORAGE_KEY = 'maibot-layout-sidebar-open'
@@ -33,7 +40,12 @@ const UpdateNoticeDialog = lazy(() =>
   }))
 )
 
-type WorkspaceTransitionStage = 'idle' | 'page-exit' | 'sidebar-exit' | 'sidebar-enter' | 'page-enter'
+type WorkspaceTransitionStage =
+  | 'idle'
+  | 'page-exit'
+  | 'sidebar-exit'
+  | 'sidebar-enter'
+  | 'page-enter'
 
 function loadStoredBoolean(key: string, fallback: boolean): boolean {
   if (typeof window === 'undefined') {
@@ -53,26 +65,83 @@ export function Layout({ children }: LayoutProps) {
   const pathname = useRouterState({ select: (state) => state.location.pathname })
   const routeStatus = useRouterState({ select: (state) => state.status })
   const announce = useAnnounce()
+  const extensionRegistry = usePluginWebUI(!checking)
+  const extensions = useMemo(() => visibleExtensions(extensionRegistry), [extensionRegistry])
+  const workspaceForPath = (path: string): WorkspaceMode => {
+    const extension = extensions.find((extension) =>
+      extension.pages.some(
+        (page) =>
+          page.placement === 'workspace' && extensionPath(extension.plugin_id, page.id) === path
+      )
+    )
+    return extension ? extensionWorkspace(extension.plugin_id) : 'settings'
+  }
   const isLogsPath =
     pathname === '/logs' || pathname === '/statistics' || pathname.startsWith('/reasoning-process')
   // 麦麦聊天已并入麦麦设置侧边栏，/chat 属于设置工作区
-  const workspaceMode: WorkspaceMode = isLogsPath ? 'logs' : 'settings'
-  const isSettingsWorkspace = workspaceMode === 'settings'
-  const showBackToTop = isSettingsWorkspace && pathname !== '/chat' && pathname !== '/planner-monitor'
+  const workspaceMode: WorkspaceMode = isLogsPath ? 'logs' : workspaceForPath(pathname)
+  const isSettingsWorkspace = workspaceMode !== 'logs'
+  const showBackToTop =
+    isSettingsWorkspace && pathname !== '/chat' && pathname !== '/planner-monitor'
 
-  const [sidebarOpen, setSidebarOpen] = useState(() => loadStoredBoolean(SIDEBAR_OPEN_STORAGE_KEY, true))
+  const [sidebarOpen, setSidebarOpen] = useState(() =>
+    loadStoredBoolean(SIDEBAR_OPEN_STORAGE_KEY, true)
+  )
   const [skipSidebarResizeAnimation, setSkipSidebarResizeAnimation] = useState(false)
   const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
   const [searchOpen, setSearchOpen] = useState(false)
-  const [topbarCollapsed, setTopbarCollapsed] = useState(() => loadStoredBoolean(TOPBAR_COLLAPSED_STORAGE_KEY, false))
-  const [workspaceTransitionStage, setWorkspaceTransitionStage] = useState<WorkspaceTransitionStage>('idle')
-  const [workspaceTransitionTarget, setWorkspaceTransitionTarget] = useState<WorkspaceMode | null>(null)
+  const [topbarCollapsed, setTopbarCollapsed] = useState(() =>
+    loadStoredBoolean(TOPBAR_COLLAPSED_STORAGE_KEY, false)
+  )
+  const [workspaceTransitionStage, setWorkspaceTransitionStage] =
+    useState<WorkspaceTransitionStage>('idle')
+  const [workspaceTransitionTarget, setWorkspaceTransitionTarget] = useState<WorkspaceMode | null>(
+    null
+  )
   const workspaceTransitionTimerRef = useRef<number | null>(null)
   const shellStateRef = useRef({ sidebarOpen, topbarCollapsed })
-  const immersiveRestoreRef = useRef<{ sidebarOpen: boolean; topbarCollapsed: boolean } | null>(null)
+  const immersiveRestoreRef = useRef<{ sidebarOpen: boolean; topbarCollapsed: boolean } | null>(
+    null
+  )
   const { theme, setTheme, themeConfig } = useTheme()
   const effectiveSidebarOpen = themeConfig.dashboardStyle !== 'millennium' && sidebarOpen
-  const menuSections = useMenuSections()
+  const builtInMenuSections = useMenuSections()
+  const menuSections = useMemo(() => {
+    const pluginMenuSections: MenuSection[] = extensions.flatMap((extension) => {
+      const pages = extension.pages.filter((page) =>
+        page.placement === 'sidebar'
+          ? workspaceMode === 'settings'
+          : workspaceMode === extensionWorkspace(extension.plugin_id)
+      )
+      return pages.length
+        ? [
+            {
+              title: extension.work
```

**File**: `dashboard/src/components/layout/NavItem.tsx` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ export function NavItem({
   const matchRoute = useMatchRoute()
   const isActive = item.external ? false : matchRoute({ to: item.path })
   const Icon = item.icon
-  const label = t(item.label)
+  const label = item.literalLabel ? item.label : t(item.label)
   const prefersReducedMotion = useReducedMotion()
   const flyoutTransition = {
     duration: prefersReducedMotion ? 0 : 0.22,
```

---

### Incident Patch 9: `d825e86e` (2026-10-03)
**Commit Message**: feat: 给webui添加新风格

**File**: `dashboard/public/fonts/PixelifySans-OFL.txt` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+Copyright 2021 The Pixelify Sans Project Authors (https://github.com/eifetx/Pixelify-Sans)
+
+This Font Software is licensed under the SIL Open Font License, Version 1.1.
+This license is copied below, and is also available with a FAQ at:
+https://scripts.sil.org/OFL
+
+
+-----------------------------------------------------------
+SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
+-----------------------------------------------------------
+
+PREAMBLE
+The goals of the Open Font License (OFL) are to stimulate worldwide
+development of collaborative font projects, to support the font creation
+efforts of academic and linguistic communities, and to provide a free and
+open framework in which fonts may be shared and improved in partnership
+with others.
+
+The OFL allows the licensed fonts to be used, studied, modified and
+redistributed freely as long as they are not sold by themselves. The
+fonts, including any derivative works, can be bundled, embedded, 
+redistributed and/or sold with any software provided that any reserved
+names are not used by derivative works. The fonts and derivatives,
+however, cannot be released under any other type of license. The
+requirement for fonts to remain under this license does not apply
+to any document created using the fonts or their derivatives.
+
+DEFINITIONS
+"Font Software" refers to the set of files released by the Copyright
+Holder(s) under this license and clearly marked as such. This may
+include source files, build scripts and documentation.
+
+"Reserved Font Name" refers to any names specified as such after the
+copyright statement(s).
+
+"Original Version" refers to the collection of Font Software components as
+distributed by the Copyright Holder(s).
+
+"Modified Version" refers to any derivative made by adding to, deleting,
+or substituting -- in part or in whole -- any of the components of the
+Original Version, by changing formats or by porting the Font Software to a
+new environment.
+
+"Author" refers to any designer, engineer, programmer, technical
+writer or other person who contributed to the Font Software.
+
+PERMISSION & CONDITIONS
+Permission is hereby granted, free of charge, to any person obtaining
+a copy of the Font Software, to use, study, copy, merge, embed, modify,
+redistribute, and sell modified and unmodified copies of the Font
+Software, subject to the following conditions:
+
+1) Neither the Font Software nor any of its individual components,
+in Original or Modified Versions, may be sold by itself.
+
+2) Original or Modified Versions of the Font Software may be bundled,
+redistributed and/or sold with any software, provided that each copy
+contains the above copyright notice and this license. These can be
+included either as stand-alone text files, human-readable headers or
+in the appropriate machine-readable metadata fields within text or
+binary files as long as those fields can be easily viewed by the user.
+
+3) No Modified Version of the Font Software may use the Reserved Font
+Name(s) unless explicit written permission is granted by the corresponding
+Copyright Holder. This restriction only applies to the primary font name as
+presented to the users.
+
+4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
+Software shall not be used to promote, endorse or advertise any
+Modified Version, except to acknowledge the contribution(s) of the
+Copyright Holder(s) and the Author(s) or with their explicit written
+permission.
+
+5) The Font Software, modified or unmodified, in part or in whole,
+must be distributed entirely under this license, and must not be
+distributed under any other license. The requirement for fonts to
+remain under this license does not apply to any document created
+using the Font Software.
+
+TERMINATION
+This license becomes null and void if any of the above conditions are
+not met.
+
+DISCLAIMER
+THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
+EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
+MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
+OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
+COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
+INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
+DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
+FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
+OTHER DEALINGS IN THE FONT SOFTWARE.
```

**File**: `dashboard/src/components/layout/Header.tsx` (modified, +36/-31)
```diff
@@ -1,8 +1,9 @@
-import { Link, useRouterState } from '@tanstack/react-router'
+import { Link } from '@tanstack/react-router'
 import {
   BookOpen,
   Check,
   ChevronLeft,
+  ChevronsUp,
   Database,
   FileText,
   Globe,
@@ -11,12 +12,19 @@ import {
   Moon,
   MoreHorizontal,
   Search,
-  Settings,
   SlidersHorizontal,
   Sun,
 } from 'lucide-react'
 import { LayoutGroup, motion } from 'motion/react'
-import { lazy, Suspense, type ComponentType, useEffect, useRef, useState } from 'react'
+import {
+  lazy,
+  Suspense,
+  type ComponentType,
+  useContext,
+  useEffect,
+  useRef,
+  useState,
+} from 'react'
 import { useTranslation } from 'react-i18next'
 
 import { BackgroundLayer } from '@/components/background-layer'
@@ -36,6 +44,7 @@ import { toggleThemeWithTransition } from '@/components/use-theme'
 import { useBackground } from '@/hooks/use-background'
 import { logout } from '@/lib/auth'
 import { isElectron } from '@/lib/runtime'
+import { ThemeProviderContext } from '@/lib/theme-context'
 import { cn } from '@/lib/utils'
 
 import type { WorkspaceMode } from './types'
@@ -83,7 +92,7 @@ interface HeaderProps {
   workspaceMode: WorkspaceMode
 }
 
-type HeaderActionId = 'settings' | 'search' | 'docs' | 'language' | 'theme' | 'logout'
+type HeaderActionId = 'search' | 'docs' | 'language' | 'theme' | 'logout'
 
 export function Header({
   sidebarOpen,
@@ -100,10 +109,12 @@ export function Header({
   workspaceMode,
 }: HeaderProps) {
   const { t, i18n: i18nInstance } = useTranslation()
+  const { themeConfig } = useContext(ThemeProviderContext)
+  // 千禧风格的顶栏要放得下键帽，比其它风格高一截；高度由动画驱动，所以在这里按风格取值。
+  const expandedTopbarHeight = themeConfig.dashboardStyle === 'millennium' ? 70 : 42
   const currentLang = i18nInstance.language || 'zh'
   const { config: headerBg, inheritedFrom } = useBackground('header')
   const inheritsPageBackground = inheritedFrom === 'page'
-  const pathname = useRouterState({ select: (state) => state.location.pathname })
   const [backendManagerOpen, setBackendManagerOpen] = useState(false)
   const [activeBackendName, setActiveBackendName] = useState<string>('')
   const [workspaceTabsCompact, setWorkspaceTabsCompact] = useState(false)
@@ -218,9 +229,7 @@ export function Header({
     ? 'language'
     : searchOpen
       ? 'search'
-      : pathname === '/settings'
-        ? 'settings'
-        : null
+      : null
   const highlightedHeaderAction =
     hoveredWorkspace === null ? (hoveredHeaderAction ?? activeHeaderAction) : null
 
@@ -257,7 +266,7 @@ export function Header({
       data-dashboard-header="true"
       data-dashboard-header-collapsed={topbarCollapsed ? 'true' : undefined}
       initial={false}
-      animate={{ height: topbarCollapsed ? 16 : 42, marginBottom: 0 }}
+      animate={{ height: topbarCollapsed ? 16 : expandedTopbarHeight, marginBottom: 0 }}
       transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
       className={cn(
         'sticky top-0 isolate z-30 min-w-0 overflow-visible',
@@ -479,28 +488,6 @@ export function Header({
                   ))}
                 </TabsList>
               </Tabs>
-            <Button
-              asChild
-              variant="ghost"
-              size="icon"
-              data-dashboard-header-action="true"
-              data-header-action-highlighted={
-                highlightedHeaderAction === 'settings' ? 'true' : 'false'
-              }
-              className="relative isolate border-0 bg-transparent shadow-none"
-              title={t('sidebar.menu.settings')}
-              aria-label={t('sidebar.menu.settings')}
-            >
-              <Link
-                to="/settings"
-                onPointerEnter={() => handleHeaderActionEnter('settings')}
-                onPointerLeave={handleHeaderActionLeave}
-                onClick={() => setHoveredHeaderAction('settings')}
-              >
-                {renderHeaderActionPill('settings')}
-                <Settings className="h-4 w-4" />
-              </Link>
-            </Button>
             {/* 后端切换按钮（仅 Electron） */}
             {isElectron() && (
               <>
@@ -639,6 +626,24 @@ export function Header({
               )}
             </Button>
 
+            {/* 千禧风格用一颗键帽收起顶栏，取代顶栏下沿的滑条 */}
+            {themeConfig.dashboardStyle === 'millennium' && (
+              <Button
+                variant="ghost"
+                size="icon"
+                onClick={onTopbarToggle}
+                title={t('header.collapseTopbar')}
+                aria-label={t('header.collapseTopbar')}
+                aria-expanded={!topbarCollapsed}
+                data-dashboard-header-action="true"
+                data-dashboard-topbar-collapse-key="true"
+                data-header-action-highlighted="false"
+                className="relative isolate hidden border-0 bg-transparent shadow-none sm:inline-flex"
+              >
+                <ChevronsUp className="h-5 w-5" />
+              </Button>
+            )}

```

**File**: `dashboard/src/components/layout/Layout.tsx` (modified, +8/-5)
```diff
@@ -70,7 +70,8 @@ export function Layout({ children }: LayoutProps) {
   const workspaceTransitionTimerRef = useRef<number | null>(null)
   const shellStateRef = useRef({ sidebarOpen, topbarCollapsed })
   const immersiveRestoreRef = useRef<{ sidebarOpen: boolean; topbarCollapsed: boolean } | null>(null)
-  const { theme, setTheme } = useTheme()
+  const { theme, setTheme, themeConfig } = useTheme()
+  const effectiveSidebarOpen = themeConfig.dashboardStyle !== 'millennium' && sidebarOpen
   const menuSections = useMenuSections()
 
   useEffect(() => {
@@ -304,7 +305,7 @@ export function Layout({ children }: LayoutProps) {
               style={{
                 width: sidebarExiting
                   ? 0
-                  : sidebarOpen
+                  : effectiveSidebarOpen
                     ? 'var(--layout-sidebar-width)'
                     : 'var(--layout-sidebar-collapsed-width)',
               }}
@@ -316,8 +317,9 @@ export function Layout({ children }: LayoutProps) {
                 transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
               >
                 <Sidebar
-                  sidebarOpen={sidebarOpen}
+                  sidebarOpen={effectiveSidebarOpen}
                   mobileMenuOpen={mobileMenuOpen}
+                  topbarCollapsed={topbarCollapsed}
                   onMobileMenuClose={() => setMobileMenuOpen(false)}
                   onSidebarFix={handleSidebarFix}
                 />
@@ -329,8 +331,9 @@ export function Layout({ children }: LayoutProps) {
           {isSettingsWorkspace && (
             <div className="lg:hidden">
               <Sidebar
-                sidebarOpen={sidebarOpen}
+                sidebarOpen={effectiveSidebarOpen}
                 mobileMenuOpen={mobileMenuOpen}
+                topbarCollapsed={topbarCollapsed}
                 onMobileMenuClose={() => setMobileMenuOpen(false)}
                 onSidebarFix={handleSidebarFix}
               />
@@ -361,7 +364,7 @@ export function Layout({ children }: LayoutProps) {
 
             {/* Topbar */}
             <Header
-              sidebarOpen={sidebarOpen}
+              sidebarOpen={effectiveSidebarOpen}
               mobileMenuOpen={mobileMenuOpen}
               searchOpen={searchOpen}
               actualTheme={actualTheme}
```

**File**: `dashboard/src/components/layout/NavItem.tsx` (modified, +176/-19)
```diff
@@ -1,47 +1,124 @@
 import { Link, useMatchRoute } from '@tanstack/react-router'
+import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
+import { useCallback, useRef, useState } from 'react'
+import { createPortal } from 'react-dom'
 import { useTranslation } from 'react-i18next'
 
 import { cn } from '@/lib/utils'
 
 import type { MenuItem } from './types'
 
+const MotionLink = motion.create(Link)
+
 interface NavItemProps {
   item: MenuItem
   sidebarOpen: boolean
+  expandOnHover?: boolean
   onMobileMenuClose: () => void
 }
 
 export function NavItem({
   item,
   sidebarOpen,
+  expandOnHover = false,
   onMobileMenuClose,
 }: NavItemProps) {
   const { t } = useTranslation()
   const matchRoute = useMatchRoute()
   const isActive = item.external ? false : matchRoute({ to: item.path })
   const Icon = item.icon
   const label = t(item.label)
+  const prefersReducedMotion = useReducedMotion()
+  const flyoutTransition = {
+    duration: prefersReducedMotion ? 0 : 0.22,
+    ease: [0.22, 1, 0.36, 1] as const,
+  }
+  const itemRef = useRef<HTMLLIElement>(null)
+  const flyoutRef = useRef<HTMLDivElement>(null)
+  const [flyoutRect, setFlyoutRect] = useState<DOMRect | null>(null)
+  const [flyoutMounted, setFlyoutMounted] = useState(false)
+
+  const handleFlyoutScroll = useCallback(() => {
+    const node = flyoutRef.current
+    const link = itemRef.current?.firstElementChild
+    if (node && link) {
+      // 退出动画仍会保留 DOM；每次滚动都跟随原按钮更新位置，直到动画结束卸载。
+      const rect = link.getBoundingClientRect()
+      node.style.left = `${rect.left - 6}px`
+      node.style.top = `${rect.top - 6}px`
+    }
+    setFlyoutRect(null)
+  }, [])
+
+  const handleFlyoutWheel = useCallback((event: WheelEvent) => {
+    if (event.ctrlKey || event.deltaY === 0) return
+    const viewport = itemRef.current?.closest<HTMLElement>('[data-dashboard-scrollbar-viewport="true"]')
+    if (!viewport) return
+
+    // Portal 不在滚动容器内，将滚轮交回原侧栏；兼容鼠标的行单位和触控板的像素单位。
+    event.preventDefault()
+    event.stopPropagation()
+    const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
+      ? 16
+      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
+        ? viewport.clientHeight
+        : 1
+    viewport.scrollTop += event.deltaY * unit
+  }, [])
+
+  const setFlyoutRef = useCallback((node: HTMLDivElement | null) => {
+    flyoutRef.current?.removeEventListener('wheel', handleFlyoutWheel)
+    window.removeEventListener('scroll', handleFlyoutScroll, true)
+    window.removeEventListener('resize', handleFlyoutScroll)
+    flyoutRef.current = node
+    // 原按钮保留布局和交互，但浮层实际存在期间只绘制浮层，包含退出动画。
+    setFlyoutMounted(node !== null)
+    // 使用非 passive 原生监听，确保可以阻止浮层下方页面的默认滚动。
+    node?.addEventListener('wheel', handleFlyoutWheel, { passive: false })
+    if (node) {
+      // 监听与浮层 DOM 同寿命，收回动画期间也继续跟随滚动及窗口尺寸变化。
+      window.addEventListener('scroll', handleFlyoutScroll, true)
+      window.addEventListener('resize', handleFlyoutScroll)
+    }
+  }, [handleFlyoutScroll, handleFlyoutWheel])
 
-  const menuItemContent = (
+  const openFlyout = () => {
+    if (expandOnHover && window.matchMedia('(min-width: 1024px)').matches) {
+      const link = itemRef.current?.firstElementChild
+      if (link) setFlyoutRect(link.getBoundingClientRect())
+    }
+  }
+
+  const menuItemContent = (expanded = false) => (
     <>
-      <div className={cn('flex min-w-0 items-center', sidebarOpen ? 'gap-3' : 'gap-3 lg:gap-0')}>
+      <div className={cn(
+        'flex min-w-0 items-center',
+        sidebarOpen || expanded ? 'gap-3' : 'gap-3 lg:gap-0',
+        expanded && 'shrink-0'
+      )}>
         <Icon
           data-dashboard-nav-icon="true"
           className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-primary')}
           size={20}
         />
-        <span
+        <motion.span
           data-dashboard-nav-label="true"
+          initial={expanded ? { opacity: 0 } : false}
+          animate={expanded ? { opacity: 1 } : undefined}
+          exit={expanded ? { opacity: 0 } : undefined}
+          transition={flyoutTransition}
           className={cn(
             'text-base font-medium whitespace-nowrap transition-opacity duration-150',
-            sidebarOpen
-              ? 'max-w-[160px] min-w-0 overflow-hidden text-ellipsis opacity-100'
-              : 'max-w-[200px] opacity-100 lg:max-w-0 lg:overflow-hidden lg:opacity-0'
+            expanded
+              ? 'opacity-100'
+              : sidebarOpen
+                ? 'max-w-[160px] min-w-0 overflow-hidden text-ellipsis opacity-100'
+                : 'max-w-[200px] opacity-100 lg:max-w-0 lg:overflow-hidden lg:opacity-0'
           )}
-          title={label}
+          title={expanded ? undefined : label}
         >
           {label}
-        </span>
+        </motion.span>
       </div>
     </>
   )
@@ -59,23 +136,103 @@ export function NavItem({
     'data-tour': item.tourId,
     'data-dashboard-nav-item': 'true',
     'data-active': isActive ? 'true' : 'false'
```

**File**: `dashboard/src/components/layout/Sidebar.tsx` (modified, +27/-11)
```diff
@@ -4,6 +4,7 @@ import { useTranslation } from 'react-i18next'
 
 import { BackgroundLayer } from '@/components/background-layer'
 import { ScrollArea } from '@/components/ui/scroll-area'
+import { useTheme } from '@/components/use-theme'
 import { useBackground } from '@/hooks/use-background'
 import { cn } from '@/lib/utils'
 
@@ -14,6 +15,7 @@ import { useMenuSections } from './use-menu-sections'
 interface SidebarProps {
   sidebarOpen: boolean
   mobileMenuOpen: boolean
+  topbarCollapsed?: boolean
   onMobileMenuClose: () => void
   onSidebarFix: () => void
 }
@@ -24,10 +26,13 @@ const SIDEBAR_COLLAPSE_TRANSITION_MS = 220
 export function Sidebar({
   sidebarOpen,
   mobileMenuOpen,
+  topbarCollapsed = false,
   onMobileMenuClose,
   onSidebarFix,
 }: SidebarProps) {
-  const { t } = useTranslation()
+  const { t, i18n } = useTranslation()
+  const { themeConfig } = useTheme()
+  const isMillennium = themeConfig.dashboardStyle === 'millennium'
   const { config: sidebarBg, inheritedFrom } = useBackground('sidebar')
   const inheritsPageBackground = inheritedFrom === 'page'
   const menuSections = useMenuSections()
@@ -36,8 +41,8 @@ export function Sidebar({
   const [collapseTransitionActive, setCollapseTransitionActive] = useState(false)
   const hoverExpandTimerRef = useRef<number | null>(null)
   const collapseTransitionTimerRef = useRef<number | null>(null)
-  const sidebarRevealed = sidebarOpen || hoverExpanded || fixTransitionActive
-  const visuallyOpen = sidebarRevealed || collapseTransitionActive
+  const sidebarRevealed = !isMillennium && (sidebarOpen || hoverExpanded || fixTransitionActive)
+  const visuallyOpen = sidebarRevealed || (!isMillennium && collapseTransitionActive)
 
   const cancelHoverExpand = useCallback(() => {
     if (hoverExpandTimerRef.current !== null) {
@@ -60,26 +65,27 @@ export function Sidebar({
   }
 
   useEffect(() => {
-    if (sidebarOpen) {
+    if (sidebarOpen || isMillennium) {
       cancelHoverExpand()
       cancelCollapseTransition()
     }
     return () => {
       cancelHoverExpand()
       cancelCollapseTransition()
     }
-  }, [cancelCollapseTransition, cancelHoverExpand, sidebarOpen])
+  }, [cancelCollapseTransition, cancelHoverExpand, isMillennium, sidebarOpen])
 
   return (
     <aside
       data-dashboard-sidebar="true"
+      data-dashboard-sidebar-topbar-collapsed={isMillennium && topbarCollapsed ? 'true' : undefined}
       data-dashboard-sidebar-hover-expanded={hoverExpanded ? 'true' : undefined}
       data-dashboard-sidebar-mobile-open={mobileMenuOpen ? 'true' : 'false'}
       data-dashboard-sidebar-mode={sidebarOpen ? 'fixed' : 'hover'}
       data-dashboard-sidebar-fix-transition={fixTransitionActive ? 'true' : undefined}
       data-dashboard-sidebar-visually-open={visuallyOpen ? 'true' : 'false'}
       onPointerEnter={(event) => {
-        if (!sidebarOpen && event.pointerType === 'mouse') {
+        if (!isMillennium && !sidebarOpen && event.pointerType === 'mouse') {
           cancelHoverExpand()
           cancelCollapseTransition()
           setCollapseTransitionActive(false)
@@ -125,7 +131,7 @@ export function Sidebar({
       {/* Logo 区域 */}
       <div className="relative z-10">
         <LogoArea sidebarOpen={sidebarRevealed} />
-        {!sidebarOpen && hoverExpanded && (
+        {!isMillennium && !sidebarOpen && hoverExpanded && (
           <button
             type="button"
             data-dashboard-sidebar-fix-switch="true"
@@ -172,22 +178,31 @@ export function Sidebar({
           >
             {menuSections.map((section, sectionIndex) => (
               <li key={section.title}>
-                {/* 块标题 - 移动端始终可见，桌面端根据 sidebarOpen 切换 */}
+                {/* 块标题 - 移动端始终可见，千禧桌面端以小字常驻，其它风格根据 sidebarOpen 切换 */}
                 <div
                   className={cn(
                     'h-[var(--layout-sidebar-section-title-height)] px-[var(--layout-sidebar-nav-item-padding-x)]',
+                    isMillennium && 'lg:h-auto lg:px-0 lg:text-center',
                     section.title === 'sidebar.groups.overview' && 'hidden',
                     // 移动端始终显示，桌面端根据状态切换
                     'mb-[var(--layout-sidebar-section-title-margin-bottom)]',
                     'transition-opacity duration-[220ms] motion-reduce:transition-none',
-                    !sidebarRevealed && 'lg:opacity-0',
-                    !sidebarRevealed &&
+                    !isMillennium && !sidebarRevealed && 'lg:opacity-0',
+                    !isMillennium && !sidebarRevealed &&
                       'lg:mb-[var(--layout-sidebar-section-title-margin-bottom-collapsed)]'
                   )}
                 >
                   <h3
                     data-dashboard-sidebar-section-title="true"
-                    className="text-muted-foreground/60 text-sm font-semibold tracking-wider whitespace-nowrap uppercase"
+                    data-dashboard-sidebar-title-stacked={
+                      isMillennium && (i18n.resolvedLa
```

**File**: `dashboard/src/components/layout/constants.ts` (modified, +0/-2)
```diff
@@ -34,7 +34,6 @@ const KnowledgeIcon = createStreamlineIcon('user-sticker-square-remix', Database
 const PluginConfigIcon = createStreamlineIcon('application-add-remix', Puzzle)
 const AdapterManagementIcon = createStreamlineIcon('router-wifi-network-solid', Wifi)
 const PluginMarketIcon = createStreamlineIcon('store-2-solid', Store)
-const McpIcon = createStreamlineIcon('router-wifi-network-solid', Wifi)
 const DataTransferIcon: MenuIcon = (props) => createElement(HardDrive, props)
 const ReplyEffectsIcon: MenuIcon = (props) => createElement(Activity, props)
 
@@ -119,7 +118,6 @@ export const menuSections: MenuSection[] = [
         path: '/plugins',
         searchDescription: 'search.items.pluginsDesc',
       },
-      { icon: McpIcon, label: 'sidebar.menu.mcpSettings', path: '/mcp-settings' },
     ],
   },
   {
```

**File**: `dashboard/src/components/theme-provider.tsx` (modified, +15/-4)
```diff
@@ -22,12 +22,23 @@ type ThemeProviderProps = {
   storageKey?: string
 }
 
-function dashboardStyleToConfigValue(style: DashboardStyle): 0 | 1 {
-  return style === 'future-retro' ? 1 : 0
+type WebUIStyleConfigValue = 0 | 1 | 2
+
+// bot_config 的 webui.webui_style 用整数保存界面风格：0 原版、1 未来复古、2 千禧。
+const DASHBOARD_STYLE_CONFIG_VALUES: Record<DashboardStyle, WebUIStyleConfigValue> = {
+  modern: 0,
+  'future-retro': 1,
+  millennium: 2,
+}
+
+function dashboardStyleToConfigValue(style: DashboardStyle): WebUIStyleConfigValue {
+  return DASHBOARD_STYLE_CONFIG_VALUES[style]
 }
 
 function configValueToDashboardStyle(value: unknown): DashboardStyle {
-  return Number(value) === 1 ? 'future-retro' : 'modern'
+  const configValue = Number(value)
+  if (configValue === 2) return 'millennium'
+  return configValue === 1 ? 'future-retro' : 'modern'
 }
 
 function shouldSyncRemoteWebUIStyle(): boolean {
@@ -44,7 +55,7 @@ export function ThemeProvider({
   })
   const [themeConfig, setThemeConfig] = useState<UserThemeConfig>(() => loadThemeConfig())
   const [systemThemeTick, setSystemThemeTick] = useState(0)
-  const pendingWebUIStyleRef = useRef<0 | 1 | null>(null)
+  const pendingWebUIStyleRef = useRef<WebUIStyleConfigValue | null>(null)
 
   const resolvedTheme = useMemo<'dark' | 'light'>(() => {
     void systemThemeTick
```

**File**: `dashboard/src/components/update-notice-dialog.tsx` (modified, +1/-1)
```diff
@@ -548,7 +548,7 @@ export function UpdateNoticeDialog() {
                   稍后处理
                 </Button>
                 <Button type="button" onClick={() => void openPluginManagement()}>
-                  前往插件管理
+                  前往插件扩展
                   <ArrowRight className="h-4 w-4" />
                 </Button>
               </>
```

---

### Incident Patch 10: `61a41325` (2026-10-03)
**Commit Message**: webui: 更醒目的webui重建提醒

**File**: `changelogs/changelog.md` (modified, +4/-0)
```diff
@@ -8,7 +8,11 @@
 
 ## 主程序
 
+- WebUI 开发服务启动时预构建设置页编辑器依赖，避免首次打开设置页时动态模块加载失败。
 - WebUI 记忆页面移除「快速开始」引导区域。
+- WebUI 图片记忆统计与刷新按钮合并为同一行，减少顶部空白。
+- WebUI 资料导入默认选择叙事资料，文件选择按钮与已选文件展示框分开显示。
+- WebUI 记忆需要重建向量时，在页面顶部标签栏右侧显示重建按钮。
 
 - 表达学习移除「表达使用方式」下拉选项，改为默认开启的「使用向量表达」开关；「仅使用精选表达」默认关闭，本次升级统一重置为关闭，优化表达方式学习保持默认开启。
 
```

**File**: `dashboard/src/routes/resource/knowledge-base.tsx` (modified, +19/-17)
```diff
@@ -1007,22 +1007,6 @@ export function KnowledgeBasePage() {
                 <DialogDescription>查看长期记忆运行状态、向量配置和数据目录。</DialogDescription>
               </DialogHeader>
               <div className="flex flex-wrap items-center justify-end gap-2">
-                {runtimeConfig?.vector_rebuild_required ? (
-                  <Button
-                    variant="destructive"
-                    size="sm"
-                    onClick={() => void memoryRuntime.openVectorRebuildDialog()}
-                    disabled={memoryRuntime.vectorRebuilding}
-                  >
-                    <RotateCcw
-                      className={cn(
-                        'mr-2 h-4 w-4',
-                        memoryRuntime.vectorRebuilding && 'animate-spin'
-                      )}
-                    />
-                    重建向量
-                  </Button>
-                ) : null}
                 <Button variant="outline" size="sm" onClick={() => void loadPage()}>
                   <RefreshCw className="mr-2 h-4 w-4" />
                   刷新数据
@@ -1205,13 +1189,31 @@ export function KnowledgeBasePage() {
 
               {/* 「更多操作」省略号与标签同一行：self-stretch 让标签撑满该行，
                   h-8 定住行高，标签高度随之与按钮对齐 */}
+              {runtimeConfig?.vector_rebuild_required ? (
+                <Button
+                  variant="destructive"
+                  size="sm"
+                  className="ml-auto"
+                  title={runtimeConfig.vector_rebuild_message}
+                  onClick={() => void memoryRuntime.openVectorRebuildDialog()}
+                  disabled={memoryRuntime.vectorRebuilding}
+                >
+                  <RotateCcw
+                    className={cn(
+                      'mr-2 h-4 w-4',
+                      memoryRuntime.vectorRebuilding && 'animate-spin'
+                    )}
+                  />
+                  重建向量
+                </Button>
+              ) : null}
               <DropdownMenu>
                 <DropdownMenuTrigger asChild>
                   <Button
                     type="button"
                     variant="outline"
                     size="icon"
-                    className="ml-auto h-8 w-8"
+                    className={cn('h-8 w-8', !runtimeConfig?.vector_rebuild_required && 'ml-auto')}
                     aria-label="更多操作"
                     title="更多操作"
                   >
```

**File**: `dashboard/src/routes/resource/knowledge-base/hooks/useImportForm.ts` (modified, +1/-1)
```diff
@@ -169,7 +169,7 @@ export function useImportForm({ active, onCreated }: UseImportFormOptions): UseI
   const [importCommonNarrativeOverlap, setImportCommonNarrativeOverlap] = useState('400')
   const [importCommonFactualTargetSize, setImportCommonFactualTargetSize] = useState('1200')
   const [importCommonLlmEnabled, setImportCommonLlmEnabled] = useState(true)
-  const [importContentCategory, setImportContentCategory] = useState<ImportContentCategory>('')
+  const [importContentCategory, setImportContentCategory] = useState<ImportContentCategory>('narrative')
   const [importCommonDedupePolicy, setImportCommonDedupePolicy] = useState('content_hash')
   const [importCommonChatId, setImportCommonChatId] = useState('')
   const [importCommonChatReferenceTime, setImportCommonChatReferenceTime] = useState('')
```

**File**: `dashboard/src/routes/resource/knowledge-base/tabs/ImagesTab.tsx` (modified, +15/-9)
```diff
@@ -71,8 +71,8 @@ function Stats({ stats }: { stats?: MemoryImageStatsPayload }) {
     ['待绑定描述', stats?.pending_unbound_description_count ?? 0],
   ]
   return (
-    <div className="space-y-2">
-      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
+    <div className="min-w-0 flex-1 space-y-2">
+      <div className="flex min-h-8 flex-wrap items-center gap-x-5 gap-y-1 text-sm">
         {primaryItems.map(([label, value]) => (
           <span key={label} className="flex items-baseline gap-1.5">
             <span className="text-muted-foreground">{label}</span>
@@ -247,14 +247,20 @@ export function ImagesTab() {
   return (
     <TabsContent value="images" className="space-y-4">
       <Card>
-        <CardHeader className="border-b pb-3 sm:flex-row sm:justify-end">
-          <Button variant="outline" size="sm" onClick={() => void loadPage()} disabled={loading}>
-            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
-            刷新
-          </Button>
-        </CardHeader>
         <CardContent className="pt-4 sm:pt-5">
-          <Stats stats={status?.stats} />
+          <div className="flex items-start gap-4">
+            <Stats stats={status?.stats} />
+            <Button
+              variant="outline"
+              size="sm"
+              className="shrink-0"
+              onClick={() => void loadPage()}
+              disabled={loading}
+            >
+              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
+              刷新
+            </Button>
+          </div>
           {(status?.status === 'error' || status?.status === 'unavailable') && (
             <Alert variant="destructive" className="mt-3">
               <AlertDescription>
```

**File**: `dashboard/src/routes/resource/knowledge-base/tabs/ImportTab.tsx` (modified, +27/-2)
```diff
@@ -1,4 +1,4 @@
-import { useMemo, useState } from 'react'
+import { useMemo, useRef, useState } from 'react'
 
 import { useMutation, useQueryClient } from '@tanstack/react-query'
 import {
@@ -215,6 +215,7 @@ export interface ImportTabProps {
 }
 
 export function ImportTab({ queue, form }: ImportTabProps) {
+  const uploadInputRef = useRef<HTMLInputElement>(null)
   const {
     refreshImportQueue,
     runningImportTasks,
@@ -734,14 +735,38 @@ export function ImportTab({ queue, form }: ImportTabProps) {
                       </div>
                       <div className="space-y-1">
                         <Label>文件选择</Label>
-                        <Input
+                        <input
+                          ref={uploadInputRef}
                           type="file"
+                          className="hidden"
+                          aria-label="文件选择"
                           multiple
                           accept=".txt,.md,.json"
                           onChange={(event) =>
                             setUploadFiles(Array.from(event.target.files ?? []))
                           }
                         />
+                        <div className="flex items-start gap-3">
+                          <Button
+                            type="button"
+                            variant="outline"
+                            className="shrink-0"
+                            onClick={() => uploadInputRef.current?.click()}
+                          >
+                            选择文件
+                          </Button>
+                          <div
+                            role="status"
+                            data-dashboard-input="true"
+                            className="border-input bg-background min-h-9 min-w-0 flex-1 rounded-md border px-3 py-2 text-sm break-words"
+                          >
+                            {uploadFiles.length > 0 ? (
+                              uploadFiles.map((file) => file.name).join('、')
+                            ) : (
+                              <span className="text-muted-foreground">未选择文件</span>
+                            )}
+                          </div>
+                        </div>
                       </div>
                     </div>
                     <div className="text-xs text-muted-foreground">
```

**File**: `dashboard/vite.config.ts` (modified, +17/-1)
```diff
@@ -62,7 +62,23 @@ export default defineConfig({
     dedupe: ['@codemirror/state', '@codemirror/view'],
   },
   optimizeDeps: {
-    include: ['react', 'react-dom'],
+    // 设置页及其懒加载编辑器在启动时预构建，避免首次访问时重新优化依赖，
+    // 使正在加载的模块请求因依赖版本变化返回 504 Outdated Optimize Dep。
+    include: [
+      'react',
+      'react-dom',
+      '@radix-ui/react-accordion',
+      '@codemirror/lang-css',
+      '@codemirror/lang-json',
+      '@codemirror/lang-python',
+      '@codemirror/language',
+      '@codemirror/legacy-modes/mode/toml',
+      '@codemirror/lint',
+      '@codemirror/state',
+      '@codemirror/theme-one-dark',
+      '@codemirror/view',
+      '@uiw/react-codemirror',
+    ],
   },
   build: {
     // 让 Rollup 按实际依赖关系分包，避免手动拆分的 Router/Radix 包互相导入，
```

---

### Incident Patch 11: `306b3751` (2026-10-03)
**Commit Message**: webui: 重构部分配置文件结构

**File**: `changelogs/changelog.md` (modified, +4/-0)
```diff
@@ -8,6 +8,10 @@
 
 ## 主程序
 
+- WebUI 记忆页面移除「快速开始」引导区域。
+
+- 表达学习移除「表达使用方式」下拉选项，改为默认开启的「使用向量表达」开关；「仅使用精选表达」默认关闭，本次升级统一重置为关闭，优化表达方式学习保持默认开启。
+
 - 修复 WebUI 检查中的过时界面断言与缺失 API mock，补全登录输入框的可访问标签，并对齐聊天页面的工作区切换目标。
 
 - WebUI 昵称和别名统一展示在人格设置顶部，保留原有配置结构。
```

**File**: `dashboard/src/components/dynamic-form/DynamicConfigForm.tsx` (modified, +30/-2)
```diff
@@ -29,6 +29,10 @@ export interface DynamicConfigFormProps {
   sectionColumns?: 1 | 2
   /** 按完整配置路径，为顶层配置节添加前置内容。 */
   sectionLeadingContent?: Record<string, React.ReactNode>
+  /** 按完整配置路径，为顶层配置节添加末尾内容。 */
+  sectionTrailingContent?: Record<string, React.ReactNode>
+  /** 按完整配置路径，在字段后插入内容。 */
+  fieldTrailingContent?: Record<string, React.ReactNode>
 }
 
 function buildFieldPath(basePath: string, fieldName: string) {
@@ -107,6 +111,8 @@ function PromptGeneratorEntryCard() {
 
 function DynamicConfigSection({
   leadingContent,
+  trailingContent,
+  fieldTrailingContent,
   advancedVisible,
   basePath,
   children,
@@ -130,6 +136,8 @@ function DynamicConfigSection({
   nestedSchema: ConfigSchema
   onChange: (field: string, value: unknown) => void
   leadingContent?: React.ReactNode
+  trailingContent?: React.ReactNode
+  fieldTrailingContent?: Record<string, React.ReactNode>
   sectionKey: string
   sectionTitle: string
   values: Record<string, unknown>
@@ -182,8 +190,10 @@ function DynamicConfigSection({
                 level={level}
                 advancedVisible={advancedVisible}
                 sectionColumns={1}
+                fieldTrailingContent={fieldTrailingContent}
               />
               {sectionKey === 'personality' && <PromptGeneratorEntryCard />}
+              {trailingContent}
             </div>
           )}
         </CardContent>
@@ -290,6 +300,8 @@ export const DynamicConfigForm: React.FC<DynamicConfigFormProps> = ({
   advancedVisible,
   sectionColumns = 1,
   sectionLeadingContent,
+  sectionTrailingContent,
+  fieldTrailingContent,
 }) => {
   const resolvedAdvancedVisible = advancedVisible ?? false
 
@@ -469,6 +481,7 @@ export const DynamicConfigForm: React.FC<DynamicConfigFormProps> = ({
     <>
       {rows.map((row) => {
         const rowKey = row[0]['x-row']
+        const isBotIdentityRow = rowKey === 'bot-identity'
         const isVisualImageCompressionRow = rowKey === 'visual-image-compression'
 
         return row.length > 1 ? (
@@ -477,7 +490,9 @@ export const DynamicConfigForm: React.FC<DynamicConfigFormProps> = ({
               data-config-row={rowKey}
               className={cn(
                 "grid min-w-0 items-stretch gap-3 py-0.5",
-                isVisualImageCompressionRow
+                isBotIdentityRow
+                  ? "grid-cols-[minmax(0,1fr)_auto]"
+                  : isVisualImageCompressionRow
                   ? "grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.1fr)] items-center"
                   : "md:grid-cols-2 xl:grid-cols-3",
               )}
@@ -487,7 +502,9 @@ export const DynamicConfigForm: React.FC<DynamicConfigFormProps> = ({
                   key={field.name}
                   className={cn(
                     "flex min-w-0 items-stretch",
-                    isVisualImageCompressionRow
+                    isBotIdentityRow
+                      ? ""
+                      : isVisualImageCompressionRow
                       ? fieldIndex > 0 && "md:border-l md:border-border/50 md:pl-3"
                       : horizontalSeparatorClassName,
                   )}
@@ -509,6 +526,15 @@ export const DynamicConfigForm: React.FC<DynamicConfigFormProps> = ({
         <React.Fragment key={row.map((field) => field.name).join('|')}>
           {index > 0 && <Separator className="my-1.5 bg-border/50" />}
           {renderRows([row])}
+          {row.map((field) => {
+            const fieldPath = buildFieldPath(basePath, field.name)
+            const trailingContent = fieldTrailingContent?.[fieldPath]
+            return trailingContent ? (
+              <div key={fieldPath} className="mt-3">
+                {trailingContent}
+              </div>
+            ) : null
+          })}
         </React.Fragment>
       ))}
     </>
@@ -657,6 +683,8 @@ export const DynamicConfigForm: React.FC<DynamicConfigFormProps> = ({
                 sectionKey={key}
                 sectionTitle={sectionTitle}
                 leadingContent={sectionLeadingContent?.[nestedFieldPath]}
+                trailingContent={sectionTrailingContent?.[nestedFieldPath]}
+                fieldTrailingContent={fieldTrailingContent}
               />
             )
           }
```

**File**: `dashboard/src/index.css` (modified, +4/-1)
```diff
@@ -250,11 +250,14 @@
 /* JetBrains Mono 字体 - 用于代码编辑器 */
 @keyframes config-tab-enter {
   from {
+    max-width: 0;
+    padding-inline: 0;
     opacity: 0;
-    transform: translateX(-0.5rem);
+    transform: translateX(-0.75rem);
   }
 
   to {
+    max-width: 16rem;
     opacity: 1;
     transform: translateX(0);
   }
```

**File**: `dashboard/src/routes/config/bot.tsx` (modified, +87/-65)
```diff
@@ -1,11 +1,9 @@
 import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
-import { Link, useRouterState } from '@tanstack/react-router'
+import { useRouterState } from '@tanstack/react-router'
 import {
   Check,
-  ChevronLeft,
   ChevronRight,
   Code2,
-  ExternalLink,
   Info,
   MoreHorizontal,
   RefreshCw,
@@ -82,6 +80,7 @@ import {
   useAutoSave,
 } from './bot/hooks'
 import { CommandPermissions } from './bot/CommandPermissions'
+import { GlobalLearningSettings } from './bot/GlobalLearningSettings'
 
 type ConfigSectionData = Record<string, unknown>
 type BotSettingsMode = 'groups' | 'detail' | 'commands' | 'source'
@@ -141,7 +140,7 @@ function buildTabGroupsFromSchema(schema: ConfigSchema): TabGroup[] {
       hosts.set(fieldName, {
         id: fieldName,
         label: fieldSchema.uiLabel,
-        advanced: Boolean(fieldSchema.uiAdvanced),
+        advanced: fieldName === 'visual' || fieldName === 'expression' || Boolean(fieldSchema.uiAdvanced),
         order: fieldSchema.uiOrder ?? Number.POSITIVE_INFINITY,
         sections: [fieldName],
       })
@@ -854,6 +853,25 @@ interface DynamicConfigTabsProps {
   searchFieldPath: string
 }
 
+function ConfigTabsExpandButton({ expanded, onClick }: { expanded: boolean; onClick: () => void }) {
+  return (
+    <button
+      type="button"
+      className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center self-center border-0 bg-transparent p-0 text-foreground transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
+      aria-label={expanded ? '收起设置栏目' : '展开更多设置栏目'}
+      aria-expanded={expanded}
+      title={expanded ? '收起设置栏目' : '展开更多设置栏目'}
+      onClick={onClick}
+    >
+      <ChevronRight
+        aria-hidden="true"
+        strokeWidth={3.5}
+        className={cn('h-6 w-6 motion-safe:transition-transform motion-safe:duration-300', expanded && 'rotate-180')}
+      />
+    </button>
+  )
+}
+
 function DynamicConfigTabs(props: DynamicConfigTabsProps) {
   const {
     configSchema,
@@ -950,7 +968,6 @@ function DynamicConfigTabs(props: DynamicConfigTabsProps) {
   const expandedTabGroups = tabGroups.filter((tab) => tab.advanced)
   const visibleTabGroups = expanded ? [...defaultTabGroups, ...expandedTabGroups] : defaultTabGroups
   const hasCollapsibleTabs = tabGroups.some((tab) => tab.advanced)
-  const firstExpandedTabId = visibleTabGroups.find((tab) => tab.advanced)?.id
 
   const toggleExpanded = () => {
     setExpanded((current) => {
@@ -994,35 +1011,86 @@ function DynamicConfigTabs(props: DynamicConfigTabsProps) {
   }
 
   const identityFieldNames = new Set(['nickname', 'alias_names'])
+  const basicChatPromptFieldNames = new Set(['group_chat_prompt', 'private_chat_prompts'])
   const botSchema = configSchema.nested.bot
+  const replyStyleSchema = configSchema.nested.chat?.nested?.reply_style
   const identitySchema: ConfigSchema | null = botSchema ? {
     ...botSchema,
     fields: botSchema.fields
       .filter((field) => identityFieldNames.has(field.name))
+      .map((field) => ({ ...field, advanced: false, 'x-row': 'bot-identity' })),
+    nested: {},
+  } : null
+  const basicChatPromptSchema: ConfigSchema | null = replyStyleSchema ? {
+    ...replyStyleSchema,
+    fields: replyStyleSchema.fields
+      .filter((field) => basicChatPromptFieldNames.has(field.name))
       .map((field) => ({ ...field, advanced: false })),
     nested: {},
   } : null
   const sectionLeadingContent = identitySchema ? {
     personality: (
+      <div className="space-y-3">
+        {identitySchema && (
+          <DynamicConfigForm
+            schema={identitySchema}
+            values={sectionValues.bot ?? {}}
+            onChange={(field, value) => updateSectionValueByPath('bot', [field], value)}
+            basePath="bot"
+            hooks={fieldHooks}
+            advancedVisible={advancedVisible}
+          />
+        )}
+      </div>
+    ),
+  } : undefined
+  const sectionTrailingContent = {
+    personality: (
+      <GlobalLearningSettings
+        values={sectionValues}
+        sections={(['expression', 'jargon'] as const).filter((section) => configSchema.nested?.[section])}
+        onChange={(section, rules) => updateSectionValueByPath(section, ['learning_list'], rules)}
+      />
+    ),
+  }
+  const fieldTrailingContent = basicChatPromptSchema ? {
+    'personality.reply_style': (
       <DynamicConfigForm
-        schema={identitySchema}
-        values={sectionValues.bot ?? {}}
-        onChange={(field, value) => updateSectionValueByPath('bot', [field], value)}
-        basePath="bot"
+        schema={basicChatPromptSchema}
+        values={(sectionValues.chat?.reply_style as ConfigSectionData) ?? {}}
+        onChange={(field, value) => updateSectionValueByPath('chat', ['reply_style', field], value)}
+        basePath="chat.reply_style"
         hooks={fieldHooks}
  
```

**File**: `dashboard/src/routes/config/bot/GlobalLearningSettings.tsx` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+import { Label } from '@/components/ui/label'
+import { Switch } from '@/components/ui/switch'
+
+interface LearningRule extends Record<string, unknown> {
+  platform: string
+  item_id: string
+  type: 'group' | 'private'
+  use: boolean
+  learn: boolean
+}
+
+interface GlobalLearningSettingsProps {
+  values: Record<string, Record<string, unknown> | null>
+  sections: Array<'expression' | 'jargon'>
+  onChange: (section: 'expression' | 'jargon', rules: LearningRule[]) => void
+}
+
+export function GlobalLearningSettings({ values, sections, onChange }: GlobalLearningSettingsProps) {
+  return (
+    <div className="space-y-3">
+      {sections.map((section) => {
+        const value = values[section]?.learning_list
+        const rules = Array.isArray(value) ? value as LearningRule[] : []
+        // 与后端一致：平台和目标均为空的第一条规则是全局默认，不区分聊天类型。
+        const globalIndex = rules.findIndex((rule) => !rule.platform.trim() && !rule.item_id.trim())
+        const globalRule = globalIndex >= 0 ? rules[globalIndex] : {
+          platform: '', item_id: '', type: 'group' as const, use: true, learn: true,
+        }
+        const label = section === 'expression' ? '表达' : '黑话'
+
+        const updateFlag = (field: 'use' | 'learn', checked: boolean) => {
+          const nextRule = { ...globalRule, [field]: checked }
+          onChange(section, globalIndex >= 0
+            ? rules.map((rule, index) => index === globalIndex ? nextRule : rule)
+            : [nextRule, ...rules])
+        }
+
+        return (
+          <div key={section} className="grid grid-cols-2 gap-x-6 gap-y-2">
+            {(['use', 'learn'] as const).map((field) => {
+              const id = `${section}-global-${field}`
+              return (
+                <div key={field} className="flex items-center justify-between gap-3">
+                  <Label htmlFor={id}>{field === 'use' ? '使用' : '学习'}{label}</Label>
+                  <Switch
+                    id={id}
+                    checked={globalRule[field]}
+                    onCheckedChange={(checked) => updateFlag(field, checked)}
+                  />
+                </div>
+              )
+            })}
+          </div>
+        )
+      })}
+    </div>
+  )
+}
```

**File**: `dashboard/src/routes/config/bot/hooks/complexFieldHooks.tsx` (modified, +32/-2)
```diff
@@ -2608,6 +2608,7 @@ const ManualAccountCard = ({
 
 interface StringListHookOptions {
   addLabel: string
+  borderless?: boolean
   emptyText: string
   label: string
   multiline?: boolean
@@ -2657,10 +2658,11 @@ function createStringListHook(options: StringListHookOptions): FieldHookComponen
             {items.map((item, itemIndex) => (
               <div
                 key={itemIndex}
-                className="grid gap-2 rounded-md border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_2.5rem]"
+                className={`grid gap-2 sm:grid-cols-[minmax(0,1fr)_2.5rem]${options.borderless ? '' : ' rounded-md border bg-muted/20 p-3'}`}
               >
                 <InputComponent
                   value={item}
+                  aria-label={`${options.label} ${itemIndex + 1}`}
                   placeholder={options.placeholder}
                   onChange={(event) => updateItem(itemIndex, event.target.value)}
                   {...(options.multiline ? { rows: 2 } : {})}
@@ -2685,13 +2687,41 @@ function createStringListHook(options: StringListHookOptions): FieldHookComponen
   }
 }
 
-export const AliasNamesHook = createStringListHook({
+const AliasNamesEditor = createStringListHook({
   addLabel: '添加别名',
+  borderless: true,
   emptyText: '暂无别名。',
   label: '别名',
   placeholder: '小麦',
 })
 
+export const AliasNamesHook: FieldHookComponent = (props) => {
+  const aliasCount = Array.isArray(props.value) ? props.value.length : 0
+
+  return (
+    <div className="space-y-1.5">
+      <Label className={fieldTitleClassName(props.schema, 'block text-[15px] leading-6')}>
+        别名
+      </Label>
+      <Popover>
+        <PopoverTrigger asChild>
+          <Button type="button" variant="outline" className="flex w-full items-center gap-2">
+            {aliasCount > 0 ? `${aliasCount} 个别名` : '添加别名'}
+            <ChevronDown className="h-4 w-4 shrink-0" />
+          </Button>
+        </PopoverTrigger>
+        <PopoverContent
+          align="end"
+          className="max-h-[min(24rem,var(--radix-popover-content-available-height))] w-96 max-w-[calc(100vw-2rem)] overflow-y-auto"
+          aria-label="别名列表"
+        >
+          <AliasNamesEditor {...props} />
+        </PopoverContent>
+      </Popover>
+    </div>
+  )
+}
+
 export const MultipleReplyStyleHook = createStringListHook({
   addLabel: '添加表达风格',
   emptyText: '暂无备用表达风格。',
```

**File**: `dashboard/src/routes/resource/__tests__/knowledge-base.test.tsx` (modified, +1/-28)
```diff
@@ -253,8 +253,6 @@ async function openInspectionMode(
   await user.click(await screen.findByRole('tab', { name: mode }))
 }
 
-const QUICK_START_KEY = 'memory-quick-start-dismissed'
-
 function runtimeConfig(
   overrides: Partial<memoryApi.MemoryRuntimeConfigPayload> = {},
 ): memoryApi.MemoryRuntimeConfigPayload {
@@ -2183,10 +2181,6 @@ describe('KnowledgeBasePage import workflow', () => {
   }, 20_000)
 
   describe('页面壳', () => {
-    afterEach(() => {
-      window.localStorage.removeItem(QUICK_START_KEY)
-    })
-
     it('reads deep links for records feedback import and legacy tuning', async () => {
       window.history.replaceState(null, '', '/resource/knowledge-base?tab=records')
       const recordsView = renderPage()
@@ -2443,40 +2437,19 @@ describe('KnowledgeBasePage import workflow', () => {
       encodedView.unmount()
     }, 20_000)
 
-    it('dismisses quick start and jumps to import tuning and graph', async () => {
+    it('opens graph from the more actions menu', async () => {
       const user = userEvent.setup()
       renderPage()
       await waitForConsoleReady()
-      expect(screen.getByText('快速开始：先从这两件事入手')).toBeInTheDocument()
-
-      await user.click(screen.getByRole('button', { name: /导入或导出资料/ }))
-      expect(screen.getByRole('tab', { name: '导入导出' })).toHaveAttribute('data-state', 'active')
-      expect(window.location.search).toContain('tab=import')
-
-      await user.click(screen.getByRole('button', { name: /检索调优/ }))
-      expect(screen.getByRole('tab', { name: '记忆检修' })).toHaveAttribute('data-state', 'active')
-      expect(screen.getByRole('tab', { name: '检索调优' })).toHaveAttribute('data-state', 'active')
-      expect(window.location.search).toContain('mode=tuning')
 
       // 图谱入口在右上角省略号，与查看记忆状态并列；标签栏里不再有图谱
       expect(screen.queryByRole('tab', { name: '图谱' })).not.toBeInTheDocument()
       expect(screen.queryByRole('button', { name: /打开图谱/ })).not.toBeInTheDocument()
       await user.click(screen.getByRole('button', { name: '更多操作' }))
       await user.click(await screen.findByRole('menuitem', { name: '打开图谱' }))
       expect(window.location.search).toContain('tab=graph')
-
-      await user.click(screen.getByRole('button', { name: '关闭快速开始' }))
-      expect(screen.queryByText('快速开始：先从这两件事入手')).not.toBeInTheDocument()
-      expect(window.localStorage.getItem(QUICK_START_KEY)).toBe('true')
     }, 20_000)
 
-    it('hides quick start after it was dismissed', async () => {
-      window.localStorage.setItem(QUICK_START_KEY, 'true')
-      renderPage()
-      await waitForConsoleReady()
-      expect(screen.queryByText('快速开始：先从这两件事入手')).not.toBeInTheDocument()
-    })
-
     it('refreshes runtime data and runs self-check from the status dialog', async () => {
       const user = userEvent.setup()
       renderPage()
```

**File**: `dashboard/src/routes/resource/expression/ExpressionDialogs.tsx` (modified, +1/-1)
```diff
@@ -646,7 +646,7 @@ export function ExpressionEditDialog({
                   </p>
                   <p>• 已人工精选：表示该表达方式已由人工确认可使用</p>
                   <p className="text-muted-foreground mt-2">
-                    根据配置中“使用精选表达”设置：
+                    根据配置中“仅使用精选表达”设置：
                     <br />
                     • 开启时：只有人工精选的项目会被使用
                     <br />• 关闭时：未精选的项目也会被使用
```

---

### Incident Patch 12: `ca1a6e16` (2026-10-02)
**Commit Message**: fix: 头像获取异常

**File**: `changelogs/changelog.md` (modified, +1/-0)
```diff
@@ -16,6 +16,7 @@
 
 - 适配器黑白名单面板在群号后显示群头像和已知群名称。
 - 新增适配器与 SDK 的独立用户/群头像查询接口，WebUI 统一使用头像服务；支持无头像平台、缓存过期刷新与强制刷新，修复 QQ 头像长期停留在旧缓存的问题。
+- 修复旧发送驱动遮蔽账号级适配器头像接口，导致 WebUI 用户和群头像被误判为不支持的问题。
 - 命令管理页支持按命令启用/停用，停用的命令文本按普通消息处理；内置 /clear 的启用开关随之移到命令管理，调试设置中的「启用 /clear 指令」选项移除。
 - 新增「不显示无权限提示」选项，开启后用户执行无权限命令不再收到提示消息，仅静默拦截并记录日志。
 - 优化丰富性回复的表情包发送逻辑。
```

**File**: `pytests/platform_io/test_avatar_provider.py` (modified, +24/-1)
```diff
@@ -4,7 +4,8 @@
 
 import pytest
 
-from src.platform_io import PlatformIOManager, RouteBinding
+from src.platform_io import PlatformIOManager, RouteBinding, RouteKey
+from src.platform_io.drivers.legacy_driver import LegacyPlatformDriver
 from src.platform_io.drivers.plugin_driver import PluginPlatformDriver
 from src.plugin_runtime import avatar_provider
 from src.plugin_runtime.host.api_registry import APIRegistry
@@ -85,3 +86,25 @@ async def test_provider_failure_is_not_reported_as_absent(provider):
     provider[2].return_value = SimpleNamespace(error={"message": "connection failed"}, payload={})
     with pytest.raises(RuntimeError, match="connection failed"):
         await avatar_provider.query_adapter_avatar("custom", "person", "user", account_id="1")
+
+
+@pytest.mark.asyncio
+async def test_legacy_send_driver_does_not_hide_account_scoped_avatar_provider(provider):
+    broker = provider[0]
+    add_adapter(provider, "adapter", "1")
+    legacy = LegacyPlatformDriver(driver_id="legacy.send.custom", platform="custom", account_id="1")
+    broker.register_driver(legacy)
+    # 模拟实际启用的旧发送链：平台级查询命中 legacy，插件只绑定账号级路由。
+    broker._legacy_send_drivers["custom"] = legacy
+    assert broker.resolve_drivers(RouteKey(platform="custom")) == [legacy]
+    result = await avatar_provider.query_adapter_avatar("custom", "person", "user")
+    assert result["status"] == "available"
+    assert provider[2].await_args.kwargs["plugin_id"] == "adapter"
+
+    # legacy 存在时也不能绕过多适配器归属检查。
+    add_adapter(provider, "second", "2")
+    with pytest.raises(ValueError, match="多个适配器"):
+        await avatar_provider.query_adapter_avatar("custom", "person", "user")
+    result = await avatar_provider.query_adapter_avatar("custom", "person", "user", account_id="2")
+    assert result["status"] == "available"
+    assert provider[2].await_args.kwargs["plugin_id"] == "second"
```

**File**: `src/plugin_runtime/avatar_provider.py` (modified, +4/-2)
```diff
@@ -20,13 +20,15 @@ async def query_adapter_avatar(
 
     broker = get_platform_io_manager()
     route = RouteKey(platform=platform, account_id=account_id, scope=scope)
-    drivers = broker.resolve_drivers(route)
+    # legacy/local 发送驱动没有插件 API，不能让它们遮蔽账号级头像提供方。
+    drivers = [driver for driver in broker.resolve_drivers(route) if driver.descriptor.plugin_id]
     if not drivers:
         # 无平台级发送绑定时，仍允许仅接收的适配器提供头像。
         drivers = [
             driver
             for driver in broker.driver_registry.list(platform=platform)
-            if (not account_id or driver.descriptor.account_id == account_id)
+            if driver.descriptor.plugin_id
+            and (not account_id or driver.descriptor.account_id == account_id)
             and (not scope or driver.descriptor.scope == scope)
         ]
         plugin_ids = {driver.descriptor.plugin_id for driver in drivers if driver.descriptor.plugin_id}
```

---

### Incident Patch 13: `407b5334` (2026-10-02)
**Commit Message**: fix: 修复 WebUI 检查失败并同步现有界面测试

**File**: `changelogs/changelog.md` (modified, +2/-0)
```diff
@@ -8,6 +8,8 @@
 
 ## 主程序
 
+- 修复 WebUI 检查中的过时界面断言与缺失 API mock，补全登录输入框的可访问标签，并对齐聊天页面的工作区切换目标。
+
 - WebUI 昵称和别名统一展示在人格设置顶部，保留原有配置结构。
 
 - WebUI 已发现账号和备用平台账号移至适配器设置页，支持折叠查看、单独保存备用账号；已发现账号支持直接删除记录，适配器再次上报时重新发现。
```

**File**: `dashboard/src/__tests__/router.test.tsx` (modified, +3/-6)
```diff
@@ -1,4 +1,4 @@
-import { isRedirect } from '@tanstack/react-router'
+import { isRedirect, Outlet } from '@tanstack/react-router'
 import { cleanup, render, screen } from '@testing-library/react'
 import { isValidElement, type ReactElement, type ReactNode } from 'react'
 import { afterEach, describe, expect, it, vi } from 'vitest'
@@ -286,11 +286,8 @@ describe('router 路由表', () => {
     }
   })
 
-  it('根组件在 DEV 下返回带 Outlet 的有效元素', () => {
-    const RootComponent = router.routeTree.options.component as (() => ReactNode) | undefined
-    expect(typeof RootComponent).toBe('function')
-    const element = RootComponent!()
-    expect(isValidElement(element)).toBe(true)
+  it('根组件直接使用 Outlet，兼容 React memo 组件', () => {
+    expect(router.routeTree.options.component).toBe(Outlet)
   })
 
   it('protected 布局组件返回包了 Layout 的有效元素', () => {
```

**File**: `dashboard/src/components/layout/Header.test.tsx` (modified, +55/-49)
```diff
@@ -2,6 +2,7 @@ import type {
   AnchorHTMLAttributes,
   HTMLAttributes,
   MouseEvent as ReactMouseEvent,
+  ReactElement,
   ReactNode,
 } from 'react'
 
@@ -152,7 +153,7 @@ vi.mock('@/components/ui/dropdown-menu', () => ({
 }))
 
 vi.mock('@/components/ui/tabs', async () => {
-  const { forwardRef } = await import('react')
+  const { cloneElement, forwardRef } = await import('react')
   const TabsList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>((props, ref) => (
     <div ref={ref} {...props} />
   ))
@@ -166,11 +167,16 @@ vi.mock('@/components/ui/tabs', async () => {
       children,
       value,
       ...props
-    }: HTMLAttributes<HTMLDivElement> & { asChild?: boolean; value?: string }) => (
-      <div data-workspace-tab={value} {...props}>
-        {children}
-      </div>
-    ),
+    }: HTMLAttributes<HTMLDivElement> & { asChild?: boolean; value?: string }) =>
+      asChild ? (
+        cloneElement(children as ReactElement<Record<string, unknown>>, {
+          ...props,
+          role: 'tab',
+          'data-workspace-tab': value,
+        })
+      ) : (
+        <div role="tab" data-workspace-tab={value} {...props}>{children}</div>
+      ),
   }
 })
 
@@ -256,7 +262,7 @@ describe('Header', () => {
     fireEvent.click(screen.getAllByRole('button', { name: 'header.switchToLight' })[0])
     fireEvent.click(screen.getAllByRole('button', { name: 'English' })[0])
     fireEvent.click(screen.getByRole('button', { name: 'header.logout' }))
-    fireEvent.click(screen.getByRole('link', { name: 'workspace.chat' }))
+    fireEvent.click(screen.getByRole('tab', { name: 'workspace.logs' }))
 
     expect(props.onMobileMenuToggle).toHaveBeenCalledOnce()
     expect(props.onSidebarToggle).toHaveBeenCalledOnce()
@@ -266,7 +272,7 @@ describe('Header', () => {
     expect(mocks.toggleTheme).toHaveBeenCalledWith('light', props.onThemeChange, expect.anything())
     expect(mocks.changeLanguage).toHaveBeenCalledWith('en')
     expect(mocks.logout).toHaveBeenCalledOnce()
-    expect(props.onWorkspaceNavigate).toHaveBeenCalledWith('/chat')
+    expect(props.onWorkspaceNavigate).toHaveBeenCalledWith('/logs')
   })
 
   it('悬浮模式不显示顶栏侧栏按钮，并尊重页面背景继承', () => {
@@ -384,9 +390,9 @@ describe('Header', () => {
     const props = makeProps({ workspaceMode: 'settings' })
     render(<Header {...props} />)
 
-    fireEvent.click(screen.getByRole('link', { name: 'workspace.settings' }))
-    fireEvent.click(screen.getByRole('link', { name: 'workspace.chat' }), { metaKey: true })
-    fireEvent.click(screen.getByRole('link', { name: 'workspace.logs' }), { button: 1 })
+    fireEvent.click(screen.getByRole('tab', { name: 'workspace.settings' }))
+    fireEvent.click(screen.getByRole('tab', { name: 'workspace.logs' }), { metaKey: true })
+    fireEvent.click(screen.getByRole('tab', { name: 'workspace.logs' }), { button: 1 })
     expect(props.onWorkspaceNavigate).not.toHaveBeenCalled()
   })
 
@@ -396,43 +402,43 @@ describe('Header', () => {
     const props = makeProps({ workspaceMode: 'settings' })
     const { rerender, unmount } = render(<Header {...props} />)
 
-    const chatLink = screen.getByRole('link', { name: 'workspace.chat' })
-    const logsLink = screen.getByRole('link', { name: 'workspace.logs' })
+    const logsTab = screen.getByRole('tab', { name: 'workspace.logs' })
+    const settingsTab = screen.getByRole('tab', { name: 'workspace.settings' })
     const settingsLink = screen.getByRole('link', { name: 'sidebar.menu.settings' })
     const tabs = document.querySelector('[data-dashboard-workspace-tabs="true"]') as HTMLElement
 
     expect(settingsLink.querySelector('[data-layout-id="topbar-selection-pill"]')).toBeInTheDocument()
 
-    fireEvent.pointerEnter(chatLink)
-    expect(chatLink.querySelector('[data-layout-id="topbar-selection-pill"]')).toBeInTheDocument()
+    fireEvent.pointerEnter(logsTab)
+    expect(logsTab.querySelector('[data-layout-id="topbar-selection-pill"]')).toBeInTheDocument()
     expect(settingsLink.querySelector('[data-layout-id="topbar-selection-pill"]')).not.toBeInTheDocument()
 
     fireEvent.pointerLeave(tabs)
     act(() => {
       vi.advanceTimersByTime(599)
     })
-    expect(chatLink.querySelector('[data-layout-id="topbar-selection-pill"]')).toBeInTheDocument()
+    expect(logsTab.querySelector('[data-layout-id="topbar-selection-pill"]')).toBeInTheDocument()
     act(() => {
       vi.advanceTimersByTime(1)
     })
     expect(settingsLink.querySelector('[data-layout-id="topbar-selection-pill"]')).toBeInTheDocument()
 
-    fireEvent.pointerEnter(chatLink)
-    fireEvent.click(chatLink)
-    expect(props.onWorkspaceNavigate).toHaveBeenCalledWith('/chat')
-    fireEvent.pointerEnter(logsLink)
-    expect(chatLink.querySelector('[data-layout-id="topbar-selection-pill"]')).toBeInTheDocument()
-    expect(logsLink.querySelector('[data-layout-id="topbar-selection-pill"]')).not.toBeInTheDocument()
+    fireEvent.pointerEnter(logsTab)
+    fireEvent.click(
```

**File**: `dashboard/src/components/layout/Layout.test.tsx` (modified, +12/-12)
```diff
@@ -258,14 +258,14 @@ describe('Layout 工作区切换', () => {
     // 冲刷 UpdateNoticeDialog 的 lazy import，避免首个用例在 act 外完成挂起
     await flushMicrotasks()
 
-    fireEvent.click(screen.getByRole('button', { name: '切换到麦麦聊天' }))
+    fireEvent.click(screen.getByRole('button', { name: '切换到日志' }))
     act(() => {
       vi.advanceTimersByTime(280 + 180)
     })
-    expect(routerMocks.navigate).toHaveBeenCalledWith({ to: '/chat' })
+    expect(routerMocks.navigate).toHaveBeenCalledWith({ to: '/logs' })
 
     // 模拟 pathname 已切换，但 Outlet 仍短暂保留旧首页的并发提交窗口。
-    routerMocks.pathname = '/chat'
+    routerMocks.pathname = '/logs'
     routerMocks.status = 'pending'
     view.rerender(
       <Layout>
@@ -281,7 +281,7 @@ describe('Layout 工作区切换', () => {
     routerMocks.status = 'idle'
     view.rerender(
       <Layout>
-        <div>聊天内容</div>
+        <div>日志内容</div>
       </Layout>
     )
     act(() => {
@@ -290,7 +290,7 @@ describe('Layout 工作区切换', () => {
 
     expect(workspaceContent).not.toHaveClass('invisible')
     expect(screen.queryByText('首页内容')).not.toBeInTheDocument()
-    expect(screen.getByText('聊天内容')).toBeInTheDocument()
+    expect(screen.getByText('日志内容')).toBeInTheDocument()
   })
 
   it('侧栏宽度使用 CSS 过渡且不启用会拉伸内容的 FLIP 尺寸缩放', () => {
@@ -349,15 +349,15 @@ describe('Layout 工作区切换', () => {
   })
 
   it('非设置工作区切走时跳过侧栏退场，导航失败后恢复可交互', async () => {
-    routerMocks.pathname = '/chat'
+    routerMocks.pathname = '/logs'
     routerMocks.navigate.mockImplementation(() => Promise.reject(new Error('导航失败')))
     const { container } = render(
       <Layout>
         <div>聊天内容</div>
       </Layout>
     )
 
-    fireEvent.click(screen.getByRole('button', { name: '切换到日志' }))
+    fireEvent.click(screen.getByRole('button', { name: '切换到设置' }))
     act(() => {
       vi.advanceTimersByTime(279)
     })
@@ -366,11 +366,11 @@ describe('Layout 工作区切换', () => {
     act(() => {
       vi.advanceTimersByTime(1)
     })
-    expect(routerMocks.navigate).toHaveBeenCalledWith({ to: '/logs' })
+    expect(routerMocks.navigate).toHaveBeenCalledWith({ to: '/' })
     await flushMicrotasks()
 
     expect(getWorkspaceContent(container)).not.toHaveClass('invisible')
-    expect(getHeader()).toHaveAttribute('data-workspace-mode', 'chat')
+    expect(getHeader()).toHaveAttribute('data-workspace-mode', 'logs')
   })
 
   it('切回设置工作区时等路由空闲后再侧栏入场', () => {
@@ -613,7 +613,7 @@ describe('Layout 壳层、快捷键与公告入口', () => {
   })
 
   it.each([
-    ['/chat', 'chat', false],
+    ['/chat', 'settings', false],
     ['/logs', 'logs', false],
     ['/statistics', 'logs', false],
     ['/reasoning-process/detail', 'logs', false],
@@ -654,7 +654,7 @@ describe('Layout 壳层、快捷键与公告入口', () => {
     expect(getMain()).toHaveClass('bg-transparent')
   })
 
-  it('聊天工作区主区透明且不滚动，system 主题跟随 matchMedia', () => {
+  it('聊天页面保留设置工作区布局，system 主题跟随 matchMedia', () => {
     routerMocks.pathname = '/chat'
     layoutMocks.theme = 'system'
     vi.spyOn(window, 'matchMedia').mockImplementation(
@@ -676,7 +676,7 @@ describe('Layout 壳层、快捷键与公告入口', () => {
         <div>聊天内容</div>
       </Layout>
     )
-    expect(getMain()).toHaveClass('bg-transparent', 'overflow-hidden')
+    expect(getMain()).toHaveClass('bg-background', 'overflow-y-auto')
     expect(getHeader()).toHaveAttribute('data-actual-theme', 'dark')
   })
 
```

**File**: `dashboard/src/components/layout/Layout.tsx` (modified, +1/-1)
```diff
@@ -227,7 +227,7 @@ export function Layout({ children }: LayoutProps) {
 
     setMobileMenuOpen(false)
     setSkipSidebarResizeAnimation(false)
-    setWorkspaceTransitionTarget(to === '/chat' ? 'chat' : to === '/logs' ? 'logs' : 'settings')
+    setWorkspaceTransitionTarget(to === '/logs' ? 'logs' : 'settings')
 
     const enterWorkspace = () => {
       void router.navigate({ to }).catch(() => {
```

**File**: `dashboard/src/components/layout/constants.test.ts` (modified, +6/-2)
```diff
@@ -33,9 +33,13 @@ describe('menuSections 菜单结构', () => {
     }
   })
 
-  it('所有菜单项 label 均为 sidebar.menu 命名空间的 i18n key', () => {
+  it('菜单项使用侧栏文案，聊天入口复用工作区文案', () => {
     for (const item of allItems) {
-      expect(item.label).toMatch(/^sidebar\.menu\./)
+      if (item.path === '/chat') {
+        expect(item.label).toBe('workspace.chat')
+      } else {
+        expect(item.label).toMatch(/^sidebar\.menu\./)
+      }
     }
   })
 
```

**File**: `dashboard/src/routes/__tests__/plugin-config.test.tsx` (modified, +3/-2)
```diff
@@ -149,6 +149,7 @@ vi.mock('@/components/plugin-stats', () => ({
 }))
 vi.mock('@/lib/chat-management-api', () => ({
   CHAT_ADAPTER_STATUS_QUERY_KEY: 'chat-adapter-status',
+  getAllChatStreams: async () => [],
   getAdapterHostPolicy: vi.fn(),
   getAdapterPolicyDefaults: vi.fn(),
   updateAdapterHostPolicy: vi.fn(),
@@ -768,8 +769,8 @@ describe('PluginConfigPage 主程序放行规则', () => {
     expect(await screen.findByText('群聊规则')).toBeInTheDocument()
     expect(screen.queryByText('这是 MaiBot 主程序侧规则，与适配器自身名单相互独立。')).not.toBeInTheDocument()
     expect(screen.queryByText(/适配器自身的白名单仍在/)).not.toBeInTheDocument()
-    expect(screen.getByText('全局默认：接收所有消息')).toBeInTheDocument()
-    expect(screen.getByText('全局默认：默认不接收消息')).toBeInTheDocument()
+    expect(screen.getByTestId('mode-hint:group')).toHaveTextContent('黑名单模式')
+    expect(screen.getByTestId('mode-hint:private')).toHaveTextContent('白名单模式')
     expect(screen.queryByRole('button', { name: /保存主程序规则/ })).not.toBeInTheDocument()
     expect(screen.queryByRole('button', { name: /源代码/ })).not.toBeInTheDocument()
     expect(screen.queryByRole('button', { name: /重置/ })).not.toBeInTheDocument()
```

**File**: `dashboard/src/routes/auth.tsx` (modified, +1/-0)
```diff
@@ -310,6 +310,7 @@ export function AuthPage() {
                 <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={2} fill="none" />
                 <Input
                   id="token"
+                  aria-label="Access Token"
                   type="password"
                   placeholder={t('auth.tokenPlaceholder')}
                   value={token}
```

---

### Incident Patch 14: `ca050625` (2026-10-02)
**Commit Message**: feat: 整理 WebUI 身份与平台账号设置并支持删除发现账号

**File**: `changelogs/changelog.md` (modified, +4/-0)
```diff
@@ -8,6 +8,10 @@
 
 ## 主程序
 
+- WebUI 昵称和别名统一展示在人格设置顶部，保留原有配置结构。
+
+- WebUI 已发现账号和备用平台账号移至适配器设置页，支持折叠查看、单独保存备用账号；已发现账号支持直接删除记录，适配器再次上报时重新发现。
+
 - 适配器黑白名单面板在群号后显示群头像和已知群名称。
 - 新增适配器与 SDK 的独立用户/群头像查询接口，WebUI 统一使用头像服务；支持无头像平台、缓存过期刷新与强制刷新，修复 QQ 头像长期停留在旧缓存的问题。
 - 命令管理页支持按命令启用/停用，停用的命令文本按普通消息处理；内置 /clear 的启用开关随之移到命令管理，调试设置中的「启用 /clear 指令」选项移除。
```

**File**: `dashboard/src/components/dynamic-form/DynamicConfigForm.tsx` (modified, +7/-0)
```diff
@@ -27,6 +27,8 @@ export interface DynamicConfigFormProps {
   level?: number
   advancedVisible?: boolean
   sectionColumns?: 1 | 2
+  /** 按完整配置路径，为顶层配置节添加前置内容。 */
+  sectionLeadingContent?: Record<string, React.ReactNode>
 }
 
 function buildFieldPath(basePath: string, fieldName: string) {
@@ -104,6 +106,7 @@ function PromptGeneratorEntryCard() {
 }
 
 function DynamicConfigSection({
+  leadingContent,
   advancedVisible,
   basePath,
   children,
@@ -126,6 +129,7 @@ function DynamicConfigSection({
   level: number
   nestedSchema: ConfigSchema
   onChange: (field: string, value: unknown) => void
+  leadingContent?: React.ReactNode
   sectionKey: string
   sectionTitle: string
   values: Record<string, unknown>
@@ -168,6 +172,7 @@ function DynamicConfigSection({
         <CardContent id={contentId} className="pt-3">
           {children ?? (
             <div className="space-y-3">
+              {leadingContent}
               <DynamicConfigForm
                 schema={nestedSchema}
                 values={values}
@@ -284,6 +289,7 @@ export const DynamicConfigForm: React.FC<DynamicConfigFormProps> = ({
   level = 0,
   advancedVisible,
   sectionColumns = 1,
+  sectionLeadingContent,
 }) => {
   const resolvedAdvancedVisible = advancedVisible ?? false
 
@@ -650,6 +656,7 @@ export const DynamicConfigForm: React.FC<DynamicConfigFormProps> = ({
                 level={level + 1}
                 sectionKey={key}
                 sectionTitle={sectionTitle}
+                leadingContent={sectionLeadingContent?.[nestedFieldPath]}
               />
             )
           }
```

**File**: `dashboard/src/lib/bot-accounts-api.ts` (modified, +8/-0)
```diff
@@ -46,3 +46,11 @@ export async function setDiscoveredBotAccountDisabled(
   )
   return response.data
 }
+
+
+export async function deleteDiscoveredBotAccount(accountId: number): Promise<void> {
+  await backendApi.delete(`${API_BASE}/${accountId}`, {
+    parse: 'response',
+    errorMessage: '删除适配器账号失败',
+  })
+}
```

**File**: `dashboard/src/routes/config/__tests__/bot.test.tsx` (modified, +1/-1)
```diff
@@ -227,7 +227,7 @@ function createDeferred<T>() {
 
 /** 页面挂载时应注册的字段 hook 路径与类型（replace 为缺省） */
 const EXPECTED_FIELD_HOOKS: Array<[string, 'replace' | 'wrapper' | 'hidden']> = [
-  ['bot.platform', 'replace'],
+  ['bot.platform', 'hidden'],
   ['bot.alias_names', 'replace'],
   ['bot.qq_account', 'hidden'],
   ['bot.platforms', 'hidden'],
```

**File**: `dashboard/src/routes/config/bot.tsx` (modified, +40/-3)
```diff
@@ -66,7 +66,6 @@ import {
   BehaviorGroupsHook,
   BehaviorFocusGroupsHook,
   BehaviorLearningListHook,
-  BotPlatformAccountsHook,
   ChatPromptsHook,
   ChatTalkValueRulesHook,
   ExpressionGroupsHook,
@@ -390,7 +389,7 @@ function BotConfigPageContent() {
 
   useEffect(() => {
     const hookEntries = [
-      ['bot.platform', BotPlatformAccountsHook, 'replace'],
+      ['bot.platform', HiddenFieldHook, 'hidden'],
       ['bot.alias_names', AliasNamesHook],
       ['bot.qq_account', HiddenFieldHook, 'hidden'],
       ['bot.platforms', HiddenFieldHook, 'hidden'],
@@ -994,6 +993,39 @@ function DynamicConfigTabs(props: DynamicConfigTabsProps) {
     setHasUnsavedChanges(true)
   }
 
+  const identityFieldNames = new Set(['nickname', 'alias_names'])
+  const botSchema = configSchema.nested.bot
+  const identitySchema: ConfigSchema | null = botSchema ? {
+    ...botSchema,
+    fields: botSchema.fields
+      .filter((field) => identityFieldNames.has(field.name))
+      .map((field) => ({ ...field, advanced: false })),
+    nested: {},
+  } : null
+  const sectionLeadingContent = identitySchema ? {
+    personality: (
+      <DynamicConfigForm
+        schema={identitySchema}
+        values={sectionValues.bot ?? {}}
+        onChange={(field, value) => updateSectionValueByPath('bot', [field], value)}
+        basePath="bot"
+        hooks={fieldHooks}
+        advancedVisible={advancedVisible}
+      />
+    ),
+  } : undefined
+
+  // 仅调整展示归属，昵称与别名仍通过原 bot 配置节读写。
+  const getDisplaySectionSchema = (sectionName: string, schema: ConfigSchema): ConfigSchema => {
+    if (sectionName === 'bot' && configSchema.nested?.personality) {
+      return { ...schema, fields: schema.fields.filter((field) => !identityFieldNames.has(field.name)) }
+    }
+    if (sectionName === 'personality') {
+      return { ...schema, uiLabel: '身份与人格' }
+    }
+    return schema
+  }
+
   const getSubtabLabel = (schema: ConfigSchema, fallback: string) => {
     return schema.uiSubLabel || schema.uiLabel || schema.classDoc || fallback
   }
@@ -1063,6 +1095,7 @@ function DynamicConfigTabs(props: DynamicConfigTabsProps) {
           hooks={fieldHooks}
           advancedVisible={advancedVisible}
           sectionColumns={2}
+          sectionLeadingContent={sectionLeadingContent}
         />
       )
     }
@@ -1263,7 +1296,10 @@ function DynamicConfigTabs(props: DynamicConfigTabsProps) {
 
   const renderTabContent = (tab: TabGroup) => {
     const tabNestedEntries = tab.sections
-      .map((sectionName) => [sectionName, configSchema.nested?.[sectionName]] as const)
+      .map((sectionName) => {
+        const schema = configSchema.nested?.[sectionName]
+        return [sectionName, schema ? getDisplaySectionSchema(sectionName, schema) : undefined] as const
+      })
       .filter((entry): entry is readonly [string, ConfigSchema] => Boolean(entry[1]))
 
     if (tabNestedEntries.length === 0) {
@@ -1300,6 +1336,7 @@ function DynamicConfigTabs(props: DynamicConfigTabsProps) {
         hooks={fieldHooks}
         advancedVisible={advancedVisible}
         sectionColumns={2}
+        sectionLeadingContent={sectionLeadingContent}
       />
     )
   }
```

**File**: `dashboard/src/routes/config/bot/hooks/__tests__/advancedTitle.test.tsx` (modified, +6/-23)
```diff
@@ -61,6 +61,7 @@ vi.mock('@/lib/chat-management-api', () => ({
 
 vi.mock('@/lib/bot-accounts-api', () => ({
   getDiscoveredBotAccounts: vi.fn(),
+  deleteDiscoveredBotAccount: vi.fn(),
   setDiscoveredBotAccountDisabled: vi.fn(),
 }))
 
@@ -253,20 +254,7 @@ describe('custom bot config hooks', () => {
         online: true,
       },
     ])
-    vi.mocked(botAccountsApi.setDiscoveredBotAccountDisabled).mockResolvedValue({
-      id: 1,
-      platform: 'qq',
-      account_id: 'bot-1',
-      disabled: true,
-      first_seen_at: '2026-08-08T08:00:00',
-      last_seen_at: '2026-08-08T09:00:00',
-      disabled_at: '2026-08-08T10:00:00',
-      last_source: 'ready',
-      last_adapter_id: 'adapter-1',
-      last_plugin_id: 'plugin-1',
-      last_gateway_name: 'gateway-1',
-      online: true,
-    })
+    vi.mocked(botAccountsApi.deleteDiscoveredBotAccount).mockResolvedValue(undefined)
     const onParentChange = vi.fn()
 
     render(
@@ -299,16 +287,11 @@ describe('custom bot config hooks', () => {
     expect(screen.queryByText(/禁用只影响/)).not.toBeInTheDocument()
     expect(screen.queryByText(/这些配置不会写入/)).not.toBeInTheDocument()
 
-    await userEvent.click(screen.getByRole('button', { name: '排除身份' }))
-    await waitFor(() => expect(botAccountsApi.setDiscoveredBotAccountDisabled).toHaveBeenCalledWith(1, true))
-    expect(await screen.findByRole('button', { name: '已排除账号 1' })).toHaveAttribute(
-      'aria-expanded',
-      'false',
-    )
-    expect(screen.queryByRole('button', { name: '恢复身份' })).not.toBeInTheDocument()
+    await userEvent.click(screen.getByRole('button', { name: '删除账号' }))
+    await waitFor(() => expect(botAccountsApi.deleteDiscoveredBotAccount).toHaveBeenCalledWith(1))
+    await waitFor(() => expect(screen.queryByText('bot-1')).not.toBeInTheDocument())
+    expect(screen.queryByRole('button', { name: '已排除账号 1' })).not.toBeInTheDocument()
 
-    await userEvent.click(screen.getByRole('button', { name: '已排除账号 1' }))
-    expect(screen.getByRole('button', { name: '恢复身份' })).toBeInTheDocument()
   })
 
   it('uses the shared scope selector while limiting memory groups to exact chats', async () => {
```

**File**: `dashboard/src/routes/config/bot/hooks/__tests__/complexFieldHooks.test.tsx` (modified, +7/-6)
```diff
@@ -46,6 +46,7 @@ vi.mock('@/lib/config-api', () => ({
 
 vi.mock('@/lib/bot-accounts-api', () => ({
   getDiscoveredBotAccounts: vi.fn(),
+  deleteDiscoveredBotAccount: vi.fn(),
   setDiscoveredBotAccountDisabled: vi.fn(),
 }))
 
@@ -1927,7 +1928,7 @@ describe('complexFieldHooks', () => {
       expect(onParentChange).toHaveBeenCalledWith('platforms', [''])
     })
 
-    it('禁用适配器账号失败时展示错误，离线账号显示离线', async () => {
+    it('删除适配器账号失败时展示错误，离线账号显示离线', async () => {
       vi.mocked(botAccountsApi.getDiscoveredBotAccounts).mockResolvedValue([
         {
           id: 8,
@@ -1944,7 +1945,7 @@ describe('complexFieldHooks', () => {
           online: false,
         },
       ])
-      vi.mocked(botAccountsApi.setDiscoveredBotAccountDisabled).mockRejectedValue(new Error('更新失败'))
+      vi.mocked(botAccountsApi.deleteDiscoveredBotAccount).mockRejectedValue(new Error('更新失败'))
 
       render(
         <BotPlatformAccountsHook
@@ -1959,7 +1960,7 @@ describe('complexFieldHooks', () => {
 
       expect(await screen.findByText('离线')).toBeInTheDocument()
       expect(screen.getByText(/入站消息/)).toBeInTheDocument()
-      await userEvent.click(screen.getByRole('button', { name: '排除身份' }))
+      await userEvent.click(screen.getByRole('button', { name: '删除账号' }))
       expect(await screen.findByText('更新失败')).toBeInTheDocument()
     })
 
@@ -2106,10 +2107,10 @@ describe('complexFieldHooks', () => {
         expect(botAccountsApi.setDiscoveredBotAccountDisabled).toHaveBeenCalledWith(4, false)
       })
 
-      vi.mocked(botAccountsApi.setDiscoveredBotAccountDisabled).mockRejectedValueOnce('boom')
-      const excludeButtons = screen.getAllByRole('button', { name: '排除身份' })
+      vi.mocked(botAccountsApi.deleteDiscoveredBotAccount).mockRejectedValueOnce('boom')
+      const excludeButtons = screen.getAllByRole('button', { name: '删除账号' })
       await user.click(excludeButtons[excludeButtons.length - 1])
-      expect(await screen.findByText('更新适配器账号失败')).toBeInTheDocument()
+      expect(await screen.findByText('删除适配器账号失败')).toBeInTheDocument()
 
       vi.mocked(botAccountsApi.getDiscoveredBotAccounts).mockRejectedValueOnce(new Error('网络错误'))
       rerender(
```

**File**: `dashboard/src/routes/config/bot/hooks/complexFieldHooks.tsx` (modified, +18/-5)
```diff
@@ -6,7 +6,6 @@ import {
   ChevronDown,
   ChevronUp,
   ExternalLink,
-  EyeOff,
   GripVertical,
   Pencil,
   Plus,
@@ -51,6 +50,7 @@ import { getChatStreams, resolveChatTargets, type ChatStream, type ChatTargetRes
 import { formatChatDisplayName } from '@/lib/chat-display'
 import { getBotConfigCached } from '@/lib/config-api'
 import {
+  deleteDiscoveredBotAccount,
   getDiscoveredBotAccounts,
   setDiscoveredBotAccountDisabled,
   type BotPlatformAccount,
@@ -2920,6 +2920,19 @@ export const BotPlatformAccountsHook: FieldHookComponent = ({
     void loadDiscoveredAccounts()
   }, [])
 
+  const deleteDiscoveredAccount = async (account: BotPlatformAccount) => {
+    setMutatingAccountId(account.id)
+    setAccountsError('')
+    try {
+      await deleteDiscoveredBotAccount(account.id)
+      setDiscoveredAccounts((current) => current.filter((item) => item.id !== account.id))
+    } catch (error) {
+      setAccountsError(error instanceof Error ? error.message : '删除适配器账号失败')
+    } finally {
+      setMutatingAccountId(null)
+    }
+  }
+
   const toggleDiscoveredAccount = async (account: BotPlatformAccount) => {
     setMutatingAccountId(account.id)
     setAccountsError('')
@@ -2985,11 +2998,11 @@ export const BotPlatformAccountsHook: FieldHookComponent = ({
                   type="button"
                   disabled={mutatingAccountId === account.id}
                   className="text-muted-foreground/45 hover:text-destructive focus-visible:ring-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
-                  aria-label="排除身份"
-                  title="排除身份"
-                  onClick={() => void toggleDiscoveredAccount(account)}
+                  aria-label="删除账号"
+                  title="删除账号记录（适配器再次上报时会重新发现）"
+                  onClick={() => void deleteDiscoveredAccount(account)}
                 >
-                  <EyeOff className="h-4 w-4" />
+                  <Trash2 className="h-4 w-4" />
                 </button>
               </div>
             ))}
```

---

### Incident Patch 15: `721cc346` (2026-09-30)
**Commit Message**: fix(replyer): 表达方式选择序列化上下文时兼容无 source_kind 的消息

表情候选快照、工具结果等消息没有 source_kind 字段，序列化时改用基类的 source，避免回复中断

**File**: `pytests/chat_test/test_maisaka_expression_selector.py` (modified, +21/-0)
```diff
@@ -1,7 +1,11 @@
+from datetime import datetime
+
 from src.chat.replyer.maisaka_expression_selector import (
     MAX_SELECTED_EXPRESSIONS,
     MaisakaExpressionSelector,
 )
+from src.llm_models.payload_content.context_item import ContextItemMeta, ContextTextPart, UserMessageItem
+from src.maisaka.context.emoji_candidates import EmojiCandidateMessage
 
 
 def test_expression_selector_prompt_and_parser_share_five_item_limit() -> None:
@@ -42,3 +46,20 @@ def test_expression_query_includes_available_intent() -> None:
     assert "表达场景：轻松调侃" in query_text
     assert "期望语气：活泼" in query_text
     assert "回复信息参考：\n回应对方刚才的玩笑" in query_text
+
+
+def test_serialize_context_message_accepts_emoji_candidate_snapshot() -> None:
+    """表情候选快照没有 source_kind 字段，序列化上下文时不能因此中断回复。"""
+
+    timestamp = datetime.now()
+    message = EmojiCandidateMessage(
+        item=UserMessageItem(meta=ContextItemMeta.create(timestamp=timestamp), parts=(ContextTextPart("表情包选择图"),)),
+        emoji_hashes={1: "hash"},
+        visible_text="表情包选择图",
+        timestamp=timestamp,
+    )
+
+    serialized = MaisakaExpressionSelector._serialize_context_message(message)
+
+    assert serialized["source_kind"] == "emoji_candidates"
+    assert serialized["text"] == "表情包选择图"
```

**File**: `src/chat/replyer/maisaka_expression_selector.py` (modified, +7/-2)
```diff
@@ -20,7 +20,7 @@
     normalize_expression_style_for_learning,
 )
 from src.learners.learner_utils_old import weighted_sample
-from src.maisaka.context.messages import LLMContextMessage
+from src.maisaka.context.messages import LLMContextMessage, ModelOutputContextMessage, SessionBackedMessage
 
 logger = get_logger("maisaka_expression_selector")
 
@@ -348,11 +348,16 @@ def _build_chat_info(chat_history: List[LLMContextMessage]) -> str:
     @staticmethod
     def _serialize_context_message(message: LLMContextMessage) -> dict[str, Any]:
         timestamp = message.timestamp.isoformat() if isinstance(message.timestamp, datetime) else ""
+        # chat_history 还含表情候选快照、工具结果等没有 source_kind 字段的消息，这些消息改用基类的 source。
+        if isinstance(message, (SessionBackedMessage, ModelOutputContextMessage)):
+            source_kind = message.source_kind
+        else:
+            source_kind = message.source
         return {
             "role": message.role,
             "text": message.processed_plain_text or "",
             "timestamp": timestamp,
-            "source_kind": message.source_kind,
+            "source_kind": source_kind,
         }
 
     @staticmethod
```

#### Recent Merged Pull Requests:
- **PR #2105** (2026-10-06): fix(llm): 兼容 openai SDK 2.34+ 的非 Bearer 鉴权，修复初始化即报 Missing credentials (@BBleae)
- **PR #2104** (closed): fix(A_memorix): 修复向量通道指纹死锁与清理任务无池无限重试 (@unclelossway)
- **PR #2103** (2026-10-05): fix(plugin): 修复插件启用开关恒写入禁用、可视化配置表单保存无效 (@BBleae)
- **PR #2100** (closed): fix(mcp): 由常驻所有者任务管理连接生命周期，修复跨任务关闭导致的 100% CPU 忙循环 (@BBleae)
- **PR #2099** (2026-10-05): fix(llm): 关闭 OpenAI SDK 内部重试，避免超时请求被嵌套重试约 12 次 (@BBleae)
- **PR #2098** (2026-10-05): fix(scripts): offline_runner 调用 _build_context_items_from_dict 时补传 logical_turn_by_call_id (@BBleae)
- **PR #2097** (2026-10-05): fix: 发送链路异常堆栈不再降级到 debug (@BBleae)
- **PR #2095** (2026-10-05): Dev (@SengokuCola)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
