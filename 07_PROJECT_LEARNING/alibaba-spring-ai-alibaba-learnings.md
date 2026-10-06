# Forensic Learning Record (Deep Inspection): alibaba/spring-ai-alibaba

> **Canonical Artifact**: `07_PROJECT_LEARNING/alibaba-spring-ai-alibaba-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alibaba/spring-ai-alibaba](https://github.com/alibaba/spring-ai-alibaba))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:53:47.288Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alibaba/spring-ai-alibaba`
- **Description**: Agentic AI Framework for Java Developers
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10964 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `spring-ai-alibaba-admin/frontend/packages/main/src/components/InnerLayout/utils.ts`
```
import $i18n from '@/i18n';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

const usePortal = (targetId: string) => {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  // Find target DOM element after component mounts
  useEffect(() => {
    const findTarget = () => {
      const element = document.getElementById(targetId);
      if (element) {
        setTarget(element);
      } else {
        console.warn(
          $i18n.get(
            {
              id: 'main.components.InnerLayout.utils.notFoundTargetElement',
              dm: '找不到目标元素 #{var1}',
            },
            { var1: targetId },
          ),
        );
      }
    };

    findTarget();
  }, [targetId]);

  return (children: React.ReactNode) => {
    return target ? ReactDOM.createPortal(children, target) : null;
  };
};

/**
 * Right action area Portal Hook
 */
const useInnerLayoutRight = () => {
  return usePortal('InnerLayoutRight');
};

/**
 * Bottom area Portal Hook
 */
const useInnerLayoutBottom = () => {
  return usePortal('InnerLayoutBottom');
};

/**
 * Unified InnerLayout Portal Hook
 * Returns an object containing portal functions for right area and bottom area
 * @returns {rightPortal: (children: React.ReactNode) => React.ReactNode, bottomPortal: (children: React.ReactNode) => React.ReactNode}
 */
export const useInnerLayout = (): {
  rightPortal: (children: React.ReactNode) => React.ReactNode;
  bottomPortal: (children: React.ReactNode) => React.ReactNode;
} => {
  const rightPortal = useInnerLayoutRight();
  const baseBottomPortal = useInnerLayoutBottom();

  // Special handling for bottom area - wrap content in a div
  const bottomPortal = (children: React.ReactNode) => {
    // Default styles
    const style: React.CSSProperties = {
      backgroundColor: 'var(--ag-ant-color-bg-base)',
      borderTop: '1px solid var(--ag-ant-color-border-secondary)',
      padding: '16px 24px',
      display: 'flex',
      gap: 8,
    };

    return baseBottomPortal(
      React.createElement(
        'div',
        {
          style,
        },
        children,
      ),
    );
  };

  return { rightPortal, bottomPortal };
};

```

### Core Architecture Module: `spring-ai-alibaba-admin/frontend/packages/main/src/legacy/hooks/useApiState.ts`
```
import { useState, useCallback } from 'react';
import { handleApiError, handleNetworkError, notifySuccess } from '../utils/notification';

export interface UseApiStateOptions {
  successMessage?: string;
  errorContext?: string;
  showSuccessNotification?: boolean;
}

export interface ApiState<T = any> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface UseApiStateReturn<T = any> {
  state: ApiState<T>;
  execute: (apiCall: () => Promise<T>) => Promise<T | null>;
  reset: () => void;
  setData: (data: T | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useApiState = <T = any>(
  options: UseApiStateOptions = {}
): UseApiStateReturn<T> => {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
  }, []);

  const execute = useCallback(async (apiCall: () => Promise<T>): Promise<T | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await apiCall();
      
      setState(prev => ({ 
        ...prev, 
        data: result, 
        loading: false, 
        error: null 
      }));

      // 显示成功通知
      if (options.showSuccessNotification && options.successMessage) {
        notifySuccess({ message: options.successMessage });
      }

      return result;
    } catch (error: any) {
      const errorMessage = error?.message || '请求失败';
      
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage 
      }));

      // 处理不同类型的错误
      if (error?.name === 'NetworkError' || error?.code === 'NETWORK_ERROR') {
        handleNetworkError(options.errorContext);
      } else {
        handleApiError(error, options.errorContext);
      }

      return null;
    }
  }, [options.successMessage, options.errorContext, options.showSuccessNotification]);

  return {
    state,
    execute,
    reset,
    setData,
    setLoading,
    setError,
  };
};
```

### Core Architecture Module: `spring-ai-alibaba-admin/frontend/packages/main/src/legacy/hooks/usePagination.ts`
```
import { useState } from "react";
import $i18n from '@/i18n';

const usePagination = () => {

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
    pageSizeOptions: ['10', '20', '50', '100'],
    showTotal: (total: number, range: number[]) => {
      return $i18n.get(
        {
          id: 'legacy.pagination.showTotal',
          dm: '第 {start}-{end} 条，共 {total} 条',
        },
        { start: range[0], end: range[1], total },
      );
    },
  });

  const onChange = (page: number, pageSize: number) => {
    setPagination({
      ...pagination,
      current: page,
      pageSize: pageSize,
    });
  };

  const onShowSizeChange = (page: number, pageSize: number) => {
    setPagination({
      ...pagination,
      current: page,
      pageSize: pageSize,
    });
  };

  return {
    setPagination,
    pagination,
    onPaginationChange: onChange,
    onShowSizeChange,
  }

};

export default usePagination;

```

### Core Architecture Module: `spring-ai-alibaba-admin/frontend/packages/main/src/legacy/pages/prompts/prompt-detail/hooks/useFunctions.ts`
```
import { useState } from "react";


export interface MockTool {
  toolDefinition: {
    name: string,
    description: string,
    parameters: string
  },
  output: string
}

function useFunctions(defaultFunctions: MockTool[]) {

  const [functions, setFunctions] = useState(defaultFunctions || []);

  return {
    functions, setFunctions,
  }

}

export default useFunctions;
```

### Core Architecture Module: `spring-ai-alibaba-admin/frontend/packages/main/src/legacy/utils/formatDateTime.ts`
```
import $i18n from '@/i18n';

const LOCALE_MAP: Record<string, string> = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP' };

/**
 * Parse API datetime values.
 * Backend Jackson WRITE_DATES_AS_TIMESTAMPS serializes LocalDateTime as
 * [year, month(1-12), day, hour, minute, second, nano].
 */
export function parseApiDateTime(value: unknown): Date | null {
  if (value == null || value === '') return null;

  if (Array.isArray(value)) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = value as number[];
    if (year == null || month == null || day == null) return null;
    const date = new Date(year, month - 1, day, hour, minute, second);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format API datetime for UI using the active language locale. */
export function formatDateTime(value: unknown): string {
  const date = parseApiDateTime(value);
  if (!date) return '-';

  const locale = LOCALE_MAP[$i18n.getCurrentLanguage()] || 'en-US';
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

```

### Core Architecture Module: `spring-ai-alibaba-admin/frontend/packages/main/src/legacy/utils/notification.ts`
```
import { notification } from 'antd';
import $i18n from '@/i18n';

// Configure global notification style
notification.config({
  placement: 'topRight',
  top: 50,
  duration: 4.5,
  rtl: false,
});

export interface NotificationOptions {
  message: string;
  description?: string;
  duration?: number;
  placement?: 'top' | 'topLeft' | 'topRight' | 'bottom' | 'bottomLeft' | 'bottomRight';
}

export const notifySuccess = (options: NotificationOptions) => {
  notification.success({
    message: options.message,
    description: options.description,
    duration: options.duration || 3,
    placement: options.placement || 'topRight',
  });
};

export const notifyError = (options: NotificationOptions) => {
  notification.error({
    message: options.message,
    description: options.description,
    duration: options.duration || 5,
    placement: options.placement || 'topRight',
  });
};

export const notifyWarning = (options: NotificationOptions) => {
  notification.warning({
    message: options.message,
    description: options.description,
    duration: options.duration || 4,
    placement: options.placement || 'topRight',
  });
};

export const notifyInfo = (options: NotificationOptions) => {
  notification.info({
    message: options.message,
    description: options.description,
    duration: options.duration || 3,
    placement: options.placement || 'topRight',
  });
};

export const handleApiError = (
  error: any,
  context: string = $i18n.get({
    id: 'legacy.notification.operation',
    dm: '操作',
  }),
) => {
  let message = $i18n.get({
    id: 'legacy.notification.operationFailed',
    dm: '操作失败',
  });
  let description = $i18n.get({
    id: 'legacy.notification.retryLater',
    dm: '请稍后重试',
  });

  if (error && typeof error === 'object') {
    if (error.message) {
      message = $i18n.get(
        {
          id: 'legacy.notification.contextFailed',
          dm: '{context}失败',
        },
        { context },
      );
      description = error.message;
    } else if (error.code && error.code !== 200) {
      message = $i18n.get(
        {
          id: 'legacy.notification.contextFailedWithCode',
          dm: '{context}失败 (错误码: {code})',
        },
        { context, code: error.code },
      );
      description =
        error.message ||
        $i18n.get({
          id: 'legacy.notification.serverException',
          dm: '服务器返回异常',
        });
    } else if (typeof error === 'string') {
      message = $i18n.get(
        {
          id: 'legacy.notification.contextFailed',
          dm: '{context}失败',
        },
        { context },
      );
      description = error;
    }
  } else if (typeof error === 'string') {
    message = $i18n.get(
      {
        id: 'legacy.notification.contextFailed',
        dm: '{context}失败',
      },
      { context },
    );
    description = error;
  }

  notifyError({ message, description });
};

export const handleNetworkError = (
  context: string = $i18n.get({
    id: 'legacy.notification.operation',
    dm: '操作',
  }),
) => {
  notifyError({
    message: $i18n.get(
      {
        id: 'legacy.notification.contextFailed',
        dm: '{context}失败',
      },
      { context },
    ),
    description: $i18n.get({
      id: 'legacy.notification.networkError',
      dm: '网络连接异常，请检查网络后重试',
    }),
    duration: 6,
  });
};

export const handleValidationError = (message: string, description?: string) => {
  notifyWarning({
    message: $i18n.get({
      id: 'legacy.notification.validationFailed',
      dm: '输入验证失败',
    }),
    description: description || message,
  });
};

```

### Core Architecture Module: `spring-ai-alibaba-admin/frontend/packages/main/src/legacy/utils/path.ts`
```
/**
 * Legacy 路径工具函数
 * 统一处理 legacy 页面的路径，自动添加 /admin 前缀
 */

/**
 * 获取完整的 legacy 路径（自动添加 /admin 前缀）
 * @param path 原始路径，如 '/prompts', '/prompt-detail' 等
 * @returns 完整的路径，如 '/admin/prompts', '/admin/prompt-detail' 等
 */
export const getLegacyPath = (path: string): string => {
  // 如果路径已经以 /admin 开头，直接返回
  if (path.startsWith('/admin')) {
    return path;
  }
  
  // 如果路径以 / 开头，添加 /admin 前缀
  if (path.startsWith('/')) {
    return `/admin${path}`;
  }
  
  // 如果路径不以 / 开头，添加 /admin/
  return `/admin/${path}`;
};

/**
 * 构建带查询参数的完整路径
 * @param path 基础路径
 * @param params 查询参数对象
 * @returns 完整的路径，如 '/admin/prompt-detail?promptKey=xxx'
 */
export const buildLegacyPath = (path: string, params?: Record<string, string | number | null | undefined>): string => {
  const fullPath = getLegacyPath(path);
  
  if (!params || Object.keys(params).length === 0) {
    return fullPath;
  }
  
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      searchParams.append(key, String(value));
    }
  });
  
  const queryString = searchParams.toString();
  return queryString ? `${fullPath}?${queryString}` : fullPath;
};


```

### Core Architecture Module: `spring-ai-alibaba-admin/frontend/packages/main/src/legacy/utils/request.ts`
```
// 拦截器接口
interface RequestInterceptor {
  request?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
  response?: <T>(response: ApiResponse<T>) => ApiResponse<T> | Promise<ApiResponse<T>>;
  requestError?: (error: any) => any;
  responseError?: (error: RequestError) => any;
}

// Request 配置接口
interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params?: Record<string, any>;
  data?: Record<string, any> | any;
  headers?: Record<string, string>;
  timeout?: number;
  skipInterceptors?: boolean; // 是否跳过拦截器
}

// 响应接口
interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

// 请求错误类
class RequestError extends Error {
  public code: number;
  public response?: any;

  constructor(message: string, code: number, response?: any) {
    super(message);
    this.name = 'RequestError';
    this.code = code;
    this.response = response;
  }
}

// 拦截器管理
class InterceptorManager {
  private interceptors: (RequestInterceptor | null)[] = [];

  // 添加拦截器
  use(interceptor: RequestInterceptor): number {
    this.interceptors.push(interceptor);
    return this.interceptors.length - 1;
  }

  // 移除拦截器
  eject(id: number): void {
    if (this.interceptors[id]) {
      this.interceptors[id] = null;
    }
  }

  // 执行请求拦截器
  async processRequest(config: RequestConfig): Promise<RequestConfig> {
    let processedConfig = config;
    
    for (const interceptor of this.interceptors) {
      if (interceptor && interceptor.request) {
        try {
          processedConfig = await interceptor.request(processedConfig);
        } catch (error) {
          if (interceptor.requestError) {
            throw interceptor.requestError(error);
          }
          throw error;
        }
      }
    }
    
    return processedConfig;
  }

  // 执行响应拦截器
  async processResponse<T>(response: ApiResponse<T>): Promise<ApiResponse<T>> {
    let processedResponse = response;
    
    for (const interceptor of this.interceptors) {
      if (interceptor && interceptor.response) {
        try {
          processedResponse = await interceptor.response(processedResponse);
        } catch (error) {
          if (interceptor.responseError && error instanceof RequestError) {
            throw interceptor.responseError(error);
          }
          throw error;
        }
      }
    }
    
    return processedResponse;
  }

  // 执行错误拦截器
  async processError(error: RequestError): Promise<never> {
    for (const interceptor of this.interceptors) {
      if (interceptor && interceptor.responseError) {
        try {
          throw interceptor.responseError(error);
        } catch (processedError) {
          // 如果拦截器返回了新的错误，继续抛出
          error = processedError instanceof RequestError ? processedError : error;
        }
      }
    }
    throw error;
  }

  // 清空所有拦截器
  clear(): void {
    this.interceptors = [];
  }
}

// 全局拦截器管理器
const interceptors = new InterceptorManager();

// 添加默认拦截器 - 自动添加认证头
interceptors.use({
  request: async (config: RequestConfig) => {
    // 可以在这里添加认证 token
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${token}`
      };
    }
    
    // 添加通用请求头
    config.headers = {
      'X-Client-Version': '1.0.0',
      'X-Request-ID': Math.random().toString(36).substring(2),
      ...config.headers,
    };
    
    return config;
  },
  
  responseError: (error: RequestError) => {
    // 处理 401 未授权错误
    if (error.code === 401) {
      console.warn('Authentication failed, redirecting to login...');
      // 可以在这里处理登录重定向
      localStorage.removeItem('authToken');
    }
    
    return error;
  }
});

// 将参数对象转换为查询字符串
function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (typeof value === 'object') {
        searchParams.append(key, JSON.stringify(value));
      } else {
        searchParams.append(key, String(value));
      }
    }
  });
  
  return searchParams.toString();
}

// 配置基础 URL（可选）
let baseURL = '';

// 通用请求函数
async function baseRequest<T = any>(
  url: string,
  config: RequestConfig = {}
): Promise<ApiResponse<T>> {
  let processedConfig = { ...config };
  const {
    method = 'GET',
    skipInterceptors = false,
    timeout = 10000
  } = processedConfig;

  try {
    // 处理请求拦截器
    if (!skipInterceptors) {
      processedConfig = await interceptors.processRequest(processedConfig);
    }

    const {
      params,
      data,
      headers = {},
    } = processedConfig;

    // 构建完整URL
    let fullUrl = baseURL && !url.startsWith('http') ? baseURL + url : url;
    if (params && Object.keys(params).length > 0) {
      const queryString = buildQueryString(params);
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
    }

    // 准备请求配置
    const fetchConfig: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    // 添加请求体（仅对非GET请求）
    if (method !== 'GET' && data) {
      if (typeof data === 'object') {
        fetchConfig.body = JSON.stringify(data);
      } else {
        fetchConfig.body = data;
      }
    }

    // 创建超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    fetchConfig.signal = controller.signal;

    console.log(`[REQUEST] ${method} ${fullUrl}`, {
      params,
      data,
      headers: fetchConfig.headers
    });

    // 发送请求
    const response = await fetch(fullUrl, fetchConfig);
    
    // 清除超时
    clearTimeout(timeoutId);

    // 检查响应状态
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[REQUEST ERROR] ${method} ${fullUrl} - ${response.status}`, errorText);
      
      const requestError = new RequestError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorText
      );

      // 处理错误拦截器
      if (!skipInterceptors) {
        await interceptors.processError(requestError);
      }
      
      throw requestError;
    }

    // 解析响应
    let responseData = await response.json();
    
    console.log(`[RESPONSE] ${method} ${fullUrl}`, responseData);

    // 检查业务状态码
    if (responseData.code !== undefined && responseData.code !== 200 && responseData.code !== 0) {
      const requestError = new RequestError(
        responseData.message || '请求失败',
        responseData.code,
        responseData
      );

      // 处理错误拦截器
      if (!skipInterceptors) {
        await interceptors.processError(requestError);
      }
      
      throw requestError;
    }

    // 处理响应拦截器
    if (!skipInterceptors) {
      responseData = await interceptors.processResponse(responseData);
    }

    return responseData;

  } catch (error: unknown) {
    if (error instanceof RequestError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[REQUEST TIMEOUT] ${method} ${url}`);
      const timeoutError = new RequestError('请求超时', 408);
      
      // 处理错误拦截器
      if (!skipInterceptors) {
        await interceptors.processError(timeoutError);
      }
      
      throw timeoutError;
    }

    console.error(`[REQUEST ERROR] ${method} ${url}`, error);
    
    // 网络错误或其他错误
    const networkError = new RequestError(
      error instanceof Error ? error.message : '网络请求失败',
      0,
      error
    );

    // 处理错误拦截器
    if (!skipInterceptors) {
      await interceptors.processError(networkError);
    }
    
    throw networkError;
  }
}

// 主要请求函数
export const request = baseRequest;

// 便捷方法
export const get = <T = any>(url: string, params?: Record<string, any>, config?: Omit<RequestConfig, 'method' | 'params'>) => {
  return request<T>(url, { ...config, method: 'GET', params });
};

export const post = <T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'data'>) => {
  return request<T>(url, { ...config, method: 'POST', data });
};

export const put = <T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'data'>) => {
  return request<T>(url, { ...config, method: 'PUT', data });
};

export const del = <T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'data'>) => {
  return request<T>(url, { ...config, method: 'DELETE', data });
};

// 拦截器管理接口
export const requestInterceptors = {
  // 添加拦截器
  use: (interceptor: RequestInterceptor) => interceptors.use(interceptor),
  
  // 移除拦截器
  eject: (id: number) => interceptors.eject(id),
  
  // 清空所有拦截器
  clear: () => interceptors.clear()
};

// 基础URL配置
export const setBaseURL = (url: string) => {
  baseURL = url;
};

export const getBaseURL = () => baseURL;

// 默认导出
export default {
  request,
  get,
  post,
  put,
  delete: del,
  RequestError,
  interceptors: requestInterceptors,
  setBaseURL,
  getBaseURL
};

