# Forensic Learning Record (Deep Inspection): iflytek/astron-agent

> **Canonical Artifact**: `07_PROJECT_LEARNING/iflytek-astron-agent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/iflytek/astron-agent](https://github.com/iflytek/astron-agent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:57:59.505Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `iflytek/astron-agent`
- **Description**: Enterprise-grade, commercial-friendly agentic workflow platform for building next-generation SuperAgents.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9102 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `console/frontend/eslint.config.js`
```
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        document: 'readonly',
        window: 'writable', // 允许修改 window（如 window.xxx = 123）
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        IFlyCollector: 'readonly',
        fetch: 'readonly',
        NodeJS: 'readonly',
        self: 'writable',
        atob: 'readonly', // Base64 decode
        btoa: 'readonly', // Base64 encode
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettier,
    },
    rules: {
      'no-unused-vars': 'off', // 禁用原生规则
      'no-redeclare': 'off', // 禁用原生规则，使用 TypeScript 版本
      '@typescript-eslint/no-redeclare': 'error', // 启用 TypeScript 版本，支持函数重载
      // Prettier 集成（覆盖为 error，并显式使用 .prettierrc）
      'prettier/prettier': ['warn', {}, { usePrettierrc: true }],
      // TypeScript基本规则
      // TODO: refactor 暂时改成warn
      '@typescript-eslint/no-explicit-any': 'warn',
      // TODO: refactor 暂时改成warn
      '@typescript-eslint/explicit-function-return-type': 'warn',
      // TODO: refactor 暂时改成warn
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'none', // function arguments should not force to match this rule.
          argsIgnorePattern: '^_', // Specifications allow underlining
          ignoreRestSiblings: true, //Use rest syntax (such as'var {foo,... rest} = data ') to ignore foo.
          destructuredArrayIgnorePattern: '^_', //Structural arrays allow _
          caughtErrors: 'none',
          // "caughtErrorsIgnorePattern": "^e$"
        },
      ],
      // TODO: refactor 暂时改成warn
      '@typescript-eslint/no-non-null-assertion': 'warn',
      // 代码复杂度控制
      // TODO: refactor 暂时改成20
      complexity: ['warn', 40],
      // TODO: refactor 暂时改成200
      'max-lines-per-function': [
        'warn',
        {
          max: 200,
          IIFEs: true,
        },
      ],
      'max-params': ['warn', 5],
      // TODO: refactor 暂时改成warn
      'no-extra-boolean-cast': 'warn',
      'no-console': 'warn',
      'no-debugger': 'warn',
      'prefer-const': 'warn',
      'no-var': 'warn',
    },
  },
  eslintConfigPrettier,
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'coverage/',
      '*.log',
      '.DS_Store',
    ],
  },
];

```

### Core Architecture Module: `console/frontend/postcss.config.js`
```
export default {
  plugins: {
    'tailwindcss/nesting': {},
    tailwindcss: {},
    autoprefixer: {},
  },
};

```

### Core Architecture Module: `console/frontend/public/runtime-config.js`
```
/* eslint-disable */
window.__APP_CONFIG__ = window.__APP_CONFIG__ || {};

```

### Core Architecture Module: `console/frontend/src/app.tsx`
```
import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { RouterProvider } from 'react-router-dom';
import router from '@/router';
import useUserStore, { UserState } from '@/store/user-store';
import { useEnterprise } from './hooks/use-enterprise';
import { useSpaceType } from './hooks/use-space-type';
import i18n from './i18n';

