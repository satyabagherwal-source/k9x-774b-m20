# Forensic Learning Record (Deep Inspection): HolmesGPT/holmesgpt

> **Canonical Artifact**: `07_PROJECT_LEARNING/holmesgpt-holmesgpt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/HolmesGPT/holmesgpt](https://github.com/HolmesGPT/holmesgpt))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T22:01:09.953Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `HolmesGPT/holmesgpt`
- **Description**: SRE Agent - CNCF Sandbox Project
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 3484 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/custom_llm.py`
```
from typing import Any, Dict, List, Optional, Type, Union

from litellm.types.utils import ModelResponse
from pydantic import BaseModel

from holmes.core.llm import LLM, ContextWindowUsage
from holmes.core.prompt import generate_user_prompt
from holmes.core.tool_calling_llm import ToolCallingLLM
from holmes.core.tools import Tool
from holmes.core.tools_utils.tool_executor import ToolExecutor
from holmes.plugins.prompts import load_and_render_prompt
from holmes.plugins.toolsets import load_builtin_toolsets


class MyCustomLLM(LLM):
    def get_context_window_size(self) -> int:
        return 128000

    def get_maximum_output_token(self) -> int:
        return 4096

    def count_tokens(
        self, messages: list[dict], tools: Optional[list[dict[str, Any]]] = None
    ) -> ContextWindowUsage:
        return ContextWindowUsage(
            total_tokens=1000,
            tools_to_call_tokens=100,
            system_tokens=200,
            tools_tokens=0,
            user_tokens=700,
            other_tokens=0,
            assistant_tokens=0,
        )

    def completion(  # type: ignore
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Tool]] = [],
        tool_choice: Optional[Union[str, dict]] = None,
        response_format: Optional[Union[dict, Type[BaseModel]]] = None,
        temperature: Optional[float] = None,
        drop_params: Optional[bool] = None,
    ) -> ModelResponse:
        """Return a canned response demonstrating the LLM interface."""
        return ModelResponse(
            choices=[
                {
                    "finish_reason": "stop",
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": "There are no issues with your cluster",
                    },
                }
            ],
            usage={
                "prompt_tokens": 0,  # Integer
                "completion_tokens": 0,
                "total_tokens": 0,
            },
        )


def ask_holmes():
    prompt = "what pods are unhealthy in my cluster?"

    system_prompt = load_and_render_prompt(
        prompt="builtin://generic_ask.jinja2", context={}
    )

    tool_executor = ToolExecutor(load_builtin_toolsets())
    ai = ToolCallingLLM(tool_executor, max_steps=100, llm=MyCustomLLM(), tool_results_dir=None)

    user_prompt = generate_user_prompt(prompt, context={})
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    response = ai.call(messages)

    print(response.model_dump())


ask_holmes()

```

### Core Architecture Module: `experimental/ag-ui/front-end/src/App.tsx`
```
import React, { useState, useEffect } from 'react';
import './App.css';
import MainContent from './components/MainContent';
import ChatAssistant from './components/ChatAssistant';
import ErrorBoundary from './components/ErrorBoundary';

export type ObservabilityPage = 'metrics' | 'logs' | 'traces';

interface ContextItem {
  description: string;
  value: string;
}

const App: React.FC = () => {
  const [selectedPage, setSelectedPage] = useState<ObservabilityPage>('metrics');
  const [pageContext, setPageContext] = useState<ContextItem[]>([]);
  const [triggerQuery, setTriggerQuery] = useState<string | null>(null);

  // Store separate queries for each page
  const [pageQueries, setPageQueries] = useState<Record<ObservabilityPage, string>>({
    metrics: '',
    logs: '',
    traces: ''
  });

  // Handle PromQL query execution from ChatAssistant
  const handleExecutePromQLQuery = (query: string) => {
    // Navigate to metrics page
    setSelectedPage('metrics');

    // Store the query for metrics page
    setPageQueries(prev => ({
      ...prev,
      metrics: query
    }));

    // Update URL to reflect the change
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('app', 'metrics');
    urlParams.set('query', encodeURIComponent(query));
    const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
    window.history.replaceState({}, '', newUrl);

    // Set the query to be executed
    setTriggerQuery(query);
  };

  // Handle PPL query execution from ChatAssistant
  const handleExecutePPLQuery = (query: string) => {
    // Navigate to logs page
    setSelectedPage('logs');

    // Store the query for logs page
    setPageQueries(prev => ({
      ...prev,
      logs: query
    }));

    // Update URL to reflect the change
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('app', 'logs');
    urlParams.set('query', encodeURIComponent(query));
    const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
    window.history.replaceState({}, '', newUrl);

    // Set the query to be executed
    setTriggerQuery(query);
  };

  // Clear trigger after it's been processed
  const clearTriggerQuery = () => {
    setTriggerQuery(null);
  };

  // Handle query updates from MainContent
  const handleQueryUpdate = React.useCallback((page: ObservabilityPage, query: string) => {
    setPageQueries(prev => ({
      ...prev,
      [page]: query
    }));
  }, []); // No dependencies needed since setPageQueries is stable

  // Read URL parameters on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const appParam = urlParams.get('app');
    const queryParam = urlParams.get('query');

    // Set page from URL parameter or default to metrics
    if (appParam && ['metrics', 'logs', 'traces'].includes(appParam)) {
      setSelectedPage(appParam as ObservabilityPage);
    } else {
      // Default to metrics and update URL
      setSelectedPage('metrics');
      urlParams.set('app', 'metrics');
      const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
      window.history.replaceState({}, '', newUrl);
    }

    // Set initial query from URL parameter for the current page
    if (queryParam) {
      const decodedQuery = decodeURIComponent(queryParam);
      const currentPage = (appParam && ['metrics', 'logs', 'traces'].includes(appParam))
        ? appParam as ObservabilityPage
        : 'metrics';

      setPageQueries(prev => ({
        ...prev,
        [currentPage]: decodedQuery
      }));
    }
  }, []);

  // Update URL when page changes
  const handlePageChange = (page: ObservabilityPage) => {
    setSelectedPage(page);

    // Update URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('app', page);

    // Set the query parameter to the stored query for this page
    const storedQuery = pageQueries[page];
    if (storedQuery) {
      urlParams.set('query', encodeURIComponent(storedQuery));
    } else {
      urlParams.delete('query');
    }

    const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
    window.history.replaceState({}, '', newUrl);
  };

  return (
    <div className="app">
      <div className="left-sidebar">
        <div className="sidebar-header">
          <h2>ExampleOps ✨</h2>
        </div>
        <nav className="sidebar-nav">
          <button
            className={`nav-item ${selectedPage === 'metrics' ? 'active' : ''}`}
            onClick={() => handlePageChange('metrics')}
          >
            <span className="nav-icon">📊</span>
            Metrics
          </button>
          <button
            className={`nav-item ${selectedPage === 'logs' ? 'active' : ''}`}
            onClick={() => handlePageChange('logs')}
          >
            <span className="nav-icon">📝</span>
            Logs
          </button>
          <button
            className={`nav-item disabled`}
            disabled
            title="Traces not supported yet!"
          >
            <span className="nav-icon">🔍</span>
            Traces
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="credit-text">✨ vibe-coded with love by</div>
          <a
            href="https://github.com/kylehounslow"
            target="_blank"
            rel="noopener noreferrer"
            className="github-credit"
          >
            <svg className="github-logo" viewBox="0 0 16 16" width="12" height="12">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            kylehounslow
          </a>
        </div>
      </div>
      <MainContent
        selectedPage={selectedPage}
        initialQuery={pageQueries[selectedPage]}
        triggerQuery={triggerQuery}
        onContextChange={setPageContext}
        onQueryTriggered={clearTriggerQuery}
        onQueryUpdate={handleQueryUpdate}
      />
      <ErrorBoundary>
        <ChatAssistant
          pageContext={pageContext}
          onExecutePromQLQuery={handleExecutePromQLQuery}
          onExecutePPLQuery={handleExecutePPLQuery}
        />
      </ErrorBoundary>
    </div>
  );
};

export default App;

```

### Core Architecture Module: `experimental/ag-ui/front-end/src/components/ChatAssistant.tsx`
```
import React, { useState, useRef, useEffect } from 'react';
import { HttpAgent } from '@ag-ui/client';
import ReactMarkdown from 'react-markdown';
import GraphVisualization from './GraphVisualization';
import './ChatAssistant.css';
// Logo is now in public folder, accessed via public URL

interface ChatMessage {
  id: string;
  text?: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  type?: 'text' | 'graph' | 'error';
  graphData?: any;
  error?: {
    title: string;
    description: string;
    retryable?: boolean;
  };
}

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface ContextItem {
  description: string;
  value: string;
}

interface ChatAssistantProps {
  pageContext?: ContextItem[];
  onExecutePromQLQuery?: (query: string) => void;
  onExecutePPLQuery?: (query: string) => void;
}

const TOOL_DEFINITIONS = [
  {
    name: 'graph_timeseries_data',
    description: 'Display time series data as an interactive graph. Use this when you have prometheus data or any time series data that should be visualized.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title for the graph'
        },
        data: {
          type: 'object',
          description: 'Prometheus-style data with result array containing metric and values'
        },
        query: {
          type: 'string',
          description: 'The original query used to generate this data'
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata like time range, step, etc.'
        }
      },
      required: ['title', 'data']
    }
  },
  {
    name: 'execute_promql_query',
    description: 'Navigate to the Metrics page and execute a PromQL query. Use this when you want to run a specific Prometheus query and show the results.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The PromQL query to execute (e.g., "rate(http_requests_total[5m])", "cpu_usage", "memory_usage")'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'execute_ppl_query',
    description: 'Navigate to the Logs page and execute a PPL (Piped Processing Language) query. Use this when you want to run a specific OpenSearch PPL query and show the results.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The PPL query to execute (e.g., "source=logs-* | stats count() by level", "source=ai-agent-logs-* | where level=\'ERROR\'")'
        }
      },
      required: ['query']
    }
  }
];

const ChatAssistant: React.FC<ChatAssistantProps> = ({ pageContext = [], onExecutePromQLQuery, onExecutePPLQuery }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [width, setWidth] = useState(500);
  const [isResizing, setIsResizing] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [messageHistory, setMessageHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const agentRef = useRef<HttpAgent | null>(null);
  const threadIdRef = useRef<string>('thread-' + Date.now());
  const currentMessageRef = useRef<string>('');
  const toolCallsRef = useRef<Map<string, { name: string, args?: any }>>(new Map());
  const toolArgsRef = useRef<Map<string, string>>(new Map());
  const chatAssistantRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialMessageSentRef = useRef<boolean>(false);
  const agentInitializedRef = useRef<boolean>(false);

  // Initialize the HttpAgent with error handling
  const initializeAgent = React.useCallback(() => {
    // Prevent double initialization
    if (agentInitializedRef.current) {
      console.log('Agent already initialized, skipping...');
      // If already initialized but not connected, try to send initial message
      if (connectionStatus === 'connected' && !initialMessageSentRef.current) {
        setTimeout(() => {
          sendInitialMessage();
        }, 100);
      }
      return;
    }

    try {
      agentInitializedRef.current = true;
      setConnectionStatus('connecting');

      const agentUrl = `${process.env.AGENT_URL || 'http://localhost:5050'}/api/agui/chat`;
      console.log('Initializing agent with URL:', agentUrl);

      agentRef.current = new HttpAgent({
        url: agentUrl,
        threadId: threadIdRef.current,
        headers: {
          'Content-Type': 'application/json',
        }
      });

      // Set up event subscriber with error handling
      const subscriber: Object = {
      onRunStartedEvent: (params: { event: any; }) => {
        setIsLoading(true);
        setIsThinking(true);
        setConnectionStatus('connected');
        setRetryCount(0);
        console.log('Agent run started:', params.event);
      },

      onRunFinishedEvent: (params: { event: any; }) => {
        setIsLoading(false);
        setIsThinking(false);
        setConnectionStatus('connected');
        console.log('Agent run finished:', params.event);
      },

      onTextMessageStartEvent: (params: { event: { messageId: any; }; }) => {
        currentMessageRef.current = '';
        const newMessage: ChatMessage = {
          id: params.event.messageId,
          text: '',
          sender: 'assistant',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, newMessage]);
      },

      onTextMessageContentEvent: (params: { event: { delta: string; messageId: string; }; }) => {
        currentMessageRef.current += params.event.delta;
        setMessages(prev =>
          prev.map(msg =>
            msg.id === params.event.messageId
              ? { ...msg, text: currentMessageRef.current }
              : msg
          )
        );
      },

      onTextMessageEndEvent: () => {
        setIsLoading(false);
      },

      onToolCallStartEvent: (params: { event: { toolCallName: string; toolCallId: string; }; }) => {
        console.log('Tool call started:', params.event);

        // Store tool call metadata for later use
        toolCallsRef.current.set(params.event.toolCallId, {
          name: params.event.toolCallName
        });

        // Initialize empty args string for this tool call
        toolArgsRef.current.set(params.event.toolCallId, '');

        if (params.event.toolCallName === 'graph_timeseries_data') {
          const toolMessage: ChatMessage = {
            id: 'tool-' + params.event.toolCallId,
            text: '🔧 Preparing to display graph...',
            sender: 'assistant',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, toolMessage]);
        } else if (params.event.toolCallName === 'execute_promql_query') {
          const toolMessage: ChatMessage = {
            id: 'tool-' + params.event.toolCallId,
            text: '🚀 Executing PromQL query...',
            sender: 'assistant',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, toolMessage]);
        } else if (params.event.toolCallName === 'execute_ppl_query') {
          const toolMessage: ChatMessage = {
            id: 'tool-' + params.event.toolCallId,
            text: '🔍 Executing PPL query...',
            sender: 'assistant',
            timestamp: new Date()
          };
          setMessages(prev => [..
```

### Core Architecture Module: `experimental/ag-ui/front-end/src/components/ErrorBoundary.tsx`
```
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-boundary">
          <div className="error-content">
            <h3>⚠️ Something went wrong</h3>
            <p>The chat assistant encountered an error and needs to be reloaded.</p>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="retry-button"
            >
              Try Again
            </button>
            <details className="error-details">
              <summary>Error Details</summary>
              <pre>{this.state.error?.message}</pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

```