/* 
使用示例:

// 基本使用
import { request, get, post } from './utils/request';

// GET 请求
const prompts = await get('/api/prompts', { pageSize: 10 });

// POST 请求
const newPrompt = await post('/api/prompt', { 
  promptKey: 'test',
  promptDescription: 'Test prompt' 
});

// 使用拦截器
import { requestInterceptors } from './utils/request';

// 添加请求拦截器
const interceptorId = requestInterceptors.use({
  request: (config) => {
    config.headers = { ...config.headers, 'Custom-Header': 'value' };
    return config;
  },
  response: (response) => {
    console.log('Response received:', response);
    return response;
  }
});

// 移除拦截器
requestInterceptors.eject(interceptorId);

// 设置基础URL
import { setBaseURL } from './utils/request';
setBaseURL('https://api.example.com');
*/
```

### Core Architecture Module: `spring-ai-alibaba-admin/frontend/packages/main/src/legacy/utils/requestInterceptors.ts`
```
import { requestInterceptors } from './request';
import { notifyError, notifyWarning } from './notification';

// 全局错误处理拦截器
export const setupGlobalErrorHandling = () => {
  // 添加全局错误处理拦截器
  requestInterceptors.use({
    responseError: (error) => {
      // 根据错误状态码进行不同处理
      if (error.code === 401) {
        notifyWarning({
          message: '身份验证失败',
          description: '请重新登录后继续操作',
          duration: 5,
        });
        
        // 可以在这里添加重定向到登录页的逻辑
        // window.location.href = '/login';
      } else if (error.code === 403) {
        notifyError({
          message: '访问被拒绝',
          description: '您没有权限执行此操作',
          duration: 5,
        });
      } else if (error.code === 404) {
        notifyError({
          message: '资源不存在',
          description: '请求的资源未找到',
        });
      } else if (error.code >= 500) {
        notifyError({
          message: '服务器内部错误',
          description: '服务器遇到了一个错误，请稍后重试',
          duration: 6,
        });
      } else if (error.code === 0 || !error.code) {
        // 网络错误
        notifyError({
          message: '网络连接失败',
          description: '请检查网络连接后重试',
          duration: 6,
        });
      }

      // 继续抛出错误，让具体的组件处理
      throw error;
    },

    request: async (config) => {
      // 可以在这里添加全局请求头
      return config;
    },
  });
};

// 初始化全局错误处理
setupGlobalErrorHandling();
```

### Core Architecture Module: `spring-ai-alibaba-admin/frontend/packages/main/src/legacy/utils/streamingPrompt.ts`
```
import { message } from 'antd';
import $i18n from '@/i18n';
import { MockTool } from '../pages/prompts/prompt-detail/hooks/useFunctions';

/**
 * Common streaming prompt execution utility
 * Handles the shared logic between PlaygroundPage and PromptDetailPage
 */

export interface StreamingPromptConfig {
  promptId: string | number;
  content: string;
  parameterValues: Record<string, any>;
  selectedModel: string;
  modelParams: Record<string, string>;
  sessionId?: string;
  promptKey?: string;
  version?: string;
  mockTools?: MockTool[];
}

export interface StreamingPromptCallbacks {
  onUpdateChatHistory: (promptId: string | number, updater: (chatHistory: any[]) => any[]) => void;
  onUpdateSessionId: (promptId: string | number, sessionId: string) => void;
  onUpdateMetrics: (promptId: string | number, data: {
    usage: Record<string, any>;
    traceId: string;
  }) => void;
  formatTime: (timestamp: number) => string;
  replaceParameters: (content: string, parameterValues: Record<string, any>) => string;
}

export interface EventSourceRef {
  close: () => void;
}

/**
 * Execute streaming prompt with shared logic
 */
export const executeStreamingPrompt = async (
  config: StreamingPromptConfig,
  inputText: string,
  callbacks: StreamingPromptCallbacks,
  eventSourceRefs: Record<string | number, EventSourceRef>
): Promise<void> => {
  const {
    promptId,
    content,
    parameterValues,
    selectedModel,
    modelParams,
    sessionId: initialSessionId,
    promptKey = '',
    version = '1.0',
    mockTools = []
  } = config;

  const {
    onUpdateChatHistory,
    onUpdateSessionId,
    formatTime,
    replaceParameters,
  } = callbacks;

  // Replace parameters in content
  const processedContent = content;

  // Prepare model config
  const modelConfig = {
    modelId: selectedModel,
    ...config.modelParams
  };

  // Generate sessionId for first call
  let sessionId = initialSessionId;
  const isNewSession = !sessionId;

  if (!sessionId) {
    sessionId = ``;
  }

  try {
    // Create request parameters
    const requestParams = {
      sessionId: sessionId,
      promptKey,
      version,
      template: processedContent,
      variables: JSON.stringify(parameterValues),
      modelConfig: JSON.stringify(modelConfig),
      message: inputText,
      newSession: isNewSession,
      mockTools: mockTools
    };

    let currentMessage = {
      id: Date.now(),
      promptId,
      type: 'assistant', // 修正类型匹配，与UI中的判断一致
      content: '',
      isLoading: true,
      timestamp: formatTime(Date.now()),
      modelParams,
      sessionId: sessionId,
      model: selectedModel
    };

    // Add loading message to chat history and update sessionId if newly generated
    onUpdateChatHistory(promptId, (chatHistory) => [...(chatHistory || []), currentMessage]);

    if (!initialSessionId) {
      onUpdateSessionId(promptId, sessionId);
    }

    // Use fetch for streaming POST request
    const response = await fetch('/api/prompt/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/x-ndjson'
      },
      body: JSON.stringify(requestParams)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Unable to read response stream');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let updateTimeoutId: NodeJS.Timeout | null = null;

    // Store reader reference for cleanup
    eventSourceRefs[promptId] = { close: () => reader.cancel() };

    const updateChatHistory = (data = {}) => {
      onUpdateChatHistory(promptId, (chatHistory) =>
        chatHistory.map(msg =>
          msg.id === currentMessage.id ? {
            ...msg,
            content: currentMessage.content,
            isLoading: currentMessage.isLoading,
            ...data
          } : msg
        )
      );
    };

    const scheduleUpdate = () => {
      if (updateTimeoutId) {
        clearTimeout(updateTimeoutId);
      }
      // 控制更新频率，避免过于频繁的UI更新
      updateTimeoutId = setTimeout(updateChatHistory, 50);
    };

    const readStream = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Stream completed
            currentMessage.isLoading = false;
            // 清除待执行的更新，立即执行最终更新
            if (updateTimeoutId) {
              clearTimeout(updateTimeoutId);
              updateTimeoutId = null;
            }
            updateChatHistory();
            delete eventSourceRefs[promptId];
            break;
          }

          // Process the chunk
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);

                if (data.type === 'session' || data.type === 'session_info') {
                  // Update session ID if backend returns a different one
                  const backendSessionId = data.sessionId;
                  if (backendSessionId && backendSessionId !== sessionId) {
                    sessionId = backendSessionId;
                    currentMessage.sessionId = backendSessionId;
                    onUpdateSessionId(promptId, backendSessionId);
                  }
                } else if (data.type === "metrics") {
                  updateChatHistory(data.metrics);
                } else if (data.type === 'content' || data.type === 'message') {
                  // Append content incrementally for streaming display
                  currentMessage.content += data.content || '';
                  // 使用节流更新策略，提高流式展示的流畅性
                  scheduleUpdate();
                } else if (data.type === 'end') {
                  // Streaming finished
                  currentMessage.isLoading = false;
                  // 清除待执行的更新，立即执行最终更新
                  if (updateTimeoutId) {
                    clearTimeout(updateTimeoutId);
                    updateTimeoutId = null;
                  }
                  updateChatHistory();
                  delete eventSourceRefs[promptId];
                  return;
                } else if (data.type === 'error') {
                  // Handle error
                  currentMessage.content = $i18n.get(
                    { id: 'legacy.prompts.error.with.message', dm: '错误: {message}' },
                    {
                      message:
                        data.error ||
                        $i18n.get({ id: 'legacy.prompts.unknown.error', dm: '未知错误' }),
                    },
                  );
                  currentMessage.isLoading = false;
                  // 清除待执行的更新，立即执行错误状态更新
                  if (updateTimeoutId) {
                    clearTimeout(updateTimeoutId);
                    updateTimeoutId = null;
                  }
                  updateChatHistory();
                  delete eventSourceRefs[promptId];
                  message.error(
                    data.error ||
                      $i18n.get({ id: 'legacy.prompts.request.failed', dm: '请求失败' }),
                  );
                  return;
                }
              } catch (parseError) {
                console.error('Error parsing stream data:', parseError, 'Line:', line);
              }
            }
          }
        }
      } catch (streamError) {
        console.error('Stream reading error:', streamError);
        currentMessage.content = $i18n.get({
          id: 'legacy.prompts.connection.error.retry',
          dm: '连接错误，请稍后重试',
        });
        currentMessage.isLoading = false;
        // 清除待执行的更新，立即执行错误状态更新
        if (updateTimeoutId) {
          clearTimeout(updateTimeoutId);
          updateTimeoutId = null;
        }
        updateChatHistory();
        delete eventSourceRefs[promptId];
        message.error(
          $i18n.get({ id: 'legacy.prompts.connection.failed', dm: '连接失败' }),
        );
      }
    };

    readStream();

  } catch (error) {
    console.error('Run prompt error:', error);
    message.error($i18n.get({ id: 'legacy.prompts.request.failed', dm: '请求失败' }));

    // Update the loading message to show error
    onUpdateChatHistory(promptId, (chatHistory) =>
      chatHistory.map(msg =>
        msg.isLoading && msg.promptId === promptId
          ? {
              ...msg,
              content: $i18n.get({
                id: 'legacy.prompts.request.failed.retry',
                dm: '请求失败，请稍后重试',
              }),
              isLoading: false,
            }
          : msg
      )
    );

    // Clean up
    delete eventSourceRefs[promptId];
  }
};

```

### Core Architecture Module: `spring-ai-alibaba-admin/frontend/packages/main/src/legacy/utils/util.ts`
```
export const extractParametersFromDoubleBrace = (content: string) => {
  const regex = /\{\{(\w+)\}\}/g;
  const parameters: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (!parameters.includes(match[1])) {
      parameters.push(match[1]);
    }
  }
  return parameters;
};

export const safeJSONStringify = <T>(obj: any, fallback: () => T = () => "" as T, replacer?: (this: any, key: string, value: any) => any, space?: number) => {
  try {
    return JSON.stringify(obj, replacer, space);
  } catch (error) {
    return fallback();
  }
};

export const safeJSONParse = <T>(jsonString: string, fallback: () => T = () => ({} as T), reviver?: (this: any, key: string, value: any) => any) => {
  try {
    return JSON.parse(jsonString, reviver);
  } catch (error) {
    return fallback();
  }
};

export function copyToClipboard(text: string) {
  // 返回一个 Promise 对象
  return new Promise((resolve, reject) => {
    if (navigator.clipboard && window.isSecureContext) {
      // 使用 Clipboard API 写入剪切板
      navigator.clipboard.writeText(text).then(resolve, reject);
    } else {
      // 非安全环境下或不支持 Clipboard API 的浏览器的回退方法
      const textArea = document.createElement('textarea');
      textArea.value = text;

      // 避免出现滚动条
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand('copy');
        successful ? resolve(void 0) : reject();
      } catch (err) {
        reject(err); // 如果执行失败，调用 reject
      }
      document.body.removeChild(textArea);
    }
  });
}

```

### Core Architecture Module: `spring-ai-alibaba-admin/frontend/packages/main/src/pages/App/Workflow/hooks/useGlobalVariableList.tsx`
```
import $i18n from '@/i18n';
import { IGlobalVariableItem } from '@/types/appManage';
import { useCallback } from 'react';
import { useWorkflowAppStore } from '../context/WorkflowAppProvider';