export default function App(): ReactElement {
  const getUserInfo = useUserStore((state: UserState) => state.getUserInfo);
  const { getJoinedEnterpriseList, getEnterpriseSpaceCount, visitEnterprise } =
    useEnterprise();
  const { getLastVisitSpace, enterpriseId, switchToPersonal, isTeamSpace } =
    useSpaceType();
  const [initDone, setInitDone] = useState<boolean>(false);

  const initSpaceInfo = useCallback(async () => {
    try {
      const pathname = window.location.pathname.replace(/\/+$/, '');
      if (pathname === '/space' && isTeamSpace()) {
        switchToPersonal({ isJump: false });
        return;
      }

      if (!sessionStorage.getItem('lastVisitSpaceDone')) {
        await getLastVisitSpace();
        sessionStorage.setItem('lastVisitSpaceDone', 'true');
      }
    } finally {
      setInitDone(true);
    }
  }, [getLastVisitSpace, isTeamSpace, switchToPersonal]);

  useEffect(() => {
    const language = i18n.language || 'zh';
    // 设置根元素类名及lang
    document.documentElement.lang = language;
    document.documentElement.classList.forEach(className => {
      if (className.startsWith('')) {
        document.documentElement.classList.remove(className);
      }
    });
    document.documentElement.classList.add(`lang-${language}`);
  }, [i18n.language]);

  useEffect(() => {
    const pathname = window.location.pathname.replace(/\/+$/, '');
    if (pathname === '/callback') return; // 避免在回调页时发起鉴权相关请求
    getUserInfo();
    initSpaceInfo();
    getEnterpriseSpaceCount();
    getJoinedEnterpriseList();
  }, []);

  useEffect(() => {
    if (!initDone) return;
    getEnterpriseSpaceCount();
    visitEnterprise(enterpriseId);
  }, [enterpriseId, initDone]);

  return (
    <>
      <RouterProvider router={router} />
    </>
  );
}

```

### Core Architecture Module: `console/frontend/src/components/agent-creation/index.tsx`
```
import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, message, Spin, Tooltip } from 'antd';
import Ai_img from '@/assets/imgs/agent-creation/AI_icon.png';
import {
  quickCreateBot,
  aiGenPrologue,
  getBotTemplate,
} from '@/services/spark-common';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  HeaderFeedbackModalProps,
  BotMarketItem,
  QuickCreateBotResponse,
} from '@/types/agent-create';
import { AxiosResponse } from 'axios';
import { getRandom3 } from '@/utils/agent-create-utils';

import styles from './index.module.scss';