### Core Architecture Module: `experimental/ag-ui/front-end/src/components/GraphVisualization.tsx`
```
import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  ChartOptions,
  ChartData,
  TooltipItem,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import './GraphVisualization.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

interface GraphData {
  title: string;
  query?: string;
  data: {
    result: Array<{
      metric: Record<string, string>;
      values: Array<[number, string]>;
    }>;
  };
  metadata?: {
    timestamp?: number;
    source?: string;
    start_time?: string;
    end_time?: string;
    step?: string;
  };
}

interface GraphVisualizationProps {
  data: GraphData;
}

const GraphVisualization: React.FC<GraphVisualizationProps> = ({ data }) => {
  const { title, query, data: graphData, metadata } = data;

  // Generate colors for different series (Grafana-like palette)
  const generateColor = (index: number) => {
    const colors = [
      '#7EB26D', // Green
      '#EAB839', // Yellow
      '#6ED0E0', // Light Blue
      '#EF843C', // Orange
      '#E24D42', // Red
      '#1F78C1', // Blue
      '#BA43A9', // Purple
      '#705DA0', // Dark Purple
      '#508642', // Dark Green
      '#CCA300', // Dark Yellow
    ];
    return colors[index % colors.length];
  };

  // Generate series label from metric
  const generateSeriesLabel = (metric: Record<string, string>, index: number) => {
    console.log('Metric data for series', index, ':', metric);

    // First try to use __name__ if it exists
    if (metric.__name__) {
      // If there are other meaningful labels, combine them
      const filteredMetric = Object.entries(metric).filter(
        ([key]) => key !== '__name__'
      );

      if (filteredMetric.length > 0) {
        const labels = filteredMetric
          .map(([key, value]) => `${key}="${value}"`)
          .join(', ');
        return `${metric.__name__}{${labels}}`;
      }

      // Just return the metric name
      return metric.__name__;
    }

    // If no __name__, use all available labels (including job)
    const allLabels = Object.entries(metric);

    if (allLabels.length > 0) {
      // For single label, just show the value part if it's descriptive
      if (allLabels.length === 1) {
        const [key, value] = allLabels[0];
        // If it's a job label with a descriptive path, extract the service name
        if (key === 'job' && value.includes('/')) {
          return value.split('/').pop() || value;
        }
        return value;
      }

      // For multiple labels, show key=value format
      return allLabels
        .map(([key, value]) => `${key}="${value}"`)
        .join(', ');
    }

    // Last resort: use series index
    return `Series ${index + 1}`;
  };

  // Prepare Chart.js data
  const prepareChartData = (): ChartData<'line'> => {
    if (!graphData?.result || graphData.result.length === 0) {
      return { datasets: [] };
    }

    const datasets = graphData.result.map((series, index) => {
      const color = generateColor(index);
      const label = generateSeriesLabel(series.metric, index);

      const dataPoints = series.values?.map(([timestamp, value]) => ({
        x: timestamp * 1000, // Convert to milliseconds
        y: parseFloat(value),
      })) || [];

      return {
        label,
        data: dataPoints,
        borderColor: color,
        backgroundColor: color + '20', // Add transparency
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 2,
        pointHoverRadius: 4,
      };
    });

    return { datasets };
  };

  // Chart.js options (Grafana-like styling)
  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: false, // Disable default legend, we'll create a custom one
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#666',
        borderWidth: 1,
        itemSort: (a: TooltipItem<'line'>, b: TooltipItem<'line'>) => {
          // Sort by value descending (highest to lowest)
          return b.parsed.y - a.parsed.y;
        },
        callbacks: {
          title: (context: TooltipItem<'line'>[]) => {
            const date = new Date(context[0].parsed.x);
            return date.toLocaleString();
          },
          label: (context: TooltipItem<'line'>) => {
            return `${context.dataset.label}: ${context.parsed.y}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          displayFormats: {
            minute: 'HH:mm',
            hour: 'HH:mm',
            day: 'MMM dd',
          },
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          color: '#666',
        },
      },
      y: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          color: '#666',
        },
      },
    },
  };

  // Determine if legend should be vertical based on number of series and label length
  const shouldUseVerticalLegend = (datasets: any[]) => {
    const seriesCount = datasets.length;
    const maxLabelLength = Math.max(...datasets.map(dataset =>
      dataset.label ? dataset.label.length : 0
    ));
    const hasLongLabels = datasets.some(dataset =>
      dataset.label && dataset.label.length > 30  // Lowered from 40 to 30
    );

    console.log('Legend layout check:', {
      seriesCount,
      maxLabelLength,
      hasLongLabels,
      sampleLabels: datasets.slice(0, 3).map(d => d.label)
    });

    // Use vertical layout if:
    // - More than 5 series (lowered from 6), OR
    // - Any label is longer than 30 characters (lowered from 40), OR
    // - More than 3 series AND any label is longer than 20 characters
    const shouldBeVertical = seriesCount > 5 ||
           hasLongLabels ||
           (seriesCount > 3 && datasets.some(dataset =>
             dataset.label && dataset.label.length > 20
           ));

    console.log('Should use vertical legend:', shouldBeVertical);
    return shouldBeVertical;
  };

  const chartData = prepareChartData();

  if (!graphData?.result || graphData.result.length === 0) {
    return (
      <div className="graph-visualization">
        <div className="graph-container">
          <div className="graph-header">
            <h4>{title}</h4>
            {query && <code className="query">{query}</code>}
          </div>
          <div className="no-data">No data available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-visualization">
      <div className="graph-container">
        <div className="graph-header">
          <h4>{title}</h4>
          {query && <code className="query">{query}</code>}
        </div>

        <div className="chart-container">
          <Line data={chartData} options={chartOptions} />
        </div>

        {/* Custom scrollable legend */}
        <div className="custom-legend">
          <div className={`legend-items ${shouldUseVerticalLegend(chartData.datasets) ? 'vertical' : ''}`}>
            {chartData.datasets.map((dataset, index) => (
              <div key={index} className="legend-item">
                <div
                  className="legend-color"
                  style={{ backgroundColor: dataset.borderColor as string }}
                ></div>
                <span className="legend-label">{dataset.label}</span>
              </div>
            ))}
          </div>
        </div>

        {metadata && (
          <div className="graph-metadata">
            <small>
              Source: {metadata.so
```

### Core Architecture Module: `experimental/ag-ui/front-end/src/components/LogsVisualization.tsx`
```
import React from 'react';
import './LogsVisualization.css';

interface LogData {
  title: string;
  query?: string;
  data: {
    schema: Array<{
      name: string;
      type: string;
    }>;
    datarows: Array<Array<any>>;
    total?: number;
    size?: number;
  };
  metadata?: {
    timestamp?: number;
    source?: string;
  };
}

interface LogsVisualizationProps {
  data: LogData;
}

const LogsVisualization: React.FC<LogsVisualizationProps> = ({ data }) => {
  const { title, query, data: logData, metadata } = data;

  // Format cell value based on type and content
  const formatCellValue = (value: any, type: string, columnName: string) => {
    if (value === null || value === undefined || value === '') {
      return <span className="null-value">-</span>;
    }

    // Handle timestamp formatting
    if (type === 'timestamp' && typeof value === 'string') {
      try {
        const date = new Date(value);
        // Check if it's a valid date and not epoch 0
        if (date.getTime() > 0) {
          return <span className="timestamp-value">{date.toLocaleString()}</span>;
        }
      } catch {
        // Fall through to default handling
      }
    }

    // Handle object/struct types
    if (typeof value === 'object' && value !== null) {
      return <span className="object-value">{JSON.stringify(value)}</span>;
    }

    // Handle severity levels with colors
    if (columnName === 'severityText' || columnName === 'severityNumber') {
      const severity = String(value).toLowerCase();
      let className = 'severity-value';

      if (severity.includes('error') || severity.includes('err') || value === 3) {
        className += ' severity-error';
      } else if (severity.includes('warn') || value === 2) {
        className += ' severity-warn';
      } else if (severity.includes('info') || value === 1 || value === 9) {
        className += ' severity-info';
      } else if (severity.includes('debug') || value === 0) {
        className += ' severity-debug';
      }

      return <span className={className}>{String(value)}</span>;
    }

    // Handle long text content (like log messages)
    const stringValue = String(value);
    if (columnName === 'body' || columnName === 'message') {
      return (
        <span
          className="log-message"
          title={stringValue}
        >
          {stringValue}
        </span>
      );
    }

    return <span className="text-value">{stringValue}</span>;
  };

  // Get column width class based on column type and name
  const getColumnClass = (columnName: string, type: string) => {
    const baseClass = 'log-header';

    if (columnName === 'body' || columnName === 'message') {
      return `${baseClass} column-wide`;
    }

    if (type === 'timestamp' || columnName.includes('Time')) {
      return `${baseClass} column-timestamp`;
    }

    if (columnName === 'traceId' || columnName === 'spanId') {
      return `${baseClass} column-id`;
    }

    if (columnName === 'serviceName' || columnName === 'service') {
      return `${baseClass} column-service`;
    }

    return `${baseClass} column-normal`;
  };

  if (!logData?.schema || !logData?.datarows) {
    return (
      <div className="logs-visualization">
        <div className="logs-container">
          <div className="logs-header">
            <h4>{title}</h4>
            {query && <code className="query">{query}</code>}
            <div className="data-type-indicator">📝 Log Data</div>
          </div>
          <div className="no-data">No log data available</div>
        </div>
      </div>
    );
  }

  const { schema, datarows, total, size } = logData;

  // Reorder columns to put timestamp columns first
  const reorderColumnsForTimestamp = () => {
    const timestampColumns: Array<{index: number, column: any, priority: number}> = [];
    const otherColumns: Array<{index: number, column: any}> = [];

    schema.forEach((column, index) => {
      const columnName = column.name.toLowerCase();
      const isTimestamp = column.type === 'timestamp' ||
                         columnName.includes('time') ||
                         columnName.includes('timestamp') ||
                         columnName === '@timestamp';

      if (isTimestamp) {
        // Priority: "time" gets highest priority (0), then alphabetical
        let priority = 1;
        if (columnName === 'time') priority = 0;
        else if (columnName === '@timestamp') priority = 0.5;

        timestampColumns.push({ index, column, priority });
      } else {
        otherColumns.push({ index, column });
      }
    });

    // Sort timestamp columns by priority, then alphabetically
    timestampColumns.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.column.name.localeCompare(b.column.name);
    });

    // Create new column order
    const reorderedColumns = [
      ...timestampColumns.map(item => item.column),
      ...otherColumns.map(item => item.column)
    ];

    // Create index mapping for data reordering
    const indexMapping = [
      ...timestampColumns.map(item => item.index),
      ...otherColumns.map(item => item.index)
    ];

    return { reorderedColumns, indexMapping };
  };

  const { reorderedColumns, indexMapping } = reorderColumnsForTimestamp();

  // Reorder data rows according to the new column order
  const reorderedDatarows = datarows.map(row =>
    indexMapping.map(originalIndex => row[originalIndex])
  );

  return (
    <div className="logs-visualization">
      <div className="logs-container">
        <div className="logs-header">
          <h4>{title}</h4>
          {query && <code className="query">{query}</code>}
          <div className="data-type-indicator">📝 Log Data</div>
        </div>

        <div className="log-table-container">
          <div className="log-table-header">
            <div className="log-stats">
              Showing {size || datarows.length} of {total || datarows.length} log entries
            </div>
            <div className="log-actions">
              <button
                className="export-btn"
                onClick={() => {
                  // Simple CSV export functionality
                  const csvContent = [
                    reorderedColumns.map(col => col.name).join(','),
                    ...reorderedDatarows.map(row =>
                      row.map(cell =>
                        typeof cell === 'string' && cell.includes(',')
                          ? `"${cell.replace(/"/g, '""')}"`
                          : String(cell || '')
                      ).join(',')
                    )
                  ].join('\n');

                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `logs-${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                title="Export logs as CSV"
              >
                📥 Export
              </button>
            </div>
          </div>

          <div className="log-table-wrapper">
            <table className="log-table">
              <thead>
                <tr>
                  {reorderedColumns.map((column, index) => (
                    <th key={index} className={getColumnClass(column.name, column.type)}>
                      <div className="column-info">
                        <span className="column-name">{column.name}</span>
                        <span className="column-type">{column.type}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reorderedDatarows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="log-row">
                    {row.map((cell, cellInde
```

### Core Architecture Module: `experimental/ag-ui/front-end/src/components/MainContent.tsx`
```
import React, { useState } from 'react';
import GraphVisualization from './GraphVisualization';
import LogsVisualization from './LogsVisualization';
type ObservabilityPage = 'metrics' | 'logs' | 'traces';

interface QueryResult {
  id: string;
  query: string;
  timestamp: Date;
  data?: any;
  error?: string;
  errorDetails?: any;
}

interface ContextItem {
  description: string;
  value: string;
}

interface MainContentProps {
  selectedPage: ObservabilityPage;
  initialQuery?: string;
  triggerQuery?: string | null;
  onContextChange?: (context: ContextItem[]) => void;
  onQueryTriggered?: () => void;
  onQueryUpdate?: (page: ObservabilityPage, query: string) => void;
}

const MainContent: React.FC<MainContentProps> = ({
  selectedPage,
  initialQuery = '',
  triggerQuery,
  onContextChange,
  onQueryTriggered,
  onQueryUpdate
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [isExecuting, setIsExecuting] = useState(false);

  // Track current query execution to prevent race conditions
  const currentQueryRef = React.useRef<string>('');
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Store separate results for each page
  const [pageResults, setPageResults] = useState<Record<ObservabilityPage, QueryResult | null>>({
    metrics: null,
    logs: null,
    traces: null
  });

  // Get current page's result
  const currentResult = pageResults[selectedPage];
  const [prometheusStatus, setPrometheusStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [prometheusUrl] = useState(process.env.REACT_APP_PROMETHEUS_URL || 'http://localhost:9090');
  const [opensearchStatus, setOpensearchStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [opensearchUrl] = useState(process.env.REACT_APP_OPENSEARCH_URL || 'http://localhost:9200');
  const [opensearchUser] = useState(process.env.REACT_APP_OPENSEARCH_USER);
  const [opensearchPassword] = useState(process.env.REACT_APP_OPENSEARCH_PASSWORD);

  // Indices discovery state
  const [availableIndices, setAvailableIndices] = useState<string[]>([]);

  const [loadingIndices, setLoadingIndices] = useState(false);

  // Metrics discovery state - three-box interface
  const [availableMetrics, setAvailableMetrics] = useState<string[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [availableLabelValues, setAvailableLabelValues] = useState<string[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [loadingLabels, setLoadingLabels] = useState(false);
  const [loadingLabelValues, setLoadingLabelValues] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);
  const [showIndicesExplorer, setShowIndicesExplorer] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  // Helper function to create OpenSearch auth headers
  const getOpensearchHeaders = React.useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (opensearchUser && opensearchPassword) {
      const credentials = btoa(`${opensearchUser}:${opensearchPassword}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }

    return headers;
  }, [opensearchUser, opensearchPassword]);

  // Fetch indices count automatically when connected
  const fetchIndicesCount = React.useCallback(async () => {
    if (selectedPage !== 'logs' || opensearchStatus !== 'connected') return;

    try {
      const response = await fetch(`${opensearchUrl}/_cat/indices?format=json&h=index`, {
        method: 'GET',
        headers: getOpensearchHeaders(),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (response.ok) {
        const indices = await response.json();
        const indexNames = indices
          .map((idx: any) => idx.index)
          .filter((name: string) => !name.startsWith('.')) // Filter out system indices
          .sort();

        setAvailableIndices(indexNames);
      } else {
        console.error('Failed to fetch indices count:', response.status, response.statusText);
        setAvailableIndices([]);
      }
    } catch (error) {
      console.error('Error fetching indices count:', error);
      setAvailableIndices([]);
    }
  }, [opensearchUrl, selectedPage, opensearchStatus, getOpensearchHeaders]);

  // Fetch metrics count automatically when connected
  const fetchMetricsCount = React.useCallback(async () => {
    if (selectedPage !== 'metrics' || prometheusStatus !== 'connected') return;

    try {
      const response = await fetch(`${prometheusUrl}/api/v1/label/__name__/values`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success' && result.data) {
          const metricNames = result.data
            .filter((name: string) => name && !name.startsWith('__')) // Filter out internal metrics
            .sort();

          setAvailableMetrics(metricNames);
        } else {
          console.error('Failed to fetch metrics: Invalid response format');
          setAvailableMetrics([]);
        }
      } else {
        console.error('Failed to fetch metrics:', response.status, response.statusText);
        setAvailableMetrics([]);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
      setAvailableMetrics([]);
    }
  }, [prometheusUrl, selectedPage, prometheusStatus]);

  // Fetch labels for selected metric
  const fetchLabelsForMetric = React.useCallback(async (metricName: string) => {
    if (!metricName || selectedPage !== 'metrics' || prometheusStatus !== 'connected') return;

    setLoadingLabels(true);
    try {
      const response = await fetch(`${prometheusUrl}/api/v1/series?match[]=${encodeURIComponent(metricName)}&limit=1000`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success' && result.data) {
          const labelSet = new Set<string>();
          result.data.forEach((series: any) => {
            Object.keys(series).forEach(label => {
              if (label !== '__name__') {
                labelSet.add(label);
              }
            });
          });

          const labels = Array.from(labelSet).sort();
          setAvailableLabels(labels);
        } else {
          setAvailableLabels([]);
        }
      } else {
        console.error('Failed to fetch labels:', response.status, response.statusText);
        setAvailableLabels([]);
      }
    } catch (error) {
      console.error('Error fetching labels:', error);
      setAvailableLabels([]);
    } finally {
      setLoadingLabels(false);
    }
  }, [prometheusUrl, selectedPage, prometheusStatus]);

  // Fetch label values for selected metric and label
  const fetchLabelValues = React.useCallback(async (metricName: string, labelName: string) => {
    if (!metricName || !labelName || selectedPage !== 'metrics' || prometheusStatus !== 'connected') return;

    setLoadingLabelValues(true);
    try {
      const response = await fetch(`${prometheusUrl}/api/v1/label/${encodeURIComponent(labelName)}/values?match[]=${encodeURIComponent(metricName)}`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success' && result.data) {
          const values = result.data.sort();
          setAvailableLabelValues(values);
        } else {
          setAvailableLabelValues([]);
        }
      } else {
        console.error('Failed to fetch label values:', response.status, respo
```

### Core Architecture Module: `experimental/ag-ui/front-end/src/index.tsx`
```
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1924** (2026-04-19): **toolsets_status.json written with type=null on first run, crashes subsequent runs with ValueError: None is not a valid ToolsetType**
  *Symptoms*: ## Summary  On first run with custom toolsets (MCP, custom database/mongodb toolsets), `toolsets_status.json` is written with `\"type\": null` for those entries. Any subsequent invocation of `holmes ask` then crashes immediately before producing any output:  ``` ValueError: None is not a valid ToolsetType ```  ## Versions  - HolmesGPT: 0.24.3 (installed via `pip install holmesgpt==0.24.3`) - Python: 3.10.12 - OS: Ubuntu 22.04  ## Repro steps  1. Configure a custom MCP toolset (e.g. `mcp/mongodb-deep`) and a custom database toolset in `config.yaml` 2. Run `holmes ask "..."` — succeeds, writes `~/.holmes/toolsets_status.json` with `"type": null` for custom entries 3. Run `holmes ask "..."` again — crashes with `ValueError: None is not a valid ToolsetType`  ## Root cause hypothesis  When `toolsets_status.json` is first written, custom toolsets whose Python-side `ToolsetType` enum wasn't registered in the serializer emit `null` instead of the string value. The deserialization on the next run then tries to construct `ToolsetType(None)` which raises `ValueError`.  ## Affected `toolsets_status.json` sample  ```json [   {"name": "mcp/mongodb-deep", "type": null, "status": "enabled", ...},   {"name": "postgres/zabbix",  "type": null, "status": "enabled", ...} ] ```  ## Workaround we are using in production  We pre-patch the cache file before every `holmes ask` invocation, mapping known names to their correct type strings:  ```python _TOOLSET_TYPE_FIXUPS = {     "postgres/zabbix": "dat
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated issue plan by CodeRabbit --> <details> <summary>🔗 Related PRs</summary>  HolmesGPT/holmesgpt#556 - MCP toolset validation fixes [merged] HolmesGPT/holmesgpt#1121 - mcp exception fix [merged] HolmesGPT/holmesgpt#1501 - fix(mcp): Support nullable types in ToolParameter validation [merged] HolmesGPT/holmesgpt#1546 - Fix ToolsetDBModel crash from model_dump unpacking all Toolset fields [merged] HolmesGPT/holmesgpt#1731 - Add MongoDB toolset for querying and diagnostics [merged] </details>  --- <details> <summary>📝 Issue Planner</summary>  <sub>Check the box below or use the `@coderabbitai plan` command to generate an implementation plan and prompts that you can use with your favorite coding assistant.</sub>  - [ ] <!-- {"checkboxId": "8d4f2b9c-3e1a-4f7c-a9b2-d5e8f1c4a7b9"} --> Create Plan </details>   --- <details> <summary> 🧪 Issue enrichment is currently in open beta.</summary>   You can configure auto-planning by selecting labels in the issue_enrichment
  > Hi @apollion69  Thanks for reporting we are on it.
  > Hi @apollion69  We merged fix for it yesterday and release new version can you please confirm the issue was resolved?

- **Issue #1108** (2025-11-10): **Docs mention SSE streaming endpoints but they don't exist**
  *Symptoms*: ### What happened?  Only the investigate endpoint is available.  Is there any plan to add it in the future?  <img width="606" height="448" alt="Image" src="https://github.com/user-attachments/assets/5fbdcdd0-17df-4e8f-8d41-6d61bf0787f2" />  <img width="754" height="48" alt="Image" src="https://github.com/user-attachments/assets/3d3c5237-8baa-4f6c-b2f4-6a278ae08d29" />  <img width="939" height="536" alt="Image" src="https://github.com/user-attachments/assets/d1902452-3eaa-471c-8d65-b411f27db697" />  ### What did you expect to happen?  Chat endpoint will be available through SSE protocol to stream response tokens live and not when the response is finished  ### How can we reproduce it (as minimally and precisely as possible)?  try to access any /api/stream/chat endpoint (not existing in the code as well)  ### Anything else we need to know?  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi @Danielkiss9, Thanks for the report.  Looks like indeed our docs aren't updated. To support streaming on the chat endpoint (e.g. /api/chat) you can pass in the body `stream = true` and it will stream events.  Can you please check it out and let me know if it worked for you?  We will make sure to update the docs accordingly.
  > Works, @moshemorad. Thanks!

- **Issue #721** (2025-07-29): **TextArea in /show command crashes when Escape and q are clicked simultaneously**
  *Symptoms*: ### What happened?  In the /show command text area, hitting escape exits the text area with a delay. There is no indication of the click being recognized, so if a user quickly hits "q" to exit, Holmes exits with an error.   <img width="1465" height="385" alt="Image" src="https://github.com/user-attachments/assets/30408b3b-e0de-407f-92d6-2a72fb516b47" />  https://github.com/user-attachments/assets/ce123de0-d41c-4558-ba3a-caf36caf281d  ### What did you expect to happen?  Holmes to exit the text area  ### How can we reproduce it (as minimally and precisely as possible)?  Run /show command for a tool call. Click "escape" and then hit "q"  ### Anything else we need to know?  _No response_

- **Issue #668** (2025-07-23): **Docs workflow breaks if a new plugin is added**
  *Symptoms*: ### What happened?  Because `pip install mkdocs-material` is used in the workflow, adding a new plugin to Mkdocs without updating the workflow fails it <img width="1523" height="367" alt="Image" src="https://github.com/user-attachments/assets/812f1593-4e98-4922-83e2-0a0eb9727460" />  ### What did you expect to happen?  Workflow to run and deploy docs  ### How can we reproduce it (as minimally and precisely as possible)?  Add a new Mkdocs plugin and try to deploy it  ### Anything else we need to know?  _No response_
  **Post-Mortem & Fix Analysis**:
  > Fixed with #686 

- **Issue #664** (2025-07-21): **Holmes crashes with KeyError in Internet toolset when URL parameter is missing**
  *Symptoms*: ### What happened?  Sometimes FetchWebpage tool in the internet toolset crashes with a KeyError when the get_parameterized_one_liner method is called with parameters that don't contain the expected "url" key.    ``` Analyzing issue 1/15: TargetDown... No section received from the client. Default sections will be used.                                     Structured output is disabled for this request                                                          No runbooks found for this issue. Using default behaviour. (Add runbooks to guide the investigation.) Tool call to fetch_webpage failed with an Exception                                                     Traceback (most recent call last):                                                                        File "/Users/pavan/Documents/repos/holmesgpt/holmes/core/tool_calling_llm.py", line 415, in           _invoke_tool                                                                                                tool_response = tool.invoke(tool_params, tool_number=tool_number)                                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^                                     File "/Users/pavan/Documents/repos/holmesgpt/holmes/core/tools.py", line 147, in invoke                   f"Running tool {tool_number_str}{self.name}: {self.get_parameterized_one_liner(params)}"                                                                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   

- **Issue #559** (2025-07-12): **CLI tool output is being printed without a newline**
  *Symptoms*: ### What happened?  When I ran the HolmesGPT ask command, the new line character is being interpreted as a string and printed as is.  ![Image](https://github.com/user-attachments/assets/2d92b709-e88c-42cc-870c-fec275fb59ac)  ### What did you expect to happen?  Output should be printed in a new line  ### How can we reproduce it (as minimally and precisely as possible)?  Run a Holmes ask command like so ``` poetry run python3 holmes_cli.py ask "why is the payment application failing?" ```  ### Anything else we need to know?  _No response_
  **Post-Mortem & Fix Analysis**:
  > @pavangudiwada we changed the output format a little - is this still relevant?
  > No it's not! I tested it and the output looks great  <img width="2360" height="604" alt="Image" src="https://github.com/user-attachments/assets/c9ffcd95-31d4-45a7-99b8-ad91af6c9d2f" />  With /toggle-output <img width="2542" height="1646" alt="Image" src="https://github.com/user-attachments/assets/e01fb00a-a6f4-4f26-a094-da32a4e6a308" />

- **Issue #461** (2025-05-29): **Build's failing due to pre-commit hooks running on SVG files**
  *Symptoms*: ### What happened?  Builds with new SVG files are failing because of `end-of-file-fixer` running on SVG files.   ![Image](https://github.com/user-attachments/assets/f48d53c0-e333-4a65-9d29-37e0fafd6b10)  ### What did you expect to happen?  The builds/pre-commit hooks to not modify SVG files  ### How can we reproduce it (as minimally and precisely as possible)?  Add an SVG file and run pre-commit hooks  ### Anything else we need to know?  _No response_

- **Issue #448** (2025-05-28): **HolmesGPT installs alpha version when using Homebrew**
  *Symptoms*: ### What happened?  When I installed HolmesGPT using Brew, it installed an alpha version. I was expecting the most recent stable release to be installed.   ![Image](https://github.com/user-attachments/assets/a4159268-7c46-4da4-8939-88692ad0497d)  ### What did you expect to happen?  Install the latest stable release of HolmesGPT  ### How can we reproduce it (as minimally and precisely as possible)?  Follow the Holmes Homebrew instructions  ### Anything else we need to know?  _No response_

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

### Incident Patch 1: `264cb8a5` (2026-09-30)
**Commit Message**: docs: fix examples that fail when followed as written (#2507)

Each commit fixes one kind of example that fails or misleads a reader
who follows the page as written:

- Helm values keys the Holmes chart never reads (`config.model`,
`podLabels`, `extraVolumes`, `customToolsets`, `image.repository`);
- configs and custom toolsets the CLI or chart rejects, and YAML that
doesn't parse;
- Helm commands and Kubernetes names that don't match what the chart
installs (chart `robusta/holmes`, `<release>-holmes-service-account`);
- two release names for one install: every Holmes chart command and
example uses the release `holmes`, which the data source pages already
used, where the install guide used `holmesgpt`;
- upgrade and uninstall commands with no word on which release name to
use for an install made under another name;
- a model provider whose Helm tab fails in the chart's read-only pod
(GitHub Copilot's OAuth device flow);
- custom toolset credentials written as `{{ }}` placeholders, which
Holmes asks the LLM to fill in, set by `export` lines that never reach
the pod;
- a secret note that misstates what a missing secret does and which
namespace is the default;
- a custom image built f

**File**: `.github/workflows/docker-dev-images.yaml` (modified, +2/-2)
```diff
@@ -141,7 +141,7 @@ jobs:
                 '',
                 '**HolmesGPT chart:**',
                 '```bash',
-                'helm upgrade --install holmesgpt ./helm/holmes \\\\',
+                'helm upgrade --install holmes ./helm/holmes \\\\',
                 '  --set registry=me-west1-docker.pkg.dev/robusta-development/development \\\\',
                 `  --set image=holmes-dev:${prevSha} \\\\`,
                 '  --set operator.registry=me-west1-docker.pkg.dev/robusta-development/development \\\\',
@@ -328,7 +328,7 @@ jobs:
               '',
               '**HolmesGPT chart:**',
               '```bash',
-              'helm upgrade --install holmesgpt ./helm/holmes \\',
+              'helm upgrade --install holmes ./helm/holmes \\',
               '  --set registry=me-west1-docker.pkg.dev/robusta-development/development \\',
               `  --set image=holmes-dev:${shortSha} \\`,
               '  --set operator.registry=me-west1-docker.pkg.dev/robusta-development/development \\',
```

**File**: `docs/ai-providers/anthropic.md` (modified, +6/-8)
```diff
@@ -41,6 +41,9 @@ Get an [Anthropic API key](https://support.anthropic.com/en/articles/8114521-how
           secretKeyRef:
             name: holmes-secrets
             key: anthropic-api-key
+      # Optional: Set default model (use modelList key name)
+      - name: MODEL
+        value: "claude-sonnet-4"  # This refers to the key name in modelList below
 
     # Configure at least one model using modelList
     modelList:
@@ -56,10 +59,6 @@ Get an [Anthropic API key](https://support.anthropic.com/en/articles/8114521-how
         api_key: "{{ env.ANTHROPIC_API_KEY }}"
         model: anthropic/claude-opus-4-1-20250805
         temperature: 1
-
-    # Optional: Set default model (use modelList key name)
-    config:
-      model: "claude-sonnet-4"  # This refers to the key name in modelList above
     ```
 
 === "Robusta Helm Chart"
@@ -81,6 +80,9 @@ Get an [Anthropic API key](https://support.anthropic.com/en/articles/8114521-how
             secretKeyRef:
               name: robusta-holmes-secret
               key: anthropic-api-key
+        # Optional: Set default model (use modelList key name)
+        - name: MODEL
+          value: "claude-sonnet-4"  # This refers to the key name in modelList below
 
       # Configure at least one model using modelList
       modelList:
@@ -96,10 +98,6 @@ Get an [Anthropic API key](https://support.anthropic.com/en/articles/8114521-how
           api_key: "{{ env.ANTHROPIC_API_KEY }}"
           model: anthropic/claude-opus-4-1-20250805
           temperature: 1
-
-      # Optional: Set default model (use modelList key name)
-      config:
-        model: "claude-sonnet-4"  # This refers to the key name in modelList above
     ```
 
 ## Prompt Caching
```

**File**: `docs/ai-providers/aws-bedrock.md` (modified, +15/-33)
```diff
@@ -60,6 +60,9 @@ Configure HolmesGPT to use AWS Bedrock foundation models.
           secretKeyRef:
             name: holmes-secrets
             key: aws-secret-access-key
+      # Optional: Set default model (use modelList key name)
+      - name: MODEL
+        value: "bedrock-claude-sonnet-4"  # This refers to the key name in modelList below
 
     # Configure at least one model using modelList
     modelList:
@@ -86,10 +89,6 @@ Configure HolmesGPT to use AWS Bedrock foundation models.
           anthropic-beta: context-1m-2025-08-07
         custom_args:
           max_context_size: 1000000
-
-    # Optional: Set default model (use modelList key name)
-    config:
-      model: "bedrock-claude-sonnet-4"  # This refers to the key name in modelList above
     ```
 
 === "Robusta Helm Chart"
@@ -117,6 +116,9 @@ Configure HolmesGPT to use AWS Bedrock foundation models.
             secretKeyRef:
               name: robusta-holmes-secret
               key: aws-secret-access-key
+        # Optional: Set default model (use modelList key name)
+        - name: MODEL
+          value: "bedrock-claude-sonnet-4"  # This refers to the key name in modelList below
 
       # Configure at least one model using modelList
       modelList:
@@ -143,10 +145,6 @@ Configure HolmesGPT to use AWS Bedrock foundation models.
             anthropic-beta: context-1m-2025-08-07
           custom_args:
             max_context_size: 1000000
-
-      # Optional: Set default model (use modelList key name)
-      config:
-        model: "bedrock-claude-sonnet-4"  # This refers to the key name in modelList above
     ```
 
 ### Using Claude Sonnet with 1M Context Window
@@ -198,9 +196,10 @@ If you're running HolmesGPT on Kubernetes with IRSA, you can authenticate withou
           budget_tokens: 10000
           type: enabled
 
-    # Optional: Set default model (use modelList key name)
-    config:
-      model: "bedrock-claude-sonnet-4"
+    additionalEnvVars:
+      # Optional: Set default model (use modelList key name)
+      - name: MODEL
+        value: "bedrock-claude-sonnet-4"
     ```
 
 === "Robusta Helm Chart"
@@ -223,9 +222,10 @@ If you're running HolmesGPT on Kubernetes with IRSA, you can authenticate withou
             budget_tokens: 10000
             type: enabled
 
-      # Optional: Set default model (use modelList key name)
-      config:
-        model: "bedrock-claude-sonnet-4"
+      additionalEnvVars:
+        # Optional: Set default model (use modelList key name)
+        - name: MODEL
+          value: "bedrock-claude-sonnet-4"
     ```
 
 **Note:** With IRSA, you do not need `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`. The AWS SDK picks up the injected token automatically.
@@ -281,25 +281,7 @@ For the CLI:
 export EXTRA_HEADERS="{\"anthropic-beta\": \"context-1m-2025-08-07\"}"
 ```
 
-Or, for Helm:
-
-    # values.yaml
-    holmes:
-      ...
-      modelList:
-        ...
-        bedrock-claude-sonnet-4-1M-context:
-          aws_access_key_id: "{{ env.AWS_ACCESS_KEY_ID }}"
-          aws_secret_access_key: "{{ env.AWS_SECRET_ACCESS_KEY }}"
-          aws_region_name: eu-south-2
-          model: bedrock/eu.anthropic.claude-sonnet-4-20250514-v1:0
-          temperature: 1
-          thinking:
-            budget_tokens: 10000
-            type: enabled
-          extra_headers:
-            anthropic-beta: context-1m-2025-08-07
-
+For the Helm charts, set `extra_headers` on the model's `modelList` entry, as the `bedrock-claude-sonnet-4-1M-context` entry in the Holmes Helm Chart and Robusta Helm Chart tabs above does.
 
 ## Additional Resources
 
```

**File**: `docs/ai-providers/azure-ai-foundry.md` (modified, +17/-20)
```diff
@@ -56,6 +56,9 @@ The examples below lead with the Anthropic option and include a GPT deployment a
           secretKeyRef:
             name: holmes-secrets
             key: azure-api-key
+      # Optional: Set default model (use modelList key name)
+      - name: MODEL
+        value: "azure-opus-4-7"  # This refers to the key name in modelList below
 
     # Configure at least one model using modelList
     modelList:
@@ -72,10 +75,6 @@ The examples below lead with the Anthropic option and include a GPT deployment a
         model: azure/my-gpt-5.4-deployment
         api_base: https://YYYY.cognitiveservices.azure.com/
         api_version: "2025-04-01-preview"
-
-    # Optional: Set default model (use modelList key name)
-    config:
-      model: "azure-opus-4-7"  # This refers to the key name in modelList above
     ```
 
 === "Robusta Helm Chart"
@@ -97,6 +96,9 @@ The examples below lead with the Anthropic option and include a GPT deployment a
             secretKeyRef:
               name: robusta-holmes-secret
               key: azure-api-key
+        # Optional: Set default model (use modelList key name)
+        - name: MODEL
+          value: "azure-opus-4-7"  # This refers to the key name in modelList below
 
       # Configure at least one model using modelList
       modelList:
@@ -113,10 +115,6 @@ The examples below lead with the Anthropic option and include a GPT deployment a
           model: azure/my-gpt-5.4-deployment
           api_base: https://YYYY.cognitiveservices.azure.com/
           api_version: "2025-04-01-preview"
-
-      # Optional: Set default model (use modelList key name)
-      config:
-        model: "azure-opus-4-7"  # This refers to the key name in modelList above
     ```
 
 ## Using CLI Parameters
@@ -217,7 +215,7 @@ When running as a pod in AKS, use [AKS Workload Identity](https://learn.microsof
 
     - AKS cluster with OIDC issuer and workload identity enabled
     - A managed identity with the **Cognitive Services OpenAI User** role on your Azure AI Foundry resource
-    - A federated credential linking the managed identity to the Holmes ServiceAccount
+    - A federated credential linking the managed identity to the Holmes ServiceAccount, which the chart names `<release>-holmes-service-account` by default (`holmes-holmes-service-account` for the install guide's `holmes` release). If you set `customServiceAccountName`, the credential's subject uses that name; with `createServiceAccount: false`, Holmes runs as the namespace's `default` ServiceAccount
 
     **Set up the identity and federation:**
 
@@ -242,7 +240,7 @@ When running as a pod in AKS, use [AKS Workload Identity](https://learn.microsof
       --identity-name holmes-identity \
       --resource-group <rg> \
       --issuer "$OIDC_ISSUER" \
-      --subject "system:serviceaccount:<namespace>:holmes" \
+      --subject "system:serviceaccount:<namespace>:holmes-holmes-service-account" \
       --audiences "api://AzureADTokenExchange"
     ```
 
@@ -257,12 +255,14 @@ When running as a pod in AKS, use [AKS Workload Identity](https://learn.microsof
         value: "<managed-identity-client-id>"
       - name: AZURE_TENANT_ID
         value: "<tenant-id>"
+      - name: MODEL
+        value: "azure-opus-4-7"
 
     serviceAccount:
       annotations:
         azure.workload.identity/client-id: "<managed-identity-client-id>"
 
-    podLabels:
+    commonLabels:
       azure.workload.identity/use: "true"
 
     modelList:
@@ -277,9 +277,6 @@ When running as a pod in AKS, use [AKS Workload Identity](https://learn.microsof
         model: azure/my-gpt-5.4-deployment
         api_base: https://YYYY.cognitiveservices.azure.com/
         api_version: "2025-04-01-preview"
-
-    config:
-      model: "azure-opus-4-7"
     ```
 
     Note that `api_key` is omitted from the `modelList` entries — authentication is handled entirely by the workload identity token.
@@ -298,12 +295,14 @@ When running as a pod in AKS, use [AKS Workload Identit
```

**File**: `docs/ai-providers/baseten.md` (modified, +4/-6)
```diff
@@ -34,6 +34,8 @@ Use LiteLLM's native `baseten/` prefix with the Baseten model slug (`baseten/<or
           secretKeyRef:
             name: holmes-secrets
             key: baseten-api-key
+      - name: MODEL
+        value: "glm-5-3"  # modelList key name
 
     modelList:
       glm-5-3:
@@ -45,9 +47,6 @@ Use LiteLLM's native `baseten/` prefix with the Baseten model slug (`baseten/<or
         output_cost_per_token: 0.000015
         custom_args:
           max_context_size: 1048576
-
-    config:
-      model: "glm-5-3"  # modelList key name
     ```
 
 === "Robusta Helm Chart"
@@ -69,6 +68,8 @@ Use LiteLLM's native `baseten/` prefix with the Baseten model slug (`baseten/<or
             secretKeyRef:
               name: robusta-holmes-secret
               key: baseten-api-key
+        - name: MODEL
+          value: "glm-5-3"  # modelList key name
 
       modelList:
         glm-5-3:
@@ -80,9 +81,6 @@ Use LiteLLM's native `baseten/` prefix with the Baseten model slug (`baseten/<or
           output_cost_per_token: 0.000015
           custom_args:
             max_context_size: 1048576
-
-      config:
-        model: "glm-5-3"  # modelList key name
     ```
 
 ## Models missing from LiteLLM
```

---

### Incident Patch 2: `a045ec72` (2026-09-28)
**Commit Message**: Fix pytds certificate validation for pyOpenSSL >= 26.2 (#2505)

## Summary

Fixes a compatibility issue where python-tds fails to validate TLS
certificates when using pyOpenSSL >= 26.2 with cryptography >= 50. The
stock pytds `validate_host` function calls the removed
`X509.get_extension()` method, causing `AttributeError` when the
certificate CN differs from the hostname.

## Changes

- **Added `_pytds_validate_host()` function** in
`holmes/plugins/toolsets/database/database.py`:
- Drop-in replacement for `pytds.tls.validate_host` that uses
cryptography library instead of deprecated pyOpenSSL APIs
  - Validates hostnames against certificate CN and SAN DNS names
- Supports wildcard certificates (first label only, matching pytds
semantics)
  - Case-insensitive matching per RFC standards

- **Patched pytds at module load time**:
- Sets `pytds.tls.validate_host = _pytds_validate_host` so the custom
validator is used during TLS handshakes

- **Added comprehensive test coverage** in
`tests/test_database_toolset.py`:
- Helper function `_make_cert()` to generate test certificates with
various CN/SAN configurations
  - `TestPytdsValidateHost` class with 7 test cases covering:
    - CN matc

**File**: `holmes/plugins/toolsets/database/database.py` (modified, +59/-1)
```diff
@@ -1,15 +1,19 @@
+import ipaddress
 import json
 import logging
 import os
 import re
 from abc import ABC
 from dataclasses import dataclass
 from enum import Enum
-from typing import Any, ClassVar, Dict, List, Optional, Tuple, Type
+from typing import Any, ClassVar, Dict, List, Optional, Tuple, Type, Union
 from urllib.parse import quote, unquote, urlparse
 
 import certifi
+import pytds.tls
 import requests
+from cryptography import x509
+from cryptography.x509.oid import NameOID
 from pydantic import ConfigDict, Field, model_validator
 
 from holmes.core.tools import (
@@ -30,6 +34,60 @@
 
 logger = logging.getLogger(__name__)
 
+
+def _dns_name_matches(pattern: str, host: str) -> bool:
+    pattern = pattern.lower()
+    if pattern == host:
+        return True
+    # Wildcard only as the entire first label, matching exactly one label.
+    if pattern.startswith("*.") and "." in host:
+        return pattern[2:] == host.split(".", 1)[1]
+    return False
+
+
+def _pytds_validate_host(cert, name: bytes) -> bool:
+    """Drop-in for pytds.tls.validate_host that reads the certificate via cryptography.
+
+    python-tds (<= 1.17.1) calls X509.get_extension(), which pyOpenSSL removed in
+    26.2.0; our cryptography>=50 floor (CVE fix) requires pyOpenSSL >= 26.3, so the
+    stock function raises AttributeError whenever the certificate CN differs from
+    the host name. Matching follows RFC 6125: an IP host is checked against IP
+    SANs, a DNS host against DNS SANs, and the CN is consulted only when the
+    certificate has no SAN of the host's type.
+    """
+    host = name.decode("ascii").lower()
+    crypto_cert = cert.to_cryptography()
+
+    try:
+        san = crypto_cert.extensions.get_extension_for_class(
+            x509.SubjectAlternativeName
+        ).value
+        san_dns = san.get_values_for_type(x509.DNSName)
+        san_ips = san.get_values_for_type(x509.IPAddress)
+    except x509.ExtensionNotFound:
+        san_dns, san_ips = [], []
+
+    try:
+        host_ip: Optional[Union[ipaddress.IPv4Address, ipaddress.IPv6Address]] = (
+            ipaddress.ip_address(host)
+        )
+    except ValueError:
+        host_ip = None
+
+    if host_ip is not None and san_ips:
+        return host_ip in san_ips
+    if host_ip is None and san_dns:
+        return any(_dns_name_matches(entry, host) for entry in san_dns)
+
+    return any(
+        str(attr.value).lower() == host
+        for attr in crypto_cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)
+    )
+
+
+# pytds resolves validate_host as a module global during the TLS handshake.
+pytds.tls.validate_host = _pytds_validate_host
+
 # SQL statements that are safe for read-only access
 _READONLY_PATTERN = re.compile(
     r"^\s*(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN|WITH)\b",
```

**File**: `tests/test_database_toolset.py` (modified, +76/-0)
```diff
@@ -1,10 +1,18 @@
 """Unit tests for the database toolset."""
 
+import datetime
+import ipaddress
 import os
 import tempfile
 
 import certifi
+import pytds.tls
 import pytest
+from cryptography import x509
+from cryptography.hazmat.primitives import hashes
+from cryptography.hazmat.primitives.asymmetric import ec
+from cryptography.x509.oid import NameOID
+from OpenSSL import crypto
 from pydantic import ValidationError
 
 sqlalchemy = pytest.importorskip("sqlalchemy")
@@ -22,6 +30,7 @@
     _icon_url_for_subtype,
     _lookup_driver_info,
     _normalise_url,
+    _pytds_validate_host,
     _serialize_value,
 )
 
@@ -587,3 +596,70 @@ def test_meta_updated_after_prerequisites(self):
             {"connection_url": "sqlite:///path/to/db"}
         )
         assert toolset.meta == {"type": "database", "subtype": "sqlite"}
+
+
+def _make_cert(cn, dns_names=(), ips=()):
+    key = ec.generate_private_key(ec.SECP256R1())
+    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)])
+    now = datetime.datetime.now(datetime.timezone.utc)
+    builder = (
+        x509.CertificateBuilder()
+        .subject_name(subject)
+        .issuer_name(subject)
+        .public_key(key.public_key())
+        .serial_number(x509.random_serial_number())
+        .not_valid_before(now)
+        .not_valid_after(now + datetime.timedelta(days=1))
+    )
+    sans = [x509.DNSName(d) for d in dns_names] + [
+        x509.IPAddress(ipaddress.ip_address(i)) for i in ips
+    ]
+    if sans:
+        builder = builder.add_extension(
+            x509.SubjectAlternativeName(sans), critical=False
+        )
+    # pytds hands validate_host a pyOpenSSL X509, so the tests do too.
+    return crypto.X509.from_cryptography(builder.sign(key, hashes.SHA256()))
+
+
+class TestPytdsValidateHost:
+    def test_patch_installed(self):
+        assert pytds.tls.validate_host is _pytds_validate_host
+
+    def test_cn_match(self):
+        assert _pytds_validate_host(_make_cert("sql.example.com"), b"sql.example.com")
+
+    def test_san_match_when_cn_differs(self):
+        # The case that raised AttributeError with stock pytds on pyOpenSSL >= 26.2.
+        cert = _make_cert("other", dns_names=["a.example.com", "sql.example.com"])
+        assert _pytds_validate_host(cert, b"sql.example.com")
+
+    def test_case_insensitive(self):
+        cert = _make_cert("other", dns_names=["SQL.Example.com"])
+        assert _pytds_validate_host(cert, b"sql.example.COM")
+
+    def test_wildcard_first_label_only(self):
+        cert = _make_cert("other", dns_names=["*.example.com"])
+        assert _pytds_validate_host(cert, b"sql.example.com")
+        assert not _pytds_validate_host(cert, b"a.sql.example.com")
+        assert not _pytds_validate_host(cert, b"example.com")
+
+    def test_no_match(self):
+        cert = _make_cert("other", dns_names=["a.example.com"], ips=["10.0.0.1"])
+        assert not _pytds_validate_host(cert, b"sql.example.com")
+
+    def test_ip_san_match(self):
+        cert = _make_cert("other", dns_names=["a.example.com"], ips=["10.0.0.1"])
+        assert _pytds_validate_host(cert, b"10.0.0.1")
+        assert not _pytds_validate_host(cert, b"10.0.0.2")
+
+    def test_cn_ignored_when_dns_san_present(self):
+        cert = _make_cert("sql.example.com", dns_names=["other.example.com"])
+        assert not _pytds_validate_host(cert, b"sql.example.com")
+
+    def test_cn_fallback_for_ip_without_ip_san(self):
+        cert = _make_cert("10.0.0.1", dns_names=["a.example.com"])
+        assert _pytds_validate_host(cert, b"10.0.0.1")
+
+    def test_no_san_extension(self):
+        assert not _pytds_validate_host(_make_cert("other"), b"sql.example.com")
```

---

### Incident Patch 3: `96715d65` (2026-09-22)
**Commit Message**: ROB-1346 Show real allow-list prefixes in the bash toolset docs (#2495)

## Problem

The bash toolset docs showed `allow:` entries as `"my-custom-tool"` /
`"my-custom-command"`. A placeholder tells the reader nothing about the
one thing that is non-obvious here: how narrowly a prefix can be scoped,
and which commands are worth adding (the builtin `core`/`extended` lists
already cover kubectl read verbs, grep, cat, …).

## Change

- Both config examples (CLI + Robusta Helm chart) now use three prefixes
that are deliberately **not** in either builtin list: `helm list`,
`kubectl rollout history`, and a `curl` pinned to a single Prometheus
endpoint.
- Same three as a commented example in `helm/holmes/values.yaml`, next
to `builtin_allowlist`.
- A three-row table under **Prefix Matching** showing, per entry, what
it allows and what still prompts for approval — plus the ordering
gotcha: matching starts at the beginning of the command, so `curl -s
<url>` does **not** match a `curl <url>` prefix (put flags last).

## Verification

Each row was checked against the real validator
(`holmes.plugins.toolsets.bash.validation.validate_command`) with those
three prefixes in `allow` and `builtin_al

**File**: `docs/data-sources/builtin-toolsets/bash.md` (modified, +33/-4)
```diff
@@ -17,8 +17,10 @@ The bash toolset allows Holmes to execute shell commands for troubleshooting and
         enabled: true
         config:
           builtin_allowlist: "core"  # "none", "core", or "extended"
-          allow:                     # additional prefixes (merged with builtins)
-            - "my-custom-tool"
+          # allow:
+          #   - "helm list"
+          #   - "kubectl rollout history"
+          #   - "curl https://prometheus.monitoring.svc:9090/api/v1"
           deny:
             - "kubectl get secret"
             - "kubectl describe secret"
@@ -42,8 +44,10 @@ The bash toolset allows Holmes to execute shell commands for troubleshooting and
           enabled: true
           config:
             builtin_allowlist: "extended"
-            allow:
-              - "my-custom-command"
+            # allow:
+            #   - "helm list"
+            #   - "kubectl rollout history"
+            #   - "curl https://prometheus.monitoring.svc:9090/api/v1"
             deny:
               - "kubectl get secret"
     ```
@@ -114,6 +118,31 @@ kubectl get pods | grep error | head -10
 
 This requires `kubectl get`, `grep`, and `head` to all be allowed.
 
+A prefix can be as narrow as you like — it is matched against the start of the
+command and must end on a whitespace or `/` boundary, so it can pin a subcommand
+or the leading part of a URL. It constrains the start of the command and nothing
+else; read the warning under the table before relying on a URL-scoped entry.
+
+| Allow entry | Allows | Still needs approval |
+|-------------|--------|----------------------|
+| `helm list` | `helm list -A`, `helm list -n prod -o json` | `helm upgrade my-release ./chart` |
+| `kubectl rollout history` | `kubectl rollout history deployment/nginx` | `kubectl rollout restart deployment/nginx` |
+| `curl https://prometheus.monitoring.svc:9090/api/v1` | `curl https://prometheus.monitoring.svc:9090/api/v1/targets` | `curl https://example.com` |
+
+!!! warning "A prefix does not restrict where a command goes"
+    It constrains the start of the command and nothing else. With the `curl`
+    entry above, `curl https://prometheus.monitoring.svc:9090/api/v1/targets
+    https://example.com` also matches, and so does the same command with
+    `--next` or `-o`, because each still *starts* with the allowed prefix.
+    `deny` entries are matched the same way, so they don't catch it either.
+    A URL-scoped prefix cuts approval prompts for the endpoint you use most;
+    it is not an egress control. If Holmes must not reach other destinations,
+    leave `curl` out of the allow list and approve each command as it comes up.
+
+Because matching starts at the beginning of the command, put the part you are
+scoping on first and flags last — `curl https://host/api/v1/targets -s` matches
+the prefix above, `curl -s https://host/api/v1/targets` does not.
+
 ## Large Tool Result Storage
 
 When a tool response exceeds the LLM context window limit, Holmes saves the result to disk and gives the LLM a file path. The bash toolset automatically allows read-only commands (`cat`, `head`, `tail`, `wc`, `jq`) on the storage directory so the LLM can access saved results without approval prompts.
```

---

### Incident Patch 4: `a6f2b40b` (2026-09-22)
**Commit Message**: Fix High/Critical CVEs in the Holmes image: bump grpc, x/crypto, Helm 3.22 (#2494)

## Summary

Trivy and Grype scans of the image built from `master` (a84578a72)
flagged six Critical/High advisories, all in Go dependencies compiled
into the `argocd` and `helm` binaries. The Alpine base, Python venv and
kubectl were clean. This PR clears all six; the rebuilt image scans with
**zero Critical/High** in both scanners.

| Severity | CVE | Package | Binaries | Fix |
|---|---|---|---|---|
| High | CVE-2026-84304 | grpc v1.82.1 | argocd, helm | grpc → v1.83.2 |
| High | CVE-2026-84445 | grpc v1.82.1 | argocd, helm | grpc → v1.83.2 |
| High | CVE-2026-56855 | x/crypto v0.55.0 | argocd, helm | x/crypto →
v0.56.0 |
| High | CVE-2026-78662 | x/crypto v0.55.0 | argocd, helm | x/crypto →
v0.56.0 |
| Critical (NVD) | CVE-2026-53492 | containerd v1.7.33 | helm | Helm →
v3.22.0 (drops containerd) |
| Critical (NVD) | CVE-2026-50195 | containerd v1.7.33 | helm | Helm →
v3.22.0 (drops containerd) |

The two containerd findings are in CRI checkpoint code that helm never
linked (only `containerd/remotes` and `containerd/errdefs` were compiled
in), and upstream only lists v2 ranges as affected. There i

**File**: `bin/go-cve-rebuild/amd64/argocd.gz.sha256` (modified, +1/-1)
```diff
@@ -1 +1 @@
-3fdedcc3cadac04f589879d390429b2f05cb207b9f7fd61d1571eb4665836acd  argocd.gz
+039bf1889882455ae7682a3b653a84e9049df79752ce446b250eb7d3d43369e8  argocd.gz
```

**File**: `bin/go-cve-rebuild/amd64/helm.gz.sha256` (modified, +1/-1)
```diff
@@ -1 +1 @@
-69399ee7cd04540e70bc5e6a16ec26339716558605114cd9ebb5dcd74d3ba8c4  helm.gz
+befbc8b2f58044fb8f48df373e4396beeead7760591915b4a867afc1cda764bb  helm.gz
```

**File**: `bin/go-cve-rebuild/arm64/argocd.gz.sha256` (modified, +1/-1)
```diff
@@ -1 +1 @@
-381312fcd9d5aba1f7576faf6c2229dd1d8c85f345fda3633f77d21fc1492adc  argocd.gz
+1189d9a07f0d33521075a63a9e42c558881e62b3f7a92cbdd108cd1307166aa8  argocd.gz
```

**File**: `bin/go-cve-rebuild/arm64/helm.gz.sha256` (modified, +1/-1)
```diff
@@ -1 +1 @@
-d137abc042adedadd405fed5784733cd4e9de6bffe0e292f5077de5e9fefe034  helm.gz
+0d777fca3853b826420f007a5b9c7982412c715eab0cd1b3c5d395590c04efac  helm.gz
```

**File**: `scripts/build_go_binaries.sh` (modified, +31/-22)
```diff
@@ -7,18 +7,22 @@
 #
 # Two x/* replaces are applied to every binary that pulls them in, because the
 # same advisories hit all of them:
-#   golang.org/x/net    -> v0.57.0  CVE-2026-33814 (fixed 0.53.0) plus
+#   golang.org/x/net    -> v0.59.0  CVE-2026-33814 (fixed 0.53.0) plus
 #                                   CVE-2026-25681/27136/39821 (High) and
 #                                   CVE-2026-25680/42502/42506 (Medium, >60d),
 #                                   all fixed in 0.55.0; 0.56.0 adds the
-#                                   CVE-2026-46600 fix.
-#   golang.org/x/crypto -> v0.55.0  CVE-2026-39828/39829/39830/39831/39832/39835/
+#                                   CVE-2026-46600 fix. 0.59.0 is not
+#                                   CVE-driven: grpc v1.83.2 requires x/net
+#                                   >= 0.58.0, so the pin must stay at or
+#                                   above that.
+#   golang.org/x/crypto -> v0.56.0  CVE-2026-39828/39829/39830/39831/39832/39835/
 #                                   42508/46595/46597 (High) and CVE-2026-39827/
 #                                   39833/39834/46598 (Medium, >60d), all fixed
 #                                   in 0.52.0; 0.55.0 adds the CVE-2026-56854
-#                                   fix and stays >= what x/net v0.57.0 requires.
-# Bumping x/net to 0.57.0 also drags x/sys to 0.47.0 and x/text to 0.40.0 through
-# MVS, which clears CVE-2026-39824 (x/sys) and CVE-2026-56852 (x/text).
+#                                   fix; 0.56.0 adds the SSH mux deadlock fixes
+#                                   CVE-2026-56855/78662 (GO-2026-6355/6354, High).
+# Bumping x/net to >= 0.57.0 also drags x/sys to 0.47.0 and x/text to 0.40.0
+# through MVS, which clears CVE-2026-39824 (x/sys) and CVE-2026-56852 (x/text).
 #
 # ArgoCD: rebuilt from v3.3.11 source with go-git replaced to v5.19.2 and
 #   go-billy replaced to v5.9.0. ArgoCD pins go-git v5.14.0 upstream
@@ -29,17 +33,25 @@
 #   CVE-2026-71556 (High) / CVE-2026-71557 (Medium) (both fixed 5.19.2);
 #   go-billy v5.6.2 is vulnerable to CVE-2026-44973 (fixed 5.9.0).
 #   v3.3.11 already ships otel/sdk 1.43.0 so the old otel replace was dropped.
-#   Also replaced: grpc -> v1.82.1 (GHSA-hrxh-6v49-42gf), oras-go -> v2.6.2
-#   (CVE-2026-50151/50163), mongo-driver -> v1.17.7 (CVE-2026-2303, Medium, >60d).
+#   Also replaced: grpc -> v1.83.2 (GHSA-hrxh-6v49-42gf, plus CVE-2026-84304
+#   HTTP/2 DATA-frame heap exhaustion fixed 1.83.1 and CVE-2026-84445 xDS
+#   server panic fixed 1.83.2), oras-go -> v2.6.2 (CVE-2026-50151/50163),
+#   mongo-driver -> v1.17.7 (CVE-2026-2303, Medium, >60d).
 #   Revert to plain upstream binary when ArgoCD ships go-git >= 5.19.2 and
 #   go-billy >= 5.9.0 (blocked on go-git/go-git#1551 upstream).
 #
-# Helm: built from v3.21.0 with containerd replaced to v1.7.33 (CVE-2026-53488
-#   High + CVE-2026-47262; v3.21.0 ships v1.7.30), grpc replaced to v1.82.1
-#   (GHSA-hrxh-6v49-42gf; v3.21.0 ships v1.80.0) and oras-go replaced to v2.6.2
-#   (CVE-2026-50151/50163).
+# Helm: built from v3.22.0 with grpc replaced to v1.83.2 (GHSA-hrxh-6v49-42gf,
+#   CVE-2026-84304/84445; v3.22.0 lists v1.82.1 as an indirect dep, but grpc is
+#   no longer compiled into the helm binary at all since containerd went away,
+#   so this replace is only a floor) and oras-go replaced to v2.6.2
+#   (CVE-2026-50151/50163; v3.22.0 already ships v2.6.2, the replace is kept as
+#   a floor). v3.22.0 dropped the github.com/containerd/containerd dependency
+#   entirely, so the old containerd -> v1.7.33 replace (CVE-2026-53488/47262)
+#   is gone; that also removes the containerd v1 false positives
+#   GO-2026-5064/5338 (CVE-2026-53492/50195, CRI checkpoint code Helm never
+#   linked) that scanners flagged as Critical.
 #   Revert to upstream binary when Helm releases a version built with
-#   Go >= 1.26.6, containerd >= 1.7.33, grpc >= 1.82.1 and oras-go >= 2.6.2.
+#   Go >= 1.26.6, grpc >= 1.83.2, x/crypto >= 0.5
```

---

### Incident Patch 5: `9fbfadd3` (2026-09-16)
**Commit Message**: ROB-1395: Fix Coralogix UI permalinks for US2 and other regions (#2478)

## What

Fixes broken Coralogix UI permalinks
([ROB-1395](https://linear.app/robusta/issue/ROB-1395/support-coralogix-us2-ui-permalinks)).
Permalinks were built as `https://{team_slug}.{domain}`, reusing the
configured **API** domain — but the Coralogix team UI lives on a
**different hostname in most regions** (per the [official Coralogix
domain
table](https://coralogix.com/docs/user-guides/account-management/account-settings/coralogix-domain/)).

## The bug (verified against live Coralogix endpoints)

| Configured `domain` | Old permalink host | Result | Correct UI host |
|---|---|---|---|
| `us2.coralogix.com` (**reported case**) | `<team>.us2.coralogix.com` |
❌ TLS cert mismatch | `<team>.app.cx498.coralogix.com` |
| `us1.coralogix.com` | `<team>.us1.coralogix.com` | ❌ TLS cert mismatch
| `<team>.app.coralogix.us` |
| `coralogix.us` (from Holmes' own config examples) |
`<team>.coralogix.us` | ❌ NXDOMAIN | `<team>.app.coralogix.us` |
| `coralogix.in` (from Holmes' own config examples) |
`<team>.coralogix.in` | ❌ NXDOMAIN | `<team>.app.coralogix.in` |
| `eu2.coralogix.com` | `<team>.eu2.coralogix.com` | ⚠️ wo

**File**: `conftest.py` (modified, +2/-0)
```diff
@@ -275,6 +275,8 @@ def responses():
         rsps.add_passthru(re.compile(r"https://.*\.coralogix\.com"))
         rsps.add_passthru(re.compile(r"https://.*\.coralogix\.us"))
         rsps.add_passthru(re.compile(r"https://.*\.coralogix\.in"))
+        # Coralogix docs site (domain-table drift check in test_domain_map_sync.py)
+        rsps.add_passthru("https://coralogix.com")
 
         # Allow Elasticsearch/OpenSearch Cloud API calls (various hosting regions)
         rsps.add_passthru(re.compile(r"https://.*\.cloud\.es\.io"))  # Elastic Cloud
```

**File**: `docs/data-sources/builtin-toolsets/coralogix-logs.md` (modified, +2/-0)
```diff
@@ -14,6 +14,8 @@ You can find your `domain` and `team_slug` from the URL you use to access Coralo
 
 Configure both the Coralogix DataPrime toolset (for logs/traces) and the Prometheus metrics toolset (for metrics) using the same API key. The `team_slug` field is optional — it's only used to generate clickable permalink URLs that open query results in the Coralogix UI.
 
+Holmes automatically derives the UI hostname for permalinks from your `domain` — the Coralogix UI uses a different hostname than the API in most regions. For example, with the US2 domain (`us2.coralogix.com` or `cx498.coralogix.com`) permalinks point to `https://<team_slug>.app.cx498.coralogix.com`. If your team's UI lives at a non-standard address, set the optional `ui_url` field to its full base URL (e.g. `ui_url: "https://my-team.app.cx498.coralogix.com"`) to override the derived hostname.
+
 === "Holmes CLI"
 
     Add the following to **~/.holmes/config.yaml**. Create the file if it doesn't exist:
```

**File**: `holmes/plugins/toolsets/coralogix/toolset_coralogix.py` (modified, +9/-5)
```diff
@@ -19,7 +19,11 @@
     execute_dataprime_query,
     health_check,
 )
-from holmes.plugins.toolsets.coralogix.utils import CoralogixConfig, normalize_datetime
+from holmes.plugins.toolsets.coralogix.utils import (
+    CoralogixConfig,
+    get_ui_base_url,
+    normalize_datetime,
+)
 from holmes.plugins.toolsets.utils import toolset_name_for_one_liner
 
 
@@ -32,10 +36,11 @@ def _build_coralogix_query_url(
 ) -> Optional[str]:
     """Build a clickable Coralogix UI permalink URL.
 
-    Returns None if team_slug is not configured (it's optional).
+    Returns None if neither team_slug nor ui_url is configured (both are optional).
     """
-    # team_slug is optional - without it we can't build UI URLs
-    if not config.team_slug:
+    # without team_slug or ui_url we can't build UI URLs
+    base_url = get_ui_base_url(config)
+    if not base_url:
         return None
 
     try:
@@ -51,7 +56,6 @@ def _build_coralogix_query_url(
 
         encoded_query = quote(query)
         encoded_time = quote(time_range)
-        base_url = f"https://{config.team_slug}.{config.domain}"
 
         url = (
             f"{base_url}/#/query-new/{data_pipeline}"
```

**File**: `holmes/plugins/toolsets/coralogix/utils.py` (modified, +90/-5)
```diff
@@ -42,6 +42,40 @@ class CoralogixLabelsConfig(ToolsetConfig):
     )
 
 
+# Official mapping of Coralogix account domains to the "Team Hostname" suffix used
+# by the web UI, per https://coralogix.com/docs/user-guides/account-management/account-settings/coralogix-domain/
+# The UI permalink hostname is f"{team_slug}.{suffix}" and differs from the API
+# domain in most regions: e.g. the US2 API domain is us2.coralogix.com (legacy:
+# cx498.coralogix.com) but the US2 UI lives at <team>.app.cx498.coralogix.com.
+# Both the current regional domains (us2.coralogix.com) and the legacy ones
+# (cx498.coralogix.com) are accepted as keys since either works for API calls.
+CORALOGIX_TEAM_HOSTNAME_SUFFIXES: Dict[str, str] = {
+    # US1 - AWS us-east-2 (Ohio)
+    "us1.coralogix.com": "app.coralogix.us",
+    "coralogix.us": "app.coralogix.us",
+    # US2 - AWS us-west-2 (Oregon)
+    "us2.coralogix.com": "app.cx498.coralogix.com",
+    "cx498.coralogix.com": "app.cx498.coralogix.com",
+    # US3 - GCP us-central1 (Iowa)
+    "us3.coralogix.com": "app.us3.coralogix.com",
+    # EU1 - AWS eu-west-1 (Ireland); the only region without an 'app.' prefix
+    "eu1.coralogix.com": "coralogix.com",
+    "coralogix.com": "coralogix.com",
+    # EU2 - AWS eu-north-1 (Stockholm)
+    "eu2.coralogix.com": "app.eu2.coralogix.com",
+    # AP1 - AWS ap-south-1 (Mumbai)
+    "ap1.coralogix.com": "app.coralogix.in",
+    "coralogix.in": "app.coralogix.in",
+    # AP2 - AWS ap-southeast-1 (Singapore)
+    "ap2.coralogix.com": "app.coralogixsg.com",
+    "coralogixsg.com": "app.coralogixsg.com",
+    # AP3 - AWS ap-southeast-3 (Jakarta)
+    "ap3.coralogix.com": "app.ap3.coralogix.com",
+    # GOV1 - AWS GovCloud us-gov-west-1 (FedRAMP)
+    "gov1.coralogixgov.us": "app.gov1.coralogixgov.us",
+}
+
+
 class CoralogixConfig(ToolsetConfig):
     """Coralogix toolset configuration.
 
@@ -50,16 +84,18 @@ class CoralogixConfig(ToolsetConfig):
         api_key: API key with DataQuerying permissions
 
     Optional:
-        team_slug: Your team's URL slug (e.g., "my-team" from https://my-team.eu2.coralogix.com).
+        team_slug: Your team's URL slug (e.g., "my-team" from https://my-team.app.eu2.coralogix.com).
                    Only needed to generate clickable UI permalink URLs in tool output.
+        ui_url: Full base URL of your team's Coralogix UI. Only needed when the
+                auto-derived UI hostname is wrong (e.g. custom deployments).
         labels: Label mappings for log fields (for Kubernetes log extraction)
     """
 
     model_config = ConfigDict(extra="allow")
     domain: str = Field(
         title="Domain",
         description="Coralogix domain",
-        examples=["eu2.coralogix.com", "coralogix.us", "coralogix.in"],
+        examples=["eu2.coralogix.com", "us2.coralogix.com", "coralogix.us"],
     )
     api_key: str = Field(
         title="API Key",
@@ -71,6 +107,13 @@ class CoralogixConfig(ToolsetConfig):
         description="Your team's URL slug for generating UI permalinks",
         examples=["my-team"],
     )
+    ui_url: Optional[str] = Field(
+        default=None,
+        title="UI URL",
+        description="Base URL of your team's Coralogix UI, used for generating UI permalinks. "
+        "Overrides the hostname otherwise derived from 'team_slug' and 'domain'.",
+        examples=["https://my-team.app.cx498.coralogix.com"],
+    )
     labels: CoralogixLabelsConfig = Field(
         default_factory=CoralogixLabelsConfig,
         title="Labels",
@@ -84,15 +127,57 @@ def handle_deprecated_fields(self):
         deprecated = []
 
         # team_hostname was renamed to team_slug
-        if "team_hostname" in extra and not self.team_slug:
-            self.team_slug = extra["team_hostname"]
+        if "team_hostname" in extra:
+            if not self.team_slug:
+                self.team_slug = extra["team_hostname"]
+            extra.pop("team_hostname")
             deprecated.append("team_hostname -> team_sl
```

**File**: `tests/plugins/toolsets/coralogix/test_coralogix.py` (modified, +224/-0)
```diff
@@ -14,6 +14,7 @@
 )
 from holmes.plugins.toolsets.coralogix.utils import (
     CoralogixConfig,
+    get_ui_base_url,
     normalize_datetime,
 )
 
@@ -48,6 +49,229 @@ def test_normalize_datetime(input_date, expected_output):
     assert normalize_datetime(input_date) == expected_output
 
 
+class TestUIPermalinkBaseURL:
+    """Tests for get_ui_base_url (ROB-1395).
+
+    The Coralogix team UI hostname differs from the API domain in most regions
+    (e.g. US2 API domain is us2.coralogix.com / cx498.coralogix.com but the UI
+    lives at <team>.app.cx498.coralogix.com), so permalinks must not reuse the
+    API domain verbatim.
+    """
+
+    @pytest.mark.parametrize(
+        "domain,expected_host",
+        [
+            # US1 (Ohio)
+            ("us1.coralogix.com", "app.coralogix.us"),
+            ("coralogix.us", "app.coralogix.us"),
+            # US2 (Oregon) - the originally reported bug
+            ("us2.coralogix.com", "app.cx498.coralogix.com"),
+            ("cx498.coralogix.com", "app.cx498.coralogix.com"),
+            # US3 (Iowa)
+            ("us3.coralogix.com", "app.us3.coralogix.com"),
+            # EU1 (Ireland) - only region whose team hostname has no 'app.' prefix
+            ("eu1.coralogix.com", "coralogix.com"),
+            ("coralogix.com", "coralogix.com"),
+            # EU2 (Stockholm)
+            ("eu2.coralogix.com", "app.eu2.coralogix.com"),
+            # AP1 (Mumbai)
+            ("ap1.coralogix.com", "app.coralogix.in"),
+            ("coralogix.in", "app.coralogix.in"),
+            # AP2 (Singapore)
+            ("ap2.coralogix.com", "app.coralogixsg.com"),
+            ("coralogixsg.com", "app.coralogixsg.com"),
+            # AP3 (Jakarta)
+            ("ap3.coralogix.com", "app.ap3.coralogix.com"),
+            # GOV1 (AWS GovCloud, FedRAMP)
+            ("gov1.coralogixgov.us", "app.gov1.coralogixgov.us"),
+        ],
+    )
+    def test_maps_api_domain_to_team_ui_hostname(self, domain, expected_host):
+        """Each documented Coralogix domain maps to its official team UI hostname."""
+        config = CoralogixConfig(api_key="k", team_slug="acme", domain=domain)
+        assert get_ui_base_url(config) == f"https://acme.{expected_host}"
+
+    @pytest.mark.parametrize(
+        "domain",
+        [
+            "US2.Coralogix.com",  # case-insensitive
+            " us2.coralogix.com ",  # surrounding whitespace
+            "us2.coralogix.com/",  # trailing slash
+            "us2.coralogix.com.",  # trailing dot (FQDN form)
+            "https://us2.coralogix.com",  # scheme pasted in by mistake
+        ],
+    )
+    def test_domain_is_normalized_before_mapping(self, domain):
+        """Domain casing/whitespace/scheme/trailing chars are normalized before lookup."""
+        config = CoralogixConfig(api_key="k", team_slug="acme", domain=domain)
+        assert get_ui_base_url(config) == "https://acme.app.cx498.coralogix.com"
+
+    def test_unknown_non_coralogix_domain_falls_back_to_domain_itself(self):
+        """Non-Coralogix (custom) domains keep the {team_slug}.{domain} behavior."""
+        config = CoralogixConfig(
+            api_key="k", team_slug="acme", domain="logs.my-company.internal"
+        )
+        assert get_ui_base_url(config) == "https://acme.logs.my-company.internal"
+
+    @pytest.mark.parametrize(
+        "domain,expected_host",
+        [
+            # hypothetical future regions: assume the modern app.<domain> scheme
+            # that us3/eu2/ap3 follow
+            ("us4.coralogix.com", "app.us4.coralogix.com"),
+            ("eu3.coralogix.com", "app.eu3.coralogix.com"),
+            ("me1.coralogix.com", "app.me1.coralogix.com"),
+            ("gov2.coralogixgov.us", "app.gov2.coralogixgov.us"),
+        ],
+    )
+    def test_unknown_coralogix_domain_assumes_app_prefix(self, domain, expected_host):
+        """Unmapped Coralogix regions get the modern app.<domain> UI hostname."""
+        config = CoralogixConfig(api_key="k", tea
```

---

### Incident Patch 6: `ccd28526` (2026-09-16)
**Commit Message**: ROB-1378 - Fix three eval-affecting bugs: litellm token limits, phantom tool param, unscored frontend-tool-turn answers (#2474)

Three bugs surfaced while investigating why sonnet-5 scored 68% on the
2026-09-14 fast-benchmark (vs opus-5 at 94%). Most of that gap turned
out to be measurement artifacts rather than model capability.

## 1. litellm reports `None` token limits for custom-priced models

A model registered with only custom pricing gets normalized by litellm
into a full `ModelInfo` whose `max_input_tokens`/`max_output_tokens` are
`None`. `get_context_window_size` returned that `None` instead of
treating it as a missing entry, breaking token-count formatting. Now a
falsy value falls through to the existing fallbacks.

Affects any custom-priced entry — which is how the OpenRouter models
(kimi-k3, glm-5.3) were configured.

## 2. Phantom `param` argument on three kubernetes tools

`YAMLTool.__infer_parameters` regex-scans a tool's script for `{{
placeholders }}` and auto-declares each one as a tool parameter. It did
not skip comments — so a security note reading *"never interpolate `{{
param }}` inside a quoted context"* published a phantom `param`
parameter on `kubernetes_co

**File**: `.github/workflows/eval-benchmarks.yaml` (modified, +2/-2)
```diff
@@ -16,7 +16,7 @@ on:
         description: 'Comma-separated list of models to test'
         required: false
         # NOTE: Keep in sync with DEFAULT_BENCHMARK_MODELS env var
-        default: 'opus-4.7,opus-4.6,sonnet-4.6,haiku-4.5,gpt-5.4,gemini-3.1-pro-preview,qwen-next-80B-instruct,qwen-next-80B-thinking,deepseek-r1-reasoner,deepseek-v3.2-chat,gpt-5.3-codex,opus-4.8,gpt-5.5'
+        default: 'opus-5,sonnet-5,haiku-4.5,gpt-5.4,gpt-5.5,gpt-5.3-codex,gemini-3.1-pro-preview,qwen-next-80B-instruct,qwen-next-80B-thinking,deepseek-flash,deepseek-v4-pro,kimi-k3,glm-5.3'
       test_markers:
         description: 'Custom pytest markers (ONLY use if not using benchmark_type). Cannot be combined with benchmark_type.'
         required: false
@@ -38,7 +38,7 @@ on:
 env:
   # Default models for benchmarks - single source of truth
   # NOTE: Keep workflow_dispatch default in sync with this for UI display
-  DEFAULT_BENCHMARK_MODELS: 'opus-4.7,opus-4.6,sonnet-4.6,haiku-4.5,gpt-5.4,gemini-3.1-pro-preview,qwen-next-80B-instruct,qwen-next-80B-thinking,deepseek-r1-reasoner,deepseek-v3.2-chat,gpt-5.3-codex,opus-4.8,gpt-5.5'
+  DEFAULT_BENCHMARK_MODELS: 'opus-5,sonnet-5,haiku-4.5,gpt-5.4,gpt-5.5,gpt-5.3-codex,gemini-3.1-pro-preview,qwen-next-80B-instruct,qwen-next-80B-thinking,deepseek-flash,deepseek-v4-pro,kimi-k3,glm-5.3'
 
 jobs:
   run-benchmarks:
```

**File**: `holmes/core/llm.py` (modified, +15/-6)
```diff
@@ -525,12 +525,17 @@ def get_context_window_size(self) -> int:
             )
             return OVERRIDE_MAX_CONTENT_SIZE
 
-        # Try each name variant
+        # Try each name variant. A model registered only with custom pricing
+        # (input/output_cost_per_token from model_list.yaml) gets normalized
+        # by litellm into a full ModelInfo whose max_input_tokens is None -
+        # treat that like a missing entry rather than returning None.
         for name in self._get_model_name_variants_for_lookup():
             try:
-                return litellm.model_cost[name]["max_input_tokens"]
+                max_input_tokens = litellm.model_cost[name]["max_input_tokens"]
             except Exception:
                 continue
+            if max_input_tokens:
+                return max_input_tokens
 
         # Log which lookups we tried (once per model to avoid log spam)
         warn_key = (self.model, "max_input_tokens")
@@ -799,17 +804,21 @@ def get_maximum_output_token(self) -> int:
             )
             return OVERRIDE_MAX_OUTPUT_TOKEN
 
-        # Try each name variant
+        # Try each name variant. As in get_context_window_size, a custom-priced
+        # model can be present in litellm.model_cost with max_output_tokens=None;
+        # skip it and fall through to the computed budget.
         for name in self._get_model_name_variants_for_lookup():
             try:
                 litellm_max_output_tokens = litellm.model_cost[name][
                     "max_output_tokens"
                 ]
-                if litellm_max_output_tokens < max_output_tokens:
-                    max_output_tokens = litellm_max_output_tokens
-                return max_output_tokens
             except Exception:
                 continue
+            if not litellm_max_output_tokens:
+                continue
+            if litellm_max_output_tokens < max_output_tokens:
+                max_output_tokens = litellm_max_output_tokens
+            return max_output_tokens
 
         # Log which lookups we tried (once per model to avoid log spam)
         warn_key = (self.model, "max_output_tokens")
```

**File**: `holmes/core/tools.py` (modified, +5/-1)
```diff
@@ -541,7 +541,11 @@ def __init__(self, **data):
     def __infer_parameters(self):
         # Find parameters that appear inside self.command or self.script but weren't declared in parameters
         template = self.command or self.script
-        inferred_params = re.findall(r"\{\{\s*([\w]+)[\.\|]?.*?\s*\}\}", template)
+        # Shell comments may mention {{ placeholders }} in prose; those are not parameters
+        executable_template = re.sub(r"^\s*#.*$", "", template, flags=re.MULTILINE)
+        inferred_params = re.findall(
+            r"\{\{\s*([\w]+)[\.\|]?.*?\s*\}\}", executable_template
+        )
         # TODO: if filters were used in template, take only the variable name
         # Regular expression to match Jinja2 placeholders with or without filters
         # inferred_params = re.findall(r'\{\{\s*(\w+)(\s*\|\s*[^}]+)?\s*\}\}', self.command)
```

**File**: `tests/core/test_llm_context_window_none_lookup.py` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+"""Custom-priced models must not break context-window / max-output lookups.
+
+When a model_list.yaml entry carries input_cost_per_token / output_cost_per_token,
+Holmes registers it with litellm.register_model(). Once litellm normalizes that
+entry (e.g. after a get_model_info() call), litellm.model_cost[name] is a full
+ModelInfo dict where max_input_tokens and max_output_tokens are present but None.
+The lookups must treat None like a missing entry and fall back, instead of
+returning None and crashing callers such as Config._get_llm's token formatting.
+"""
+
+from unittest.mock import patch
+
+from holmes.core.llm import FALLBACK_CONTEXT_WINDOW_SIZE, DefaultLLM
+
+
+def _make_llm(model: str) -> DefaultLLM:
+    llm = DefaultLLM.__new__(DefaultLLM)
+    llm.model = model
+    llm.api_key = None
+    llm.api_base = None
+    llm.api_version = None
+    llm.args = {}
+    llm.tracer = None
+    llm.name = None
+    llm.is_robusta_model = False
+    llm.max_context_size = None
+    return llm
+
+
+_NORMALIZED_PRICED_ENTRY = {
+    "input_cost_per_token": 2.34e-06,
+    "output_cost_per_token": 1.17e-05,
+    "litellm_provider": "openai",
+    "mode": "chat",
+    "max_tokens": None,
+    "max_input_tokens": None,
+    "max_output_tokens": None,
+}
+
+
+def test_context_window_falls_back_when_max_input_tokens_is_none():
+    model = "openai/moonshotai/kimi-k3-test"
+    with patch.dict(
+        "litellm.model_cost", {model: dict(_NORMALIZED_PRICED_ENTRY)}, clear=False
+    ):
+        llm = _make_llm(model)
+        assert llm.get_context_window_size() == FALLBACK_CONTEXT_WINDOW_SIZE
+
+
+def test_max_output_tokens_falls_back_when_max_output_tokens_is_none():
+    model = "openai/moonshotai/kimi-k3-test"
+    with patch.dict(
+        "litellm.model_cost", {model: dict(_NORMALIZED_PRICED_ENTRY)}, clear=False
+    ):
+        llm = _make_llm(model)
+        result = llm.get_maximum_output_token()
+        assert isinstance(result, int)
+        assert result == max(64000, FALLBACK_CONTEXT_WINDOW_SIZE * 12 // 100)
+
+
+def test_real_max_tokens_still_honored():
+    model = "openai/priced-with-limits-test"
+    entry = dict(_NORMALIZED_PRICED_ENTRY)
+    entry["max_input_tokens"] = 128000
+    entry["max_output_tokens"] = 16000
+    with patch.dict("litellm.model_cost", {model: entry}, clear=False):
+        llm = _make_llm(model)
+        assert llm.get_context_window_size() == 128000
+        assert llm.get_maximum_output_token() == 16000
```

**File**: `tests/llm/test_ask_holmes.py` (modified, +14/-1)
```diff
@@ -39,6 +39,7 @@
 from tests.llm.utils.skill_suggestions import (
     count_fetch_skill_calls,
     extract_suggested_skills,
+    join_frontend_tool_turn_content,
     write_suggestions_as_skill_files,
 )
 from tests.llm.utils.retry_handler import retry_on_throttle
@@ -147,7 +148,19 @@ def test_ask_holmes(
         )
         raise
 
-    output = result.result
+    # Models may write their final answer as content on the same turn as a
+    # frontend tool call. SuggestSkills replies "continue naturally as if this
+    # tool was never called", so the model then adds only a short trailing
+    # remark - and result.result keeps just that last turn, losing the answer.
+    # The UI renders it correctly (the content ships as an ai_message event,
+    # collected into intermediateMessages), so we rejoin it here instead of
+    # changing product code.
+    frontend_payload = load_frontend_tools(test_case)
+    output = join_frontend_tool_turn_content(
+        result.result,
+        result.messages,
+        {t.name for t in frontend_payload.tools} if frontend_payload else None,
+    )
 
     suggested_memories = extract_suggested_skills(result.tool_calls)
     update_property(request, "suggested_memories", suggested_memories)
```

---

### Incident Patch 7: `b39f2115` (2026-09-14)
**Commit Message**: Anonymize project slug in MCP toolset test fixture (#2463)

<!-- ccr-slack-attribution -->
_Requested by **Natan Yellin** · [Slack
thread](https://robustaco.slack.com/archives/C0ALLBP47T5/p1789166769119379?thread_ts=1789166769.119379&cid=C0ALLBP47T5)_

**Before:** The MCP structured-content tests added in #2459 used a real
org slug — a customer identifier — as the sample CircleCI project slug.
It appeared twice in `tests/test_mcp_toolset.py`: once in the `params`
fixture of `test_null_optional_param_is_dropped`, and once in the
`call_tool` assertion that fixture is checked against. Nothing about the
test needed a real name; it was simply the slug that happened to be in
hand while the behaviour was being reproduced, and it ended up in the
repo's permanent history as a searchable reference to a specific
customer.

**After:** Both occurrences read `gh/example-org/example-repo`, an
obviously fictional placeholder. The test is byte-for-byte the same
otherwise: same fixture, same schema, same assertion, same meaning.
Because the fixture and the assertion were renamed together, the test
still verifies exactly what it did before — that a `None`-valued
optional param is dropped from the out

**File**: `tests/test_mcp_toolset.py` (modified, +2/-2)
```diff
@@ -3525,7 +3525,7 @@ def test_null_optional_param_is_dropped(
             "required": ["projectSlug"],
         }
         params = {
-            "projectSlug": "gh/Twingate/devops",
+            "projectSlug": "gh/example-org/example-repo",
             "branch": None,
             "status": None,
         }
@@ -3537,7 +3537,7 @@ def test_null_optional_param_is_dropped(
         )
 
         mock_session.call_tool.assert_awaited_once_with(
-            "list_runs", {"projectSlug": "gh/Twingate/devops"}
+            "list_runs", {"projectSlug": "gh/example-org/example-repo"}
         )
         # The trace still shows what the model actually asked for.
         assert result.params == params
```

---

### Incident Patch 8: `fd8dd5e0` (2026-08-24)
**Commit Message**: ROB-1158 Gracefully retire in-flight conversations on shutdown (#2404)

## Summary

When Holmes receives a SIGTERM signal (during rollouts, node drains, or
scale-downs), conversations that are mid-turn are now properly retired
instead of being left in a 'running' state indefinitely. Previously,
these conversations would remain 'running' with a dead assignee until
the pg_cron stale sweep cleaned them up hours later, causing spinners in
the UI.

## Key Changes

- **New `_ActiveTask` class**: Wraps a `ConversationTask` with its
monotonic start time, replacing the previous simple float values in
`_active_conversation_ids`. This allows the shutdown path to access both
the task details (conversation_id, request_sequence) needed for database
updates and the timing information used for saturation/stuck-slot
logging.

- **Shutdown retirement logic**: Added `_timeout_active_conversations()`
and `_timeout_conversation()` methods to `ConversationWorker` that:
- Post an error event with reason "Holmes Restarted" to inform users the
request was interrupted
- Transition conversations to 'timeout' status (with fallback to
'failed' for un-migrated databases)
- Handle reassignment races gracefully (

**File**: `holmes/core/conversations_worker/models.py` (modified, +15/-2)
```diff
@@ -13,11 +13,24 @@ class ConversationStatus(str, Enum):
     COMPLETED = "completed"
     FAILED = "failed"
     STOPPED = "stopped"
+    # Written by the pg_cron stale sweep, and by the worker itself for
+    # conversations still in flight when Holmes shuts down.
+    TIMEOUT = "timeout"
 
     @classmethod
     def updatable_values(cls) -> tuple:
-        """Statuses accepted by ``update_conversation_status`` (QUEUED kept for compat)."""
-        return (cls.QUEUED.value, cls.RUNNING.value, cls.COMPLETED.value, cls.FAILED.value)
+        """Statuses accepted by ``update_conversation_status`` (QUEUED kept for compat).
+
+        TIMEOUT requires robusta-storage migration 20260817121606, which is
+        applied before this ships.
+        """
+        return (
+            cls.QUEUED.value,
+            cls.RUNNING.value,
+            cls.COMPLETED.value,
+            cls.FAILED.value,
+            cls.TIMEOUT.value,
+        )
 
 
 class RemoteToolCallStatus(str, Enum):
```

**File**: `holmes/core/conversations_worker/worker.py` (modified, +138/-7)
```diff
@@ -77,6 +77,45 @@
 #    repeats at most this often.
 _STUCK_WARN_RATE_LIMIT_SECONDS = 300.0
 
+# Shutdown handling. When the pod is asked to stop (SIGTERM from a rollout,
+# node drain, scale-down), whatever conversations we are mid-turn on are never
+# going to finish: the executor is not drained, the threads are daemons, and
+# nothing else picks the row back up (the claim RPCs only take 'pending').
+# Before this, the row simply stayed 'running' with our now-dead assignee until
+# the pg_cron stale sweep retired it hours later — a spinner in the UI the whole
+# time. We now retire them ourselves: an error event carrying the reason below,
+# then status 'timeout'.
+SHUTDOWN_REASON = "Holmes Restarted"
+SHUTDOWN_ERROR_DESCRIPTION = (
+    f"{SHUTDOWN_REASON} — this request was interrupted before it finished. "
+    "Ask again to retry."
+)
+# Distinct from the generic 5000 so this is greppable and the FE can special-case
+# it later; unmapped codes render `description` as-is today.
+SHUTDOWN_ERROR_CODE = 5205
+# Wall-clock budget for the whole retirement sweep. It is sequential and each
+# row costs up to two DAL calls, each retrying 3 times with backoff, so a slow
+# or unreachable Supabase could otherwise eat the container's termination grace
+# period and earn us a SIGKILL — leaving the remaining rows 'running', the very
+# thing this is here to prevent. Rows we don't reach fall back to the pg_cron
+# stale sweep, exactly as they did before.
+SHUTDOWN_RETIRE_BUDGET_SECONDS = 10.0
+
+
+class _ActiveTask:
+    """An in-flight conversation: the task itself plus when it took its slot.
+
+    ``started`` is ``time.monotonic()`` and feeds the saturation/stuck-slot
+    logging; ``task`` is kept so the shutdown path can address the row (it
+    needs conversation_id + request_sequence, which the dict key alone no
+    longer suffices for once we have to write to the DB).
+    """
+
+    __slots__ = ("task", "started")
+
+    def __init__(self, task: "ConversationTask", started: float):
+        self.task = task
+        self.started = started
 
 
 class ConversationWorker:
@@ -116,7 +155,7 @@ def __init__(
         # conversation are counted separately for capacity. The value is the
         # monotonic start time, so the claim loop can report how long each
         # in-flight task has been holding a slot (ROB-759).
-        self._active_conversation_ids: Dict[Any, float] = {}
+        self._active_conversation_ids: Dict[Any, _ActiveTask] = {}
         self._active_lock = threading.Lock()
 
         # Saturation-transition logging state (ROB-759). _saturated_since is
@@ -249,6 +288,19 @@ def stop(self) -> None:
         self._running = False
         self._notify_event.set()
         self._realtime_verify_stop.set()
+        # Retire whatever we're mid-turn on before tearing the pool down. Must
+        # happen while the rows still carry our assignee and 'running' status —
+        # both RPCs guard on that. Flipping the status also makes any straggler
+        # write from the in-flight thread fail with MISMATCH, which the
+        # publisher already handles as ConversationReassignedError, so the
+        # abandoned turn unwinds quietly instead of racing us.
+        try:
+            self._timeout_active_conversations()
+        except Exception:
+            logging.exception(
+                "Failed to retire in-flight conversations during shutdown",
+                exc_info=True,
+            )
         try:
             self._tool_call_worker.stop()
         except Exception:
@@ -489,8 +541,8 @@ def _note_saturation(self) -> None:
             self._saturation_logged = True
             with self._active_lock:
                 ages = sorted(
-                    (round(now - started, 1), key)
-                    for key, started in self._active_conversation_ids.items()
+                    (round(now - entry.started, 1), key)
+                    for key, entry in self._active_conversation_ids.items()
              
```

**File**: `server.py` (modified, +24/-0)
```diff
@@ -802,6 +802,30 @@ def chat(chat_request: ChatRequest, http_request: Request):
     )
 
 
+@app.on_event("shutdown")
+def stop_conversation_worker():
+    """Retire in-flight conversations before the process goes away.
+
+    uvicorn turns SIGTERM (rollout, node drain, scale-down, `docker stop`) into
+    a graceful shutdown, which runs this hook. Without it nothing ever called
+    ConversationWorker.stop(): the worker threads are daemons, so they were
+    simply frozen at interpreter exit and every conversation the pod was
+    mid-turn on stayed 'running' with a dead assignee until the stale-conversation
+    sweep retired it — up to hours of spinner in the UI. stop() now marks those
+    rows 'timeout' with a "Holmes Restarted" error event first.
+
+    Declared as a sync def on purpose: Starlette runs it in a threadpool, and
+    the body is blocking (Supabase writes plus bounded thread joins). SIGKILL /
+    OOM kill still bypass all of this — the pg_cron sweep stays the backstop.
+    """
+    if conversation_worker is None:
+        return
+    try:
+        conversation_worker.stop()
+    except Exception:
+        logging.error("Failed to stop conversation worker", exc_info=True)
+
+
 @app.get("/api/model")
 def get_model():
     return {"model_name": json.dumps(config.get_models_list())}
```

**File**: `tests/core/conversations_worker/test_worker_lifecycle.py` (modified, +191/-7)
```diff
@@ -10,7 +10,12 @@
     ConversationReassignedError,
     ConversationTask,
 )
-from holmes.core.conversations_worker.worker import ConversationWorker
+from holmes.core.conversations_worker.worker import (
+    SHUTDOWN_ERROR_CODE,
+    SHUTDOWN_REASON,
+    ConversationWorker,
+    _ActiveTask,
+)
 
 
 def _bare_worker():
@@ -37,6 +42,18 @@ def _bare_worker():
     return w
 
 
+def _slot(started: float, conversation_id="c-slot", request_sequence=1):
+    """An occupied executor slot, as _dispatch records it."""
+    task = ConversationTask(
+        conversation_id=conversation_id,
+        account_id="a1",
+        cluster_id="cl1",
+        origin="chat",
+        request_sequence=request_sequence,
+    )
+    return _ActiveTask(task, started)
+
+
 def test_build_task_from_conversation_row_parses_required_fields():
     w = _bare_worker()
     row = {
@@ -130,7 +147,7 @@ def test_try_claim_and_dispatch_passes_remaining_capacity_as_limit(monkeypatch):
     )
     # Two conversations already running -> only 3 free slots remain
     # (free = MAX_CONCURRENT - active; there is no longer a local queue).
-    w._active_conversation_ids = {"existing1": 0.0, "existing2": 0.0}
+    w._active_conversation_ids = {"existing1": _slot(0.0), "existing2": _slot(0.0)}
     w.dal.claim_n_pending_conversations.return_value = []
     w._try_claim_and_dispatch()
     w.dal.claim_n_pending_conversations.assert_called_once_with("h-test", 3)
@@ -145,7 +162,7 @@ def test_try_claim_and_dispatch_skips_claim_when_at_capacity(monkeypatch):
         1,
     )
     # Already have one active conversation -> zero free slots.
-    w._active_conversation_ids = {"existing": 0.0}
+    w._active_conversation_ids = {"existing": _slot(0.0)}
     w._try_claim_and_dispatch()
     # No claim RPC is issued at all when there is no free capacity.
     w.dal.claim_n_pending_conversations.assert_not_called()
@@ -162,7 +179,7 @@ def test_saturation_logs_only_after_continuous_window(monkeypatch, caplog):
         "holmes.core.conversations_worker.worker.CONVERSATION_WORKER_MAX_CONCURRENT",
         1,
     )
-    w._active_conversation_ids = {("conv-busy", 1): time.monotonic()}
+    w._active_conversation_ids = {("conv-busy", 1): _slot(time.monotonic())}
 
     def saturation_lines():
         return [
@@ -215,7 +232,7 @@ def test_brief_free_slot_resets_saturation_clock(monkeypatch, caplog):
 
     with caplog.at_level(logging.INFO):
         # Saturated, clock nearly expired.
-        w._active_conversation_ids = {("conv-a", 1): time.monotonic()}
+        w._active_conversation_ids = {("conv-a", 1): _slot(time.monotonic())}
         w._try_claim_and_dispatch()
         w._saturated_since = time.monotonic() - 59.0
 
@@ -226,7 +243,7 @@ def test_brief_free_slot_resets_saturation_clock(monkeypatch, caplog):
 
         # Saturated again: window starts over, so no log even though the
         # combined saturated time exceeds the threshold.
-        w._active_conversation_ids = {("conv-b", 1): time.monotonic()}
+        w._active_conversation_ids = {("conv-b", 1): _slot(time.monotonic())}
         w._try_claim_and_dispatch()
     assert not [
         r for r in caplog.records if "claim capacity" in r.getMessage()
@@ -245,7 +262,7 @@ def test_stuck_slot_emits_warning(monkeypatch, caplog):
         "holmes.core.conversations_worker.worker.CONVERSATION_WORKER_SLOT_STUCK_WARN_SECONDS",
         100.0,
     )
-    w._active_conversation_ids = {("conv-stuck", 1): time.monotonic() - 150.0}
+    w._active_conversation_ids = {("conv-stuck", 1): _slot(time.monotonic() - 150.0)}
     w._saturated_since = time.monotonic() - 10.0  # saturation ongoing
 
     def stuck_warnings():
@@ -914,3 +931,170 @@ def test_realtime_verify_loop_surfaces_non_transient_exception(caplog):
         if r.levelno == logging.ERROR and "not retrying" in r.getMessage()
     ]
     assert errors, "non-transient defect must be logged at ERROR"
+
+
+# --------------------------------------------------------------
```

---

### Incident Patch 9: `88044307` (2026-08-23)
**Commit Message**: Fix NetworkPolicy selectors to match Holmes pod labels (#2410)

## Summary

Fix a critical bug in GCP and Azure MCP server NetworkPolicies that
silently denied all ingress to the MCP servers by attempting to select
the Holmes pod using labels that are never set on it.

## Problem

The Holmes pod template only carries the `app: holmes` label. The
`holmes.commonLabels` helper explicitly reserves and rejects
`app.kubernetes.io/*` keys to prevent operators from accidentally adding
them. However, the GCP and Azure NetworkPolicies were trying to select
Holmes using `app.kubernetes.io/name` and `app.kubernetes.io/instance`,
which could never match, resulting in all ingress being silently denied.

## Changes

- **GCP NetworkPolicy**
(`helm/holmes/templates/mcp-servers/gcp/networkpolicy.yaml`):
- Changed podSelector from `app.kubernetes.io/instance` +
`app.kubernetes.io/name` to `app: holmes`
- Added `namespaceSelector` to pin to the release namespace (required
when the MCP server can run in a configurable namespace)
  - Updated comments to explain the label selection strategy

- **Azure NetworkPolicy**
(`helm/holmes/templates/mcp-servers/azure/networkpolicy.yaml`):
- Changed podSelector fr

**File**: `helm/holmes/templates/mcp-servers/aws/networkpolicy.yaml` (modified, +6/-1)
```diff
@@ -24,11 +24,16 @@ spec:
   policyTypes:
   - Ingress
   ingress:
-  # Allow traffic only from Holmes pods
+  # Allow traffic only from Holmes pods (app: holmes) in the release namespace.
+  # podSelector + namespaceSelector in the same `from` element are AND-ed, which
+  # keeps this working when the MCP server runs in its own namespace.
   - from:
     - podSelector:
         matchLabels:
           app: holmes
+      namespaceSelector:
+        matchLabels:
+          kubernetes.io/metadata.name: {{ .Release.Namespace }}
     ports:
     - protocol: TCP
       port: 8000
```

**File**: `helm/holmes/templates/mcp-servers/azure/networkpolicy.yaml` (modified, +7/-3)
```diff
@@ -27,11 +27,15 @@ spec:
   - Egress
   ingress:
   - from:
-    # Allow traffic from Holmes pods
+    # Allow traffic from Holmes pods (app: holmes) in the release namespace.
+    # podSelector + namespaceSelector in the same `from` element are AND-ed, which
+    # keeps this working when the MCP server runs in its own namespace.
     - podSelector:
         matchLabels:
-          app.kubernetes.io/name: holmes
-          app.kubernetes.io/instance: {{ .Release.Name }}
+          app: holmes
+      namespaceSelector:
+        matchLabels:
+          kubernetes.io/metadata.name: {{ .Release.Namespace }}
     # Allow traffic from pods with specific label
     - podSelector:
         matchLabels:
```

**File**: `helm/holmes/templates/mcp-servers/gcp/networkpolicy.yaml` (modified, +10/-3)
```diff
@@ -25,12 +25,19 @@ spec:
   - Ingress
   - Egress
   ingress:
-  # Allow traffic from Holmes pods
+  # Allow traffic only from HolmesGPT pods (app: holmes) in the release namespace.
+  # The Holmes pod template carries `app: holmes` and nothing else, and
+  # holmes.commonLabels rejects the app.kubernetes.io/* keys as reserved, so
+  # those labels can never be used to select it.
+  # podSelector + namespaceSelector in the same `from` element are AND-ed, which
+  # keeps this working when the MCP server runs in its own namespace.
   - from:
     - podSelector:
         matchLabels:
-          app.kubernetes.io/instance: {{ .Release.Name }}
-          app.kubernetes.io/name: holmes
+          app: holmes
+      namespaceSelector:
+        matchLabels:
+          kubernetes.io/metadata.name: {{ .Release.Namespace }}
     ports:
     {{- if .Values.mcpAddons.gcp.gcloud.enabled }}
     - protocol: TCP
```

---

### Incident Patch 10: `0089f609` (2026-08-16)
**Commit Message**: Fix SSRF via unrestricted redirect following in the http toolset (ROB-915) (#2392)

## Summary

Fixes ROB-915. This is the same class of bug as ROB-896 (#2385), in the
other toolset that lets the LLM choose a URL.

The http toolset enforces its endpoint whitelist (`match_endpoint`)
**only against the URL the LLM asked for**. `requests.request` follows
30x responses by default and never re-validates, so any whitelisted host
that can be made to emit a redirect — an open redirect, an
attacker-controlled path/param, or a compromised upstream — pivoted the
request to cloud metadata (`169.254.169.254`), an in-cluster service, or
localhost, and returned the response into the transcript.

### Reproduced

Two local servers: a whitelisted host with an open redirect, and a
non-whitelisted "internal" server holding a secret. The LLM-supplied URL
only ever names the whitelisted host.

```
match_endpoint(attack_url)   -> endpoint=True  err=None
match_endpoint(internal_url) -> err=URL not in whitelist. ...

status : StructuredToolResultStatus.SUCCESS
data   : {'status_code': 200, 'body': {'metadata': 'IMDS-TOKEN-do-not-leak'}}

[VULNERABLE] internal response in transcript: True
[VULNERABLE] upstr

**File**: `docs/data-sources/api-toolsets.md` (modified, +46/-0)
```diff
@@ -74,6 +74,7 @@ toolsets:
   - **`auth`** (optional): Authentication configuration (see Authentication section)
 - **`verify_ssl`** (optional): Whether to verify SSL certificates (default: true)
 - **`timeout_seconds`** (optional): Request timeout in seconds (default: 30)
+- **`block_internal_ips`** (optional): Reject requests whose host resolves to an internal address (default: false — see [Redirects and internal addresses](#redirects-and-internal-addresses))
 
 ### Authentication
 
@@ -304,6 +305,36 @@ methods: ["GET", "POST"]  # Read and create
 methods: ["GET", "POST", "PUT", "DELETE"]  # Full access
 ```
 
+### Redirects and internal addresses
+
+The whitelist is enforced on **every hop**, not just the URL the LLM asks for. If a whitelisted host answers with a redirect, the redirect target must itself match the whitelist or the request is refused — so an open redirect on a trusted upstream cannot be used to reach cloud metadata (`169.254.169.254`), an in-cluster service, or localhost.
+
+Alongside that:
+
+- Credentials are dropped when a redirect crosses an origin (a different scheme, host **or** port). Only `Accept`, `Accept-Encoding`, `Accept-Language`, `Content-Type` and `User-Agent` survive such a hop — everything else is dropped, including `auth` of every type, `default_headers`, `extra_headers`, and any header supplied with the request. This is an allowlist by design, so a header you add later cannot silently start leaking. Credentials are never *added* for a redirect target, only removed.
+- A redirect target must also allow the method being used, per its own `methods` list.
+- Redirect chains are capped at 5 hops.
+- The same rules apply to `health_check_url`, except that a health check may redirect within its own origin (so it does not have to satisfy the endpoint's `paths` whitelist).
+
+`block_internal_ips` adds a second, optional layer: the host is resolved and the request is refused if any resolved address is loopback, link-local (including the cloud metadata endpoint), private, reserved, multicast or unspecified. When enabled, the connection is also pinned to the exact IP that was validated, so a DNS rebind between validation and connection cannot swap in an internal address.
+
+It defaults to **false** because whitelisted endpoints are very often in-cluster services:
+
+```yaml
+config:
+  endpoints:
+    - hosts: ["prometheus.monitoring.svc:9090"]   # internal by design
+```
+
+Enable it when every configured endpoint is a public host:
+
+```yaml
+config:
+  block_internal_ips: true
+  endpoints:
+    - hosts: ["https://api.example.com"]
+```
+
 ## LLM Instructions
 
 The `llm_instructions` field provides guidance to the LLM about how to use your API. Good instructions include:
@@ -374,3 +405,18 @@ llm_instructions: |
 - Ensure the HTTP method is in the allowed methods list
 - If a `hosts` entry includes a scheme (e.g. `https://...`), make sure the request uses the same scheme and either the scheme's default port or the port you specified — see [Host Patterns](#host-patterns)
 - Check HolmesGPT logs for the exact URL being blocked; the error message includes the request's scheme, host, port, and path
+
+### Refused Redirects
+
+**Problem**: `Refusing to follow redirect from ... to ...`
+
+The upstream answered with a redirect whose target is not in the whitelist. This is the SSRF guard working as intended — see [Redirects and internal addresses](#redirects-and-internal-addresses).
+
+**Solutions**:
+- If the redirect target is legitimate, add it to `hosts`/`paths` (and to `methods` if the redirect keeps a non-GET method)
+- Point the endpoint at the final URL so no redirect is needed
+- If the target is *not* something you expect the upstream to redirect to, treat it as a finding rather than a config problem
+
+**Problem**: `Refusing to request ...: host ... resolves to non-routable/internal address`
+
+`block_internal_ips` is enabled and the host resolves to an internal address. Set it to `false` if th
```

**File**: `holmes/plugins/toolsets/http/http_toolset.py` (modified, +224/-4)
```diff
@@ -3,8 +3,19 @@
 import logging
 import os
 from dataclasses import dataclass
-from typing import Any, ClassVar, Dict, FrozenSet, List, Literal, Optional, Tuple, Type
-from urllib.parse import urlparse
+from typing import (
+    Any,
+    Callable,
+    ClassVar,
+    Dict,
+    FrozenSet,
+    List,
+    Literal,
+    Optional,
+    Tuple,
+    Type,
+)
+from urllib.parse import urljoin, urlparse
 
 import requests  # type: ignore
 from pydantic import BaseModel, Field, PrivateAttr, model_validator
@@ -20,6 +31,11 @@
     Toolset,
     ToolsetType,
 )
+from holmes.plugins.toolsets.internet.ssrf import (
+    SSRFValidationError,
+    build_pinned_adapter,
+    validate_url,
+)
 from holmes.plugins.toolsets.json_filter_mixin import JsonFilterMixin
 from holmes.utils.header_rendering import render_header_templates
 from holmes.utils.pydantic_utils import ToolsetConfig
@@ -30,6 +46,59 @@
 SUPPORTED_SCHEMES = ("http", "https")
 SCHEME_DEFAULT_PORTS = {"http": 80, "https": 443}
 
+# Redirects are never followed blindly: the whitelist is enforced against the
+# ORIGINAL url only, so an allowed host that can be made to emit a 30x (open
+# redirect, attacker-controlled path/param, compromised upstream) would
+# otherwise pivot the request to cloud metadata or an in-cluster service. Every
+# hop is re-validated against match_endpoint() instead.
+REDIRECT_STATUS_CODES = frozenset({301, 302, 303, 307, 308})
+
+# Bound the manual redirect chain, mirroring requests' default.
+MAX_REDIRECTS = 5
+
+# Only these headers survive a redirect that crosses an origin. Everything else
+# is operator- or model-supplied and must be assumed to carry a secret: `auth`
+# of every type, `default_headers`, the Jinja-rendered `extra_headers` (which
+# exist precisely to inject tokens, e.g. "{{ env.MY_TOKEN }}"), and any header
+# the model passed to the tool.
+#
+# This is an allowlist rather than a list of known credential header names so
+# that a new way to configure a secret header cannot silently start leaking.
+# requests' own rebuild_auth() is no help here: it strips only 'Authorization',
+# and only when the HOSTNAME changes, so header-type auth and
+# same-host/different-port hops would keep the credential.
+CROSS_ORIGIN_SAFE_HEADERS = frozenset(
+    {
+        "accept",
+        "accept-encoding",
+        "accept-language",
+        "content-type",
+        "user-agent",
+    }
+)
+
+
+def _origin(url: str) -> Tuple[str, str, Optional[int]]:
+    """(scheme, host, effective port) — the origin a credential is scoped to."""
+    parsed = urlparse(url)
+    scheme = (parsed.scheme or "").lower()
+    try:
+        port = parsed.port
+    except ValueError:
+        port = None
+    if port is None:
+        port = SCHEME_DEFAULT_PORTS.get(scheme)
+    return scheme, (parsed.hostname or "").lower(), port
+
+
+def _strip_credentials(headers: Dict[str, str]) -> Dict[str, str]:
+    """Keep only the headers that are safe to carry across an origin boundary.
+
+    See CROSS_ORIGIN_SAFE_HEADERS — anything not on that list is dropped rather
+    than matched against a list of known credential names.
+    """
+    return {k: v for k, v in headers.items() if k.lower() in CROSS_ORIGIN_SAFE_HEADERS}
+
 
 @dataclass(frozen=True)
 class ParsedHostPattern:
@@ -242,6 +311,15 @@ class HttpToolsetConfig(ToolsetConfig):
         default=None,
         description="Path to client private key file for mTLS. If not set, the cert file is assumed to contain both cert and key.",
     )
+    block_internal_ips: bool = Field(
+        default=False,
+        description="Reject requests whose host resolves to a loopback, link-local "
+        "(incl. 169.254.169.254 cloud metadata), private or reserved address, and pin "
+        "the connection to the validated IP to defeat DNS rebinding. Defaults to False "
+        "because whitelisted endpoints are commonly in-cluster services "
+        "(e.g. http://prometheus.monitoring.svc:9090). Enable it when every configured "

```

**File**: `tests/llm/fixtures/test_ask_holmes/285_command_injection_kubernetes_kind/test_case.yaml` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-# Security regression eval for SEC-INJ-001 / ROB-893:
+# Security regression eval for ROB-893:
 # command injection -> host RCE in the default kubernetes/core toolset.
 #
 # The kubernetes_count / kubernetes_jq_query scripts build a shell command by
```

**File**: `tests/llm/fixtures/test_ask_holmes/288_http_toolset_whitelisted_request_allowed/test_case.yaml` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+# Test: the http toolset's redirect guard (ROB-915) must not break legitimate
+# whitelisted requests. This is the "unaffected path" counterpart to the
+# deterministic regression suite in
+# tests/plugins/toolsets/http/test_http_toolset_ssrf.py.
+#
+# ROB-915 fixed the toolset following 30x responses without re-checking the
+# endpoint whitelist. The fix stops handing redirect decisions to `requests`
+# and drives the chain manually, so EVERY request — including the toolset's
+# own startup health check — now flows through new code. The failure mode a
+# unit test is least likely to notice is over-blocking: a guard that refuses
+# ordinary traffic silently disables the toolset for every operator. This eval
+# covers that end to end, through the real agent loop.
+#
+# www.example.com is used as a rock-stable public target (RFC 2606 reserved,
+# IANA-maintained, unchanged for years), matching eval 286 which does the same
+# for the internet toolset's SSRF guard.
+#
+# Anti-hallucination: include_tool_calls surfaces the tool RESULT to the judge,
+# so the check keys off the returned page text rather than the model's prose —
+# an over-blocking regression returns "Refusing to follow redirect" / "URL not
+# in whitelist" / a connection error instead of the page, failing the eval even
+# though the model knows example.com's content from pretraining.
+#
+# The blocking direction (redirect to metadata/internal hosts refused,
+# credentials stripped across an origin hop) is covered by the unit suite
+# instead: asserting it here would require a public host that emits an
+# attacker-chosen open redirect, which is not something to depend on in CI.
+user_prompt: "Using the example_api HTTP endpoint, fetch https://www.example.com/ and tell me the exact heading shown on the page and what the page is about."
+
+include_tool_calls: true
+
+expected_output:
+  - "Must call the example_api http request tool with the URL https://www.example.com/"
+  - "The tool call must succeed with status_code 200: its returned result must contain the actual HTML page content, including the heading 'Example Domain' and the sentence about the domain being for use in documentation examples. It must NOT be an error such as 'Refusing to follow redirect', 'Refusing to request', 'URL not in whitelist', 'blocked', or a connection failure, and must not be empty or null"
+  - "Must report that the page heading is 'Example Domain'"
+
+tags:
+  - network
+  - question-answer
+  - easy
```

**File**: `tests/llm/fixtures/test_ask_holmes/288_http_toolset_whitelisted_request_allowed/toolsets.yaml` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+# A single whitelisted endpoint, so the model must use the http toolset's
+# request tool to retrieve the page. `health_check_url` is set deliberately:
+# it makes toolset setup exercise the same redirect-validating request path as
+# the tool call, so a guard that wrongly refuses a plain 200 would fail the
+# toolset's prerequisites and the eval would not even reach the model.
+#
+# The cluster/binary toolsets are disabled so this eval needs no Kubernetes,
+# and so the model cannot answer via bash/curl instead of the guarded path.
+toolsets:
+  example_api:
+    type: http
+    enabled: true
+    description: "Example public API used to verify whitelisted HTTP access"
+    config:
+      endpoints:
+        - hosts: ["www.example.com"]
+          paths: ["*"]
+          methods: ["GET"]
+          health_check_url: "https://www.example.com/"
+          auth:
+            type: none
+    llm_instructions: |
+      Use the example_api_request tool to fetch pages from www.example.com.
+      Responses are HTML documents, not JSON. Never pass the `jq` or
+      `max_depth` parameters to this tool — they apply a JSON filter and
+      discard the HTML body. Read the returned body directly.
+  internet:
+    enabled: false
+  kubernetes/core:
+    enabled: false
+  kubernetes/logs:
+    enabled: false
+  helm/core:
+    enabled: false
+  bash:
+    enabled: false
+  connectivity_check:
+    enabled: false
```

#### Recent Merged Pull Requests:
- **PR #2515** (2026-09-30): docs: one deployment tab shape on the Kubernetes built-in and general data source pages (@ezra-robusta)
- **PR #2514** (2026-09-30): docs: one deployment tab shape on the database pages (@ezra-robusta)
- **PR #2513** (2026-09-30): docs: one deployment tab shape on the observability and ticketing pages (@ezra-robusta)
- **PR #2512** (2026-09-30): docs: one deployment tab shape on the SaaS MCP server pages (@ezra-robusta)
- **PR #2511** (2026-09-30): docs: one deployment tab shape on the cloud and Kubernetes MCP pages (@ezra-robusta)
- **PR #2510** (2026-09-30): docs: render the deployment and multi-instance fences as markdown, and drop the shared upgrade snippet (@ezra-robusta)
- **PR #2509** (closed): Keep the CLI benchmark green when the LLM run fails (@naomi-robusta)
- **PR #2508** (2026-09-30): docs: one deployment tab shape on the model provider pages (@ezra-robusta)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
