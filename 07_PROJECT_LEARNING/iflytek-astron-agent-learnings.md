# Forensic Learning Record (Deep Inspection): iflytek/astron-agent

> **Canonical Artifact**: `07_PROJECT_LEARNING/iflytek-astron-agent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/iflytek/astron-agent](https://github.com/iflytek/astron-agent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:56:00.756Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `iflytek/astron-agent`
- **Description**: Enterprise-grade, commercial-friendly agentic workflow platform for building next-generation SuperAgents.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 8873 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `console/frontend/src/components/markdown-render/custom-footnote-plugin.ts`
```
import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Text, Element, Parent } from 'hast';

/**
 * 自定义脚注的 Rehype 插件 (适用于 react-markdown)
 * 匹配格式: [^1^] 或 [^12^] (最多支持2位数)
 * 转换为: <span class="custom-footnote" data-index="1">1</span>
 */

interface FootnoteElement extends Element {
  type: 'element';
  tagName: 'span';
  properties: {
    className: string[];
    dataIndex: string;
  };
  children: Text[];
}

/**
 * 创建脚注 span 元素
 */
function createFootnoteElement(number: string): FootnoteElement {
  return {
    type: 'element',
    tagName: 'span',
    properties: {
      className: ['custom-footnote'],
      dataIndex: number,
    },
    children: [
      {
        type: 'text',
        value: number,
      },
    ],
  };
}

/**
 * 自定义脚注插件 - 作为 rehype 插件使用
 */
const customFootnotePlugin: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(
      tree,
      'text',
      (node: Text, index: number | undefined, parent: Parent | undefined) => {
        if (!parent || typeof index === 'undefined') return;

        const text = node.value;
        const footnoteRegex = /\[\^(\d{1,2})\^\]/g;

        // 检查是否包含脚注格式
        if (!footnoteRegex.test(text)) return;

        // 重置正则表达式状态
        footnoteRegex.lastIndex = 0;

        const newChildren: (Text | FootnoteElement)[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        // 处理所有匹配的脚注
        while ((match = footnoteRegex.exec(text)) !== null) {
          const matchStart = match.index;
          const matchEnd = matchStart + match[0].length;
          const footnoteNumber = match[1];

          // 添加脚注前的文本
          if (matchStart > lastIndex) {
            const beforeText = text.slice(lastIndex, matchStart);
            if (beforeText) {
              newChildren.push({
                type: 'text',
                value: beforeText,
              });
            }
          }

          // 创建脚注元素（确保 footnoteNumber 存在）
          if (footnoteNumber) {
            newChildren.push(createFootnoteElement(footnoteNumber));
          }

          lastIndex = matchEnd;
        }

        // 添加剩余文本
        if (lastIndex < text.length) {
          const remainingText = text.slice(lastIndex);
          if (remainingText) {
            newChildren.push({
              type: 'text',
              value: remainingText,
            });
          }
        }

        // 替换原文本节点
        if (newChildren.length > 0) {
          parent.children.splice(index, 1, ...newChildren);
        }
      }
    );
  };
};

export default customFootnotePlugin;

```

### Core Architecture Module: `console/frontend/src/components/markdown-render/index.tsx`
```
import React, { useEffect } from 'react';
import ReactMarkdown, { ExtraProps } from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { v4 as uuid } from 'uuid';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { github } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import customFootnotePlugin from './custom-footnote-plugin';
import {
  markdownKatexOptions,
  markdownSanitizePlugin,
} from '../markdown-sanitize';
import 'katex/dist/katex.min.css';