const HeaderFeedbackModal: React.FC<HeaderFeedbackModalProps> = ({
  visible,
  onCancel,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);
  const [form] = Form.useForm<{ preset_detail: string }>();
  const [tuijian, setTuijian] = useState<BotMarketItem[]>([]);

  const handleSubmit = (values: { preset_detail: string }): void => {
    setLoading(true);
    quickCreateBot(values.preset_detail).then(
      async (res: AxiosResponse<QuickCreateBotResponse>) => {
        await sessionStorage.setItem(
          'botTemplateInfoValue',
          JSON.stringify(res)
        );
        setLoading(false);
        navigate(
          '/space/config/base?create=true&quickCreate=trueis&sentence=1'
        );
        onCancel();
      },
      (err: { msg?: string }) => {
        message.error(err?.msg || t('createAgent1.createAgentFailed'));
        setLoading(false);
      }
    );
  };

  const aiGen = (): void => {
    const presetDetail = form.getFieldsValue().preset_detail;
    if (!presetDetail) {
      message.warning(t('createAgent1.settingCannotBeEmpty'));
      return;
    }
    setLoading(true);
    aiGenPrologue({ name: presetDetail })
      .then((res: string | object) => {
        // 检查 res 是否为字符串
        if (typeof res === 'string') {
          form.setFieldsValue({ preset_detail: res });
        } else {
          // 若 res 不是字符串，尝试将其转换为字符串
          form.setFieldsValue({ preset_detail: JSON.stringify(res) });
        }
        setLoading(false);
      })
      .catch((err: { msg?: string }) => {
        setLoading(false);
        message.error(err?.msg || t('createAgent1.aiGeneratedFailed'));
      });
    return;
  };

  useEffect(() => {
    getBotTemplate().then((res: unknown) => {
      if (res) {
        setTuijian(getRandom3(res as BotMarketItem[]));
      }
    });
  }, []);

  return (
    <Modal
      wrapClassName={styles.open_source_modal}
      width={640}
      open={visible}
      centered
      onCancel={onCancel}
      destroyOnClose
      maskClosable={false}
      footer={null}
    >
      <Spin spinning={loading} tip={t('createAgent1.generating')}>
        <div className={styles.modal_content}>
          <div className={styles.title}>
            {t('createAgent1.oneSentenceCreateAgent')}
          </div>
          <Form
            form={form}
            preserve={false}
            onFinish={handleSubmit}
            labelCol={{ span: 4, offset: 0 }}
            style={{ position: 'relative' }}
          >
            <div className={styles.tuijianBox}>
              <div className={styles.tuijianTitle}>
                {t('createAgent1.inspirationRecommend')}：
              </div>
              {tuijian.map(item => (
                <div
                  key={item?.id}
                  className={styles.tuijianButton}
                  onClick={() => {
                    getBotTemplate(item?.id).then(async (res: unknown) => {
                      if (!res) {
                        return message.warning(
                          t('createAgent1.templateDataEmpty')
                        );
                      }
                      if (Array.isArray(res) && res?.length > 0) {
                        await sessionStorage.setItem(
                          'botTemplateInfoValue',
                          JSON.stringify(res[0])
                        );
                      }
                      navigate(
                        '/space/config/base?create=true&quickCreate=true'
                      );
                      return;
                    });
                  }}
                >
                  <Tooltip title={item?.botName} placement="top">
                    {item?.botName}
                  </Tooltip>
                </div>
              ))}
            </div>
            <Form.Item
              name="preset_detail"
              label={t('createAgent1.setting')}
              labelCol={{ span: 24 }}
              wrapperCol={{ span: 24 }}
              rules={[
                {
                  required: true,
                  message: t('createAgent1.settingDescriptionCannotBeEmpty'),
                },
                // { max: 200, message: '字数超出限制，最多输入200字' },
                {
                  whitespace: true,
                  message: t('createAgent1.settingDescriptionCannotBeEmpty'),
                },
              ]}
              validateTrigger="onBlur"
              className={styles.form_area}
            >
              <Input.TextArea
                showCount
                maxLength={520}
                name="preset_detail"
                className={styles.input_area}
                autoSize={{ minRows: 5, maxRows: 5 }}
                placeholder={t('createAgent1.pleaseEnterContent')}
              />
            </Form.Item>
            <div className={styles.inputBottom}>
              <div
                style={{
                  background: '#F2F5FE',
                  borderRadius: '16px',
                  marginBottom: '5px',
                  marginLeft: '10px',
                }}
              >
                <div
                  className={styles.aiBottom}
                  onClick={() => {
                    aiGen();
                  }}
                >
                  <img src={Ai_img} alt="AI generated" />
                  <span>{t('createAgent1.aiGenerated')}</span>
                </div>
              </div>
              <div
                className={styles.clearBottom}
                onClick={() => {
                  form.resetFields();
                }}
              >
                {t('createAgent1.clear')}
              </div>
            </div>
            <div className={styles.footerContiner}>
              <div
                className={styles.cancelBtn}
                onClick={() => {
                  navigate('/space/config/base?create=true');
                }}
              >
                {t('createAgent1.skip')}
              </div>
              <Button className={styles.submitBtn} htmlType="submit">
                {t('createAgent1.createAgent')}
              </Button>
            </div>
          </Form>
        </div>
      </Spin>
    </Modal>
  );
};

export default HeaderFeedbackModal;