export const useGlobalVariableList = () => {
  const globalVariableList = useWorkflowAppStore(
    (state) => state.globalVariableList,
  );
  const setGlobalVariableList = useWorkflowAppStore(
    (state) => state.setGlobalVariableList,
  );

  const initGlobalVariableList = useCallback(
    (list: IGlobalVariableItem[]) => {
      setGlobalVariableList(
        !list?.length
          ? []
          : [
              {
                label: $i18n.get({
                  id: 'main.pages.App.Workflow.hooks.useGlobalVariableList.index.conversationVariable',
                  dm: '会话变量',
                }),
                nodeId: 'conversation',
                nodeType: 'conversation',
                children: list.map((item) => ({
                  label: item.key,
                  value: `\${conversation.${item.key}}`,
                  type: item.type,
                })),
              },
            ],
      );
    },
    [setGlobalVariableList],
  );

  return {
    globalVariableList,
    initGlobalVariableList,
  };
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4981** (2026-09-18): **[Question]**
  *Symptoms*: ### Question  v2.0 GA版本预计什么时间发布呢

- **Issue #4967** (2026-09-12): **[Docs] quick-start 示例照抄即复现 400：工具 inputType 使用 String.class**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Current Behavior  照抄官方 quick-start 的「构建一个基础 Agent」小节（`FunctionToolCallback` 使用 `.inputType(String.class)`），**第二轮**请求返回 400，工具调用链路中断。  第一轮请求正常；第二轮（回传模型返回的 `tool_call` 时）失败：  ```text HTTP 400 - {"request_id":"330f8d4d-77f5-9671-86ba-a1b223fbb175","code":"InvalidParameter", "message":"<400> InternalError.Algo.InvalidParameter: The \"function.arguments\" parameter of the code model must be in JSON format."} ```  同一页「构建一个真实的 Agent」步骤 2 的两个工具（`WeatherForLocationTool` / `UserLocationTool`）写法相同，同样会失败。   ### Expected Behavior  正常返回天气结果，且 `get_weather` 被真实调用（ReAct 循环能正常走完两轮）。    ### Steps To Reproduce  1. 打开 https://java2ai.com/docs/quick-start 的「构建一个基础 Agent」小节，**原样**复制该小节代码； 2. 执行 `agent.call("what is the weather in San Francisco")`； 3. 第二轮请求返回上述 400。  补充：以下最小验证**不需要 API Key、不联网**，可直接确认根因（约 30 秒）：  ```java ToolCallback tool = FunctionToolCallback.builder("get_weather", new WeatherTool())         .description("Get weather for a given city")         .inputType(String.class)         .build();  System.out.println(tool.getToolDefinition().inputSchema()); // 输出: { "type" : "string", "additionalProperties" : false } ```  把 `inputType` 换成 record 类型后，输出为 `"type" : "object"`，且 400 消失。   ### Environment  ```markdown Spring AI Alibaba version(s): 1.1.2.0  | 项                                  | 值                                                          | | ----------------------------------- | ---------------
  **Post-Mortem & Fix Analysis**:
  > 与 #4966 重复（网络原因重复提交，抱歉制造噪音），保留 #4966。

- **Issue #4966** (2026-09-25): **[Docs] quick-start 示例照抄即复现 400：工具 inputType 使用 String.class**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Current Behavior  照抄官方 quick-start 的「构建一个基础 Agent」小节（`FunctionToolCallback` 使用 `.inputType(String.class)`），**第二轮**请求返回 400，工具调用链路中断。  第一轮请求正常；第二轮（回传模型返回的 `tool_call` 时）失败：  ```text HTTP 400 - {"request_id":"330f8d4d-77f5-9671-86ba-a1b223fbb175","code":"InvalidParameter", "message":"<400> InternalError.Algo.InvalidParameter: The \"function.arguments\" parameter of the code model must be in JSON format."} ```  同一页「构建一个真实的 Agent」步骤 2 的两个工具（`WeatherForLocationTool` / `UserLocationTool`）写法相同，同样会失败。   ### Expected Behavior  正常返回天气结果，且 `get_weather` 被真实调用（ReAct 循环能正常走完两轮）。  ### Steps To Reproduce  1. 打开 https://java2ai.com/docs/quick-start 的「构建一个基础 Agent」小节，**原样**复制该小节代码； 2. 执行 `agent.call("what is the weather in San Francisco")`； 3. 第二轮请求返回上述 400。  补充：以下最小验证**不需要 API Key、不联网**，可直接确认根因（约 30 秒）：  ```java ToolCallback tool = FunctionToolCallback.builder("get_weather", new WeatherTool())         .description("Get weather for a given city")         .inputType(String.class)         .build();  System.out.println(tool.getToolDefinition().inputSchema()); // 输出: { "type" : "string", "additionalProperties" : false } ```  把 `inputType` 换成 record 类型后，输出为 `"type" : "object"`，且 400 消失。    ### Environment  ```markdown Spring AI Alibaba version(s): 1.1.2.0  | 项                                  | 值                                                          | | ----------------------------------- | ----------------
  **Post-Mortem & Fix Analysis**:
  > 已在文档仓库提交修复 PR：https://github.com/spring-ai-alibaba/website/pull/282
  > https://github.com/agentic-spring-ai/website
  > @yuluo-yx 感谢指引！已按您的提示，把同样的修复提交到 agentic-spring-ai/website：  https://github.com/agentic-spring-ai/website/pull/1  改动与 spring-ai-alibaba/website#282 一致（docs/quick-start.md，+34/-16）。 #282 我先保留，如需关闭请告知。

- **Issue #4952** (2026-09-17): **[BUG] Timed-out parallel tools can execute after waiting for a permit**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues and pull requests.  ### Current Behavior  With parallel tool execution and a concurrency limit, a tool waiting in `Semaphore.acquire()` can outlive its outer `CompletableFuture.orTimeout()`:  1. The agent receives timeout responses for both tools. 2. Releasing a permit afterward still lets the waiting tool invoke its callback, despite its response already being finalized as a timeout. 3. If the running tool never releases its permit, the waiter continues occupying an executor worker after the agent call returns.  For tools that perform writes or call external services, the late invocation can cause side effects after the caller has already received a failure. This was reproduced with an invocation counter, not with real external writes.  ### Expected Behavior  Waiting for a parallel execution permit should be bounded by the tool's remaining timeout budget, including executor queueing time. A tool whose budget expired while waiting should not begin execution when a permit later becomes available. Waiting workers should become reusable even if an already-running synchronous tool remains blocked.  ### Steps To Reproduce  Use an `AgentToolNode` configured as follows:  ```java AgentToolNode.builder()     .agentName("test-agent")     .toolCallbacks(List.of(firstTool, secondTool))     .parallelToolExecution(true)     .maxParallelTools(1)     .toolExecutionTimeout(Duration.ofSeconds(2))     .toolExecu
  **Post-Mortem & Fix Analysis**:
  > **Issue Evaluation**  Category: `bug` | Status: **Needs Verification**  Thank you for reporting this issue. It has been classified as a potential bug.  **Next steps:** - This issue will be verified against the current codebase by the automated analysis engine. - If confirmed, a fix proposal (spec) will be generated for community review. - You can reply `/approve` to fast-track PR generation, or `/reject` to close the proposal.  **Reported by:** @beemines  --- *Automated evaluation by oss-sentinel-ai*

- **Issue #4950** (2026-09-17): **[BUG] AppendStrategy(false) ignores duplicate policy for scalar updates**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues and pull requests.  ### Current Behavior  `AppendStrategy(false)` removes duplicates when a node returns a list, but ignores the flag when the node returns a single value. The same logical update therefore produces different state depending on whether it is wrapped in a list.  ### Expected Behavior  When appending to an existing list with `allowDuplicate=false`, a scalar update should have the same duplicate policy and encounter order as an equivalent singleton-list update, without mutating the previous state. The default duplicate-allowing behavior should remain unchanged.  ### Steps To Reproduce  Using `com.alibaba.cloud.ai.graph.state.strategy.AppendStrategy` and `java.util.List`:  ```java var strategy = new AppendStrategy(false); var previous = List.of("first", "second");  strategy.apply(previous, "second");         // [first, second, second] strategy.apply(previous, List.of("second")); // [first, second] ```  This also reproduces through `StateGraph`: register `new AppendStrategy(false)` for a `results` key, connect two nodes that each return `Map.of("results", "answer")`, and invoke the graph. The final state is `[answer, answer]` instead of `[answer]`.  ### Environment  - Current `main`: `f82da0b50f35744c13968191be2b1cd2452ef550` (POM version 1.1.2.2) - Windows, JDK 17.0.17, Maven 3.9.4 - No database or external model calls required  ### Debug logs  A local regression suite has 9 cases.
  **Post-Mortem & Fix Analysis**:
  > **Issue Evaluation**  Category: `bug` | Status: **Needs Verification**  Thank you for reporting this issue. It has been classified as a potential bug.  **Next steps:** - This issue will be verified against the current codebase by the automated analysis engine. - If confirmed, a fix proposal (spec) will be generated for community review. - You can reply `/approve` to fast-track PR generation, or `/reject` to close the proposal.  **Reported by:** @beemines  --- *Automated evaluation by oss-sentinel-ai*

- **Issue #4940** (2026-09-07): **fix(agent): resolve skill tools after HITL resume**
  *Symptoms*: ### Describe what this PR does / why we need it  When a Skill progressively discloses a tool through `SkillsInterceptor`, `AgentLlmNode` stores the dynamic callback in the current run's `RunnableConfig.context` so `AgentToolNode` can execute it.  If `HumanInTheLoopHook` interrupts that tool call, applications normally resume with a newly built `RunnableConfig`. The new config has an empty context, so the approved Skill tool can no longer be resolved. Current `main` consequently returns a `Tool not available` response (older releases throw `No ToolCallback found`) instead of executing the approved tool.  This PR preserves progressive disclosure while making Skill-managed callbacks resolvable during resumed tool execution.  ### Does this pull request fix one issue?  Fixes #4606.  ### Describe how you did it  - Make `SkillsInterceptor` implement Spring AI's `ToolCallbackResolver` contract for tools it manages. - Resolve current `groupedTools` / `groupedToolsSupplier` entries at execution time, so runtime tool updates remain effective. - Limit fallback resolution through the configured resolver to tool names declared in a registered Skill's `allowed_tools` list. - Register model interceptors that implement `ToolCallbackResolver` as execution-only dynamic resolvers on `AgentToolNode`. - Keep the existing resolution order: static node tools, current-run dynamic callbacks, dynamic interceptor resolvers, then the agent-level resolver. - Do not add these execution fallback callbacks t
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-08-30T18:18:10.042591Z">2026-08-30T18:18:10.042591Z</relative-time> | `9d6adf3` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>
  > ## PR Review — #4940: fix(agent): resolve skill tools after HITL resume  ### Summary This PR modifies 4 files (+146 -1) on branch `fix/skill-hitl-dynamic-tools` targeting `main`.  ### Changed Files - `spring-ai-alibaba-agent-framework/src/main/java/com/alibaba/cloud/ai/graph/agent/ReactAgent.java` - `spring-ai-alibaba-agent-framework/src/main/java/com/alibaba/cloud/ai/graph/agent/interceptor/skills/SkillsInterceptor.java` - `spring-ai-alibaba-agent-framework/src/main/java/com/alibaba/cloud/ai/graph/agent/node/AgentToolNode.java` - `spring-ai-alibaba-agent-framework/src/test/java/com/alibaba/cloud/ai/graph/agent/interceptors/SkillsInterceptorEnhancementsTest.java`  ### Note Automated deep review via code engine was unavailable. This is a structural overview only. Please verify: - All changed files are intentional - Tests cover the modifications - No credentials or secrets are introduced - API changes are backward compatible
  >  https://github.com/agentic-spring-ai/agentic-spring-ai 可以提这里   这里的我不会再看了

- **Issue #4938** (2026-08-31): **fix(agent): use object schemas for filesystem tools**
  *Symptoms*: ## Summary  - wrap the `ls` path and `glob` pattern in request records so their generated tool schemas use a top-level JSON object - preserve the existing direct `apply(String, ToolContext)` API for compatibility - add regression tests for the generated schemas and JSON tool invocation  ## Verification  - reproduced the reported `ls` string-schema rejection against DeepSeek - verified a `ReactAgent` with `FilesystemInterceptor` is accepted after the change - `./mvnw -pl spring-ai-alibaba-agent-framework test` (`615` tests, `0` failures, `0` errors)  Fixes #4937
  **Post-Mortem & Fix Analysis**:
  > ## PR Review — #4938: fix(agent): use object schemas for filesystem tools  ### Summary This PR modifies 3 files (+95 -5) on branch `fix/4937-deepseek-filesystem-schema` targeting `main`.  ### Changed Files - `spring-ai-alibaba-agent-framework/src/main/java/com/alibaba/cloud/ai/graph/agent/extension/tools/filesystem/GlobTool.java` - `spring-ai-alibaba-agent-framework/src/main/java/com/alibaba/cloud/ai/graph/agent/extension/tools/filesystem/ListFilesTool.java` - `spring-ai-alibaba-agent-framework/src/test/java/com/alibaba/cloud/ai/graph/agent/extension/tools/filesystem/FilesystemToolSchemaTest.java`  ### Note Automated deep review via code engine was unavailable. This is a structural overview only. Please verify: - All changed files are intentional - Tests cover the modifications - No credentials or secrets are introduced - API changes are backward compatible
  >  https://github.com/agentic-spring-ai/agentic-spring-ai 可以提这里   这里的我不会再看了
  > The fix has been moved to agentic-spring-ai/agentic-spring-ai#54 per maintainer guidance. Closing this PR to avoid duplicate review.

- **Issue #4933** (2026-09-03): **fix(admin): add missing ThreadPoolExecutor import in RequestContextThreadPoolWrapper**
  *Symptoms*: ### Describe what this PR does / why we need it  `spring-ai-alibaba-admin-server-core` currently fails to compile on `main` because `RequestContextThreadPoolWrapper` references `ThreadPoolExecutor` (line 235) without importing it. This PR adds the missing import.  ### Does this pull request fix one issue?  Fixes #4931  ### Describe how you did it  Added `import java.util.concurrent.ThreadPoolExecutor;` to `RequestContextThreadPoolWrapper.java`, placed in alphabetical order among the existing `java.util.concurrent` imports.  ### Describe how to verify it  Verified with an A/B test on a clean clone of `main` (`f82da0b`, JDK 17):  1. `cd spring-ai-alibaba-admin && mvn -pl spring-ai-alibaba-admin-server-core -am compile`    fails with:    `RequestContextThreadPoolWrapper.java:[235,16] cannot find symbol: class ThreadPoolExecutor` 2. With this one-line change (`git diff` = 1 insertion), the same command    completes with `BUILD SUCCESS`.  Checkstyle (using the repo's own config at `tools/src/checkstyle/checkstyle.xml`) reports no violations for the changed file.  Note: the CI workflows do not cover the `spring-ai-alibaba-admin` modules (the root `pom.xml` reactor excludes them), so the local compilation above is the authoritative verification.  ### Special notes for reviews  None. 
  **Post-Mortem & Fix Analysis**:
  > ## PR Review — #4933: fix(admin): add missing ThreadPoolExecutor import in RequestContextThreadPoolWrapper  ### Summary This PR modifies 1 files (+1 -0) on branch `fix/issue-4931-admin-server-core-compile` targeting `main`.  ### Changed Files - `spring-ai-alibaba-admin/spring-ai-alibaba-admin-server-core/src/main/java/com/alibaba/cloud/ai/studio/core/utils/concurrent/RequestContextThreadPoolWrapper.java`  ### Note Automated deep review via code engine was unavailable. This is a structural overview only. Please verify: - All changed files are intentional - Tests cover the modifications - No credentials or secrets are introduced - API changes are backward compatible
  >  https://github.com/agentic-spring-ai/agentic-spring-ai 可以提这里   这里的我不会再看了
  > The `spring-ai-alibaba-admin` module appears to have been migrated to [agentic-spring-ai/agentic-spring-ai](https://github.com/agentic-spring-ai/agentic-spring-ai). As the target file (`RequestContextThreadPoolWrapper.java`) does not exist in the new repository, I'm closing this PR. Thank you for the review guidance, @yuluo-yx.

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

### Incident Patch 1: `e61cbc4e` (2026-08-25)
**Commit Message**: fix(graph): preserve streaming node id in error callbacks (#4925)

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/GraphRunnerContext.java` (modified, +14/-4)
```diff
@@ -314,23 +314,33 @@ public OverAllState cloneState(Map<String, Object> data) throws Exception {
 	// ================================================================================================================
 
 	public void doListeners(String scene, Exception e) {
+		doListeners(scene, getCurrentNodeId(), e);
+	}
+
+	/**
+	 * Notifies lifecycle listeners using an explicit node ID.
+	 * @param scene the lifecycle scene
+	 * @param nodeId the node associated with the lifecycle event
+	 * @param e the error when the scene is {@link StateGraph#ERROR}
+	 */
+	public void doListeners(String scene, String nodeId, Exception e) {
 		for (GraphLifecycleListener listener : compiledGraph.compileConfig.lifecycleListeners()) {
 			try {
 				switch (scene) {
 					case START:
-						listener.onStart(getCurrentNodeId(), getCurrentStateData(), config);
+						listener.onStart(nodeId, getCurrentStateData(), config);
 						break;
 					case END:
 						listener.onComplete(END, getCurrentStateData(), config);
 						break;
 					case NODE_BEFORE:
-						listener.before(getCurrentNodeId(), getCurrentStateData(), config, SystemClock.now());
+						listener.before(nodeId, getCurrentStateData(), config, SystemClock.now());
 						break;
 					case NODE_AFTER:
-						listener.after(getCurrentNodeId(), getCurrentStateData(), config, SystemClock.now());
+						listener.after(nodeId, getCurrentStateData(), config, SystemClock.now());
 						break;
 					case ERROR:
-						listener.onError(getCurrentNodeId(), getCurrentStateData(), e, config);
+						listener.onError(nodeId, getCurrentStateData(), e, config);
 						break;
 				}
 			} catch (Exception ex) {
```

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/executor/NodeExecutor.java` (modified, +1/-1)
```diff
@@ -322,7 +322,7 @@ else if (element instanceof GraphResponse) {
 				// Handle actual error signals from the Flux
 				log.error("Error signal occurred in embedded Flux stream for key '{}': {}",
 					key, error.getMessage());
-				context.doListeners(ERROR, new Exception(error));
+				context.doListeners(ERROR, nodeId, new Exception(error));
 				GraphResponse<NodeOutput> errorResponse = GraphResponse.error(error);
 				lastGraphResponseRef.set(errorResponse);
 				return Flux.just(errorResponse);
```

**File**: `spring-ai-alibaba-graph-core/src/test/java/com/alibaba/cloud/ai/graph/StateGraphTest.java` (modified, +43/-0)
```diff
@@ -32,6 +32,8 @@
 import com.alibaba.cloud.ai.graph.state.RemoveByHash;
 import com.alibaba.cloud.ai.graph.state.strategy.AppendStrategy;
 import com.alibaba.cloud.ai.graph.state.strategy.ReplaceStrategy;
+import com.alibaba.cloud.ai.graph.streaming.GraphFlux;
+import com.alibaba.cloud.ai.graph.streaming.ParallelGraphFlux;
 import com.alibaba.cloud.ai.graph.streaming.StreamingOutput;
 import com.alibaba.cloud.ai.graph.utils.EdgeMappings;
 
@@ -1273,6 +1275,47 @@ public void onError(String nodeId, Map<String, Object> state, Throwable ex, Runn
 		assertEquals(sourceException, listenerException.get().getCause());
 	}
 
+	@Test
+	public void testGraphFluxErrorUsesChildNodeIdForLifecycleListener() throws Exception {
+		RuntimeException sourceException = new RuntimeException("GraphFlux child failure");
+		AtomicReference<String> errorNodeId = new AtomicReference<>();
+		StateGraph workflow = new StateGraph(createKeyStrategyFactory()).addEdge(START, "parent")
+				.addNode("parent", node_async(state -> Map.of("stream",
+						GraphFlux.of("child", Flux.error(sourceException)))))
+				.addEdge("parent", END);
+
+		CompiledGraph app = workflow.compile(CompileConfig.builder().withLifecycleListener(new GraphLifecycleListener() {
+			@Override
+			public void onError(String nodeId, Map<String, Object> state, Throwable ex, RunnableConfig config) {
+				errorNodeId.set(nodeId);
+			}
+		}).build());
+
+		assertThrows(RuntimeException.class, () -> app.stream(Map.of()).blockLast());
+		assertEquals("child", errorNodeId.get());
+	}
+
+	@Test
+	public void testParallelGraphFluxErrorUsesFailingChildNodeIdForLifecycleListener() throws Exception {
+		RuntimeException sourceException = new RuntimeException("ParallelGraphFlux child failure");
+		AtomicReference<String> errorNodeId = new AtomicReference<>();
+		StateGraph workflow = new StateGraph(createKeyStrategyFactory()).addEdge(START, "parent")
+				.addNode("parent", node_async(state -> Map.of("stream", ParallelGraphFlux.of(List.of(
+						GraphFlux.of("child_success", Flux.just("ok")),
+						GraphFlux.of("child_failure", Flux.error(sourceException)))))))
+				.addEdge("parent", END);
+
+		CompiledGraph app = workflow.compile(CompileConfig.builder().withLifecycleListener(new GraphLifecycleListener() {
+			@Override
+			public void onError(String nodeId, Map<String, Object> state, Throwable ex, RunnableConfig config) {
+				errorNodeId.set(nodeId);
+			}
+		}).build());
+
+		assertThrows(RuntimeException.class, () -> app.stream(Map.of()).blockLast());
+		assertEquals("child_failure", errorNodeId.get());
+	}
+
 	@Test
 	public void testStreamingNodeWithNodeException() throws Exception {
 		AtomicInteger errorCount = new AtomicInteger();
```

---

### Incident Patch 2: `cc137635` (2026-08-24)
**Commit Message**: docs: fix GitHub capitalization in CONTRIBUTING and GOVERNANCE (#4912)

Co-authored-by: shown <[REDACTED_EMAIL]>

**File**: `CONTRIBUTING-zh.md` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ Spring AI Alibaba 从开源建设以来，受到了很多社区同学的关注
 - 点击 [本项目](https://github.com/alibaba/spring-ai-alibaba) 右上角的 `Fork` 图标 将 alibaba/spring-ai-alibaba  fork 到自己的空间。
 - 将自己账号下的 spring-ai-alibaba 仓库 clone 到本地，例如我的账号是 `chickenlj`，那就是执行 `git clone https://github.com/chickenlj/spring-ai-alibaba.git` 进行 clone 操作。
 
-### 配置 Github 信息
+### 配置 GitHub 信息
 
 - 在自己的机器执行 `git config --list` ，查看 git 的全局用户名和邮箱。
 - 检查显示的 user.name 和 user.email 是不是与自己 github 的用户名和邮箱相匹配。
```

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ If you are a first-time contributor, you can claim a relatively simple task from
 - Click the `Fork` icon in the upper right corner of [this project](https://github.com/alibaba/spring-ai-alibaba) to fork alibaba/spring-ai-alibaba to your own space.
 - Clone the spring-ai-alibaba repository from your account to your local machine. For example, if my account is `chickenlj`, I would execute `git clone https://github.com/chickenlj/spring-ai-alibaba.git` to clone it.
 
-### Configure Github Information
+### Configure GitHub Information
 
 - Execute `git config --list` on your machine to check git's global username and email.
 - Verify that the displayed user.name and user.email match your github username and email.
```

**File**: `GOVERNANCE.md` (modified, +2/-2)
```diff
@@ -6,9 +6,9 @@ Below is the organizational structure of the Spring AI Alibaba project.
 
 Committers have full write permissions to the entire project codebase, like permissions to operate branches, issues, pull requests, etc. PMC Members have the same codebase permissions as Committers, and are responsible for the community management, decision-making, etc., and are responsible for voting and making decisions on important matters such as releases, vulnerabilities, committer and PMC Member nominations, etc.
 
-The Spring AI Alibaba project belongs to the Alibaba Github organization, so it can leverage all the resources and help from the Alibaba open source organization in some key matters such as security vulnerability reporting and copyright protection.
+The Spring AI Alibaba project belongs to the Alibaba GitHub organization, so it can leverage all the resources and help from the Alibaba open source organization in some key matters such as security vulnerability reporting and copyright protection.
 
-As the only commission of the Alibaba Github organization for this project, PMC is responsible for managing and monitoring the Spring AI Alibaba open source project and ensuring that all development activities comply with the Alibaba organization's open source specifications.
+As the only commission of the Alibaba GitHub organization for this project, PMC is responsible for managing and monitoring the Spring AI Alibaba open source project and ensuring that all development activities comply with the Alibaba organization's open source specifications.
 
 ## Project Management Committee (PMC)
 
```

---

### Incident Patch 3: `44592ade` (2026-08-24)
**Commit Message**: fix(graph): notify lifecycle listener on streaming errors (#4911)

Co-authored-by: shown <[REDACTED_EMAIL]>

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/executor/NodeExecutor.java` (modified, +1/-0)
```diff
@@ -322,6 +322,7 @@ else if (element instanceof GraphResponse) {
 				// Handle actual error signals from the Flux
 				log.error("Error signal occurred in embedded Flux stream for key '{}': {}",
 					key, error.getMessage());
+				context.doListeners(ERROR, new Exception(error));
 				GraphResponse<NodeOutput> errorResponse = GraphResponse.error(error);
 				lastGraphResponseRef.set(errorResponse);
 				return Flux.just(errorResponse);
```

**File**: `spring-ai-alibaba-graph-core/src/test/java/com/alibaba/cloud/ai/graph/StateGraphTest.java` (modified, +32/-10)
```diff
@@ -46,6 +46,8 @@
 import java.util.concurrent.Executors;
 import java.util.concurrent.ForkJoinPool;
 import java.util.concurrent.LinkedBlockingQueue;
+import java.util.concurrent.atomic.AtomicInteger;
+import java.util.concurrent.atomic.AtomicReference;
 import java.util.stream.Collectors;
 
 import com.fasterxml.jackson.databind.ObjectMapper;
@@ -1229,23 +1231,31 @@ public void testParallelInterrupt() throws GraphStateException {
 
 	@Test
 	public void testStreamingNodeWithFluxException() throws Exception {
+		RuntimeException sourceException = new RuntimeException("Exception in streaming flux");
+		AtomicInteger errorCount = new AtomicInteger();
+		AtomicReference<String> errorNodeId = new AtomicReference<>();
+		AtomicReference<Throwable> listenerException = new AtomicReference<>();
 		StateGraph workflow = new StateGraph(createKeyStrategyFactory()).addEdge(START, "agent_1")
 				.addNode("agent_1", node_async(state -> {
 					log.info("agent_1\n{}", state);
-					return Map.of("pro1", Flux.just("response1", "response2", "response3")
-							.map(value -> {
-								if (value.equals("response3")) {
-									throw new RuntimeException("Exception in map operation");
-								}
-								return value;
-							}));
+					return Map.of("pro1", Flux.concat(Flux.just("response1", "response2"), Flux.error(sourceException)));
 				}))
 				.addEdge("agent_1", END);
 
-		CompiledGraph app = workflow.compile();
+		CompiledGraph app = workflow.compile(CompileConfig.builder().withLifecycleListener(new GraphLifecycleListener() {
+			@Override
+			public void onError(String nodeId, Map<String, Object> state, Throwable ex, RunnableConfig config) {
+				errorCount.incrementAndGet();
+				errorNodeId.set(nodeId);
+				listenerException.set(ex);
+			}
+		}).build());
 
 		assertThrows(RuntimeException.class,
 				() -> app.invoke(Map.of(OverAllState.DEFAULT_INPUT_KEY, "test1")));
+		errorCount.set(0);
+		errorNodeId.set(null);
+		listenerException.set(null);
 
 		Flux<NodeOutput> flux = app.stream(Map.of(OverAllState.DEFAULT_INPUT_KEY, "test1"));
 
@@ -1256,26 +1266,38 @@ public void testStreamingNodeWithFluxException() throws Exception {
 		assertEquals(2, firstTwoElements.size());
 
 		// 验证第三个元素会抛出异常
-		assertThrows(RuntimeException.class, () -> flux.blockLast());
+		RuntimeException exception = assertThrows(RuntimeException.class, () -> flux.blockLast());
+		assertEquals(sourceException.getMessage(), exception.getMessage());
+		assertEquals(1, errorCount.get());
+		assertEquals("agent_1", errorNodeId.get());
+		assertEquals(sourceException, listenerException.get().getCause());
 	}
 
 	@Test
 	public void testStreamingNodeWithNodeException() throws Exception {
+		AtomicInteger errorCount = new AtomicInteger();
 		StateGraph workflow = new StateGraph(createKeyStrategyFactory()).addEdge(START, "agent_1")
 				.addNode("agent_1", node_async(state -> {
 					throw new RuntimeException("forced exception for testing");
 				}))
 				.addEdge("agent_1", END);
 
-		CompiledGraph app = workflow.compile();
+		CompiledGraph app = workflow.compile(CompileConfig.builder().withLifecycleListener(new GraphLifecycleListener() {
+			@Override
+			public void onError(String nodeId, Map<String, Object> state, Throwable ex, RunnableConfig config) {
+				errorCount.incrementAndGet();
+			}
+		}).build());
 
 		// 验证 invoke 会抛出异常
 		assertThrows(RuntimeException.class,
 				() -> app.invoke(Map.of(OverAllState.DEFAULT_INPUT_KEY, "test1")));
+		assertEquals(1, errorCount.get());
 
 		// 验证 stream 也会抛出异常
 		Flux<NodeOutput> flux = app.stream(Map.of(OverAllState.DEFAULT_INPUT_KEY, "test1"));
 		assertThrows(RuntimeException.class, () -> flux.blockLast());
+		assertEquals(2, errorCount.get());
 	}
 
 	/**
```

---

### Incident Patch 4: `e9760b61` (2026-08-24)
**Commit Message**: docs: fix broken Code of Conduct link in GOVERNANCE.md (#4909)

Co-authored-by: shown <[REDACTED_EMAIL]>

**File**: `GOVERNANCE.md` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ The Spring AI Alibaba project management committee (PMC), is the only governance
    all Spring AI Alibaba project resources and has the final say in the disposition of
    those resources.
 5. Define and evolve the scope of the community.
-6. Receive and handle reports about [code of conduct](./CODE-OF-CONDUCT.md)
+6. Receive and handle reports about [code of conduct](./CODE_OF_CONDUCT.md)
    violations and maintain confidentiality.
 7. Approval of logo changes, significant website updates and marketing campaigns.
 8. Establish processes regarding project resources/assets, including artifact repositories, build and test infrastructure, web sites and their domains, blogs, social-media accounts, etc.
```

---

### Incident Patch 5: `4dc37885` (2026-08-24)
**Commit Message**: fix(graph): cap ParallelNode core pool size on high-core hosts (#4895)

Co-authored-by: shown <[REDACTED_EMAIL]>

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/internal/node/ParallelNode.java` (modified, +6/-2)
```diff
@@ -61,6 +61,10 @@ public class ParallelNode extends Node {
 
 	public static final String MAX_CONCURRENCY_KEY = "__MAX_CONCURRENCY__";
 
+	private static final int MIN_DEFAULT_POOL_SIZE = 4;
+
+	private static final int MAX_DEFAULT_POOL_SIZE = 200;
+
 	static {
 		Runtime.getRuntime().addShutdownHook(new Thread(() -> {
 			shutdownDefaultExecutor();
@@ -181,7 +185,7 @@ private static int calculateCorePoolSize() {
 		// For mixed workloads, 2x CPU cores is typically optimal
 		int corePoolSize = cpuCores * 2;
 		// Ensure minimum of 4 threads for reasonable parallelism on small systems
-		int finalCorePoolSize = Math.max(corePoolSize, 4);
+		int finalCorePoolSize = Math.min(Math.max(corePoolSize, MIN_DEFAULT_POOL_SIZE), MAX_DEFAULT_POOL_SIZE);
 		logger.info("Calculated core pool size: {} (CPU cores: {})", finalCorePoolSize, cpuCores);
 		return finalCorePoolSize;
 	}
@@ -196,7 +200,7 @@ private static int calculateMaximumPoolSize() {
 		int cpuCores = Runtime.getRuntime().availableProcessors();
 		// Allow for handling burst workloads with 4x CPU cores
 		// Cap at reasonable maximum to prevent resource exhaustion
-		int maxPoolSize = Math.min(cpuCores * 4, 200);
+		int maxPoolSize = Math.min(cpuCores * 4, MAX_DEFAULT_POOL_SIZE);
 		logger.info("Calculated maximum pool size: {} (CPU cores: {})", maxPoolSize, cpuCores);
 		return maxPoolSize;
 	}
```

**File**: `spring-ai-alibaba-graph-core/src/test/java/com/alibaba/cloud/ai/graph/internal/node/ParallelNodeTest.java` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+/*
+ * Copyright 2024-2026 the original author or authors.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *      https://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+package com.alibaba.cloud.ai.graph.internal.node;
+
+import org.junit.jupiter.api.Test;
+
+import java.nio.charset.StandardCharsets;
+import java.util.concurrent.TimeUnit;
+
+import static org.junit.jupiter.api.Assertions.assertEquals;
+import static org.junit.jupiter.api.Assertions.assertTrue;
+
+class ParallelNodeTest {
+
+	@Test
+	void initializesWithMoreThanOneHundredProcessors() throws Exception {
+		String javaCommand = ProcessHandle.current().info().command().orElseThrow();
+		String classPath = System.getProperty("surefire.test.class.path", System.getProperty("java.class.path"));
+		Process process = new ProcessBuilder(javaCommand, "-XX:ActiveProcessorCount=128", "-cp",
+				classPath, ParallelNodeLoader.class.getName()).redirectErrorStream(true)
+				.start();
+
+		boolean exited = process.waitFor(30, TimeUnit.SECONDS);
+		if (!exited) {
+			process.destroyForcibly();
+		}
+		assertTrue(exited, "child JVM did not exit in time");
+		String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
+		assertEquals(0, process.exitValue(), output);
+	}
+
+	static class ParallelNodeLoader {
+
+		public static void main(String[] args) throws ClassNotFoundException {
+			Class.forName(ParallelNode.class.getName());
+		}
+
+	}
+
+}
```

**File**: `spring-ai-alibaba-graph-core/src/test/java/com/alibaba/cloud/ai/graph/plain_text/SpringAIJacksonStateSerializerTest.java` (modified, +6/-1)
```diff
@@ -67,6 +67,7 @@
 
 import static org.junit.jupiter.api.Assertions.assertEquals;
 import static org.junit.jupiter.api.Assertions.assertArrayEquals;
+import static org.junit.jupiter.api.Assertions.assertInstanceOf;
 import static org.junit.jupiter.api.Assertions.assertNotNull;
 import static org.junit.jupiter.api.Assertions.assertNull;
 import static org.junit.jupiter.api.Assertions.assertTrue;
@@ -480,7 +481,11 @@ void shouldPreserveJacksonByteArraySerialization() throws Exception {
 
 		AssistantMessage deserialized = serializeAndDeserialize(message);
 
-		assertEquals(List.of("[B", "AQID"), deserialized.getMetadata().get("payload"));
+		// Primitive-array metadata must retain its binary type. The previous
+		// List["[B", "AQID"] assertion described the serialization defect fixed by #4860.
+		Object payload = deserialized.getMetadata().get("payload");
+		assertInstanceOf(byte[].class, payload);
+		assertArrayEquals(new byte[] { 1, 2, 3 }, (byte[]) payload);
 	}
 
 	@Test
```

---

### Incident Patch 6: `94efa888` (2026-08-24)
**Commit Message**: fix(admin): preserve workflow tool callbacks (#4903)

**File**: `spring-ai-alibaba-admin/spring-ai-alibaba-admin-server-core/src/main/java/com/alibaba/cloud/ai/studio/core/agent/BasicAgentExecutor.java` (modified, +0/-1)
```diff
@@ -295,7 +295,6 @@ private ChatClient.Builder buildChatClient(AgentContext context, ToolCallingChat
 		// Add tool callbacks
 		ToolCallback[] toolCallbacks = toolCallbackProvider.getToolCallbacks();
 		if (!ArrayUtils.isEmpty(toolCallbacks)) {
-			chatOptions = chatOptions.copy();
 			chatOptions.setToolCallbacks(Arrays.stream(toolCallbacks).toList());
 		}
 
```

**File**: `spring-ai-alibaba-admin/spring-ai-alibaba-admin-server-core/src/test/java/com/alibaba/cloud/ai/studio/core/agent/BasicAgentExecutorTest.java` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+/*
+ * Copyright 2026 the original author or authors.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *      https://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+package com.alibaba.cloud.ai.studio.core.agent;
+
+import com.alibaba.cloud.ai.studio.core.base.manager.AppComponentManager;
+import com.alibaba.cloud.ai.studio.core.base.manager.DocumentRetrieverManager;
+import com.alibaba.cloud.ai.studio.core.base.manager.FileManager;
+import com.alibaba.cloud.ai.studio.core.base.service.McpServerService;
+import com.alibaba.cloud.ai.studio.core.base.service.PluginService;
+import com.alibaba.cloud.ai.studio.core.base.service.ToolExecutionService;
+import com.alibaba.cloud.ai.studio.core.config.CommonConfig;
+import com.alibaba.cloud.ai.studio.core.model.llm.ModelFactory;
+import com.alibaba.cloud.ai.studio.runtime.domain.agent.AgentRequest;
+import com.alibaba.cloud.ai.studio.runtime.domain.app.AgentConfig;
+
+import org.junit.jupiter.api.Test;
+import org.springframework.ai.chat.memory.ChatMemory;
+import org.springframework.ai.chat.model.ChatModel;
+import org.springframework.ai.model.tool.ToolCallingChatOptions;
+import org.springframework.ai.openai.OpenAiChatOptions;
+import org.springframework.ai.tool.ToolCallback;
+import org.springframework.ai.tool.ToolCallbackProvider;
+
+import java.lang.reflect.Method;
+
+import static org.assertj.core.api.Assertions.assertThat;
+import static org.mockito.Mockito.mock;
+import static org.mockito.Mockito.when;
+
+class BasicAgentExecutorTest {
+
+	@Test
+	void buildChatClientAddsCallbacksToPromptOptions() throws Exception {
+		ModelFactory modelFactory = mock(ModelFactory.class);
+		when(modelFactory.getChatModel("dashscope")).thenReturn(mock(ChatModel.class));
+
+		BasicAgentExecutor executor = new BasicAgentExecutor(
+				mock(ToolExecutionService.class), mock(PluginService.class), mock(McpServerService.class),
+				mock(AppComponentManager.class), mock(DocumentRetrieverManager.class), mock(ChatMemory.class),
+				mock(CommonConfig.class), modelFactory, mock(FileManager.class));
+
+		AgentConfig config = new AgentConfig();
+		config.setModelProvider("dashscope");
+		AgentContext context = new AgentContext();
+		context.setConfig(config);
+		context.setRequest(new AgentRequest());
+		ToolCallback toolCallback = mock(ToolCallback.class);
+		ToolCallbackProvider toolCallbackProvider = () -> new ToolCallback[] { toolCallback };
+		ToolCallingChatOptions chatOptions = OpenAiChatOptions.builder().build();
+
+		Method buildChatClient = BasicAgentExecutor.class.getDeclaredMethod("buildChatClient", AgentContext.class,
+				ToolCallingChatOptions.class, ToolCallbackProvider.class);
+		buildChatClient.setAccessible(true);
+		buildChatClient.invoke(executor, context, chatOptions, toolCallbackProvider);
+
+		assertThat(chatOptions.getToolCallbacks()).containsExactly(toolCallback);
+	}
+
+}
```

---

### Incident Patch 7: `c65a3eb5` (2026-08-15)
**Commit Message**: fix(agent): use configured fallback after routing retries fail (#4899)

Co-authored-by: shown <[REDACTED_EMAIL]>

**File**: `spring-ai-alibaba-agent-framework/src/main/java/com/alibaba/cloud/ai/graph/agent/flow/node/RoutingNode.java` (modified, +35/-2)
```diff
@@ -103,7 +103,19 @@ public MultiCommand apply(OverAllState state, RunnableConfig config) throws Exce
 		// Prepare messages with instruction if available
 		List<Message> messagesWithInstruction = prepareMessagesWithInstruction(messages);
 		
-		RoutingDecision decision = getDecisionWithRetry(messagesWithInstruction, DEFAULT_MAX_RETRIES);
+		RoutingDecision decision;
+		try {
+			decision = getDecisionWithRetry(messagesWithInstruction, DEFAULT_MAX_RETRIES);
+		}
+		catch (Exception e) {
+			MultiCommand fallbackCommand = createFallbackCommand(state, messages);
+			if (fallbackCommand != null) {
+				logger.warn("RoutingAgent {} exhausted routing retries. Routing to fallback agent {}.",
+						rootAgent.name(), fallbackCommand.gotoNodes().get(0));
+				return fallbackCommand;
+			}
+			throw e;
+		}
 		List<String> decisionValues = decision.getAgentNames();
 
 		// Validate all agent names are valid
@@ -134,6 +146,28 @@ public MultiCommand apply(OverAllState state, RunnableConfig config) throws Exce
 		}
 	}
 
+	private MultiCommand createFallbackCommand(OverAllState state, List<Message> messages) {
+		if (!(rootAgent instanceof LlmRoutingAgent llmRoutingAgent)) {
+			return null;
+		}
+
+		String fallbackAgent = llmRoutingAgent.getFallbackAgent();
+		if (!StringUtils.hasText(fallbackAgent)
+				|| subAgents.stream().noneMatch(agent -> agent.name().equals(fallbackAgent))) {
+			return null;
+		}
+
+		String fallbackInput = state.value("input").map(Object::toString).orElseGet(() -> {
+			for (int i = messages.size() - 1; i >= 0; i--) {
+				if (messages.get(i) instanceof UserMessage userMessage) {
+					return userMessage.getText();
+				}
+			}
+			return "";
+		});
+		return new MultiCommand(List.of(fallbackAgent), Map.of(fallbackAgent + "_input", fallbackInput));
+	}
+
 	/**
 	 * Prepares messages with instruction. If rootAgent has instruction, adds it as UserMessage.
 	 * Otherwise, adds a default instruction message.
@@ -296,4 +330,3 @@ public Map<String, String> getAgentQueries() {
 	public record AgentRouting(String agent, String query) {
 	}
 }
-
```

**File**: `spring-ai-alibaba-agent-framework/src/test/java/com/alibaba/cloud/ai/graph/agent/flow/node/RoutingNodeTest.java` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+/*
+ * Copyright 2024-2026 the original author or authors.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *      https://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+package com.alibaba.cloud.ai.graph.agent.flow.node;
+
+import com.alibaba.cloud.ai.graph.OverAllState;
+import com.alibaba.cloud.ai.graph.RunnableConfig;
+import com.alibaba.cloud.ai.graph.action.MultiCommand;
+import com.alibaba.cloud.ai.graph.agent.Agent;
+import com.alibaba.cloud.ai.graph.agent.flow.agent.LlmRoutingAgent;
+
+import org.junit.jupiter.api.Test;
+import org.springframework.ai.chat.messages.AssistantMessage;
+import org.springframework.ai.chat.messages.Message;
+import org.springframework.ai.chat.messages.UserMessage;
+import org.springframework.ai.chat.model.ChatModel;
+import org.springframework.ai.chat.model.ChatResponse;
+import org.springframework.ai.chat.model.Generation;
+import org.springframework.ai.chat.prompt.Prompt;
+import reactor.core.publisher.Flux;
+
+import java.util.List;
+import java.util.Map;
+import java.util.concurrent.atomic.AtomicInteger;
+
+import static org.junit.jupiter.api.Assertions.assertEquals;
+import static org.junit.jupiter.api.Assertions.assertThrows;
+import static org.mockito.Mockito.mock;
+import static org.mockito.Mockito.when;
+
+class RoutingNodeTest {
+
+	@Test
+	void routesToConfiguredFallbackAfterInvalidDecisions() throws Exception {
+		AtomicInteger modelCalls = new AtomicInteger();
+		ChatModel chatModel = invalidRoutingModel(modelCalls);
+		Agent writerAgent = mockAgent();
+		LlmRoutingAgent routingAgent = routingAgent(chatModel, writerAgent, "writer_agent");
+		RoutingNode node = new RoutingNode(chatModel, routingAgent, List.of(writerAgent));
+		OverAllState state = new OverAllState(Map.of(
+				"input", "write a summary",
+				"messages", List.<Message>of(new UserMessage("write a summary"))));
+
+		MultiCommand command = node.apply(state, RunnableConfig.builder().build());
+
+		assertEquals(3, modelCalls.get());
+		assertEquals(List.of("writer_agent"), command.gotoNodes());
+		assertEquals("write a summary", command.update().get("writer_agent_input"));
+	}
+
+	@Test
+	void throwsAfterInvalidDecisionsWhenFallbackIsNotConfigured() {
+		ChatModel chatModel = invalidRoutingModel(new AtomicInteger());
+		Agent writerAgent = mockAgent();
+		LlmRoutingAgent routingAgent = routingAgent(chatModel, writerAgent, null);
+		RoutingNode node = new RoutingNode(chatModel, routingAgent, List.of(writerAgent));
+		OverAllState state = new OverAllState(Map.of(
+				"messages", List.<Message>of(new UserMessage("write a summary"))));
+
+		assertThrows(IllegalStateException.class,
+				() -> node.apply(state, RunnableConfig.builder().build()));
+	}
+
+	private static ChatModel invalidRoutingModel(AtomicInteger modelCalls) {
+		return new ChatModel() {
+			@Override
+			public ChatResponse call(Prompt prompt) {
+				modelCalls.incrementAndGet();
+				return new ChatResponse(List.of(new Generation(new AssistantMessage(
+						"{\"agents\":[{\"agent\":\"unknown_agent\",\"query\":\"ignored\"}]}"))));
+			}
+
+			@Override
+			public Flux<ChatResponse> stream(Prompt prompt) {
+				return Flux.just(call(prompt));
+			}
+		};
+	}
+
+	private static Agent mockAgent() {
+		Agent writerAgent = mock(Agent.class);
+		when(writerAgent.name()).thenReturn("writer_agent");
+		when(writerAgent.description()).thenReturn("Writes text");
+		return writerAgent;
+	}
+
+	private static LlmRoutingAgent routingAgent(ChatModel chatModel, Agent writerAgent, String fallbackAgent) {
+		LlmRoutingAgent.LlmRoutingAgentBuilder builder = LlmRoutingAgent.builder()
+				.name("router")
+				.description("Routes requests")
+				.model(chatModel)
+				.subAgents(List.of(writerAgent));
+		if (fallbackAgent != null) {
+			builder.fallbackAgent(fallbackAgent);
+		}
+		return builder.build();
+	}
+
+}
```

---

### Incident Patch 8: `7601a9fb` (2026-08-15)
**Commit Message**: fix(agent): validate WebFetchTool prompt before cache lookup and fetch (#4897)

Co-authored-by: shown <[REDACTED_EMAIL]>

**File**: `spring-ai-alibaba-agent-framework/src/main/java/com/alibaba/cloud/ai/graph/agent/tools/WebFetchTool.java` (modified, +4/-0)
```diff
@@ -173,6 +173,10 @@ public String apply(Request request, ToolContext toolContext) {
 			return "Error: Invalid URL format: " + e.getMessage();
 		}
 
+		if (!StringUtils.hasText(prompt)) {
+			return "Error: Prompt cannot be empty or null";
+		}
+
 		// Upgrade HTTP to HTTPS if needed
 		if (url.startsWith("http://")) {
 			url = "https://" + url.substring(7);
```

**File**: `spring-ai-alibaba-agent-framework/src/test/java/com/alibaba/cloud/ai/graph/agent/tools/WebFetchToolTest.java` (modified, +50/-0)
```diff
@@ -29,7 +29,9 @@
 import org.springframework.ai.chat.model.Generation;
 import org.springframework.ai.chat.model.ToolContext;
 import org.springframework.ai.chat.prompt.Prompt;
+import org.springframework.ai.tool.ToolCallback;
 
+import static org.junit.jupiter.api.Assertions.assertEquals;
 import static org.junit.jupiter.api.Assertions.assertNotNull;
 import static org.junit.jupiter.api.Assertions.assertTrue;
 import static org.mockito.ArgumentMatchers.any;
@@ -85,6 +87,54 @@ void testInvalidUrlMissingSchemeReturnsError() {
 		assertTrue(result.contains("Invalid URL"));
 	}
 
+	@Test
+	void testNullPromptReturnsError() {
+		String result = webFetchTool.apply(new WebFetchTool.Request("https://localhost:1", null),
+				new ToolContext(Collections.emptyMap()));
+		assertTrue(result.startsWith("Error:"));
+		assertTrue(result.contains("Prompt cannot be empty or null"));
+	}
+
+	@Test
+	void testEmptyPromptReturnsError() {
+		String result = webFetchTool.apply(new WebFetchTool.Request("https://localhost:1", ""),
+				new ToolContext(Collections.emptyMap()));
+		assertTrue(result.startsWith("Error:"));
+		assertTrue(result.contains("Prompt cannot be empty or null"));
+	}
+
+	@Test
+	void testBlankPromptReturnsError() {
+		String result = webFetchTool.apply(new WebFetchTool.Request("https://localhost:1", "   "),
+				new ToolContext(Collections.emptyMap()));
+		assertTrue(result.startsWith("Error:"));
+		assertTrue(result.contains("Prompt cannot be empty or null"));
+	}
+
+	@Test
+	void testToolCallbackReturnsErrorForNullPrompt() {
+		ToolCallback toolCallback = WebFetchTool.builder(ChatClient.builder(mock(ChatModel.class)).build()).build();
+		String result = toolCallback.call("{\"url\":\"https://localhost:1\",\"prompt\":null}",
+				new ToolContext(Collections.emptyMap()));
+		assertTrue(result.contains("Error: Prompt cannot be empty or null"));
+	}
+
+	@Test
+	@SuppressWarnings("unchecked")
+	void testValidPromptUsesCache() throws Exception {
+		String url = "https://example.com";
+		String prompt = "Summarize";
+		String expected = "Cached summary";
+		Field cacheField = WebFetchTool.class.getDeclaredField("urlCache");
+		cacheField.setAccessible(true);
+		Cache<String, String> cache = (Cache<String, String>) cacheField.get(webFetchTool);
+		cache.put(url + "::prompt::" + prompt.hashCode(), expected);
+
+		String result = webFetchTool.apply(new WebFetchTool.Request(url, prompt),
+				new ToolContext(Collections.emptyMap()));
+		assertEquals(expected, result);
+	}
+
 	@Test
 	@SuppressWarnings("unchecked")
 	void testCacheRespectsMaxCacheSize() throws Exception {
```

---

### Incident Patch 9: `ab14413c` (2026-08-15)
**Commit Message**: fix(graph): serialize map-shaped DashScope search metadata (#4846)

Co-authored-by: shown <[REDACTED_EMAIL]>

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/serializer/plain_text/jackson/AgentInstructionMessageHandler.java` (modified, +1/-1)
```diff
@@ -72,7 +72,7 @@ public void serializeWithType(AgentInstructionMessage msg, JsonGenerator gen, Se
 		private void serializeFields(AgentInstructionMessage msg, JsonGenerator gen, SerializerProvider provider) throws IOException {
 			gen.writeStringField(Field.TEXT.name, msg.getText());
 			gen.writeBooleanField(Field.RENDERED.name, msg.isRendered());
-			serializeMetadata(gen, msg.getMetadata());
+			serializeMetadata(gen, provider, msg.getMetadata());
 		}
 	}
 
```

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/serializer/plain_text/jackson/AssistantMessageHandler.java` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ private void serializeFields(AssistantMessage msg, JsonGenerator gen, Serializer
 		}
 		gen.writeEndArray();
 
-		serializeMetadata(gen, msg.getMetadata());
+		serializeMetadata(gen, provider, msg.getMetadata());
 
 		// gen.writeArrayFieldStart( Property.MEDIA.field);
 		// for (var media : msg.getMedia()) {
```

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/serializer/plain_text/jackson/DeepSeekAssistantMessageHandler.java` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ private void serializeFields(DeepSeekAssistantMessage msg, JsonGenerator gen, Se
 			}
 
 			java.util.Map<String, Object> metadata = msg.getMetadata();
-			serializeMetadata(gen, metadata);
+			serializeMetadata(gen, provider, metadata);
 		}
 
 	}
```

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/serializer/plain_text/jackson/DocumentHandler.java` (modified, +1/-1)
```diff
@@ -82,7 +82,7 @@ private void serializeFields(Document document, JsonGenerator gen, SerializerPro
 			if (document.getScore() != null) {
 				gen.writeNumberField(Field.SCORE.name, document.getScore());
 			}
-			serializeMetadata(gen, document.getMetadata());
+			serializeMetadata(gen, provider, document.getMetadata());
 		}
 	}
 
```

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/serializer/plain_text/jackson/SerializationHelper.java` (modified, +436/-2)
```diff
@@ -16,13 +16,44 @@
 package com.alibaba.cloud.ai.graph.serializer.plain_text.jackson;
 
 import java.io.IOException;
+import java.lang.annotation.Annotation;
+import java.lang.reflect.Array;
+import java.util.ArrayList;
+import java.util.Collection;
+import java.util.LinkedHashMap;
+import java.util.List;
 import java.util.Map;
+import java.util.Objects;
 
+import com.fasterxml.jackson.annotation.JsonInclude;
+import com.fasterxml.jackson.annotation.JsonIgnore;
+import com.fasterxml.jackson.annotation.JsonFormat;
+import com.fasterxml.jackson.annotation.JsonProperty;
 import com.fasterxml.jackson.core.JsonGenerator;
+import com.fasterxml.jackson.core.JsonParser;
 import com.fasterxml.jackson.core.JsonProcessingException;
+import com.fasterxml.jackson.core.ObjectCodec;
 import com.fasterxml.jackson.core.type.TypeReference;
 import com.fasterxml.jackson.databind.JsonNode;
+import com.fasterxml.jackson.databind.JavaType;
+import com.fasterxml.jackson.databind.MapperFeature;
 import com.fasterxml.jackson.databind.ObjectMapper;
+import com.fasterxml.jackson.databind.SerializerProvider;
+import com.fasterxml.jackson.databind.introspect.AnnotatedMember;
+import com.fasterxml.jackson.databind.introspect.BeanPropertyDefinition;
+import com.fasterxml.jackson.databind.ser.PropertyWriter;
+import com.fasterxml.jackson.databind.ser.BeanPropertyWriter;
+import com.fasterxml.jackson.databind.ser.impl.IndexedListSerializer;
+import com.fasterxml.jackson.databind.ser.impl.IndexedStringListSerializer;
+import com.fasterxml.jackson.databind.ser.impl.StringArraySerializer;
+import com.fasterxml.jackson.databind.ser.impl.StringCollectionSerializer;
+import com.fasterxml.jackson.databind.ser.std.AsArraySerializerBase;
+import com.fasterxml.jackson.databind.ser.std.BeanSerializerBase;
+import com.fasterxml.jackson.databind.ser.std.CollectionSerializer;
+import com.fasterxml.jackson.databind.ser.std.MapSerializer;
+import com.fasterxml.jackson.databind.ser.std.ObjectArraySerializer;
+import com.fasterxml.jackson.databind.util.BeanUtil;
+import com.fasterxml.jackson.databind.util.TokenBuffer;
 
 class SerializationHelper {
 
@@ -46,8 +77,411 @@ static Map<String, Object> deserializeMetadata(ObjectMapper mapper, JsonNode par
 		});
 	}
 
-	static void serializeMetadata(JsonGenerator gen, Map<String, Object> metadata) throws IOException {
-		gen.writeObjectField(METADATA_FIELD, metadata);
+	static void serializeMetadata(JsonGenerator gen, SerializerProvider provider, Map<String, Object> metadata)
+			throws IOException {
+		gen.writeObjectField(METADATA_FIELD, normalizeMetadataValue(provider, metadata));
+	}
+
+	private static Object normalizeMetadataValue(SerializerProvider provider, Object value) throws IOException {
+		return normalizeMetadataValue(provider, value, JsonInclude.Include.ALWAYS);
+	}
+
+	private static Object normalizeMetadataValue(SerializerProvider provider, Object value,
+			JsonInclude.Include contentInclusion) throws IOException {
+		if (value instanceof Map<?, ?> map) {
+			boolean preserveContainer = hasClassSerializationOverrides(provider, map.getClass());
+			Object serializer = provider.findValueSerializer(map.getClass());
+			if (!isStandardMapSerializer(serializer)
+					|| preserveContainer && hasAssignedMapContentSerializer(serializer)) {
+				return map;
+			}
+			boolean incompatible = hasIncompatibleContainerValue(
+					provider.constructType(map.getClass()), map);
+			Map<Object, Object> normalized = new LinkedHashMap<>(map.size());
+			boolean changed = false;
+			for (Map.Entry<?, ?> entry : map.entrySet()) {
+				if (shouldInclude(provider, contentInclusion, entry.getValue())) {
+					Object normalizedValue = normalizeMetadataValue(provider, entry.getValue());
+					normalized.put(entry.getKey(), normalizedValue);
+					changed |= normalizedValue != entry.getValue();
+				}
+				else {
+					changed = true;
+				}
+			}
+			return preserveContainer && !incompatible
+					? preserveMapType(provider, map, normalized, changed)
+					: normalized;
+		}
+		if (value instanceof Collection<?> collection) {
+			boolean preserveContainer = hasClassSerializationOverrides(provider, collection.getClass());
+			Object serializer = provider.findValueSerializer(collection.getClass());
+			if (!isStandardCollectionSerializer(serializer)
+					|| preserveContainer && hasAssignedCollectionContentSerializer(serializer)) {
+				return collection;
+			}
+			boolean incompatible = hasIncompatibleContainerValue(
+					provider.constructType(collection.getClass()), collection);
+			List<Object> normalized = new ArrayList<>(collection.size());
+			boolean changed = false;
+			for (Object item : collection) {
+				Object normalizedItem = normalizeMetadataValue(provider, item);
+				normalized.add(normalizedItem);
+				changed |= normalizedItem != item;
+			}
+			return preserveContainer && !incompatible
+					? preserveCollectionType(provider, collection, normalized, changed)
+					: normalized;
+		}
+		if (value != nul
```

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/serializer/plain_text/jackson/SystemMessageHandler.java` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ public void serializeWithType(SystemMessage msg, JsonGenerator gen, SerializerPr
 
 		private void serializeFields(SystemMessage msg, JsonGenerator gen, SerializerProvider provider) throws IOException {
 			gen.writeStringField(Field.TEXT.name, msg.getText());
-			serializeMetadata(gen, msg.getMetadata());
+			serializeMetadata(gen, provider, msg.getMetadata());
 		}
 	}
 
```

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/serializer/plain_text/jackson/ToolResponseMessageHandler.java` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ private void serializeFields(ToolResponseMessage msg, JsonGenerator gen, Seriali
 			}
 			gen.writeEndArray();
 
-			serializeMetadata(gen, msg.getMetadata());
+			serializeMetadata(gen, provider, msg.getMetadata());
 		}
 	}
 
```

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/serializer/plain_text/jackson/UserMessageHandler.java` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ public void serializeWithType(UserMessage msg, JsonGenerator gen, SerializerProv
 
 		private void serializeFields(UserMessage msg, JsonGenerator gen, SerializerProvider provider) throws IOException {
 			gen.writeStringField(Field.TEXT.name, msg.getText());
-			serializeMetadata(gen, msg.getMetadata());
+			serializeMetadata(gen, provider, msg.getMetadata());
 
 			// gen.writeArrayFieldStart( Property.MEDIA.field);
 			// for (var media : msg.getMedia()) {
```

---

### Incident Patch 10: `9bb2d4b5` (2026-08-15)
**Commit Message**: fix(graph): make PostgresSaver latest checkpoint deterministic (#4753)

Co-authored-by: shown <[REDACTED_EMAIL]>

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/checkpoint/savers/postgresql/PostgresSaver.java` (modified, +34/-3)
```diff
@@ -64,6 +64,7 @@
  *          ON GraphThread(thread_name) WHERE is_released = FALSE
  *
  *     CREATE TABLE GraphCheckpoint (
+ *          checkpoint_seq BIGSERIAL UNIQUE,
  *          checkpoint_id UUID PRIMARY KEY,
  *          parent_checkpoint_id UUID,
  *          thread_id UUID NOT NULL,
@@ -119,6 +120,7 @@ thread_name VARCHAR(255),
 			 );
 
 			 CREATE TABLE IF NOT EXISTS GraphCheckpoint (
+			     checkpoint_seq BIGSERIAL UNIQUE,
 			     checkpoint_id UUID PRIMARY KEY,
 			     parent_checkpoint_id UUID,
 			     thread_id UUID NOT NULL,
@@ -137,10 +139,22 @@ REFERENCES GraphThread(thread_id)
 
 	private static final String CREATE_INDEXES = """
 			CREATE INDEX IF NOT EXISTS idx_lg4jcheckpoint_thread_id ON GraphCheckpoint(thread_id);
-			CREATE INDEX IF NOT EXISTS idx_lg4jcheckpoint_thread_id_saved_at_desc ON GraphCheckpoint(thread_id, saved_at DESC);
+			CREATE INDEX IF NOT EXISTS idx_lg4jcheckpoint_thread_id_sequence ON GraphCheckpoint(thread_id, checkpoint_seq DESC);
 			CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_lg4jthread_thread_name_unreleased ON GraphThread(thread_name) WHERE is_released = FALSE;
 			""";
 
+	private static final String ADD_CHECKPOINT_SEQUENCE_COLUMN = """
+			ALTER TABLE GraphCheckpoint
+			ADD COLUMN checkpoint_seq BIGSERIAL UNIQUE
+			""";
+
+	private static final String HAS_CHECKPOINT_SEQUENCE_COLUMN = """
+			SELECT 1
+			FROM information_schema.columns
+			WHERE table_name = 'graphcheckpoint'
+			  AND column_name = 'checkpoint_seq'
+			""";
+
 	// DML statements
 	private static final String UPSERT_THREAD = """
 			WITH inserted AS (
@@ -194,7 +208,7 @@ INSERT INTO GraphCheckpoint(
 			FROM GraphCheckpoint c
 			  JOIN GraphThread t ON c.thread_id = t.thread_id
 			WHERE t.thread_name = ? AND t.is_released = FALSE
-			ORDER BY c.saved_at DESC
+			ORDER BY c.checkpoint_seq DESC
 			""";
 
 	private static final String SELECT_LATEST_CHECKPOINT = """
@@ -207,7 +221,7 @@ INSERT INTO GraphCheckpoint(
 			FROM GraphCheckpoint c
 			  JOIN GraphThread t ON c.thread_id = t.thread_id
 			WHERE t.thread_name = ? AND t.is_released = FALSE
-			ORDER BY c.saved_at DESC
+			ORDER BY c.checkpoint_seq DESC
 			LIMIT 1
 			""";
 
@@ -338,6 +352,10 @@ protected void initTable(CreateOption createOption) throws SQLException {
 				sqlCommand = CREATE_TABLES;
 				statement.executeUpdate(sqlCommand);
 
+				log.trace("Ensuring checkpoint sequence column exists");
+				sqlCommand = ADD_CHECKPOINT_SEQUENCE_COLUMN;
+				ensureCheckpointSequenceColumn(connection);
+
 				log.trace("Executing create indexes:\n---\n{}---", CREATE_INDEXES);
 				sqlCommand = CREATE_INDEXES;
 				statement.executeUpdate(sqlCommand);
@@ -349,6 +367,19 @@ protected void initTable(CreateOption createOption) throws SQLException {
 		}
 	}
 
+	private void ensureCheckpointSequenceColumn(Connection connection) throws SQLException {
+		try (Statement statement = connection.createStatement();
+				ResultSet resultSet = statement.executeQuery(HAS_CHECKPOINT_SEQUENCE_COLUMN)) {
+			if (resultSet.next()) {
+				return;
+			}
+		}
+
+		try (Statement statement = connection.createStatement()) {
+			statement.execute(ADD_CHECKPOINT_SEQUENCE_COLUMN);
+		}
+	}
+
 	private Checkpoint readCheckpoint(ResultSet resultSet)
 			throws SQLException, IOException, ClassNotFoundException {
 		return Checkpoint.builder()
```

**File**: `spring-ai-alibaba-graph-core/src/test/java/com/alibaba/cloud/ai/graph/checkpoint/savers/PostgresSaverTest.java` (modified, +59/-3)
```diff
@@ -36,6 +36,7 @@
 import java.lang.reflect.InvocationTargetException;
 import java.lang.reflect.Proxy;
 import java.sql.Connection;
+import java.sql.PreparedStatement;
 import java.sql.SQLException;
 import java.sql.SQLFeatureNotSupportedException;
 import java.util.Collection;
@@ -145,11 +146,66 @@ private static RunnableConfig config(String threadId, String checkpointId) {
     }
 
     private static Checkpoint checkpoint(String value) {
-        return Checkpoint.builder()
+        return checkpoint(null, value);
+    }
+
+    private static Checkpoint checkpoint(String id, String value) {
+        Checkpoint.Builder builder = Checkpoint.builder()
                 .nodeId("agent_1")
                 .nextNodeId(END)
-                .state(Map.of("value", value))
+                .state(Map.of("value", value));
+        if (id != null) {
+            builder.id(id);
+        }
+        return builder.build();
+    }
+
+    private static void forceSameSavedAt(String threadId) throws SQLException {
+        try (Connection connection = dataSource().getConnection();
+                PreparedStatement statement = connection.prepareStatement("""
+                        UPDATE GraphCheckpoint c
+                        SET saved_at = TIMESTAMPTZ '2026-01-01 00:00:00+00'
+                        FROM GraphThread t
+                        WHERE c.thread_id = t.thread_id
+                          AND t.thread_name = ? AND t.is_released = FALSE
+                        """)) {
+            statement.setString(1, threadId);
+            assertEquals(2, statement.executeUpdate());
+        }
+    }
+
+    private static String firstCheckpointId() {
+        return "00000000-0000-0000-0000-000000000001";
+    }
+
+    private static String secondCheckpointId() {
+        return "00000000-0000-0000-0000-000000000002";
+    }
+
+    @Test
+    public void testPostgresSaverOrdersCheckpointsByInsertSequenceWhenSavedAtTies() throws Exception {
+        var saver = PostgresSaver.builder()
+                .datasource(dataSource())
+                .stateSerializer(serializer)
+                .createOption(CreateOption.CREATE_OR_REPLACE)
+                .maxCachedThreads(0)
                 .build();
+
+        String threadId = "postgres-checkpoint-sequence-thread";
+        var firstCheckpoint = checkpoint(firstCheckpointId(), "first");
+        var secondCheckpoint = checkpoint(secondCheckpointId(), "second");
+
+        saver.put(config(threadId), firstCheckpoint);
+        saver.put(config(threadId), secondCheckpoint);
+        forceSameSavedAt(threadId);
+
+        Collection<Checkpoint> history = saver.list(config(threadId));
+        assertEquals(2, history.size());
+        assertEquals(secondCheckpoint.getId(), history.iterator().next().getId());
+
+        var latest = saver.get(config(threadId));
+        assertTrue(latest.isPresent());
+        assertEquals(secondCheckpoint.getId(), latest.get().getId());
     }
 
     @Test
@@ -697,7 +753,7 @@ private void countQuery(java.lang.reflect.Method method, Object[] args) {
                     || !(args[0] instanceof String sql)) {
                 return;
             }
-            if (sql.contains("ORDER BY c.saved_at DESC") && sql.contains("LIMIT 1")) {
+            if (sql.contains("ORDER BY c.checkpoint_seq DESC") && sql.contains("LIMIT 1")) {
                 latestCheckpointSelects.incrementAndGet();
             }
             if (sql.contains("AND c.checkpoint_id = ?")) {
```

---

### Incident Patch 11: `0701f8a2` (2026-08-15)
**Commit Message**: fix(agent): Serialize persistent ShellSession command transactions (#4896)

**File**: `spring-ai-alibaba-agent-framework/src/main/java/com/alibaba/cloud/ai/graph/agent/tools/ShellSessionManager.java` (modified, +1/-1)
```diff
@@ -466,7 +466,7 @@ void stop(long timeoutMs) {
 			}
 		}
 
-		CommandResult execute(String command, long timeoutMs, int maxOutputLines, Long maxOutputBytes) {
+		synchronized CommandResult execute(String command, long timeoutMs, int maxOutputLines, Long maxOutputBytes) {
 			if (process == null || !process.isAlive()) {
 				throw new IllegalStateException("Shell session is not running");
 			}
```

**File**: `spring-ai-alibaba-agent-framework/src/test/java/com/alibaba/cloud/ai/graph/agent/tool/CancellableAsyncToolCallbackTest.java` (modified, +67/-43)
```diff
@@ -118,6 +118,7 @@ void tool_shouldCheckCancellationStatus() throws InterruptedException {
 			AtomicBoolean sawCancellation = new AtomicBoolean(false);
 			CountDownLatch toolStarted = new CountDownLatch(1);
 			CountDownLatch cancellationChecked = new CountDownLatch(1);
+			ExecutorService executor = Executors.newSingleThreadExecutor();
 
 			DefaultCancellationToken token = new DefaultCancellationToken();
 
@@ -141,29 +142,35 @@ public CompletableFuture<String> callAsync(String arguments, ToolContext context
 						cancellationChecked.countDown();
 
 						return "result";
-					});
+					}, executor);
 				}
 			};
 
-			// Start the tool
-			CompletableFuture<String> future = callback.callAsync("{}", new ToolContext(Map.of()), token);
+			try {
+				// Start the tool
+				CompletableFuture<String> future = callback.callAsync("{}", new ToolContext(Map.of()), token);
 
-			// Wait for tool to start
-			assertTrue(toolStarted.await(1, TimeUnit.SECONDS));
+				// Wait for tool to start - allow longer under CI load
+				assertTrue(toolStarted.await(5, TimeUnit.SECONDS));
 
-			// Cancel the token
-			token.cancel();
+				// Cancel the token
+				token.cancel();
 
-			// Wait for tool to check cancellation
-			assertTrue(cancellationChecked.await(1, TimeUnit.SECONDS));
+				// Wait for tool to check cancellation
+				assertTrue(cancellationChecked.await(5, TimeUnit.SECONDS));
 
-			// Tool should have seen the cancellation
-			assertTrue(sawCancellation.get());
+				// Tool should have seen the cancellation
+				assertTrue(sawCancellation.get());
+			}
+			finally {
+				executor.shutdownNow();
+			}
 		}
 
 		@Test
 		@DisplayName("tool should be able to throw on cancellation check")
 		void tool_shouldThrowOnCancellationCheck() {
+			ExecutorService executor = Executors.newSingleThreadExecutor();
 			DefaultCancellationToken token = new DefaultCancellationToken();
 			token.cancel(); // Pre-cancel
 
@@ -175,22 +182,27 @@ public CompletableFuture<String> callAsync(String arguments, ToolContext context
 						// This should throw ToolCancelledException
 						cancellationToken.throwIfCancelled();
 						return "result";
-					});
+					}, executor);
 				}
 			};
 
-			CompletableFuture<String> future = callback.callAsync("{}", new ToolContext(Map.of()), token);
-
-			// Wait for completion and check it completed exceptionally
 			try {
-				future.join();
-				// Should not reach here
-				assertTrue(false, "Expected exception to be thrown");
+				CompletableFuture<String> future = callback.callAsync("{}", new ToolContext(Map.of()), token);
+
+				// Wait for completion and check it completed exceptionally
+				try {
+					future.join();
+					// Should not reach here
+					assertTrue(false, "Expected exception to be thrown");
+				}
+				catch (Exception e) {
+					// Should complete exceptionally with ToolCancelledException wrapped in CompletionException
+					assertTrue(e instanceof java.util.concurrent.CompletionException);
+					assertTrue(e.getCause() instanceof ToolCancelledException);
+				}
 			}
-			catch (Exception e) {
-				// Should complete exceptionally with ToolCancelledException wrapped in CompletionException
-				assertTrue(e instanceof java.util.concurrent.CompletionException);
-				assertTrue(e.getCause() instanceof ToolCancelledException);
+			finally {
+				executor.shutdownNow();
 			}
 		}
 
@@ -199,6 +211,7 @@ public CompletableFuture<String> callAsync(String arguments, ToolContext context
 		void onCancelCallback_shouldBeInvoked() throws InterruptedException {
 			AtomicBoolean callbackInvoked = new AtomicBoolean(false);
 			CountDownLatch callbackLatch = new CountDownLatch(1);
+			ExecutorService executor = Executors.newSingleThreadExecutor();
 
 			DefaultCancellationToken token = new DefaultCancellationToken();
 
@@ -220,19 +233,24 @@ public CompletableFuture<String> callAsync(String arguments, ToolContext context
 							Thread.currentThread().interrupt();
 						}
 						return "result";
-					});
+					}, executor);
 				}
 			};
 
-			// Start the tool
-			callback.callAsync("{}", new ToolContext(Map.of()), token);
+			try {
+				// Start the tool
+				callback.callAsync("{}", new ToolContext(Map.of()), token);
 
-			// Cancel
-			token.cancel();
+				// Cancel
+				token.cancel();
 
-			// Callback should be invoked
-			assertTrue(callbackLatch.await(1, TimeUnit.SECONDS));
-			assertTrue(callbackInvoked.get());
+				// Callback should be invoked
+				assertTrue(callbackLatch.await(5, TimeUnit.SECONDS));
+				assertTrue(callbackInvoked.get());
+			}
+			finally {
+				executor.shutdownNow();
+			}
 		}
 
 	}
@@ -351,6 +369,7 @@ class TimeoutScenarioTests {
 		void simulatedTimeout_shouldTriggerCancellationCallback() throws InterruptedException {
 			AtomicBoolean cleanupPerformed = new AtomicBoolean(false);
 			CountDownLatch cleanupLatch = new CountDownLatch(1);
+			ExecutorService executor = Executors.newSingleThreadExecutor();
 
 			DefaultCancellationToken token = new D
```

**File**: `spring-ai-alibaba-agent-framework/src/test/java/com/alibaba/cloud/ai/graph/agent/tools/ShellSessionManagerTest.java` (modified, +50/-0)
```diff
@@ -29,6 +29,11 @@
 import java.nio.file.Files;
 import java.nio.file.Path;
 import java.util.UUID;
+import java.util.concurrent.CountDownLatch;
+import java.util.concurrent.ExecutionException;
+import java.util.concurrent.ExecutorService;
+import java.util.concurrent.Executors;
+import java.util.concurrent.Future;
 import java.util.concurrent.TimeUnit;
 
 import static org.junit.jupiter.api.Assertions.assertEquals;
@@ -115,6 +120,51 @@ void testSessionRegisteredOnInitialize() {
 				"Session should be registered in global registry with threadId");
 	}
 
+	/**
+	 * A persistent session has one stdin stream and one output queue, so concurrent
+	 * commands must not consume each other's output or completion markers.
+	 */
+	@Test
+	void testConcurrentCommandsInSameSessionRemainIsolated() throws Exception {
+		sessionManager = createSessionManager();
+		sessionManager.initialize(config);
+
+		boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
+		String firstCommand = isWindows ? "ping -n 2 127.0.0.1 > nul && echo first-only"
+				: "sleep 0.2; printf 'first-only\\n'";
+		String secondCommand = isWindows ? "ping -n 2 127.0.0.1 > nul && echo second-only"
+				: "sleep 0.2; printf 'second-only\\n'";
+
+		CountDownLatch start = new CountDownLatch(1);
+		ExecutorService executor = Executors.newFixedThreadPool(2);
+		try {
+			Future<ShellSessionManager.CommandResult> first = executor.submit(() -> {
+				start.await();
+				return sessionManager.executeCommand(firstCommand, config);
+			});
+			Future<ShellSessionManager.CommandResult> second = executor.submit(() -> {
+				start.await();
+				return sessionManager.executeCommand(secondCommand, config);
+			});
+			start.countDown();
+
+			ShellSessionManager.CommandResult firstResult = first.get(5, TimeUnit.SECONDS);
+			ShellSessionManager.CommandResult secondResult = second.get(5, TimeUnit.SECONDS);
+			assertFalse(firstResult.isTimedOut());
+			assertFalse(secondResult.isTimedOut());
+			assertTrue(firstResult.getOutput().contains("first-only"));
+			assertFalse(firstResult.getOutput().contains("second-only"));
+			assertTrue(secondResult.getOutput().contains("second-only"));
+			assertFalse(secondResult.getOutput().contains("first-only"));
+		}
+		catch (ExecutionException e) {
+			throw (e.getCause() instanceof Exception exception) ? exception : e;
+		}
+		finally {
+			executor.shutdownNow();
+		}
+	}
+
 	/**
 	 * Test that session can be recovered from registry when context is empty (HITL scenario).
 	 */
```

---

### Incident Patch 12: `28fafefc` (2026-08-10)
**Commit Message**: fix(core): avoid double state update when asNode is set (#4889)

Co-authored-by: shown <[REDACTED_EMAIL]>

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/CompiledGraph.java` (modified, +6/-1)
```diff
@@ -323,7 +323,12 @@ public RunnableConfig updateState(RunnableConfig config, Map<String, Object> val
 			var nextNodeCommand = nextNodeId(asNode, branchCheckpoint.getState(), config);
 
 			nextNodeId = nextNodeCommand.gotoNode();
-			branchCheckpoint = branchCheckpoint.updateState(nextNodeCommand.update(), keyStrategyMap);
+			branchCheckpoint = Checkpoint.builder()
+					.id(branchCheckpoint.getId())
+					.state(nextNodeCommand.update())
+					.nodeId(branchCheckpoint.getNodeId())
+					.nextNodeId(branchCheckpoint.getNextNodeId())
+					.build();
 
 		}
 		// update checkpoint in saver
```

---

### Incident Patch 13: `7831e2a2` (2026-08-10)
**Commit Message**: feat(admin): localize hardcoded Chinese UI strings for full English layout (#4891)

**File**: `spring-ai-alibaba-admin/frontend/packages/main/src/app.tsx` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ export function onRouteChange({ clientRoutes, location }) {
     }),
     '/dify': $i18n.get({
       id: 'main.pages.Dify.index.title',
-      dm: 'Dify转换',
+      dm: 'Dify Converter',
     }),
   };
 
```

**File**: `spring-ai-alibaba-admin/frontend/packages/main/src/i18n/index.ts` (modified, +41/-3)
```diff
@@ -2,11 +2,49 @@ import I18N from '../../../spark-i18n/src/index';
 import enLangMap from './locales/en-us.json';
 import jaLangMap from './locales/ja-jp.json';
 import cnLangMap from './locales/zh-cn.json';
+import {
+  en as evaluationEn,
+  ja as evaluationJa,
+  zh as evaluationZh,
+} from './legacy-locales/evaluation';
+import {
+  en as experimentTracingEn,
+  ja as experimentTracingJa,
+  zh as experimentTracingZh,
+} from './legacy-locales/experiment-tracing';
+import {
+  en as playgroundSharedEn,
+  ja as playgroundSharedJa,
+  zh as playgroundSharedZh,
+} from './legacy-locales/playground-shared';
+import {
+  en as promptsEn,
+  ja as promptsJa,
+  zh as promptsZh,
+} from './legacy-locales/prompts';
 
 const multiLangMap = {
-  zh: cnLangMap,
-  en: enLangMap,
-  ja: jaLangMap,
+  zh: {
+    ...cnLangMap,
+    ...evaluationZh,
+    ...experimentTracingZh,
+    ...playgroundSharedZh,
+    ...promptsZh,
+  },
+  en: {
+    ...enLangMap,
+    ...evaluationEn,
+    ...experimentTracingEn,
+    ...playgroundSharedEn,
+    ...promptsEn,
+  },
+  ja: {
+    ...jaLangMap,
+    ...evaluationJa,
+    ...experimentTracingJa,
+    ...playgroundSharedJa,
+    ...promptsJa,
+  },
 };
 
 export default new I18N({ multiLangMap });
```

**File**: `spring-ai-alibaba-admin/frontend/packages/main/src/i18n/legacy-locales/evaluation.ts` (added, +716/-0)
```diff
@@ -0,0 +1,716 @@
+export const zh: Record<string, string> = {
+  'legacy.evaluation.common.actions': '操作',
+  'legacy.evaluation.common.addColumn': '添加列',
+  'legacy.evaluation.common.addData': '添加数据',
+  'legacy.evaluation.common.backToList': '返回列表',
+  'legacy.evaluation.common.basicInformation': '基本信息',
+  'legacy.evaluation.common.cancel': '取消',
+  'legacy.evaluation.common.checkForm': '请检查表单填写是否正确',
+  'legacy.evaluation.common.checkFormPeriod': '请检查表单填写是否正确',
+  'legacy.evaluation.common.clear': '清空',
+  'legacy.evaluation.common.confirm': '确认',
+  'legacy.evaluation.common.confirmDelete': '确认删除',
+  'legacy.evaluation.common.create': '创建',
+  'legacy.evaluation.common.createEvaluationSet': '创建评测集',
+  'legacy.evaluation.common.createEvaluator': '创建评估器',
+  'legacy.evaluation.common.createdAt': '创建时间',
+  'legacy.evaluation.common.creating': '创建中...',
+  'legacy.evaluation.common.creationFailed': '创建失败',
+  'legacy.evaluation.common.creationFailedTitle': '创建失败',
+  'legacy.evaluation.common.currentVersion': '当前版本',
+  'legacy.evaluation.common.dataCount': '数据量',
+  'legacy.evaluation.common.dataItems': '数据量',
+  'legacy.evaluation.common.dataManagement': '数据管理',
+  'legacy.evaluation.common.debug': '调试',
+  'legacy.evaluation.common.delete': '删除',
+  'legacy.evaluation.common.deleteSelected': '批量删除',
+  'legacy.evaluation.common.descMax500': '描述不能超过500个字符',
+  'legacy.evaluation.common.description': '描述',
+  'legacy.evaluation.common.details': '详情',
+  'legacy.evaluation.common.edit': '编辑',
+  'legacy.evaluation.common.enterEvaluatorDescOptional': '输入评估器描述（可选）',
+  'legacy.evaluation.common.enterEvaluatorName': '输入评估器名称',
+  'legacy.evaluation.common.evaluationSetDeleted': '评测集已删除',
+  'legacy.evaluation.common.evaluationSetName': '评测集名称',
+  'legacy.evaluation.common.evaluatorName': '评估器名称',
+  'legacy.evaluation.common.experimentName': '实验名称',
+  'legacy.evaluation.common.importFromTemplate': '从模版导入',
+  'legacy.evaluation.common.importTemplate': '导入模板',
+  'legacy.evaluation.common.judgeModel': '裁判模型',
+  'legacy.evaluation.common.loadFailed': '加载失败',
+  'legacy.evaluation.common.model': '模型',
+  'legacy.evaluation.common.modelConfiguration': '模型配置',
+  'legacy.evaluation.common.name': '名称',
+  'legacy.evaluation.common.nameMax100': '名称不能超过100个字符',
+  'legacy.evaluation.common.nameMax50': '名称不能超过50个字符',
+  'legacy.evaluation.common.noTemplateData': '暂无模板数据',
+  'legacy.evaluation.common.noVersions': '暂无版本',
+  'legacy.evaluation.common.pleaseEnterEvaluationSetName': '请输入评测集名称',
+  'legacy.evaluation.common.pleaseEnterEvaluatorName': '请输入评估器名称',
+  'legacy.evaluation.common.pleaseSelect': '请选择',
+  'legacy.evaluation.common.promptContent': 'Prompt 内容',
+  'legacy.evaluation.common.publishNewVersion': '发布新版本',
+  'legacy.evaluation.common.relatedExperiments': '关联实验',
+  'legacy.evaluation.common.retry': '重试',
+  'legacy.evaluation.common.run': '运行',
+  'legacy.evaluation.common.save': '保存',
+  'legacy.evaluation.common.searchByName': '搜索名称',
+  'legacy.evaluation.common.selectTemplate': '选择模板',
+  'legacy.evaluation.common.status': '状态',
+  'legacy.evaluation.common.statusCompleted': '已完成',
+  'legacy.evaluation.common.statusRunning': '运行中',
+  'legacy.evaluation.common.statusStopped': '已停止',
+  'legacy.evaluation.common.statusWaiting': '等待中',
+  'legacy.evaluation.common.submit': '提交',
+  'legacy.evaluation.common.submitNewVersion': '提交新版本',
+  'legacy.evaluation.common.templateKey': '模板Key',
+  'legacy.evaluation.common.templateName': '模板名称',
+  'legacy.evaluation.common.templatePreview': '模板预览',
+  'legacy.evaluation.common.updatedAt': '更新时间',
+  'legacy.evaluation.common.variables': '变量',
+  'legacy.evaluation.common.version': '版本号',
+  'legacy.evaluation.common.versionHistory': '版本记录',
+  'legacy.evaluation.createEvaluatorModal.createContext': '创建评估器',
+  'legacy.evaluation.createEvaluatorModal.createFailedRetry': '创建失败，请稍后重试',
+  'legacy.evaluation.createEvaluatorModal.createdDesc': '评估器 "{name}" 已成功创建',
+  'legacy.evaluation.createEvaluatorModal.createdSuccess': '评估器创建成功',
+  'legacy.evaluation.createEvaluatorModal.namePattern': '名称只能包含中英文、数字、下划线和横线',
+  'legacy.evaluation.createEvaluatorModal.nextStep1': '裁判模型选择（GPT-4、Claude等）',
+  'legacy.evaluation.createEvaluatorModal.nextStep2': '评估Prompt内容',
+  'legacy.evaluation.createEvaluatorModal.nextStep3': '模型参数配置',
+  'legacy.evaluation.createEvaluatorModal.nextStep4': '版本管理和发布',
+  'legacy.evaluation.createEvaluatorModal.nextSteps': '创建后的配置步骤',
+  'legacy.evaluation.createEvaluatorModal.nextStepsDesc': '创建评估器后，您可以在详情页面配置具体的版本信息，包括：',
+  'legacy.evaluation.createEvaluatorModal.title': '创建新评估器',
+  'legacy.evaluation.evaluator.debugNavigateContext': '跳转调试页面',
+  'legacy.evaluation.evaluator.deleteConfirmContent': '确定要删除评估器 {name} 吗？',
+  'legacy.evaluation.evaluator.deleteConfirmHint': '此操作不可恢复，请谨慎操作。',
+  'legacy.evaluation.evaluator.deleteContext': '删除评估器',
+  'legacy.evaluation.evaluator.deleteFailed': '删除失败',
+  'legacy.evaluation.evaluator.de
```

**File**: `spring-ai-alibaba-admin/frontend/packages/main/src/i18n/legacy-locales/experiment-tracing.ts` (added, +752/-0)
```diff
@@ -0,0 +1,752 @@
+/** Legacy locales for experiment and tracing pages (en/zh/ja). */
+export const en: Record<string, string> = {
+  'legacy.common.loading': "Loading...",
+  'legacy.common.noData': "No data",
+  'legacy.common.cancel': "Cancel",
+  'legacy.common.refresh': "Refresh",
+  'legacy.common.back': "Back",
+  'legacy.common.viewDetails': "View Details",
+  'legacy.common.description': "Description",
+  'legacy.common.descriptionColon': "Description:",
+  'legacy.common.version': "Version",
+  'legacy.common.status': "Status",
+  'legacy.common.actions': "Actions",
+  'legacy.common.model': "Model",
+  'legacy.common.modelColon': "Model:",
+  'legacy.common.delete': "Delete",
+  'legacy.common.default': "Default",
+  'legacy.common.selectVersion': "Select Version",
+  'legacy.common.selectVersionPlaceholder': "Select a version",
+  'legacy.common.pleaseSelectVersion': "Please select a version",
+  'legacy.common.noVersionData': "No version data",
+  'legacy.common.createExperiment': "Create Experiment",
+  'legacy.experiment.status.running': "Running",
+  'legacy.experiment.status.completed': "Completed",
+  'legacy.experiment.status.failed': "Failed",
+  'legacy.experiment.status.waiting': "Waiting",
+  'legacy.experiment.status.stopped': "Stopped",
+  'legacy.experiment.status.progress': "Progress: {progress}%",
+  'legacy.experiment.loadFailed': "Failed to load experiments",
+  'legacy.experiment.fetchListFailed': "Failed to retrieve experiments",
+  'legacy.experiment.confirmStopTitle': "Confirm Stop",
+  'legacy.experiment.confirmStopContent': "Are you sure you want to stop experiment \"{name}\"? Its status will change to Failed.",
+  'legacy.experiment.confirmStopOk': "Confirm Stop",
+  'legacy.experiment.stopped': "Experiment stopped",
+  'legacy.experiment.stopFailed': "Failed to stop experiment",
+  'legacy.experiment.rerunInfo': "Rerunning experiment: {name}",
+  'legacy.experiment.rerunFailed': "Failed to rerun experiment",
+  'legacy.experiment.confirmDeleteTitle': "Confirm Delete",
+  'legacy.experiment.confirmDeleteContent': "Are you sure you want to delete experiment \"{name}\"? This action cannot be undone.",
+  'legacy.experiment.confirmDeleteOk': "Confirm Delete",
+  'legacy.experiment.deleted': "Experiment deleted successfully",
+  'legacy.experiment.deleteFailed': "Failed to delete experiment",
+  'legacy.experiment.col.name': "Experiment Name",
+  'legacy.experiment.col.dataset': "Evaluation Set",
+  'legacy.experiment.col.evaluator': "Evaluator",
+  'legacy.experiment.col.none': "None",
+  'legacy.experiment.allEvaluators': "All evaluators:\n{names}",
+  'legacy.experiment.listSeparator': ", ",
+  'legacy.experiment.col.createdAt': "Created At",
+  'legacy.experiment.col.updatedAt': "Updated At",
+  'legacy.experiment.action.stop': "Stop",
+  'legacy.experiment.action.viewResults': "View Results",
+  'legacy.experiment.action.rerun': "Rerun",
+  'legacy.experiment.title': "Experiment Management",
+  'legacy.experiment.searchName': "Search by name",
+  'legacy.experiment.selectStatus': "Select status",
+  'legacy.experimentCreate.fetchDatasetsFailedRetry': "Failed to retrieve evaluation sets. Please try again.",
+  'legacy.experimentCreate.fetchPromptsFailed': "Failed to retrieve prompts",
+  'legacy.experimentCreate.fetchPromptsFailedRetry': "Failed to retrieve prompts. Please try again.",
+  'legacy.experimentCreate.fetchEvaluatorsFailed': "Failed to retrieve evaluators",
+  'legacy.experimentCreate.fetchEvaluatorsFailedRetry': "Failed to retrieve evaluators. Please try again.",
+  'legacy.experimentCreate.fetchDatasetVersionsFailed': "Failed to retrieve evaluation set versions",
+  'legacy.experimentCreate.fetchPromptVersionDetailFailed': "Failed to retrieve prompt version details",
+  'legacy.experimentCreate.fetchDatasetDetailFailed': "Failed to retrieve evaluation set details",
+  'legacy.experimentCreate.fetchPromptVersionsFailed': "Failed to retrieve prompt versions",
+  'legacy.experimentCreate.fetchEvaluatorParamsFailed': "Failed to retrieve parameters for evaluator {evaluatorId}",
+  'legacy.experimentCreate.source.dataset': "Evaluation Set",
+  'legacy.experimentCreate.display.datasetField': "{field} (Evaluation Set)",
+  'legacy.experimentCreate.source.object': "Evaluation Object",
+  'legacy.experimentCreate.display.actualOutput': "actual_output (Evaluation Object)",
+  'legacy.experimentCreate.fetchEvaluatorVersionsFailed': "Failed to retrieve versions for evaluator {evaluatorId}",
+  'legacy.experimentCreate.needOneEvaluator': "Please add at least one evaluator",
+  'legacy.experimentCreate.needEvaluatorVersions': "Please select a version for every evaluator",
+  'legacy.experimentCreate.needEvaluatorConfigured': "Please ensure all evaluators are configured correctly",
+  'legacy.experimentCreate.createSuccess': "Experiment created successfully",
+  'legacy.experimentCreate.createFailed': "Creation failed. Please try again.",
+  'legacy.experimentCreate.step1'
```

**File**: `spring-ai-alibaba-admin/frontend/packages/main/src/i18n/legacy-locales/playground-shared.ts` (added, +273/-0)
```diff
@@ -0,0 +1,273 @@
+export const zh: Record<string, string> = {
+  'legacy.layout.promptEngineering': 'Prompt工程',
+  'legacy.layout.evaluation': '评测',
+  'legacy.layout.evaluationSets': '评测集',
+  'legacy.layout.evaluators': '评估器',
+  'legacy.layout.experiments': '实验',
+  'legacy.layout.observability': '可观测',
+  'legacy.layout.collapseMenu': '收起菜单',
+
+  'legacy.pagination.showTotal': '第 {start}-{end} 条，共 {total} 条',
+
+  'legacy.notification.operation': '操作',
+  'legacy.notification.operationFailed': '操作失败',
+  'legacy.notification.retryLater': '请稍后重试',
+  'legacy.notification.contextFailed': '{context}失败',
+  'legacy.notification.contextFailedWithCode': '{context}失败 (错误码: {code})',
+  'legacy.notification.serverException': '服务器返回异常',
+  'legacy.notification.networkError': '网络连接异常，请检查网络后重试',
+  'legacy.notification.validationFailed': '输入验证失败',
+
+  'legacy.playground.failedLoadPrompts': '获取 Prompts 列表失败',
+  'legacy.playground.loadPromptData': '加载 Prompts 数据',
+  'legacy.playground.failedLoadPromptsRetry': '加载失败，请稍后重试',
+  'legacy.playground.failedGetVersionDetails': '获取版本详情失败',
+  'legacy.playground.loadVersionDetails': '加载版本详情',
+  'legacy.playground.failedLoadVersionDetails': '加载版本详情失败',
+  'legacy.playground.maxComparePrompts': '最多只能同时对比3个Prompt',
+  'legacy.playground.noSessionToRestore': '没有可恢复的会话',
+  'legacy.playground.sessionRestored': '会话恢复成功',
+  'legacy.playground.failedRestoreSession': '恢复会话失败',
+  'legacy.playground.sessionDeleted': '会话删除成功',
+  'legacy.playground.failedDeleteSession': '删除会话失败',
+  'legacy.playground.loadingPrompts': '加载 Prompts 数据中...',
+  'legacy.playground.subtitle': '测试和调试你的AI提示词',
+  'legacy.playground.loadingModels': '正在加载模型...',
+  'legacy.playground.initializing': '正在初始化...',
+  'legacy.playground.configurationN': '配置 {index}',
+  'legacy.playground.add': '新增',
+  'legacy.playground.addFunction': '新增函数',
+  'legacy.playground.template': '模板',
+  'legacy.playground.importFromTemplate': '从模板导入',
+  'legacy.playground.maxDebugThree': '最多同时调试三个prompt',
+  'legacy.playground.duplicateForCompare': '复制Prompt进行对比',
+  'legacy.playground.deletePrompt': '删除Prompt',
+  'legacy.playground.selectOrEditPrompt': '请选择 Prompt 或直接编辑内容',
+  'legacy.playground.selectVersionMsg': '请选择版本',
+  'legacy.playground.selectPrompt': '选择Prompt',
+  'legacy.playground.selectExistingPrompt': '选择已有Prompt...',
+  'legacy.playground.noPromptsAvailable': '暂无可用的 Prompts',
+  'legacy.playground.promptVersionsCount': '{name} ({count} 个版本)',
+  'legacy.playground.selectVersion': '选择版本',
+  'legacy.playground.selectVersionPlaceholder': '选择版本...',
+  'legacy.playground.releaseTag': ' (正式版)',
+  'legacy.playground.preReleaseTag': ' (PRE版)',
+  'legacy.playground.promptContent': 'Prompt内容',
+  'legacy.playground.promptContentPlaceholder':
+    '输入Prompt内容，使用 {{参数名}} 来定义参数...',
+  'legacy.playground.model': '模型',
+  'legacy.playground.selectModel': '选择模型',
+  'legacy.playground.noModelsAvailable': '暂无可用模型',
+  'legacy.playground.modelParameters': '模型参数',
+  'legacy.playground.parameterConfiguration': '参数配置',
+  'legacy.playground.enterParamValue': '输入 {param} 的值...',
+  'legacy.playground.publishNewVersion': '发布新版本',
+  'legacy.playground.quicklyCreatePrompt': '快速创建新 Prompt',
+  'legacy.playground.conversationTest': '对话测试',
+  'legacy.playground.testConfigEffect': '测试配置 {index} 的效果',
+  'legacy.playground.sessionTag': '会话: {id}...',
+  'legacy.playground.restorePreviousSession': '恢复上一次会话',
+  'legacy.playground.restoreSession': '恢复会话',
+  'legacy.playground.clearConversation': '清空对话',
+  'legacy.playground.clear': '清空',
+  'legacy.playground.startConversation': '等待开始对话',
+  'legacy.playground.sendMessageToTest': '在下方输入框中发送消息开始测试',
+  'legacy.playground.copiedToClipboard': '已复制到剪贴板',
+  'legacy.playground.copyResponse': '复制回复',
+  'legacy.playground.inputTokens': '输入 Token: {count}',
+  'legacy.playground.outputTokens': '输出 Token: {count}',
+  'legacy.playground.totalTokens': '总 Token: {count}',
+  'legacy.playground.viewTrace': '查看调用链路跟踪',
+  'legacy.playground.inputPlaceholder':
+    '输入您的问题进行测试... (Enter发送，Shift+Enter换行)',
+  'legacy.playground.processing': '处理中...',
+  'legacy.playground.send': '发送',
+};
+
+export const en: Record<string, string> = {
+  'legacy.layout.promptEngineering': 'Prompt Engineering',
+  'legacy.layout.evaluation': 'Evaluation',
+  'legacy.layout.evaluationSets': 'Evaluation Sets',
+  'legacy.layout.evaluators': 'Evaluators',
+  'legacy.layout.experiments': 'Experiments',
+  'legacy.layout.observability': 'Observability',
+  'legacy.layout.collapseMenu': 'Collapse Menu',
+
+  'legacy.pagination.showTotal': '{start}-{end} of {total} items',
+
+  'legacy.notification.operation': 'Operation',
+  'legacy.notification.operationFailed': 'Operation failed',
+  'legacy.notification.retryLater': 'Please try again later',
+  'legacy.notification.contextFailed': '{context} failed',
+  'legacy.notification.contextFailedWithCode': '{context} failed (code: {code})',
+  'legacy.notification.serverExce
```

**File**: `spring-ai-alibaba-admin/frontend/packages/main/src/i18n/legacy-locales/prompts.ts` (added, +978/-0)
```diff
@@ -0,0 +1,978 @@
+/** Legacy prompts UI locale fragment (en/zh/ja). Merged by parent into i18n maps. */
+
+export const en: Record<string, string> = {
+  'legacy.prompts.1.add.the.spring.ai.alibaba.agent.nacos.proxy.module': '1. Add the Spring AI Alibaba Agent Nacos proxy module',
+  'legacy.prompts.1.version.selected.select.1.more.version': '1 version selected. Select 1 more version.',
+  'legacy.prompts.2.configure.the.nacos.address.and.promptkey': '2. Configure the Nacos address and promptKey',
+  'legacy.prompts.3.add.the.spring.ai.alibaba.observability.module': '3. Add the Spring AI Alibaba observability module',
+  'legacy.prompts.4.configure.observability.settings': '4. Configure observability settings',
+  'legacy.prompts.a.pre.release.version.for.testing.and.validation': 'A pre-release version for testing and validation.',
+  'legacy.prompts.a.pre.release.version.for.testing.and.validation.2': ' A pre-release version for testing and validation.',
+  'legacy.prompts.a.stable.production.version.that.updates.the.curre': ' A stable production version that updates the current-version pointer.',
+  'legacy.prompts.a.stable.production.version.that.updates.the.current.version': 'A stable production version that updates the current version pointer.',
+  'legacy.prompts.actions': 'Actions',
+  'legacy.prompts.add': 'Add',
+  'legacy.prompts.add.function': 'Add Function',
+  'legacy.prompts.added.content': 'Added content',
+  'legacy.prompts.added.line': '(Added line)',
+  'legacy.prompts.all.other.reactagent.builder.parameters.are.the.same.as.the': 'All other ReactAgent builder parameters are the same as the standard ReactAgent construction approach.',
+  'legacy.prompts.and.include.parameters': ' and include {paramCount} parameters',
+  'legacy.prompts.back.to.list': 'Back to list',
+  'legacy.prompts.basic.information': 'Basic Information',
+  'legacy.prompts.build.reactagent.with.builderfactory.set.to.nacosagentprompt': 'Build ReactAgent with builderFactory set to NacosAgentPromptBuilderFactory',
+  'legacy.prompts.cancel': 'Cancel',
+  'legacy.prompts.chat.test': 'Chat Test',
+  'legacy.prompts.clear': 'Clear',
+  'legacy.prompts.clear.chat': 'Clear chat',
+  'legacy.prompts.clear.selection': 'Clear selection',
+  'legacy.prompts.clear.selection.2': 'Clear selection ({count})',
+  'legacy.prompts.click.two.versions.to.compare.or.click.one.to.view.details': 'Click two versions to compare, or click one to view details.',
+  'legacy.prompts.close': 'Close',
+  'legacy.prompts.close.comparison': 'Close Comparison',
+  'legacy.prompts.compare.selected.versions': 'Compare selected versions',
+  'legacy.prompts.compare.versions': 'Compare Versions',
+  'legacy.prompts.compare.with.previous.version': 'Compare with previous version',
+  'legacy.prompts.comparison.will.open.automatically': ' (comparison will open automatically)',
+  'legacy.prompts.configuration': 'Configuration {n}',
+  'legacy.prompts.confirm.deletion': 'Confirm Deletion',
+  'legacy.prompts.connection.error.retry': 'Connection error. Please try again later.',
+  'legacy.prompts.connection.failed': 'Connection failed',
+  'legacy.prompts.content.comparison': 'Content Comparison',
+  'legacy.prompts.content.preview': 'Content Preview:',
+  'legacy.prompts.content.preview.2': 'Content Preview',
+  'legacy.prompts.copied.successfully': 'Copied successfully',
+  'legacy.prompts.copied.to.clipboard': 'Copied to clipboard',
+  'legacy.prompts.copy.code': 'Copy Code',
+  'legacy.prompts.copy.configuration.for.comparison': 'Copy configuration for comparison',
+  'legacy.prompts.copy.failed': 'Copy failed',
+  'legacy.prompts.copy.response': 'Copy response',
+  'legacy.prompts.create.a.version': 'Create a version',
+  'legacy.prompts.create.and.publish.version': 'Create and publish {statusType} version',
+  'legacy.prompts.create.new.prompt': 'Create New Prompt',
+  'legacy.prompts.create.prompt': 'Create Prompt',
+  'legacy.prompts.create.prompt.2': 'Create Prompt',
+  'legacy.prompts.create.your.first.prompt': 'Create your first prompt',
+  'legacy.prompts.created.2': 'Created: ',
+  'legacy.prompts.created.at': 'Created At',
+  'legacy.prompts.created.at.2': 'Created at',
+  'legacy.prompts.created.at.4': 'Created At: ',
+  'legacy.prompts.created.prompt': 'Created prompt "{promptKey}".',
+  'legacy.prompts.created.prompt.and.published.version': 'Created prompt "{promptKey}" and published version {version}.',
+  'legacy.prompts.creating': 'Creating...',
+  'legacy.prompts.creation.failed': 'Creation failed',
+  'legacy.prompts.current.prompt': 'Current Prompt',
+  'legacy.prompts.current.version': 'Current Version',
+  'legacy.prompts.current.version.content': 'Current Version Content',
+  'legacy.prompts.default.mock.value': 'Default Mock Value',
+  'legacy.prompts.delete': 'Delete',
+  'legacy.prompts.delete.2': 'Delete',
+  'legacy.prompts.delete.configuration': 'Delete configuration',
+  'legacy.prompts.delete.confirm.prefix': 'Are you sure you w
```

**File**: `spring-ai-alibaba-admin/frontend/packages/main/src/i18n/locales/en-us.json` (modified, +41/-1)
```diff
@@ -1149,6 +1149,13 @@
   "main.utils.base.copySuccess": "Successful",
   "main.layouts.MenuList.application": "Application",
   "main.layouts.SideMenu.dify": "Dify To Graph",
+  "main.layouts.SideMenu.promptEngineering": "Prompt Engineering",
+  "main.layouts.SideMenu.evaluation": "Evaluation",
+  "main.layouts.SideMenu.evaluationSet": "Evaluation Sets",
+  "main.layouts.SideMenu.evaluator": "Evaluators",
+  "main.layouts.SideMenu.experiment": "Experiments",
+  "main.layouts.SideMenu.observability": "Observability",
+  "main.layouts.SideMenu.collapseMenu": "Collapse Menu",
   "main.components.AccountModal.index.accountManagement": "Account",
   "main.components.AccountModal.index.logout": "Logout",
   "main.components.AccountModal.index.currentPassword": "Current Password",
@@ -1331,5 +1338,38 @@
   "main.pages.Knowledge.Detail.components.ChunkViewDrawer.index.close": "Close",
   "main.pages.Login.components.Login.index.notSupportedAccountPasswordLogin": "Not supported account password login",
   "main.pages.Login.components.Login.index.otherWaysLogin": "Or",
-  "main.pages.Login.components.Login.index.useGithubLogin": "Login with Github "
+  "main.pages.Login.components.Login.index.useGithubLogin": "Login with Github ",
+  "main.pages.App.index.home": "Home",
+  "main.pages.App.index.platformDescription": "Visual agent development, debugging, deployment, and export. Supports chatbot and workflow modes.",
+  "main.pages.App.index.difyTitle": "Convert Dify App to SAA Project",
+  "main.pages.App.index.difyDescription": "Convert agents built on Dify into Spring AI Alibaba applications for IDE development and maintenance.",
+  "main.pages.App.exportSAAProjectCode": "Export SAA Project Code",
+  "main.pages.Dify.index.title": "Dify Converter",
+  "main.pages.Dify.index.breadcrumb": "Dify App Conversion",
+  "main.pages.Dify.index.heading": "Convert Dify App to Spring AI Alibaba Project",
+  "main.pages.Dify.index.instructionsTitle": "Instructions",
+  "main.pages.Dify.index.instruction1": "Export the DSL config file (YAML) of your agent app from the Dify platform",
+  "main.pages.Dify.index.instruction2": "Drag the DSL file into the file area below, or click to select a file",
+  "main.pages.Dify.index.instruction3": "Click \"Start Conversion\" — the system will parse the DSL and generate a Spring AI Alibaba project",
+  "main.pages.Dify.index.instruction4": "After conversion, download the generated source and import it into your IDE",
+  "main.pages.Dify.index.selectFileTitle": "Select Dify DSL File",
+  "main.pages.Dify.index.uploadText": "Click or drag a Dify DSL file to this area",
+  "main.pages.Dify.index.uploadHint": "Supports YAML Dify DSL config files (.yaml or .yml)",
+  "main.pages.Dify.index.selectedFileLabel": "Selected file: ",
+  "main.pages.Dify.index.startConvert": "Start Conversion",
+  "main.pages.Dify.index.converting": "Converting...",
+  "main.pages.Dify.index.resultTitle": "Conversion Result",
+  "main.pages.Dify.index.resultSuccessText": "✅ Conversion succeeded! Generated files:",
+  "main.pages.Dify.index.fileSelectedSuccess": "{name} selected successfully",
+  "main.pages.Dify.index.onlyYamlSupported": "Only YAML Dify DSL files are supported!",
+  "main.pages.Dify.index.selectFileFirst": "Please select a Dify DSL file first",
+  "main.pages.Dify.index.convertSuccessDownload": "Conversion succeeded! Project download started",
+  "main.pages.Dify.index.resultProjectGenerated": "Spring AI Alibaba project generated",
+  "main.pages.Dify.index.resultProjectType": "Project type: Maven project",
+  "main.pages.Dify.index.resultLanguage": "Language: Java 17",
+  "main.pages.Dify.index.resultDependencies": "Dependencies: spring-ai-alibaba-graph, web, spring-ai-alibaba-starter-dashscope",
+  "main.pages.Dify.index.resultAppMode": "App mode: workflow",
+  "main.pages.Dify.index.convertFailed": "Conversion failed: {message}",
+  "main.pages.Dify.index.pleaseRetry": "Please retry",
+  "main.pages.Dify.index.fileReadFailed": "Failed to read file"
 }
```

**File**: `spring-ai-alibaba-admin/frontend/packages/main/src/i18n/locales/ja-jp.json` (modified, +41/-1)
```diff
@@ -1149,6 +1149,13 @@
   "main.utils.base.copySuccess": "コピーに成功しました",
   "main.layouts.MenuList.application": "アプリケーション",
   "main.layouts.SideMenu.dify": "Dify To Graph",
+  "main.layouts.SideMenu.promptEngineering": "プロンプトエンジニアリング",
+  "main.layouts.SideMenu.evaluation": "評価",
+  "main.layouts.SideMenu.evaluationSet": "評価セット",
+  "main.layouts.SideMenu.evaluator": "評価器",
+  "main.layouts.SideMenu.experiment": "実験",
+  "main.layouts.SideMenu.observability": "可観測性",
+  "main.layouts.SideMenu.collapseMenu": "メニューを折りたたむ",
   "main.components.AccountModal.index.accountManagement": "アカウント管理",
   "main.components.AccountModal.index.logout": "ログアウト",
   "main.components.AccountModal.index.currentPassword": "現在のパスワード",
@@ -1331,5 +1338,38 @@
   "main.pages.Knowledge.Detail.components.ChunkViewDrawer.index.close": "閉じる",
   "main.pages.Login.components.Login.index.notSupportedAccountPasswordLogin": "現在、アカウントとパスワードによるログインはサポートされていません",
   "main.pages.Login.components.Login.index.otherWaysLogin": "または",
-  "main.pages.Login.components.Login.index.useGithubLogin": "GitHubでログイン"
+  "main.pages.Login.components.Login.index.useGithubLogin": "GitHubでログイン",
+  "main.pages.App.index.home": "ホーム",
+  "main.pages.App.index.platformDescription": "可視化によるエージェントの開発・デバッグ・デプロイ・エクスポートを提供し、チャットボットやワークフローなどのモードをサポートします。",
+  "main.pages.App.index.difyTitle": "DifyアプリをSAAプロジェクトに変換",
+  "main.pages.App.index.difyDescription": "Difyで開発したエージェントをSpring AI Alibabaアプリに変換し、IDEで開発・保守できます。",
+  "main.pages.App.exportSAAProjectCode": "SAAプロジェクトコードをエクスポート",
+  "main.pages.Dify.index.title": "Dify変換",
+  "main.pages.Dify.index.breadcrumb": "Difyアプリ変換",
+  "main.pages.Dify.index.heading": "DifyアプリをSpring AI Alibabaプロジェクトに変換",
+  "main.pages.Dify.index.instructionsTitle": "操作手順",
+  "main.pages.Dify.index.instruction1": "DifyプラットフォームからエージェントアプリのDSL設定ファイル（YAML形式）をエクスポートします",
+  "main.pages.Dify.index.instruction2": "DSLファイルを下のファイル選択エリアにドラッグするか、クリックして選択します",
+  "main.pages.Dify.index.instruction3": "「変換を開始」をクリックすると、システムがDSLを解析しSpring AI Alibabaプロジェクトを生成します",
+  "main.pages.Dify.index.instruction4": "変換完了後、生成されたソースをダウンロードしてIDEにインポートできます",
+  "main.pages.Dify.index.selectFileTitle": "Dify DSLファイルを選択",
+  "main.pages.Dify.index.uploadText": "クリックまたはドラッグしてDify DSLファイルをこのエリアに配置",
+  "main.pages.Dify.index.uploadHint": "YAML形式のDify DSL設定ファイル（.yamlまたは.yml）をサポート",
+  "main.pages.Dify.index.selectedFileLabel": "選択済みファイル：",
+  "main.pages.Dify.index.startConvert": "変換を開始",
+  "main.pages.Dify.index.converting": "変換中...",
+  "main.pages.Dify.index.resultTitle": "変換結果",
+  "main.pages.Dify.index.resultSuccessText": "✅ 変換成功！生成されたファイル：",
+  "main.pages.Dify.index.fileSelectedSuccess": "{name} の選択に成功しました",
+  "main.pages.Dify.index.onlyYamlSupported": "YAML形式のDify DSLファイルのみサポートしています！",
+  "main.pages.Dify.index.selectFileFirst": "先にDify DSLファイルを選択してください",
+  "main.pages.Dify.index.convertSuccessDownload": "変換成功！プロジェクトのダウンロードを開始しました",
+  "main.pages.Dify.index.resultProjectGenerated": "Spring AI Alibabaプロジェクトが生成されました",
+  "main.pages.Dify.index.resultProjectType": "プロジェクトタイプ: Mavenプロジェクト",
+  "main.pages.Dify.index.resultLanguage": "言語: Java 17",
+  "main.pages.Dify.index.resultDependencies": "依存関係: spring-ai-alibaba-graph, web, spring-ai-alibaba-starter-dashscope",
+  "main.pages.Dify.index.resultAppMode": "アプリモード: workflow",
+  "main.pages.Dify.index.convertFailed": "変換失敗：{message}",
+  "main.pages.Dify.index.pleaseRetry": "再試行してください",
+  "main.pages.Dify.index.fileReadFailed": "ファイルの読み込みに失敗しました"
 }
```

---

### Incident Patch 14: `9aee0f1a` (2026-08-06)
**Commit Message**: fix(graph): compress Redis checkpoint payloads compatibly (#4884)

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/checkpoint/savers/redis/RedisSaver.java` (modified, +52/-23)
```diff
@@ -37,11 +37,14 @@
 import java.util.UUID;
 import java.util.concurrent.TimeUnit;
 import java.util.stream.IntStream;
+import java.util.zip.GZIPInputStream;
+import java.util.zip.GZIPOutputStream;
 
 import org.redisson.api.RBucket;
 import org.redisson.api.RLock;
 import org.redisson.api.RMap;
 import org.redisson.api.RedissonClient;
+import org.redisson.client.codec.ByteArrayCodec;
 
 import static java.lang.String.format;
 import static java.util.Objects.requireNonNull;
@@ -63,6 +66,7 @@ public class RedisSaver implements BaseCheckpointSaver {
 	private static final String FIELD_THREAD_ID = "thread_id";
 	private static final String FIELD_IS_RELEASED = "is_released";
 	private static final String FIELD_THREAD_NAME = "thread_name";
+	private static final byte[] CHECKPOINT_FORMAT_MAGIC = { 'S', 'A', 'A', 'C', 1 };
 	private final Serializer<Checkpoint> checkpointSerializer;
 	private RedissonClient redisson;
 	private final long ttl;
@@ -94,33 +98,64 @@ public static Builder builder() {
 		return new Builder();
 	}
 
-	private String serializeCheckpoints(List<Checkpoint> checkpoints) throws IOException {
-		try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
-			 ObjectOutputStream oos = new ObjectOutputStream(baos)) {
+	private byte[] serializeCheckpoints(List<Checkpoint> checkpoints) throws IOException {
+		ByteArrayOutputStream baos = new ByteArrayOutputStream();
+		baos.write(CHECKPOINT_FORMAT_MAGIC);
+		try (GZIPOutputStream gzip = new GZIPOutputStream(baos);
+			 ObjectOutputStream oos = new ObjectOutputStream(gzip)) {
 			oos.writeInt(checkpoints.size());
 			for (Checkpoint checkpoint : checkpoints) {
 				checkpointSerializer.write(checkpoint, oos);
 			}
-			oos.flush();
-			byte[] bytes = baos.toByteArray();
-			return Base64.getEncoder().encodeToString(bytes);
 		}
+		return baos.toByteArray();
 	}
 
-	private LinkedList<Checkpoint> deserializeCheckpoints(String content) throws IOException, ClassNotFoundException {
-		if (content == null || content.isEmpty()) {
+	private LinkedList<Checkpoint> deserializeCheckpoints(String contentKey) throws IOException, ClassNotFoundException {
+		RBucket<byte[]> binaryBucket = redisson.getBucket(contentKey, ByteArrayCodec.INSTANCE);
+		byte[] content = binaryBucket.get();
+		if (content == null || content.length == 0) {
 			return new LinkedList<>();
 		}
-		byte[] bytes = Base64.getDecoder().decode(content);
-		try (ByteArrayInputStream bais = new ByteArrayInputStream(bytes);
+		if (hasVersionedHeader(content)) {
+			try (ByteArrayInputStream bais = new ByteArrayInputStream(content, CHECKPOINT_FORMAT_MAGIC.length,
+					content.length - CHECKPOINT_FORMAT_MAGIC.length);
+				 GZIPInputStream gzip = new GZIPInputStream(bais);
+				 ObjectInputStream ois = new ObjectInputStream(gzip)) {
+				return readCheckpoints(ois);
+			}
+		}
+
+		String legacyContent = redisson.<String>getBucket(contentKey).get();
+		if (legacyContent == null || legacyContent.isEmpty()) {
+			return new LinkedList<>();
+		}
+		byte[] legacyBytes = Base64.getDecoder().decode(legacyContent);
+		try (ByteArrayInputStream bais = new ByteArrayInputStream(legacyBytes);
 			 ObjectInputStream ois = new ObjectInputStream(bais)) {
+			return readCheckpoints(ois);
+		}
+	}
+
+	private boolean hasVersionedHeader(byte[] content) {
+		if (content.length < CHECKPOINT_FORMAT_MAGIC.length) {
+			return false;
+		}
+		for (int i = 0; i < CHECKPOINT_FORMAT_MAGIC.length; i++) {
+			if (content[i] != CHECKPOINT_FORMAT_MAGIC[i]) {
+				return false;
+			}
+		}
+		return true;
+	}
+
+	private LinkedList<Checkpoint> readCheckpoints(ObjectInputStream ois) throws IOException, ClassNotFoundException {
 			int size = ois.readInt();
 			LinkedList<Checkpoint> checkpoints = new LinkedList<>();
 			for (int i = 0; i < size; i++) {
 				checkpoints.add(checkpointSerializer.read(ois));
 			}
 			return checkpoints;
-		}
 	}
 
 	/**
@@ -209,9 +244,7 @@ public Collection<Checkpoint> list(RunnableConfig config) {
 			}
 
 			// Use thread_id to query checkpoints
-			RBucket<String> bucket = redisson.getBucket(CHECKPOINT_PREFIX + threadId);
-			String content = bucket.get();
-			return deserializeCheckpoints(content);
+			return deserializeCheckpoints(CHECKPOINT_PREFIX + threadId);
 
 		}
 		catch (InterruptedException e) {
@@ -251,9 +284,7 @@ public Optional<Checkpoint> get(RunnableConfig config) {
 			}
 
 			// Use thread_id to query checkpoints
-			RBucket<String> bucket = redisson.getBucket(CHECKPOINT_PREFIX + threadId);
-			String content = bucket.get();
-			LinkedList<Checkpoint> checkpoints = deserializeCheckpoints(content);
+			LinkedList<Checkpoint> checkpoints = deserializeCheckpoints(CHECKPOINT_PREFIX + threadId);
 
 			if (config.checkPointId().isPresent()) {
 				return config.checkPointId()
@@ -298,9 +329,8 @@ public RunnableConfig put(RunnableConfig config, Checkpoint checkpoint) throws E
 			String threadId = getOrCreateThreadId(threadName);
 
 			// Use thread_id as key for checkpoint storage
-
```

**File**: `spring-ai-alibaba-graph-core/src/test/java/com/alibaba/cloud/ai/graph/checkpoint/savers/RedisSaverTest.java` (modified, +66/-0)
```diff
@@ -26,12 +26,18 @@
 import com.alibaba.cloud.ai.graph.checkpoint.config.SaverConfig;
 import com.alibaba.cloud.ai.graph.checkpoint.savers.redis.RedisSaver;
 import com.alibaba.cloud.ai.graph.serializer.AgentInstructionMessage;
+import com.alibaba.cloud.ai.graph.serializer.Serializer;
 import com.alibaba.cloud.ai.graph.serializer.StateSerializer;
+import com.alibaba.cloud.ai.graph.serializer.check_point.CheckPointSerializer;
 import com.alibaba.cloud.ai.graph.serializer.plain_text.jackson.SpringAIJacksonStateSerializer;
 import com.alibaba.cloud.ai.graph.state.strategy.ReplaceStrategy;
 import com.fasterxml.jackson.databind.ObjectMapper;
 
+import java.io.ByteArrayOutputStream;
+import java.io.ObjectOutputStream;
+import java.nio.charset.StandardCharsets;
 import java.util.ArrayList;
+import java.util.Base64;
 import java.util.HashMap;
 import java.util.List;
 import java.util.Map;
@@ -50,6 +56,7 @@
 import org.junit.jupiter.api.condition.EnabledIf;
 import org.redisson.Redisson;
 import org.redisson.api.RedissonClient;
+import org.redisson.client.codec.ByteArrayCodec;
 import org.redisson.config.Config;
 import org.springframework.ai.chat.messages.AssistantMessage;
 import org.springframework.ai.chat.messages.Message;
@@ -868,4 +875,63 @@ void testConcurrentAccessWithLocks() throws Exception {
 		executorService.shutdown();
 		executorService.awaitTermination(5, TimeUnit.SECONDS);
 	}
+
+	@Test
+	void testReadsAndMigratesLegacyBase64Payload() throws Exception {
+		String threadName = "test-legacy-migration-" + UUID.randomUUID();
+		String storedThreadId = UUID.randomUUID().toString();
+		RunnableConfig config = RunnableConfig.builder().threadId(threadName).build();
+		String contentKey = "graph:checkpoint:content:" + storedThreadId;
+
+		redisson.<String, String>getMap("graph:thread:meta:" + threadName).put("thread_id", storedThreadId);
+		redisson.<String, String>getMap("graph:thread:meta:" + threadName).put("is_released", "false");
+
+		Checkpoint legacyCheckpoint = Checkpoint.builder()
+				.id("legacy")
+				.state(Map.of("content", "repetitive checkpoint content ".repeat(4096)))
+				.nodeId("node1")
+				.nextNodeId("node2")
+				.build();
+		String legacyPayload = serializeLegacyCheckpoints(List.of(legacyCheckpoint));
+		redisson.<String>getBucket(contentKey).set(legacyPayload);
+
+		List<Checkpoint> legacyResult = (List<Checkpoint>) redisSaver.list(config);
+		assertEquals(1, legacyResult.size());
+		assertEquals("legacy", legacyResult.get(0).getId());
+
+		Checkpoint currentCheckpoint = Checkpoint.builder()
+				.id("current")
+				.state(Map.of("content", "repetitive checkpoint content ".repeat(4096)))
+				.nodeId("node2")
+				.nextNodeId("node3")
+				.build();
+		redisSaver.put(config, currentCheckpoint);
+
+		byte[] migratedPayload = redisson.<byte[]>getBucket(contentKey, ByteArrayCodec.INSTANCE).get();
+		assertNotNull(migratedPayload);
+		assertEquals('S', migratedPayload[0]);
+		assertEquals('A', migratedPayload[1]);
+		assertEquals('A', migratedPayload[2]);
+		assertEquals('C', migratedPayload[3]);
+		assertEquals(1, migratedPayload[4]);
+		assertTrue(migratedPayload.length < legacyPayload.getBytes(StandardCharsets.UTF_8).length);
+
+		List<Checkpoint> migratedResult = (List<Checkpoint>) redisSaver.list(config);
+		assertEquals(2, migratedResult.size());
+		assertTrue(migratedResult.stream().anyMatch(checkpoint -> "legacy".equals(checkpoint.getId())));
+		assertTrue(migratedResult.stream().anyMatch(checkpoint -> "current".equals(checkpoint.getId())));
+	}
+
+	private static String serializeLegacyCheckpoints(List<Checkpoint> checkpoints) throws Exception {
+		Serializer<Checkpoint> checkpointSerializer = new CheckPointSerializer(serializer);
+		try (ByteArrayOutputStream output = new ByteArrayOutputStream();
+			 ObjectOutputStream objectOutput = new ObjectOutputStream(output)) {
+			objectOutput.writeInt(checkpoints.size());
+			for (Checkpoint checkpoint : checkpoints) {
+				checkpointSerializer.write(checkpoint, objectOutput);
+			}
+			objectOutput.flush();
+			return Base64.getEncoder().encodeToString(output.toByteArray());
+		}
+	}
 }
```

---

### Incident Patch 15: `1a7ff512` (2026-08-06)
**Commit Message**: fix(graph): remove unused MCP dependency (#4879)

**File**: `spring-ai-alibaba-graph-core/pom.xml` (modified, +0/-5)
```diff
@@ -188,11 +188,6 @@
             <optional>true</optional>
         </dependency>
 
-        <dependency>
-            <groupId>io.modelcontextprotocol.sdk</groupId>
-            <artifactId>mcp</artifactId>
-        </dependency>
-
         <dependency>
             <groupId>io.opentelemetry</groupId>
             <artifactId>opentelemetry-api</artifactId>
```

#### Recent Merged Pull Requests:
- **PR #4940** (closed): fix(agent): resolve skill tools after HITL resume (@dangzitou)
- **PR #4938** (closed): fix(agent): use object schemas for filesystem tools (@logicwu0)
- **PR #4933** (closed): fix(admin): add missing ThreadPoolExecutor import in RequestContextThreadPoolWrapper (@GerardGao)
- **PR #4930** (closed): fix(agent): pass groupedTools map to interceptor even when initially empty (@ikaitist)
- **PR #4926** (2026-08-25): test(graph): pin List<byte[]> element types across serializer round-trip (@zeng-bohan)
- **PR #4925** (2026-08-25): fix(graph): preserve streaming node id in error callbacks (@aravelo7)
- **PR #4922** (2026-08-24): feat(agent): support Supplier-based grouped tools for dynamic skill registries (@ikaitist)
- **PR #4918** (2026-08-24): test(graph): migrate AssignerNodeTest to JUnit 5 so its tests actually run (@GerardGao)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