function index({
  content = '',
  isSending = false,
}: {
  content: string;
  isSending: boolean;
}): React.ReactElement {
  const globalMarkdownId = uuid();

  function addCursorToLastElement(): void {
    // 清除之前的光标类
    const container = document.getElementById(globalMarkdownId);
    const mdContainer = container?.querySelector('.global-markdown');
    if (!mdContainer) {
      return;
    }
    const previousCursor = mdContainer.querySelector(
      '.global-markdown-flashing-cursor'
    );
    if (previousCursor) {
      previousCursor.classList.remove('global-markdown-flashing-cursor');
    }

    // 获取最后一个子元素
    const lastElement = getLastDeepestChild(mdContainer);

    if (lastElement) {
      lastElement.classList.add('global-markdown-flashing-cursor');
    }
  }

  function getLastDeepestChild(element: Element): Element {
    while (element?.lastElementChild) {
      element = element?.lastElementChild;
      if (element?.textContent?.trim()) {
        return element;
      }
    }
    return element;
  }

  function clearCursorToLastElement(): void {
    const container = document.getElementById(globalMarkdownId);
    const previousCursor = container?.querySelectorAll(
      '.global-markdown-flashing-cursor'
    );
    if (previousCursor) {
      Array.from(previousCursor).forEach(function (element) {
        element.classList.remove('global-markdown-flashing-cursor');
      });
    }
  }

  useEffect(() => {
    if (isSending) {
      addCursorToLastElement();
    } else {
      clearCursorToLastElement();
    }
  }, [content, isSending]);

  const MyLink = ({
    node,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> &
    ExtraProps): React.ReactNode => (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {props.children}
    </a>
  );

  const ImageRenderer = ({
    node,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> &
    ExtraProps): React.ReactNode => {
    return <img {...props} style={{ ...props.style, maxWidth: '100%' }} />;
  };

  return (
    <div
      id={globalMarkdownId}
      className="flex items-center justify-center markdown-body"
    >
      <ReactMarkdown
        skipHtml={false}
        className="global-markdown"
        remarkPlugins={[remarkMath, [remarkGfm, { singleTilde: false }]]}
        rehypePlugins={[
          rehypeRaw,
          markdownSanitizePlugin,
          [rehypeKatex, markdownKatexOptions],
          customFootnotePlugin,
        ]}
        components={{
          a: MyLink,
          img: ImageRenderer,
          code(props) {
            const { children, className, node, ...rest } = props;

            const match = /language-(\w+)/.exec(className || '');
            return match && children ? (
              <SyntaxHighlighter
                {...rest}
                PreTag="div"
                children={String(children)}
                language={match[1]}
                style={github}
              />
            ) : (
              <code {...rest} className={className}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default index;

```

### Core Architecture Module: `console/frontend/src/components/modal/more-icons/hooks/use-more-icons.ts`
```
import { avatarImageGenerate } from '@/services/common';
import { AvatarType } from '@/types/resource';
import { message, UploadFile } from 'antd';
import { UploadChangeParam, UploadProps } from 'antd/es/upload';
import React, { useEffect, useMemo, useState } from 'react';

export const useMoreIcons = ({
  botColor,
  botIcon,
  icons,
  colors,
  setBotIcon,
  setBotColor,
  setShowModal,
}: {
  botColor: string;
  botIcon: {
    value?: string;
    name?: string;
    code?: string;
  };
  icons: { value?: string; name?: string; code?: string }[];
  colors: AvatarType[];
  setBotIcon: (icon: { value?: string; name?: string; code?: string }) => void;
  setBotColor: (color: string) => void;
  setShowModal: (show: boolean) => void;
}): {
  checkEnableSave: boolean;
  handleOk: () => void;
  beforeUpload: (file: UploadFile) => boolean;
  generateImage: () => void;
  previewIcon: {
    value?: string;
    name?: string;
    code?: string;
  };
  previewColor: string;
  activeTab: string | undefined;
  hoverTab: string | undefined;
  uploadImageObject: {
    downloadLink: string;
    s3Key: string;
  };
  generateImageDescription: string;
  generateImageObject: {
    downloadLink: string;
    s3Key: string;
  };
  loading: boolean;
  uploadProps: UploadProps;
  setActiveTab: React.Dispatch<React.SetStateAction<string | undefined>>;
  setHoverTab: React.Dispatch<React.SetStateAction<string | undefined>>;
  setGenerateImageDescription: React.Dispatch<React.SetStateAction<string>>;
  setUploadImageObject: (object: {
    downloadLink: string;
    s3Key: string;
  }) => void;
  setGenerateImageObject: React.Dispatch<
    React.SetStateAction<{
      downloadLink: string;
      s3Key: string;
    }>
  >;
  setLoading: (loading: boolean) => void;
  setPreviewIcon: React.Dispatch<
    React.SetStateAction<{
      value?: string;
      name?: string;
      code?: string;
    }>
  >;
  setPreviewColor: React.Dispatch<React.SetStateAction<string>>;
} => {
  const [previewIcon, setPreviewIcon] = useState<{
    value?: string;
    name?: string;
    code?: string;
  }>({});
  const [previewColor, setPreviewColor] = useState('');
  const [activeTab, setActiveTab] = useState<string | undefined>('gallery');
  const [hoverTab, setHoverTab] = useState<string | undefined>('');
  const [uploadImageObject, setUploadImageObject] = useState({
    downloadLink: '',
    s3Key: '',
  });
  const [generateImageDescription, setGenerateImageDescription] = useState('');
  const [generateImageObject, setGenerateImageObject] = useState({
    downloadLink: '',
    s3Key: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (botColor) {
      setPreviewIcon({ ...botIcon });
      setPreviewColor(botColor);
    } else {
      setPreviewIcon(icons[0] || {});
      setPreviewColor(colors[0]?.name || '');
    }
  }, []);

  function generateImage(): void {
    if (loading) return;
    if (!generateImageDescription?.trim()) {
      message.error('描述不能为空！');
      return;
    }
    setLoading(true);
    avatarImageGenerate(generateImageDescription)
      .then(data => {
        setGenerateImageObject(data as { downloadLink: string; s3Key: string });
      })
      .finally(() => setLoading(false));
  }

  function handleOk(): void {
    if (activeTab === 'gallery') {
      setBotIcon(previewIcon as { value: string; name: string; code: string });
      setBotColor(previewColor);
    } else if (activeTab === 'upload') {
      setBotIcon({ ...botIcon, value: uploadImageObject.downloadLink });
      setBotColor('');
    } else {
      setBotIcon({ ...botIcon, value: generateImageObject.downloadLink });
      setBotColor('');
    }

    setShowModal(false);
  }

  function beforeUpload(file: UploadFile): boolean {
    const maxSize = 2 * 1024 * 1024;
    if ((file?.size || 0) > maxSize) {
      message.error('上传文件大小不能超出2M！');
      return false;
    }
    const isJpgOrPng = [
      'jpg',
      'jpeg',
      'png',
      'gif',
      'webp',
      'bmp',
      'tiff',
    ].includes(file.type?.split('/').pop() || '');
    if (!isJpgOrPng) {
      message.error('请上传JPG和PNG等格式的图片文件');
      return false;
    } else {
      return true;
    }
  }

  const uploadProps = {
    name: 'file',
    action: '/image/upload',
    showUploadList: false,
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    },
    accept: '.png,.jpg,.jpeg,.gif,.webp,.bmp,.tiff',
    beforeUpload,
    onChange: (info: UploadChangeParam<UploadFile>): void => {
      if (info.file.status === 'done') {
        if (
          info.file.response &&
          info.file.response.data &&
          info.file.response.code === 0
        ) {
          const data = info.file.response.data;
          setUploadImageObject(data as { downloadLink: string; s3Key: string });
        } else {
          message.error(info.file.response?.message || '');
        }
      }
    },
  };

  const checkEnableSave = useMemo(() => {
    return (
      (activeTab === 'upload' && !uploadImageObject.downloadLink) ||
      (activeTab === 'chat' && !generateImageObject.downloadLink)
    );
  }, [activeTab, uploadImageObject, generateImageObject]);
  return {
    checkEnableSave,
    handleOk,
    beforeUpload,
    generateImage,
    previewIcon,
    previewColor,
    activeTab,
    hoverTab,
    uploadImageObject,
    generateImageDescription,
    generateImageObject,
    loading,
    uploadProps,
    setActiveTab,
    setHoverTab,
    setGenerateImageDescription,
    setUploadImageObject,
    setGenerateImageObject,
    setLoading,
    setPreviewIcon,
    setPreviewColor,
  };
};

```

### Core Architecture Module: `console/frontend/src/components/modal/plugin/hooks/use-create-tool.tsx`
```
import { AvatarType, RecurseData, ToolItem } from '@/types/resource';
import { useImperativeHandle, useRef } from 'react';
import { Form, FormInstance, message } from 'antd';
import React, { useState } from 'react';
import { InputParamsData } from '@/types/resource';
import { useMemoizedFn } from 'ahooks';
import { v4 as uuid } from 'uuid';
import { useEffect } from 'react';
import { useCallback } from 'react';
import globalStore from '@/store/global-store';
import { cloneDeep } from 'lodash';
import { useTranslation } from 'react-i18next';
import {
  createTool,
  debugTool,
  temporaryTool,
  updateTool,
} from '@/services/plugin';
export interface BaseFormData {
  name?: string;
  description?: string;
  endPoint?: string;
  authType?: number;
  method?: string;
  visibility?: number;
  creationMethod?: number;
  location?: string;
  parameterName?: string;
  serviceToken?: string;
}
export interface ParamsFormData {
  creationMethod?: number;
}
// 表单管理相关 Hook
const useFormManagement = (): {
  baseForm: FormInstance<BaseFormData>;
  paramsForm: FormInstance<ParamsFormData>;
  baseFormData: BaseFormData;
  setBaseFormData: React.Dispatch<React.SetStateAction<BaseFormData>>;
  resetBaseForms: () => void;
} => {
  const [baseForm] = Form.useForm();
  const [paramsForm] = Form.useForm();
  const [baseFormData, setBaseFormData] = useState<BaseFormData>({});

  const resetBaseForms = useCallback(() => {
    baseForm.resetFields();
    baseForm.setFieldsValue({
      authType: 1,
      visibility: 0,
      location: 'header',
    });
    paramsForm.setFieldsValue({
      creationMethod: 1,
    });
  }, [baseForm, paramsForm]);

  return {
    baseForm,
    paramsForm,
    baseFormData,
    setBaseFormData,
    resetBaseForms,
  };
};

// 状态管理相关 Hook
const useToolStates = (): {
  authType: number;
  setAuthType: React.Dispatch<React.SetStateAction<number>>;
  name: string;
  setName: React.Dispatch<React.SetStateAction<string>>;
  desc: string;
  setDesc: React.Dispatch<React.SetStateAction<string>>;
  inputParamsData: InputParamsData[];
  setInputParamsData: React.Dispatch<React.SetStateAction<InputParamsData[]>>;
  outputParamsData: InputParamsData[];
  setOutputParamsData: React.Dispatch<React.SetStateAction<InputParamsData[]>>;
  debuggerParamsData: InputParamsData[];
  setDebuggerParamsData: React.Dispatch<
    React.SetStateAction<InputParamsData[]>
  >;
  debuggerJsonData: string;
  setDebuggerJsonData: React.Dispatch<React.SetStateAction<string>>;
  canPublish: boolean;
  setCanPublish: React.Dispatch<React.SetStateAction<boolean>>;
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  debugLoading: boolean;
  setDebugLoading: React.Dispatch<React.SetStateAction<boolean>>;
  publishLoading: boolean;
  setPublishLoading: React.Dispatch<React.SetStateAction<boolean>>;
  currentToolStatus: number;
  setCurrentToolStatus: React.Dispatch<React.SetStateAction<number>>;
  temporaryStorageToolId: number | string | null;
  setTemporaryStorageToolId: React.Dispatch<
    React.SetStateAction<number | string | null>
  >;
  resetStates: () => void;
} => {
  const [authType, setAuthType] = useState(1);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [inputParamsData, setInputParamsData] = useState<InputParamsData[]>([]);
  const [outputParamsData, setOutputParamsData] = useState<InputParamsData[]>(
    []
  );
  const [debuggerParamsData, setDebuggerParamsData] = useState<
    InputParamsData[]
  >([]);
  const [debuggerJsonData, setDebuggerJsonData] = useState('');
  const [canPublish, setCanPublish] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [debugLoading, setDebugLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [currentToolStatus, setCurrentToolStatus] = useState(0);
  const [temporaryStorageToolId, setTemporaryStorageToolId] = useState<
    number | string | null
  >(null);

  const resetStates = useCallback(() => {
    setName('');
    setDesc('');
    setInputParamsData([]);
    setOutputParamsData([]);
    setDebuggerParamsData([]);
    setAuthType(1);
    setDebuggerJsonData('');
  }, []);

  return {
    authType,
    setAuthType,
    name,
    setName,
    desc,
    setDesc,
    inputParamsData,
    setInputParamsData,
    outputParamsData,
    setOutputParamsData,
    debuggerParamsData,
    setDebuggerParamsData,
    debuggerJsonData,
    setDebuggerJsonData,
    canPublish,
    setCanPublish,
    showModal,
    setShowModal,
    debugLoading,
    setDebugLoading,
    publishLoading,
    setPublishLoading,
    currentToolStatus,
    setCurrentToolStatus,
    temporaryStorageToolId,
    setTemporaryStorageToolId,
    resetStates,
  };
};

// 数据转换相关 Hook
const useDataTransform = (): {
  addTestProperty: (obj: InputParamsData) => void;
  transformInputDataToDefaultParamsData: (
    node: InputParamsData
  ) => InputParamsData;
  parmasTableSetDefault: (data: InputParamsData[]) => InputParamsData[];
} => {
  const addTestProperty = useCallback((obj: InputParamsData) => {
    obj.subChild = obj?.children?.[0] as InputParamsData;
    obj.id = uuid();

    if (obj.children && Array.isArray(obj.children)) {
      obj.children.forEach(child => addTestProperty(child));
    }
  }, []);

  const transformInputDataToDefaultParamsData = useCallback(
    (node: InputParamsData) => {
      function recurse(
        node: InputParamsData,
        defaultVal: RecurseData | undefined,
        parentId: string
      ): void {
        node.id = parentId ? `${parentId}-${uuid()}` : uuid();
        if (node.type === 'object') {
          (node.children || []).forEach(child => {
            recurse(
              child,
              defaultVal ? defaultVal[child.name] : undefined,
              node.id
            );
          });
        } else if (node.type === 'array') {
          const arrayDefault = (
            Array.isArray(defaultVal) ? defaultVal : []
          ) as InputParamsData[];

          node.children = arrayDefault.map((defaultItem, index) => {
            const newChild = {
              ...cloneDeep(node.children?.[0]),
              default: defaultItem,
              id: `${node.id}-${index}`,
            };

            recurse(
              newChild as InputParamsData,
              defaultItem as RecurseData,
              newChild.id
            );

            return newChild;
          }) as InputParamsData[];
        } else {
          node.default = defaultVal !== undefined ? defaultVal : node.default;
        }
      }

      recurse(node as InputParamsData, node.default as RecurseData, node.id);
      return node;
    },
    []
  );

  const parmasTableSetDefault = useCallback(
    (data: InputParamsData[]) => {
      function transformData(node: InputParamsData): InputParamsData {
        if (node?.children && node?.children?.length > 0) {
          node.children = node?.children?.map(node => transformData(node));
        }
        if (
          node?.type === 'array' &&
          Array.isArray(node?.default) &&
          node?.default?.length > 0
        ) {
          addTestProperty(node);
          const newNode = transformInputDataToDefaultParamsData(node);
          return newNode;
        } else {
          return node;
        }
      }

      return data?.map(node => transformData(node));
    },
    [addTestProperty, transformInputDataToDefaultParamsData]
  );

  return {
    addTestProperty,
    transformInputDataToDefaultParamsData,
    parmasTableSetDefault,
  };
};

// 参数验证相关 Hook
const useParamsValidation = (): {
  checkNameConventions: (string: string) => boolean;
  findNodeById: (tree: InputParamsData[], id: string) => InputParamsData | null;
  checkParmas: (params: InputParamsData[], id: string, key: string) => boolean;
  validateTransformedData: (data: InputParamsData[]) => {
    validatedData: InputParamsData[];
    flag: boolean;
  };
  validateDebuggerTransformedData: (data: InputParamsData[]) => {
    validatedData: InputParamsData[];
    flag: boolean;
  };
} => {
  const { t } = useTranslation();

  const checkNameConventions = (string: string): boolean => {
    const regex = /^[a-zA-Z0-9_-]+$/;
    return regex.test(string);
  };

  const findNodeById = useCallback(
    (tree: InputParamsData[], id: string): InputParamsData | null => {
      for (const node of tree) {
        if (node.id === id) {
          return node;
        }
        if (node.children && node.children.length > 0) {
          const result = findNodeById(node.children, id);
          if (result) {
            return result;
          }
        }
      }
      return null;
    },
    []
  );

  const checkParmas = useCallback(
    (params: InputParamsData[], id: string, key: string) => {
      let passFlag = true;
      const errEsg =
        key === 'name'
          ? t('plugin.pleaseEnterParameterName')
          : t('plugin.pleaseEnterParameterDescription');
      const currentNode = findNodeById(params, id) || ({} as InputParamsData);
      if (!currentNode[key]) {
        currentNode[`${key}ErrMsg`] = errEsg;
        passFlag = false;
      } else if (
        key === 'name' &&
        currentNode.fatherType !== 'array' &&
        !checkNameConventions(currentNode[key])
      ) {
        currentNode.nameErrMsg = t('common.onlyLettersNumbersDashUnderscore');
      } else {
        currentNode[`${key}ErrMsg`] = '';
      }
      return passFlag;
    },
    [t]
  );

  const validateTransformedData = (
    data: InputParamsData[]
  ): { validatedData: InputParamsData[]; flag: boolean } => {
    let flag = true;

    const validate = (items: InputParamsData[]): InputParamsData[] => {
      const nameCount: Record<string, number> = {};
      const newItems = items.map((item, index) => {
        if (!item?.name?.trim()) {
          item.nameErrMsg = t('common.valueCannotBeEmpty');
          flag = false;
        } else if (
          item.fatherTyp
```

### Core Architecture Module: `console/frontend/src/components/modal/plugin/hooks/use-tool-debugger.ts`
```
import { debugTool } from '@/services/plugin';
import { InputParamsData, ToolItem } from '@/types/resource';
import { isJSON } from '@/utils/utils';
import { message } from 'antd';
import { cloneDeep } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
interface BaseFormData {
  name?: string;
  description?: string;
  endPoint?: string;
  authType?: number;
  method?: string;
  visibility?: number;
  creationMethod?: number;
  location?: string;
  parameterName?: string;
  serviceToken?: string;
}
export const useToolDebugger = ({
  currentToolInfo,
  offical = false,
  selectedCard = {} as ToolItem,
}: {
  currentToolInfo: ToolItem;
  offical: boolean;
  selectedCard: ToolItem;
}): {
  handleDebuggerTool: () => void;
  debuggerJsonData: string;
  debugLoading: boolean;
  debuggerParamsData: InputParamsData[];
  setDebuggerParamsData: React.Dispatch<
    React.SetStateAction<InputParamsData[]>
  >;
} => {
  const { t } = useTranslation();
  const [baseFormData, setBaseFormData] = useState<BaseFormData>({});
  const [outputParamsData, setOutputParamsData] = useState<InputParamsData[]>(
    []
  );
  const [debuggerParamsData, setDebuggerParamsData] = useState<
    InputParamsData[]
  >([]);
  const [debuggerJsonData, setDebuggerJsonData] = useState('');
  const [debugLoading, setDebugLoading] = useState(false);

  const currentToolId = currentToolInfo?.id;

  const handleResetFormData = (data: ToolItem): void => {
    let baseFormParams: BaseFormData = {
      name: data?.name,
      description: data?.description,
      endPoint: data?.endPoint,
      authType: data?.authType,
      method: data?.method,
      visibility: data?.visibility,
      creationMethod: data?.creationMethod,
    };
    if (baseFormParams?.authType === 2) {
      const authInfo = JSON.parse(data?.authInfo || '{}');
      baseFormParams = {
        ...baseFormParams,
        location: authInfo?.location,
        parameterName: authInfo?.parameterName,
        serviceToken: authInfo?.serviceToken,
      };
    }
    setOutputParamsData(data?.toolRequestOutput || []);
    setDebuggerParamsData(data?.toolRequestInput || []);
    setBaseFormData(baseFormParams);
  };

  useEffect(() => {
    if (selectedCard?.id) {
      const paramsData = isJSON(selectedCard?.webSchema || '')
        ? JSON.parse(selectedCard?.webSchema || '{}')
        : {};
      handleResetFormData({
        ...selectedCard,
        toolRequestInput: paramsData?.toolRequestInput as InputParamsData[],
        toolRequestOutput: paramsData?.toolRequestOutput as InputParamsData[],
      });
    } else if (currentToolInfo?.id) {
      const paramsData = isJSON(currentToolInfo?.webSchema)
        ? JSON.parse(currentToolInfo?.webSchema)
        : {};
      handleResetFormData({
        ...currentToolInfo,
        toolRequestInput: paramsData?.toolRequestInput,
        toolRequestOutput: paramsData?.toolRequestOutput,
      });
    }
  }, [
    offical,
    currentToolInfo,
    setOutputParamsData,
    setDebuggerParamsData,
    selectedCard?.id,
  ]);

  const validateDebuggerTransformedData = (
    data: InputParamsData[]
  ): { validatedData: InputParamsData[]; flag: boolean } => {
    let flag = true;
    const validate = (items: InputParamsData[]): InputParamsData[] => {
      const newItems = items.map((item, index) => {
        // 校验当前项的 name 字段是否为空
        if (item?.type !== 'object' && item?.type !== 'array') {
          if (
            item?.required &&
            item?.type === 'string' &&
            !(item?.default as string)?.trim()
          ) {
            item.defaultErrMsg = t('common.valueCannotBeEmpty');
            flag = false;
          } else {
            item.defaultErrMsg = '';
          }
        }
        return item;
      });

      return newItems?.map(item => {
        if (Array.isArray(item.children)) {
          item.children = validate(item.children);
        }
        return item;
      });
    };

    const validatedData = validate(data);
    return { validatedData, flag };
  };

  const checkDebuggerParmasTable = useCallback(() => {
    const { validatedData, flag } =
      validateDebuggerTransformedData(debuggerParamsData);
    setDebuggerParamsData(cloneDeep(validatedData));
    return flag;
  }, [debuggerParamsData, setDebuggerParamsData]);

  const handleDebuggerTool = useCallback(() => {
    const flag = checkDebuggerParmasTable();
    if (!flag) {
      message.warning(t('plugin.requiredParameterNotFilled'));
      return;
    }
    setDebugLoading(true);
    const params = {
      id: currentToolId,
      name: baseFormData?.name || '',
      description: baseFormData?.description || '',
      endPoint: baseFormData?.endPoint || '',
      authType: baseFormData?.authType || 0,
      method: baseFormData?.method || '',
      // visibility: baseFormData?.visibility || 0,
      creationMethod: 1,
      webSchema: JSON.stringify({
        toolRequestInput: debuggerParamsData,
        toolRequestOutput: outputParamsData,
      }),
    } as ToolItem;
    if (baseFormData?.authType === 2) {
      params.authInfo = JSON.stringify({
        location: baseFormData.location,
        parameterName: baseFormData.parameterName,
        serviceToken: baseFormData.serviceToken,
      });
    }
    debugTool(params)
      .then(result => {
        setDebuggerJsonData(JSON.stringify(result, null, 2));
        message.success(result?.message || t('operationSuccessful'));
      })
      .catch(error => {
        setDebuggerJsonData(
          JSON.stringify(
            {
              code: error?.code,
              message: error?.message,
            },
            null,
            2
          )
        );
        message.error(error?.message);
      })
      .finally(() => setDebugLoading(false));
  }, [debuggerParamsData, outputParamsData, baseFormData]);

  return {
    handleDebuggerTool,
    debuggerJsonData,
    debugLoading,
    debuggerParamsData,
    setDebuggerParamsData,
  };
};

```

### Core Architecture Module: `console/frontend/src/components/modal/workflow/array-default/hooks/use-array-default.tsx`
```
import { InputParamsData, RecurseData } from '@/types/resource';
import React, { useCallback, useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { cloneDeep } from 'lodash';
import { message } from 'antd';
import expand from '@/assets/imgs/plugin/icon_fold.png';
import shrink from '@/assets/imgs/plugin/icon_shrink.png';

const useTreeOperations = (): {
  updateIds: (obj: InputParamsData) => InputParamsData;
  findNodeById: (tree: InputParamsData[], id: string) => InputParamsData | null;
  deleteNodeFromTree: (
    tree: InputParamsData[],
    id: string
  ) => InputParamsData[];
  addTestProperty: (dataArray: InputParamsData[]) => void;
} => {
  const updateIds = useCallback((obj: InputParamsData) => {
    const newObj = { ...obj, id: uuid() };

    if (newObj.children && Array.isArray(newObj.children)) {
      newObj.children = newObj.children.map(child => updateIds(child));
    }

    return newObj;
  }, []);

  const findNodeById = (
    tree: InputParamsData[],
    id: string
  ): InputParamsData | null => {
    for (const node of tree) {
      if (node.id === id) {
        return node;
      }

      if (node.children && node.children.length > 0) {
        const result = findNodeById(node.children, id);
        if (result) {
          return result;
        }
      }
    }

    return null;
  };

  const deleteNodeFromTree = useCallback(
    (tree: InputParamsData[], id: string) => {
      return tree.reduce((acc, node) => {
        if (node.id === id) {
          return acc;
        }

        if (node.children) {
          node.children = deleteNodeFromTree(node.children, id);
        }

        acc.push(node);
        return acc;
      }, [] as InputParamsData[]);
    },
    []
  );

  function addTestProperty(dataArray: InputParamsData[]): void {
    function addTest(obj: InputParamsData): void {
      obj.subChild = obj?.children?.[0] as InputParamsData;
      obj.id = uuid();

      if (obj.children && Array.isArray(obj.children)) {
        obj.children.forEach(child => addTest(child));
      }
    }

    dataArray.forEach(item => addTest(item));
  }

  return {
    updateIds,
    findNodeById,
    deleteNodeFromTree,
    addTestProperty,
  };
};

const useExpandOperations = (): {
  expandedRowKeys: string[];
  setExpandedRowKeys: React.Dispatch<React.SetStateAction<string[]>>;
  handleExpand: (record: InputParamsData) => void;
  handleCollapse: (record: InputParamsData) => void;
  customExpandIcon: (params: {
    expanded: boolean;
    record: InputParamsData;
  }) => React.ReactNode;
} => {
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

  const handleExpand = useCallback((record: InputParamsData) => {
    setExpandedRowKeys(expandedRowKeys => [...expandedRowKeys, record.id]);
  }, []);

  const handleCollapse = useCallback((record: InputParamsData) => {
    setExpandedRowKeys(expandedRowKeys =>
      expandedRowKeys.filter(id => id !== record.id)
    );
  }, []);

  const customExpandIcon = useCallback(
    ({ expanded, record }: { expanded: boolean; record: InputParamsData }) => {
      if (record.children) {
        return expanded ? (
          <img
            src={shrink}
            className="inline-block w-4 h-4 mb-1 mr-1"
            onClick={e => {
              e.stopPropagation();
              handleCollapse(record);
            }}
          />
        ) : (
          <img
            src={expand}
            className="inline-block w-4 h-4 mb-1 mr-1"
            onClick={e => {
              e.stopPropagation();
              handleExpand(record);
            }}
          />
        );
      }
      return null;
    },
    []
  );

  return {
    expandedRowKeys,
    setExpandedRowKeys,
    handleExpand,
    handleCollapse,
    customExpandIcon,
  };
};

const useDataTransform = (): {
  transformInputDataToDefaultParamsData: (
    data: InputParamsData[]
  ) => InputParamsData[];
  applyDefaults: (
    child: InputParamsData,
    defaultValue: RecurseData
  ) => InputParamsData;
  transformDefaultParamsDataToDefaultData: (
    data: InputParamsData[]
  ) => InputParamsData[];
} => {
  const transformInputDataToDefaultParamsData = useCallback(
    (data: InputParamsData[]) => {
      // 递归函数：处理嵌套的对象和数组
      function recurse(
        node: InputParamsData,
        defaultVal: RecurseData | undefined,
        parentId: string
      ): void {
        node.id = parentId ? `${parentId}-${uuid()}` : uuid();
        if (node.type === 'object') {
          (node.children || []).forEach(child => {
            const childDefaultValue =
              defaultVal && typeof defaultVal === 'object'
                ? defaultVal[child.name]
                : undefined;
            recurse(child, childDefaultValue, node.id);
          });
        } else if (node.type === 'array') {
          const arrayDefault = Array.isArray(defaultVal) ? defaultVal : [];

          if (arrayDefault.length > 0) {
            // If there are saved default values, create children based on saved data
            const template = node.children?.[0] || node.subChild;
            if (template) {
              node.children = arrayDefault.map((savedValue, index) => {
                const newChild = cloneDeep(template);
                newChild.id = `${node.id}-${uuid()}`; // Ensure unique ID
                newChild.default = savedValue;
                recurse(newChild, savedValue, node.id);
                return newChild;
              });
            }
          } else if (node.children) {
            // If no saved values but has template children, keep original logic
            node.children = node.children.map((childNode, index) => {
              childNode.default = arrayDefault[index];
              recurse(childNode, arrayDefault[index], node.id);
              return childNode;
            });
          }
        } else {
          // For basic types, directly set default value
          node.default = defaultVal !== undefined ? defaultVal : node.default;
        }
      }

      data.forEach(node => {
        recurse(node, node.default as RecurseData, node.id);
      });

      return data;
    },
    []
  );

  const applyDefaults = useCallback(
    (child: InputParamsData, defaultValue: RecurseData) => {
      const newChild = { ...child };

      if (
        Array.isArray(defaultValue) &&
        newChild.type === 'array' &&
        newChild.children
      ) {
        newChild.children = defaultValue.map((value, i) => {
          const childTemplate = newChild.children?.[0]
            ? { ...newChild.children[0] }
            : ({} as InputParamsData);
          return applyDefaults(childTemplate, value);
        });
      } else if (typeof defaultValue !== 'undefined') {
        newChild.default = defaultValue;
      }

      return newChild;
    },
    []
  );

  const transformDefaultParamsDataToDefaultData = useCallback(
    (data: InputParamsData[]) => {
      function recurse(
        node: InputParamsData
      ): InputParamsData[] | InputParamsData {
        if (node.type === 'object') {
          const obj = {} as Record<string, InputParamsData>;
          (node.children || []).forEach(child => {
            obj[child.name] = recurse(child) as InputParamsData;
          });
          return obj as unknown as InputParamsData;
        } else if (node.type === 'array') {
          return node.children && node.children.length > 0
            ? (node.children.map(recurse) as InputParamsData[])
            : ([
                recurse(node.subChild || ({} as InputParamsData)),
              ] as InputParamsData[]);
        } else {
          return node.default !== undefined
            ? (node.default as unknown as InputParamsData)
            : (null as unknown as InputParamsData);
        }
      }

      return data.map(recurse).flat();
    },
    []
  );

  return {
    transformInputDataToDefaultParamsData,
    applyDefaults,
    transformDefaultParamsDataToDefaultData,
  };
};

const useValidation = (): {
  validateTransformedData: (data: InputParamsData[]) => {
    validatedData: InputParamsData[];
    flag: boolean;
  };
  checkParmas: (params: InputParamsData[], id: string, key: string) => boolean;
} => {
  const validateTransformedData = (
    data: InputParamsData[]
  ): { validatedData: InputParamsData[]; flag: boolean } => {
    let flag = true;

    const validate = (items: InputParamsData[]): InputParamsData[] => {
      const newItems = items.map((item, index) => {
        // 校验当前项的 name 字段是否为空
        if (item?.type !== 'object' && item?.type !== 'array') {
          if (item?.required && !item?.default?.toString()?.trim()) {
            item.defaultErrMsg = '值不能为空';
            flag = false;
          } else {
            item.defaultErrMsg = '';
          }
        }
        return item;
      });

      return newItems?.map(item => {
        if (Array.isArray(item.children)) {
          item.children = validate(item.children);
        }
        return item;
      });
    };

    const validatedData = validate(data);
    return { validatedData, flag };
  };

  const checkParmas = useCallback(
    (params: InputParamsData[], id: string, key: string) => {
      let passFlag = true;
      const errEsg = '请输入参数值';
      const findNodeById = (
        tree: InputParamsData[],
        id: string
      ): InputParamsData | null => {
        for (const node of tree) {
          if (node.id === id) {
            return node;
          }
          if (node.children && node.children.length > 0) {
            const result = findNodeById(node.children, id);
            if (result) {
              return result;
            }
          }
        }
        return null;
      };

      const currentNode = findNodeById(params, id) || ({} as InputParamsData);
      if (currentNode?.required && !currentNode[key as keyof InputParamsData]) {
        currentNode[`${key}ErrMsg` as keyof InputParamsData] = errEsg;
        passFlag = false;
      } else 
```

### Core Architecture Module: `console/frontend/src/components/modal/workflow/array-default/hooks/use-columns.tsx`
```
import { InputParamsData } from '@/types/resource';
import { ColumnsType } from 'antd/es/table';
import { Tooltip } from 'antd';
import { capitalizeFirstLetter } from '@/utils/reactflow-utils';
import { Input } from 'antd';

import addItemIcon from '@/assets/imgs/workflow/add-item-icon.png';

import remove from '@/assets/imgs/workflow/input-remove-icon.png';
import { cloneDeep } from 'lodash';

export const useColumns = ({
  handleInputParamsChange,
  handleCheckInput,
  handleAddItem,
  deleteNodeFromTree,
  defaultParamsData,
  setDefaultParamsData,
}: {
  handleInputParamsChange: (
    id: string,
    value: string | number | boolean
  ) => void;
  handleCheckInput: (record: InputParamsData, key: string) => void;
  handleAddItem: (record: InputParamsData) => void;
  deleteNodeFromTree: (
    tree: InputParamsData[],
    id: string
  ) => InputParamsData[];
  defaultParamsData: InputParamsData[];
  setDefaultParamsData: (data: InputParamsData[]) => void;
}): {
  columns: ColumnsType<InputParamsData>;
} => {
  const columns: ColumnsType<InputParamsData> = [
    {
      title: '参数名称',
      dataIndex: 'name',
      key: 'name',
      width: '30%',
      render: (name, record) => (
        <Tooltip
          title={record?.description}
          overlayClassName="black-tooltip config-secret"
        >
          <div className="flex items-center gap-1 h-[40px]">
            <span>{name}</span>
            {record?.required && (
              <span className="text-[#F74E43] flex-shrink-0">*</span>
            )}
            <div className="bg-[#F0F0F0] py-1 px-2.5 rounded text-xs ml-1 flex-shrink-0">
              {capitalizeFirstLetter(record.type)}
            </div>
          </div>
        </Tooltip>
      ),
    },
    {
      title: '参数值',
      dataIndex: 'default',
      key: 'default',
      width: '40%',
      render: (_, record) => (
        <div className="w-full pb-[8px]">
          {record?.type === 'object' || record?.type === 'array' ? null : (
            <Input
              placeholder="请输入参数值"
              className="global-input inline-input"
              value={record?.default as string}
              onChange={e => {
                handleInputParamsChange(record?.id, e.target.value);
                handleCheckInput(record, 'default');
              }}
              onBlur={() => handleCheckInput(record, 'default')}
            />
          )}
          <p className="text-[#F74E43] text-xs absolute bottom-0 left-0">
            {record?.defaultErrMsg}
          </p>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'operation',
      width: '5%',
      render: (_, record) => (
        <div className="flex items-center gap-2 ">
          {record?.type === 'array' && (
            <Tooltip
              title="添加子项"
              overlayClassName="black-tooltip config-secret"
            >
              <img
                src={addItemIcon}
                className="w-4 h-4 mt-1.5 cursor-pointer"
                onClick={() => handleAddItem(record)}
              />
            </Tooltip>
          )}
          {record?.fatherType === 'array' && (
            <Tooltip title="" overlayClassName="black-tooltip config-secret">
              <img
                className="w-4 h-4 cursor-pointer"
                src={remove}
                onClick={() => {
                  setDefaultParamsData(
                    cloneDeep(deleteNodeFromTree(defaultParamsData, record.id))
                  );
                }}
                alt=""
              />
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  return {
    columns,
  };
};

```

### Core Architecture Module: `console/frontend/src/components/table/debugger-table/hooks/use-columns.tsx`
```
import { InputParamsData } from '@/types/resource';
import { Tooltip } from 'antd';
import { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import inputErrorMsg from '@/assets/imgs/plugin/input_error_msg.svg';
import addItemIcon from '@/assets/imgs/workflow/add-item-icon.png';
import remove from '@/assets/imgs/workflow/input-remove-icon.png';
import { cloneDeep } from 'lodash';
import React from 'react';

export const useColumns = ({
  renderInput,
  handleAddItem,
  deleteNodeFromTree,
  debuggerParamsData,
  setDebuggerParamsData,
}: {
  renderInput: (record: InputParamsData) => React.ReactNode;
  handleAddItem: (record: InputParamsData) => void;
  deleteNodeFromTree: (
    tree: InputParamsData[],
    id: string
  ) => InputParamsData[];
  debuggerParamsData: InputParamsData[];
  setDebuggerParamsData: React.Dispatch<
    React.SetStateAction<InputParamsData[]>
  >;
}): {
  columns: ColumnsType<InputParamsData>;
} => {
  const { t } = useTranslation();
  const columns: ColumnsType<InputParamsData> = [
    {
      title: t('workflow.nodes.common.parameterName'),
      dataIndex: 'name',
      key: 'name',
      width: '30%',
      render: (name, record) => (
        <Tooltip
          title={record?.description}
          overlayClassName="black-tooltip config-secret"
        >
          {name}
        </Tooltip>
      ),
    },
    {
      title: t('workflow.nodes.common.variableType'),
      dataIndex: 'type',
      key: 'type',
      width: '10%',
    },
    {
      title: t('workflow.nodes.toolNode.isRequired'),
      dataIndex: 'required',
      key: 'required',
      width: '10%',
      render: required => (
        <div
          style={{
            color: required ? '#6356EA' : '#F74E43',
          }}
        >
          {required
            ? t('workflow.nodes.toolNode.yes')
            : t('workflow.nodes.toolNode.no')}
        </div>
      ),
    },
    {
      title: t('workflow.nodes.toolNode.parameterValue'),
      dataIndex: 'default',
      key: 'default',
      width: '40%',
      render: (_, record) => (
        <div className="w-full flex flex-col gap-1">
          {record?.type === 'object' || record?.type === 'array'
            ? null
            : renderInput(record)}
          {record?.defaultErrMsg && (
            <div className="flex items-center gap-1">
              <img src={inputErrorMsg} className="w-[14px] h-[14px]" alt="" />
              <p className="text-[#F74E43] text-sm">{record?.defaultErrMsg}</p>
            </div>
          )}
        </div>
      ),
    },
    {
      title: t('workflow.nodes.toolNode.operation'),
      key: 'operation',
      width: '5%',
      render: (_, record) => (
        <div className=" flex items-center gap-2">
          {record?.type === 'array' && (
            <Tooltip
              title={t('workflow.nodes.toolNode.addSubItem')}
              overlayClassName="black-tooltip config-secret"
            >
              <img
                src={addItemIcon}
                className="w-4 h-4 mt-1.5 cursor-pointer"
                onClick={() => handleAddItem(record)}
              />
            </Tooltip>
          )}
          {record?.fatherType === 'array' && (
            <Tooltip title="" overlayClassName="black-tooltip config-secret">
              <img
                className="w-4 h-4 cursor-pointer"
                src={remove}
                onClick={() => {
                  setDebuggerParamsData(
                    cloneDeep(deleteNodeFromTree(debuggerParamsData, record.id))
                  );
                }}
                alt=""
              />
            </Tooltip>
          )}
        </div>
      ),
    },
  ];
  return {
    columns,
  };
};

```

### Core Architecture Module: `console/frontend/src/components/table/debugger-table/hooks/use-debugger-table.tsx`
```
import { InputParamsData } from '@/types/resource';
import { cloneDeep } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';
import expand from '@/assets/imgs/plugin/icon_fold.png';
import shrink from '@/assets/imgs/plugin/icon_shrink.png';
import { useTranslation } from 'react-i18next';

export const useDebuggerTable = ({
  debuggerParamsData,
  setDebuggerParamsData,
}: {
  debuggerParamsData: InputParamsData[];
  setDebuggerParamsData: React.Dispatch<
    React.SetStateAction<InputParamsData[]>
  >;
}): {
  expandedRowKeys: string[];
  setExpandedRowKeys: (data: string[]) => void;
  handleExpand: (record: InputParamsData) => void;
  handleCollapse: (record: InputParamsData) => void;
  handleAddItem: (record: InputParamsData) => void;
  deleteNodeFromTree: (
    tree: InputParamsData[],
    id: string
  ) => InputParamsData[];
  customExpandIcon: (params: {
    expanded: boolean;
    record: InputParamsData;
  }) => React.ReactNode;
  handleInputParamsChange: (id: string, value: string) => void;
  handleCheckInput: (record: InputParamsData, key: string) => void;
} => {
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const { t } = useTranslation();
  useEffect(() => {
    const allKeys: string[] = [];
    debuggerParamsData.forEach((item: InputParamsData) => {
      if (item.children) {
        allKeys.push(item.id);
      }
    });
    setExpandedRowKeys(allKeys);
  }, []);

  const handleExpand = useCallback((record: InputParamsData) => {
    setExpandedRowKeys(expandedRowKeys => [...expandedRowKeys, record.id]);
  }, []);

  const handleCollapse = useCallback((record: InputParamsData) => {
    setExpandedRowKeys(expandedRowKeys =>
      expandedRowKeys.filter(id => id !== record.id)
    );
  }, []);

  const updateIds = useCallback((obj: InputParamsData) => {
    const newObj = { ...obj, id: uuid(), default: '' };

    if (newObj.children && Array.isArray(newObj.children)) {
      newObj.children = newObj.children.map(child => updateIds(child));
    }

    return newObj;
  }, []);

  const handleAddItem = useCallback(
    (record: InputParamsData) => {
      const newData = updateIds(
        record?.children?.[0] || ({} as InputParamsData)
      );
      const currentNode =
        findNodeById(debuggerParamsData, record?.id) || ({} as InputParamsData);
      currentNode.children?.push(newData);
      setDebuggerParamsData(cloneDeep(debuggerParamsData));
    },
    [debuggerParamsData, setDebuggerParamsData]
  );

  const deleteNodeFromTree = useCallback(
    (tree: InputParamsData[], id: string) => {
      return tree.reduce((acc: InputParamsData[], node: InputParamsData) => {
        if (node.id === id) {
          return acc;
        }

        if (node.children) {
          node.children = deleteNodeFromTree(node.children, id);
        }

        acc.push(node);
        return acc;
      }, []);
    },
    []
  );

  const customExpandIcon = useCallback(
    ({ expanded, record }: { expanded: boolean; record: InputParamsData }) => {
      if (record.children) {
        return expanded ? (
          <img
            src={shrink}
            className="w-4 h-4 inline-block mb-1 mr-1"
            onClick={e => {
              e.stopPropagation();
              handleCollapse(record);
            }}
          />
        ) : (
          <img
            src={expand}
            className="w-4 h-4 inline-block mb-1 mr-1"
            onClick={e => {
              e.stopPropagation();
              handleExpand(record);
            }}
          />
        );
      }
      return null;
    },
    []
  );

  const findNodeById = (
    tree: InputParamsData[],
    id: string
  ): InputParamsData | null => {
    for (const node of tree) {
      if (node.id === id) {
        return node;
      }

      if (node.children && node.children.length > 0) {
        const result = findNodeById(node.children, id);
        if (result) {
          return result;
        }
      }
    }

    return null;
  };

  const handleInputParamsChange = useCallback(
    (id: string, value: string) => {
      const currentNode =
        findNodeById(debuggerParamsData, id) || ({} as InputParamsData);
      currentNode.default = value;
      setDebuggerParamsData(cloneDeep(debuggerParamsData));
    },
    [debuggerParamsData, setDebuggerParamsData, setExpandedRowKeys]
  );

  const checkParmas = useCallback(
    (params: InputParamsData[], id: string, key: string) => {
      let passFlag = true;
      const errEsg = t('workflow.nodes.toolNode.pleaseEnterParameterValue');
      const currentNode = findNodeById(params, id) || ({} as InputParamsData);
      if (!currentNode[key]) {
        currentNode[`${key}ErrMsg`] = errEsg;
        passFlag = false;
      } else {
        currentNode[`${key}ErrMsg`] = '';
      }
      return passFlag;
    },
    []
  );

  const handleCheckInput = useCallback(
    (record: InputParamsData, key: string) => {
      checkParmas(debuggerParamsData, record?.id, key);
      setDebuggerParamsData(cloneDeep(debuggerParamsData));
    },
    [debuggerParamsData, setDebuggerParamsData]
  );
  return {
    expandedRowKeys,
    setExpandedRowKeys,
    handleExpand,
    handleCollapse,
    handleAddItem,
    deleteNodeFromTree,
    customExpandIcon,
    handleInputParamsChange,
    handleCheckInput,
  };
};

```

### Core Architecture Module: `console/frontend/src/components/table/debugger-table/hooks/use-render-input.tsx`
```
import { InputParamsData } from '@/types/resource';
import { Input, InputNumber, Select } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';

import formSelect from '@/assets/imgs/workflow/icon_form_select.png';

export const useRenderInput = ({
  handleInputParamsChange,
  handleCheckInput,
}: {
  handleInputParamsChange: (id: string, value: string) => void;
  handleCheckInput: (record: InputParamsData, key: string) => void;
}): {
  renderInput: (record: InputParamsData) => React.ReactNode;
} => {
  const { t } = useTranslation();
  const renderInput = (record: InputParamsData): React.ReactNode => {
    const type = record?.type;
    if (type === 'string') {
      return (
        <Input
          disabled={!!record?.defalutDisabled}
          placeholder={t('common.pleaseEnterParameterValue')}
          className="global-input params-input"
          value={record?.default as string}
          onChange={e => {
            handleInputParamsChange(record?.id, e.target.value);
            handleCheckInput(record, 'default');
          }}
          onBlur={() => handleCheckInput(record, 'default')}
        />
      );
    } else if (type === 'boolean') {
      return (
        <Select
          placeholder={t('common.pleaseSelect')}
          suffixIcon={<img src={formSelect} className="w-4 h-4 " />}
          options={[
            {
              label: 'true',
              value: true,
            },
            {
              label: 'false',
              value: false,
            },
          ]}
          style={{
            lineHeight: '40px',
            height: '40px',
          }}
          value={record?.default}
          onChange={value => {
            handleInputParamsChange(record?.id, value as string);
            handleCheckInput(record, 'default');
          }}
          onBlur={() => handleCheckInput(record, 'default')}
        />
      );
    } else if (type === 'integer') {
      return (
        <InputNumber
          disabled={!!record?.defalutDisabled}
          placeholder={t('common.pleaseEnterDefaultValue')}
          step={1}
          precision={0}
          controls={false}
          style={{
            lineHeight: '40px',
            height: '40px',
          }}
          className="global-input params-input w-full"
          value={record?.default as string}
          onChange={value => {
            handleInputParamsChange(record?.id, value as string);
            handleCheckInput(record, 'default');
          }}
          onBlur={() => handleCheckInput(record, 'default')}
        />
      );
    } else if (type === 'number') {
      return (
        <InputNumber
          disabled={!!record?.defalutDisabled}
          placeholder={t('common.pleaseEnterDefaultValue')}
          className="global-input params-input w-full"
          controls={false}
          style={{
            lineHeight: '40px',
          }}
          value={record?.default as string}
          onChange={value => {
            handleInputParamsChange(record?.id, value as string);
            handleCheckInput(record, 'default');
          }}
          onBlur={() => handleCheckInput(record, 'default')}
        />
      );
    }
    return null;
  };

  return {
    renderInput,
  };
};

```

### Core Architecture Module: `console/frontend/src/components/table/tool-input-parameters/hooks/use-columns.tsx`
```
import { InputParamsData } from '@/types/resource';
import { Input, Select, Tooltip } from 'antd';
import { ColumnType, ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import formSelect from '@/assets/imgs/workflow/icon_form_select.png';
import questionCircle from '@/assets/imgs/workflow/question-circle.png';
import inputErrorMsg from '@/assets/imgs/plugin/input_error_msg.svg';
import { cloneDeep } from 'lodash';
import addItemIcon from '@/assets/imgs/workflow/add-item-icon.png';
import remove from '@/assets/imgs/workflow/input-remove-icon.png';
import toolModalChecked from '@/assets/imgs/workflow/tool-modal-checked.png';
import arrayDefaultEdit from '@/assets/imgs/workflow/array-default-edit.png';
import { Switch } from 'antd';
import React, { FC } from 'react';

// 参数名列 Hook
const useParameterColumn = (
  handleInputParamsChange: (
    id: string,
    key: string,
    value: string | number | boolean
  ) => void,
  handleCheckInput: (record: InputParamsData, key: string) => void
): ColumnType<InputParamsData> => {
  const { t } = useTranslation();

  return {
    title: (
      <div className="flex items-center gap-2">
        <span>
          <span className="text-[#F74E43] text-sm">* </span>
          {t('workflow.nodes.common.parameterName')}
        </span>
        <Tooltip
          title={t('workflow.nodes.toolNode.parameterNameDescription')}
          overlayClassName="black-tooltip config-secret"
        >
          <img src={questionCircle} className="w-3 h-3" alt="" />
        </Tooltip>
      </div>
    ),
    dataIndex: 'name',
    key: 'name',
    width: '15%',
    render: (name, record) => (
      <div className="flex flex-col w-full gap-1">
        <Input
          disabled={record?.fatherType === 'array'}
          placeholder={t('workflow.nodes.toolNode.pleaseEnterParameterName')}
          className="global-input params-input inline-input"
          value={name}
          onChange={e => {
            handleInputParamsChange(record?.id, 'name', e.target.value);
            handleCheckInput(record, 'name');
          }}
          onBlur={() => handleCheckInput(record, 'name')}
        />
        {record?.nameErrMsg && (
          <div className="flex items-center gap-1">
            <img src={inputErrorMsg} className="w-[14px] h-[14px]" alt="" />
            <p className="text-[#F74E43] text-sm">{record?.nameErrMsg}</p>
          </div>
        )}
      </div>
    ),
  };
};

// 描述列 Hook
const useDescriptionColumn = (
  handleInputParamsChange: (
    id: string,
    key: string,
    value: string | number | boolean
  ) => void,
  handleCheckInput: (record: InputParamsData, key: string) => void
): ColumnType<InputParamsData> => {
  const { t } = useTranslation();

  return {
    title: (
      <div className="flex items-center gap-2">
        <span>
          <span className="text-[#F74E43] text-sm">* </span>
          {t('workflow.nodes.common.description')}
        </span>
        <Tooltip
          title={t('workflow.nodes.toolNode.pleaseEnterParameterDescription')}
          overlayClassName="black-tooltip config-secret"
        >
          <img src={questionCircle} className="w-3 h-3" alt="" />
        </Tooltip>
      </div>
    ),
    dataIndex: 'description',
    key: 'description',
    width: '15%',
    render: (description, record) => (
      <div className="flex flex-col gap-1">
        <Input
          placeholder={t(
            'workflow.nodes.toolNode.pleaseEnterParameterDescription'
          )}
          className="global-input params-input"
          value={description}
          onChange={e => {
            handleInputParamsChange(record?.id, 'description', e.target.value);
            handleCheckInput(record, 'description');
          }}
          onBlur={() => handleCheckInput(record, 'description')}
        />
        {record?.descriptionErrMsg && (
          <div className="flex items-center gap-1">
            <img src={inputErrorMsg} className="w-[14px] h-[14px]" alt="" />
            <p className="text-[#F74E43] text-sm">
              {record?.descriptionErrMsg}
            </p>
          </div>
        )}
      </div>
    ),
  };
};

// 类型列 Hook
const useTypeColumn = (
  handleInputParamsChange: (
    id: string,
    key: string,
    value: string | number | boolean
  ) => void,
  typeOptions: { label: string; value: string }[]
): ColumnType<InputParamsData> => {
  const { t } = useTranslation();

  return {
    title: (
      <div className="flex items-center gap-2">
        <span>
          <span className="text-[#F74E43] text-sm">* </span>
          {t('workflow.nodes.common.variableType')}
        </span>
      </div>
    ),
    dataIndex: 'type',
    key: 'type',
    width: '10%',
    render: (type, record) => (
      <div>
        <Select
          suffixIcon={<img src={formSelect} className="w-4 h-4" />}
          placeholder={t('workflow.nodes.toolNode.pleaseSelect')}
          className="global-select params-select"
          options={
            record?.fatherType === 'array'
              ? typeOptions?.filter(option => option.value !== 'array')
              : typeOptions
          }
          value={type}
          onChange={value => handleInputParamsChange(record?.id, 'type', value)}
        />
      </div>
    ),
  };
};

// 请求方法列 Hook
const useLocationColumn = (
  handleInputParamsChange: (
    id: string,
    key: string,
    value: string | number | boolean
  ) => void,
  methodsOptions: { label: string; value: string }[]
): ColumnType<InputParamsData> => {
  const { t } = useTranslation();

  return {
    title: t('workflow.nodes.toolNode.requestMethod'),
    dataIndex: 'location',
    key: 'location',
    width: '10%',
    render: (location, record) =>
      record?.fatherType ? null : (
        <Select
          suffixIcon={<img src={formSelect} className="w-4 h-4" />}
          placeholder={t('workflow.nodes.toolNode.pleaseSelectRequestMethod')}
          className="global-select params-select"
          options={methodsOptions}
          value={location}
          onChange={value =>
            handleInputParamsChange(record?.id, 'location', value)
          }
        />
      ),
  };
};

// 必填列 Hook
const useRequiredColumn = (
  handleInputParamsChange: (
    id: string,
    key: string,
    value: string | number | boolean
  ) => void
): ColumnType<InputParamsData> => {
  const { t } = useTranslation();

  return {
    title: t('workflow.nodes.toolNode.isRequired'),
    dataIndex: 'required',
    key: 'required',
    width: '10%',
    render: (required, record) => (
      <div className="min-w-[50px] h-[40px] flex items-center">
        {record?.fatherType !== 'array' ? (
          <div
            className="w-[18px] h-[18px] rounded-full bg-[#fff] flex items-center justify-center cursor-pointer"
            style={{
              border: required ? '1px solid #6356EA' : '1px solid #CACEE0',
            }}
            onClick={() =>
              handleInputParamsChange(record?.id, 'required', !required)
            }
          >
            {required && (
              <img
                src={toolModalChecked}
                className="w-[14px] h-[14px]"
                alt=""
              />
            )}
          </div>
        ) : null}
      </div>
    ),
  };
};

// 默认值列 Hook
const useDefaultColumn = (
  setArrayDefaultModal: (value: boolean) => void,
  setCurrentArrayDefaultId: (id: string) => void,
  renderInput: (record: InputParamsData) => React.ReactNode
): ColumnType<InputParamsData> => {
  const { t } = useTranslation();

  return {
    title: t('workflow.nodes.questionAnswerNode.defaultValue'),
    dataIndex: 'default',
    key: 'default',
    width: '10%',
    render: (_, record) =>
      record.type === 'array' && record?.from === 2 && !record?.arraySon ? (
        <div
          className="w-full h-[40px] flex items-center justify-center gap-2 border border-[#D9E0E9] rounded-lg text-[#6356EA] cursor-pointer"
          onClick={() => {
            setArrayDefaultModal(true);
            setCurrentArrayDefaultId(record?.id);
          }}
        >
          <img src={arrayDefaultEdit} className="w-[14px] h-[14px]" alt="" />
          <span>{t('workflow.nodes.toolNode.edit')}</span>
        </div>
      ) : !record?.arraySon &&
        record.type !== 'object' &&
        record?.from === 2 ? (
        renderInput(record)
      ) : null,
  };
};

// 启用列 Hook
const useEnableColumn = (
  handleInputParamsChange: (
    id: string,
    key: string,
    value: string | number | boolean
  ) => void
): ColumnType<InputParamsData> => {
  const { t } = useTranslation();

  return {
    title: (
      <div className="flex items-center gap-2">
        <span>{t('workflow.nodes.toolNode.enable')}</span>
        <Tooltip
          title={t('workflow.nodes.toolNode.enableDescription')}
          overlayClassName="black-tooltip config-secret"
        >
          <img src={questionCircle} className="w-3 h-3" alt="" />
        </Tooltip>
      </div>
    ),
    dataIndex: 'open',
    key: 'open',
    width: '5%',
    render: (open, record) =>
      !record?.arraySon && record.type !== 'object' ? (
        <div className="h-[40px] flex items-center">
          <Tooltip
            title={
              record?.startDisabled
                ? t(
                    'workflow.nodes.toolNode.requiredParameterDefaultValueSwitch'
                  )
                : ''
            }
            overlayClassName="black-tooltip config-secret"
          >
            <Switch
              disabled={!!(record?.type === 'string' && record?.startDisabled)}
              className="list-switch"
              checked={open}
              onChange={checked =>
                handleInputParamsChange(record?.id, 'open', checked)
              }
            />
          </Tooltip>
        </div>
      ) : null,
  };
};

// 操作列 Hook
const useOperationColumn = (
  inputParamsData: InputParamsData[],
  handleAddItem: (rec
```

### Core Architecture Module: `console/frontend/src/components/table/tool-input-parameters/hooks/use-tool-input-parameters.tsx`
```
import { InputParamsData } from '@/types/resource';
import {
  extractAllIdsOptimized,
  generateTypeDefault,
  transformJsonToArray,
} from '@/utils/utils';
import { cloneDeep, uniq } from 'lodash';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { v4 as uuid } from 'uuid';
import formSelect from '@/assets/imgs/workflow/icon_form_select.png';

import expand from '@/assets/imgs/plugin/icon_fold.png';
import shrink from '@/assets/imgs/plugin/icon_shrink.png';
import { Input, InputNumber, Select } from 'antd';
import { useTranslation } from 'react-i18next';

// 节点查找相关 Hook
const useNodeFinders = (): {
  findNodeById: (tree: InputParamsData[], id: string) => InputParamsData | null;
  findTopAncestorById: (
    nodes: InputParamsData[],
    id: string
  ) => InputParamsData | null;
} => {
  const findNodeById = (
    tree: InputParamsData[],
    id: string
  ): InputParamsData | null => {
    for (const node of tree) {
      if (node.id === id) {
        return node;
      }
      if (node.children && node.children.length > 0) {
        const result = findNodeById(node.children, id);
        if (result) {
          return result;
        }
      }
    }
    return null;
  };

  const findTopAncestorById = useCallback(
    (nodes: InputParamsData[], id: string) => {
      function recursiveSearch(
        node: InputParamsData
      ): InputParamsData | undefined | void {
        if (node?.id === id) {
          return node;
        }
        if (node?.children && Array.isArray(node?.children)) {
          for (const childNode of node?.children || []) {
            const resultNode = recursiveSearch(childNode);
            if (resultNode) return resultNode;
          }
        }
      }

      for (const node of nodes) {
        const result = recursiveSearch(node);
        if (result) return node;
      }
      return null;
    },
    []
  );

  return {
    findNodeById,
    findTopAncestorById,
  };
};

// 数据添加相关 Hook
const useDataAdders = (
  inputParamsData: InputParamsData[],
  setInputParamsData: React.Dispatch<React.SetStateAction<InputParamsData[]>>,
  setExpandedRowKeys: React.Dispatch<React.SetStateAction<string[]>>,
  findNodeById: (tree: InputParamsData[], id: string) => InputParamsData | null
): {
  handleAddData: () => void;
  handleAddItem: (record: InputParamsData, expandedRowKeys: string[]) => void;
} => {
  const handleAddData = useCallback(() => {
    const newData = {
      id: uuid(),
      name: '',
      description: '',
      type: 'string',
      location: 'query',
      required: true,
      default: '',
      open: true,
      from: 2,
      startDisabled: true,
    };
    setInputParamsData(inputParamsData => [
      ...inputParamsData,
      newData as InputParamsData,
    ]);
  }, [setInputParamsData]);

  const handleAddItem = useCallback(
    (record: InputParamsData, expandedRowKeys: string[]) => {
      const newData = {
        id: uuid(),
        name: '',
        description: '',
        type: 'string',
        location: 'query',
        required: true,
        default: '',
        open: true,
        from: 2,
        startDisabled: true,
      } as InputParamsData;
      newData.fatherType = record.type;
      const currentNode = findNodeById(inputParamsData, record?.id);
      currentNode?.children?.push(newData);
      if (currentNode?.arraySon) {
        newData.arraySon = true;
      }
      setInputParamsData(cloneDeep(inputParamsData));
      if (!expandedRowKeys?.includes(record?.id)) {
        setExpandedRowKeys(expandedRowKeys => [...expandedRowKeys, record?.id]);
      }
    },
    [inputParamsData, setInputParamsData, setExpandedRowKeys, findNodeById]
  );

  return {
    handleAddData,
    handleAddItem,
  };
};

// 参数变更相关 Hook
const useParamsChanger = (
  inputParamsData: InputParamsData[],
  setInputParamsData: React.Dispatch<React.SetStateAction<InputParamsData[]>>,
  setExpandedRowKeys: React.Dispatch<React.SetStateAction<string[]>>,
  findNodeById: (tree: InputParamsData[], id: string) => InputParamsData | null,
  findTopAncestorById: (
    nodes: InputParamsData[],
    id: string
  ) => InputParamsData | null
): {
  handleInputParamsChange: (
    id: string,
    key: string,
    value: string | number | boolean
  ) => void;
} => {
  const handleInputParamsChange = useCallback(
    (id: string, key: string, value: string | number | boolean) => {
      const currentNode =
        findNodeById(inputParamsData, id) || ({} as InputParamsData);

      // Save previous value, don't update if no actual change
      const oldValue = currentNode[key];
      if (oldValue === value) return;

      currentNode[key] = value;

      if (key === 'type' && ['array', 'object'].includes(value as string)) {
        const newData = {
          id: uuid(),
          name: '',
          description: '',
          type: 'string',
          location: 'query',
          required: true,
          default: '',
          open: true,
          from: 2,
        } as InputParamsData;
        newData.fatherType = value;
        if (currentNode.type === 'array') {
          newData.name = '[Array Item]';
          currentNode.default = [];
        } else if (currentNode.type === 'object') {
          delete currentNode.default;
        }
        if (currentNode?.type === 'array' || currentNode?.arraySon) {
          newData.arraySon = true;
        }
        currentNode.children = [newData];
        setExpandedRowKeys(expandedRowKeys => [...expandedRowKeys, id]);
      } else if (key === 'type') {
        currentNode.default = generateTypeDefault(
          value as string
        ) as unknown as InputParamsData;
        delete currentNode.children;
      }

      if (key === 'required' && value && !currentNode?.default) {
        currentNode.open = true;
        currentNode.startDisabled = true;
        currentNode.defalutDisabled = false;
      } else if (key === 'required' && value && currentNode?.default) {
        currentNode.defalutDisabled = true;
      } else if (key === 'required') {
        currentNode.startDisabled = false;
        currentNode.defalutDisabled = false;
      }

      if (key === 'open' && !value) {
        currentNode.defalutDisabled = true;
      } else if (key === 'open') {
        currentNode.defalutDisabled = false;
      }

      if (key === 'default' && !value) {
        currentNode.startDisabled = true;
      } else if (key === 'default') {
        currentNode.startDisabled = false;
      }

      if (key === 'from') {
        if (value === 2) {
          if (currentNode.type === 'array') {
            currentNode.default = [];
          } else if (currentNode.type === 'object') {
            delete currentNode.default;
          } else {
            currentNode.default = '';
          }
        } else {
          delete currentNode.default;
        }
        currentNode.default = '';
      }

      if (key === 'type' && currentNode.arraySon) {
        const topLevelNode = findTopAncestorById(inputParamsData, id);
        if (topLevelNode?.from === 2) {
          topLevelNode.default = [];
        }
      }

      // Use functional update to avoid unnecessary re-renders
      setInputParamsData(prevData => {
        const newData = cloneDeep(prevData);
        return newData;
      });
    },
    [
      inputParamsData,
      setInputParamsData,
      setExpandedRowKeys,
      findNodeById,
      findTopAncestorById,
    ]
  );

  return {
    handleInputParamsChange,
  };
};

// 节点删除相关 Hook
const useNodeDeleter = (): {
  deleteNodeFromTree: (
    tree: InputParamsData[],
    id: string
  ) => InputParamsData[];
} => {
  const deleteNodeFromTree = useCallback(
    (tree: InputParamsData[], id: string) => {
      return tree.reduce((acc: InputParamsData[], node: InputParamsData) => {
        if (node.id === id) {
          return acc;
        }
        if (node.children) {
          node.children = deleteNodeFromTree(node.children, id);
        }
        acc.push(node);
        return acc;
      }, []);
    },
    []
  );

  return {
    deleteNodeFromTree,
  };
};

// 树形展开折叠相关 Hook
const useTreeExpansion = (
  inputParamsData: InputParamsData[]
): {
  expandedRowKeys: string[];
  setExpandedRowKeys: React.Dispatch<React.SetStateAction<string[]>>;
  handleExpand: (record: InputParamsData) => void;
  handleCollapse: (record: InputParamsData) => void;
  customExpandIcon: (params: {
    expanded: boolean;
    record: InputParamsData;
  }) => React.ReactNode;
} => {
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

  const collectExpandableKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const collectExpandableKeys = (items: InputParamsData[]): string[] => {
      const keys: string[] = [];
      items.forEach(item => {
        if (item.children && item.children.length > 0) {
          keys.push(item.id);
          // Recursively collect keys from nested items
          keys.push(...collectExpandableKeys(item.children));
        }
      });
      return keys;
    };

    const allKeys = collectExpandableKeys(inputParamsData);
    const allKeysSet = new Set(allKeys);

    // Check if structure has actually changed
    const prevKeysSet = collectExpandableKeysRef.current;
    const hasStructuralChange =
      allKeysSet.size !== prevKeysSet.size ||
      [...allKeysSet].some(key => !prevKeysSet.has(key)) ||
      [...prevKeysSet].some(key => !allKeysSet.has(key));

    if (hasStructuralChange) {
      collectExpandableKeysRef.current = allKeysSet;

      setExpandedRowKeys(prevKeys => {
        // Keep expanded keys and add new expandable items
        const validPrevKeys = prevKeys.filter(key => allKeys.includes(key));
        const newKeys = [...new Set([...validPrevKeys, ...allKeys])];
        return newKeys;
      });
    }
  }, [inputParamsData]);

  const handleExpand = useCallback((record: InputParamsData) => {
    setExpandedRowKeys(expandedRowKeys => [...expandedRowKeys, record.id]);
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1622** (2026-08-17): **[BUG] 你tm是不是没有客服，好友申请没人理**
  *Symptoms*: ### Bug Description  <img width="409" height="632" alt="Image" src="https://github.com/user-attachments/assets/7faf8991-77c3-4d4f-bbf3-f376ef77cf49" />  ### Severity Level  None  ### Reproduction Rate  None  ### Component / Module  - [ ] Core Agent - [ ] API - [ ] UI / Frontend - [ ] Documentation - [ ] Installation / Setup - [ ] Other (describe below)  ### Steps to Reproduce  全是人机  ### Expected vs Actual Behavior  ```markdown sb ```  ### Environment  ```markdown sb ```  ### Impact  _No response_  ### Logs / Screenshots  ```shell  ```  ### Possible Fix  _No response_
  **Post-Mortem & Fix Analysis**:
  > 该 Issue 的标题和内容含有辱骂、攻击性措辞，同时未提供可复现的技术问题信息，不适合作为社区 Issue 继续处理，因此关闭。  我们欢迎对客服响应或产品体验提出具体反馈，但请保持尊重，并说明所使用的产品/入口、申请时间、实际遇到的问题和期望结果。若需要重新反馈，请移除辱骂性措辞后按模板提交，并对账号、联系方式等敏感信息进行脱敏，不要在公开 Issue 中披露个人隐私。

- **Issue #1590** (2026-08-29): **[BUG] Cross-tenant workflow overwrite and disclosure via /workflow/copy-flow (missing ownership check)**
  *Symptoms*: ### Bug Description  reported via email on 15 June 2026:  ## Summary  The console backend endpoint `GET /workflow/copy-flow` copies the entire `data` (node and logic definition) of one workflow onto another, identified only by their `flowId` request parameters. The service method `WorkflowService.copyFlow` performs no ownership, space, or visibility check on either the source or the target workflow. Any authenticated user can therefore:  - Overwrite the workflow definition of any other tenant's workflow with attacker-controlled content   (integrity / tampering, denial of service to the victim's automation), and - Copy any other tenant's private workflow definition into a workflow the attacker owns and then read   it back through the normal owner-scoped detail endpoint (confidentiality / disclosure).  This is a cross-tenant IDOR. Every sibling workflow operation in the same service (`dataPermissionCheckTool.checkWorkflowBelong(workflow, spaceId)`) enforces an ownership check; `copyFlow` is the one that omits it.  ## Affected component  - Service: `console/backend` (Spring Boot, module `hub` aggregating `toolkit`) - Controller: `console/backend/toolkit/src/main/java/com/iflytek/astron/console/toolkit/controller/workflow/WorkflowController.java` - Service: `console/backend/toolkit/src/main/java/com/iflytek/astron/console/toolkit/service/workflow/WorkflowService.java`  ## Affected Versions  Confirmed on v1.0.8.  ## Vulnerable code  Controller (`WorkflowController.java`):  ```java
  **Post-Mortem & Fix Analysis**:
  > This looks resolved on `main`. The missing ownership check on the copy **target** has since been added.  `WorkflowService.copyFlow` now gates both sides before writing:  ```java dataPermissionCheckTool.checkWorkflowVisible(sourceFlow, SpaceInfoUtil.getSpaceId()); assertTopLevelWorkflowExecutableByCurrentUser(targetFlow); ```  - the **source** is checked for read-visibility (as before), and - the **target** is now gated by `assertTopLevelWorkflowExecutableByCurrentUser(targetFlow)`, which for a team space requires `targetFlow.spaceId == requestSpaceId` **and** a non-null role via `spaceUserService.getRole(...)`, and for personal scope requires `spaceId == null && uid == targetFlow.uid` — otherwise `INSUFFICIENT_PERMISSIONS`.  So a caller can no longer overwrite (or disclose source data into) a `targetFlowId` they don't own or have a role in. The guard was added in a9f095b4 ("fix(security): harden XSS, artifact, and sandbox boundaries", #1643, 2026-08-24) and the same top-level check is 
  > Hey @FenjuFu, I've reviewed the fix and it looks good. Closing now, thanks for the attention! 

- **Issue #1574** (2026-07-27): **[BUG] 工作流大模型节点配置 temperature=0 时构建失败（20104 Protocol update failed）**
  *Symptoms*: ## Bug Description  工作流大模型节点使用支持 `temperature=0` 的模型（本次为 `deepseek-v3-0324`）时，点击调试/构建会返回：  ```text code: 20104 message: Protocol update failed ```  本次现场中，PDF 文件上传已经成功；异常发生在随后触发的 `/workflow/build`，并非文件上传、PDF 格式或 OCR 节点导致。  该问题已由 #1561 提供初步修复并合并。本 Issue 用于记录根因、影响范围、回归场景，以及公共校验仍需关注的 Provider 差异。  ## Severity Level  High — 合法模型参数会阻断整个工作流的构建和调试。  ## Reproduction Rate  Always (100%)  ## Component / Module  - [x] API - [x] Other: Core Workflow / Console Backend  ## Steps to Reproduce  最小复现不需要上传文件：  1. 创建工作流：`Start → LLM → End`。 2. 为 LLM 选择支持零温度的模型，例如 `deepseek-v3-0324`。 3. 在高级参数中将 `temperature` 设置为 `0`。 4. 点击调试或构建。 5. Console 调用 `/workflow/build`，随后返回 `20104 Protocol update failed`。  原始用户场景是在 Start 节点上传 PDF 后点击调试，因此从界面上看起来像“上传文件导致失败”，但上传请求本身已经成功。  ## Expected vs Actual Behavior  **Expected**  - 对明确支持 `temperature=0` 的 Provider，工作流协议校验和构建应成功。 - 对不支持零温度的 Provider，应在配置阶段返回明确、可操作的参数错误。  **Actual**  - Core Workflow 的公共 LLM 字段统一使用 `Field(gt=0, le=1)`。 - `temperature=0` 在调用实际模型之前就被 Pydantic 拒绝。 - 底层 `ValidationError` 被统一包装为 `20104 Protocol update failed`，Console 无法展示真实原因。  ## Complete Call Chain  ```text Console POST /workflow/build → WorkflowController.build → WorkflowService.build → WorkflowService.saveRemote → Core Workflow POST /protocol/update/{flowId} → WorkflowEngineFactory.create_engine → WorkflowEngineBuilder.build_nodes → NodeFactory.create → SparkLLMNode / BaseLLMNode Pydantic validation → temperature=0 rejected by gt=0 → Core returns 20104 → Console throws BusinessException("Pr
  **Post-Mortem & Fix Analysis**:
  > done

- **Issue #1573** (2026-07-27): **[BUG] OpenAI-compatible usage-only stream chunks can fail workflow LLM nodes**
  *Symptoms*: ### Bug Description  An OpenAI-compatible model can pass model-management validation and work with a non-streaming `curl` request, but fail when used by a workflow LLM node with the generic error `LLM node execution failed`.  The two paths use different response modes:  - Model validation / typical `curl`: non-streaming response - Workflow LLM execution: `stream=true`  Some OpenAI-compatible providers emit a usage-only SSE chunk whose `choices` array is empty:  ```json {   "choices": [],   "usage": {     "prompt_tokens": 8,     "completion_tokens": 4,     "total_tokens": 12   } } ```  The workflow OpenAI stream path assumed every chunk contained `choices[0]`. A usage-only chunk could therefore raise `IndexError`, which was then surfaced as the generic workflow-node failure. Publishing the raw frame also allowed downstream frame processing to fail on the same assumption.  This is protocol-shape dependent and is not specific to one endpoint or model.  ### Severity Level  Medium - partial feature break, workaround exists  ### Reproduction Rate  Always (100%) when the provider emits a usage-only chunk before the terminal choice or EOF  ### Component / Module  - [ ] Core Agent - [x] API - [ ] UI / Frontend - [ ] Documentation - [ ] Installation / Setup - [x] Other: Core Workflow / OpenAI-compatible LLM provider  ### Steps to Reproduce  1. Add a third-party model using provider `OpenAI` and an OpenAI-compatible Chat Completions endpoint. 2. Confirm model validation succeeds, or sen
  **Post-Mortem & Fix Analysis**:
  > done

- **Issue #1572** (2026-07-27): **[BUG] Private IP URLs cannot be explicitly allowed for plugins and custom models**
  *Symptoms*: ### Bug Description  Astron Agent rejects URL hosts that use private or other non-public IP addresses as an SSRF protection measure, even when `IP_BLACK_LIST` and `NETWORK_SEGMENT_BLACK_LIST` are empty. There is no explicit opt-in allowlist for legitimate on-premises endpoints.  This affects URL-bearing flows such as:  - custom plugin creation and debugging - redirect validation - workflow URL validation - third-party/custom model endpoints  Clearing the blacklist does not resolve the problem and is not a safe workaround.  ### Severity Level  High - major on-premises integration flows are blocked.  ### Reproduction Rate  Always (100%)  ### Component / Module  - [ ] Core Agent - [x] API - [ ] UI / Frontend - [ ] Documentation - [x] Installation / Setup - [ ] Other  ### Steps to Reproduce  1. Deploy Astron Agent with Docker Compose. 2. Run a plugin or OpenAI-compatible model endpoint on a private network address, for example `http://192.168.1.10:5080/echo`. 3. Ensure `IP_BLACK_LIST` and `NETWORK_SEGMENT_BLACK_LIST` are empty. 4. In Resource Management, create a custom plugin using the private endpoint and click **Debug**. 5. Alternatively, add a third-party/custom model whose interface address uses a private IP. 6. Observe that validation fails before the platform attempts the request.  ### Expected vs Actual Behavior  **Expected**  Private and special non-public addresses remain denied by default, but an administrator can explicitly allow trusted exact IPs or CIDR ranges throu
  **Post-Mortem & Fix Analysis**:
  > done

- **Issue #1551** (2026-07-30): **[BUG] can not add custom model of ollama**
  *Symptoms*: ### Bug Description  when i add custom model of ollama, report below error  <img width="1416" height="1154" alt="Image" src="https://github.com/user-attachments/assets/78aba8df-8f2f-4e3b-9337-e4c6aba4cce6" />  i'm sure this url is available  <img width="2215" height="679" alt="Image" src="https://github.com/user-attachments/assets/771c0f51-78dd-471e-80b3-80f0038fbba2" />  ### Severity Level  None  ### Reproduction Rate  None  ### Component / Module  - [ ] Core Agent - [ ] API - [x] UI / Frontend - [ ] Documentation - [ ] Installation / Setup - [ ] Other (describe below)  ### Steps to Reproduce  model management  ### Expected vs Actual Behavior  ```markdown add successfully ```  ### Environment  ```markdown Astron Agent Version: 1.1.0 ```  ### Impact  _No response_  ### Logs / Screenshots  ```shell  ```  ### Possible Fix  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. The screenshots don't render for me, so I traced the add-model path in the code to narrow it down — but the exact error text from the server log will tell us which of these it is.  When you add a custom model, the backend (`ModelService.validateModel`) doesn't just check that the URL is reachable — it sends a real chat completion to it and inspects the response. Three things there can reject a working Ollama endpoint:  1. **The response must contain a `usage` field.** The OpenAI-compatibility check is:    ```java    return root.has("choices") && root.get("choices").isArray() && root.has("usage");    ```    Ollama's `/v1/chat/completions` does not always return `usage` on a non-streaming reply. If that's your case, the error would be the "not OpenAI-compatible" one (`MODEL_NOT_COMPATIBLE_OPENAI`). Note this `usage` requirement is intentional — there's a test asserting it — so it isn't just an oversight; changing it needs a maintainer decision about a dedicated Oll
  > Thanks for the report. We rechecked the screenshots and can now identify the first failure precisely.  The endpoint shown is `http://192.168.60.13:9090/v1/chat/completions`, and the UI error is **“URL validation failed”**. This error is raised by the SSRF/private-IP policy before the console backend sends the model validation request, so endpoint availability from the host does not bypass this check.  This private-IP case is covered by #1562, which introduced an explicit `IP_WHITE_LIST` for trusted IP-literal URL hosts.  To use this endpoint:  1. Upgrade to a version containing #1562 / commit `8301de7e`. 2. Append `192.168.60.13` (recommended, narrowest scope), or an appropriate CIDR such as `192.168.60.0/24`, to the configuration with:    - category: `IP_WHITE_LIST`    - code: `ip_white_list` 3. Keep the values synchronized in both `config_info` and `config_info_en`, because the configuration table is selected by request locale. 4. Do **not** clear `NETWORK_SEGMENT_BLACK_LIST`. The wh
  > Thanks @lyj715824 — that pins it down. So this is the SSRF / private-IP path (option 2 from my earlier note), and #1562 already provides the right mechanism via `IP_WHITE_LIST`. No code change needed here.  The one gap left is discoverability: a user who hits "URL validation failed" has no way to know they need to whitelist the IP, or that it has to go into **both** `config_info` and `config_info_en`. I opened #1580 to fix the FAQ for that — it rewrites the two model entries in `faq/models.md` to use the `IP_WHITE_LIST` allowlist (SQL verified against the `V1.43` migration) instead of the old "clear the blacklist" advice, and calls out the both-tables and keep-the-blacklist points from your comment.  @nipeone once you've whitelisted `192.168.60.13` per the steps above and retried, could you confirm whether it works, or share the server log + a `stream: false` response if the error then changes to an OpenAI-compatibility one? That would let us close this out. 

- **Issue #1539** (2026-07-28): **[BUG] 当一个会话里存在一条req是输入参数缺失时，这个会话再发任何消息都会报错**
  *Symptoms*: ### Bug Description  请求一条消息，请求参数为空，workflow服务响应参数缺失，然后再发送任何正常的请求，workflow服务都会响应报错，等于是这个会话就再也用不了了。  <img width="1191" height="302" alt="Image" src="https://github.com/user-attachments/assets/2bebc64c-7f5e-4241-b666-16b52a34f017" />  <img width="1194" height="795" alt="Image" src="https://github.com/user-attachments/assets/75c8964b-acda-486a-8ef6-0ef9e572e523" />  ### Severity Level  Critical - system crash, data loss, or security issue  ### Reproduction Rate  Always (100%)  ### Component / Module  - [x] Core Agent - [ ] API - [ ] UI / Frontend - [ ] Documentation - [ ] Installation / Setup - [ ] Other (describe below)  ### Steps to Reproduce  1. 直接调用接口让输入文本为空，那么AGENT_USER_INPUT字段入参没有值，workflow服务会报错服务响应参数缺失 2. 然后这个会话再也无法正常响应了  ### Expected vs Actual Behavior  ```markdown 1. 正常来说这个会话哪怕是有一条异常的请求和响应后续的文本对话请求应该不受影响才对 ```  ### Environment  ```markdown 1.0.9 ```  ### Impact  _No response_  ### Logs / Screenshots  ```shell  ```  ### Possible Fix  _No response_
  **Post-Mortem & Fix Analysis**:
  > 你是通过api接口调用工作流的是吧？
  > 是的
  > 已解决 #1579 

- **Issue #1367** (2026-06-04): **[BUG] 智能决策节点无法访问自定义MCP服务**
  *Symptoms*: ### Bug Description  智能决策节点无法访问自定义MCP服务  ### Severity Level  Critical - system crash, data loss, or security issue  ### Reproduction Rate  Always (100%)  ### Component / Module  - [x] Core Agent - [ ] API - [ ] UI / Frontend - [ ] Documentation - [ ] Installation / Setup - [ ] Other (describe below)  ### Steps to Reproduce  智能决策节点无法访问自定义MCP服务  <img width="761" height="1443" alt="Image" src="https://github.com/user-attachments/assets/bcddf9c1-4fac-4f41-8aa0-b3242ad6781d" />  <img width="809" height="1740" alt="Image" src="https://github.com/user-attachments/assets/37bac485-bbb5-4b49-b99f-02780a3584c1" />  ### Expected vs Actual Behavior  ```markdown 应当根据我的需求直接访问MCP服务获取结果并输出 ```  ### Environment  ```markdown 1.0.6 ```  ### Impact  _No response_  ### Logs / Screenshots  ```shell  ```  ### Possible Fix  _No response_
  **Post-Mortem & Fix Analysis**:
  >  请换成 core-link 服务实际能访问的 HTTP/HTTPS SSE MCP 地址；localhost / 127.0.0.1 会被明确拒绝；我用高德MCP服务测了下是可以的
  > 我们公司内网测试，能访问，但是他压根就没访问
  > OK了，关闭了

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

### Incident Patch 1: `b4f8ed57` (2026-09-23)
**Commit Message**: fix(console): resolve models for published bots 

fix(console): resolve models for published bots

**File**: `console/backend/commons/src/test/java/com/iflytek/astron/console/commons/util/S3ClientUtilMinioPolicyCompatibilityIT.java` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@
 @Testcontainers
 class S3ClientUtilMinioPolicyCompatibilityIT {
     private static final String MINIO_IMAGE =
-            "minio/minio:RELEASE.2025-07-23T15-54-02Z";
+            "quay.io/minio/minio:RELEASE.2025-07-23T15-54-02Z";
     private static final String ACCESS_KEY = "codex-policy-root";
     private static final String SECRET_KEY = "codex-policy-password-2026";
     private static final String DEFAULT_BUCKET = "console-oss";
```

**File**: `console/backend/hub/src/main/java/com/iflytek/astron/console/hub/service/chat/impl/BotChatServiceImpl.java` (modified, +18/-6)
```diff
@@ -145,7 +145,8 @@ public void chatMessageBot(ChatBotReqDto chatBotReqDto, SseEmitter sseEmitter, S
             } else {
                 ChatReqRecords chatReqRecords = createChatRequest(chatBotReqDto);
                 ModelConfigResult modelConfig = resolveChatModelConfiguration(
-                        botConfig.modelId, botConfig.model, chatBotReqDto.getUid(), spaceId, sseEmitter);
+                        botConfig.modelId, botConfig.model, chatBotReqDto.getUid(), spaceId,
+                        botConfig.modelOwnerUid, sseEmitter);
                 int maxInputTokens = modelConfig == null ? this.maxInputTokens : modelConfig.maxInputTokens();
                 List<SparkChatRequest.MessageDto> messages = buildMessageList(chatBotReqDto, botConfig.supportContext,
                         botConfig.supportDocument, botConfig.prompt, maxInputTokens, chatReqRecords.getId());
@@ -199,7 +200,8 @@ public void reAnswerMessageBot(Long requestId, Integer botId, SseEmitter sseEmit
             chatBotReqDto.setEdit(true);
             Long spaceId = SpaceInfoUtil.getSpaceId();
             ModelConfigResult modelConfig = resolveChatModelConfiguration(
-                    botConfig.modelId, botConfig.model, chatBotReqDto.getUid(), spaceId, sseEmitter);
+                    botConfig.modelId, botConfig.model, chatBotReqDto.getUid(), spaceId,
+                    botConfig.modelOwnerUid, sseEmitter);
             int maxInputTokens = modelConfig == null ? this.maxInputTokens : modelConfig.maxInputTokens();
             List<SparkChatRequest.MessageDto> messages = buildMessageList(chatBotReqDto, botConfig.supportContext,
                     botConfig.supportDocument, botConfig.prompt, maxInputTokens, chatReqRecords.getId());
@@ -243,7 +245,7 @@ public void debugChatMessageBot(DebugChatBotReqDto request, SseEmitter sseEmitte
             // get personality config prompt
             String prompt = personalityConfigService.getChatPrompt(request.getPersonalityConfig(), request.getPrompt());
             ModelConfigResult modelConfig = resolveChatModelConfiguration(
-                    request.getModelId(), request.getModel(), request.getUid(), request.getSpaceId(), sseEmitter);
+                    request.getModelId(), request.getModel(), request.getUid(), request.getSpaceId(), null, sseEmitter);
             int maxInputTokens = modelConfig == null ? this.maxInputTokens : modelConfig.maxInputTokens();
             messageList = buildDebugMessageList(request.getText(), prompt, request.getMessages(), maxInputTokens,
                     request.getMaasDatasetList());
@@ -334,8 +336,11 @@ private ModelConfigResult getModelConfiguration(Long modelId, String uid, Long s
     }
 
     private ModelConfigResult resolveChatModelConfiguration(
-            Long modelId, String model, String uid, Long spaceId, SseEmitter sseEmitter) {
+            Long modelId, String model, String uid, Long spaceId, String modelOwnerUid, SseEmitter sseEmitter) {
         if (modelId != null) {
+            if (StringUtils.isNotBlank(modelOwnerUid)) {
+                return getPublishedBotModelConfiguration(modelId, uid, modelOwnerUid);
+            }
             return getModelConfiguration(modelId, uid, spaceId, sseEmitter);
         }
         if (isSparkModel(model)) {
@@ -344,6 +349,11 @@ private ModelConfigResult resolveChatModelConfiguration(
         return getModelConfigurationByDomain(model, uid, spaceId, sseEmitter);
     }
 
+    private ModelConfigResult getPublishedBotModelConfiguration(Long modelId, String uid, String publisherUid) {
+        LLMInfoVo llmInfoVo = modelService.getRuntimeModelDetailForPublishedBot(modelId, uid, publisherUid);
+        return buildModelConfigResult(llmInfoVo);
+    }
+
     private ModelConfigResult getModelConfigurationByDomain(
             String modelDomain, String uid, Long spaceId, SseEmitter sseEmitter) {
         ModelDto modelDto = new ModelDto();
@@ -384,7 +394,7 @@ private void syncWorkflowRuntimeModel(
         }
         boolean remoteSynced = false;
         ModelConfigResult modelConfigResult = resolveChatModelConfiguration(
-                botConfig.modelId, botConfig.model, uid, spaceId, sseEmitter);
+                botConfig.modelId, botConfig.model, uid, spaceId, botConfig.modelOwnerUid, sseEmitter);
         if (modelConfigResult != null) {
             remoteSynced = workflowService.syncWorkflowModelConfig(userLangChainInfo.getFlowId(), modelConfigResult.llmInfoVo());
         }
@@ -441,6 +451,7 @@ private BotConfiguration getBotConfiguration(Integer botId) throws BusinessExcep
                     chatBotMarket.getOpenedTool(),
                     chatBotMarket.getVersion(),
                     chatBotMarket.getModelId(),
+                    chatBotMarket.getUid(),
                     chatBotMarket.getSupportDocument() == 1,
                     resolveBaseMcpServerUrls(botId),
                     resolveBaseSkills(botId),
@@ -456,6 +467,7 @@ private BotConfig
```

**File**: `console/backend/hub/src/test/java/com/iflytek/astron/console/hub/service/chat/impl/BotChatServiceImplUnitTest.java` (modified, +25/-0)
```diff
@@ -193,6 +193,31 @@ void testChatMessageBot_CustomModel_BuildsCustomTask() {
         assertFalse(task.isDebug());
     }
 
+    @Test
+    void testChatMessageBot_MarketModel_UsesPublisherModelForDifferentAccount() {
+        ChatBotReqDto chatBotReqDto = createChatBotReqDto();
+        chatBotReqDto.setUid("consumer-uid");
+        SseEmitter sseEmitter = new SseEmitter();
+
+        ChatBotMarket chatBotMarket = createChatBotMarket();
+        chatBotMarket.setModelId(1L);
+        chatBotMarket.setUid("publisher-uid");
+        chatBotMarket.setSupportDocument(0);
+
+        when(chatBotDataService.findMarketBotByBotId(anyInt())).thenReturn(chatBotMarket);
+        when(chatDataService.createRequest(any())).thenReturn(createChatReqRecords());
+        when(chatHistoryService.getSystemBotHistory(anyString(), anyLong(), anyBoolean())).thenReturn(historyMessages());
+        when(modelService.getRuntimeModelDetailForPublishedBot(1L, "consumer-uid", "publisher-uid"))
+                .thenReturn(createLLMInfoVo());
+
+        botChatService.chatMessageBot(chatBotReqDto, sseEmitter, "sse", null, null);
+
+        AgentChatTask task = captureTask();
+        assertNotNull(task.getLlmInfoVo());
+        verify(modelService).getRuntimeModelDetailForPublishedBot(1L, "consumer-uid", "publisher-uid");
+        verify(modelService, never()).getRuntimeModelDetail(1L, "consumer-uid", 1L);
+    }
+
     @Test
     void testChatMessageBot_BaseBot_PassesSavedMcpServerUrls() {
         ChatBotReqDto chatBotReqDto = createChatBotReqDto();
```

**File**: `console/backend/toolkit/src/main/java/com/iflytek/astron/console/toolkit/service/model/ModelService.java` (modified, +32/-1)
```diff
@@ -930,7 +930,7 @@ public ApiResult getDetail(Integer llmSource, Long modelId, HttpServletRequest r
 
     public LLMInfoVo getRuntimeModelDetail(Long modelId, String authenticatedUid, Long authorizedSpaceId) {
         UserInfo userInfo = UserInfoManagerHandler.get();
-        if (!Objects.equals(userInfo.getUid(), authenticatedUid)) {
+        if (userInfo == null || !Objects.equals(userInfo.getUid(), authenticatedUid)) {
             throw new BusinessException(ResponseEnum.UNAUTHORIZED);
         }
 
@@ -941,6 +941,37 @@ public LLMInfoVo getRuntimeModelDetail(Long modelId, String authenticatedUid, Lo
         return buildRuntimeLLMInfoVoFromModel(model, userInfo);
     }
 
+    /**
+     * Resolve the runtime model referenced by a published market bot.
+     *
+     * <p>
+     * A published bot may be used by a different account than the model owner. The normal runtime
+     * lookup intentionally scopes personal models to the authenticated user, so market execution needs
+     * a separate, trusted lookup by the publisher recorded on the market row.
+     * </p>
+     */
+    public LLMInfoVo getRuntimeModelDetailForPublishedBot(
+            Long modelId, String authenticatedUid, String publisherUid) {
+        UserInfo userInfo = UserInfoManagerHandler.get();
+        if (userInfo == null || !Objects.equals(userInfo.getUid(), authenticatedUid)) {
+            throw new BusinessException(ResponseEnum.UNAUTHORIZED);
+        }
+        if (modelId == null || StringUtils.isBlank(publisherUid)) {
+            throw new BusinessException(ResponseEnum.MODEL_NOT_EXIST);
+        }
+
+        Model model = mapper.selectOne(new LambdaQueryWrapper<Model>()
+                .eq(Model::getId, modelId)
+                .eq(Model::getUid, publisherUid)
+                .eq(Model::getIsDeleted, 0));
+        if (model == null) {
+            throw new BusinessException(ResponseEnum.MODEL_NOT_EXIST);
+        }
+        log.debug("Resolved published bot model, modelId={}, publisherUid={}, consumerUid={}",
+                modelId, publisherUid, authenticatedUid);
+        return buildRuntimeLLMInfoVoFromModel(model, userInfo);
+    }
+
     private Model findAccessibleModel(Long modelId, String uid, Long spaceId) {
         if (spaceId != null && enterpriseSpaceService.checkUserBelongSpace(spaceId, uid) == null) {
             return null;
```

**File**: `console/backend/toolkit/src/main/java/com/iflytek/astron/console/toolkit/service/workflow/VersionService.java` (modified, +18/-11)
```diff
@@ -48,6 +48,10 @@
 @Slf4j
 public class VersionService {
 
+    // workflow_version uses 1/2, unlike the boolean deletion flag on workflow.
+    private static final long VERSION_ACTIVE = 1L;
+    private static final long VERSION_DELETED = 2L;
+
     @Autowired
     WorkflowService workflowService;
 
@@ -242,6 +246,7 @@ private ApiResult<JSONObject> createVersion(
             workflowVersion.setPublishChannel(createDto.getPublishChannel());
             workflowVersion.setPublishResult(WorkflowConst.PublishResult.normalize(createDto.getPublishResult()));
             workflowVersion.setFlowId(createDto.getFlowId());
+            workflowVersion.setDeleted(VERSION_ACTIVE);
             workflowVersion.setDescription(createDto.getDescription());
             // Set advanced configuration information
             workflowVersion.setAdvancedConfig(workflow.getAdvancedConfig());
@@ -434,7 +439,7 @@ public ApiResult<JSONObject> haveVersionSysData(WorkflowVersion createDto) {
         dataPermissionCheckTool.checkWorkflowVisible(workflow, SpaceInfoUtil.getSpaceId());
         List<WorkflowVersion> workflowVersions = workflowVersionMapper.selectList(Wrappers.lambdaQuery(WorkflowVersion.class)
                 .eq(WorkflowVersion::getFlowId, createDto.getFlowId())
-                .eq(WorkflowVersion::getDeleted, false)
+                .eq(WorkflowVersion::getDeleted, VERSION_ACTIVE)
                 .eq(WorkflowVersion::getName, createDto.getName()));
         if (workflowVersions.isEmpty()) {
             throw new BusinessException(ResponseEnum.WORKFLOW_VERSION_NOT_FOUND);
@@ -516,7 +521,7 @@ public ApiResult<JSONObject> restore(WorkflowVersion createDto) {
                     Wrappers.lambdaQuery(WorkflowVersion.class)
                             .eq(WorkflowVersion::getId, createDto.getId())
                             .eq(WorkflowVersion::getFlowId, createDto.getFlowId())
-                            .eq(WorkflowVersion::getDeleted, false)
+                            .eq(WorkflowVersion::getDeleted, VERSION_ACTIVE)
                             .last("limit 1"));
             if (workflowVersion == null) {
                 throw new BusinessException(ResponseEnum.WORKFLOW_VERSION_NOT_FOUND);
@@ -528,7 +533,7 @@ public ApiResult<JSONObject> restore(WorkflowVersion createDto) {
             LambdaUpdateWrapper<WorkflowVersion> updateWrapper1 = new LambdaUpdateWrapper<>();
             // Update flowId corresponding records, set isVersion to 2
             updateWrapper1.eq(WorkflowVersion::getFlowId, createDto.getFlowId())
-                    .eq(WorkflowVersion::getDeleted, false)
+                    .eq(WorkflowVersion::getDeleted, VERSION_ACTIVE)
                     .set(WorkflowVersion::getIsVersion, 2);
             // Execute update
             if (workflowVersionMapper.update(null, updateWrapper1) < 1) {
@@ -541,7 +546,7 @@ public ApiResult<JSONObject> restore(WorkflowVersion createDto) {
             updateWrapper2
                     .eq(WorkflowVersion::getId, createDto.getId())
                     .eq(WorkflowVersion::getFlowId, createDto.getFlowId())
-                    .eq(WorkflowVersion::getDeleted, false)
+                    .eq(WorkflowVersion::getDeleted, VERSION_ACTIVE)
                     .set(WorkflowVersion::getIsVersion, 1);
             // Execute update
             if (workflowVersionMapper.update(null, updateWrapper2) != 1) {
@@ -586,7 +591,7 @@ public Object logicDelete(Long id) {
         WorkflowVersion workflowVersion = workflowVersionMapper.selectOne(
                 Wrappers.lambdaQuery(WorkflowVersion.class)
                         .eq(WorkflowVersion::getId, id)
-                        .eq(WorkflowVersion::getDeleted, false)
+                        .eq(WorkflowVersion::getDeleted, VERSION_ACTIVE)
                         .last("limit 1"));
         if (workflowVersion == null) {
             throw new BusinessException(ResponseEnum.WORKFLOW_VERSION_NOT_FOUND);
@@ -603,8 +608,8 @@ public Object logicDelete(Long id) {
         updateWrapper
                 .eq(WorkflowVersion::getId, id)
                 .eq(WorkflowVersion::getFlowId, flowId)
-                .eq(WorkflowVersion::getDeleted, false)
-                .set(WorkflowVersion::getDeleted, 2);
+                .eq(WorkflowVersion::getDeleted, VERSION_ACTIVE)
+                .set(WorkflowVersion::getDeleted, VERSION_DELETED);
         // Execute update
         if (workflowVersionMapper.update(null, updateWrapper) != 1) {
             throw new BusinessException(ResponseEnum.WORKFLOW_VERSION_NOT_FOUND);
@@ -629,7 +634,7 @@ public Object publishResult(String flowId, String name) {
         List<WorkflowVersion> workflowVersions = workflowVersionMapper.selectList(
                 Wrappers.lambdaQuery(WorkflowVersion.class)
                         .eq(WorkflowVersion::getFlowId, flowId)
-                        .eq(WorkflowVersion::getDeleted, false)
+                        .eq(WorkflowVersion::getD
```

**File**: `console/backend/toolkit/src/test/java/com/iflytek/astron/console/toolkit/service/model/ModelServiceTest.java` (modified, +25/-0)
```diff
@@ -500,6 +500,31 @@ void testGetRuntimeModelDetail_usesExplicitAuthorizedSpaceAndKeepsApiKey() throw
         }
     }
 
+    @Test
+    void testGetRuntimeModelDetailForPublishedBot_UsesPublisherOwnership() {
+        Model model = customModelWithApiKey("sk-published");
+        model.setUid("publisher");
+        model.setSpaceId(null);
+        when(mapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(model);
+        when(modelCategoryService.getTree(12L)).thenReturn(Collections.emptyList());
+        when(s3UtilClient.getS3Prefix()).thenReturn("s3://x");
+
+        try (MockedStatic<com.iflytek.astron.console.toolkit.handler.UserInfoManagerHandler> user =
+                mockStatic(com.iflytek.astron.console.toolkit.handler.UserInfoManagerHandler.class)) {
+            com.iflytek.astron.console.commons.entity.user.UserInfo userInfo =
+                    new com.iflytek.astron.console.commons.entity.user.UserInfo();
+            userInfo.setUid("consumer");
+            userInfo.setUsername("consumer-name");
+            user.when(com.iflytek.astron.console.toolkit.handler.UserInfoManagerHandler::get)
+                    .thenReturn(userInfo);
+
+            LLMInfoVo vo = modelService.getRuntimeModelDetailForPublishedBot(12L, "consumer", "publisher");
+
+            assertEquals("sk-published", vo.getApiKey());
+            verify(mapper).selectOne(any(LambdaQueryWrapper.class));
+        }
+    }
+
     private Model customModelWithApiKey(String apiKey) {
         Model model = new Model();
         model.setId(12L);
```

**File**: `console/backend/toolkit/src/test/java/com/iflytek/astron/console/toolkit/service/workflow/VersionServiceAuthorizationTest.java` (modified, +61/-0)
```diff
@@ -1,5 +1,6 @@
 package com.iflytek.astron.console.toolkit.service.workflow;
 
+import static org.assertj.core.api.Assertions.assertThat;
 import static org.assertj.core.api.Assertions.assertThatThrownBy;
 import static org.mockito.ArgumentMatchers.any;
 import static org.mockito.Mockito.doThrow;
@@ -9,6 +10,7 @@
 import static org.mockito.Mockito.when;
 
 import com.baomidou.mybatisplus.core.conditions.Wrapper;
+import com.baomidou.mybatisplus.core.conditions.AbstractWrapper;
 import com.baomidou.mybatisplus.core.MybatisConfiguration;
 import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
 import org.apache.ibatis.builder.MapperBuilderAssistant;
@@ -27,6 +29,7 @@
 import org.junit.jupiter.api.BeforeAll;
 import org.junit.jupiter.api.BeforeEach;
 import org.junit.jupiter.api.Test;
+import org.mockito.ArgumentCaptor;
 import org.springframework.mock.web.MockHttpServletRequest;
 import org.springframework.web.context.request.RequestContextHolder;
 import org.springframework.web.context.request.ServletRequestAttributes;
@@ -145,6 +148,64 @@ void boundBotResultUpdateUsesExplicitOwnerWithoutRequestContext() {
         verify(permissionCheck, never()).checkWorkflowBelong(any(Workflow.class), any());
     }
 
+    @Test
+    void resultUpdateFindsActiveVersionAndWritesResultUsingNumericDeletionFlag() {
+        WorkflowVersion stored = version(99L, "flow-1");
+        stored.setDeleted(1L);
+        when(workflowVersionMapper.selectOne(any())).thenReturn(stored);
+        when(workflowMapper.selectOne(any())).thenReturn(workflow("flow-1"));
+        when(workflowVersionMapper.update(any(), any(Wrapper.class))).thenReturn(1);
+        WorkflowVersion request = version(99L, "flow-1");
+        request.setPublishResult("Success");
+
+        assertThat(service.update_channel_result(request).code()).isZero();
+
+        ArgumentCaptor<Wrapper<WorkflowVersion>> lookup = ArgumentCaptor.forClass(Wrapper.class);
+        verify(workflowVersionMapper).selectOne(lookup.capture());
+        assertActiveVersionFilter(lookup.getValue());
+        ArgumentCaptor<Wrapper<WorkflowVersion>> update = ArgumentCaptor.forClass(Wrapper.class);
+        verify(workflowVersionMapper).update(any(), update.capture());
+        assertActiveVersionFilter(update.getValue());
+        assertThat(((AbstractWrapper<?, ?, ?>) update.getValue()).getParamNameValuePairs().values())
+                .contains("成功");
+    }
+
+    @Test
+    void deleteTransitionsActiveVersionFromOneToTwo() {
+        WorkflowVersion stored = version(99L, "flow-1");
+        stored.setDeleted(1L);
+        when(workflowVersionMapper.selectOne(any())).thenReturn(stored);
+        when(workflowMapper.selectOne(any())).thenReturn(workflow("flow-1"));
+        when(workflowVersionMapper.update(any(), any(Wrapper.class))).thenReturn(1);
+
+        service.logicDelete(99L);
+
+        ArgumentCaptor<Wrapper<WorkflowVersion>> update = ArgumentCaptor.forClass(Wrapper.class);
+        verify(workflowVersionMapper).update(any(), update.capture());
+        assertActiveVersionFilter(update.getValue());
+        assertThat(((AbstractWrapper<?, ?, ?>) update.getValue()).getParamNameValuePairs().values())
+                .contains(2L);
+    }
+
+    @Test
+    void publishResultOnlyQueriesActiveVersions() {
+        when(workflowMapper.selectOne(any())).thenReturn(workflow("flow-1"));
+        when(workflowVersionMapper.selectList(any())).thenReturn(java.util.List.of());
+
+        service.publishResult("flow-1", "v1.0");
+
+        ArgumentCaptor<Wrapper<WorkflowVersion>> lookup = ArgumentCaptor.forClass(Wrapper.class);
+        verify(workflowVersionMapper).selectList(lookup.capture());
+        assertActiveVersionFilter(lookup.getValue());
+    }
+
+    private void assertActiveVersionFilter(Wrapper<WorkflowVersion> wrapper) {
+        assertThat(wrapper.getSqlSegment()).contains("deleted =");
+        assertThat(((AbstractWrapper<?, ?, ?>) wrapper).getParamNameValuePairs().values())
+                .contains(1L)
+                .doesNotContain(false, 0, 0L);
+    }
+
     @Test
     void boundBotResultUpdateRejectsMismatchedFlow() {
         WorkflowVersion storedVersion = version(99L, "victim-flow");
```

**File**: `console/backend/toolkit/src/test/java/com/iflytek/astron/console/toolkit/service/workflow/VersionServiceBoundBotPublishTest.java` (modified, +4/-1)
```diff
@@ -18,6 +18,7 @@
 import org.junit.jupiter.api.Test;
 import org.junit.jupiter.api.extension.ExtendWith;
 import org.mockito.Mock;
+import org.mockito.ArgumentCaptor;
 import org.mockito.junit.jupiter.MockitoExtension;
 import org.springframework.mock.web.MockHttpServletRequest;
 import org.springframework.web.context.request.RequestContextHolder;
@@ -158,7 +159,9 @@ void createForBoundBotPublishShouldAllowCurrentTeamMember() {
                 any(), any(), org.mockito.ArgumentMatchers.eq("current-member"),
                 org.mockito.ArgumentMatchers.eq(1L));
         verify(versionService).updateIsVersionForFlowId("flow-1");
-        verify(workflowVersionMapper).insert(any(WorkflowVersion.class));
+        ArgumentCaptor<WorkflowVersion> insertedVersion = ArgumentCaptor.forClass(WorkflowVersion.class);
+        verify(workflowVersionMapper).insert(insertedVersion.capture());
+        assertThat(insertedVersion.getValue().getDeleted()).isEqualTo(1L);
     }
 
     @Test
```

---

### Incident Patch 2: `5e758547` (2026-09-10)
**Commit Message**: fix(workflow): reduce trace payload size for long conversations (#1675)

* fix(workflow): reduce trace payload size for long conversations

Signed-off-by: yjlu12 <[REDACTED_EMAIL]>

* refactor(workflow): split legacy trace encoding helper

Signed-off-by: yjlu12 <[REDACTED_EMAIL]>

---------

Signed-off-by: yjlu12 <[REDACTED_EMAIL]>

**File**: `core/workflow/extensions/otlp/log_trace/workflow_log.py` (modified, +37/-38)
```diff
@@ -19,6 +19,19 @@
 from workflow.extensions.otlp.log_trace.node_log import NodeLog
 
 
+def _encode_legacy_trace_data(data: Any, depth: int = 0) -> Any:
+    """Preserve the depth-limited JSON representation expected by Console."""
+    if depth > 4 and not isinstance(data, str):
+        return json.dumps(data, ensure_ascii=False)
+
+    if isinstance(data, dict):
+        return {k: _encode_legacy_trace_data(v, depth + 1) for k, v in data.items()}
+    elif isinstance(data, list):
+        return [_encode_legacy_trace_data(item, depth + 1) for item in data]
+    else:
+        return data
+
+
 class Status(BaseModel):
     """
     Execution status information.
@@ -202,46 +215,32 @@ def to_json(self) -> str:
 
         :return: JSON string representation of the workflow log
         """
-        import sys
-
-        def is_large_string(s: str, limit: int = 5 * 1024) -> bool:
-            """
-            Check if a string exceeds the size limit for direct JSON inclusion.
-
-            :param s: String to check
-            :param limit: Size limit in bytes (default: 5KB)
-            :return: True if string exceeds limit, False otherwise
-            """
-            return isinstance(s, str) and sys.getsizeof(s.encode("utf-8")) > limit
-
-        def process_data(data: dict, depth: int = 0) -> Any:
-            """
-            Recursively process data structure to handle large strings.
-
-            :param data: Data structure to process
-            :param depth: Current depth of the data structure
-            :return: Processed data with large strings uploaded to OSS
-            """
-            if depth > 4 and not isinstance(data, str):
-                return json.dumps(data, ensure_ascii=False)
+        uploaded_values: dict[str, str] = {}
 
+        def externalize_large_strings(data: Any) -> Any:
+            """Handle large values before the legacy depth-limited encoding."""
             if isinstance(data, dict):
-                return {k: process_data(v, depth + 1) for k, v in data.items()}
-            elif isinstance(data, list):
-                return [process_data(item, depth + 1) for item in data]
-            elif isinstance(data, str):
-                if is_large_string(data):
-                    return get_oss_service().upload_file(
-                        f"{uuid.uuid4().hex}.txt",
-                        data.encode("utf-8"),
-                        bucket_name=os.getenv("OSS_BUCKET_NAME", "test"),
-                    )
-                else:
-                    return data
-            else:
-                return data
-
-        result = process_data(self.model_dump(mode="json"))
+                return {k: externalize_large_strings(v) for k, v in data.items()}
+            if isinstance(data, list):
+                return [externalize_large_strings(item) for item in data]
+            if isinstance(data, str):
+                encoded = data.encode("utf-8")
+                if len(encoded) > 5 * 1024:
+                    if data not in uploaded_values:
+                        uploaded_values[data] = get_oss_service().upload_file(
+                            f"{uuid.uuid4().hex}.txt",
+                            encoded,
+                            bucket_name=os.getenv("OSS_BUCKET_NAME", "test"),
+                        )
+                    return uploaded_values[data]
+            return data
+
+        # input_vars/output_vars entries become JSON strings at depth five.
+        # Visit their values first so the name/value wrappers stay readable by
+        # Console while large values no longer bypass object-storage offload.
+        result = _encode_legacy_trace_data(
+            externalize_large_strings(self.model_dump(mode="json"))
+        )
 
         def json_fallback(obj: Any) -> Any:
             """
```

**File**: `core/workflow/infra/providers/llm/openai/openai_chat_llm.py` (modified, +21/-3)
```diff
@@ -343,15 +343,33 @@ async def achat(  # noqa: C901
                 )
 
             # Process streaming messages and yield responses
+            frame_count = 0
+            finish_reason = None
+            summary_logged = False
             async for msg in self._recv_messages(
                 url, user_message, extra_params, span, timeout
             ):
-                # Log message data if trace logger is provided
-                if event_log_node_trace:
+                frame_count += 1
+                choices = msg.msg.get("choices") or []
+                if choices:
+                    finish_reason = choices[0].get("finish_reason") or finish_reason
+                if (
+                    event_log_node_trace
+                    and not summary_logged
+                    and finish_reason == ChatStatus.FINISH_REASON.value
+                ):
+                    # Consumers stop at this frame without exhausting the generator.
                     event_log_node_trace.add_info_log(
-                        json.dumps(msg.msg, ensure_ascii=False)
+                        f"LLM stream completed: frame_count={frame_count}"
                     )
+                    summary_logged = True
                 yield msg
+
+            # Final output is recorded by the node; keep stream diagnostics bounded.
+            if event_log_node_trace and not summary_logged and not finish_reason:
+                event_log_node_trace.add_info_log(
+                    f"LLM stream completed: frame_count={frame_count}"
+                )
         except CustomException as e:
             # Re-raise custom exceptions as-is
             raise e
```

**File**: `core/workflow/service/ops_service.py` (modified, +20/-2)
```diff
@@ -35,15 +35,33 @@ def _report() -> None:
         workflow_log.set_status(code=code, message=message)
         workflow_log.set_end()
 
+        stage = "serialize"
+        payload_bytes = 0
         try:
             # Get Kafka topic from environment variables
             topic = os.getenv("KAFKA_TOPIC") or ""
             # Send workflow log as JSON to Kafka topic
             workflow_data = workflow_log.to_json()
-            logger.info(f"Workflow trace data: {workflow_data}")
+            payload_bytes = len(workflow_data.encode("utf-8"))
+            logger.info(
+                "Workflow trace prepared: sid={}, flow_id={}, payload_bytes={}, nodes={}",
+                workflow_log.sid,
+                workflow_log.flow_id,
+                payload_bytes,
+                len(workflow_log.trace),
+            )
+            stage = "kafka_send"
             get_kafka_producer_service().send(topic, workflow_data)
         except Exception as err:
-            logger.error("Failed to produce message: {}".format(err))
+            logger.error(
+                "Failed to produce message: sid={}, flow_id={}, stage={}, "
+                "payload_bytes={}, error={}",
+                workflow_log.sid,
+                workflow_log.flow_id,
+                stage,
+                payload_bytes,
+                err,
+            )
 
     # Create and start daemon thread for asynchronous reporting
     thread = threading.Thread(target=_report, daemon=True)
```

**File**: `core/workflow/tests/extensions/test_workflow_log.py` (added, +261/-0)
```diff
@@ -0,0 +1,261 @@
+import json
+from typing import Any
+
+import pytest
+
+from workflow.extensions.otlp.log_trace import workflow_log as workflow_log_module
+from workflow.extensions.otlp.log_trace.node_log import NodeLog
+from workflow.extensions.otlp.log_trace.workflow_log import WorkflowLog
+
+
+class RecordingStorage:
+    def __init__(self) -> None:
+        self.uploads: list[tuple[str, bytes, str | None]] = []
+
+    def upload_file(
+        self, filename: str, file_bytes: bytes, bucket_name: str | None = None
+    ) -> str:
+        self.uploads.append((filename, file_bytes, bucket_name))
+        return f"https://trace.invalid/{len(self.uploads)}.txt"
+
+
+@pytest.fixture
+def storage(monkeypatch: pytest.MonkeyPatch) -> RecordingStorage:
+    service = RecordingStorage()
+    monkeypatch.setattr(workflow_log_module, "get_oss_service", lambda: service)
+    monkeypatch.setenv("OSS_BUCKET_NAME", "trace-test")
+    return service
+
+
+def decode_variables(data: dict[str, Any], field: str) -> dict[str, Any]:
+    assert isinstance(data[field], list)
+    assert all(isinstance(variable, str) for variable in data[field])
+    return {
+        variable["name"]: variable["value"]
+        for variable in (json.loads(raw) for raw in data[field])
+    }
+
+
+def test_deep_variables_externalize_values_without_losing_wrappers(
+    storage: RecordingStorage,
+) -> None:
+    content = "中文输出" * 2048
+    node = NodeLog(sid="sid", id="node-log", node_id="spark-llm::1")
+    node.append_input_data("history", content)
+    node.append_output_data("answer", content)
+    node.append_output_data("short_answer", "正常")
+    workflow = WorkflowLog(sid="sid", flow_id="flow", trace=[node])
+
+    payload = json.loads(workflow.to_json())
+    data = payload["trace"][0]["data"]
+
+    assert decode_variables(data, "input_vars") == {
+        "history": "https://trace.invalid/1.txt"
+    }
+    assert decode_variables(data, "output_vars") == {
+        "answer": "https://trace.invalid/1.txt",
+        "short_answer": "正常",
+    }
+    assert data["input"] == {}
+    assert data["output"] == {}
+    assert len(storage.uploads) == 1
+    assert storage.uploads[0][1:] == (content.encode("utf-8"), "trace-test")
+
+
+def test_nested_messages_keep_their_structure_after_one_json_decode(
+    storage: RecordingStorage,
+) -> None:
+    content = "历史会话" * 2048
+    messages = [
+        {"role": "system", "content": "system prompt"},
+        {
+            "role": "user",
+            "content": [
+                {"type": "text", "text": content},
+                {"type": "image_url", "image_url": {"url": "https://image.invalid/a"}},
+            ],
+        },
+    ]
+    node = NodeLog(sid="sid")
+    node.append_config_data({"message": messages})
+    workflow = WorkflowLog(sid="sid", flow_id="flow", trace=[node])
+
+    payload = json.loads(workflow.to_json())
+    encoded_messages = payload["trace"][0]["data"]["config"]["message"]
+
+    assert isinstance(encoded_messages, str)
+    assert json.loads(encoded_messages) == [
+        {"role": "system", "content": "system prompt"},
+        {
+            "role": "user",
+            "content": [
+                {"type": "text", "text": "https://trace.invalid/1.txt"},
+                {"type": "image_url", "image_url": {"url": "https://image.invalid/a"}},
+            ],
+        },
+    ]
+    assert len(storage.uploads) == 1
+
+
+@pytest.mark.parametrize(
+    ("content", "should_upload"),
+    [
+        ("a" * 5120, False),
+        ("a" * 5121, True),
+        ("中" * 1706 + "ab", False),
+        ("中" * 1707, True),
+    ],
+    ids=["ascii-at-limit", "ascii-over-limit", "utf8-at-limit", "utf8-over-limit"],
+)
+def test_externalization_limit_counts_utf8_bytes(
+    storage: RecordingStorage, content: str, should_upload: bool
+) -> None:
+    node = NodeLog(sid="sid")
+    node.append_output_data("answer", content)
+    workflow = WorkflowLog(sid="sid", flow_id="flow", trace=[node])
+
+    payload = json.loads(workflow.to_json())
+    value = decode_variables(payload["trace"][0]["data"], "output_vars")["answer"]
+
+    assert value == ("https://trace.invalid/1.txt" if should_upload else content)
+    assert len(storage.uploads) == int(should_upload)
+
+
+def test_duplicate_content_uploads_once_per_serialization_and_preserves_model(
+    storage: RecordingStorage,
+) -> None:
+    content = "重复内容" * 2048
+    node = NodeLog(sid="sid", llm_output=content)
+    node.append_input_data("history", content)
+    node.append_output_data("answer", content)
+    node.append_config_data({"message": [{"role": "assistant", "content": content}]})
+    workflow = WorkflowLog(sid="sid", flow_id="flow", answer=content, trace=[node])
+    before = workflow.model_dump(mode="json")
+
+    first = json.loads(workflow.to_json())
+
+    assert len(storage.uploads) == 1
+    assert first["answer"] == first["trace"][0]["llm_output"]
+    assert (
+        decode_variables(first["trace"][0]["da
```

**File**: `core/workflow/tests/infra/providers/llm/test_openai_chat_llm.py` (modified, +149/-1)
```diff
@@ -1,16 +1,19 @@
 """Tests for the OpenAI-compatible chat provider."""
 
 import importlib
+import json
 import sys
-from typing import TYPE_CHECKING, Any
+from typing import TYPE_CHECKING, Any, AsyncIterator
 
 import pytest
 from openai.types.chat import ChatCompletionChunk
 
 from workflow.consts.engine.chat_status import SparkLLMStatus
+from workflow.engine.nodes.entities.llm_response import LLMResponse
 from workflow.engine.nodes.util.frame_processor import OpenAIFrameProcessor
 from workflow.exception.e import CustomException
 from workflow.exception.errors.err_code import CodeEnum
+from workflow.extensions.otlp.log_trace.node_log import NodeLog
 
 OPENAI_CHAT_MODULE = "workflow.infra.providers.llm.openai.openai_chat_llm"
 if getattr(sys.modules.get(OPENAI_CHAT_MODULE), "__spec__", None) is None:
@@ -39,9 +42,15 @@ async def __anext__(self) -> ChatCompletionChunk:
 
 
 class RecordingSpan:
+    def __init__(self) -> None:
+        self.exceptions: list[Exception] = []
+
     async def add_info_events_async(self, _: dict[str, Any]) -> None:
         pass
 
+    def record_exception(self, error: Exception) -> None:
+        self.exceptions.append(error)
+
 
 def build_openai_chat_ai() -> OpenAIChatAI:
     return OpenAIChatAI(
@@ -197,3 +206,142 @@ async def test_process_stream_rejects_response_without_sse_chunks() -> None:
 
     assert exc_info.value.code == CodeEnum.OPEN_AI_REQUEST_ERROR.code
     assert exc_info.value.cause_error == "LLM stream returned no data"
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("frame_count", [3, 3000])
+@pytest.mark.parametrize("stream_end", ["stop", "break_on_stop", "eof"])
+async def test_achat_keeps_trace_small_and_preserves_stream_frames(
+    monkeypatch: pytest.MonkeyPatch, frame_count: int, stream_end: str
+) -> None:
+    chat_ai = build_openai_chat_ai()
+    node_log = NodeLog(sid="test-sid")
+    frames = [
+        LLMResponse(
+            {
+                "id": f"frame-{index}",
+                "choices": [
+                    {
+                        "delta": {
+                            "content": "response-content-" * 100,
+                            "reasoning_content": f"reasoning-{index}",
+                        },
+                        "finish_reason": (
+                            "stop"
+                            if index == frame_count - 1 and stream_end != "eof"
+                            else None
+                        ),
+                    }
+                ],
+                "usage": {"total_tokens": index + 1},
+            }
+        )
+        for index in range(frame_count)
+    ]
+    original_payloads = json.dumps([frame.msg for frame in frames])
+
+    async def recv_messages(
+        _self: OpenAIChatAI, *_args: Any, **_kwargs: Any
+    ) -> AsyncIterator[LLMResponse]:
+        for frame in frames:
+            yield frame
+
+    monkeypatch.setattr(OpenAIChatAI, "_recv_messages", recv_messages)
+
+    stream = chat_ai.achat(
+        flow_id="test-flow",
+        user_message=[{"role": "user", "content": "test question"}],
+        span=RecordingSpan(),  # type: ignore[arg-type]
+        event_log_node_trace=node_log,
+    )
+    received = []
+    try:
+        async for response in stream:
+            received.append(response)
+            if (
+                stream_end == "break_on_stop"
+                and chat_ai.decode_message(response.msg)[0] == "stop"
+            ):
+                break
+
+        assert received == frames
+        assert json.dumps([frame.msg for frame in received]) == original_payloads
+        assert len(json.dumps(node_log.logs).encode("utf-8")) < 512
+        assert len(node_log.logs) == 1
+        assert f"frame_count={frame_count}" in json.loads(node_log.logs[0])["message"]
+        assert "response-content-" not in node_log.logs[0]
+    finally:
+        await stream.aclose()
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("finish_reason", ["length", "content_filter"])
+async def test_achat_does_not_log_success_for_abnormal_finish_reason(
+    monkeypatch: pytest.MonkeyPatch, finish_reason: str
+) -> None:
+    node_log = NodeLog(sid="test-sid")
+    frame = LLMResponse(
+        {"choices": [{"delta": {"content": ""}, "finish_reason": finish_reason}]}
+    )
+
+    async def recv_messages(
+        _self: OpenAIChatAI, *_args: Any, **_kwargs: Any
+    ) -> AsyncIterator[LLMResponse]:
+        yield frame
+
+    monkeypatch.setattr(OpenAIChatAI, "_recv_messages", recv_messages)
+    received = [
+        response
+        async for response in build_openai_chat_ai().achat(
+            flow_id="test-flow",
+            user_message=[],
+            span=RecordingSpan(),  # type: ignore[arg-type]
+            event_log_node_trace=node_log,
+        )
+    ]
+
+    assert received == [frame]
+    assert node_log.logs == []
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("custom_error", [True, False])
+async def test_achat_preserves_errors_after_partial_st
```

**File**: `core/workflow/tests/service/test_ops_service.py` (added, +119/-0)
```diff
@@ -0,0 +1,119 @@
+import json
+from types import SimpleNamespace
+from typing import Any
+from unittest.mock import Mock
+
+import pytest
+
+from workflow.extensions.otlp.log_trace.node_log import NodeLog
+from workflow.extensions.otlp.log_trace.workflow_log import WorkflowLog
+from workflow.extensions.otlp.trace.span import Span
+from workflow.service import ops_service
+
+
+class RecordingLogger:
+    def __init__(self) -> None:
+        self.messages: list[str] = []
+
+    def info(self, message: str, *args: Any) -> None:
+        self.messages.append(message.format(*args))
+
+    def error(self, message: str, *args: Any) -> None:
+        self.messages.append(message.format(*args))
+
+
+@pytest.fixture
+def report_dependencies(
+    monkeypatch: pytest.MonkeyPatch,
+) -> tuple[Mock, RecordingLogger]:
+    class ImmediateThread:
+        def __init__(self, *, target: Any, daemon: bool) -> None:
+            self.target = target
+            assert daemon is True
+
+        def start(self) -> None:
+            self.target()
+
+    producer = Mock()
+    logger = RecordingLogger()
+    # Patch the module binding rather than the shared threading.Thread object.
+    monkeypatch.setattr(
+        ops_service, "threading", SimpleNamespace(Thread=ImmediateThread)
+    )
+    monkeypatch.setattr(ops_service, "get_kafka_producer_service", lambda: producer)
+    monkeypatch.setattr(ops_service, "logger", logger)
+    monkeypatch.setenv("KAFKA_TOPIC", "trace-test")
+    return producer, logger
+
+
+def make_workflow() -> WorkflowLog:
+    node = NodeLog(sid="sid-test", id="log-test", node_id="node-end::1")
+    node.append_output_data("answer", "PRIVATE_用户会话正文")
+    return WorkflowLog(
+        sid="sid-test", flow_id="flow-test", answer="PRIVATE_用户会话正文", trace=[node]
+    )
+
+
+def test_report_sends_once_and_logs_only_payload_metadata(
+    report_dependencies: tuple[Mock, RecordingLogger],
+) -> None:
+    producer, logger = report_dependencies
+    workflow = make_workflow()
+
+    ops_service.kafka_report(workflow, Mock(spec=Span))
+
+    producer.send.assert_called_once()
+    topic, serialized = producer.send.call_args.args
+    assert topic == "trace-test"
+    payload = json.loads(serialized)
+    assert payload["answer"] == "PRIVATE_用户会话正文"
+    assert payload["status"] == {"code": 0, "message": "success"}
+    assert payload["trace"][0]["id"] == "log-test"
+    text = "\n".join(logger.messages)
+    assert "sid=sid-test" in text
+    assert "flow_id=flow-test" in text
+    assert f"payload_bytes={len(serialized.encode('utf-8'))}" in text
+    assert "nodes=1" in text
+    assert "PRIVATE_用户会话正文" not in text
+
+
+def test_send_failure_reports_stage_and_bytes_without_retry_or_payload(
+    report_dependencies: tuple[Mock, RecordingLogger],
+) -> None:
+    producer, logger = report_dependencies
+    producer.send.side_effect = RuntimeError("MSG_SIZE_TOO_LARGE")
+
+    ops_service.kafka_report(make_workflow(), Mock(spec=Span))
+
+    producer.send.assert_called_once()
+    serialized = producer.send.call_args.args[1]
+    error = logger.messages[-1]
+    assert "sid=sid-test" in error
+    assert "flow_id=flow-test" in error
+    assert "stage=kafka_send" in error
+    assert f"payload_bytes={len(serialized.encode('utf-8'))}" in error
+    assert "MSG_SIZE_TOO_LARGE" in error
+    assert all("PRIVATE_用户会话正文" not in message for message in logger.messages)
+
+
+def test_serialization_failure_does_not_send_and_identifies_stage(
+    monkeypatch: pytest.MonkeyPatch,
+    report_dependencies: tuple[Mock, RecordingLogger],
+) -> None:
+    producer, logger = report_dependencies
+
+    def fail_serialization(self: WorkflowLog) -> str:
+        raise RuntimeError("storage unavailable")
+
+    monkeypatch.setattr(WorkflowLog, "to_json", fail_serialization)
+
+    ops_service.kafka_report(make_workflow(), Mock(spec=Span))
+
+    producer.send.assert_not_called()
+    error = logger.messages[-1]
+    assert "sid=sid-test" in error
+    assert "flow_id=flow-test" in error
+    assert "stage=serialize" in error
+    assert "payload_bytes=0" in error
+    assert "storage unavailable" in error
+    assert "PRIVATE_用户会话正文" not in error
```

---

### Incident Patch 3: `a3a2da1f` (2026-09-09)
**Commit Message**: Merge pull request #1672 from lyj715824/bugfix/superteam

fix(workflow): preserve code node source escapes

**File**: `core/workflow/engine/nodes/code/executor/langchain/langchain_executor.py` (modified, +59/-18)
```diff
@@ -1,4 +1,5 @@
 import os
+import tempfile
 from typing import Any
 
 from langchain_sandbox import PyodideSandbox
@@ -19,6 +20,39 @@
 MAX_ERROR_MESSAGE_LENGTH = 4096
 
 
+class _FilePyodideSandbox(PyodideSandbox):
+    """Use the official CLI file input without rewriting Python escapes.
+
+    langchain-sandbox 0.0.6 only exposes inline code through execute(), and
+    @langchain/pyodide-sandbox 0.0.4 replaces literal backslash-n sequences in
+    that input. Its official -f entry point reads source verbatim instead.
+    Keep the SDK's command, process lifecycle and resource limits, adapting
+    only the input flag until the SDK exposes file input publicly.
+    """
+
+    def __init__(self, source_path: str, **kwargs: Any) -> None:
+        super().__init__(**kwargs)
+        self._source_path = source_path
+
+    def _build_command(
+        self,
+        code: str,
+        *,
+        session_bytes: bytes | None = None,
+        session_metadata: dict | None = None,
+        memory_limit_mb: int | None = None,
+    ) -> list[str]:
+        command = super()._build_command(
+            code,
+            session_bytes=session_bytes,
+            session_metadata=session_metadata,
+            memory_limit_mb=memory_limit_mb,
+        )
+        code_flag_index = command.index("-c")
+        command[code_flag_index : code_flag_index + 2] = ["-f", self._source_path]
+        return command
+
+
 class LangchainExecutor(BaseExecutor):
     """
     Code executor using Langchain Pyodide sandbox.
@@ -42,26 +76,33 @@ async def execute(
         :raises CustomException: If code execution fails
         """
         try:
-            # Keep every Deno permission disabled.  Pyodide's default
-            # node_modules read/write permissions are retained internally by the
-            # official wrapper so it can load its runtime dependencies; user
-            # Python code cannot access the workflow container's filesystem,
-            # environment, network, subprocess, or FFI.
-            sandbox = PyodideSandbox(
-                allow_env=False,
-                allow_read=False,
-                allow_write=False,
-                allow_net=False,
-                allow_run=False,
-                allow_ffi=False,
-            )
             bounded_timeout = _bounded_timeout(timeout)
             bounded_memory_limit = _bounded_memory_limit()
-            result = await sandbox.execute(
-                code,
-                timeout_seconds=bounded_timeout,
-                memory_limit_mb=bounded_memory_limit,
-            )
+            # Grant Deno read access only to this invocation's source file in
+            # addition to the SDK's existing node_modules permissions. File
+            # input preserves escapes, import discovery and top-level await.
+            # The context manager removes the file on success or failure.
+            with tempfile.TemporaryDirectory(prefix="astron-code-") as source_dir:
+                source_path = os.path.realpath(os.path.join(source_dir, "source.py"))
+                # Close the writer before Deno opens the file (also on Windows).
+                with open(
+                    source_path, "w", encoding="utf-8", newline=""
+                ) as source_file:
+                    source_file.write(code)
+                sandbox = _FilePyodideSandbox(
+                    source_path,
+                    allow_env=False,
+                    allow_read=["node_modules", source_path],
+                    allow_write=False,
+                    allow_net=False,
+                    allow_run=False,
+                    allow_ffi=False,
+                )
+                result = await sandbox.execute(
+                    code,
+                    timeout_seconds=bounded_timeout,
+                    memory_limit_mb=bounded_memory_limit,
+                )
             if result.status == "success":
                 return result.stdout if result.stdout else ""
             error_message = (result.stderr or "Code execution failed").strip()
```

**File**: `core/workflow/tests/engine/nodes/test_code_executor_security.py` (modified, +9/-7)
```diff
@@ -66,7 +66,9 @@ class FakeResult:
         stderr = None
 
     class FakeSandbox:
-        def __init__(self, **kwargs: object) -> None:
+        def __init__(self, source_path: str, **kwargs: object) -> None:
+            calls["source_path"] = source_path
+            assert Path(source_path).read_text() == "print('ok')"
             calls["permissions"] = kwargs
 
         async def execute(self, _code: str, **kwargs: object) -> FakeResult:
@@ -75,7 +77,7 @@ async def execute(self, _code: str, **kwargs: object) -> FakeResult:
 
     monkeypatch.setenv("CODE_EXEC_MEMORY_LIMIT_MB", "9999")
     monkeypatch.setattr(
-        "workflow.engine.nodes.code.executor.langchain.langchain_executor.PyodideSandbox",
+        "workflow.engine.nodes.code.executor.langchain.langchain_executor._FilePyodideSandbox",
         FakeSandbox,
     )
 
@@ -86,7 +88,7 @@ async def execute(self, _code: str, **kwargs: object) -> FakeResult:
     assert result == '{"result":"ok"}'
     assert calls["permissions"] == {
         "allow_env": False,
-        "allow_read": False,
+        "allow_read": ["node_modules", calls["source_path"]],
         "allow_write": False,
         "allow_net": False,
         "allow_run": False,
@@ -108,14 +110,14 @@ class FakeResult:
         stderr = "x" * (MAX_ERROR_MESSAGE_LENGTH + 100)
 
     class FakeSandbox:
-        def __init__(self, **_kwargs: object) -> None:
+        def __init__(self, _source_path: str, **_kwargs: object) -> None:
             return None
 
         async def execute(self, _code: str, **_kwargs: object) -> FakeResult:
             return FakeResult()
 
     monkeypatch.setattr(
-        "workflow.engine.nodes.code.executor.langchain.langchain_executor.PyodideSandbox",
+        "workflow.engine.nodes.code.executor.langchain.langchain_executor._FilePyodideSandbox",
         FakeSandbox,
     )
 
@@ -137,14 +139,14 @@ class FakeResult:
         stderr = "Execution timed out after 10 seconds"
 
     class FakeSandbox:
-        def __init__(self, **_kwargs: object) -> None:
+        def __init__(self, _source_path: str, **_kwargs: object) -> None:
             return None
 
         async def execute(self, _code: str, **_kwargs: object) -> FakeResult:
             return FakeResult()
 
     monkeypatch.setattr(
-        "workflow.engine.nodes.code.executor.langchain.langchain_executor.PyodideSandbox",
+        "workflow.engine.nodes.code.executor.langchain.langchain_executor._FilePyodideSandbox",
         FakeSandbox,
     )
 
```

**File**: `core/workflow/tests/engine/nodes/test_langchain_source_transport.py` (added, +231/-0)
```diff
@@ -0,0 +1,231 @@
+import asyncio
+import io
+import json
+from contextlib import redirect_stdout
+from pathlib import Path
+from types import SimpleNamespace
+from typing import Any
+from unittest.mock import AsyncMock, MagicMock
+
+import pytest
+from langchain_sandbox import PyodideSandbox
+
+from workflow.engine.nodes.code.code_node import CodeNode
+from workflow.engine.nodes.code.executor.langchain.langchain_executor import (
+    LangchainExecutor,
+    _FilePyodideSandbox,
+)
+from workflow.exception.e import CustomException
+from workflow.exception.errors.err_code import CodeEnum
+
+
+@pytest.fixture(autouse=True)
+def skip_deno_check(monkeypatch: pytest.MonkeyPatch) -> None:
+    """Exercise the SDK command builder without requiring installed Deno."""
+    original_init = PyodideSandbox.__init__
+
+    def initialize(sandbox: PyodideSandbox, **kwargs: Any) -> None:
+        original_init(sandbox, skip_deno_check=True, **kwargs)
+
+    monkeypatch.setattr(PyodideSandbox, "__init__", initialize)
+
+
+def read_source_at_transport(
+    sandbox: PyodideSandbox, code: str, memory_limit_mb: int | None = None
+) -> tuple[Path, str]:
+    command = sandbox._build_command(code, memory_limit_mb=memory_limit_mb)
+    assert "-c" not in command
+    assert code not in command
+    source_path = Path(command[command.index("-f") + 1])
+    source_bytes = source_path.read_bytes()
+    assert source_bytes == code.encode("utf-8")
+    assert f"--allow-read=node_modules,{source_path}" in command
+    return source_path, source_bytes.decode("utf-8")
+
+
+def test_file_command_preserves_sdk_permissions_limits_and_session(
+    tmp_path: Path,
+) -> None:
+    source = "value = '张三\\n'\r\nprint(value)\r\n"
+    source_path = tmp_path / "source.py"
+    source_path.write_bytes(source.encode("utf-8"))
+    sandbox = _FilePyodideSandbox(
+        str(source_path),
+        stateful=True,
+        allow_env=False,
+        allow_read=["node_modules", str(source_path)],
+        allow_write=False,
+        allow_net=False,
+        allow_run=False,
+        allow_ffi=False,
+    )
+
+    command = sandbox._build_command(
+        source,
+        session_bytes=b"session",
+        session_metadata={"version": 1},
+        memory_limit_mb=256,
+    )
+
+    assert command[:2] == ["deno", "run"]
+    assert [arg for arg in command if arg.startswith("--allow-")] == [
+        f"--allow-read=node_modules,{source_path}",
+        "--allow-write=node_modules",
+    ]
+    assert "--node-modules-dir=auto" in command
+    assert "--v8-flags=--max-old-space-size=256" in command
+    assert "-s" in command
+    assert json.loads(command[command.index("-b") + 1]) == list(b"session")
+    assert json.loads(command[command.index("-m") + 1]) == {"version": 1}
+    assert read_source_at_transport(sandbox, source)[1] == source
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    "data",
+    [
+        '{\n  "name": "张三"\n}',
+        r'{"name": "张三", "text": "first\nsecond"}',
+        "first\r\nsecond\r\n",
+        "张三 says: \"it's fine\"\n'''quoted'''\\folder\\new",
+        {"nested": ["first\nsecond", r"first\nsecond", None, True]},
+    ],
+    ids=["multiline-json", "literal-backslash-n", "crlf", "quotes", "nested"],
+)
+async def test_code_node_preserves_parameter_and_source_escapes(
+    monkeypatch: pytest.MonkeyPatch, data: Any
+) -> None:
+    source_paths: list[Path] = []
+
+    async def execute_fixture(
+        sandbox: PyodideSandbox, code: str, **kwargs: Any
+    ) -> SimpleNamespace:
+        path, source = read_source_at_transport(
+            sandbox, code, kwargs["memory_limit_mb"]
+        )
+        source_paths.append(path)
+        # Only this test's fixed main function is executed by the host Python.
+        # Production execution remains entirely in the SDK's Deno subprocess.
+        output = io.StringIO()
+        with redirect_stdout(output):
+            exec(compile(source, "<transport-fixture>", "exec"), {})
+        return SimpleNamespace(
+            status="success",
+            stdout=output.getvalue(),
+            stderr="",
+        )
+
+    monkeypatch.setenv("CODE_EXEC_TYPE", "langchain")
+    monkeypatch.setattr(PyodideSandbox, "execute", execute_fixture)
+    node = CodeNode(
+        codeLanguage="python",
+        input_identifier=["data"],
+        output_identifier=["result", "newline", "literal", "matches"],
+        code=r"""import re
+def main(data):
+    return {
+        "result": data,
+        "newline": "\n",
+        "literal": r"\n",
+        "matches": re.findall(r"\n", "first\nsecond"),
+    }
+""",
+        appId="app-1",
+        uid="user-1",
+        node_id="ifly-code::source-transport",
+    )
+    span = MagicMock()
+    span.add_info_event_async = AsyncMock()
+
+    result = await node.execute_code({"data": data}, span)
+
+    assert result == {
+        "result": data,
+        "newline": "\n",
+        "literal": r"\n",
+        "matches": ["\n"],
+    }
+    
```

---

### Incident Patch 4: `1291f8bd` (2026-09-08)
**Commit Message**: fix(workflow): preserve code node source escapes

Signed-off-by: yjlu12 <[REDACTED_EMAIL]>

**File**: `core/workflow/engine/nodes/code/executor/langchain/langchain_executor.py` (modified, +59/-18)
```diff
@@ -1,4 +1,5 @@
 import os
+import tempfile
 from typing import Any
 
 from langchain_sandbox import PyodideSandbox
@@ -19,6 +20,39 @@
 MAX_ERROR_MESSAGE_LENGTH = 4096
 
 
+class _FilePyodideSandbox(PyodideSandbox):
+    """Use the official CLI file input without rewriting Python escapes.
+
+    langchain-sandbox 0.0.6 only exposes inline code through execute(), and
+    @langchain/pyodide-sandbox 0.0.4 replaces literal backslash-n sequences in
+    that input. Its official -f entry point reads source verbatim instead.
+    Keep the SDK's command, process lifecycle and resource limits, adapting
+    only the input flag until the SDK exposes file input publicly.
+    """
+
+    def __init__(self, source_path: str, **kwargs: Any) -> None:
+        super().__init__(**kwargs)
+        self._source_path = source_path
+
+    def _build_command(
+        self,
+        code: str,
+        *,
+        session_bytes: bytes | None = None,
+        session_metadata: dict | None = None,
+        memory_limit_mb: int | None = None,
+    ) -> list[str]:
+        command = super()._build_command(
+            code,
+            session_bytes=session_bytes,
+            session_metadata=session_metadata,
+            memory_limit_mb=memory_limit_mb,
+        )
+        code_flag_index = command.index("-c")
+        command[code_flag_index : code_flag_index + 2] = ["-f", self._source_path]
+        return command
+
+
 class LangchainExecutor(BaseExecutor):
     """
     Code executor using Langchain Pyodide sandbox.
@@ -42,26 +76,33 @@ async def execute(
         :raises CustomException: If code execution fails
         """
         try:
-            # Keep every Deno permission disabled.  Pyodide's default
-            # node_modules read/write permissions are retained internally by the
-            # official wrapper so it can load its runtime dependencies; user
-            # Python code cannot access the workflow container's filesystem,
-            # environment, network, subprocess, or FFI.
-            sandbox = PyodideSandbox(
-                allow_env=False,
-                allow_read=False,
-                allow_write=False,
-                allow_net=False,
-                allow_run=False,
-                allow_ffi=False,
-            )
             bounded_timeout = _bounded_timeout(timeout)
             bounded_memory_limit = _bounded_memory_limit()
-            result = await sandbox.execute(
-                code,
-                timeout_seconds=bounded_timeout,
-                memory_limit_mb=bounded_memory_limit,
-            )
+            # Grant Deno read access only to this invocation's source file in
+            # addition to the SDK's existing node_modules permissions. File
+            # input preserves escapes, import discovery and top-level await.
+            # The context manager removes the file on success or failure.
+            with tempfile.TemporaryDirectory(prefix="astron-code-") as source_dir:
+                source_path = os.path.realpath(os.path.join(source_dir, "source.py"))
+                # Close the writer before Deno opens the file (also on Windows).
+                with open(
+                    source_path, "w", encoding="utf-8", newline=""
+                ) as source_file:
+                    source_file.write(code)
+                sandbox = _FilePyodideSandbox(
+                    source_path,
+                    allow_env=False,
+                    allow_read=["node_modules", source_path],
+                    allow_write=False,
+                    allow_net=False,
+                    allow_run=False,
+                    allow_ffi=False,
+                )
+                result = await sandbox.execute(
+                    code,
+                    timeout_seconds=bounded_timeout,
+                    memory_limit_mb=bounded_memory_limit,
+                )
             if result.status == "success":
                 return result.stdout if result.stdout else ""
             error_message = (result.stderr or "Code execution failed").strip()
```

**File**: `core/workflow/tests/engine/nodes/test_code_executor_security.py` (modified, +9/-7)
```diff
@@ -66,7 +66,9 @@ class FakeResult:
         stderr = None
 
     class FakeSandbox:
-        def __init__(self, **kwargs: object) -> None:
+        def __init__(self, source_path: str, **kwargs: object) -> None:
+            calls["source_path"] = source_path
+            assert Path(source_path).read_text() == "print('ok')"
             calls["permissions"] = kwargs
 
         async def execute(self, _code: str, **kwargs: object) -> FakeResult:
@@ -75,7 +77,7 @@ async def execute(self, _code: str, **kwargs: object) -> FakeResult:
 
     monkeypatch.setenv("CODE_EXEC_MEMORY_LIMIT_MB", "9999")
     monkeypatch.setattr(
-        "workflow.engine.nodes.code.executor.langchain.langchain_executor.PyodideSandbox",
+        "workflow.engine.nodes.code.executor.langchain.langchain_executor._FilePyodideSandbox",
         FakeSandbox,
     )
 
@@ -86,7 +88,7 @@ async def execute(self, _code: str, **kwargs: object) -> FakeResult:
     assert result == '{"result":"ok"}'
     assert calls["permissions"] == {
         "allow_env": False,
-        "allow_read": False,
+        "allow_read": ["node_modules", calls["source_path"]],
         "allow_write": False,
         "allow_net": False,
         "allow_run": False,
@@ -108,14 +110,14 @@ class FakeResult:
         stderr = "x" * (MAX_ERROR_MESSAGE_LENGTH + 100)
 
     class FakeSandbox:
-        def __init__(self, **_kwargs: object) -> None:
+        def __init__(self, _source_path: str, **_kwargs: object) -> None:
             return None
 
         async def execute(self, _code: str, **_kwargs: object) -> FakeResult:
             return FakeResult()
 
     monkeypatch.setattr(
-        "workflow.engine.nodes.code.executor.langchain.langchain_executor.PyodideSandbox",
+        "workflow.engine.nodes.code.executor.langchain.langchain_executor._FilePyodideSandbox",
         FakeSandbox,
     )
 
@@ -137,14 +139,14 @@ class FakeResult:
         stderr = "Execution timed out after 10 seconds"
 
     class FakeSandbox:
-        def __init__(self, **_kwargs: object) -> None:
+        def __init__(self, _source_path: str, **_kwargs: object) -> None:
             return None
 
         async def execute(self, _code: str, **_kwargs: object) -> FakeResult:
             return FakeResult()
 
     monkeypatch.setattr(
-        "workflow.engine.nodes.code.executor.langchain.langchain_executor.PyodideSandbox",
+        "workflow.engine.nodes.code.executor.langchain.langchain_executor._FilePyodideSandbox",
         FakeSandbox,
     )
 
```

**File**: `core/workflow/tests/engine/nodes/test_langchain_source_transport.py` (added, +231/-0)
```diff
@@ -0,0 +1,231 @@
+import asyncio
+import io
+import json
+from contextlib import redirect_stdout
+from pathlib import Path
+from types import SimpleNamespace
+from typing import Any
+from unittest.mock import AsyncMock, MagicMock
+
+import pytest
+from langchain_sandbox import PyodideSandbox
+
+from workflow.engine.nodes.code.code_node import CodeNode
+from workflow.engine.nodes.code.executor.langchain.langchain_executor import (
+    LangchainExecutor,
+    _FilePyodideSandbox,
+)
+from workflow.exception.e import CustomException
+from workflow.exception.errors.err_code import CodeEnum
+
+
+@pytest.fixture(autouse=True)
+def skip_deno_check(monkeypatch: pytest.MonkeyPatch) -> None:
+    """Exercise the SDK command builder without requiring installed Deno."""
+    original_init = PyodideSandbox.__init__
+
+    def initialize(sandbox: PyodideSandbox, **kwargs: Any) -> None:
+        original_init(sandbox, skip_deno_check=True, **kwargs)
+
+    monkeypatch.setattr(PyodideSandbox, "__init__", initialize)
+
+
+def read_source_at_transport(
+    sandbox: PyodideSandbox, code: str, memory_limit_mb: int | None = None
+) -> tuple[Path, str]:
+    command = sandbox._build_command(code, memory_limit_mb=memory_limit_mb)
+    assert "-c" not in command
+    assert code not in command
+    source_path = Path(command[command.index("-f") + 1])
+    source_bytes = source_path.read_bytes()
+    assert source_bytes == code.encode("utf-8")
+    assert f"--allow-read=node_modules,{source_path}" in command
+    return source_path, source_bytes.decode("utf-8")
+
+
+def test_file_command_preserves_sdk_permissions_limits_and_session(
+    tmp_path: Path,
+) -> None:
+    source = "value = '张三\\n'\r\nprint(value)\r\n"
+    source_path = tmp_path / "source.py"
+    source_path.write_bytes(source.encode("utf-8"))
+    sandbox = _FilePyodideSandbox(
+        str(source_path),
+        stateful=True,
+        allow_env=False,
+        allow_read=["node_modules", str(source_path)],
+        allow_write=False,
+        allow_net=False,
+        allow_run=False,
+        allow_ffi=False,
+    )
+
+    command = sandbox._build_command(
+        source,
+        session_bytes=b"session",
+        session_metadata={"version": 1},
+        memory_limit_mb=256,
+    )
+
+    assert command[:2] == ["deno", "run"]
+    assert [arg for arg in command if arg.startswith("--allow-")] == [
+        f"--allow-read=node_modules,{source_path}",
+        "--allow-write=node_modules",
+    ]
+    assert "--node-modules-dir=auto" in command
+    assert "--v8-flags=--max-old-space-size=256" in command
+    assert "-s" in command
+    assert json.loads(command[command.index("-b") + 1]) == list(b"session")
+    assert json.loads(command[command.index("-m") + 1]) == {"version": 1}
+    assert read_source_at_transport(sandbox, source)[1] == source
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    "data",
+    [
+        '{\n  "name": "张三"\n}',
+        r'{"name": "张三", "text": "first\nsecond"}',
+        "first\r\nsecond\r\n",
+        "张三 says: \"it's fine\"\n'''quoted'''\\folder\\new",
+        {"nested": ["first\nsecond", r"first\nsecond", None, True]},
+    ],
+    ids=["multiline-json", "literal-backslash-n", "crlf", "quotes", "nested"],
+)
+async def test_code_node_preserves_parameter_and_source_escapes(
+    monkeypatch: pytest.MonkeyPatch, data: Any
+) -> None:
+    source_paths: list[Path] = []
+
+    async def execute_fixture(
+        sandbox: PyodideSandbox, code: str, **kwargs: Any
+    ) -> SimpleNamespace:
+        path, source = read_source_at_transport(
+            sandbox, code, kwargs["memory_limit_mb"]
+        )
+        source_paths.append(path)
+        # Only this test's fixed main function is executed by the host Python.
+        # Production execution remains entirely in the SDK's Deno subprocess.
+        output = io.StringIO()
+        with redirect_stdout(output):
+            exec(compile(source, "<transport-fixture>", "exec"), {})
+        return SimpleNamespace(
+            status="success",
+            stdout=output.getvalue(),
+            stderr="",
+        )
+
+    monkeypatch.setenv("CODE_EXEC_TYPE", "langchain")
+    monkeypatch.setattr(PyodideSandbox, "execute", execute_fixture)
+    node = CodeNode(
+        codeLanguage="python",
+        input_identifier=["data"],
+        output_identifier=["result", "newline", "literal", "matches"],
+        code=r"""import re
+def main(data):
+    return {
+        "result": data,
+        "newline": "\n",
+        "literal": r"\n",
+        "matches": re.findall(r"\n", "first\nsecond"),
+    }
+""",
+        appId="app-1",
+        uid="user-1",
+        node_id="ifly-code::source-transport",
+    )
+    span = MagicMock()
+    span.add_info_event_async = AsyncMock()
+
+    result = await node.execute_code({"data": data}, span)
+
+    assert result == {
+        "result": data,
+        "newline": "\n",
+        "literal": r"\n",
+        "matches": ["\n"],
+    }
+    
```

---

### Incident Patch 5: `189600dd` (2026-09-01)
**Commit Message**: fix(security): prevent SSRF in outbound plugin requests (#1669)

* fix(security): prevent SSRF in outbound plugin requests

Validate URLs, resolved addresses, redirects, and download targets across the console, link plugin, and AI tools. Preserve only narrowly scoped internal storage access and add regression coverage for rebinding and parser edge cases.

Signed-off-by: yjlu12 <[REDACTED_EMAIL]>

* chore(console): apply Spotless formatting

Signed-off-by: yjlu12 <[REDACTED_EMAIL]>

---------

Signed-off-by: yjlu12 <[REDACTED_EMAIL]>

**File**: `console/backend/toolkit/src/main/java/com/iflytek/astron/console/toolkit/service/tool/ToolBoxService.java` (modified, +4/-3)
```diff
@@ -171,9 +171,10 @@ public ToolBox createTool(ToolBoxDto toolBoxDto) {
         } else {
             toolBox = new ToolBox();
         }
-        // Validate endpoint URL legality
-        if (StringUtils.isNotBlank(toolBox.getEndPoint())) {
-            urlCheckTool.checkUrl(toolBox.getEndPoint());
+        // Validate the endpoint submitted in this request before it is copied to the entity or sent
+        // to the tool service. Validating the existing entity would miss new and changed endpoints.
+        if (StringUtils.isNotBlank(toolBoxDto.getEndPoint())) {
+            urlCheckTool.checkUrl(toolBoxDto.getEndPoint());
         }
         toolBoxDto.setVersion("V1.0");
         String schemaString = buildToolBox(toolBox, toolBoxDto);
```

**File**: `console/backend/toolkit/src/main/java/com/iflytek/astron/console/toolkit/tool/UrlCheckTool.java` (modified, +17/-152)
```diff
@@ -13,7 +13,6 @@
 import java.io.IOException;
 import java.net.*;
 import java.nio.charset.StandardCharsets;
-import java.time.Duration;
 import java.util.*;
 import java.util.regex.Matcher;
 import java.util.regex.Pattern;
@@ -28,18 +27,13 @@
  * <li>Restricts protocols to HTTP/HTTPS;</li>
  * <li>Prohibits user information (user:pass@host format);</li>
  * <li>Rejects IPv6 and IPv4-mapped IPv6 (can be relaxed as needed);</li>
- * <li>Resolves a bounded redirect chain and performs blacklist/whitelist validation on each
- * hop;</li>
+ * <li>Resolves the submitted hostname and performs blacklist/whitelist validation without making an
+ * HTTP request;</li>
  * <li>Blocks common short link domains;</li>
  * <li>Supports IP blacklist, network segment blacklist, and domain whitelist (configuration source:
  * ConfigInfo table).</li>
  * </ul>
  *
- * <p>
- * Note: External public method signatures remain unchanged, internal implementation enhanced for
- * robustness and readability.
- * </p>
- *
  * @author astron-console-toolkit
  */
 @Slf4j
@@ -56,72 +50,13 @@ public class UrlCheckTool {
     private static final String IP_WHITE_CATEGORY = "IP_WHITE_LIST";
 
     // ===== Other constants =====
-    private static final int CONNECT_TIMEOUT_MS = (int) Duration.ofSeconds(5).toMillis();
-    private static final int READ_TIMEOUT_MS = (int) Duration.ofSeconds(5).toMillis();
-    private static final int MAX_REDIRECTS = 5;
     private static final Pattern DOMAIN_PATTERN = Pattern.compile("https?://([^/]+)", Pattern.CASE_INSENSITIVE);
-    private static final Set<Integer> REDIRECT_STATUS_CODES = Set.of(301, 302, 303, 307, 308);
 
     // Common short link domains
     private static final Set<String> SHORT_LINK_DOMAINS = Set.of(
             "bit.ly", "tinyurl.com", "t.co", "rebrandly.com", "is.gd", "t.ly",
             "monojson.com", "t.cn", "url.cn", "dwz.cn");
 
-    /**
-     * Gets the direct redirected URL without following it automatically.
-     *
-     * <p>
-     * Implementation details: Uses HEAD method only, disables auto-follow, and only retrieves the
-     * Location header.
-     * </p>
-     *
-     * @param url the original URL to check for redirects
-     * @return the redirected URL if redirect found, otherwise the original URL
-     */
-    public String getRedirectUrl(String url) {
-        return getRedirectUrl(url, readCsvConfig(IP_WHITE_CATEGORY));
-    }
-
-    protected String getRedirectUrl(String url, List<String> ipWhiteList) {
-        if (StringUtils.isBlank(url))
-            return url;
-
-        try {
-            RedirectLookupResult result = lookupRedirect(url, ipWhiteList);
-            if (REDIRECT_STATUS_CODES.contains(result.statusCode)
-                    && StringUtils.isNotBlank(result.location)) {
-                return new URL(new URL(url), result.location).toString();
-            }
-        } catch (IOException e) {
-            // Use original URL on network exception
-            log.debug("getRedirectUrl error: {}", e.toString());
-        }
-        return url;
-    }
-
-    private RedirectLookupResult lookupRedirect(String url, List<String> ipWhiteList) throws IOException {
-        HttpURLConnection conn = null;
-        try {
-            URL u = toSafeHttpUrl(url);
-            ensurePublicAddresses(u.getHost(), ipWhiteList);
-            URLConnection urlConnection = u.openConnection();
-            if (!(urlConnection instanceof HttpURLConnection httpURLConnection)) {
-                throw new BusinessException(ResponseEnum.TOOLBOX_URL_HTTP_HTTPS_ONLY);
-            }
-            conn = httpURLConnection;
-            conn.setInstanceFollowRedirects(false);
-            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
-            conn.setReadTimeout(READ_TIMEOUT_MS);
-            conn.setRequestMethod("HEAD");
-            int code = conn.getResponseCode();
-            return new RedirectLookupResult(code, conn.getHeaderField("Location"));
-        } finally {
-            if (conn != null) {
-                conn.disconnect();
-            }
-        }
-    }
-
     /**
      * Throws exception if URL host is IPv6 (current policy: disable IPv6). Silently returns on parsing
      * exception (doesn't affect main flow).
@@ -162,17 +97,17 @@ public static void IPv4MappedCheck(String url) {
     }
 
     /**
-     * Blacklist/whitelist validation (considering a bounded redirect chain).
+     * Blacklist/whitelist validation without issuing an outbound request.
      * <ol>
-     * <li>First validate the original URL before any connection;</li>
+     * <li>Validate the original URL syntax and destination policy;</li>
      * <li>Domain in whitelist → allow;</li>
      * <li>Resolve A record to get IPv4/IPv6 (this policy focuses on IPv4 validation);</li>
      * <li>Hit IP blacklist → reject;</li>
      * <li>Hit network segment blacklist (CIDR) → reject;</li>
-     * <li>Then inspect redirects and validate every redirected URL before proceeding.</li>
    
```

**File**: `console/backend/toolkit/src/test/java/com/iflytek/astron/console/toolkit/service/tool/ToolBoxServiceDebugToolTest.java` (modified, +26/-0)
```diff
@@ -33,6 +33,7 @@
 import static org.mockito.Mockito.mockStatic;
 import static org.mockito.Mockito.never;
 import static org.mockito.Mockito.verify;
+import static org.mockito.Mockito.verifyNoInteractions;
 import static org.mockito.Mockito.when;
 
 class ToolBoxServiceDebugToolTest {
@@ -72,9 +73,34 @@ void debugToolV2_allowsTrustedOfficialInternalEndpoint() {
         assertThat(request.getServer()).isEqualTo(INTERNAL_ENDPOINT);
         assertThat(request.getMethod()).isEqualTo("POST");
         assertThat(request.getBody().getString("prompt")).isEqualTo("生成一张小狗的图片");
+        // This client-visible schema flag is informational only and must not grant private-network
+        // access in core-link.
+        assertThat(JSONObject.parseObject(request.getOpenapiSchema())
+                .getJSONObject("info")
+                .getBoolean("x-is-official")).isFalse();
         verify(urlCheckTool, never()).checkUrl(INTERNAL_ENDPOINT);
     }
 
+    @Test
+    void createTool_validatesSubmittedEndpointBeforeBuildingOrSending() {
+        ToolBoxService service = new ToolBoxService();
+        UrlCheckTool urlCheckTool = mock(UrlCheckTool.class);
+        ToolServiceCallHandler toolServiceCallHandler = mock(ToolServiceCallHandler.class);
+        ReflectionTestUtils.setField(service, "urlCheckTool", urlCheckTool);
+        ReflectionTestUtils.setField(service, "toolServiceCallHandler", toolServiceCallHandler);
+        ToolBoxDto dto = new ToolBoxDto();
+        dto.setEndPoint("http://169.254.169.254/latest/meta-data");
+        doThrow(new BusinessException(ResponseEnum.TOOLBOX_URL_ILLEGAL))
+                .when(urlCheckTool)
+                .checkUrl(dto.getEndPoint());
+
+        assertThatThrownBy(() -> service.createTool(dto))
+                .isInstanceOf(BusinessException.class);
+
+        verify(urlCheckTool).checkUrl(dto.getEndPoint());
+        verifyNoInteractions(toolServiceCallHandler);
+    }
+
     @Test
     void debugToolV2_allowsSeededOfficialInternalEndpointWhenOwnerIsNotAdminUid() {
         ToolBoxMapper toolBoxMapper = mock(ToolBoxMapper.class);
```

**File**: `console/backend/toolkit/src/test/java/com/iflytek/astron/console/toolkit/tool/UrlCheckToolTest.java` (modified, +60/-115)
```diff
@@ -6,13 +6,12 @@
 import com.sun.net.httpserver.HttpServer;
 import org.junit.jupiter.api.Test;
 
-import java.lang.reflect.Method;
 import java.net.InetSocketAddress;
-import java.net.URL;
 import java.util.Collections;
 import java.util.List;
-import java.util.Map;
+import java.util.concurrent.atomic.AtomicInteger;
 
+import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
 import static org.junit.jupiter.api.Assertions.assertEquals;
 import static org.junit.jupiter.api.Assertions.assertThrows;
 import static org.mockito.Mockito.mock;
@@ -21,150 +20,110 @@
 class UrlCheckToolTest {
 
     @Test
-    void checkBlackListRejectsTemporaryRedirectToBlacklistedIp() throws Exception {
-        ConfigInfoMapper mapper = mockConfigMapper("169.254.169.254", "");
-        UrlCheckTool tool = new UrlCheckTool(mapper);
-        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
-        server.createContext("/redirect", exchange -> {
-            exchange.getResponseHeaders().set("Location", "http://169.254.169.254/latest/meta-data/");
-            exchange.sendResponseHeaders(307, -1);
-            exchange.close();
-        });
-        server.start();
-        try {
-            String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/redirect";
-            assertThrows(BusinessException.class, () -> tool.checkBlackList(url));
-        } finally {
-            server.stop(0);
-        }
-    }
-
-    @Test
-    void checkBlackListRejectsBlacklistedTargetAfterMultipleRedirects() {
-        ConfigInfoMapper mapper = mockConfigMapper("169.254.169.254", "");
-        UrlCheckTool tool = new RedirectingUrlCheckTool(mapper, Map.of(
-                "http://example.com/start", "http://example.org/hop",
-                "http://example.org/hop", "http://169.254.169.254/latest/meta-data/"));
-
-        assertThrows(BusinessException.class, () -> tool.checkBlackList("http://example.com/start"));
-    }
+    void checkUrlRejectsLoopbackAddressDirectly() {
+        UrlCheckTool tool = new UrlCheckTool(mockConfigMapper("", ""));
 
-    @Test
-    void checkUrlRejectsRedirectToNonHttpProtocol() throws Exception {
-        ConfigInfoMapper mapper = mockConfigMapper("", "");
-        UrlCheckTool tool = new UrlCheckTool(mapper);
-        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
-        server.createContext("/redirect", exchange -> {
-            exchange.getResponseHeaders().set("Location", "file:///etc/passwd");
-            exchange.sendResponseHeaders(302, -1);
-            exchange.close();
-        });
-        server.start();
-        try {
-            String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/redirect";
-            assertThrows(BusinessException.class, () -> tool.checkUrl(url));
-        } finally {
-            server.stop(0);
-        }
+        assertThrows(BusinessException.class,
+                () -> tool.checkUrl("http://127.0.0.1/internal"));
     }
 
     @Test
-    void checkUrlRejectsRedirectWithUserInfo() {
-        ConfigInfoMapper mapper = mockConfigMapper("", "");
-        UrlCheckTool tool = new RedirectingUrlCheckTool(mapper, Map.of(
-                "http://example.com/start", "http://user@example.org/path"));
+    void checkUrlRejectsPrivateAddressOutsideWhitelist() {
+        UrlCheckTool tool = new UrlCheckTool(mockConfigMapper(
+                "", "", "192.168.1.10"));
 
-        assertThrows(BusinessException.class, () -> tool.checkUrl("http://example.com/start"));
+        assertThrows(BusinessException.class,
+                () -> tool.checkUrl("http://169.254.169.254/latest/meta-data"));
     }
 
     @Test
-    void checkBlackListAllowsWhitelistedRedirectTarget() {
-        ConfigInfoMapper mapper = mockConfigMapper(
-                "", "127.0.0.0/8,169.254.0.0/16", "127.0.0.1,169.254.169.254");
-        UrlCheckTool tool = new RedirectingUrlCheckTool(mapper, Map.of(
-                "http://127.0.0.1/start", "http://169.254.169.254/target"));
+    void checkUrlAllowsIpLiteralInWhitelist() {
+        UrlCheckTool tool = new UrlCheckTool(mockConfigMapper(
+                "", "127.0.0.0/8", "127.0.0.1"));
 
-        tool.checkBlackList("http://127.0.0.1/start");
+        assertDoesNotThrow(() -> tool.checkUrl("http://127.0.0.1/allowed"));
     }
 
     @Test
-    void checkBlackListRejectsRedirectTargetOutsideWhitelist() {
-        ConfigInfoMapper mapper = mockConfigMapper(
-                "", "127.0.0.0/8,169.254.0.0/16", "127.0.0.1");
-        UrlCheckTool tool = new RedirectingUrlCheckTool(mapper, Map.of(
-                "http://127.0.0.1/start", "http://169.254.169.254/target"));
+    void checkUrlAllowsIpLiteralInWhitelistCidr() {
+        UrlCheckTool tool = new UrlCheckTool(mockConfigMapper(
+                "", "127.0.0.0/8", "127.0.0.0/8"));
 
-        assertThrows(BusinessException.class,
-                () -> tool.checkBlackList("http://127.0.0.1/start"));

```

**File**: `core/plugin/aitools/common/clients/safe_download.py` (added, +348/-0)
```diff
@@ -0,0 +1,348 @@
+"""SSRF-safe downloads for remote files supplied by API callers."""
+
+import ipaddress
+import math
+import os
+import re
+import socket
+from typing import Callable, Optional, Tuple, Union
+from urllib.parse import SplitResult, unquote_to_bytes, urlsplit
+
+import aiohttp
+from loguru import logger as log
+from plugin.aitools.common.clients.adapters import SpanLike
+from plugin.aitools.common.exceptions.error.code_enums import CodeEnums
+from plugin.aitools.common.exceptions.exceptions import HTTPClientException
+from plugin.aitools.const.const import (
+    AIOHTTP_CLIENT_CONNECT_TIMEOUT_KEY,
+    AIOHTTP_CLIENT_READ_TIMEOUT_KEY,
+    AIOHTTP_CLIENT_TOTAL_TIMEOUT_KEY,
+)
+from yarl import URL
+
+IpAddress = Union[ipaddress.IPv4Address, ipaddress.IPv6Address]
+IpNetwork = Union[ipaddress.IPv4Network, ipaddress.IPv6Network]
+
+_ALLOWED_SCHEMES = {"http", "https"}
+_DOWNLOAD_CHUNK_SIZE = 64 * 1024
+DEFAULT_MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024
+_INVALID_PERCENT_ESCAPE = re.compile(r"%(?![0-9a-fA-F]{2})")
+_S3_BUCKET_PATTERN = re.compile(r"[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]")
+_NEVER_CONNECT_NETWORKS: Tuple[IpNetwork, ...] = tuple(
+    ipaddress.ip_network(value)
+    for value in (
+        "0.0.0.0/8",
+        "192.0.0.0/24",
+        "192.0.2.0/24",
+        "192.88.99.0/24",
+        "198.18.0.0/15",
+        "198.51.100.0/24",
+        "203.0.113.0/24",
+        "240.0.0.0/4",
+        "::/96",
+        "64:ff9b::/96",
+        "64:ff9b:1::/48",
+        "100::/64",
+        "2001::/23",
+        "2001:db8::/32",
+        "2002::/16",
+    )
+)
+
+
+class RemoteResourcePolicyError(ValueError):
+    """Raised when a caller-controlled download target is unsafe."""
+
+
+def create_public_socket_factory(
+    target_url: str,
+) -> Callable[[aiohttp.AddrInfoType], socket.socket]:
+    """Validate the actual address selected by aiohttp before opening its socket."""
+    _, allow_private_storage = _validate_resource_url(target_url)
+
+    def socket_factory(addr_info: aiohttp.AddrInfoType) -> socket.socket:
+        family, type_, proto, _, sockaddr = addr_info
+        try:
+            address = ipaddress.ip_address(sockaddr[0])
+        except ValueError as exc:
+            raise RemoteResourcePolicyError(
+                "Resolved remote resource address is invalid"
+            ) from exc
+        _validate_destination_address(
+            address,
+            allow_private_storage=allow_private_storage,
+        )
+        return socket.socket(family=family, type=type_, proto=proto)
+
+    return socket_factory
+
+
+async def fetch_public_resource(
+    url: str,
+    span: Optional[SpanLike] = None,
+    *,
+    max_bytes: int = DEFAULT_MAX_DOWNLOAD_BYTES,
+) -> bytes:
+    """Download a public or exact trusted-storage resource with SSRF checks."""
+    hostname = "invalid"
+    try:
+        if max_bytes <= 0:
+            raise RemoteResourcePolicyError("Remote resource size limit is invalid")
+        parsed, _ = _validate_resource_url(url)
+        hostname = _normalize_hostname(parsed.hostname or "")
+        connector = aiohttp.TCPConnector(
+            use_dns_cache=False,
+            socket_factory=create_public_socket_factory(url),
+        )
+        timeout = aiohttp.ClientTimeout(
+            total=_positive_float_setting(AIOHTTP_CLIENT_TOTAL_TIMEOUT_KEY, 300.0),
+            connect=_positive_float_setting(AIOHTTP_CLIENT_CONNECT_TIMEOUT_KEY, 10.0),
+            sock_read=_positive_float_setting(AIOHTTP_CLIENT_READ_TIMEOUT_KEY, 60.0),
+        )
+        return await _download_resource(url, connector, timeout, max_bytes)
+    except RemoteResourcePolicyError as exc:
+        log.warning(
+            "Remote resource download rejected, host={}, reason={}", hostname, exc
+        )
+        if span is not None:
+            span.add_error_event("Remote resource download rejected")
+        raise HTTPClientException.from_error_code(
+            CodeEnums.HTTPClientError,
+            extra_message=str(exc),
+        ) from exc
+    except Exception as exc:
+        log.debug(
+            "Remote resource download failed, host={}, error_type={}",
+            hostname,
+            type(exc).__name__,
+        )
+        if span is not None:
+            span.add_error_event("Remote resource download failed")
+        raise HTTPClientException.from_error_code(
+            CodeEnums.HTTPClientError,
+            extra_message="Remote resource download failed",
+        ) from exc
+
+
+async def _download_resource(
+    url: str,
+    connector: aiohttp.TCPConnector,
+    timeout: aiohttp.ClientTimeout,
+    max_bytes: int,
+) -> bytes:
+    async with aiohttp.ClientSession(
+        connector=connector,
+        timeout=timeout,
+        trust_env=False,
+    ) as session:
+        async with session.get(url, allow_redirects=False) as response:
+            if not 200 <= response.status < 300:
+                raise RemoteResourcePolicyError(
+                    f"
```

**File**: `core/plugin/aitools/config.env` (modified, +2/-0)
```diff
@@ -63,6 +63,8 @@ OSS_ENDPOINT=
 OSS_ACCESS_KEY_ID=
 OSS_ACCESS_KEY_SECRET=
 OSS_BUCKET_NAME=
+# Console uploads accepted as caller-controlled OCR/image-understanding inputs.
+OSS_BUCKET_CONSOLE=
 OSS_TTL=
 OSS_TYPE=
 OSS_DOWNLOAD_HOST=
```

**File**: `core/plugin/aitools/pyproject.toml` (modified, +2/-1)
```diff
@@ -12,7 +12,8 @@ dependencies = [
     "python-multipart>=0.0.9",
     "pydantic==2.9.2",
     "openai>=1.40.6",
-    "aiohttp>=3.10.5",
+    "aiohttp>=3.12.15",
+    "yarl>=1.20.1",
     "pymupdf>=1.24.10",
     "pytest>=8.3.3",
     "pillow>=10.3.0",
```

**File**: `core/plugin/aitools/service/image_understanding/image_understanding_service.py` (modified, +23/-26)
```diff
@@ -13,7 +13,7 @@
 from plugin.aitools.api.decorators.api_service import api_service
 from plugin.aitools.api.schemas.types import BaseResponse, SuccessResponse
 from plugin.aitools.common.clients.adapters import SpanLike
-from plugin.aitools.common.clients.aiohttp_client import HttpClient
+from plugin.aitools.common.clients.safe_download import fetch_public_resource
 from plugin.aitools.common.clients.websockets_client import WebSocketClient
 from plugin.aitools.common.exceptions.error.code_enums import CodeEnums
 from plugin.aitools.common.exceptions.exceptions import ServiceException
@@ -30,31 +30,28 @@ class ImageUnderstandingRequest(BaseModel):
 async def gen_params(
     app_id: str | None, question: str, image_url: str, span: Optional[SpanLike]
 ) -> Dict[str, Any]:
-    async with HttpClient("GET", image_url, span).start() as client:
-        async with client.request() as response:
-            imagedata = base64.b64encode(await response.data["content"].read()).decode(  # type: ignore[index]
-                "utf-8"
-            )
-        return {
-            "header": {"app_id": app_id},
-            "parameter": {
-                "chat": {
-                    "domain": "imagev3",
-                    "temperature": 0.5,
-                    "top_k": 4,
-                    "max_tokens": 8192,
-                    "auditing": "default",
-                }
-            },
-            "payload": {
-                "message": {
-                    "text": [
-                        {"role": "user", "content": imagedata, "content_type": "image"},
-                        {"role": "user", "content": question},
-                    ]
-                }
-            },
-        }
+    image_bytes = await fetch_public_resource(image_url, span)
+    imagedata = base64.b64encode(image_bytes).decode("utf-8")
+    return {
+        "header": {"app_id": app_id},
+        "parameter": {
+            "chat": {
+                "domain": "imagev3",
+                "temperature": 0.5,
+                "top_k": 4,
+                "max_tokens": 8192,
+                "auditing": "default",
+            }
+        },
+        "payload": {
+            "message": {
+                "text": [
+                    {"role": "user", "content": imagedata, "content_type": "image"},
+                    {"role": "user", "content": question},
+                ]
+            }
+        },
+    }
 
 
 @api_service(
```

---

### Incident Patch 6: `aaef2a28` (2026-08-30)
**Commit Message**: Merge pull request #1660 from lyj715824/bugfix/superteam

fix(build): use reliable PyPI source for RPA image

**File**: `console/backend/hub/Dockerfile` (modified, +9/-0)
```diff
@@ -1,6 +1,15 @@
 FROM maven:3.9.9-eclipse-temurin-21 AS build
 WORKDIR /backend
 
+# Maven Resolver treats 429/503 responses as transient, but the default retry
+# budget is short for a concurrent multi-architecture build.  Keep the retry
+# policy in the build stage so a temporary Maven Central rate limit does not
+# fail the image, without affecting the runtime container.
+ENV MAVEN_ARGS="-Daether.connector.http.retryHandler.count=6 \
+-Daether.connector.http.retryHandler.interval=10000 \
+-Daether.connector.http.retryHandler.intervalMax=300000 \
+-Daether.connector.http.retryHandler.serviceUnavailable=429,503"
+
 COPY console/backend/pom.xml ./
 COPY console/backend/commons/pom.xml commons/pom.xml
 COPY console/backend/hub/pom.xml hub/pom.xml
```

**File**: `core/plugin/rpa/Dockerfile` (modified, +8/-3)
```diff
@@ -6,14 +6,19 @@ ENV PATH=$PATH:/opt/core
 ENV PYTHONPATH /opt/core
 ENV UV_NO_CACHE=1
 
-RUN pip install uv --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple/
+# Use the official index by default.  The image is built concurrently for two
+# architectures in CI, and public mirrors can reject one of the parallel
+# requests (for example, with HTTP 403).  Builders that require an internal
+# mirror can override this argument without changing the deployment contract.
+ARG PYPI_INDEX_URL=https://pypi.org/simple/
+RUN pip install uv --no-cache-dir --index-url "${PYPI_INDEX_URL}"
 
 COPY core/plugin/rpa/pyproject.toml ./
 COPY core/plugin/rpa/uv.lock ./
 
-RUN uv sync -i https://pypi.tuna.tsinghua.edu.cn/simple/
+RUN uv sync --default-index "${PYPI_INDEX_URL}"
 
 COPY core/common ./common
 COPY core/plugin/rpa ./plugin/rpa
 
-CMD ["uv", "run", "plugin/rpa/main.py"]
\ No newline at end of file
+CMD ["uv", "run", "plugin/rpa/main.py"]
```

---

### Incident Patch 7: `a2d647ed` (2026-08-29)
**Commit Message**: fix(build): retry Maven Central rate limits

Signed-off-by: yjlu12 <[REDACTED_EMAIL]>

**File**: `console/backend/hub/Dockerfile` (modified, +9/-0)
```diff
@@ -1,6 +1,15 @@
 FROM maven:3.9.9-eclipse-temurin-21 AS build
 WORKDIR /backend
 
+# Maven Resolver treats 429/503 responses as transient, but the default retry
+# budget is short for a concurrent multi-architecture build.  Keep the retry
+# policy in the build stage so a temporary Maven Central rate limit does not
+# fail the image, without affecting the runtime container.
+ENV MAVEN_ARGS="-Daether.connector.http.retryHandler.count=6 \
+-Daether.connector.http.retryHandler.interval=10000 \
+-Daether.connector.http.retryHandler.intervalMax=300000 \
+-Daether.connector.http.retryHandler.serviceUnavailable=429,503"
+
 COPY console/backend/pom.xml ./
 COPY console/backend/commons/pom.xml commons/pom.xml
 COPY console/backend/hub/pom.xml hub/pom.xml
```

---

### Incident Patch 8: `c0d980f7` (2026-08-28)
**Commit Message**: fix(build): use reliable PyPI source for RPA image

Signed-off-by: yjlu12 <[REDACTED_EMAIL]>

**File**: `core/plugin/rpa/Dockerfile` (modified, +8/-3)
```diff
@@ -6,14 +6,19 @@ ENV PATH=$PATH:/opt/core
 ENV PYTHONPATH /opt/core
 ENV UV_NO_CACHE=1
 
-RUN pip install uv --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple/
+# Use the official index by default.  The image is built concurrently for two
+# architectures in CI, and public mirrors can reject one of the parallel
+# requests (for example, with HTTP 403).  Builders that require an internal
+# mirror can override this argument without changing the deployment contract.
+ARG PYPI_INDEX_URL=https://pypi.org/simple/
+RUN pip install uv --no-cache-dir --index-url "${PYPI_INDEX_URL}"
 
 COPY core/plugin/rpa/pyproject.toml ./
 COPY core/plugin/rpa/uv.lock ./
 
-RUN uv sync -i https://pypi.tuna.tsinghua.edu.cn/simple/
+RUN uv sync --default-index "${PYPI_INDEX_URL}"
 
 COPY core/common ./common
 COPY core/plugin/rpa ./plugin/rpa
 
-CMD ["uv", "run", "plugin/rpa/main.py"]
\ No newline at end of file
+CMD ["uv", "run", "plugin/rpa/main.py"]
```

---

### Incident Patch 9: `a77c92a9` (2026-08-28)
**Commit Message**: Merge pull request #1655 from lyj715824/bugfix/superteam

fix(docs): make example gallery build in VitePress

**File**: `docs/.vitepress/examples.data.ts` (modified, +6/-9)
```diff
@@ -1,6 +1,6 @@
 // Build-time data loader: reads the community workflow examples under examples/
 // and exposes their metadata to the docs site gallery.
-import { readFileSync } from "node:fs";
+import { existsSync, readFileSync } from "node:fs";
 import { basename, dirname } from "node:path";
 
 export interface ExampleMeta {
@@ -15,17 +15,12 @@ export interface ExampleMeta {
   event: string;
   repoPath: string; // e.g. examples/history-knowledge-qa
   hasPreview: boolean;
-  previewUrl: string;
+  previewPath: string;
 }
 
 declare const data: ExampleMeta[];
 export { data };
 
-const previewAssets = import.meta.glob("../../examples/*/preview.png", {
-  eager: true,
-  import: "default"
-}) as Record<string, string>;
-
 function parseFrontmatter(md: string): Record<string, string | string[]> | null {
   const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
   if (!m) return null;
@@ -64,6 +59,8 @@ export default {
       if (id === "TEMPLATE") continue;
       const fm = parseFrontmatter(readFileSync(file, "utf8"));
       if (!fm || !fm.id) continue;
+      const previewPath = `${dirname(file)}/preview.png`;
+      const hasPreview = existsSync(previewPath);
       examples.push({
         id: String(fm.id),
         title: String(fm.title ?? fm.id),
@@ -75,8 +72,8 @@ export default {
         dslVersion: String(fm.dslVersion ?? ""),
         event: String(fm.event ?? ""),
         repoPath: `examples/${id}`,
-        hasPreview: Boolean(previewAssets[`../../examples/${id}/preview.png`]),
-        previewUrl: previewAssets[`../../examples/${id}/preview.png`] ?? ""
+        hasPreview,
+        previewPath: hasPreview ? `examples/${id}/preview.png` : ""
       });
     }
     return examples.sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
```

**File**: `docs/.vitepress/theme/ExamplesGallery.vue` (modified, +16/-1)
```diff
@@ -3,6 +3,19 @@ import { computed, ref } from "vue";
 import { useData } from "vitepress";
 import { data as examples } from "../examples.data";
 
+const previewAssets = import.meta.glob("../../../examples/*/preview.png", {
+  eager: true,
+  import: "default",
+  query: "?url"
+}) as Record<string, string>;
+
+const previewUrlsById = Object.fromEntries(
+  Object.entries(previewAssets).map(([path, url]) => {
+    const segments = path.split("/");
+    return [segments[segments.length - 2], url];
+  })
+);
+
 const REPO = "https://github.com/iflytek/astron-agent";
 const { lang } = useData();
 const isZh = computed(() => lang.value === "zh-CN");
@@ -38,6 +51,8 @@ const hideBrokenPreview = (id: string): void => {
   failedPreviews.value = new Set(failedPreviews.value).add(id);
 };
 
+const getPreviewUrl = (id: string): string => previewUrlsById[id] ?? "";
+
 const contributeHref = computed(() => (isZh.value ? "/zh/contribute-to-docs" : "/contribute-to-docs"));
 </script>
 
@@ -70,7 +85,7 @@ const contributeHref = computed(() => (isZh.value ? "/zh/contribute-to-docs" : "
         <img
           v-if="e.hasPreview && !failedPreviews.has(e.id)"
           class="exg__preview"
-          :src="e.previewUrl"
+          :src="getPreviewUrl(e.id)"
           :alt="`${e.title} workflow preview`"
           loading="lazy"
           @error="hideBrokenPreview(e.id)"
```

---

### Incident Patch 10: `9a2c15f3` (2026-08-28)
**Commit Message**: fix(docs): resolve VitePress example preview assets

Signed-off-by: yjlu12 <[REDACTED_EMAIL]>

**File**: `docs/.vitepress/examples.data.ts` (modified, +6/-9)
```diff
@@ -1,6 +1,6 @@
 // Build-time data loader: reads the community workflow examples under examples/
 // and exposes their metadata to the docs site gallery.
-import { readFileSync } from "node:fs";
+import { existsSync, readFileSync } from "node:fs";
 import { basename, dirname } from "node:path";
 
 export interface ExampleMeta {
@@ -15,17 +15,12 @@ export interface ExampleMeta {
   event: string;
   repoPath: string; // e.g. examples/history-knowledge-qa
   hasPreview: boolean;
-  previewUrl: string;
+  previewPath: string;
 }
 
 declare const data: ExampleMeta[];
 export { data };
 
-const previewAssets = import.meta.glob("../../examples/*/preview.png", {
-  eager: true,
-  import: "default"
-}) as Record<string, string>;
-
 function parseFrontmatter(md: string): Record<string, string | string[]> | null {
   const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
   if (!m) return null;
@@ -64,6 +59,8 @@ export default {
       if (id === "TEMPLATE") continue;
       const fm = parseFrontmatter(readFileSync(file, "utf8"));
       if (!fm || !fm.id) continue;
+      const previewPath = `${dirname(file)}/preview.png`;
+      const hasPreview = existsSync(previewPath);
       examples.push({
         id: String(fm.id),
         title: String(fm.title ?? fm.id),
@@ -75,8 +72,8 @@ export default {
         dslVersion: String(fm.dslVersion ?? ""),
         event: String(fm.event ?? ""),
         repoPath: `examples/${id}`,
-        hasPreview: Boolean(previewAssets[`../../examples/${id}/preview.png`]),
-        previewUrl: previewAssets[`../../examples/${id}/preview.png`] ?? ""
+        hasPreview,
+        previewPath: hasPreview ? `examples/${id}/preview.png` : ""
       });
     }
     return examples.sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
```

**File**: `docs/.vitepress/theme/ExamplesGallery.vue` (modified, +16/-1)
```diff
@@ -3,6 +3,19 @@ import { computed, ref } from "vue";
 import { useData } from "vitepress";
 import { data as examples } from "../examples.data";
 
+const previewAssets = import.meta.glob("../../../examples/*/preview.png", {
+  eager: true,
+  import: "default",
+  query: "?url"
+}) as Record<string, string>;
+
+const previewUrlsById = Object.fromEntries(
+  Object.entries(previewAssets).map(([path, url]) => {
+    const segments = path.split("/");
+    return [segments[segments.length - 2], url];
+  })
+);
+
 const REPO = "https://github.com/iflytek/astron-agent";
 const { lang } = useData();
 const isZh = computed(() => lang.value === "zh-CN");
@@ -38,6 +51,8 @@ const hideBrokenPreview = (id: string): void => {
   failedPreviews.value = new Set(failedPreviews.value).add(id);
 };
 
+const getPreviewUrl = (id: string): string => previewUrlsById[id] ?? "";
+
 const contributeHref = computed(() => (isZh.value ? "/zh/contribute-to-docs" : "/contribute-to-docs"));
 </script>
 
@@ -70,7 +85,7 @@ const contributeHref = computed(() => (isZh.value ? "/zh/contribute-to-docs" : "
         <img
           v-if="e.hasPreview && !failedPreviews.has(e.id)"
           class="exg__preview"
-          :src="e.previewUrl"
+          :src="getPreviewUrl(e.id)"
           :alt="`${e.title} workflow preview`"
           loading="lazy"
           @error="hideBrokenPreview(e.id)"
```

---

### Incident Patch 11: `e626e94f` (2026-08-28)
**Commit Message**: Merge pull request #1653 from lyj715824/bugfix/superteam

fix(docs): repair Japanese README image path

**File**: `docs/ja/README.md` (modified, +1/-1)
```diff
@@ -133,7 +133,7 @@ docker compose -f docker-compose-with-auth.yaml up -d
 - 👥 WeChat Work グループ:
 
 <div align="center">
-  <img src="./imgs/WeCom_Group.png" alt="WeChat Work グループ" width="300">
+  <img src="../imgs/WeCom_Group.png" alt="WeChat Work グループ" width="300">
 </div>
 
 ## 📄 オープンソースライセンス
```

---

### Incident Patch 12: `59175838` (2026-08-28)
**Commit Message**: fix(docs): correct Japanese README image path

Signed-off-by: yjlu12 <[REDACTED_EMAIL]>

**File**: `docs/ja/README.md` (modified, +1/-1)
```diff
@@ -133,7 +133,7 @@ docker compose -f docker-compose-with-auth.yaml up -d
 - 👥 WeChat Work グループ:
 
 <div align="center">
-  <img src="./imgs/WeCom_Group.png" alt="WeChat Work グループ" width="300">
+  <img src="../imgs/WeCom_Group.png" alt="WeChat Work グループ" width="300">
 </div>
 
 ## 📄 オープンソースライセンス
```

---

### Incident Patch 13: `848daba0` (2026-08-28)
**Commit Message**: Merge pull request #1651 from lyj715824/bugfix/superteam

fix(security): harden internal service boundaries

**File**: `.github/workflows/build-push.yml` (modified, +4/-3)
```diff
@@ -113,9 +113,10 @@ jobs:
           -Dtest=S3ClientUtilMinioPolicyCompatibilityIT test
 
       - name: Verify rendered sandbox credential contract
-        run: >-
-          python3 docker/astronAgent/scripts/verify_security_contract.py
-          --ci-placeholder-required-env
+        run: python3 docker/astronAgent/scripts/verify_security_contract.py
+
+      - name: Verify Helm internal credential contract
+        run: python3 helm/astron-agent/tests/verify_tenant_bootstrap.py
 
   # ============================================================================
   # Stage 2: Build astron Agent Docker Images (Parallel Jobs)
```

**File**: `console/backend/commons/src/main/java/com/iflytek/astron/console/commons/security/TenantInternalApiKey.java` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+package com.iflytek.astron.console.commons.security;
+
+import org.apache.commons.lang3.StringUtils;
+
+import java.util.regex.Pattern;
+
+/** Shared validation and header naming for trusted calls to the core tenant service. */
+public final class TenantInternalApiKey {
+
+    public static final String HEADER = "X-Tenant-Internal-Key";
+
+    private static final int MIN_LENGTH = 32;
+    private static final int MAX_LENGTH = 50;
+    private static final String LEGACY_PUBLIC_SECRET = "NjhmY2NmM2NkZDE4MDFlNmM5ZjcyZjMy";
+    private static final Pattern SAFE_VALUE = Pattern.compile("[A-Za-z0-9._~-]+");
+
+    private TenantInternalApiKey() {}
+
+    /** Return a normalized credential or fail closed before issuing an internal request. */
+    public static String requireConfigured(String configuredValue) {
+        String apiKey = StringUtils.trimToEmpty(configuredValue);
+        if (apiKey.length() < MIN_LENGTH
+                || apiKey.length() > MAX_LENGTH
+                || !SAFE_VALUE.matcher(apiKey).matches()
+                || LEGACY_PUBLIC_SECRET.equals(apiKey)) {
+            throw new IllegalStateException(
+                    "TENANT_SECRET must contain 32-50 safe characters and must not use the published legacy value");
+        }
+        return apiKey;
+    }
+}
```

**File**: `console/backend/commons/src/main/java/com/iflytek/astron/console/commons/security/WorkflowGatewayIdentity.java` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+package com.iflytek.astron.console.commons.security;
+
+import java.nio.charset.StandardCharsets;
+import java.security.GeneralSecurityException;
+import java.util.HexFormat;
+import java.util.Set;
+import javax.crypto.Mac;
+import javax.crypto.spec.SecretKeySpec;
+import org.apache.commons.lang3.StringUtils;
+
+/** Creates short-lived signed workflow identities without disclosing the shared internal key. */
+public final class WorkflowGatewayIdentity {
+
+    public static final String TIMESTAMP_HEADER = "X-Workflow-Gateway-Timestamp";
+    public static final String SIGNATURE_HEADER = "X-Workflow-Gateway-Signature";
+
+    private static final String POST = "POST";
+    private static final String HMAC_SHA_256 = "HmacSHA256";
+    private static final Set<String> PUBLIC_WORKFLOW_PATHS = Set.of(
+            "/workflow/v1/chat/completions", "/workflow/v1/resume");
+
+    private WorkflowGatewayIdentity() {}
+
+    /**
+     * Validate the original public request metadata and return the exact path bound into the signature.
+     * Query parameters are deliberately excluded; no decoding or path normalization is performed, so
+     * encoded or alternate paths fail closed.
+     */
+    public static String requireAuthorizedPath(String originalMethod, String originalUri) {
+        if (!POST.equals(originalMethod) || StringUtils.isEmpty(originalUri)) {
+            throw new IllegalArgumentException("unsupported workflow gateway request");
+        }
+        int queryStart = originalUri.indexOf('?');
+        String path = queryStart < 0 ? originalUri : originalUri.substring(0, queryStart);
+        if (!PUBLIC_WORKFLOW_PATHS.contains(path) || originalUri.indexOf('#') >= 0) {
+            throw new IllegalArgumentException("unsupported workflow gateway request");
+        }
+        return path;
+    }
+
+    /** Sign {@code method + newline + path + newline + appId + newline + epochSeconds}. */
+    public static String sign(
+            String configuredKey,
+            String method,
+            String path,
+            String appId,
+            long epochSeconds) {
+        String internalKey = WorkflowInternalApiKey.requireConfigured(configuredKey);
+        if (!POST.equals(method)
+                || !PUBLIC_WORKFLOW_PATHS.contains(path)
+                || StringUtils.isBlank(appId)
+                || appId.indexOf('\r') >= 0
+                || appId.indexOf('\n') >= 0
+                || epochSeconds < 0) {
+            throw new IllegalArgumentException("invalid workflow gateway identity");
+        }
+        String payload = method + '\n' + path + '\n' + appId + '\n' + epochSeconds;
+        try {
+            Mac mac = Mac.getInstance(HMAC_SHA_256);
+            mac.init(new SecretKeySpec(
+                    internalKey.getBytes(StandardCharsets.UTF_8), HMAC_SHA_256));
+            return HexFormat.of()
+                    .formatHex(
+                            mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
+        } catch (GeneralSecurityException exception) {
+            throw new IllegalStateException(
+                    "Unable to sign workflow gateway identity", exception);
+        }
+    }
+}
```

**File**: `console/backend/commons/src/main/java/com/iflytek/astron/console/commons/security/WorkflowInternalApiKey.java` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+package com.iflytek.astron.console.commons.security;
+
+import org.apache.commons.lang3.StringUtils;
+
+/** Shared validation and header naming for trusted calls to the core workflow service. */
+public final class WorkflowInternalApiKey {
+
+    public static final String HEADER = "X-Workflow-Internal-Key";
+
+    private static final String PLACEHOLDER = "CHANGE_ME_WORKFLOW_INTERNAL_API_KEY";
+    private static final int MIN_LENGTH = 32;
+
+    private WorkflowInternalApiKey() {}
+
+    /** Return a normalized credential or fail closed before issuing an internal request. */
+    public static String requireConfigured(String configuredValue) {
+        String apiKey = StringUtils.trimToEmpty(configuredValue);
+        if (apiKey.length() < MIN_LENGTH
+                || PLACEHOLDER.equals(apiKey)
+                || apiKey.indexOf('\r') >= 0
+                || apiKey.indexOf('\n') >= 0) {
+            throw new IllegalStateException(
+                    "WORKFLOW_INTERNAL_API_KEY must contain a non-default value of at least 32 characters");
+        }
+        return apiKey;
+    }
+}
```

**File**: `console/backend/commons/src/main/java/com/iflytek/astron/console/commons/service/workflow/impl/WorkflowBotChatServiceImpl.java` (modified, +5/-1)
```diff
@@ -90,6 +90,9 @@ public class WorkflowBotChatServiceImpl implements WorkflowBotChatService {
     @Value("${common.apiSecret}")
     private String appSecret;
 
+    @Value("${workflow.internal-api-key:}")
+    private String workflowInternalApiKey;
+
     /**
      * Handle chatbot workflow requests
      *
@@ -187,7 +190,8 @@ public void chatWorkflowBot(ChatBotReqDto chatBotReqDto, SseEmitter sseEmitter,
             body = RequestBody.create(JSON.toJSONString(build), MediaType.parse("application/json; charset=utf-8"));
             apiUsedUrl = resumeUrl;
         }
-        WorkflowClient client = new WorkflowClient(apiUsedUrl, appId, appKey, appSecret, body);
+        WorkflowClient client = new WorkflowClient(
+                apiUsedUrl, appId, appKey, appSecret, body, workflowInternalApiKey);
         WorkflowListener listener = new WorkflowListener(client, chatReqRecords, sseId, wssListenerService, isDebug, sseEmitter);
         client.createWebSocketConnect(listener);
     }
```

**File**: `console/backend/commons/src/main/java/com/iflytek/astron/console/commons/util/MaasUtil.java` (modified, +23/-5)
```diff
@@ -16,6 +16,7 @@
 import com.iflytek.astron.console.commons.enums.bot.BotUploadEnum;
 import com.iflytek.astron.console.commons.exception.BusinessException;
 import com.iflytek.astron.console.commons.mapper.bot.ChatBotBaseMapper;
+import com.iflytek.astron.console.commons.security.WorkflowInternalApiKey;
 import com.iflytek.astron.console.commons.service.bot.ChatBotTagService;
 import com.iflytek.astron.console.commons.service.data.UserLangChainDataService;
 import com.iflytek.astron.console.commons.service.workflow.impl.WorkflowBotParamServiceImpl;
@@ -33,6 +34,7 @@
 import org.springframework.transaction.annotation.Transactional;
 
 import java.io.IOException;
+import java.nio.charset.StandardCharsets;
 import java.time.Duration;
 import java.util.*;
 import java.util.stream.Collectors;
@@ -78,6 +80,9 @@ public class MaasUtil {
     @Value("${maas.authApi}")
     private String authApi;
 
+    @Value("${workflow.internal-api-key:}")
+    private String workflowInternalApiKey;
+
     @Value("${maas.mcpHost}")
     private String mcpHost;
 
@@ -204,11 +209,15 @@ public JSONObject synchronizeWorkFlow(UserLangChainInfo userLangChainInfo, BotCr
             // If it's newly created, then it's empty, use POST request
             httpMethod = "POST";
         }
-        log.info("----- maas synchronization request body: {}", JSONObject.toJSONString(param));
+        String requestJson = JSONObject.toJSONString(param);
+        log.info(
+                "MaaS workflow synchronization request prepared, method={}, bodyBytes={}",
+                httpMethod,
+                requestJson.getBytes(StandardCharsets.UTF_8).length);
 
         // Build request body
         RequestBody requestBody = RequestBody.create(
-                JSONObject.toJSONString(param),
+                requestJson,
                 MediaType.parse("application/json; charset=utf-8"));
 
         // Build request
@@ -242,7 +251,9 @@ public JSONObject synchronizeWorkFlow(UserLangChainInfo userLangChainInfo, BotCr
 
         JSONObject res = JSONObject.parseObject(response);
         if (res.getInteger("code") != 0) {
-            log.error("------ Synchronize maas workflow failed, reason: {}", res);
+            log.error(
+                    "MaaS workflow synchronization was rejected, code={}",
+                    res.getInteger("code"));
             return new JSONObject();
         }
         return res;
@@ -434,18 +445,25 @@ private JSONObject createApiInternal(String flowId, String appid, String version
      * @return String representation of response content
      */
     private String executeRequest(String url, MaasApi bodyData) {
+        String serializedBody = JSONObject.toJSONString(bodyData);
         RequestBody requestBody = RequestBody.create(
-                JSONObject.toJSONString(bodyData),
+                serializedBody,
                 MediaType.parse("application/json; charset=utf-8"));
         Request request = new Request.Builder()
                 .url(url)
                 .post(requestBody)
                 .addHeader("X-Consumer-Username", consumerId)
+                .addHeader(
+                        WorkflowInternalApiKey.HEADER,
+                        WorkflowInternalApiKey.requireConfigured(workflowInternalApiKey))
                 .addHeader("Lang-Code", I18nUtil.getLanguage())
                 .addHeader("Authorization", "Bearer %s:%s".formatted(consumerKey, consumerSecret))
                 .addHeader(X_AUTH_SOURCE_HEADER, X_AUTH_SOURCE_VALUE)
                 .build();
-        log.info("MaasUtil executeRequest url: {} request: {}, header: {}, body: {}", request.url(), request, request.headers(), bodyData);
+        log.info(
+                "MaaS workflow API request, url={}, bodyBytes={}",
+                request.url(),
+                serializedBody.getBytes(StandardCharsets.UTF_8).length);
         try (Response httpResponse = HTTP_CLIENT.newCall(request).execute()) {
             ResponseBody responseBody = httpResponse.body();
             if (responseBody != null) {
```

**File**: `console/backend/commons/src/main/java/com/iflytek/astron/console/commons/workflow/WorkflowClient.java` (modified, +13/-1)
```diff
@@ -1,5 +1,6 @@
 package com.iflytek.astron.console.commons.workflow;
 
+import com.iflytek.astron.console.commons.security.WorkflowInternalApiKey;
 import lombok.extern.slf4j.Slf4j;
 import okhttp3.ConnectionPool;
 import okhttp3.OkHttpClient;
@@ -25,6 +26,8 @@ public class WorkflowClient {
 
     private String appSecret;
 
+    private String workflowInternalApiKey;
+
     private Request request;
 
     private RequestBody requestBody;
@@ -39,12 +42,20 @@ public class WorkflowClient {
             .connectionPool(new ConnectionPool(1000, 10, TimeUnit.MINUTES))
             .build();
 
-    public WorkflowClient(String chatUrl, String appId, String appKey, String appSecret, RequestBody requestBody) {
+    public WorkflowClient(
+            String chatUrl,
+            String appId,
+            String appKey,
+            String appSecret,
+            RequestBody requestBody,
+            String workflowInternalApiKey) {
         this.chatUrl = chatUrl;
         this.appId = appId;
         this.appKey = appKey;
         this.appSecret = appSecret;
         this.requestBody = requestBody;
+        this.workflowInternalApiKey =
+                WorkflowInternalApiKey.requireConfigured(workflowInternalApiKey);
     }
 
     /**
@@ -57,6 +68,7 @@ public void createWebSocketConnect(EventSourceListener sseListener) {
         String wsURL = chatUrl;
         this.request = new Request.Builder()
                 .header("X-Consumer-Username", appId)
+                .header(WorkflowInternalApiKey.HEADER, workflowInternalApiKey)
                 .header("Authorization", genAuthorization())
                 .url(wsURL)
                 .post(requestBody)
```

**File**: `console/backend/commons/src/main/resources/messages_en.properties` (modified, +4/-0)
```diff
@@ -263,6 +263,10 @@ workflow.not.public=Workflow is not public, cannot copy
 workflow.not.publish=Workflow not published
 workflow.import.failed=Import failed
 workflow.no.workflow=Flow not found
+workflow.node.debug.failed=Workflow node debugging failed. Please check the node configuration.
+workflow.code.execution.failed=Code node execution failed. Check the code or execution environment.
+workflow.code.execution.timeout=Code node execution timed out. Shorten the code or adjust the timeout.
+workflow.code.executor.unavailable=No code execution environment is configured. Enable E2B or the built-in isolated executor.
 parse.input.param.type.failed=Parse flow input parameter type failed
 workflow.protocol.empty=Workflow protocol is empty
 bot.not.exist=Bot does not exist
```

---

### Incident Patch 14: `b9f12035` (2026-08-28)
**Commit Message**: fix(security): use a KDF for credential cache keys

Signed-off-by: yjlu12 <[REDACTED_EMAIL]>

**File**: `core/workflow/extensions/fastapi/middleware/auth.py` (modified, +2/-2)
```diff
@@ -333,7 +333,7 @@ def _get_app_id_with_cache(self, credential_cache_key: str) -> str:
         """
         Get the app id with cache
 
-        :param credential_cache_key: HMAC-SHA256 digest of the complete credential pair
+        :param credential_cache_key: PBKDF2-HMAC digest of the complete credential pair
         :return: The app id
         """
         cache_service = get_cache_service()
@@ -346,7 +346,7 @@ def _set_app_id_with_cache(self, credential_cache_key: str, app_id: str) -> None
         """
         Set the app id with cache
 
-        :param credential_cache_key: HMAC-SHA256 digest of the complete credential pair
+        :param credential_cache_key: PBKDF2-HMAC digest of the complete credential pair
         :param app_id: The app id
         """
         cache_service = get_cache_service()
```

**File**: `core/workflow/utils/credentials.py` (modified, +11/-8)
```diff
@@ -1,7 +1,6 @@
 """Small, fail-closed helpers for deployment-managed credential files."""
 
 import hashlib
-import hmac
 import os
 import stat
 from typing import Collection
@@ -11,19 +10,23 @@
 
 # Cache keys must be deterministic so that all Workflow replicas can reuse a
 # verification result, but they must not be a plain fast hash of an API secret.
-# A domain-separated HMAC keeps the cache namespace opaque and avoids treating
-# the credential as a password hash.  This key is intentionally versioned: the
-# cache prefix is bumped alongside it so old SHA-256 entries cannot be reused.
+# A domain-separated PBKDF2 digest keeps the cache namespace opaque and makes
+# offline guessing materially more expensive than a single fast hash.  The
+# context is intentionally versioned: the cache prefix is bumped alongside it
+# so old SHA-256 entries cannot be reused.
 _CREDENTIAL_CACHE_KEY_CONTEXT = b"astron-agent:workflow:credential-cache:v3"
+_CREDENTIAL_CACHE_KDF_ITERATIONS = 100_000
 
 
 def credential_cache_key(credential: str) -> str:
     """Return the deterministic, versioned digest used for credential caches."""
-    return hmac.new(
-        _CREDENTIAL_CACHE_KEY_CONTEXT,
+    return hashlib.pbkdf2_hmac(
+        "sha256",
         credential.encode("utf-8"),
-        hashlib.sha256,
-    ).hexdigest()
+        _CREDENTIAL_CACHE_KEY_CONTEXT,
+        _CREDENTIAL_CACHE_KDF_ITERATIONS,
+        dklen=32,
+    ).hex()
 
 
 def read_credential_file(file_name: str) -> str:
```

---

### Incident Patch 15: `bf260b2b` (2026-08-28)
**Commit Message**: fix(security): harden credential caches and tenant checks

Signed-off-by: yjlu12 <[REDACTED_EMAIL]>

**File**: `core/tenant/config/bootstrap_credentials_test.go` (modified, +55/-57)
```diff
@@ -90,63 +90,61 @@ func TestLoadTenantBootstrapCredentialsPrefersDirectValues(t *testing.T) {
 	}
 }
 
-func TestLoadTenantBootstrapCredentialsRejectsUnsafeFiles(t *testing.T) {
-	t.Run("symbolic link", func(t *testing.T) {
-		clearTenantBootstrapEnvironment(t)
-		directory := t.TempDir()
-		target := filepath.Join(directory, "target")
-		link := filepath.Join(directory, "tenant-key")
-		secretFile := filepath.Join(directory, "tenant-secret")
-		if err := os.WriteFile(target, []byte(strings.Repeat("k", 48)), 0o400); err != nil {
-			t.Fatal(err)
-		}
-		if err := os.Symlink(target, link); err != nil {
-			t.Fatal(err)
-		}
-		if err := os.WriteFile(secretFile, []byte(strings.Repeat("s", 48)), 0o400); err != nil {
-			t.Fatal(err)
-		}
-		t.Setenv("TENANT_KEY_FILE", link)
-		t.Setenv("TENANT_SECRET_FILE", secretFile)
-
-		if _, err := LoadTenantBootstrapCredentials(); err == nil || !strings.Contains(err.Error(), "non-symbolic-link") {
-			t.Fatalf("LoadTenantBootstrapCredentials() error = %v, want symbolic-link rejection", err)
-		}
-	})
-
-	t.Run("oversized", func(t *testing.T) {
-		clearTenantBootstrapEnvironment(t)
-		directory := t.TempDir()
-		keyFile := filepath.Join(directory, "tenant-key")
-		secretFile := filepath.Join(directory, "tenant-secret")
-		if err := os.WriteFile(keyFile, []byte(strings.Repeat("k", maxCredentialFileBytes+1)), 0o400); err != nil {
-			t.Fatal(err)
-		}
-		if err := os.WriteFile(secretFile, []byte(strings.Repeat("s", 48)), 0o400); err != nil {
-			t.Fatal(err)
-		}
-		t.Setenv("TENANT_KEY_FILE", keyFile)
-		t.Setenv("TENANT_SECRET_FILE", secretFile)
-
-		if _, err := LoadTenantBootstrapCredentials(); err == nil || !strings.Contains(err.Error(), "too large") {
-			t.Fatalf("LoadTenantBootstrapCredentials() error = %v, want size rejection", err)
-		}
-	})
-
-	t.Run("directory", func(t *testing.T) {
-		clearTenantBootstrapEnvironment(t)
-		directory := t.TempDir()
-		secretFile := filepath.Join(directory, "tenant-secret")
-		if err := os.WriteFile(secretFile, []byte(strings.Repeat("s", 48)), 0o400); err != nil {
-			t.Fatal(err)
-		}
-		t.Setenv("TENANT_KEY_FILE", directory)
-		t.Setenv("TENANT_SECRET_FILE", secretFile)
-
-		if _, err := LoadTenantBootstrapCredentials(); err == nil || !strings.Contains(err.Error(), "regular") {
-			t.Fatalf("LoadTenantBootstrapCredentials() error = %v, want directory rejection", err)
-		}
-	})
+func TestLoadTenantBootstrapCredentialsRejectsSymbolicLink(t *testing.T) {
+	clearTenantBootstrapEnvironment(t)
+	directory := t.TempDir()
+	target := filepath.Join(directory, "target")
+	link := filepath.Join(directory, "tenant-key")
+	secretFile := filepath.Join(directory, "tenant-secret")
+	if err := os.WriteFile(target, []byte(strings.Repeat("k", 48)), 0o400); err != nil {
+		t.Fatal(err)
+	}
+	if err := os.Symlink(target, link); err != nil {
+		t.Fatal(err)
+	}
+	if err := os.WriteFile(secretFile, []byte(strings.Repeat("s", 48)), 0o400); err != nil {
+		t.Fatal(err)
+	}
+	t.Setenv("TENANT_KEY_FILE", link)
+	t.Setenv("TENANT_SECRET_FILE", secretFile)
+
+	if _, err := LoadTenantBootstrapCredentials(); err == nil || !strings.Contains(err.Error(), "non-symbolic-link") {
+		t.Fatalf("LoadTenantBootstrapCredentials() error = %v, want symbolic-link rejection", err)
+	}
+}
+
+func TestLoadTenantBootstrapCredentialsRejectsOversizedFile(t *testing.T) {
+	clearTenantBootstrapEnvironment(t)
+	directory := t.TempDir()
+	keyFile := filepath.Join(directory, "tenant-key")
+	secretFile := filepath.Join(directory, "tenant-secret")
+	if err := os.WriteFile(keyFile, []byte(strings.Repeat("k", maxCredentialFileBytes+1)), 0o400); err != nil {
+		t.Fatal(err)
+	}
+	if err := os.WriteFile(secretFile, []byte(strings.Repeat("s", 48)), 0o400); err != nil {
+		t.Fatal(err)
+	}
+	t.Setenv("TENANT_KEY_FILE", keyFile)
+	t.Setenv("TENANT_SECRET_FILE", secretFile)
+
+	if _, err := LoadTenantBootstrapCredentials(); err == nil || !strings.Contains(err.Error(), "too large") {
+		t.Fatalf("LoadTenantBootstrapCredentials() error = %v, want size rejection", err)
+	}
+}
+
+func TestLoadTenantBootstrapCredentialsRejectsDirectory(t *testing.T) {
+	clearTenantBootstrapEnvironment(t)
+	directory := t.TempDir()
+	secretFile := filepath.Join(directory, "tenant-secret")
+	if err := os.WriteFile(secretFile, []byte(strings.Repeat("s", 48)), 0o400); err != nil {
+		t.Fatal(err)
+	}
+	t.Setenv("TENANT_KEY_FILE", directory)
+	t.Setenv("TENANT_SECRET_FILE", secretFile)
+
+	if _, err := LoadTenantBootstrapCredentials(); err == nil || !strings.Contains(err.Error(), "regular") {
+		t.Fatalf("LoadTenantBootstrapCredentials() error = %v, want directory rejection", err)
+	}
 }
 
 func TestTenantBootstrapCredentialsValidate(t *testing.T) {
```

**File**: `core/tenant/tools/database/bootstrap_credentials.go` (modified, +70/-23)
```diff
@@ -88,6 +88,32 @@ func reconcileTenantBootstrapTransaction(
 	}
 
 	now := time.Now().Format("2006-01-02 15:04:05")
+	if err := ensureAndLockTenantBootstrapApp(ctx, transaction, credentials, now); err != nil {
+		return err
+	}
+
+	adoptExistingUnmanagedCredential, err := findTenantBootstrapCredential(
+		ctx,
+		transaction,
+		credentials,
+	)
+	if err != nil {
+		return err
+	}
+	if adoptExistingUnmanagedCredential {
+		if err := adoptTenantBootstrapCredential(ctx, transaction, credentials, now); err != nil {
+			return err
+		}
+	}
+	return rotateTenantBootstrapCredentials(ctx, transaction, credentials, now)
+}
+
+func ensureAndLockTenantBootstrapApp(
+	ctx context.Context,
+	transaction bootstrapTransaction,
+	credentials config.TenantBootstrapCredentials,
+	now string,
+) error {
 	if _, err := transaction.ExecContext(
 		ctx,
 		`INSERT IGNORE INTO tb_app
@@ -127,7 +153,14 @@ VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
 		!lockedAppDeleted.Valid || lockedAppDeleted.Bool {
 		return errors.New("reserved tenant bootstrap app is disabled or deleted")
 	}
+	return nil
+}
 
+func findTenantBootstrapCredential(
+	ctx context.Context,
+	transaction bootstrapTransaction,
+	credentials config.TenantBootstrapCredentials,
+) (bool, error) {
 	var collisionOwner string
 	err := transaction.QueryRowContext(
 		ctx,
@@ -139,10 +172,10 @@ LIMIT 1 FOR UPDATE`,
 		credentials.TenantID,
 	).Scan(&collisionOwner)
 	if err == nil {
-		return errors.New("tenant bootstrap API key is already assigned to another active app")
+		return false, errors.New("tenant bootstrap API key is already assigned to another active app")
 	}
 	if !errors.Is(err, sql.ErrNoRows) {
-		return fmt.Errorf("check tenant bootstrap API key ownership failed: %w", err)
+		return false, fmt.Errorf("check tenant bootstrap API key ownership failed: %w", err)
 	}
 
 	var unmanagedSecret sql.NullString
@@ -157,39 +190,53 @@ LIMIT 1 FOR UPDATE`,
 		credentials.APIKey,
 		tenantBootstrapManagedMarker,
 	).Scan(&unmanagedSecret, &unmanagedIsDelete)
-	adoptExistingUnmanagedCredential := false
 	if err == nil {
 		if !unmanagedSecret.Valid || !unmanagedIsDelete.Valid || unmanagedIsDelete.Bool ||
 			subtle.ConstantTimeCompare([]byte(unmanagedSecret.String), []byte(credentials.Secret)) != 1 {
-			return errors.New("tenant bootstrap API key conflicts with an unmanaged credential")
+			return false, errors.New("tenant bootstrap API key conflicts with an unmanaged credential")
 		}
-		// A strong pair explicitly configured by the deployment may already have
-		// been created through Tenant's public API on an older release. Because it
-		// belongs to the reserved app and exactly matches the current deployment
-		// Secret, adopt it into managed ownership so a later rotation can retire it.
-		adoptExistingUnmanagedCredential = true
+		return true, nil
 	}
 	if err != nil && !errors.Is(err, sql.ErrNoRows) {
-		return fmt.Errorf("check tenant bootstrap managed credential failed: %w", err)
+		return false, fmt.Errorf("check tenant bootstrap managed credential failed: %w", err)
 	}
-	if adoptExistingUnmanagedCredential {
-		if _, err := transaction.ExecContext(
-			ctx,
-			`UPDATE tb_auth
+	return false, nil
+}
+
+func adoptTenantBootstrapCredential(
+	ctx context.Context,
+	transaction bootstrapTransaction,
+	credentials config.TenantBootstrapCredentials,
+	now string,
+) error {
+	// A strong pair explicitly configured by the deployment may already have
+	// been created through Tenant's public API on an older release. Because it
+	// belongs to the reserved app and exactly matches the current deployment
+	// Secret, adopt it into managed ownership so a later rotation can retire it.
+	if _, err := transaction.ExecContext(
+		ctx,
+		`UPDATE tb_auth
 SET extend = ?, update_time = ?
 WHERE app_id = ? AND api_key = ? AND api_secret = ? AND is_delete = 0
   AND COALESCE(extend, '') <> ?`,
-			tenantBootstrapManagedMarker,
-			now,
-			credentials.TenantID,
-			credentials.APIKey,
-			credentials.Secret,
-			tenantBootstrapManagedMarker,
-		); err != nil {
-			return fmt.Errorf("adopt tenant bootstrap credential failed: %w", err)
-		}
+		tenantBootstrapManagedMarker,
+		now,
+		credentials.TenantID,
+		credentials.APIKey,
+		credentials.Secret,
+		tenantBootstrapManagedMarker,
+	); err != nil {
+		return fmt.Errorf("adopt tenant bootstrap credential failed: %w", err)
 	}
+	return nil
+}
 
+func rotateTenantBootstrapCredentials(
+	ctx context.Context,
+	transaction bootstrapTransaction,
+	credentials config.TenantBootstrapCredentials,
+	now string,
+) error {
 	if _, err := transaction.ExecContext(
 		ctx,
 		`UPDATE tb_auth
```

**File**: `core/tenant/tools/database/bootstrap_credentials_test.go` (modified, +102/-50)
```diff
@@ -67,32 +67,53 @@ func (row fakeBootstrapRow) Scan(dest ...any) error {
 		return errors.New("unexpected scan destination count")
 	}
 	for index, destination := range dest {
-		switch target := destination.(type) {
-		case *string:
-			value, ok := values[index].(string)
-			if !ok {
-				return errors.New("unexpected string scan value")
-			}
-			*target = value
-		case *sql.NullString:
-			value, ok := values[index].(string)
-			if !ok {
-				return errors.New("unexpected nullable string scan value")
-			}
-			*target = sql.NullString{String: value, Valid: true}
-		case *sql.NullBool:
-			value, ok := values[index].(bool)
-			if !ok {
-				return errors.New("unexpected nullable bool scan value")
-			}
-			*target = sql.NullBool{Bool: value, Valid: true}
-		default:
-			return errors.New("unexpected scan destination type")
+		if err := assignFakeBootstrapValue(values[index], destination); err != nil {
+			return err
 		}
 	}
 	return nil
 }
 
+func assignFakeBootstrapValue(value any, destination any) error {
+	switch target := destination.(type) {
+	case *string:
+		return assignFakeString(target, value)
+	case *sql.NullString:
+		return assignFakeNullString(target, value)
+	case *sql.NullBool:
+		return assignFakeNullBool(target, value)
+	default:
+		return errors.New("unexpected scan destination type")
+	}
+}
+
+func assignFakeString(target *string, value any) error {
+	text, ok := value.(string)
+	if !ok {
+		return errors.New("unexpected string scan value")
+	}
+	*target = text
+	return nil
+}
+
+func assignFakeNullString(target *sql.NullString, value any) error {
+	text, ok := value.(string)
+	if !ok {
+		return errors.New("unexpected nullable string scan value")
+	}
+	*target = sql.NullString{String: text, Valid: true}
+	return nil
+}
+
+func assignFakeNullBool(target *sql.NullBool, value any) error {
+	boolean, ok := value.(bool)
+	if !ok {
+		return errors.New("unexpected nullable bool scan value")
+	}
+	*target = sql.NullBool{Bool: boolean, Valid: true}
+	return nil
+}
+
 type fakeBootstrapResult int64
 
 func (result fakeBootstrapResult) LastInsertId() (int64, error) {
@@ -111,6 +132,62 @@ func testBootstrapCredentials() config.TenantBootstrapCredentials {
 	}
 }
 
+func assertBootstrapQueriesDoNotInterpolateCredentials(
+	t *testing.T,
+	executions []recordedBootstrapExecution,
+	credentials config.TenantBootstrapCredentials,
+) {
+	t.Helper()
+	for _, execution := range executions {
+		if strings.Contains(execution.query, credentials.APIKey) ||
+			strings.Contains(execution.query, credentials.Secret) ||
+			strings.Contains(execution.query, config.LegacyTenantKey) ||
+			strings.Contains(execution.query, config.LegacyTenantSecret) {
+			t.Fatal("credential value was interpolated into SQL instead of passed as a parameter")
+		}
+	}
+}
+
+func assertLegacyCredentialRevocation(
+	t *testing.T,
+	execution recordedBootstrapExecution,
+) {
+	t.Helper()
+	if strings.Contains(execution.query, "app_id") {
+		t.Fatal("published legacy credential revocation must apply globally, not only to the reserved app")
+	}
+	if execution.args[1] != config.LegacyTenantKey || execution.args[2] != config.LegacyTenantSecret {
+		t.Fatalf("legacy disable arguments = %#v, want exact published pair", execution.args)
+	}
+}
+
+func assertManagedCredentialRetirement(
+	t *testing.T,
+	execution recordedBootstrapExecution,
+	credentials config.TenantBootstrapCredentials,
+) {
+	t.Helper()
+	if execution.args[1] != config.BootstrapTenantID ||
+		execution.args[2] != tenantBootstrapManagedMarker ||
+		execution.args[3] != credentials.APIKey {
+		t.Fatalf("managed retirement arguments = %#v, want reserved app and marker", execution.args)
+	}
+}
+
+func assertManagedCredentialUpsert(
+	t *testing.T,
+	execution recordedBootstrapExecution,
+	credentials config.TenantBootstrapCredentials,
+) {
+	t.Helper()
+	if execution.args[2] != config.BootstrapTenantID ||
+		execution.args[3] != credentials.APIKey ||
+		execution.args[4] != credentials.Secret ||
+		execution.args[7] != tenantBootstrapManagedMarker {
+		t.Fatalf("managed upsert arguments = %#v, want current managed credential", execution.args)
+	}
+}
+
 func TestReconcileTenantBootstrapTransactionCreatesAndRotatesManagedCredential(t *testing.T) {
 	transaction := &fakeBootstrapTransaction{
 		rows: []bootstrapRowScanner{
@@ -128,35 +205,10 @@ func TestReconcileTenantBootstrapTransactionCreatesAndRotatesManagedCredential(t
 		t.Fatalf("execution count = %d, want app insert and three targeted auth writes", len(transaction.executions))
 	}
 
-	for _, execution := range transaction.executions {
-		if strings.Contains(execution.query, credentials.APIKey) ||
-			strings.Contains(execution.query, credentials.Secret) ||
-			strings.Contains(execution.query, config.LegacyTenantKey) ||
-			strings.Contains(execution.query, config.LegacyTenantSecret) {
-			t.Fatal("credential value was interpolated into SQL instead of passed as a parameter")
-		}
-	}
-
-	legacyDisable := transaction.e
```

**File**: `core/tenant/tools/database/database.go` (modified, +38/-24)
```diff
@@ -41,23 +41,7 @@ func NewDatabase(conf *config.Config) (*Database, error) {
 }
 
 func (db *Database) buildMysql(conf *config.Config) error {
-	if len(conf.DataBase.UserName) == 0 {
-		return errors.New("mysql username is empty")
-	}
-
-	if len(conf.DataBase.Password) == 0 {
-		return errors.New("mysql password is empty")
-	}
-
-	if len(conf.DataBase.Url) == 0 {
-		return errors.New("mysql url is empty")
-	}
-	if err := conf.TenantBootstrap.Validate(); err != nil {
-		return fmt.Errorf("invalid tenant bootstrap credentials: %w", err)
-	}
-
-	dsn := fmt.Sprintf("%s:%s@tcp%s", conf.DataBase.UserName, conf.DataBase.Password, conf.DataBase.Url)
-	parsedDsn, err := mysql.ParseDSN(dsn)
+	dsn, parsedDsn, err := parseMysqlConfig(conf)
 	if err != nil {
 		return err
 	}
@@ -72,22 +56,52 @@ func (db *Database) buildMysql(conf *config.Config) error {
 	}
 	client.SetMaxOpenConns(conf.DataBase.MaxOpenConns)
 	client.SetMaxIdleConns(conf.DataBase.MaxIdleConns)
-	err = client.Ping()
-	if err != nil {
+	if err := client.Ping(); err != nil {
 		return err
 	}
 
-	if err := runMigrations(client); err != nil {
+	if err := initializeMysqlClient(client, conf.TenantBootstrap); err != nil {
 		_ = client.Close()
 		return err
 	}
-	if err := reconcileTenantBootstrap(client, conf.TenantBootstrap); err != nil {
-		_ = client.Close()
+
+	db.mysql = client
+	return nil
+}
+
+func parseMysqlConfig(conf *config.Config) (string, *mysql.Config, error) {
+	if len(conf.DataBase.UserName) == 0 {
+		return "", nil, errors.New("mysql username is empty")
+	}
+	if len(conf.DataBase.Password) == 0 {
+		return "", nil, errors.New("mysql password is empty")
+	}
+	if len(conf.DataBase.Url) == 0 {
+		return "", nil, errors.New("mysql url is empty")
+	}
+	if err := conf.TenantBootstrap.Validate(); err != nil {
+		return "", nil, fmt.Errorf("invalid tenant bootstrap credentials: %w", err)
+	}
+
+	dsn := fmt.Sprintf("%s:%s@tcp%s", conf.DataBase.UserName, conf.DataBase.Password, conf.DataBase.Url)
+	parsedDsn, err := mysql.ParseDSN(dsn)
+	if err != nil {
+		return "", nil, err
+	}
+	return dsn, parsedDsn, nil
+}
+
+func initializeMysqlClient(
+	client *sql.DB,
+	credentials config.TenantBootstrapCredentials,
+) error {
+	if err := runMigrations(client); err != nil {
+		return err
+	}
+	if err := reconcileTenantBootstrap(client, credentials); err != nil {
 		return err
 	}
 	log.Printf("tenant bootstrap credentials reconciled")
-
-	db.mysql = client
 	return nil
 }
 
```

**File**: `core/workflow/extensions/fastapi/lifespan/bootstrap_credentials.py` (modified, +19/-10)
```diff
@@ -1,6 +1,5 @@
 """Synchronize the deployment-managed tenant identity into Workflow storage."""
 
-import hashlib
 import os
 from dataclasses import dataclass
 from datetime import datetime
@@ -12,13 +11,22 @@
 from workflow.domain.models.app_source import AppSource
 from workflow.extensions.middleware.database.utils import session_getter
 from workflow.extensions.middleware.getters import get_cache_service
-from workflow.utils.credentials import credential_from_env_or_file
+from workflow.utils.credentials import credential_cache_key, credential_from_env_or_file
 
 BOOTSTRAP_TENANT_ID = "680ab54f"
 LEGACY_TENANT_KEY = "7b709739e8da44536127a333c7603a83"
 LEGACY_TENANT_SECRET = "NjhmY2NmM2NkZDE4MDFlNmM5ZjcyZjMy"
+# SHA-256 of the published legacy pair.  Keep this non-secret fingerprint so
+# upgrades can remove the exact v1 key even if a Redis deployment does not
+# return it from the broad namespace scan below.
+_LEGACY_VERIFIED_CACHE_DIGEST = (
+    "8f36ac6b8a917de90c78ca6828908790c0f0df33a319e3b793a35e2dc988f18f"
+)
 _LEGACY_VERIFIED_CACHE_PREFIX = "workflow:app:verified_credential"
-_CURRENT_VERIFIED_CACHE_PREFIX = "workflow:app:verified_credential:v2"
+_PREVIOUS_VERIFIED_CACHE_PREFIX = "workflow:app:verified_credential:v2"
+_CURRENT_VERIFIED_CACHE_PREFIX = "workflow:app:verified_credential:v3"
+_LEGACY_VERIFIED_CACHE_PATTERN = f"{_LEGACY_VERIFIED_CACHE_PREFIX}:[0-9a-f]*"
+_PREVIOUS_VERIFIED_CACHE_PATTERN = f"{_PREVIOUS_VERIFIED_CACHE_PREFIX}:*"
 _OLDEST_API_KEY_CACHE_PREFIX = "workflow:app:api_key"
 _LEGACY_APP_INFO_CACHE_PREFIX = "workflow:app_info"
 _CURRENT_APP_INFO_CACHE_PREFIX = "workflow:app_info:v2"
@@ -135,9 +143,7 @@ def synchronize_bootstrap_app(
         and all(existing_pair)
     ):
         credential_digests_to_revoke.add(
-            hashlib.sha256(
-                f"{existing_pair[0]}:{existing_pair[1]}".encode()
-            ).hexdigest()
+            credential_cache_key(f"{existing_pair[0]}:{existing_pair[1]}")
         )
     # This row is deployment-owned once all reserved identity fields match.
     # Always converge it to the Secret so explicit rotations and regenerated
@@ -153,12 +159,10 @@ def invalidate_legacy_bootstrap_caches(
 ) -> None:
     """Revoke disclosed authentication entries and abandon secret-bearing flow caches."""
     cache_service = get_cache_service()
-    legacy_digest = hashlib.sha256(
-        f"{LEGACY_TENANT_KEY}:{LEGACY_TENANT_SECRET}".encode("utf-8")
-    ).hexdigest()
+    legacy_digest = credential_cache_key(f"{LEGACY_TENANT_KEY}:{LEGACY_TENANT_SECRET}")
     keys = {
         f"{_OLDEST_API_KEY_CACHE_PREFIX}:{LEGACY_TENANT_KEY}",
-        f"{_LEGACY_VERIFIED_CACHE_PREFIX}:{legacy_digest}",
+        f"{_LEGACY_VERIFIED_CACHE_PREFIX}:{_LEGACY_VERIFIED_CACHE_DIGEST}",
         f"{_CURRENT_VERIFIED_CACHE_PREFIX}:{legacy_digest}",
         f"{_LEGACY_APP_INFO_CACHE_PREFIX}:{credentials.tenant_id}",
         f"{_CURRENT_APP_INFO_CACHE_PREFIX}:{credentials.tenant_id}",
@@ -167,6 +171,11 @@ def invalidate_legacy_bootstrap_caches(
         f"{_CURRENT_VERIFIED_CACHE_PREFIX}:{digest}"
         for digest in credential_digests_to_revoke or ()
     )
+    # The v1/v2 cache keys were derived with a fast SHA-256 digest.  They are
+    # no longer accepted by the middleware, but remove them during startup so
+    # stale positive authentication entries cannot survive an upgrade.
+    keys.update(cache_service.scan_keys(_LEGACY_VERIFIED_CACHE_PATTERN))
+    keys.update(cache_service.scan_keys(_PREVIOUS_VERIFIED_CACHE_PATTERN))
     keys.update(cache_service.scan_keys(_LEGACY_FLOW_CACHE_PATTERN))
     for key in keys:
         cache_service.delete(key)
```

**File**: `core/workflow/extensions/fastapi/middleware/auth.py` (modified, +7/-8)
```diff
@@ -26,6 +26,7 @@
 from workflow.utils.credentials import (
     MAX_CREDENTIAL_FILE_BYTES,
     TENANT_INTERNAL_API_KEY_HEADER,
+    credential_cache_key,
     credential_from_env_or_file,
 )
 
@@ -38,7 +39,7 @@
 WORKFLOW_GATEWAY_TIMESTAMP_HEADER = "X-Workflow-Gateway-Timestamp"
 WORKFLOW_GATEWAY_SIGNATURE_HEADER = "X-Workflow-Gateway-Signature"
 WORKFLOW_GATEWAY_SIGNATURE_MAX_AGE_SECONDS = 60
-VERIFIED_CREDENTIAL_CACHE_PREFIX = "workflow:app:verified_credential:v2"
+VERIFIED_CREDENTIAL_CACHE_PREFIX = "workflow:app:verified_credential:v3"
 APP_MANAGE_CREDENTIAL_MIN_LENGTH = 32
 APP_MANAGE_CREDENTIAL_MAX_LENGTH = 50
 PUBLISHED_LEGACY_TENANT_API_KEY = "7b709739e8da44536127a333c7603a83"
@@ -272,12 +273,10 @@ async def _get_app_source_detail_with_api_key(
                 err_msg="authorization header is invalid",
             )
 
-        credential_cache_key = hashlib.sha256(
-            credential.strip().encode("utf-8")
-        ).hexdigest()
+        credential_cache_digest = credential_cache_key(credential.strip())
 
         app_id = await asyncio.to_thread(
-            self._get_app_id_with_cache, credential_cache_key
+            self._get_app_id_with_cache, credential_cache_digest
         )
         if app_id:
             return app_id
@@ -326,15 +325,15 @@ async def _get_app_source_detail_with_api_key(
                 cause_error=json.dumps(resp.json(), ensure_ascii=False),
             )
         await asyncio.to_thread(
-            self._set_app_id_with_cache, credential_cache_key, app_id
+            self._set_app_id_with_cache, credential_cache_digest, app_id
         )
         return app_id
 
     def _get_app_id_with_cache(self, credential_cache_key: str) -> str:
         """
         Get the app id with cache
 
-        :param credential_cache_key: SHA-256 digest of the complete credential pair
+        :param credential_cache_key: HMAC-SHA256 digest of the complete credential pair
         :return: The app id
         """
         cache_service = get_cache_service()
@@ -347,7 +346,7 @@ def _set_app_id_with_cache(self, credential_cache_key: str, app_id: str) -> None
         """
         Set the app id with cache
 
-        :param credential_cache_key: SHA-256 digest of the complete credential pair
+        :param credential_cache_key: HMAC-SHA256 digest of the complete credential pair
         :param app_id: The app id
         """
         cache_service = get_cache_service()
```

**File**: `core/workflow/tests/extensions/fastapi/test_auth.py` (modified, +7/-3)
```diff
@@ -25,19 +25,23 @@
     JSONResponseBase,
 )
 from workflow.extensions.fastapi.middleware.auth import (
+    VERIFIED_CREDENTIAL_CACHE_PREFIX,
     WORKFLOW_GATEWAY_SIGNATURE_HEADER,
     WORKFLOW_GATEWAY_TIMESTAMP_HEADER,
     WORKFLOW_INTERNAL_API_KEY_ENV,
     WORKFLOW_INTERNAL_API_KEY_HEADER,
     AuthMiddleware,
 )
 from workflow.utils.credentials import TENANT_INTERNAL_API_KEY_HEADER
+from workflow.utils.credentials import (
+    credential_cache_key as build_credential_cache_key,
+)
 
 pytestmark = pytest.mark.asyncio
 
 
 def credential_cache_key(credential: str) -> str:
-    return hashlib.sha256(credential.encode("utf-8")).hexdigest()
+    return build_credential_cache_key(credential)
 
 
 def gateway_signature(
@@ -445,7 +449,7 @@ async def test_get_app_id_with_cache(self, auth_middleware: AuthMiddleware) -> N
             "workflow.extensions.fastapi.middleware.auth.get_cache_service"
         ) as mock_get_cache:
             mock_cache = {
-                "workflow:app:verified_credential:v2:test_digest": "cached_app_id"
+                f"{VERIFIED_CREDENTIAL_CACHE_PREFIX}:test_digest": "cached_app_id"
             }
             mock_get_cache.return_value = mock_cache
 
@@ -464,7 +468,7 @@ async def test_set_app_id_with_cache(self, auth_middleware: AuthMiddleware) -> N
             auth_middleware._set_app_id_with_cache("test_digest", "test_app_id")
 
             assert (
-                mock_cache["workflow:app:verified_credential:v2:test_digest"]
+                mock_cache[f"{VERIFIED_CREDENTIAL_CACHE_PREFIX}:test_digest"]
                 == "test_app_id"
             )
 
```

**File**: `core/workflow/tests/extensions/fastapi/test_bootstrap_credentials.py` (modified, +19/-8)
```diff
@@ -1,4 +1,3 @@
-import hashlib
 from collections.abc import Iterator
 from contextlib import contextmanager
 from datetime import datetime
@@ -24,6 +23,7 @@
     synchronize_bootstrap_app,
     synchronize_deployment_bootstrap_app,
 )
+from workflow.utils.credentials import credential_cache_key
 
 
 @pytest.fixture
@@ -176,8 +176,9 @@ def delete(self, key: str) -> None:
 
     synchronize_deployment_bootstrap_app(credentials())
 
-    old_digest = hashlib.sha256(f"{old_key}:{old_secret}".encode()).hexdigest()
-    assert f"workflow:app:verified_credential:v2:{old_digest}" in cache.deleted
+    old_digest = credential_cache_key(f"{old_key}:{old_secret}")
+    assert f"workflow:app:verified_credential:v3:{old_digest}" in cache.deleted
+    assert "workflow:app:verified_credential:v2:old-entry" in cache.deleted
     with Session(engine) as session:
         app = session.get(App, 1)
         assert app is not None
@@ -274,11 +275,18 @@ def __init__(self) -> None:
         self.deleted: list[str] = []
 
     def scan_keys(self, pattern: str) -> list[str]:
-        assert pattern == "workflow:flow_info:v2:*"
-        return [
-            "workflow:flow_info:v2:1",
-            "workflow:flow_info:v2:1:latest",
-        ]
+        if pattern == bootstrap_module._LEGACY_VERIFIED_CACHE_PATTERN:
+            return [
+                "workflow:app:verified_credential:8f36ac6b8a917de90c78ca6828908790c0f0df33a319e3b793a35e2dc988f18f"
+            ]
+        if pattern == bootstrap_module._PREVIOUS_VERIFIED_CACHE_PATTERN:
+            return ["workflow:app:verified_credential:v2:old-entry"]
+        if pattern == "workflow:flow_info:v2:*":
+            return [
+                "workflow:flow_info:v2:1",
+                "workflow:flow_info:v2:1:latest",
+            ]
+        raise AssertionError(f"unexpected cache scan pattern: {pattern}")
 
     def delete(self, key: str) -> None:
         self.deleted.append(key)
@@ -295,6 +303,9 @@ def test_invalidate_legacy_bootstrap_caches_revokes_all_old_namespaces(
     assert "workflow:app_info:680ab54f" in cache.deleted
     assert "workflow:app_info:v2:680ab54f" in cache.deleted
     assert "workflow:app:api_key:7b709739e8da44536127a333c7603a83" in cache.deleted
+    legacy_digest = credential_cache_key(f"{LEGACY_TENANT_KEY}:{LEGACY_TENANT_SECRET}")
+    assert f"workflow:app:verified_credential:v3:{legacy_digest}" in cache.deleted
+    assert "workflow:app:verified_credential:v2:old-entry" in cache.deleted
     assert "workflow:flow_info:v2:1" in cache.deleted
     assert "workflow:flow_info:v2:1:latest" in cache.deleted
     assert any(
```

#### Recent Merged Pull Requests:
- **PR #1692** (2026-10-03): feat: Create workflow DSL files in the local agent via skills (@yjlu666)
- **PR #1690** (2026-10-02): fix(docker): pin available MinIO distribution for builds (@yjlu666)
- **PR #1689** (2026-10-02): fix(workflow): bind imported code nodes to execution user (@yjlu666)
- **PR #1681** (2026-09-23): fix(console): resolve models for published bots  (@yjlu666)
- **PR #1680** (2026-09-22): fix(console): resolve models for published bots (@yjlu666)
- **PR #1679** (2026-09-22): fix(docker): pull pinned MinIO image from official Quay registry (@yjlu666)
- **PR #1678** (2026-09-22): fix(console): restore workflow publishing and deduplicate errors (@yjlu666)
- **PR #1675** (2026-09-10): fix(workflow): reduce trace payload size for long conversations (@yjlu666)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