```

### Core Architecture Module: `console/frontend/src/components/bot-center/edit-bot/placeholder.ts`
```
export const placeholderText = {
  10: {
    name: '调研报告智能体',
    角色设定: '你是一位专业的调研人员',
    目标任务: '请根据我提供的主题完成一份调研报告',
    需求说明:
      '报告内容需包含：调研背景、调研目标、研究方法、数据分析、研究结果等方面',
    风格设定: '文字风格需严谨、准确、专业，逻辑清晰，表述完整',
    botDesc: '输入报告主题，就可以获得完整的调研报告',
    botTemplate:
      '比如：您输入“消费者行为”，我会根据这个主题写一篇研究消费者行为的调研报告',
    example1: '人工智能在职场的应用',
    example2: 'AIGC产业发展趋势',
    example3: '00后对新能源车的需求偏好',
  },
  11: {
    name: '小红书文案写作',
    角色设定: '你是一位优秀的小红书爆款写手',
    目标任务: '请根据我给出的信息，写一篇小红书爆款文案',
    需求说明:
      '内容可以包括：产品简介、外观、优缺点等。同时为起一个吸引人的小红书标题',
    风格设定: '小红书的写作风格，并适当加入表情',
    botDesc: '还在为小红书文案写作发愁？我来帮您一键搞定',
    botTemplate:
      '比如：当您输入“适合夏天的口红色号”，我会根据这个提示完成一篇适合推荐夏日口红的小红书文案',
    example1: '网红餐厅探店笔记',
    example2: '夏日流行运动套装，透气、舒适且时尚',
    example3: '职场人士的最佳伴侣：办公本',
  },
  12: {
    name: '影评人',
    角色设定: '你是一位专业的影评人',
    目标任务: '根据我提供的影视作品，写一篇引人入胜且富有创意的电影评论',
    需求说明:
      '内容可以涵盖情节、主题、表演、角色、导演、配乐、摄影、特效等主题。表达影视作品给你带来的感受及共鸣，也可以持批评态度。',
    风格设定: '风趣幽默',
    botDesc: '输入影视作品名称，快速获取影评',
    botTemplate: '比如：当您输入“狂飙”时，我会写出一段介绍狂飙的影评内容',
    example1: '流浪地球',
    example2: '长安三万里',
    example3: '复仇者联盟',
  },
  13: {
    name: 'AI写诗',
    角色设定: '你是一位知名的现代诗人',
    目标任务: '我希望你根据我提供的主题写一首现代诗',
    需求说明: '要求切合主题，立意新颖，注意押韵',
    风格设定: '豪放的文字风格',
    botDesc: '一个主题就能创作一首现代诗歌',
    botTemplate: '比如，您可以输入“夏天”，我会写一首关于夏天的现代诗',
    example1: '星火',
    example2: '浩瀚宇宙',
    example3: '母亲节',
  },
  14: {
    name: 'Java注释智能体',
    角色设定: '你是一名专家级的Java开发人员',
    目标任务: '现在我需要你对我提供的Java进行详细的解释和注释',
    需求说明:
      '1、注释代码时，需要逐行注释\n2、代码的解释可以放在代码注释的后面\n3、代码的整体解释可以放在代码的引包结束后',
    风格设定: '专业风格',
    botDesc: '告诉我你的Java代码，关于你不理解的问题，我会给你提供帮助',
    botTemplate:
      '比如您输入：\npublic class Hello {\n    public static void main(String[] args) {\n        System.out.println("Hello Java");\n    }\n}',
    example1: 'FileInputStream fileInputStream = null;',
    example2: 'public static TargetDataLine targetDataLine;',
    example3: `AsrService INSTANCE = Native.loadLibrary("res/msc_x64.dll", AsrService.class);`,
  },
  15: {
    name: '美食推荐官',
    角色设定: '你是一位美食推荐官',
    目标任务: '当我到达一个地方的时候，你要为我推荐当地的美食',
    需求说明: '要求在给我推荐美食的同时，告诉我关于美食的一些典故',
    风格设定: '',
    botDesc: '输入您所在的地点，我会为您推荐当地美食',
    botTemplate: '比如您输入：北京，我会为你推荐北京的美食',
    example1: '天津',
    example2: '上海',
    example3: `南京`,
  },
  16: {
    name: '面试智能体',
    角色设定: '你是一位有着丰富经验的面试官',
    目标任务: '现在我需要你针对我面试的职位向我提问问题',
    需求说明: '我给出回答后，你要进行评价，指出我回答中的不足',
    风格设定: '',
    botDesc: '告诉我要你要面试的岗位，我会向你提问',
    botTemplate: '比如您输入：产品经理，我会问你产品经理岗位相关的问题',
    example1: '产品经理',
    example2: '新媒体运营',
    example3: `商务经理`,
  },
  17: {
    name: '英语学习智能体',
    角色设定: '你现在是一位专业的英语教师',
    目标任务: '现在我需要你帮我解决英语学习中遇到的问题',
    需求说明: '在解答时要尽量的使用例句，让我能明白',
    风格设定: '',
    botDesc: '告诉我你英文学习中遇到的问题，我会帮你解决',
    botTemplate: '比如您输入：if与whether的区别，我会告你如何区分',
    example1: '如何正确掌握名词复数的变化',
    example2: '倒装句该如何使用',
    example3: `who与whom的用法有什么区别`,
  },
  18: {
    name: '电商客服',
    角色设定: '你现在是一位电商客服',
    目标任务: '现在需要你针对我提出的问题，给出相对应的话术',
    需求说明: '要求回复得当，口吻亲切有说服力',
    风格设定: '',
    botDesc: '输入您的问题，我会给您回复',
    botTemplate: '比如您输入：商品什么时候发货，我会告你你原因',
    example1: '商品为什么会延迟发货',
    example2: '如何退换货',
    example3: `是否提供运费险`,
  },
  19: {
    name: '请假小帮手',
    角色设定: '你现在是一位请假小帮手',
    目标任务: '当我需要请假时，你要根据我给出的理由，写一个请假条',
    需求说明: '要确保请假理由合情合理',
    风格设定: '',
    botDesc: '输入您的请假理由，我会给你写一个请假条',
    botTemplate: '比如您输入：朋友要结婚，我就可以帮你写一个请假条',
    example1: '路上堵车',
    example2: '发烧了',
    example3: `下楼脚崴了`,
  },
  20: {
    name: '旅行攻略智能体',
    角色设定: '假设你是一名导游',
    目标任务: '现在需要你根据我的旅行目的地和要求，帮我制定详细的旅行计划',
    需求说明: '旅行计划要兼顾吃喝住行玩。',
    风格设定: '',
    botDesc: '输入您的旅行目的地和其他要求，我来帮您制定旅行计划',
    botTemplate: '比如您输入：青岛，行程为期三天。我就可以帮您制定一份旅行计划',
    example1: '青岛，行程为期三天',
    example2: '大理，多推荐一些商业气息不浓的自然景点',
    example3: `杭州，家庭出游，有老人小朋友同行`,
  },
  21: {
    name: '公文写作助理',
    角色设定: '假设你是一名公文写作高手',
    目标任务: '现在需要你根据我的写作主题，帮我写一篇公文',
    需求说明: '要求符合公文写作规范，且逻辑严密，表述清晰',
    风格设定: '',
    botDesc: '我可以根据你的写作主题，帮你写一篇公文',
    botTemplate: '比如您输入：表彰先进个人。我就可以帮你写一篇公文',
    example1: '表彰先进个人',
    example2: '2022年度工作总结',
    example3: `节能减排倡议书`,
  },
  22: {
    name: '心理咨询专家',
    角色设定: '假设你是一位心理咨询专家',
    目标任务: '现在需要你根据我的咨询问题，帮我答疑解惑和疏导情绪',
    需求说明: '要求不仅要分析我产生此情绪的原因，还要给我具体的缓解建议',
    风格设定: '亲切放松的对话口吻',
    botDesc: '说出您要咨询的心理问题，让我来为您答疑解惑',
    botTemplate: '比如您输入：工作压力大，经常性失眠。我来给您一些帮助',
    example1: '工作压力大，经常失眠',
    example2: '孩子产生厌学心理',
    example3: `抑郁症`,
  },
  23: {
    name: '婚礼策划师',
    角色设定: '你是一名婚礼策划师',
    目标任务: '我的婚礼在即，请你根据我的要求，给我一份详细的婚礼策划案',
    需求说明:
      '婚礼策划案中要包括，我需要准备哪些事项、物品清单、时间节点等，但不限于上述内容',
    风格设定: '',
    botDesc: '请告诉我您对婚礼的诉求，金牌婚礼策划师来帮您出方案',
    botTemplate: '比如您输入：流程简化的传统婚礼。我来为您细化婚礼方案',
    example1: '流程简化的传统婚礼',
    example2: '我想把婚礼做成party的形式，只邀请一些好友和家人',
    example3: `西式婚礼`,
  },
};

```

### Core Architecture Module: `console/frontend/src/components/button-group/button-group.tsx`
```
import React from 'react';
import { Button } from 'antd';
import classNames from 'classnames';
import SpaceButton from './space-button';
import type { ButtonConfig, ButtonGroupProps } from './types';
import styles from './button-group.module.scss';

const ButtonGroup: React.FC<ButtonGroupProps> = ({
  buttons,
  userRole,
  className,
  size = 'middle',
  onButtonClick,
  style,
  vertical = false,
  split = true,
  defaultPermissionFailureBehavior,
}) => {
  // 渲染单个按钮，权限控制由 SpaceButton 组件处理
  const renderButton = (
    buttonConfig: ButtonConfig,
    index: number
  ): React.ReactNode => {
    return (
      <SpaceButton
        key={buttonConfig.key}
        config={buttonConfig}
        userRole={userRole}
        size={size}
        onClick={onButtonClick}
        inGroup={true}
        defaultPermissionFailureBehavior={defaultPermissionFailureBehavior}
      />
    );
  };

  // 渲染所有按钮，过滤掉不显示的按钮（返回null的）
  const renderedButtons = buttons
    .map((button, index) => renderButton(button, index))
    .filter(button => button !== null);

  // 如果没有可显示的按钮，返回null
  if (renderedButtons.length === 0) {
    return null;
  }

  const sizeClassNameKey = `size-${size}`;
  const sizeClassName = styles[sizeClassNameKey] ?? sizeClassNameKey;
  const groupClassName = classNames(
    styles.spaceButtonGroup,
    sizeClassName,
    vertical && styles.vertical,
    !split && styles.noSplit,
    className
  );

  return (
    <Button.Group className={groupClassName} size={size} style={style}>
      {renderedButtons}
    </Button.Group>
  );
};

export default ButtonGroup;

```

### Core Architecture Module: `console/frontend/src/components/button-group/index.ts`
```
// 导出主组件
export { default } from './button-group';

// 导出SpaceButton组件
export { default as SpaceButton } from './space-button';

// 导出所有类型定义
export type {
  ButtonConfig,
  UserRole,
  ButtonGroupProps,
  PermissionConfig,
  ButtonClickHandler,
  PermissionChecker,
  VisibilityChecker,
} from './types';

// 导出权限相关枚举（方便使用）
export {
  SpaceType,
  RoleType,
  ModuleType,
  OperationType,
  PermissionFailureBehavior,
} from './types';

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
@@ -384,7 +394,7 @@ private void syncWorkflowRuntime
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
@@ -603,8 +608,8 
```

---

### Incident Patch 2: `5e758547` (2026-09-10)
**Commit Message**: fix(workflow): reduce trace payload size for long conversations (#1675)

* fix(workflow): reduce trace payload size for long conversations

Signed-off-by: yjlu12 <1064690083@qq.com>

* refactor(workflow): split legacy trace encoding helper

Signed-off-by: yjlu12 <1064690083@qq.com>

---------

Signed-off-by: yjlu12 <1064690083@qq.com>

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
+  
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
+async 
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
+        
```

---

### Incident Patch 4: `1291f8bd` (2026-09-08)
**Commit Message**: fix(workflow): preserve code node source escapes

Signed-off-by: yjlu12 <1064690083@qq.com>

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
+        
```

---

### Incident Patch 5: `189600dd` (2026-09-01)
**Commit Message**: fix(security): prevent SSRF in outbound plugin requests (#1669)

* fix(security): prevent SSRF in outbound plugin requests

Validate URLs, resolved addresses, redirects, and download targets across the console, link plugin, and AI tools. Preserve only narrowly scoped internal storage access and add regression coverage for rebinding and parser edge cases.

Signed-off-by: yjlu12 <1064690083@qq.com>

* chore(console): apply Spotless formatting

Signed-off-by: yjlu12 <1064690083@qq.com>

---------

Signed-off-by: yjlu12 <1064690083@qq.com>

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
-         
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
-                "http:
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
+            e
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

Signed-off-by: yjlu12 <1064690083@qq.com>

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

Signed-off-by: yjlu12 <1064690083@qq.com>

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

Signed-off-by: yjlu12 <1064690083@qq.com>

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

#### Recent Merged Pull Requests:
- **PR #1681** (2026-09-23): fix(console): resolve models for published bots  (@yjlu666)
- **PR #1680** (2026-09-22): fix(console): resolve models for published bots (@yjlu666)
- **PR #1679** (2026-09-22): fix(docker): pull pinned MinIO image from official Quay registry (@yjlu666)
- **PR #1678** (2026-09-22): fix(console): restore workflow publishing and deduplicate errors (@yjlu666)
- **PR #1675** (2026-09-10): fix(workflow): reduce trace payload size for long conversations (@yjlu666)
- **PR #1674** (2026-09-09): refactor(workflow): split legacy trace encoding helper (@yjlu666)
- **PR #1673** (2026-09-09): fix(workflow): reduce trace payload size for long conversations (@yjlu666)
- **PR #1672** (2026-09-09): fix(workflow): preserve code node source escapes (@yjlu666)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
