# Forensic Learning Record (Deep Inspection): ant-design/pro-components

> **Canonical Artifact**: `07_PROJECT_LEARNING/ant-design-pro-components-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ant-design/pro-components](https://github.com/ant-design/pro-components))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:03:51.566Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ant-design/pro-components`
- **Description**: 🏆 Use Ant Design like a Pro!
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4837 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `demos/form/form-control-render.tsx`
```
import {
  FormControlRender,
  pickControlPropsWithId,
} from '@ant-design/pro-components';
import { Button, Checkbox, Form } from 'antd';
import React, { useEffect } from 'react';

const App: React.FC = () => {
  const [form] = Form.useForm();

  useEffect(() => {
    void form.validateFields();
  }, []);

  return (
    <Form name="form-control-render-demo" form={form} onFinish={console.log}>
      <Form.Item
        name={'text1'}
        label="文本框（没错误边框）"
        rules={[{ required: true }]}
      >
        <textarea />
      </Form.Item>
      <Form.Item
        name="text2"
        label="文本框（添加自定义的错误边框）"
        rules={[{ required: true }]}
      >
        <FormControlRender>
          {(itemProps) => {
            return (
              <textarea
                style={{
                  borderColor: itemProps.status === 'error' ? 'red' : undefined,
                }}
                {...pickControlPropsWithId(itemProps)}
              />
            );
          }}
        </FormControlRender>
      </Form.Item>
      <Form.Item
        valuePropName="checked"
        name="check"
        label="复选框"
        rules={[{ required: true }]}
      >
        <Checkbox>是否</Checkbox>
      </Form.Item>
      <Form.Item
        valuePropName="checked"
        name="check2"
        label="复选框"
        rules={[{ required: true }]}
      >
        <FormControlRender>
          {(itemProps) => {
            return (
              <Checkbox
                {...itemProps}
                style={{
                  color: itemProps.status === 'error' ? 'red' : undefined,
                }}
              >
                是否
              </Checkbox>
            );
          }}
        </FormControlRender>
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">
          Submit
        </Button>
      </Form.Item>
    </Form>
  );
};

export default () => (
  <div style={{ padding: 24 }}>
    <App />
  </div>
);

```

### Core Architecture Module: `demos/form/form-item-render.tsx`
```
import {
  FormControlFC,
  FormItemRender,
  ProForm,
  ProFormItemRender,
  WithControlPropsType,
  pickControlProps,
  pickControlPropsWithId,
  useControlModel,
} from '@ant-design/pro-components';
import { Checkbox, Input, message, Select } from 'antd';

const SingletonA = (
  props: WithControlPropsType<{
    title: string;
  }>,
) => {
  const model = useControlModel(props);
  return (
    <>
      <span>{props.title}</span>
      <Input {...model} placeholder="直接使用useControlModel" />
    </>
  );
};
const SingletonB = (
  props: WithControlPropsType<{
    title: string;
  }>,
) => {
  const model = useControlModel(props);
  return (
    <>
      <span>{props.title}</span>
      <Select
        {...model}
        options={[
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ]}
      />
    </>
  );
};

const CustomInput = (
  props: WithControlPropsType<{
    title: string;
    description: string;
  }>,
) => {
  const model = useControlModel(props, [
    {
      name: 'a',
      valuePropName: 'checked',
    },
    {
      name: 'b',
    },
  ]);

  return (
    <div>
      <div>title: {props.title}</div>
      <Checkbox {...model.a} />
      <div>description: {props.description}</div>
      <Input
        {...model.b}
        placeholder="可以通过第二个参数达到使用多个实例的情况"
      />
    </div>
  );
};

const CustomInput2: FormControlFC<{
  title: string;
}> = (props) => {
  const model = useControlModel(props, ['a', 'b']);
  return (
    <div>
      <div>{props.title}</div>
      <Input {...model.a} />
    </div>
  );
};

const Demo = () => {
  const [form] = ProForm.useForm();

  return (
    <div>
      <ProForm
        name="form-item-render-demo"
        form={form}
        onFinish={async () => {
          message.success('提交成功');
        }}
      >
        <ProForm.Item name={'SingletonA'}>
          <SingletonA title="单实例A" />
        </ProForm.Item>
        <ProForm.Item name={'SingletonB'}>
          <SingletonB title="单实例B" />
        </ProForm.Item>
        <ProForm.Item name={'customInput'} label="多实例">
          <CustomInput
            title="customInput-title"
            description="customInput-desc"
          />
        </ProForm.Item>
        <ProForm.Item name={'FormControlFC'} label="使用FormControlFC类型定义">
          <CustomInput2 title="FormControlFC title" />
        </ProForm.Item>
        <ProFormItemRender name={'inputA'}>
          {(itemProps) => {
            return (
              <div id={itemProps.id}>
                <h3>使用pickControlProps提取表单项属性</h3>
                <Input {...pickControlProps(itemProps)} />
              </div>
            );
          }}
        </ProFormItemRender>
        <ProFormItemRender name={'inputB'}>
          {(itemProps) => {
            return (
              <div>
                <h3>使用pickControlPropsWithId提取表单项属性（包括id）</h3>
                <Input {...pickControlPropsWithId(itemProps)} />
              </div>
            );
          }}
        </ProFormItemRender>
        <ProFormItemRender name={'selectA'}>
          {(itemProps) => {
            return (
              <div>
                <h3>自定义标题：</h3>
                <Select
                  {...pickControlProps(itemProps)}
                  options={[{ label: 'A', value: 'a' }]}
                />
              </div>
            );
          }}
        </ProFormItemRender>
        <FormItemRender
          label="FormItemRender"
          name={'selectB'}
          initialValue={'xxx'}
        >
          {(itemProps) => {
            return (
              <div>
                <Input {...pickControlPropsWithId(itemProps)} />
              </div>
            );
          }}
        </FormItemRender>
      </ProForm>
    </div>
  );
};

export default () => (
  <div style={{ padding: 24 }}>
    <Demo />
  </div>
);

```

### Core Architecture Module: `demos/form/loading-render.tsx`
```
import { ProForm, ProFormText } from '@ant-design/pro-components';
import { Skeleton } from 'antd';

export default () => (
  <div style={{ padding: 24 }}>
    <ProForm
      request={async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return { name: 'pro components' };
      }}
      loadingRender={<Skeleton paragraph={{ rows: 4 }} />}
    >
      <ProFormText
        name="name"
        label="Name"
        placeholder="Please enter your name"
      />
    </ProForm>
  </div>
);

```

### Core Architecture Module: `demos/form/schema-form/dynamic-rerender.tsx`
```
import type { ProFormColumnsType } from '@ant-design/pro-components';
import { BetaSchemaForm } from '@ant-design/pro-components';
import { Input } from 'antd';

const valueEnum = {
  all: { text: '全部', status: 'Default' },
  open: {
    text: '未解决',
    status: 'Error',
  },
  closed: {
    text: '已解决',
    status: 'Success',
    disabled: true,
  },
  processing: {
    text: '解决中',
    status: 'Processing',
  },
};

type DataItem = {
  name: string;
  state: string;
  title: string;
};

const columns: ProFormColumnsType<DataItem>[] = [
  {
    title: '标题',
    dataIndex: 'title',
    initialValue: '必填',
    formItemProps: {
      rules: [
        {
          required: true,
          message: '此项为必填项',
        },
      ],
    },
    width: 'm',
  },
  {
    title: '状态',
    dataIndex: 'state',
    valueType: 'select',
    valueEnum,
    width: 'm',
    tooltip: '当title为disabled时状态无法选择',
    fieldProps: (form) => {
      if (form.getFieldValue('title') === 'disabled') {
        return {
          disabled: true,
          placeholder: 'disabled',
        };
      } else {
        return {
          placeholder: 'normal',
        };
      }
    },
  },
  {
    title: '标签',
    dataIndex: 'labels',
    width: 'm',
    tooltip: '当title为必填时此项将为必填',
    dependencies: ['title'],
    formItemProps(form) {
      if (form.getFieldValue('title') === '必填') {
        return {
          rules: [
            {
              required: true,
            },
          ],
        };
      } else {
        return {};
      }
    },
  },
  {
    valueType: 'dependency',
    name: ['title'],
    columns: ({ title }) => {
      return title !== 'hidden'
        ? [
            {
              title: 'title为hidden时隐藏',
              dataIndex: 'hidden',
              valueType: 'date',
              formItemRender: () => {
                return <Input />;
              },
            },
          ]
        : [];
    },
  },
  {
    title: '创建时间',
    key: 'showTime',
    dataIndex: 'createName',
    valueType: 'date',
  },
];

const Demo = () => {
  return (
    <>
      <BetaSchemaForm<DataItem>
        shouldUpdate={(newValues, oldValues) => {
          if (newValues.title !== oldValues?.title) {
            return true;
          }
          return false;
        }}
        layoutType="Form"
        onFinish={async () => {

        }}
        columns={columns}
      />
    </>
  );
};

export default () => (
  <div style={{ padding: 24 }}>
    <Demo />
  </div>
);

```

### Core Architecture Module: `demos/list/custom-render.tsx`
```
import { ProList } from '@ant-design/pro-components';
import { Avatar, theme } from 'antd';

const APPLICATIONS = [
  {
    id: '1',
    title: '帆软 SSO',
    avatar:
      'https://gw.alipayobjects.com/zos/antfincdn/UCSiy1j6jx/xingzhuang.svg',
    description:
      'FineReport 是一款用于报表制作、分析和展示的软件，支持数据填报与可视化大屏。',
  },
  {
    id: '2',
    title: '泛微 E9 SSO',
    avatar:
      'https://gw.alipayobjects.com/zos/antfincdn/UCSiy1j6jx/xingzhuang.svg',
    description:
      '泛微 E9 是一款成熟的协同办公软件，以流程管理、知识管理为核心。',
  },
  {
    id: '3',
    title: '销售易',
    avatar:
      'https://gw.alipayobjects.com/zos/antfincdn/UCSiy1j6jx/xingzhuang.svg',
    description:
      'SAML (Security Assertion Markup Language) 是一种用于身份认证与授权的标准协议。',
  },
];

type AppItem = (typeof APPLICATIONS)[0];

export default () => {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        backgroundColor: token.colorBgLayout,
        margin: -24,
        padding: 64,
      }}
    >
      <ProList<AppItem>
        rowKey="id"
        split
        grid={{
          xs: 1,
          sm: 2,
          md: 2,
          lg: 4,
          xl: 4,
          xxl: 4,
          gutter: [16, 16],
        }}
        pagination={false}
        columns={[
          { dataIndex: 'title', listSlot: 'title' },
          { dataIndex: 'avatar', listSlot: 'avatar' },
          { dataIndex: 'description', listSlot: 'description' },
        ]}
        dataSource={APPLICATIONS}
        toolbar={{
          menu: {
            type: 'tab',
            items: [
              { key: 'all', label: '全部应用' },
              { key: 'dev', label: '开发类' },
              { key: 'ops', label: '运维类' },
              { key: 'office', label: '办公类' },
            ],
          },
        }}
        itemRender={(item) => (
          <div
            style={{
              width: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
              borderRadius: 8,
              padding: 24,
              height: '100%',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              background: token.colorBgContainer,
            }}
            tabIndex={0}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <Avatar
                src={item.avatar}
                shape="square"
                size={48}
                style={{ flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 16,
                    marginBottom: 4,
                  }}
                >
                  {item.title}
                </div>
                <div
                  style={{
                    color: token.colorTextSecondary,
                    fontSize: 14,
                    lineHeight: 1.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {item.description}
                </div>
              </div>
            </div>
          </div>
        )}
      />
    </div>
  );
};

```

### Core Architecture Module: `demos/table/dynamic-columns-state.tsx`
```
import { QuestionCircleOutlined, SearchOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Input, Tooltip } from 'antd';
import { useState } from 'react';

import {
  DEMO_APP_NAMES,
  DEMO_CREATORS,
  FIXED_BASE_TIMESTAMP,
} from '../mockData';

const valueEnum: Record<string, string> = {
  0: 'close',
  1: 'running',
};

export type TableListItem = {
  key: number;
  name: string;
  containers: number;
  creator: string;
  status: string;
  createdAt: number;
  progress: number;
  money: number;
  memo: string;
  statusText: string;
};

const tableListDataSource: TableListItem[] = Array.from(
  { length: 5 },
  (_, i) => ({
    key: i,
    name: DEMO_APP_NAMES[i % DEMO_APP_NAMES.length],
    containers: ((i * 3 + 2) % 12) + 1,
    creator: DEMO_CREATORS[i % DEMO_CREATORS.length],
    status: valueEnum[String(i % 2)],
    createdAt: FIXED_BASE_TIMESTAMP - i * 86400000,
    money: ((i * 3456 + 7890) % 50000) * 100,
    progress: ((i * 17 + 23) % 100) + 1,
    memo:
      i % 2 === 1
        ? '核心服务，承载全站用户登录与鉴权，高峰期需要关注性能指标'
        : '日常运维中，当前运行状态正常',
    statusText: i % 2 === 0 ? '已关闭，等待重新部署' : '运行中，CPU 占用 35%',
  }),
);

const columns: ProColumns<TableListItem>[] = [
  {
    title: '应用名称',
    dataIndex: 'name',
    render: (_) => <a>{_}</a>,
    filterDropdown: () => (
      <div style={{ padding: 8 }}>
        <Input style={{ width: 188, marginBottom: 8, display: 'block' }} />
      </div>
    ),
    filterIcon: (filtered) => (
      <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />
    ),
  },
  {
    title: '状态',
    dataIndex: 'status',
    initialValue: 'close',
    valueType: 'radioButton',
    valueEnum: {
      close: { text: '已关闭', status: 'Default' },
      running: { text: '运行中', status: 'Processing' },
    },
  },
  {
    title: (
      <>
        部署时间
        <Tooltip placement="top" title="最近一次部署的时间">
          <QuestionCircleOutlined style={{ marginLeft: 4 }} />
        </Tooltip>
      </>
    ),
    width: 140,
    key: 'since',
    dataIndex: 'createdAt',
    valueType: 'date',
  },
  {
    title: '备注',
    dataIndex: 'memo',
    ellipsis: true,
    copyable: true,
  },
];

const Demo = () => {
  const [currentStatus, setCurrentStatus] = useState<string>('close');

  const closeColumns: ProColumns<TableListItem>[] = [
    {
      title: '排序',
      dataIndex: 'index',
      valueType: 'indexBorder',
      width: 48,
    },
    {
      title: '停机信息',
      dataIndex: 'statusText',
    },
    ...columns,
  ];

  const runningColumns: ProColumns<TableListItem>[] = [
    {
      title: '排序',
      dataIndex: 'index',
      valueType: 'indexBorder',
      width: 48,
    },
    {
      title: '运行信息',
      dataIndex: 'statusText',
    },
    ...columns,
  ];
  return (
    <ProTable<TableListItem>
      columns={currentStatus === 'close' ? closeColumns : runningColumns}
      request={() => {
        return Promise.resolve({
          data: tableListDataSource,
          total: tableListDataSource.length,
          success: true,
        });
      }}
      rowKey="key"
      search={{
        layout: 'vertical',
        defaultCollapsed: false,
      }}
      onSubmit={({ status }) => {
        setCurrentStatus(status);
      }}
      columnsState={{
        persistenceKey: `table_dynamic_status_${currentStatus}`,
        persistenceType: 'sessionStorage',
      }}
      dateFormatter="string"
      toolbar={{
        title: '动态列状态',
        tooltip: '根据状态切换动态显示不同列',
      }}
    />
  );
};

export default () => (
  <div style={{ padding: 24 }}>
    <Demo />
  </div>
);

```

### Core Architecture Module: `demos/table/render-table.tsx`
```
import { MailOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Card, Descriptions, Menu } from 'antd';
import { useState } from 'react';

import { FIXED_BASE_TIMESTAMP } from '../mockData';

const waitTime = (time: number = 100) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, time);
  });
};

export type TableListItem = {
  key: number;
  name: string;
  createdAt: number;
  progress: number;
};

const tableListDataSource: TableListItem[] = Array.from(
  { length: 2 },
  (_, i) => ({
    key: i,
    name: i === 0 ? '用户认证服务' : '支付网关',
    createdAt: FIXED_BASE_TIMESTAMP - (i * 1000 + 200),
    progress: ((i * 17 + 23) % 100) + 1,
  }),
);

const columns: ProColumns<TableListItem>[] = [
  {
    title: '序号',
    dataIndex: 'index',
    valueType: 'index',
    width: 80,
  },
  {
    title: '更新时间',
    key: 'since2',
    dataIndex: 'createdAt',
    valueType: 'date',
  },
  {
    title: '部署进度',
    dataIndex: 'progress',
    valueType: 'progress',
  },
];

const Demo = () => {
  const [key, setKey] = useState('1');

  return (
    <ProTable<TableListItem>
      columns={columns}
      rowKey="key"
      pagination={{
        showSizeChanger: true,
      }}
      tableRender={(_, dom) => (
        <div
          style={{
            display: 'flex',
            width: '100%',
          }}
        >
          <Menu
            onSelect={(e) => setKey(e.key as string)}
            style={{ width: 256 }}
            defaultSelectedKeys={['1']}
            defaultOpenKeys={['sub1']}
            mode="inline"
            items={[
              {
                key: 'sub1',
                label: (
                  <span>
                    <MailOutlined />
                    <span>服务管理</span>
                  </span>
                ),
                children: [
                  {
                    type: 'group',
                    key: 'g1',
                    label: '核心服务',
                    children: [
                      { key: '1', label: '用户认证服务' },
                      { key: '2', label: '订单处理中心' },
                    ],
                  },
                  {
                    type: 'group',
                    key: 'g2',
                    label: '基础设施',
                    children: [
                      { key: '3', label: '支付网关' },
                      { key: '4', label: '消息推送平台' },
                    ],
                  },
                ],
              },
            ]}
          />
          <div
            style={{
              flex: 1,
            }}
          >
            {dom}
          </div>
        </div>
      )}
      tableExtraRender={(_, data) => (
        <Card>
          <Descriptions size="small" column={3}>
            <Descriptions.Item label="实例数">{data.length}</Descriptions.Item>
            <Descriptions.Item label="负责人">书琰</Descriptions.Item>
            <Descriptions.Item label="关联项目">
              <a>智慧零售平台</a>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">2024-01-10</Descriptions.Item>
            <Descriptions.Item label="上线时间">2024-01-15</Descriptions.Item>
          </Descriptions>
        </Card>
      )}
      params={{
        key,
      }}
      request={async () => {
        await waitTime(200);
        return {
          success: true,
          data: tableListDataSource,
        };
      }}
      dateFormatter="string"
      headerTitle="自定义表格主体"
    />
  );
};

export default () => (
  <div style={{ padding: 24 }}>
    <Demo />
  </div>
);

```

### Core Architecture Module: `src/descriptions/FieldRender.tsx`
```
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { get, set } from '@rc-component/util';
import type { FormInstance } from 'antd';
import React from 'react';
import ProForm, { ProFormField } from '../form';
import { proTheme } from '../provider';
import type { ProCoreActionType, UseEditableMapUtilType } from '../utils';
import type { ProFieldValueTypeInput } from '../utils/typing';
import {
  InlineErrorFormItem,
  getFieldPropsOrFormItemProps,
  useDeepCompareMemo,
} from '../utils';
import type { ProDescriptionsColumn } from './typing';

/**
 * Descriptions 单列：只读 / 可编辑下的 ProFormField 渲染
 */
export const FieldRender: React.FC<
  Omit<ProDescriptionsColumn<any>, 'valueType'> & {
    text: any;
    valueType: ProFieldValueTypeInput;
    entity: any;
    action: ProCoreActionType<any>;
    index: number;
    editableUtils?: UseEditableMapUtilType;
    emptyText?: React.ReactNode;
  }
> = (props) => {
  const {
    valueEnum,
    action,
    index,
    text,
    entity,
    mode,
    render,
    editableUtils,
    valueType,
    plain,
    dataIndex,
    request,
    formItemRender,
    params,
    emptyText,
  } = props;
  const form = ProForm.useFormInstance();

  const { token } = proTheme.useToken?.();

  // Descriptions 没有 Form 实例，dependencies 的取值来自 dataSource（entity）。
  // 与 SchemaForm 的行为对齐：把依赖字段的值注入 request 的 params（#9170）
  const dependenciesValues = useDeepCompareMemo(() => {
    const deps = props.dependencies;
    if (!deps?.length) return undefined;
    let values: Record<string, any> = {};
    deps.forEach((dep) => {
      const namePath = [dep].flat(1) as (string | number)[];
      const value = get(entity, namePath);
      if (value !== undefined) {
        // rc-util 的 set 是 immutable 的，必须使用返回值
        values = set(values, namePath, value);
      }
    });
    return values;
  }, [props.dependencies, entity]);

  const fieldConfig = {
    text,
    valueEnum,
    mode: mode || 'read',
    dependenciesValues,
    proFieldProps: {
      emptyText,
      render: render
        ? (finText: string) => {
            return render?.(finText, entity, index, action, {
              ...props,
              type: 'descriptions',
            });
          }
        : undefined,
    },
    ignoreFormItem: true,
    valueType,
    request,
    params,
    plain,
  };

  if (mode === 'read' || !mode || valueType === 'option') {
    const fieldProps = getFieldPropsOrFormItemProps(
      props.fieldProps,
      undefined,
      {
        ...props,
        rowKey: dataIndex,
        isEditable: false,
      },
    );
    return (
      <ProFormField name={dataIndex} {...fieldConfig} fieldProps={fieldProps} />
    );
  }

  const renderDom = () => {
    const formItemProps = getFieldPropsOrFormItemProps(
      props.formItemProps,
      form as FormInstance<any>,
      {
        ...props,
        rowKey: dataIndex,
        isEditable: true,
      },
    );
    const fieldProps = getFieldPropsOrFormItemProps(
      props.fieldProps,
      form as FormInstance<any>,
      {
        ...props,
        rowKey: dataIndex,
        isEditable: true,
      },
    );

    return (
      <div
        style={{ display: 'flex', gap: token.marginXS, alignItems: 'baseline' }}
      >
        <InlineErrorFormItem
          name={dataIndex}
          {...formItemProps}
          style={{
            flex: 1,
            minWidth: 0,
            margin: 0,
            ...(formItemProps?.style || {}),
          }}
          initialValue={text || formItemProps?.initialValue}
        >
          <ProFormField
            {...fieldConfig}
            proFieldProps={{ ...fieldConfig.proFieldProps }}
            formItemRender={
              formItemRender
                ? () =>
                    formItemRender?.(
                      {
                        ...props,
                        type: 'descriptions',
                      },
                      {
                        isEditable: true,
                        recordKey: dataIndex as React.Key,
                        record: form.getFieldValue(
                          [dataIndex].flat(1) as (string | number)[],
                        ),
                        defaultRender: () => (
                          <ProFormField
                            {...fieldConfig}
                            fieldProps={fieldProps}
                          />
                        ),
                        type: 'descriptions',
                      },
                      form as FormInstance<any>,
                    )
                : undefined
            }
            fieldProps={fieldProps}
          />
        </InlineErrorFormItem>
        <div
          style={{
            display: 'flex',
            maxHeight: token.controlHeight,
            alignItems: 'center',
            gap: token.marginXS,
          }}
        >
          {editableUtils?.actionRender?.((dataIndex as React.Key) || index, {
            cancelText: <CloseOutlined />,
            saveText: <CheckOutlined />,
            deleteText: false,
          })}
        </div>
      </div>
    ) as React.ReactNode;
  };

  return (
    <div
      style={{
        marginTop: -5,
        marginBottom: -5,
        marginLeft: 0,
        marginRight: 0,
        width: '100%',
      }}
    >
      {renderDom()}
    </div>
  );
};

```

### Core Architecture Module: `src/field/ProFieldCore.tsx`
```
import React, { useContext } from 'react';
import type {
  ProFieldFCRenderProps,
  ProRenderFieldPropsType,
} from '../provider';
import ProConfigContext from '../provider';
import {
  omitUndefined,
  pickProProps,
  type ProFieldTextType,
  type ProFieldValueTypeInput,
  useDeepCompareMemo,
  useRefFunction,
} from '../utils';
import './initDayjs';
import type { ProFieldPropsType, ProFieldRenderProps } from './types';

export type ProFieldRenderText = (
  dataValue: ProFieldTextType,
  valueType: ProFieldValueTypeInput,
  props: ProFieldRenderProps,
  valueTypeMap: Record<string, ProRenderFieldPropsType>,
) => React.ReactNode;

/** 只读 / 编辑使用各自渲染函数，避免在单函数内反复判断 mode */
export type ProFieldDualRender = {
  renderRead: ProFieldRenderText;
  renderEdit: ProFieldRenderText;
};

export function isProFieldDualRender(
  input: ProFieldRenderText | ProFieldDualRender,
): input is ProFieldDualRender {
  return (
    typeof input === 'object' &&
    input !== null &&
    'renderRead' in input &&
    'renderEdit' in input
  );
}

export interface CreateProFieldOptions {
  /**
   * 为 true 时，当 valueType 在 context.valueTypeMap 中注册过，
   * 将对应标志传给 pickProProps，使自定义 valueType 的 props 少被过滤
   */
  pickProPropsWithValueTypeMap: boolean;
}

/**
 * @param render 单函数时读写共用（兼容旧用法）；对象时分别指定只读 / 编辑渲染
 * 显式返回组件类型，避免 PropsWithoutRef 对带索引签名的 ProFieldPropsType 执行 Omit 后丢失具名属性。
 */
export function createProField(
  render: ProFieldRenderText | ProFieldDualRender,
  options: CreateProFieldOptions,
): React.ForwardRefExoticComponent<
  ProFieldPropsType & React.RefAttributes<any>
> {
  const renderRead = isProFieldDualRender(render) ? render.renderRead : render;
  const renderEdit = isProFieldDualRender(render) ? render.renderEdit : render;

  const ProFieldComponent: React.ForwardRefRenderFunction<
    any,
    ProFieldPropsType
  > = (
    {
      text,
      valueType,
      mode = 'read',
      onChange,
      formItemRender,
      value,
      readonly,
      fieldProps: restFieldProps,
      // #8380:Form.Item 经 cloneElement 注入的 onBlur（validateTrigger="onBlur" 时
      // 是 rc-form 的校验触发器）不在 fieldProps 里,不取出会在下方 rest 透传中被丢弃,
      // 导致 onBlur 校验不生效。
      onBlur: injectedOnBlur,
      ...rest
    },
    ref,
  ) => {
    const context = useContext(ProConfigContext);

    const onChangeCallBack = useRefFunction((...restParams: any[]) => {
      restFieldProps?.onChange?.(...restParams);
      onChange?.(...restParams);
    });

    const onBlurCallBack = useRefFunction((...restParams: any[]) => {
      restFieldProps?.onBlur?.(...restParams);
      injectedOnBlur?.(...restParams);
    });

    const fieldProps: any = useDeepCompareMemo(() => {
      return (
        (value !== undefined || restFieldProps || injectedOnBlur) && {
          value,
          ...omitUndefined(restFieldProps),
          onChange: onChangeCallBack,
          ...(injectedOnBlur ? { onBlur: onBlurCallBack } : {}),
        }
      );
    }, [value, restFieldProps, onChangeCallBack, onBlurCallBack, injectedOnBlur]);

    const customValueType =
      options.pickProPropsWithValueTypeMap &&
      Object.keys(context.valueTypeMap || {}).includes(String(valueType));

    // #9002 显式传入的 valueType 不再被 valueEnum/request 智能推断覆盖：
    // 仅当调用方未设置 valueType（缺省 'text'）时才允许推断为 select 等类型，
    // 用于区分「用户显式要 text」与「历史默认行为（有 valueEnum 就渲染 select）」
    const isDefaultValueType = valueType === undefined;

    const effectiveMode = readonly ? 'read' : mode;
    /** 取值顺序仍以原始 mode 为准（readonly + mode=edit 时仍按编辑态取 fieldProps.value） */
    const dataValue =
      mode === 'edit' || mode === 'update'
        ? (fieldProps?.value ?? text ?? '')
        : (text ?? fieldProps?.value ?? '');
    const renderFn =
      effectiveMode === 'edit' || effectiveMode === 'update'
        ? renderEdit
        : renderRead;

    const renderedDom = renderFn(
      dataValue,
      valueType || 'text',
      omitUndefined({
        ref,
        ...rest,
        // #9002 标记 valueType 是否为缺省值（undefined 时补 'text'）。
        // AllProField / ValueTypeToComponent 依据此标记决定是否做
        // 「valueEnum/request → select」的智能推断，显式 valueType 优先。
        isDefaultValueType,
        mode: effectiveMode,
        formItemRender: formItemRender
          ? (
              curText: any,
              props: ProFieldFCRenderProps,
              dom: React.JSX.Element,
            ) => {
              const { placeholder: _placeholder, ...restProps } = props;
              const newDom = formItemRender(curText, restProps, dom);
              if (React.isValidElement(newDom)) {
                return React.cloneElement(newDom, {
                  ...fieldProps,
                  ...((newDom.props as any) || {}),
                });
              }
              return newDom;
            }
          : undefined,
        placeholder: formItemRender
          ? undefined
          : (rest?.placeholder ?? fieldProps?.placeholder),
        fieldProps: pickProProps(
          omitUndefined({
            ...fieldProps,
            placeholder: formItemRender
              ? undefined
              : (rest?.placeholder ?? fieldProps?.placeholder),
          }),
          customValueType,
        ),
      }) as ProFieldRenderProps,
      context.valueTypeMap || {},
    );

    return <React.Fragment>{renderedDom}</React.Fragment>;
  };

  return React.forwardRef(ProFieldComponent);
}

```

### Core Architecture Module: `src/field/components/Code/utils.ts`
```
export function languageFormat(text: string, language: string) {
  if (typeof text !== 'string') {
    return text;
  }
  try {
    if (language === 'json') {
      return JSON.stringify(JSON.parse(text), null, 2);
    }
  } catch {
    // ignore parse errors; show raw text
  }
  return text;
}

```

### Core Architecture Module: `src/field/components/DatePicker/datePickerUtils.ts`
```
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';

import { parseValueToDay } from '../../../utils';
import '../../initDayjs';

dayjs.extend(quarterOfYear);

export type DatePickerReadPicker =
  | 'time'
  | 'date'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';

function pickFormatTemplate(format: unknown): string {
  if (Array.isArray(format)) {
    const head = format[0];
    return typeof head === 'string' && head ? head : 'YYYY-MM-DD';
  }
  if (typeof format === 'string' && format) {
    return format;
  }
  return 'YYYY-MM-DD';
}

export function formatDate(
  text: any,
  format: any,
  _picker?: DatePickerReadPicker,
) {
  if (text === null || text === undefined || text === '') {
    return '-';
  }

  const parsed = parseValueToDay(text) as
    | dayjs.Dayjs
    | null
    | undefined
    | dayjs.Dayjs[];
  if (Array.isArray(parsed) || !parsed || !parsed.isValid()) {
    return '-';
  }
  if (typeof parsed.format !== 'function') {
    return String(text);
  }

  if (typeof format === 'function') {
    return format(parsed);
  }

  const tpl = pickFormatTemplate(format);
  return parsed.format(tpl);
}

```

### Core Architecture Module: `src/field/components/Percent/util.ts`
```
/** 获取展示符号 */
export function getSymbolByRealValue(realValue: number) {
  if (realValue === 0) {
    return null;
  }
  if (realValue > 0) {
    return '+';
  }
  return '-';
}

/** 获取颜色 */
export function getColorByRealValue(realValue: number /** ,color: string */) {
  if (realValue === 0) {
    return '#595959';
  }
  return realValue > 0 ? '#ff4d4f' : '#52c41a';
}

/** 获取到最后展示的数字 */
export function getRealTextWithPrecision(
  realValue: number,
  precision: number = 2,
) {
  return precision >= 0 ? realValue?.toFixed(precision) : realValue;
}

/**
 * 转化为数字
 * @copy from https://github.com/toss/es-toolkit/blob/32a183828c244d675f46810935e45dfefec81a54/src/compat/util/toNumber.ts#L19
 */
export function toNumber(value: any): number {
  if (typeof value === 'symbol' || value instanceof Symbol) {
    return NaN;
  }

  return Number(value);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9742** (2026-10-05): **fix(card): expand antd Card path after #9740**
  *Symptoms*: ## 背景  在 #9740 之后，基础 ProCard 已复用 antd `Card` 皮肤，但仍有这些情况会整卡退回 `ant-pro-card-legacy`：  - `collapsible` / `tabs` / `headerBordered` 等被当成「换皮条件」 - 嵌套子 ProCard、`split` 等布局能力也会触发 legacy - ProTable 搜索区仍用假 `div` + 手写 `pro-card-*` class，吃不到真实 ProCard / antd Card 管线  本 PR 在 **不修改对外 API** 的前提下，把「布局 / 行为」和「皮肤」拆开，扩大 antd 路径覆盖范围。  ## 改动说明  ### ProCard  1. **分流逻辑**    - **走 antd Card（默认）**：基础卡片、`headerBordered`、`collapsible` / `collapsed`、`tabs`（仍保留 Pro `tabs` API + antd `Tabs`，不迁 `Card.tabList`）、嵌套子卡 / `split` / `gutter` / `colSpan` / `wrap` / `direction`、`loading={boolean}`、`actions` 为数组。    - **仍走 legacy（`ant-pro-card-legacy`）**：`ghost`、`checked` / `onChecked`、`boxShadow`、自定义 `loading` ReactNode、`layout="center"`、非数组的 `actions`。  2. **布局与皮肤分离**    - 嵌套、`split` 只影响 body 排布（`isLayoutShell`），不再因 `containProCard` 让外层整卡进 legacy。    - 布局相关样式（`contain-card`、`split`、`direction`、`wrap`）在 antd 与 legacy 路径共用。  3. **类名**    - **默认（antd Card）**：根节点 `ant-pro-card` + `ant-card`，**不再**使用 `ant-pro-card-antd-card`。    - **自绘兼容皮**：额外 `ant-pro-card-legacy`（无 `ant-card`）。        `legacy` 表示**渲染实现分支**，不是 props/API 废弃；ghost、checked 等仍属正式能力。    - **已移除**：`ant-pro-card-antd-card` → 请改为 `.ant-pro-card.ant-card` 或 `.ant-pro-card:not(.ant-pro-card-legacy)`  4. **折叠**    - `collapsed`：收起状态（可单独生效）；`collapsible`：交互 + 高度动效（`motionDurationMid` / `motionEaseInOut`）。    - 折叠时隐藏 cover / actions；布局壳折叠时用 `display` 隐藏并保留子树状态；收起时加 `inert`。    - ProCard 对外仍支持 `size="default"`，传给 antd Card 时映射为 `med
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/ant-design/pro-components/pull/9742?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <details> <summary>🧰 Additional context used</summary>  <details> <summary>📚 Code guidelines (2)</summary>  ``` .cursor/rules/react.mdc — auto-discovered .cursor/rules/AGENTS.md — auto-discovered ```  </details>  </details> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  -

- **Issue #9741** (2026-10-05): **fix(card): expand antd Card path after #9740**
  *Symptoms*: ## 背景  在 #9740 之后，基础 ProCard 已复用 antd `Card` 皮肤，但仍有这些情况会整卡退回 `ant-pro-card-legacy`：  - `collapsible` / `tabs` / `headerBordered` 等被当成「换皮条件」 - 嵌套子 ProCard、`split` 等布局能力也会触发 legacy - ProTable 搜索区仍用假 `div` + 手写 `pro-card-*` class，吃不到真实 ProCard / antd Card 管线  本 PR 在 **不修改对外 API** 的前提下，把「布局 / 行为」和「皮肤」拆开，扩大 antd 路径覆盖范围。  ## 改动说明  ### ProCard  1. **分流逻辑**    - **走 antd Card（默认）**：基础卡片、`headerBordered`、`collapsible` / `collapsed`、`tabs`（仍保留 Pro `tabs` API + antd `Tabs`，不迁 `Card.tabList`）、嵌套子卡 / `split` / `gutter` / `colSpan` / `wrap` / `direction`、`loading={boolean}`、`actions` 为数组。    - **仍走 legacy（`ant-pro-card-legacy`）**：`ghost`、`checked` / `onChecked`、`boxShadow`、自定义 `loading` ReactNode、`layout="center"`、非数组的 `actions`。  2. **布局与皮肤分离**    - 嵌套、`split` 只影响 body 排布（`isLayoutShell`），不再因 `containProCard` 让外层整卡进 legacy。    - 布局相关样式（`contain-card`、`split`、`direction`、`wrap`）在 antd 与 legacy 路径共用。  3. **类名（请 Review 重点看）**    - **默认（antd Card）**：根节点 `ant-pro-card` + `ant-card`，**不再**使用 `ant-pro-card-antd-card`。    - **自绘兼容皮**：额外 `ant-pro-card-legacy`（无 `ant-card`）。        `legacy` 表示**渲染实现分支**，不是 props/API 废弃；ghost、checked 等仍属正式能力。    - **业务样式推荐**：      - 普通 ProCard 皮肤：`.ant-pro-card.ant-card`      - 仅覆盖自绘实现：`.ant-pro-card-legacy`      - 嵌套 / split / 折叠：`.ant-pro-card-contain-card`、`.ant-pro-card-split`、`.ant-pro-card-collapse` 等（与是否 legacy 无关）    - **已移除**：`ant-pro-card-antd-card` → 请改为 `.ant-pro-card.ant-card` 或 `.ant-pro-card:not(.ant-pro-card-legacy)`  
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/ant-design/pro-components/pull/9741?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: review in progress by coderabbit.ai -->  > [!NOTE] > Currently processing new changes in this PR. This may take a few minutes, please wait... >  > <details> > <summary>⚙️ Run configuration</summary> >  > - **Configuration used**: Organization UI > - **Review profile**: CHILL > - **Plan**: Advanced > - **Run ID**: `d054e44d-e18a-4bdd-9be2-e32ee0592873` >  > </details> >  > <details> > <summary>📥 Commits</summary> >  > Reviewing files that

- **Issue #9740** (2026-10-05): **fix(card): align basic ProCard skin with antd Card**
  *Symptoms*: ## Summary  - render the basic ProCard path with antd Card so border, radius, variant, cssVar, and hover shadow use the same Card style pipeline - retain the existing ProCard implementation for nested layout, split, ghost, collapse, checked, tabs, custom loading, and other Pro-specific behavior - preserve ProCard root and semantic class names, scope legacy styles to the compatibility path, and keep extra clicks from bubbling to the card handler - add cssVar, basic/legacy/nested path regression coverage and an antd Card comparison demo  ## Validation  - `pnpm test -- --reporter=dot` (188 files, 1563 tests) - `pnpm exec tsc --noEmit --pretty false` - `pnpm exec oxlint --type-aware --type-check src/card/components/Card/index.tsx src/card/components/Card/style.ts tests/card/index.test.tsx demos/card/hoverable.tsx` - `pnpm build`  Closes #9738   <!-- This is an auto-generated comment: release notes by coderabbit.ai --> ## Summary by CodeRabbit  - **体验优化**   - 基础 ProCard 的外观与 antd Card 保持一致，包括变体、边框、圆角及悬停阴影。   - 基础卡片支持标题、附加内容、悬停和点击等交互；折叠、嵌套布局等功能保留原有表现。   - 卡片演示改为并排展示 antd Card 与 ProCard，便于直观比较。 - **文档**   - 补充基础卡片样式及特殊功能表现的说明。 <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/ant-design/pro-components/pull/9740?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <details> <summary>🧰 Additional context used</summary>  <details> <summary>📚 Code guidelines (2)</summary>  ``` .cursor/rules/react.mdc — auto-discovered .cursor/rules/AGENTS.md — auto-discovered ```  </details>  </details> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  基础 ProCard 在符合条件时使用 antd Card 渲染；其他配置继续使用兼容实现。ProCard 专用样式改为仅匹配 legacy 卡片。测试、演示和中英文文档也作了更新。  ### Changes  **P

- **Issue #9739** (2026-10-04): **perf: remove swr and route-utils runtime costs**
  *Symptoms*: ## Summary  - remove `swr` and `@umijs/route-utils` from direct runtime dependencies - add an internal request cache and local route menu matching with regression coverage - split runtime locale messages and preserve explicit Money locale symbols - add package subpath exports for core, editable, and drag-sort table entry points - reduce SchemaForm serialization work and stabilize Form/Table context values - add a 10,000-row virtual table demo and publish measured bundle/startup results  ## Performance  Consumer bundles (React, ReactDOM, antd, and dayjs external):  | Entry | raw | gzip | gzip change | | --- | ---: | ---: | ---: | | ProTable | 418,070 B | 137,046 B | -12.3% | | ProForm | 118,892 B | 42,102 B | -28.3% | | ProLayout | 166,862 B | 54,516 B | -29.7% |  UMD: 709,976 B raw / 219,637 B gzip (-3.4% / -4.3%).  ## Verification  - full suite: 188 test files, 1559 tests passed - affected follow-up suite: 17 test files, 251 tests passed - `pnpm install --frozen-lockfile --offline` - `pnpm run build` - `pnpm run analyze:bundle` - `pnpm run check:build-outputs` - `pnpm run check:declarations` - `pnpm run check:published-types` - `pnpm run lint` (passes with existing warnings)   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **新功能**   * 新增包含 10,000 条记录的虚拟滚动表格示例。   * 支持通过独立子路径导入表格、表单、布局等组件及相关类型。   * 增加运行时语言与货币格式支持，并可处理法语等未内置的地区格式。 * **改进**   * 菜单路由匹配支持动态路径、相对路径和菜单扁平化。   * 请求数据可缓存并复用进行中的请求，减少重复加载。 * **测试**   * 补充菜单路由及法语金额
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/ant-design/pro-components/pull/9739?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: review in progress by coderabbit.ai -->  > [!NOTE] > Currently processing new changes in this PR. This may take a few minutes, please wait... >  > <details> > <summary>⚙️ Run configuration</summary> >  > - **Configuration used**: Organization UI > - **Review profile**: CHILL > - **Plan**: Advanced > - **Run ID**: `1ea888d2-ba1a-4777-8b39-169ce4f05d1b` >  > </details> >  > <details> > <summary>📥 Commits</summary> >  > Reviewing files that
  > ## [Codecov](https://app.codecov.io/gh/ant-design/pro-components/pull/9739?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design) Report :x: Patch coverage is `92.27799%` with `20 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 88.68%. Comparing base ([`85039b8`](https://app.codecov.io/gh/ant-design/pro-components/commit/85039b895767f82a49ebfe854185810a72e78eb9?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design)) to head ([`47b1d2b`](https://app.codecov.io/gh/ant-design/pro-components/commit/47b1d2bef8672c33ebd800bbf87134bd3be1c036?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design)). :warning: Report is 1 commits behind head on master.  | [Files with missing lines](https://app.codecov.io/gh/ant-design/pro-c

- **Issue #9738** (2026-10-05): **ProCard 阴影与 antd Card 对齐**
  *Symptoms*: ## 问题 ProCard 自绘皮肤，和 antd Card 在边框/阴影等表现上容易不一致。  ## 为何难以对齐 1. **两套平行实现**：ProCard 自己画 DOM/CSS，不复用 antd `Card` 样式管线，antd 一改 Pro 就要跟。 2. **关键 token 未公开**：Card hover 阴影来自内部 alias `boxShadowCard`，不在公开类型/文档里；Pro 没法稳定、正规地消费。 3. **组件 token 也帮不上**：`token.components?.Card` 只有用户覆盖，拿不到 Card 默认值，且当前也没有对应 hover 阴影字段。 4. **cssVar 不同路**：antd Card 经 `genStyleHooks` 可输出 `var(--ant-box-shadow-*)`；Pro 自建样式拿的是烘焙 token，开/关 cssVar 时更容易分叉。 5. **产品语义还有分叉**：如 `headerBordered` 默认无底边、ghost/checked/嵌套栅格等，本来就不是 1:1 Card，纯靠抄样式追不平。 继续自绘去追 antd 视觉细节，只能短期缓解，不是长期办法。  ## 建议 将 ProCard 逐步改为 **行为层**： - 皮肤 / variant / hover / borderless 等 → 交给 antd `Card` - Pro 保留组合能力：折叠、栅格嵌套、split/Group、ghost、checked、tabs 等  ## 想法（供讨论） 1. **先切基础路径**：无嵌套、无 split、无折叠的 ProCard，内部改为渲染 antd `Card`，先吃到官方皮肤与 token。 2. **布局仍外置**：`colSpan` / `gutter` / `Group` / `split` 继续由 Pro 外层编排，不塞进 Card 内部实现。 3. **行为逐步搬家**：`collapsible` / `ghost` / `checked` / `headerBordered` 等，优先通过 Card 的 `styles` / `classNames` / 插槽表达，少写一套平行 CSS。 4. **兼容单独评估**：`ant-pro-card-*` 类名、现有业务覆盖、ProTable 默认包卡，是否要兼容层或放在 major 变更。 5. **验收标准**：同 props 下，基础视觉（边框/阴影/hover/size）与 antd Card 一致；Pro 特有能力行为不回退。  

- **Issue #9737** (2026-10-04): **build: replace Father with Rslib**
  *Symptoms*: ## Summary  - replace Father with Rslib 1.0.3 and Rspack-backed ESM, CommonJS, and UMD builds - preserve the existing `es`, `lib`, `dist/pro-components.min.js`, package entry, browser target, and external dependency contracts - generate both declaration trees with the existing TypeScript 7 Go installation - add a publish gate that verifies all 465 source modules, declarations, package entries, CommonJS exports, and UMD CommonJS/browser-global loading - preserve the Day.js initialization module during consumer tree shaking  ## Measured results  - full build wall time: about 3.9 seconds - recent Father JavaScript stages on the same workspace: about 50 seconds combined (indicative because log timing formats differ) - UMD raw: 761,644 B -> 735,309 B (-3.5%) - UMD gzip: 234,281 B -> 229,605 B (-2.0%)  ## Verification  - `pnpm test` (187 files, 1556 tests) - `pnpm run lint` (passes; existing warnings remain) - `pnpm run build` - `pnpm run check:build-outputs` - `pnpm run check:declarations` - `pnpm run check:published-types` - `pnpm run check:safety` - `pnpm install --frozen-lockfile --offline` - esbuild browser bundle smoke test for the generated ESM entry - npm package dry run confirms main/module/types/unpkg entries   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **构建与兼容性**   * 更新发布构建，提供 ESM、CommonJS 和 UMD 格式的产物，并保持现有包入口不变。   * 新增发布产物检查，验证各格式文件及公开组件是否可正常使用。 * **文档**   * 新增构建迁移说明，介绍产物格式、浏览器兼容范围及相关检查方式。  <!-- end of auto-g
  **Post-Mortem & Fix Analysis**:
  > **Review the following changes in direct dependencies.** Learn more about [Socket for GitHub](https://socket.dev?utm_medium=gh).  <table> <thead> <tr> <th>Diff</th> <th width="200px">Package</th> <th align="center" width="100px">Supply Chain<br/>Security</th> <th align="center" width="100px">Vulnerability</th> <th align="center" width="100px">Quality</th> <th align="center" width="100px">Maintenance</th> <th align="center" width="100px">License</th> </tr> </thead> <tbody> <tr><td align="center"><a href="https://socket.dev/dashboard/org/ant-design/diff-scan/7c3cec08-75d5-4710-bf67-28b7bafea6f0?tab=dependencies&dependency_item_key=101954111262"><img src="https://github-app-statics.socket.dev/diff-added.svg" title="Added" alt="Added" width="20" height="20"></a></td><td><a href="https://socket.dev/dashboard/org/ant-design/diff-scan/7c3cec08-75d5-4710-bf67-28b7bafea6f0?tab=dependencies&dependency_item_key=101954111262">@​rsbuild/​plugin-react@​2.1.1</a></td><td align="center"><a href="https
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/ant-design/pro-components/pull/9737?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  - **Configuration used**: Organization UI - **Review profile**: CHILL - **Plan**: Advanced - **Run ID**: `0682f038-5588-4e9e-9d21-bad7b7396346`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed 
  > ## [Codecov](https://app.codecov.io/gh/ant-design/pro-components/pull/9737?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 88.61%. Comparing base ([`eea7448`](https://app.codecov.io/gh/ant-design/pro-components/commit/eea7448909e79391a9a7e397a20b9f975dc4e21d?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design)) to head ([`9d879a5`](https://app.codecov.io/gh/ant-design/pro-components/commit/9d879a521175bb557e1b19fc52764c54befb8b27?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design)). :warning: Report is 2 commits behind head on master.  <details><summary>Additional details and impacted files</summary>    ```diff @@           Covera

- **Issue #9736** (2026-10-04): **perf: reduce bundle size and selection scans**
  *Symptoms*: ## Summary  - fix Father UMD externals so `antd` and `dayjs` stay peer dependencies instead of being bundled - reuse the lazy row-key index for ProList selection callbacks and keep the lookup callback stable - avoid deep comparison of editable table data sources during render - add reproducible bundle-size and selection benchmarks plus regression tests and an audit report  ## Measured results  - UMD raw: 1,928,513 B -> 761,644 B (-60.5%) - UMD gzip: 606,696 B -> 234,281 B (-61.4%) - selection hot path, 50,000 rows / 100 selected / 1,000 callbacks: 1,447.82 ms -> 1.62 ms (about 895x)  The selection result is the median of seven local Node.js samples after the lazy key index has been built. Absolute timings vary by machine.  ## Verification  - `pnpm test` (187 files, 1556 tests) - `pnpm run lint` (passes; existing warnings remain) - `pnpm run build` - `pnpm run check:declarations` - `pnpm run check:published-types` - `pnpm run check:safety` - UMD smoke load with installed peer dependencies (246 exports; ProTable and ProForm present) - `pnpm run analyze:bundle` - `pnpm run benchmark:selection`   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Bug 修复**   * 修正 UMD 构建中的依赖映射。   * 优化表格选择回调返回的记录，确保 `onChange` 与 `onSelect` 接收一致的记录列表；选中子记录时可正确获取对应数据。  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/ant-design/pro-components/pull/9736?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: review in progress by coderabbit.ai -->  > [!NOTE] > Currently processing new changes in this PR. This may take a few minutes, please wait... >  > <details> > <summary>⚙️ Run configuration</summary> >  > - **Configuration used**: Organization UI > - **Review profile**: CHILL > - **Plan**: Advanced > - **Run ID**: `33a6d021-daac-47fe-aef5-e4a6b11673db` >  > </details> >  > <details> > <summary>📥 Commits</summary> >  > Reviewing files that
  > ## [Codecov](https://app.codecov.io/gh/ant-design/pro-components/pull/9736?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 88.61%. Comparing base ([`fb8ff59`](https://app.codecov.io/gh/ant-design/pro-components/commit/fb8ff59f478ee66d8f49a5cc23c48ef2fba86bfe?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design)) to head ([`1017500`](https://app.codecov.io/gh/ant-design/pro-components/commit/101750038137eb94444d6895691732ec1bc73cdb?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design)).  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##           master    #9736 

- **Issue #9735** (2026-10-03): **perf: share TypeScript program during lint**
  *Symptoms*: ## Summary  - use Oxlint's type-aware and type-check APIs so lint and TypeScript diagnostics share one TypeScript Program - add oxlint-tsgolint 7.0.2003, aligned with the TypeScript 7.0.2 native compiler line - preserve the existing warning contract by keeping newly available type-aware rules disabled until their findings are handled - document the new command behavior, fallback typecheck command, and repeatable performance measurements  ## Performance  Warm lint script runs on Windows with Node.js 22:  - before: 3387 ms average - after: 3036 ms average - improvement: about 10%  Direct separate-process versus shared-Program measurement:  - separate: 3682 ms average - shared: 3020 ms average - improvement: about 18%  ## Verification  - type-error probe rejected by both the shared check and standalone tsc - pnpm run lint - pnpm test (186 files, 1554 tests) - pnpm run build - pnpm run check:published-types - pnpm run check:declarations - pnpm run check:safety - pnpm install --offline --frozen-lockfile 
  **Post-Mortem & Fix Analysis**:
  > **Review the following changes in direct dependencies.** Learn more about [Socket for GitHub](https://socket.dev?utm_medium=gh).  <table> <thead> <tr> <th>Diff</th> <th width="200px">Package</th> <th align="center" width="100px">Supply Chain<br/>Security</th> <th align="center" width="100px">Vulnerability</th> <th align="center" width="100px">Quality</th> <th align="center" width="100px">Maintenance</th> <th align="center" width="100px">License</th> </tr> </thead> <tbody> <tr><td align="center"><a href="https://socket.dev/dashboard/org/ant-design/diff-scan/45c143d9-c890-464f-a349-fe28f1853846?tab=dependencies&dependency_item_key=101952282200"><img src="https://github-app-statics.socket.dev/diff-added.svg" title="Added" alt="Added" width="20" height="20"></a></td><td><a href="https://socket.dev/dashboard/org/ant-design/diff-scan/45c143d9-c890-464f-a349-fe28f1853846?tab=dependencies&dependency_item_key=101952282200">oxlint-tsgolint@​7.0.2003</a></td><td align="center"><a href="https://so
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/ant-design/pro-components/pull/9735?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: review in progress by coderabbit.ai -->  > [!NOTE] > Currently processing new changes in this PR. This may take a few minutes, please wait... >  > <details> > <summary>⚙️ Run configuration</summary> >  > - **Configuration used**: Organization UI > - **Review profile**: CHILL > - **Plan**: Advanced > - **Run ID**: `ecd12570-c907-4ff0-aea9-af8b4f6bb77e` >  > </details> >  > <details> > <summary>📥 Commits</summary> >  > Reviewing files that
  > ## [Codecov](https://app.codecov.io/gh/ant-design/pro-components/pull/9735?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 88.60%. Comparing base ([`a3b7e78`](https://app.codecov.io/gh/ant-design/pro-components/commit/a3b7e7812d9d068b6ee3225d60ba53a8c3a02558?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design)) to head ([`bdecd63`](https://app.codecov.io/gh/ant-design/pro-components/commit/bdecd633006963cc5d92121ec5220098fdeeeff4?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design)). :warning: Report is 1 commits behind head on master.  <details><summary>Additional details and impacted files</summary>    ```diff @@           Covera

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

### Incident Patch 1: `e3d860f7` (2026-10-05)
**Commit Message**: fix(layout): avoid hover on hideMenuWhenCollapsed demos

Remove hideMenuWhenCollapsed from demos that do not demonstrate it,
and disable pointer events on the transparent menu panel when collapsed.

**File**: `demos/layout/always-default-open-all-menu.tsx` (modified, +0/-1)
```diff
@@ -76,7 +76,6 @@ const Demo = () => (
       }}
       menu={{
         defaultOpenAll: true,
-        hideMenuWhenCollapsed: true,
         ignoreFlatMenu: true,
       }}
     >
```

**File**: `demos/layout/default-open-all-menu.tsx` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ const Demo = () => (
       route={{
         routes: complexMenu,
       }}
-      menu={{ defaultOpenAll: true, hideMenuWhenCollapsed: true }}
+      menu={{ defaultOpenAll: true }}
     >
       <PageContainer content="欢迎使用">
         <div>Hello World</div>
```

**File**: `demos/layout/multiple-menu-one-path.tsx` (modified, +0/-3)
```diff
@@ -10,9 +10,6 @@ const Demo = () => (
       location={{
         pathname: '/config/template/new',
       }}
-      menu={{
-        hideMenuWhenCollapsed: true,
-      }}
       route={{
         routes: [
           {
```

**File**: `demos/layout/nested-layout.tsx` (modified, +0/-3)
```diff
@@ -48,9 +48,6 @@ const Demo = () => (
         style={{
           height: '400px',
         }}
-        menu={{
-          hideMenuWhenCollapsed: true,
-        }}
         avatarProps={{
           icon: <UserOutlined />,
         }}
```

**File**: `demos/layout/search-menu.tsx` (modified, +0/-3)
```diff
@@ -40,9 +40,6 @@ const Demo = () => {
         location={{
           pathname: '/home/overview',
         }}
-        menu={{
-          hideMenuWhenCollapsed: true,
-        }}
         menuExtraRender={({ collapsed }) =>
           !collapsed && (
             <Space
```

**File**: `src/layout/components/SiderMenu/SiderMenu.tsx` (modified, +1/-0)
```diff
@@ -499,6 +499,7 @@ const SiderMenu: React.FC<SiderMenuProps & PrivateSiderMenuProps> = (props) => {
               height: '100%',
               width: '100%',
               opacity: hideMenuWhenCollapsedClassName ? 0 : 1,
+              pointerEvents: hideMenuWhenCollapsedClassName ? 'none' : undefined,
             }}
           >
             {menuDomItems}
```

---

### Incident Patch 2: `2ba4598d` (2026-10-05)
**Commit Message**: fix: address antd a11y and mask API warnings

Use mask.closable instead of deprecated maskClosable, and add
aria-label for the sider collapse control.

**File**: `src/layout/components/Help/ProHelpDrawer.tsx` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ export const ProHelpDrawer: React.FC<ProHelpDrawerProps> = ({
           padding: 0,
         },
       }}
-      maskClosable
+      mask={{ closable: true }}
       {...drawerProps}
       size={drawerProps.size ?? 720}
       open={drawerOpen}
```

**File**: `src/layout/components/Help/ProHelpModal.tsx` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ export const ProHelpModal: React.FC<ProHelpModalProps> = ({
       footer={null}
       width={720}
       open={modalOpen}
-      maskClosable
+      mask={{ closable: true }}
       {...modalProps}
     >
       <ProHelpPanel
```

**File**: `src/layout/components/SiderMenu/SiderMenu.tsx` (modified, +1/-0)
```diff
@@ -346,6 +346,7 @@ const SiderMenu: React.FC<SiderMenuProps & PrivateSiderMenuProps> = (props) => {
         isMobile={isMobile}
         collapsed={originCollapsed}
         className={`${baseClassName}-collapsed-button`}
+        aria-label={originCollapsed ? 'expand' : 'collapse'}
         onClick={() => {
           onCollapse?.(!originCollapsed);
         }}
```

**File**: `src/layout/components/SiderMenu/index.tsx` (modified, +1/-1)
```diff
@@ -98,7 +98,7 @@ const SiderMenuWrapper: React.FC<SiderMenuProps & PrivateSiderMenuProps> = (
         onClose={() => {
           onCollapse?.(true);
         }}
-        maskClosable
+        mask={{ closable: true }}
         closable={false}
         getContainer={getContainer || false}
         size={siderWidth}
```

**File**: `tests/layout/__snapshots__/mobile.test.tsx.snap` (modified, +1/-1)
```diff
@@ -1,3 +1,3 @@
 // Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html
 
-exports[`mobile BasicLayout > 📱 layout=mix 1`] = `"<div><div class="ant-design-pro ant-pro-layout screen-xs ant-pro-layout-fix-siderbar ant-pro-layout-mix" data-testid="pro-layout"><div class="ant-pro-layout-bg-list"></div><div class="ant-layout ant-layout-has-sider css-var" style="min-height: 100%; flex-direction: row;"><div class="ant-drawer ant-drawer-left ant-pro-drawer-sider-root css-var ant-drawer-open ant-drawer-inline" tabindex="-1"><div class="ant-drawer-mask"></div><div class="ant-drawer-content-wrapper" style="width: 215px;" data-testid="pro-layout-sider"><div class="ant-drawer-section ant-pro-drawer-sider" role="dialog" aria-modal="true" style="padding: 0px; height: 100vh;"><div class="ant-drawer-body" style="height: 100vh; padding: 0px; display: flex; flex-direction: row; background-color: transparent;"><aside class="ant-layout-sider ant-layout-sider-dark ant-pro-sider ant-pro-sider-fixed ant-pro-sider-light css-var" data-testid="pro-layout-sider" style="max-width: 215px; min-width: 215px; width: 215px; flex-grow: 0; flex-shrink: 0; flex-basis: 215px;"><div class="ant-layout-sider-children"><div class="ant-pro-sider-scroll" style="overflow-y: auto; overflow-x: hidden; flex-grow: 1; flex-shrink: 1; flex-basis: 0%;"><ul class="ant-menu ant-menu-root ant-menu-inline ant-menu-light ant-pro-sider-menu ant-pro-base-menu-inline css-var ant-menu-css-var" style="background-color: transparent; border: none none; width: 100%;" role="menu" tabindex="0" data-menu-list="true"><li class="ant-menu-submenu ant-menu-submenu-inline ant-pro-base-menu-inline-submenu ant-menu-submenu-open ant-menu-submenu-selected" role="none"><div role="menuitem" style="padding-left: 16px;" class="ant-menu-submenu-title" tabindex="-1" data-menu-id="rc-menu-uuid-:useId:-route-/-0" aria-expanded="true" aria-haspopup="true" aria-controls="rc-menu-uuid-:useId:-route-/-0-popup"><span class="ant-menu-title-content"><div class="ant-pro-base-menu-inline-item-title"><span class="ant-pro-base-menu-inline-item-text">welcome</span></div></span><i class="ant-menu-submenu-arrow"></i></div><ul class="ant-menu ant-menu-sub ant-menu-inline" role="menu" id="rc-menu-uuid-:useId:-route-/-0-popup" data-menu-list="true"><li role="none" class="ant-menu-submenu ant-menu-submenu-inline ant-pro-base-menu-inline-submenu"><div role="menuitem" style="padding-left: 32px;" class="ant-menu-submenu-title" tabindex="-1" data-menu-id="rc-menu-uuid-:useId:-/welcome" aria-expanded="false" aria-haspopup="true" aria-controls="rc-menu-uuid-:useId:-/welcome-popup"><span class="ant-menu-title-content"><div class="ant-pro-base-menu-inline-item-title"><span class="ant-pro-base-menu-inline-item-text">one</span></div></span><i class="ant-menu-submenu-arrow"></i></div></li></ul></li></ul><div style="display: none;" aria-hidden="true"></div></div><div class="ant-pro-sider-collapsed-button ant-pro-sider-collapsed-button-is-mobile"><svg width="1em" height="1em" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M6.432 7.967a.448.448 0 01-.318.133h-.228a.46.46 0 01-.318-.133L2.488 4.85a.305.305 0 010-.43l.427-.43a.293.293 0 01.42 0L6 6.687l2.665-2.699a.299.299 0 01.426 0l.42.431a.305.305 0 010 .43L6.432 7.967z"></path></svg></div></div></aside></div></div></div></div><div style="position: relative;" class="ant-pro-layout-container"><header class="ant-layout-header css-var" style="height: 56px; line-height: 56px; background-color: transparent; z-index: 19;"></header><header class="ant-layout-header ant-pro-layout-header ant-pro-layout-header-fixed-header ant-pro-layout-header-mix ant-pro-layout-header-fixed-header-action ant-pro-layout-header-header css-var" data-testid="pro-layout-header"><div class="ant-pro-global-header" data-testid="pro-layout-global-header"><span class="ant-pro-global-header-collapsed-button"><span role="img" aria-label="menu" class="anticon anticon-menu"><svg viewBox="64 64 896 896" focusable="false" data-icon="menu" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M904 160H120c-4.4 0-8 3.6-8 8v64c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-64c0-4.4-3.6-8-8-8zm0 624H120c-4.4 0-8 3.6-8 8v64c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-64c0-4.4-3.6-8-8-8zm0-312H120c-4.4 0-8 3.6-8 8v64c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-64c0-4.4-3.6-8-8-8z"></path></svg></span></span><span class="ant-pro-global-header-logo ant-pro-global-header-logo-mix ant-pro-global-header-logo-mobile"><a><svg width="1em" height="1em" viewBox="0 0 200 200"><defs><linearGradient x1="62.1023273%" y1="0%" x2="108.19718%" y2="37.8635764%" id="linearGradient-1"><stop stop-color="#4285EB" offset="0%"></stop><stop stop-color="#2EC7FF" offset="100%"></stop></linearGradient><linearGradient x1="69.644116%" y1="0%" x2="54.0428975%" y2="108.456714%" id="linearGradient-2"><stop stop-color="#29CDFF" offset="0%"></stop><stop stop-color="#148EFF" offset="37.8600687%"></stop><stop stop-color="#0A60FF" 
```

---

### Incident Patch 3: `2a5a156b` (2026-10-05)
**Commit Message**: fix(card): inherit ConfigProvider Card variant

Pass omitted variant through to antd Card so ConfigProvider card.variant
and global variant apply. Legacy border class resolves with the same
priority as antd useVariant.

**File**: `site/changelog.en-US.md` (modified, +7/-0)
```diff
@@ -1,5 +1,12 @@
 # Changelog
 
+## Unreleased
+
+### 🐛 Bug Fixes
+
+- ProCard
+  - 🐞 Pass through omitted `variant` to antd Card so it follows ConfigProvider `card.variant` / global `variant` (no hard-coded `outlined`)
+
 ## [3.1.15-5] - 2026-10-05
 
 ### 🐛 Bug Fixes
```

**File**: `site/changelog.md` (modified, +7/-0)
```diff
@@ -1,5 +1,12 @@
 # Changelog
 
+## 未发布
+
+### 🐛 问题修复
+
+- ProCard
+  - 🐞 未传 `variant` 时透传给 antd Card，跟随 `ConfigProvider` 的 `card.variant` / 全局 `variant`（不再写死 `outlined`）
+
 ## [3.1.15-5] - 2026-10-05
 
 ### 🐛 问题修复
```

**File**: `site/components/card.en-US.md` (modified, +3/-5)
```diff
@@ -18,7 +18,7 @@ In-page container cards that provide standard card styles, card segmentation and
 - When in-card split layout is required.
 - When the card is required to be foldable.
 
-A basic ProCard uses the antd Card skin and tokens directly, so its `variant`, border, radius, and `hoverable` shadow stay aligned with antd Card. ProCard keeps its existing composition behavior when nested layout, `split`, `ghost`, collapse, checked, or tabs features are enabled.
+A basic ProCard reuses the antd Card skin and tokens. When `variant` is omitted it is passed through to antd Card and follows `ConfigProvider` `card.variant` / global `variant` (same as antd Card)—ProCard does **not** hard-code a default. `card.className` / `style` / `classNames` / `styles` are also merged by the underlying Card. Only legacy skins (`ghost`, `checked`, `boxShadow`, etc.) resolve ConfigProvider themselves for the border class.
 
 ## Code demo
 
@@ -144,7 +144,7 @@ The header is automatically hidden when there is no content.
 
 ### With border
 
-Configure the `variant` property to control card border style. Use `outlined` for bordered and `borderless` for borderless.
+Configure the `variant` property to control card border style. Use `outlined` for bordered and `borderless` for borderless. When omitted, it follows `ConfigProvider` (same as antd Card).
 
 <code src="../../demos/card/bordered.tsx" background="var(--main-bg-color)" title="With border"></code>
 
@@ -200,7 +200,7 @@ ProCard is compatible with antd Card API. The following props are consistent wit
 | split                 | Direction to split the card                                                                                                                                                   | `vertical` \| `horizontal`                                   | -            |         |
 | actions               | Card action group, located at the bottom of the card                                                                                                                          | `React.ReactNode[]` \| `React.ReactNode`                      | -            |         |
 | ghost                 | Ghost mode, that is, whether to cancel the padding of the card content area and the background color of the card.                                                             | `boolean`                                                    | false        |         |
-| variant               | Card variant, same as antd Card variant                                                                                                                                      | `'outlined' \| 'borderless'`                                 | -            |         |
+| variant               | Card variant, same as antd Card; when omitted follows ConfigProvider (`card.variant` → global `variant` → antd default) | `'outlined' \| 'borderless'`                                 | -            |         |
 | boxShadow             | Whether to show the card shadow                                                                                                                                              | `boolean`                                                    | -            |         |
 | styles                | Semantic styles, same structure as antd Card                                                                                                                                 | `{ root?, header?, body?, extra?, title?, actions?, cover? }`| -            |         |
 | headerBordered        | Whether the header has a dividing line                                                                                                                                        | `boolean`                                                    | false        |         |
@@ -211,8 +211,6 @@ ProCard is compatible with antd Card API. The following props are consistent wit
 | defaultCollapsed      | Default collapsing, invalid when controlled                                                                                                                                   | `boolean`                                                    | false        |         |
 | onCollapse            | Collapsed card event, invalid when controlled                                                                                                                                 | `(collapsed: boolean) => void`                               | -            |         |
 | tabs                  | Tab configuration                                                                                                                                                             | See below ProCardTabs                                       | -            |         |
-| variant               | Card variants, same as antd Card                                                                                                                                       
```

**File**: `site/components/card.md` (modified, +3/-6)
```diff
@@ -18,7 +18,7 @@ atomId: ProCard
 - 需要进行卡片内切分布局时。
 - 需要卡片可折叠时。
 
-基础 ProCard 直接复用 antd Card 的皮肤和 token，因此 `variant`、边框、圆角与 `hoverable` 阴影会随 antd Card 保持一致。启用嵌套布局、`split`、`ghost`、折叠、选中或页签等 ProCard 特有能力时，组件会保留原有组合行为。
+基础 ProCard 直接复用 antd Card 的皮肤和 token。未传 `variant` 时透传给 antd Card，跟随 `ConfigProvider` 的 `card.variant` / 全局 `variant`（与 antd Card 一致），**不会**在 ProCard 内写死默认值。`card.className` / `style` / `classNames` / `styles` 同样由底层 Card 合并。仅 `ghost`、`checked`、`boxShadow` 等走 legacy 皮时，边框才由 ProCard 自行解析 ConfigProvider。
 
 ## 代码演示
 
@@ -132,7 +132,7 @@ atomId: ProCard
 
 ### 带边框
 
-配置 `variant` 属性控制卡片边框样式，`outlined` 为带边框，`borderless` 为无边框。
+配置 `variant` 属性控制卡片边框样式，`outlined` 为带边框，`borderless` 为无边框。未传时跟随 `ConfigProvider`（与 antd Card 一致）。
 
 <code src="../../demos/card/bordered.tsx" background="var(--main-bg-color)" title="带边框"></code>
 
@@ -186,7 +186,7 @@ ProCard 兼容 antd Card API，以下 props 与 antd Card 保持一致。
 | split                 | 拆分卡片的方式                                                                                                                 | `vertical` \| `horizontal`                                          | -            |        |
 | actions               | 操作按钮                                                                                                                       | `React.ReactNode[] \| React.ReactNode`                              | -            |        |
 | ghost                 | 幽灵模式，即是否取消卡片内容区域的 padding 和 卡片的背景颜色。                                                                 | `boolean`                                                           | false        |        |
-| variant               | 卡片变体，与 antd Card variant 一致                                                                                            | `'outlined' \| 'borderless'`                                        | -            |        |
+| variant               | 卡片变体，与 antd Card 一致；未传时跟随 ConfigProvider（`card.variant` → 全局 `variant` → antd 默认） | `'outlined' \| 'borderless'`                                        | -            |        |
 | boxShadow             | 是否显示卡片阴影                                                                                                               | `boolean`                                                           | -            |        |
 | styles                | 语义化 styles，结构同 antd Card                                                                                                | `{ root?, header?, body?, extra?, title?, actions?, cover? }`       | -            |        |
 | headerBordered        | 页头是否有分割线                                                                                                               | `boolean`                                                           | false        |        |
@@ -200,10 +200,7 @@ ProCard 兼容 antd Card API，以下 props 与 antd Card 保持一致。
 | ref                   | ProCard 的 ref                                                                                                                 | `React.Ref<HTMLDivElement \| undefined>`                            | -            |        |
 | checked               | 是否展示选中样式                                                                                                               | `boolean`                                                           | false        |        |
 | onChecked             | 选中改变                                                                                                                       | `(e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void`         | -            |        |
-| boxShadow             | card的阴影                                                                                                                     | `boolean`                                                           | false        |        |
 | tabs                  | 标签栏配置                                                                                                                     | 见下面 ProCardTabs                                                  | -            |        |
-| variant               | 卡片变体类型，与 antd Card 一致                                                                                                | `'outlined' \| 'borderless'`                                        | `'outlined'` | 5.24.0 |
-| styles                | 自定义样式，结构与 antd Card 一致                                                                                             | `{ root?, header?, body?, extra?, title?, actions?, cover?: CSSProperties }` | -            |        |
 
 ### ProCardTabs
 
```

**File**: `src/card/components/Card/index.tsx` (modified, +37/-5)
```diff
@@ -12,6 +12,28 @@ import useStyle from './style';
 
 const { useBreakpoint } = Grid;
 
+/**
+ * 对齐 antd Card → useVariant('card', variant) 的合并顺序：
+ * props > card.variant > 全局 variant > outlined
+ * （不含 Form VariantContext；antd 路径会再交给 AntdCard 处理完整语义）
+ */
+const resolveCardVariant = (
+  customVariant: CardProps['variant'],
+  cardVariant: CardProps['variant'] | undefined,
+  globalVariant: string | undefined,
+) => {
+  if (customVariant !== undefined) {
+    return customVariant;
+  }
+  if (cardVariant !== undefined) {
+    return cardVariant;
+  }
+  if (globalVariant === 'borderless' || globalVariant === 'outlined') {
+    return globalVariant;
+  }
+  return 'outlined';
+};
+
 // 子卡片元素类型：props 形如 CardProps，组件类型用 React.JSXElementConstructor 收紧，
 // 比 any 安全，但仍允许 React.cloneElement / element.type?.isProCard 这类访问。
 type ProCardChildType = React.ReactElement<
@@ -58,8 +80,6 @@ const Card = React.forwardRef((props: CardProps, ref: any) => {
     ...rest
   } = props;
 
-  const variant = customVariant ?? 'outlined';
-
   const mergedStyles = {
     header: styles?.header,
     body: styles?.body,
@@ -69,7 +89,17 @@ const Card = React.forwardRef((props: CardProps, ref: any) => {
     actions: styles?.actions,
     cover: styles?.cover,
   };
-  const { getPrefixCls } = useContext(ConfigProvider.ConfigContext);
+  const {
+    getPrefixCls,
+    card: cardConfig,
+    variant: configVariant,
+  } = useContext(ConfigProvider.ConfigContext);
+  // legacy 边框对齐 antd useVariant；antd 路径仍透传 customVariant 给 AntdCard
+  const mergedVariant = resolveCardVariant(
+    customVariant,
+    cardConfig?.variant,
+    configVariant,
+  );
   // 用于 loading 占位 padding 兜底（body padding 被显式置 0 时使用 token.paddingLG）
   const { token } = proTheme.useToken();
 
@@ -241,6 +271,8 @@ const Card = React.forwardRef((props: CardProps, ref: any) => {
   const antdCardSize =
     size === 'small' ? 'small' : size === 'default' ? 'medium' : undefined;
 
+  // antd 路径：variant 透传，ConfigProvider 交给 AntdCard / useVariant。
+  // legacy：边框 class 用与 antd 相同的 mergedVariant（!== borderless 即有边）。
   const cardCls = clsx(
     `${prefixCls}`,
     className,
@@ -250,7 +282,7 @@ const Card = React.forwardRef((props: CardProps, ref: any) => {
     {
       // 主路径依赖 ant-card；仅 legacy 打标供样式选择
       [`${prefixCls}-legacy`]: !useAntdCard,
-      [`${prefixCls}-border`]: variant === 'outlined',
+      [`${prefixCls}-border`]: !useAntdCard && mergedVariant !== 'borderless',
       [`${prefixCls}-box-shadow`]: boxShadow,
       [`${prefixCls}-contain-card`]: containProCard,
       [`${prefixCls}-loading`]: loading,
@@ -454,7 +486,7 @@ const Card = React.forwardRef((props: CardProps, ref: any) => {
         hoverable={hoverable}
         size={antdCardSize}
         type={type === 'default' ? undefined : type}
-        variant={variant}
+        variant={customVariant}
         onClick={(event) => {
           if (
             event.target instanceof Element &&
```

**File**: `src/card/typing.ts` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ type CardPropsBase = Pick<AntdCardProps, 'rootClassName' | 'cover'> & {
   actions?: React.ReactNode[] | React.ReactNode;
   /** 拆分卡片方式 */
   split?: 'vertical' | 'horizontal';
-  /** 卡片变体，与 antd Card variant 一致 */
+  /** 卡片变体，与 antd Card 一致；未传时由底层 Card / ConfigProvider 决定 */
   variant?: 'outlined' | 'borderless';
   /**
    * 鼠标移过时可浮起
```

**File**: `tests/card/index.test.tsx` (modified, +44/-0)
```diff
@@ -63,6 +63,50 @@ describe('Card', () => {
     expect(onClick).toHaveBeenCalledOnce();
   });
 
+  it('inherits ConfigProvider card / global variant', () => {
+    const { rerender, container, unmount } = render(
+      <ConfigProvider card={{ variant: 'borderless' }}>
+        <ProCard title="卡片">内容</ProCard>
+      </ConfigProvider>,
+    );
+    let card = container.querySelector('.ant-pro-card');
+    expect(card).toHaveClass('ant-card');
+    expect(card).not.toHaveClass('ant-card-bordered');
+    expect(card).not.toHaveClass('ant-pro-card-border');
+
+    rerender(
+      <ConfigProvider variant="borderless">
+        <ProCard title="卡片">内容</ProCard>
+      </ConfigProvider>,
+    );
+    card = container.querySelector('.ant-pro-card');
+    expect(card).not.toHaveClass('ant-card-bordered');
+
+    rerender(
+      <ConfigProvider card={{ variant: 'borderless' }}>
+        <ProCard title="卡片" variant="outlined">
+          内容
+        </ProCard>
+      </ConfigProvider>,
+    );
+    card = container.querySelector('.ant-pro-card');
+    expect(card).toHaveClass('ant-card-bordered');
+    unmount();
+  });
+
+  it('applies ConfigProvider card variant on legacy path', () => {
+    const wrapper = render(
+      <ConfigProvider card={{ variant: 'borderless' }}>
+        <ProCard ghost title="幽灵">
+          内容
+        </ProCard>
+      </ConfigProvider>,
+    );
+    const card = wrapper.container.querySelector('.ant-pro-card');
+    expect(card).toHaveClass('ant-pro-card-legacy');
+    expect(card).not.toHaveClass('ant-pro-card-border');
+  });
+
   it('keeps collapsible on the antd Card path (fold is behavior, not a skin fork)', () => {
     const wrapper = render(
       <ProCard title="可折叠" collapsible>
```

---

### Incident Patch 4: `42697ffb` (2026-10-05)
**Commit Message**: fix(card): expand antd Card path after #9740 (#9742)

**File**: `src/card/ProCard.tsx` (modified, +1/-2)
```diff
@@ -12,8 +12,7 @@ export type ProCardType = CardType & {
   Group: typeof Group;
 };
 
-// 用 forwardRef 透传 ref，避免用户用 <ProCard.Group ref={...}> 时 ref 丢失。
-// 底层 Card 本身就是 forwardRef，这里保持一致。
+// Group：显式布局容器（body padding: 0）；嵌套逻辑仍由 Card 处理。
 const Group = React.forwardRef<HTMLDivElement, CardProps>((props, ref) => {
   const { styles, ...rest } = props;
   return (
```

**File**: `src/card/components/Card/index.tsx` (modified, +138/-47)
```diff
@@ -220,26 +220,26 @@ const Card = React.forwardRef((props: CardProps, ref: any) => {
     return element;
   });
 
-  // 基础卡片直接复用 antd Card 的样式管线，自动跟随 Card token、cssVar、
-  // variant 和 hover 阴影。涉及 ProCard 特有布局或交互时继续走兼容实现。
-  const useAntdCard =
-    !containProCard &&
-    !split &&
-    !collapsible &&
-    !collapsibleIconRender &&
-    controlCollapsed === undefined &&
-    !defaultCollapsed &&
-    !tabs &&
-    !ghost &&
-    checked === undefined &&
-    !onChecked &&
-    !headerBordered &&
-    !boxShadow &&
-    !React.isValidElement(loading) &&
-    (!layout || layout === 'default') &&
-    !wrap &&
-    !direction &&
-    (!actions || Array.isArray(actions));
+  // 嵌套 / split 只影响 body 排布，不退出 AntdCard。
+  // wrap、direction 仅在嵌套时生效，单独出现不算布局壳，避免叶子卡片被清 padding。
+  const isLayoutShell = containProCard || Boolean(split);
+
+  // 无法对齐 antd Card 皮肤时走 legacy（ghost / checked / boxShadow 等）。
+  // collapsible、tabs、嵌套属于行为或布局，不因此切换皮肤。
+  const needsLegacySkin =
+    ghost ||
+    checked !== undefined ||
+    Boolean(onChecked) ||
+    boxShadow ||
+    React.isValidElement(loading) ||
+    (Boolean(layout) && layout !== 'default') ||
+    Boolean(actions && !Array.isArray(actions));
+
+  const useAntdCard = !needsLegacySkin;
+
+  // ProCard 仍对外使用 size="default"；antd 6+ 已弃用，传给 Card 时用 medium
+  const antdCardSize =
+    size === 'small' ? 'small' : size === 'default' ? 'medium' : undefined;
 
   const cardCls = clsx(
     `${prefixCls}`,
@@ -248,7 +248,7 @@ const Card = React.forwardRef((props: CardProps, ref: any) => {
     hashId,
     classNames?.root,
     {
-      [`${prefixCls}-antd-card`]: useAntdCard,
+      // 主路径依赖 ant-card；仅 legacy 打标供样式选择
       [`${prefixCls}-legacy`]: !useAntdCard,
       [`${prefixCls}-border`]: variant === 'outlined',
       [`${prefixCls}-box-shadow`]: boxShadow,
@@ -260,6 +260,7 @@ const Card = React.forwardRef((props: CardProps, ref: any) => {
       [`${prefixCls}-size-${size}`]: size,
       [`${prefixCls}-type-${type}`]: type,
       [`${prefixCls}-collapse`]: collapsed,
+      [`${prefixCls}-collapsible`]: Boolean(collapsible),
       [`${prefixCls}-checked`]: checked,
     },
   );
@@ -331,41 +332,127 @@ const Card = React.forwardRef((props: CardProps, ref: any) => {
   const extraCls = clsx(`${prefixCls}-extra`, hashId, classNames?.extra);
 
   const rootStyle = { ...mergedStyles.root, ...style };
+  const headerCollapsible =
+    collapsible === true || collapsible === 'header';
+
+  // tabs 继续走 Pro API + antd Tabs，不迁到 Card.tabList
+  const tabsNode = tabs ? (
+    <Tabs
+      onChange={tabs.onChange}
+      {...omit(tabs, ['cardProps'])}
+      items={ModifyTabItemsContent}
+      className={clsx(`${prefixCls}-tabs`, hashId, {
+        // #9052：ghost 时去掉 tab 内容区 padding
+        [`${prefixCls}-tabs-ghost`]: tabs.cardProps?.ghost,
+      })}
+    />
+  ) : null;
+
+  // collapsed：收起；collapsible：可交互。布局壳用 display 显隐，保留子树状态。
+  // 内容区不做高度动画，与最初行为一致（CSS 直接藏 body / shell）。
+  const wrapCollapseContent = (content: React.ReactNode) => {
+    if (isLayoutShell) {
+      return (
+        <div
+          className={clsx(`${prefixCls}-collapse-shell`, hashId, {
+            [`${prefixCls}-collapse-shell-collapsed`]: collapsed,
+          })}
+          aria-hidden={collapsed}
+        >
+          {content}
+        </div>
+      );
+    }
+
+    // 无 collapsible 时：collapsed 只收起普通 body；tabs 仍渲染（与历史 DOM 一致）
+    if (!collapsible) {
+      if (collapsed && !tabs) {
+        return null;
+      }
+      return content;
+    }
+
+    return content;
+  };
 
   if (useAntdCard) {
+    const antdTitle =
+      title || collapsibleButton ? (
+        <>
+          {collapsibleButton}
+          {title ? (
+            <LabelIconTip
+              label={title}
+              tooltip={tooltip}
+              subTitle={subTitle}
+            />
+          ) : null}
+        </>
+      ) : undefined;
+
+    const antdBodyContent = tabs
+      ? loading
+        ? loadingDOM
+        : tabsNode
+      : childrenModified;
+
     return wrapSSR(
       <AntdCard
         {...omit(rest, ['prefixCls', 'colSpan'])}
         ref={ref}
         className={cardCls}
         style={rootStyle}
         styles={{
-          header: mergedStyles.header,
-          body: mergedStyles.body,
+          header: {
+            ...mergedStyles.header,
+            // Pro 默认无 header 底边；仅 headerBordered / inner 保留
+            ...(!headerBordered && type !== 'inner'
+              ? { borderBottom: 'none' }
+              : null),
+            ...(headerCollapsible ? { cursor: 'pointer' } : null),
+          },
+          // tabs / 布局壳：body 去 padding；折叠用 CSS 显隐，不再挪 padding
+          body: {
+            ...mergedStyles.body,
+            ...(tabs || isLayoutShell ? { padding: 0 } : null),
+            // antd 路径：仅 collapsed 且无 tabs 时藏空 body（tabs 在 body 内需可见）
+            ...(collapsed && !collapsible && !tabs
+              ? { display: 'none' }
+              : null),
+          },
           extra: me
```

**File**: `src/card/components/Card/style.ts` (modified, +38/-15)
```diff
@@ -127,22 +127,21 @@ export const genProCardStyle: GenerateStyle<ProCardToken> = (token) => {
         },
       },
 
-      [`&&${componentCls}-legacy${componentCls}-split > ${componentCls}-body`]:
-        {
-          paddingBlock: 0,
-          paddingInline: 0,
-        },
+      // 布局样式：AntdCard 与 legacy 共用
+      [`&&${componentCls}-split > ${componentCls}-body`]: {
+        paddingBlock: 0,
+        paddingInline: 0,
+      },
 
-      [`&&${componentCls}-legacy${componentCls}-contain-card > ${componentCls}-body`]:
-        {
-          display: 'flex',
-        },
+      [`&&${componentCls}-contain-card > ${componentCls}-body`]: {
+        display: 'flex',
+      },
 
-      [`&${componentCls}-legacy ${componentCls}-body-direction-column`]: {
+      [`& ${componentCls}-body-direction-column`]: {
         flexDirection: 'column',
       },
 
-      [`&${componentCls}-legacy ${componentCls}-body-wrap`]: {
+      [`& ${componentCls}-body-wrap`]: {
         flexWrap: 'wrap',
       },
 
@@ -152,11 +151,27 @@ export const genProCardStyle: GenerateStyle<ProCardToken> = (token) => {
             paddingBlockEnd: token.padding,
             borderBlockEnd: 0,
           },
+        },
+      },
 
-          '&-body': {
-            display: 'none',
-          },
+      // collapsible 收起：直接藏 body（无高度动画）；布局壳由 shell 显隐
+      [`&&${componentCls}-collapse${componentCls}-collapsible:not(${componentCls}-contain-card):not(${componentCls}-split) > ${componentCls}-body`]:
+        {
+          display: 'none',
         },
+
+      // 仅 collapsed（无 collapsible）：内容已卸载，藏空 body（legacy；antd 走 inline style）
+      [`&&${componentCls}-legacy${componentCls}-collapse:not(${componentCls}-collapsible) > ${componentCls}-body`]:
+        {
+          display: 'none',
+        },
+
+      // 布局壳折叠：display:contents 保留 flex 子节点；收起用 none 隐藏且不卸载
+      [` ${componentCls}-collapse-shell`]: {
+        display: 'contents',
+      },
+      [` ${componentCls}-collapse-shell-collapsed`]: {
+        display: 'none',
       },
 
       [`&${componentCls}-legacy > ${componentCls}-header`]: {
@@ -200,7 +215,8 @@ export const genProCardStyle: GenerateStyle<ProCardToken> = (token) => {
         },
       },
 
-      [`&${componentCls}-legacy ${componentCls}-collapsible-icon`]: {
+      // 折叠图标：AntdCard / legacy 共用
+      [` ${componentCls}-collapsible-icon`]: {
         marginInlineEnd: token.marginXS,
         color: token.colorIconHover,
         ':hover': {
@@ -267,6 +283,13 @@ export const genProCardStyle: GenerateStyle<ProCardToken> = (token) => {
           paddingBlock: token.paddingXS,
         },
       },
+
+      // collapsible + legacy：body padding 清零（须在 size-small body 规则之后，避免被小尺寸 padding 盖掉）
+      [`&&${componentCls}-collapsible${componentCls}-legacy > ${componentCls}-body`]:
+        {
+          paddingBlock: 0,
+          paddingInline: 0,
+        },
     },
 
     [`${componentCls}-tabs`]: {
```

**File**: `src/table/components/Form/FormRender.tsx` (modified, +11/-8)
```diff
@@ -3,6 +3,7 @@ import type { FormItemProps } from 'antd';
 import { ConfigProvider, Table } from 'antd';
 import { clsx } from 'clsx';
 import React, { useContext, useMemo } from 'react';
+import ProCard from '../../../card';
 import type {
   BaseQueryFilterProps,
   ProFormInstance,
@@ -196,19 +197,21 @@ const FormRender = <T, U = any>({
   };
 
   return (
-    <div
-      className={clsx(hashId, {
-        [getPrefixCls('pro-card')]: true,
-        [`${getPrefixCls('pro-card')}-border`]: !!bordered,
-        [`${getPrefixCls('pro-card')}-bordered`]: !!bordered,
-        [`${getPrefixCls('pro-card')}-ghost`]: !!ghost,
-        [className]: true,
+    <ProCard
+      // 搜索区复用 ProCard（基础路径即 antd Card），与表格区皮肤对齐。
+      // QueryFilter 自带 padding，body 置 0 避免与 Card 默认 padding 叠加。
+      variant={bordered ? 'outlined' : 'borderless'}
+      ghost={ghost}
+      className={clsx(hashId, className, {
         [formClassName]: isForm,
         [getPrefixCls(`pro-table-search-${toLowerLine(competentName)}`)]: true,
         [`${className}-ghost`]: ghost,
         [(searchConfig as { className: string })?.className]:
           searchConfig !== false && searchConfig?.className,
       })}
+      styles={{
+        body: { padding: 0 },
+      }}
     >
       <BetaSchemaForm<U>
         key={competentName}
@@ -250,7 +253,7 @@ const FormRender = <T, U = any>({
         }}
         initialValues={formConfig?.initialValues}
       />
-    </div>
+    </ProCard>
   );
 };
 
```

**File**: `tests/card/index.test.tsx` (modified, +143/-9)
```diff
@@ -44,7 +44,7 @@ describe('Card', () => {
 
     expect(card).toHaveClass('ant-card');
     expect(card).toHaveClass('ant-card-hoverable');
-    expect(card).toHaveClass('ant-pro-card-antd-card');
+    expect(card).not.toHaveClass('ant-pro-card-legacy');
     expect(
       card?.querySelector('.ant-card-head.ant-pro-card-header'),
     ).toBeTruthy();
@@ -63,19 +63,19 @@ describe('Card', () => {
     expect(onClick).toHaveBeenCalledOnce();
   });
 
-  it('keeps ProCard specific behavior on the compatibility path (#9738)', () => {
+  it('keeps collapsible on the antd Card path (fold is behavior, not a skin fork)', () => {
     const wrapper = render(
       <ProCard title="可折叠" collapsible>
         内容
       </ProCard>,
     );
     const card = wrapper.container.querySelector('.ant-pro-card');
 
-    expect(card).toHaveClass('ant-pro-card-legacy');
-    expect(card).not.toHaveClass('ant-card');
+    expect(card).toHaveClass('ant-card');
+    expect(card).not.toHaveClass('ant-pro-card-legacy');
   });
 
-  it('keeps layout on the parent and uses antd Card for basic children (#9738)', () => {
+  it('uses antd Card for nested layout shell; children stay on antd Card too', () => {
     const onParentClick = vi.fn();
     const wrapper = render(
       <ProCard onClick={onParentClick}>
@@ -86,16 +86,34 @@ describe('Card', () => {
     );
     const cards = wrapper.container.querySelectorAll('.ant-pro-card');
 
-    expect(cards[0]).toHaveClass('ant-pro-card-legacy');
-    expect(cards[1]).toHaveClass('ant-pro-card-antd-card');
+    // 外层为布局壳，仍走 antd Card；不再因 contain 进入 legacy
+    expect(cards[0]).toHaveClass('ant-pro-card-contain-card');
+    expect(cards[0]).toHaveClass('ant-card');
+    expect(cards[0]).not.toHaveClass('ant-pro-card-legacy');
     expect(cards[1]).toHaveClass('ant-card');
+    expect(cards[1]).not.toHaveClass('ant-pro-card-legacy');
 
     act(() => {
       wrapper.getByRole('button', { name: '子操作' }).click();
     });
     expect(onParentClick).not.toHaveBeenCalled();
   });
 
+  it('keeps ghost on the legacy skin path', () => {
+    const wrapper = render(
+      <ProCard ghost>
+        <ProCard title="子卡片">内容</ProCard>
+      </ProCard>,
+    );
+    const cards = wrapper.container.querySelectorAll('.ant-pro-card');
+
+    expect(cards[0]).toHaveClass('ant-pro-card-legacy');
+    expect(cards[0]).toHaveClass('ant-pro-card-ghost');
+    expect(cards[0]).not.toHaveClass('ant-card');
+    expect(cards[1]).toHaveClass('ant-card');
+    expect(cards[1]).not.toHaveClass('ant-pro-card-legacy');
+  });
+
   it('🥩 collapsible onCollapse', async () => {
     const fn = vi.fn();
 
@@ -147,7 +165,7 @@ describe('Card', () => {
   it('🥩 collapsible collapsed', async () => {
     const wrapper = render(
       <ProCard title="可折叠" headerBordered collapsed>
-        内容
+        <span data-testid="collapsed-body">内容</span>
       </ProCard>,
     );
     await wrapper.findAllByText('可折叠');
@@ -156,11 +174,13 @@ describe('Card', () => {
         '.ant-pro-card-collapse',
       ),
     ).toBeTruthy();
+    // collapsed 无需 collapsible 也可收起内容
+    expect(wrapper.queryByTestId('collapsed-body')).toBeNull();
 
     act(() => {
       wrapper.rerender(
         <ProCard title="可打开" headerBordered collapsed={false}>
-          内容
+          <span data-testid="collapsed-body">内容</span>
         </ProCard>,
       );
     });
@@ -171,6 +191,7 @@ describe('Card', () => {
         '.ant-pro-card-collapse',
       ),
     ).toBeFalsy();
+    expect(wrapper.getByTestId('collapsed-body')).toBeTruthy();
   });
 
   it('🥩 collapsible icon custom render with defaultCollapsed', async () => {
@@ -338,6 +359,9 @@ describe('Card', () => {
         }}
       />,
     );
+    const card = wrapper.container.querySelector('.ant-pro-card');
+    expect(card).toHaveClass('ant-card');
+    expect(card).not.toHaveClass('ant-pro-card-legacy');
     act(() => {
       wrapper.baseElement
         .querySelectorAll<HTMLDivElement>('.ant-pro-card-tabs .ant-tabs-tab')[1]
@@ -366,4 +390,114 @@ describe('Card', () => {
     expect(actionsUl?.style.marginTop).toBe('10px');
     wrapper.unmount();
   });
+
+  it('hides actions when collapsed on antd Card path', () => {
+    const wrapper = render(
+      <ProCard
+        title="可折叠"
+        collapsible
+        defaultCollapsed
+        actions={[<a key="setting">设置</a>]}
+      >
+        内容
+      </ProCard>,
+    );
+    const card = wrapper.container.querySelector('.ant-pro-card');
+    expect(card).toHaveClass('ant-card');
+    expect(card).not.toHaveClass('ant-pro-card-legacy');
+    expect(
+      wrapper.container.querySelector('.ant-pro-card-actions'),
+    ).toBeNull();
+  });
+
+  it('hides actions when collapsed on legacy path', () => {
+    const wrapper = render(
+      <ProCard
+        title="可折叠"
+        ghost
+        collapsible
+        defaultCollapsed
+        actions={[<a key="setting">设置</a>]}
+      >
+        内容
+      </ProCard>,
+    );
+    const card = 
```

**File**: `tests/card/tabsGhost.test.tsx` (modified, +6/-0)
```diff
@@ -17,6 +17,9 @@ describe('#9052 ProCard tabs cardProps ghost', () => {
       />,
     );
 
+    const card = container.querySelector('.ant-pro-card');
+    expect(card).toHaveClass('ant-card');
+    expect(card).not.toHaveClass('ant-pro-card-legacy');
     const tabs = container.querySelector('.ant-pro-card-tabs');
     expect(tabs?.classList.contains('ant-pro-card-tabs-ghost')).toBe(true);
   });
@@ -32,6 +35,9 @@ describe('#9052 ProCard tabs cardProps ghost', () => {
       />,
     );
 
+    const card = container.querySelector('.ant-pro-card');
+    expect(card).toHaveClass('ant-card');
+    expect(card).not.toHaveClass('ant-pro-card-legacy');
     const tabs = container.querySelector('.ant-pro-card-tabs');
     expect(tabs?.classList.contains('ant-pro-card-tabs-ghost')).toBe(false);
   });
```

**File**: `tests/table/index.test.tsx` (modified, +6/-4)
```diff
@@ -1582,11 +1582,13 @@ describe('BasicTable', () => {
 
     expect(
       !!html.baseElement.querySelector(
-        '.ant-pro-table-search-query-filter.ant-pro-card-bordered',
+        '.ant-pro-table-search-query-filter.ant-pro-card.ant-card',
       ),
     ).toBeTruthy();
     expect(
-      !!html.baseElement.querySelector('.ant-pro-card.ant-pro-card-border'),
+      !!html.baseElement.querySelector(
+        '.ant-pro-table-search.ant-pro-card.ant-card-bordered',
+      ),
     ).toBeTruthy();
   });
 
@@ -1612,10 +1614,10 @@ describe('BasicTable', () => {
     );
     expect(
       !!html.baseElement.querySelector('.ant-pro-card.ant-card-bordered'),
-    ).toBeFalsy();
+    ).toBeTruthy();
     expect(
       !!html.baseElement.querySelector(
-        '.ant-pro-table-search-query-filter.ant-pro-card-bordered',
+        '.ant-pro-table-search-query-filter.ant-pro-card.ant-card-bordered',
       ),
     ).toBeTruthy();
   });
```

---

### Incident Patch 5: `8adf1f2a` (2026-10-05)
**Commit Message**: fix(card): align basic ProCard skin with antd Card (#9740)

**File**: `demos/card/hoverable.tsx` (modified, +26/-97)
```diff
@@ -1,102 +1,31 @@
 import { ProCard } from '@ant-design/pro-components';
+import { Card, ConfigProvider, Space } from 'antd';
 
-const Demo = () => {
-  return (
-    <>
-      <ProCard style={{ maxWidth: 300 }} hoverable variant="outlined">
-        Content
-      </ProCard>
+const cardStyle = { width: 300 };
 
-      <div
-        style={{
-          marginTop: '20px',
-          padding: '20px',
-          backgroundColor: '#f5f5f5',
-          borderRadius: '6px',
-        }}
+const Demo = () => (
+  <ConfigProvider theme={{ cssVar: {} }}>
+    <Space align="start" size={16} wrap>
+      <Card
+        title="antd Card"
+        extra={<a>更多</a>}
+        hoverable
+        style={cardStyle}
+        variant="outlined"
       >
-        <h4>ProCard Hoverable Props 说明：</h4>
-        <ul>
-          <li>
-            <strong>hoverable</strong>: 是否启用悬停效果，布尔值
-          </li>
-          <li>
-            <strong>variant</strong>: 卡片变体样式，'outlined' 表示带边框
-          </li>
-          <li>
-            <strong>style</strong>: 卡片样式对象，设置最大宽度
-          </li>
-          <li>
-            <strong>children</strong>: 卡片内容
-          </li>
-        </ul>
-        <h4>Hoverable 特点：</h4>
-        <ul>
-          <li>
-            <strong>悬停效果</strong>: 鼠标悬停时显示阴影和边框效果
-          </li>
-          <li>
-            <strong>交互反馈</strong>: 提供视觉反馈，增强用户体验
-          </li>
-          <li>
-            <strong>可点击提示</strong>: 暗示卡片可以点击或交互
-          </li>
-        </ul>
-        <h4>Variant 变体说明：</h4>
-        <ul>
-          <li>
-            <strong>outlined</strong>: 带边框的卡片样式
-          </li>
-          <li>
-            <strong>borderless</strong>: 无边框卡片样式，带浅阴影
-          </li>
-        </ul>
-        <h4>悬停效果：</h4>
-        <ul>
-          <li>
-            <strong>阴影变化</strong>: 悬停时阴影加深或出现
-          </li>
-          <li>
-            <strong>边框变化</strong>: 边框颜色或样式发生变化
-          </li>
-          <li>
-            <strong>背景变化</strong>: 背景色可能发生轻微变化
-          </li>
-        </ul>
-        <h4>使用场景：</h4>
-        <ul>
-          <li>
-            <strong>可点击卡片</strong>: 需要点击交互的卡片
-          </li>
-          <li>
-            <strong>导航卡片</strong>: 作为导航链接的卡片
-          </li>
-          <li>
-            <strong>选择卡片</strong>: 需要选择的卡片
-          </li>
-          <li>
-            <strong>产品卡片</strong>: 产品展示卡片
-          </li>
-        </ul>
-        <h4>最佳实践：</h4>
-        <ul>
-          <li>
-            <strong>交互一致性</strong>: 确保悬停效果与实际的交互行为一致
-          </li>
-          <li>
-            <strong>视觉层次</strong>: 使用悬停效果突出重要的卡片
-          </li>
-          <li>
-            <strong>用户体验</strong>: 提供清晰的交互反馈
-          </li>
-        </ul>
-      </div>
-    </>
-  );
-};
-
-export default () => (
-  <div style={{ padding: 24 }}>
-    <Demo />
-  </div>
+        使用 antd Card 的 hover 阴影与 token。
+      </Card>
+      <ProCard
+        title="ProCard"
+        extra={<a>更多</a>}
+        hoverable
+        style={cardStyle}
+        variant="outlined"
+      >
+        基础路径复用同一套 Card 样式管线。
+      </ProCard>
+    </Space>
+  </ConfigProvider>
 );
+
+export default Demo;
```

**File**: `site/components/card.en-US.md` (modified, +2/-0)
```diff
@@ -18,6 +18,8 @@ In-page container cards that provide standard card styles, card segmentation and
 - When in-card split layout is required.
 - When the card is required to be foldable.
 
+A basic ProCard uses the antd Card skin and tokens directly, so its `variant`, border, radius, and `hoverable` shadow stay aligned with antd Card. ProCard keeps its existing composition behavior when nested layout, `split`, `ghost`, collapse, checked, or tabs features are enabled.
+
 ## Code demo
 
 ### Enum property switch
```

**File**: `site/components/card.md` (modified, +2/-0)
```diff
@@ -18,6 +18,8 @@ atomId: ProCard
 - 需要进行卡片内切分布局时。
 - 需要卡片可折叠时。
 
+基础 ProCard 直接复用 antd Card 的皮肤和 token，因此 `variant`、边框、圆角与 `hoverable` 阴影会随 antd Card 保持一致。启用嵌套布局、`split`、`ghost`、折叠、选中或页签等 ProCard 特有能力时，组件会保留原有组合行为。
+
 ## 代码演示
 
 ### 枚举属性切换
```

**File**: `src/card/components/Card/index.tsx` (modified, +76/-1)
```diff
@@ -1,6 +1,6 @@
 import { RightOutlined } from '@ant-design/icons';
 import { omit, useControlledState } from '@rc-component/util';
-import { ConfigProvider, Grid, Tabs } from 'antd';
+import { Card as AntdCard, ConfigProvider, Grid, Tabs } from 'antd';
 import { clsx } from 'clsx';
 import React, { useCallback, useContext } from 'react';
 import { proTheme } from '../../../provider';
@@ -220,13 +220,36 @@ const Card = React.forwardRef((props: CardProps, ref: any) => {
     return element;
   });
 
+  // 基础卡片直接复用 antd Card 的样式管线，自动跟随 Card token、cssVar、
+  // variant 和 hover 阴影。涉及 ProCard 特有布局或交互时继续走兼容实现。
+  const useAntdCard =
+    !containProCard &&
+    !split &&
+    !collapsible &&
+    !collapsibleIconRender &&
+    controlCollapsed === undefined &&
+    !defaultCollapsed &&
+    !tabs &&
+    !ghost &&
+    checked === undefined &&
+    !onChecked &&
+    !headerBordered &&
+    !boxShadow &&
+    !React.isValidElement(loading) &&
+    (!layout || layout === 'default') &&
+    !wrap &&
+    !direction &&
+    (!actions || Array.isArray(actions));
+
   const cardCls = clsx(
     `${prefixCls}`,
     className,
     rootClassName,
     hashId,
     classNames?.root,
     {
+      [`${prefixCls}-antd-card`]: useAntdCard,
+      [`${prefixCls}-legacy`]: !useAntdCard,
       [`${prefixCls}-border`]: variant === 'outlined',
       [`${prefixCls}-box-shadow`]: boxShadow,
       [`${prefixCls}-contain-card`]: containProCard,
@@ -309,6 +332,58 @@ const Card = React.forwardRef((props: CardProps, ref: any) => {
 
   const rootStyle = { ...mergedStyles.root, ...style };
 
+  if (useAntdCard) {
+    return wrapSSR(
+      <AntdCard
+        {...omit(rest, ['prefixCls', 'colSpan'])}
+        ref={ref}
+        className={cardCls}
+        style={rootStyle}
+        styles={{
+          header: mergedStyles.header,
+          body: mergedStyles.body,
+          extra: mergedStyles.extra,
+          title: mergedStyles.title,
+          actions: mergedStyles.actions,
+          cover: mergedStyles.cover,
+        }}
+        classNames={{
+          header: clsx(`${prefixCls}-header`, hashId, classNames?.header),
+          body: bodyCls,
+          extra: extraCls,
+          title: titleCls,
+          actions: clsx(`${prefixCls}-actions`, hashId, classNames?.actions),
+          cover: clsx(`${prefixCls}-cover`, hashId, classNames?.cover),
+        }}
+        title={
+          title ? (
+            <LabelIconTip label={title} tooltip={tooltip} subTitle={subTitle} />
+          ) : undefined
+        }
+        extra={extra}
+        cover={cover}
+        actions={actions as React.ReactNode[] | undefined}
+        loading={Boolean(loading)}
+        hoverable={hoverable}
+        size={size}
+        type={type === 'default' ? undefined : type}
+        variant={variant}
+        onClick={(event) => {
+          if (
+            event.target instanceof Element &&
+            event.target.closest(`.${prefixCls}-extra`)
+          ) {
+            event.stopPropagation();
+            return;
+          }
+          rest.onClick?.(event);
+        }}
+      >
+        {childrenModified}
+      </AntdCard>,
+    );
+  }
+
   return wrapSSR(
     <div
       className={cardCls}
```

**File**: `src/card/components/Card/style.ts` (modified, +58/-55)
```diff
@@ -26,12 +26,15 @@ export const genProCardStyle: GenerateStyle<ProCardToken> = (token) => {
       marginInline: 0,
       paddingBlock: 0,
       paddingInline: 0,
-      backgroundColor: token.colorBgContainer,
-      borderRadius: token.borderRadiusLG,
-      transition: 'all 0.3s',
-      ...resetComponent?.(token),
 
-      '&-box-shadow': {
+      [`&${componentCls}-legacy`]: {
+        ...resetComponent?.(token),
+        backgroundColor: token.colorBgContainer,
+        borderRadius: token.borderRadiusLG,
+        transition: 'all 0.3s',
+      },
+
+      [`&${componentCls}-legacy${componentCls}-box-shadow`]: {
         boxShadow: token.boxShadowTertiary,
         borderColor: 'transparent',
       },
@@ -64,11 +67,11 @@ export const genProCardStyle: GenerateStyle<ProCardToken> = (token) => {
         },
       },
 
-      '&-border': {
+      [`&${componentCls}-legacy${componentCls}-border`]: {
         border: `${token.lineWidth}px ${token.lineType} ${token.colorBorderSecondary}`,
       },
 
-      '&-hoverable': {
+      [`&${componentCls}-legacy${componentCls}-hoverable`]: {
         cursor: 'pointer',
         transition: 'box-shadow 0.3s, border-color 0.3s',
 
@@ -82,7 +85,7 @@ export const genProCardStyle: GenerateStyle<ProCardToken> = (token) => {
         },
       },
 
-      '&-checked': {
+      [`&${componentCls}-legacy${componentCls}-checked`]: {
         ...genActiveStyle(token),
         '&::after': {
           visibility: 'visible',
@@ -100,11 +103,11 @@ export const genProCardStyle: GenerateStyle<ProCardToken> = (token) => {
         },
       },
 
-      '&:focus': {
+      [`&${componentCls}-legacy:focus`]: {
         ...genActiveStyle(token),
       },
 
-      '&&-ghost': {
+      [`&&${componentCls}-legacy${componentCls}-ghost`]: {
         backgroundColor: 'transparent',
         border: 'none',
         boxShadow: 'none',
@@ -124,24 +127,26 @@ export const genProCardStyle: GenerateStyle<ProCardToken> = (token) => {
         },
       },
 
-      '&&-split > &-body': {
-        paddingBlock: 0,
-        paddingInline: 0,
-      },
+      [`&&${componentCls}-legacy${componentCls}-split > ${componentCls}-body`]:
+        {
+          paddingBlock: 0,
+          paddingInline: 0,
+        },
 
-      '&&-contain-card > &-body': {
-        display: 'flex',
-      },
+      [`&&${componentCls}-legacy${componentCls}-contain-card > ${componentCls}-body`]:
+        {
+          display: 'flex',
+        },
 
-      [`${componentCls}-body-direction-column`]: {
+      [`&${componentCls}-legacy ${componentCls}-body-direction-column`]: {
         flexDirection: 'column',
       },
 
-      [`${componentCls}-body-wrap`]: {
+      [`&${componentCls}-legacy ${componentCls}-body-wrap`]: {
         flexWrap: 'wrap',
       },
 
-      '&&-collapse': {
+      [`&&${componentCls}-legacy${componentCls}-collapse`]: {
         [`> ${componentCls}`]: {
           '&-header': {
             paddingBlockEnd: token.padding,
@@ -154,7 +159,7 @@ export const genProCardStyle: GenerateStyle<ProCardToken> = (token) => {
         },
       },
 
-      [`${componentCls}-header`]: {
+      [`&${componentCls}-legacy > ${componentCls}-header`]: {
         display: 'flex',
         alignItems: 'center',
         justifyContent: 'space-between',
@@ -174,26 +179,28 @@ export const genProCardStyle: GenerateStyle<ProCardToken> = (token) => {
         },
       },
 
-      [`${componentCls}-title`]: {
-        color: token.colorText,
-        fontWeight: token.fontWeightStrong,
-        fontSize:
-          (token.components?.Card?.headerFontSize as number | undefined) ??
-          token.fontSizeLG,
-        lineHeight: token.lineHeight,
-      },
+      [`&${componentCls}-legacy > ${componentCls}-header ${componentCls}-title`]:
+        {
+          color: token.colorText,
+          fontWeight: token.fontWeightStrong,
+          fontSize:
+            (token.components?.Card?.headerFontSize as number | undefined) ??
+            token.fontSizeLG,
+          lineHeight: token.lineHeight,
+        },
 
-      [`${componentCls}-extra`]: {
-        color: token.colorText,
-      },
+      [`&${componentCls}-legacy > ${componentCls}-header ${componentCls}-extra`]:
+        {
+          color: token.colorText,
+        },
 
-      [`${componentCls}-type-inner`]: {
-        [`${componentCls}-header`]: {
+      [`&${componentCls}-legacy${componentCls}-type-inner`]: {
+        [`> ${componentCls}-header`]: {
           backgroundColor: token.colorFillAlter,
         },
       },
 
-      [`${componentCls}-collapsible-icon`]: {
+      [`&${componentCls}-legacy ${componentCls}-collapsible-icon`]: {
         marginInlineEnd: token.marginXS,
         color: token.colorIconHover,
         ':hover': {
@@ -205,7 +212,7 @@ export const genProCardStyle: GenerateStyle<ProCardToken> = (token) => {
         },
       },
 
-      [`${componentCls}-cover`]: {
+      [`&${componentCls}-legacy > ${componentCls}-cover`]: {
         ove
```

**File**: `tests/card/index.test.tsx` (modified, +76/-1)
```diff
@@ -1,5 +1,6 @@
 import { ProCard } from '@ant-design/pro-components';
 import { cleanup, render, waitFor } from '@testing-library/react';
+import { ConfigProvider } from 'antd';
 import { act } from 'react';
 import { afterEach, describe, expect, it, vi } from 'vitest';
 import { genProCardStyle } from '../../src/card/components/Card/style';
@@ -18,7 +19,81 @@ describe('Card', () => {
       fontSizeLG: 16,
     } as any) as Record<string, any>;
 
-    expect(style['.pro-card']['.pro-card-title'].fontSize).toBe(22);
+    expect(
+      style['.pro-card']['&.pro-card-legacy > .pro-card-header .pro-card-title']
+        .fontSize,
+    ).toBe(22);
+  });
+
+  it('uses antd Card for the basic visual path (#9738)', () => {
+    const onClick = vi.fn();
+    const wrapper = render(
+      <ConfigProvider theme={{ cssVar: { key: 'pro-card-test' } }}>
+        <ProCard
+          title="标题"
+          extra={<button type="button">操作</button>}
+          hoverable
+          variant="outlined"
+          onClick={onClick}
+        >
+          内容
+        </ProCard>
+      </ConfigProvider>,
+    );
+    const card = wrapper.container.querySelector('.ant-pro-card');
+
+    expect(card).toHaveClass('ant-card');
+    expect(card).toHaveClass('ant-card-hoverable');
+    expect(card).toHaveClass('ant-pro-card-antd-card');
+    expect(
+      card?.querySelector('.ant-card-head.ant-pro-card-header'),
+    ).toBeTruthy();
+    expect(
+      card?.querySelector('.ant-card-body.ant-pro-card-body'),
+    ).toBeTruthy();
+
+    act(() => {
+      wrapper.getByRole('button', { name: '操作' }).click();
+    });
+    expect(onClick).not.toHaveBeenCalled();
+
+    act(() => {
+      card?.querySelector<HTMLElement>('.ant-card-body')?.click();
+    });
+    expect(onClick).toHaveBeenCalledOnce();
+  });
+
+  it('keeps ProCard specific behavior on the compatibility path (#9738)', () => {
+    const wrapper = render(
+      <ProCard title="可折叠" collapsible>
+        内容
+      </ProCard>,
+    );
+    const card = wrapper.container.querySelector('.ant-pro-card');
+
+    expect(card).toHaveClass('ant-pro-card-legacy');
+    expect(card).not.toHaveClass('ant-card');
+  });
+
+  it('keeps layout on the parent and uses antd Card for basic children (#9738)', () => {
+    const onParentClick = vi.fn();
+    const wrapper = render(
+      <ProCard onClick={onParentClick}>
+        <ProCard title="子卡片" extra={<button type="button">子操作</button>}>
+          内容
+        </ProCard>
+      </ProCard>,
+    );
+    const cards = wrapper.container.querySelectorAll('.ant-pro-card');
+
+    expect(cards[0]).toHaveClass('ant-pro-card-legacy');
+    expect(cards[1]).toHaveClass('ant-pro-card-antd-card');
+    expect(cards[1]).toHaveClass('ant-card');
+
+    act(() => {
+      wrapper.getByRole('button', { name: '子操作' }).click();
+    });
+    expect(onParentClick).not.toHaveBeenCalled();
   });
 
   it('🥩 collapsible onCollapse', async () => {
```

---

### Incident Patch 6: `85039b89` (2026-10-04)
**Commit Message**: fix(InlineErrorFormItem): auto-open popover when validation errors appear

- Show popover with defaultOpen when validation errors exist
- Use hover trigger only, avoiding click interference with input focus
- Wrap input in span to ensure rc-trigger events attach correctly
- Extract createShouldUpdate to avoid duplication between popover and
  default branches
- docs(table): fix TagList ref warning in editable-table demo by
  converting to React.forwardRef
- test: add hover trigger coverage for InlineErrorFormItem

**File**: `src/utils/components/InlineErrorFormItem/index.tsx` (modified, +8/-1)
```diff
@@ -121,6 +121,9 @@ const InlineErrorFormItemPopover: React.FC<{
     return <>{input}</>;
   }
 
+  // 只有自定义组件（非原生 DOM 元素）才需要包装，确保 rc-trigger 事件正确注入
+  const shouldWrap = React.isValidElement(input) && typeof input.type !== 'string';
+
   return (
     <>
       {/* 不能把 Fragment 作为 Popover 的直接 child：rc-trigger 会向 child 注入
@@ -156,7 +159,11 @@ const InlineErrorFormItemPopover: React.FC<{
         )}
         {...popoverProps}
       >
-        <span style={{ display: 'inline-block', width: '100%' }}>{input}</span>
+        {shouldWrap ? (
+          <span style={{ display: 'inline-block', width: '100%' }}>{input}</span>
+        ) : (
+          input
+        )}
       </Popover>
     </>
   );
```

---

### Incident Patch 7: `8029cbae` (2026-10-04)
**Commit Message**: fix(InlineErrorFormItem): auto-open popover when validation errors appear

- Show popover with defaultOpen when validation errors exist
- Use hover trigger only, avoiding click interference with input focus
- Wrap input in span to ensure rc-trigger events attach correctly
- Extract createShouldUpdate to avoid duplication between popover and
  default branches
- docs(table): fix TagList ref warning in editable-table demo by
  converting to React.forwardRef

**File**: `demos/table/editable-table/custom.tsx` (modified, +18/-14)
```diff
@@ -20,19 +20,22 @@ const waitTime = (time: number = 100) => {
 };
 
 
-const TagList: React.FC<{
-  value?: {
-    key: string;
-    label: string;
-  }[];
-  onChange?: (
-    value: {
+const TagList = React.forwardRef<
+  HTMLDivElement,
+  {
+    value?: {
       key: string;
       label: string;
-    }[],
-  ) => void;
-}> = ({ value, onChange }) => {
-  const ref = useRef<InputRef | null>(null);
+    }[];
+    onChange?: (
+      value: {
+        key: string;
+        label: string;
+      }[],
+    ) => void;
+  }
+>(({ value, onChange }, ref) => {
+  const inputRef = useRef<InputRef | null>(null);
   const [newTags, setNewTags] = useState<
     {
       key: string;
@@ -62,12 +65,12 @@ const TagList: React.FC<{
   };
 
   return (
-    <Space>
+    <Space ref={ref}>
       {(value || []).concat(newTags).map((item) => (
         <Tag key={item.key}>{item.label}</Tag>
       ))}
       <Input
-        ref={ref}
+        ref={inputRef}
         type="text"
         size="small"
         style={{ width: 78 }}
@@ -78,7 +81,8 @@ const TagList: React.FC<{
       />
     </Space>
   );
-};
+});
+TagList.displayName = 'TagList';
 
 type DataSourceType = {
   id: React.Key;
```

**File**: `src/utils/components/InlineErrorFormItem/index.tsx` (modified, +42/-42)
```diff
@@ -26,6 +26,28 @@ const FIX_INLINE_STYLE = {
   marginInlineEnd: 0,
 };
 
+/**
+ * 生成 Form.Item 的 shouldUpdate 函数，用于精确控制字段级更新。
+ * 提取为共享函数，避免 InternalFormItemFunction 和默认分支重复定义。
+ */
+const createShouldUpdate = (name: NamePath) => {
+  return (prev: any, next: any) => {
+    if (prev === next) return false;
+    const shouldName = [name].flat(1);
+    if (shouldName.length > 1) {
+      shouldName.pop();
+    }
+    try {
+      return (
+        JSON.stringify(get(prev, shouldName)) !==
+        JSON.stringify(get(next, shouldName))
+      );
+    } catch (_error) {
+      return true;
+    }
+  };
+};
+
 /**
  * 读取 Form.Item 校验状态并渲染 Popover 错误层。
  *
@@ -64,6 +86,15 @@ const InlineErrorFormItemPopover: React.FC<{
       (displayedMessages.warnings?.length ?? 0) >=
     1;
 
+  // 错误消失时重置 open 状态，确保下次错误能正常弹出
+  const prevHasMessages = React.useRef(false);
+  useEffect(() => {
+    if (!hasMessages && prevHasMessages.current) {
+      setOpen(false);
+    }
+    prevHasMessages.current = hasMessages;
+  }, [hasMessages]);
+
   const renderMessageContent = () => (
     <>
       {displayedMessages.errors?.map((error, index) => (
@@ -85,6 +116,11 @@ const InlineErrorFormItemPopover: React.FC<{
     </>
   );
 
+  // 无错误时禁用 Popover，避免空内容弹出
+  if (!hasMessages) {
+    return <>{input}</>;
+  }
+
   return (
     <>
       {/* 不能把 Fragment 作为 Popover 的直接 child：rc-trigger 会向 child 注入
@@ -93,12 +129,8 @@ const InlineErrorFormItemPopover: React.FC<{
           这里以 input 本体作为 trigger。 */}
       <Popover
         key="popover"
-        open={!hasMessages ? false : open}
-        onOpenChange={(changeOpen: boolean) => {
-          if (changeOpen === open) return;
-          setOpen(changeOpen);
-        }}
-        trigger={popoverProps?.trigger || ['click']}
+        defaultOpen={true}
+        trigger={popoverProps?.trigger || ['hover']}
         placement={popoverProps?.placement || 'topLeft'}
         getPopupContainer={popoverProps?.getPopupContainer}
         getTooltipContainer={popoverProps?.getTooltipContainer}
@@ -118,13 +150,13 @@ const InlineErrorFormItemPopover: React.FC<{
               )}
             >
               {loading ? <LoadingOutlined /> : null}
-              {hasMessages ? renderMessageContent() : null}
+              {renderMessageContent()}
             </div>
           </div>,
         )}
         {...popoverProps}
       >
-        {input}
+        <span style={{ display: 'inline-block', width: '100%' }}>{input}</span>
       </Popover>
     </>
   );
@@ -171,21 +203,7 @@ const InternalFormItemFunction: React.FC<InternalProps & FormItemProps> = ({
       // help="" 占位：popover 模式下原生 explain 只渲染空内容，错误由气泡接管；
       // 同时 additionalDom 常驻，校验出现/消失时高度稳定（#9709/#8942）
       help=""
-      shouldUpdate={(prev, next) => {
-        if (prev === next) return false;
-        const shouldName = [name].flat(1);
-        if (shouldName.length > 1) {
-          shouldName.pop();
-        }
-        try {
-          return (
-            JSON.stringify(get(prev, shouldName)) !==
-            JSON.stringify(get(next, shouldName))
-          );
-        } catch (_error) {
-          return true;
-        }
-      }}
+      shouldUpdate={createShouldUpdate(name)}
       {...rest}
       style={{
         ...FIX_INLINE_STYLE,
@@ -217,25 +235,7 @@ export const InlineErrorFormItem = (props: InlineErrorFormItemProps) => {
   return (
     <Form.Item
       rules={rules}
-      shouldUpdate={
-        name
-          ? (prev, next) => {
-              if (prev === next) return false;
-              const shouldName = [name].flat(1);
-              if (shouldName.length > 1) {
-                shouldName.pop();
-              }
-              try {
-                return (
-                  JSON.stringify(get(prev, shouldName)) !==
-                  JSON.stringify(get(next, shouldName))
-                );
-              } catch (_error) {
-                return true;
-              }
-            }
-          : undefined
-      }
+      shouldUpdate={name ? createShouldUpdate(name) : undefined}
       {...rest}
       style={{ ...FIX_INLINE_STYLE, ...rest.style }}
       name={name}
```

---

### Incident Patch 8: `988def8e` (2026-10-04)
**Commit Message**: fix: replace antd static message calls with App.useApp() to consume dynamic theme

- useEditableMap/useEditableArray: introduce useWarning() hook backed by
  App.useApp() so warning toasts consume ConfigProvider dynamic theme
  context instead of triggering the "Static function can not consume
  context" warning
- SettingDrawer: use App.useApp() directly instead of static message
- tests: wrap useEditableMap/useEditableArray/EditableProTable/
  ProDescriptions test components with <App /> to supply the required
  context for App.useApp()
- changelog: update zh-CN and en-US entries

**File**: `site/changelog.en-US.md` (modified, +1/-0)
```diff
@@ -37,6 +37,7 @@
   - 🐞 Restore `showActions`, `showExtra`, and card action placement, and lock grid gutter and live pagination regressions [#7421](https://github.com/ant-design/pro-components/issues/7421) [#8387](https://github.com/ant-design/pro-components/issues/8387) [#7862](https://github.com/ant-design/pro-components/issues/7862)
 - ProTable
   - 🆕 Add `options.setting.listItemTitleRender` for adaptive column-setting titles [#9620](https://github.com/ant-design/pro-components/issues/9620)
+- 🐞 Replace antd static `message` calls with `App.useApp()` in `useEditableMap`, `useEditableArray`, and `SettingDrawer` to consume dynamic theme context correctly
 
 ### 📖 Documentation
 
```

**File**: `site/changelog.md` (modified, +1/-0)
```diff
@@ -38,6 +38,7 @@
   - 🐞 恢复 `showActions`、`showExtra` 与卡片操作区位置，并锁定栅格间距和实时分页回归 [#7421](https://github.com/ant-design/pro-components/issues/7421) [#8387](https://github.com/ant-design/pro-components/issues/8387) [#7862](https://github.com/ant-design/pro-components/issues/7862)
 - ProTable
   - 🆕 增加 `options.setting.listItemTitleRender`，支持列设置标题自适应渲染 [#9620](https://github.com/ant-design/pro-components/issues/9620)
+- 🐞 将 `useEditableMap`、`useEditableArray` 与 `SettingDrawer` 中的 antd 静态 `message` 调用替换为 `App.useApp()`，以正确消费动态主题上下文
 
 ### 📖 文档
 
```

**File**: `src/layout/components/SettingDrawer/index.tsx` (modified, +3/-1)
```diff
@@ -7,13 +7,13 @@ import {
 import { omit, useControlledState } from '@rc-component/util';
 import {
   Alert,
+  App,
   Button,
   Divider,
   Drawer,
   DrawerProps,
   List,
   Switch,
-  message,
 } from 'antd';
 import { clsx } from 'clsx';
 import React, { useCallback, useEffect, useRef, useState } from 'react';
@@ -191,6 +191,7 @@ const genCopySettingJson = (settingState: MergerSettingsType<ProSettings>) =>
 
 /**
  * 可视化配置组件
+ * 使用 `App.useApp()` 获取 message 实例，需要业务方在外层包裹 `<App />`。
  *
  * @param props
  */
@@ -220,6 +221,7 @@ export const SettingDrawer: React.FC<SettingDrawerProps> = (props) => {
     themeOnly,
     drawerProps,
   } = props;
+  const { message } = App.useApp();
   const firstRender = useRef<boolean>(true);
 
   const [open, setOpenInner] = useControlledState(false, props.collapse);
```

**File**: `src/utils/useEditableArray/index.tsx` (modified, +9/-4)
```diff
@@ -6,7 +6,7 @@ import {
   useControlledState,
 } from '@rc-component/util';
 import type { FormInstance, FormProps } from 'antd';
-import { Form, Popconfirm, message } from 'antd';
+import { App, Form, Popconfirm } from 'antd';
 import type { AnyObject } from 'antd/lib/_util/type';
 import type { NamePath } from 'antd/lib/form/interface';
 import type { GetRowKey } from 'antd/lib/table/interface';
@@ -32,10 +32,13 @@ const { noteOnce } = rcWarning;
 
 /**
  * 显示警告信息
- * @param messageStr
+ * 使用 `App.useApp()` 获取 message 实例，以消费 ConfigProvider 动态主题。
  */
-const warning = (messageStr: React.ReactNode) => {
-  return message.warning(messageStr);
+const useWarning = () => {
+  const { message } = App.useApp();
+  return useRefFunction((messageStr: React.ReactNode) => {
+    return message.warning(messageStr);
+  });
 };
 
 /** 无 cell 级编辑键时复用的空数组，避免每格渲染分配 */
@@ -513,6 +516,7 @@ export function editableRowByKey<RecordType>(
  * 保存按钮的dom
  *
  * @param ActionRenderConfig
+ * @param ref
  */
 export function SaveEditableAction<T>(
   {
@@ -850,6 +854,7 @@ export function useEditableArray<RecordType extends AnyObject>(
 
   // Internationalization
   const intl = useIntl();
+  const warning = useWarning();
 
   /**
    * 点击开始编辑之前的保存数据用的
```

**File**: `src/utils/useEditableMap/index.tsx` (modified, +8/-6)
```diff
@@ -1,5 +1,5 @@
 import { get, useControlledState } from '@rc-component/util';
-import { message } from 'antd';
+import { App } from 'antd';
 import set from 'es-toolkit/compat/set';
 import type React from 'react';
 import { useCallback, useEffect, useMemo, useRef } from 'react';
@@ -33,12 +33,13 @@ const recordKeyToPath = (recordKey: RecordKey): (string | number)[] => {
 
 /**
  * 显示警告信息（仅在 single 模式拦截重复编辑时调用）。
- * NOTE: 使用 antd `message` 静态方法在 antd 5 下无法消费 ConfigProvider 的主题，
- *       但替换为 `App.useApp()` 需要业务方在外层包裹 `<App />`，会有破坏性。
- *       这里保留静态方法兼容历史调用，建议消费方自行包裹 `<App />` 以获得正确主题。
+ * 使用 `App.useApp()` 获取 message 实例，以消费 ConfigProvider 动态主题。
  */
-const warning = (messageStr: React.ReactNode) => {
-  message.warning(messageStr);
+const useWarning = () => {
+  const { message } = App.useApp();
+  return useRefFunction((messageStr: React.ReactNode) => {
+    message.warning(messageStr);
+  });
 };
 
 /**
@@ -106,6 +107,7 @@ export function useEditableMap<
 
   // Internationalization
   const intl = useIntl();
+  const warning = useWarning();
 
   const [editableKeys, setEditableRowKeysInner] = useControlledState<
     React.Key[]
```

**File**: `tests/descriptions/editor.test.tsx` (modified, +32/-30)
```diff
@@ -6,7 +6,7 @@ import type {
 import { ProDescriptions } from '@ant-design/pro-components';
 import { useControlledState } from '@rc-component/util';
 import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
-import { Form, InputNumber } from 'antd';
+import { App, Form, InputNumber } from 'antd';
 import React, { act, useCallback, useRef } from 'react';
 import { afterEach, describe, expect, it, vi } from 'vitest';
 type DataSourceType = {
@@ -123,35 +123,37 @@ const DescriptionsDemo = (
     [props.onDataSourceChange, setDataSourceInner],
   );
   return (
-    <ProDescriptions<DataSourceType>
-      columns={columns}
-      actionRef={actionRef}
-      request={async () => ({
-        data: defaultData,
-        total: 3,
-        success: true,
-      })}
-      title={
-        <a
-          id="reset_test"
-          onClick={() => {
-            form.resetFields();
-          }}
-        >
-          重置
-        </a>
-      }
-      dataSource={dataSource}
-      onDataSourceChange={handleDataSourceChange}
-      editable={{
-        ...props,
-        form,
-        type: props.type,
-        editableKeys,
-        onSave: props.onSave,
-        onChange: (keys) => setEditorRowKeys(keys),
-      }}
-    />
+    <App>
+      <ProDescriptions<DataSourceType>
+        columns={columns}
+        actionRef={actionRef}
+        request={async () => ({
+          data: defaultData,
+          total: 3,
+          success: true,
+        })}
+        title={
+          <a
+            id="reset_test"
+            onClick={() => {
+              form.resetFields();
+            }}
+          >
+            重置
+          </a>
+        }
+        dataSource={dataSource}
+        onDataSourceChange={handleDataSourceChange}
+        editable={{
+          ...props,
+          form,
+          type: props.type,
+          editableKeys,
+          onSave: props.onSave,
+          onChange: (keys) => setEditorRowKeys(keys),
+        }}
+      />
+    </App>
   );
 };
 
```

**File**: `tests/table/editor-table.test.tsx` (modified, +29/-25)
```diff
@@ -16,7 +16,7 @@ import {
   render,
   waitFor,
 } from '@testing-library/react';
-import { Input, InputNumber } from 'antd';
+import { App, Input, InputNumber } from 'antd';
 import crypto from 'crypto';
 import React from 'react';
 import {
@@ -302,20 +302,22 @@ describe('EditorProTable', () => {
       changedDataSource = value;
     });
     const wrapper = render(
-      <ProForm
-        initialValues={{
-          table: defaultData,
-        }}
-      >
-        <div>render</div>
-        <EditableProTable<DataSourceType>
-          rowKey="id"
-          name="table"
-          onChange={onChange}
-          actionRef={actionRef}
-          columns={columns}
-        />
-      </ProForm>,
+      <App>
+        <ProForm
+          initialValues={{
+            table: defaultData,
+          }}
+        >
+          <div>render</div>
+          <EditableProTable<DataSourceType>
+            rowKey="id"
+            name="table"
+            onChange={onChange}
+            actionRef={actionRef}
+            columns={columns}
+          />
+        </ProForm>
+      </App>,
     );
 
     await waitForWaitTime(100);
@@ -2263,16 +2265,18 @@ describe('EditorProTable', () => {
 
   it('📝 EditableProTable support onlyOneLineEditorAlertMessage', async () => {
     const wrapper = render(
-      <EditableProTable<DataSourceType>
-        rowKey="id"
-        columns={columns}
-        value={defaultData}
-        editable={{
-          type: 'single',
-          editableKeys: [624748504],
-          onlyOneLineEditorAlertMessage: '只能编辑一行',
-        }}
-      />,
+      <App>
+        <EditableProTable<DataSourceType>
+          rowKey="id"
+          columns={columns}
+          value={defaultData}
+          editable={{
+            type: 'single',
+            editableKeys: [624748504],
+            onlyOneLineEditorAlertMessage: '只能编辑一行',
+          }}
+        />
+      </App>,
     );
     await waitForWaitTime(100);
 
```

**File**: `tests/utils/useEditableArray-array-recordKey.test.tsx` (modified, +10/-2)
```diff
@@ -5,7 +5,7 @@ import {
   render,
   waitFor,
 } from '@testing-library/react';
-import { Form } from 'antd';
+import { App, Form } from 'antd';
 import React, { useState } from 'react';
 import {
   afterAll,
@@ -52,7 +52,7 @@ describe('useEditableArray - Array recordKey Support', () => {
   /**
    * 测试组件：用于测试数组 recordKey 功能
    */
-  const TestComponent: React.FC<{
+  const InnerComponent: React.FC<{
     onSave?: (
       key: RecordKey,
       record: TestRecordType & { index?: number },
@@ -103,6 +103,14 @@ describe('useEditableArray - Array recordKey Support', () => {
     );
   };
 
+  const TestComponent: React.FC<
+    React.ComponentProps<typeof InnerComponent>
+  > = (props) => (
+    <App>
+      <InnerComponent {...props} />
+    </App>
+  );
+
   it('📝 保存时应该正确处理数组 recordKey（嵌套字段）', async () => {
     // 测试数组 recordKey 的处理逻辑
     const recordKey: RecordKey = [1, 'nested', 'field'];
```

---

### Incident Patch 9: `9d879a52` (2026-10-04)
**Commit Message**: build: replace Father with Rslib

**File**: `.fatherrc.ts` (removed, +0/-39)
```diff
@@ -1,39 +0,0 @@
-import { defineConfig } from 'father';
-
-const targets = {
-  edge: 141,
-  firefox: 140,
-  chrome: 109,
-  safari: 18,
-  opera: 124,
-  electron: 39,
-};
-
-const baseConfig = {
-  platform: 'browser', // 默认构建为 Browser 环境的产物
-  transformer: 'babel', // 默认使用 babel 以提供更好的兼容性
-  parallel: true,
-  targets,
-} as const;
-
-export default defineConfig({
-  esm: {
-    output: 'es',
-    ...baseConfig,
-  },
-  cjs: {
-    output: 'lib',
-    ...baseConfig,
-  },
-  umd: {
-    name: 'ProComponents',
-    output: 'dist',
-    externals: {
-      react: 'React',
-      'react-dom': 'ReactDOM',
-      antd: 'antd',
-      dayjs: 'dayjs',
-    },
-    targets,
-  },
-});
```

**File**: `docs/internal/rslib-migration.md` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+# Rslib 构建迁移
+
+## 构建契约
+
+项目使用 Rslib 1.x 生成三套发布产物：
+
+| 格式     | 目录                         | 模式            | 声明文件        |
+| -------- | ---------------------------- | --------------- | --------------- |
+| ESM      | `es`                         | bundleless      | TypeScript 7 Go |
+| CommonJS | `lib`                        | bundleless      | TypeScript 7 Go |
+| UMD      | `dist/pro-components.min.js` | bundle + minify | 不单独生成      |
+
+`package.json` 中的 `module`、`main`、`types` 和 `unpkg` 保持原路径，消费方不需要修改导入方式。
+
+## 性能基线
+
+2026-10-04 在同一 Windows 工作区执行完整构建：
+
+| 阶段                |  Rslib |
+| ------------------- | -----: |
+| ESM JavaScript      | 1.13 s |
+| CommonJS JavaScript | 1.12 s |
+| UMD                 | 1.08 s |
+| 两套声明文件        | 2.77 s |
+| 完整命令墙钟时间    | 3.90 s |
+
+迁移前 Father 最近一次记录的三个 JavaScript 阶段合计约 50 秒。两套日志的输出口径不同，因此该数据用于本机工程反馈对比，不作为跨机器基准。
+
+UMD 从 Father 构建的 761,644 B / gzip 234,281 B 降到 Rslib 的 735,309 B / gzip 229,605 B，原始体积降低 3.5%，gzip 降低 2.0%。新产物同时保留了此前会被 `sideEffects: false` 错误删除的 Day.js 初始化代码。
+
+## 兼容性约束
+
+- bundleless 产物保留源码目录结构，并给相对模块引用补 `.js` 扩展名。
+- UMD 的 CommonJS/AMD 请求使用包名 `react`、`react-dom`、`antd`、`dayjs`。
+- UMD 浏览器全局继续使用 `React`、`ReactDOM`、`antd`、`dayjs`。
+- 发布专用 `tsconfig.build.json` 只包含 `src`，并显式加载 Node 类型供源码中的 `process.env` 声明使用。
+- `package.json#sideEffects` 保留 `initDayjs`，避免消费方打包器删除 Day.js 插件注册。
+- `pnpm run check:build-outputs` 检查每个源码模块的 JavaScript/声明文件、package.json 入口、UMD externals 和主要公共导出。
+
+## 维护命令
+
+```powershell
+pnpm run build
+pnpm run check:build-outputs
+pnpm run analyze:bundle
+```
```

**File**: `package.json` (modified, +8/-4)
```diff
@@ -15,7 +15,9 @@
     "url": "git+https://github.com/ant-design/pro-components.git"
   },
   "license": "MIT",
-  "sideEffects": false,
+  "sideEffects": [
+    "**/initDayjs.*"
+  ],
   "main": "lib/index.js",
   "unpkg": "dist/pro-components.min.js",
   "module": "es/index.js",
@@ -27,10 +29,11 @@
     "guidelines"
   ],
   "scripts": {
-    "build": "father build",
+    "build": "rslib build --config rslib.config.mts",
     "analyze:bundle": "node ./scripts/performance/measureBundleSize.mjs",
     "benchmark:selection": "node ./scripts/performance/selectionBenchmark.mjs",
     "changelog": "node ./scripts/changelogs.mjs",
+    "check:build-outputs": "node ./scripts/checkBuildOutputs.mjs",
     "check:declarations": "node ./scripts/checkDeclarations.mjs",
     "check:published-types": "tsc -p ./scripts/fixtures/published-types/tsconfig.json",
     "check:safety": "node ./scripts/checkRepositorySafety.mjs",
@@ -44,7 +47,7 @@
     "docs:preview": "pnpm docs preview",
     "docs:create": "pnpm docs create",
     "docs:check": "pnpm docs check",
-    "prepublishOnly": "pnpm run check:safety && pnpm run test && pnpm run build && pnpm run check:declarations && pnpm run check:published-types",
+    "prepublishOnly": "pnpm run check:safety && pnpm run test && pnpm run build && pnpm run check:build-outputs && pnpm run check:declarations && pnpm run check:published-types",
     "lint": "oxlint --type-aware --type-check .",
     "lint:check": "oxlint .",
     "lint:fix": "oxlint --fix .",
@@ -98,6 +101,8 @@
     "@babel/preset-typescript": "^7.29.7",
     "@babel/traverse": "^7.29.8",
     "@emotion/babel-plugin": "^11.13.5",
+    "@rsbuild/plugin-react": "^2.1.1",
+    "@rslib/core": "1.0.3",
     "@testing-library/dom": "^10.4.2",
     "@testing-library/jest-dom": "^7.0.1",
     "@testing-library/react": "^16.3.3",
@@ -131,7 +136,6 @@
     "execa": "^10.0.1",
     "express": "^5.2.1",
     "fast-deep-equal": "^3.1.3",
-    "father": "^4.6.38",
     "gh-pages": "^6.3.0",
     "glob": "^13.0.6",
     "happy-dom": "^20.14.5",
```

**File**: `pnpm-lock.yaml` (modified, +479/-654)
```diff
@@ -117,6 +117,12 @@ importers:
       '@emotion/babel-plugin':
         specifier: ^11.13.5
         version: 11.13.5
+      '@rsbuild/plugin-react':
+        specifier: ^2.1.1
+        version: 2.1.1(@rsbuild/core@2.2.11(core-js@3.50.0))(@rspack/core@2.2.8(@swc/helpers@0.5.23))
+      '@rslib/core':
+        specifier: 1.0.3
+        version: 1.0.3(@typescript/typescript6@6.0.2)(core-js@3.50.0)
       '@testing-library/dom':
         specifier: ^10.4.2
         version: 10.4.2
@@ -161,13 +167,13 @@ importers:
         version: 1.2.1
       '@umijs/plugin-analytics':
         specifier: ^0.2.4
-        version: 0.2.4(umi@4.7.20(@babel/core@7.29.7)(@types/node@26.6.3)(@types/react@18.3.31)(@typescript/typescript6@6.0.2)(jiti@2.7.0)(lightningcss@1.33.0)(prettier@3.9.9)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(rolldown@1.2.11)(rollup@4.63.5)(sass@1.105.0)(tsx@4.23.15)(type-fest@4.41.0))
+        version: 0.2.4(umi@4.7.20(@babel/core@7.29.7)(@rspack/core@2.2.8(@swc/helpers@0.5.23))(@types/node@26.6.3)(@types/react@18.3.31)(@typescript/typescript6@6.0.2)(jiti@2.7.0)(lightningcss@1.33.0)(prettier@3.9.9)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(rolldown@1.2.11)(rollup@4.63.5)(sass@1.105.0)(tsx@4.23.15)(type-fest@4.41.0))
       '@umijs/test':
         specifier: ^3.5.43
-        version: 3.5.43(ts-node@10.9.2(@swc/core@1.9.2(@swc/helpers@0.5.15))(@types/node@26.6.3)(@typescript/typescript6@6.0.2))
+        version: 3.5.43(ts-node@10.9.2(@swc/core@1.9.2(@swc/helpers@0.5.23))(@types/node@26.6.3)(@typescript/typescript6@6.0.2))
       '@umijs/test-utils':
         specifier: ^3.5.43
-        version: 3.5.43(@testing-library/react@16.3.3(@testing-library/dom@10.4.2)(@types/react-dom@18.3.7(@types/react@18.3.31))(@types/react@18.3.31)(react-dom@18.3.1(react@18.3.1))(react@18.3.1))(umi@4.7.20(@babel/core@7.29.7)(@types/node@26.6.3)(@types/react@18.3.31)(@typescript/typescript6@6.0.2)(jiti@2.7.0)(lightningcss@1.33.0)(prettier@3.9.9)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(rolldown@1.2.11)(rollup@4.63.5)(sass@1.105.0)(tsx@4.23.15)(type-fest@4.41.0))
+        version: 3.5.43(@testing-library/react@16.3.3(@testing-library/dom@10.4.2)(@types/react-dom@18.3.7(@types/react@18.3.31))(@types/react@18.3.31)(react-dom@18.3.1(react@18.3.1))(react@18.3.1))(umi@4.7.20(@babel/core@7.29.7)(@rspack/core@2.2.8(@swc/helpers@0.5.23))(@types/node@26.6.3)(@types/react@18.3.31)(@typescript/typescript6@6.0.2)(jiti@2.7.0)(lightningcss@1.33.0)(prettier@3.9.9)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(rolldown@1.2.11)(rollup@4.63.5)(sass@1.105.0)(tsx@4.23.15)(type-fest@4.41.0))
       '@umijs/utils':
         specifier: ^4.7.20
         version: 4.7.20
@@ -200,10 +206,10 @@ importers:
         version: 10.1.0
       dumi:
         specifier: ^2.4.50
-        version: 2.4.50(@babel/core@7.29.7)(@swc/helpers@0.5.15)(@types/node@26.6.3)(@types/react@18.3.31)(@typescript/typescript6@6.0.2)(jiti@2.7.0)(lightningcss@1.33.0)(prettier@3.9.9)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(rolldown@1.2.11)(rollup@4.63.5)(tsx@4.23.15)(type-fest@4.41.0)
+        version: 2.4.50(@babel/core@7.29.7)(@rspack/core@2.2.8(@swc/helpers@0.5.23))(@swc/helpers@0.5.23)(@types/node@26.6.3)(@types/react@18.3.31)(@typescript/typescript6@6.0.2)(jiti@2.7.0)(lightningcss@1.33.0)(prettier@3.9.9)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(rolldown@1.2.11)(rollup@4.63.5)(tsx@4.23.15)(type-fest@4.41.0)
       dumi-theme-antd-style:
         specifier: ^0.31.1
-        version: 0.31.1(@types/react@18.3.31)(dumi@2.4.50(@babel/core@7.29.7)(@swc/helpers@0.5.15)(@types/node@26.6.3)(@types/react@18.3.31)(@typescript/typescript6@6.0.2)(jiti@2.7.0)(lightningcss@1.33.0)(prettier@3.9.9)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(rolldown@1.2.11)(rollup@4.63.5)(tsx@4.23.15)(type-fest@4.41.0))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
+        version: 0.31.1(@types/react@18.3.31)(dumi@2.4.50(@babel/core@7.29.7)(@rspack/core@2.2.8(@swc/helpers@0.5.23))(@swc/helpers@0.5.23)(@types/node@26.6.3)(@types/react@18.3.31)(@typescript/typescript6@6.0.2)(jiti@2.7.0)(lightningcss@1.33.0)(prettier@3.9.9)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(rolldown@1.2.11)(rollup@4.63.5)(tsx@4.23.15)(type-fest@4.41.0))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       esbuild:
         specifier: '>=0.25.0'
         version: 0.28.2
@@ -216,9 +222,6 @@ importers:
       fast-deep-equal:
         specifier: ^3.1.3
         version: 3.1.3
-      father:
-        specifier: ^4.6.38
-        version: 4.6.38(@babel/core@7.29.7)(@types/node@26.6.3)(less-loader@12.3.3(less@4.9.1))(less@4.9.1)(postcss@8.5.28)(resolve-url-loader@5.0.0)(sass-loader@16.0.8(sass@1.105.0))(sass@1.105.0)(type-fest@4.41.0)
       gh-pages:
         specifier: ^6.3.0
         version: 6.3.0
@@ -311,7 +314,7 @@ importers:
         version: 1.4.3
       ts-node:
         specifier: ^10.9.2
-        version: 10.9.2(@swc/core@1.9.2(@swc/helpers@0.5.15))(@types/node@26.6.3)(@typescript/typescript6@6.0.2)
+        v
```

**File**: `rslib.config.mts` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+import { pluginReact } from '@rsbuild/plugin-react';
+import { defineConfig } from '@rslib/core';
+import { createRequire } from 'node:module';
+
+const require = createRequire(import.meta.url);
+const typescriptPath = require.resolve('@typescript/native');
+
+const browsers = [
+  'Edge >= 141',
+  'Firefox >= 140',
+  'Chrome >= 109',
+  'Safari >= 18',
+  'Opera >= 124',
+  'Electron >= 39',
+];
+
+const bundlelessEntry = {
+  index: ['./src/**'],
+};
+
+const bundlelessOutput = (root: string) => ({
+  target: 'web' as const,
+  overrideBrowserslist: browsers,
+  distPath: { root },
+  cleanDistPath: true,
+});
+
+export default defineConfig({
+  lib: [
+    {
+      id: 'esm',
+      format: 'esm',
+      bundle: false,
+      autoExtension: false,
+      dts: {
+        tsgo: true,
+        typescriptPath,
+      },
+      source: {
+        entry: bundlelessEntry,
+        tsconfigPath: './tsconfig.build.json',
+      },
+      output: bundlelessOutput('es'),
+    },
+    {
+      id: 'cjs',
+      format: 'cjs',
+      bundle: false,
+      autoExtension: false,
+      dts: {
+        tsgo: true,
+        typescriptPath,
+      },
+      source: {
+        entry: bundlelessEntry,
+        tsconfigPath: './tsconfig.build.json',
+      },
+      output: bundlelessOutput('lib'),
+    },
+    {
+      id: 'umd',
+      format: 'umd',
+      bundle: true,
+      autoExtension: false,
+      umdName: 'ProComponents',
+      source: {
+        entry: {
+          index: './src/index.ts',
+        },
+        tsconfigPath: './tsconfig.build.json',
+      },
+      output: {
+        target: 'web',
+        overrideBrowserslist: browsers,
+        distPath: { root: 'dist' },
+        cleanDistPath: true,
+        filename: {
+          js: 'pro-components.min.js',
+        },
+        minify: true,
+        externals: {
+          react: {
+            root: 'React',
+            commonjs: 'react',
+            commonjs2: 'react',
+            amd: 'react',
+          },
+          'react-dom': {
+            root: 'ReactDOM',
+            commonjs: 'react-dom',
+            commonjs2: 'react-dom',
+            amd: 'react-dom',
+          },
+          antd: {
+            root: 'antd',
+            commonjs: 'antd',
+            commonjs2: 'antd',
+            amd: 'antd',
+          },
+          dayjs: {
+            root: 'dayjs',
+            commonjs: 'dayjs',
+            commonjs2: 'dayjs',
+            amd: 'dayjs',
+          },
+        },
+      },
+    },
+  ],
+  plugins: [pluginReact()],
+});
```

**File**: `scripts/checkBuildOutputs.mjs` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+import fs from 'node:fs';
+import { createRequire } from 'node:module';
+import path from 'node:path';
+import { fileURLToPath } from 'node:url';
+import vm from 'node:vm';
+
+const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
+const require = createRequire(import.meta.url);
+
+const fail = (message) => {
+  throw new Error(message);
+};
+
+const visit = (directory) =>
+  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
+    const file = path.join(directory, entry.name);
+    return entry.isDirectory() ? visit(file) : [file];
+  });
+
+const sourceRoot = path.join(root, 'src');
+const sourceFiles = visit(sourceRoot).filter(
+  (file) => /\.[jt]sx?$/.test(file) && !file.endsWith('.d.ts'),
+);
+const missingOutputs = [];
+
+for (const sourceFile of sourceFiles) {
+  const relative = path
+    .relative(sourceRoot, sourceFile)
+    .replace(/\.[jt]sx?$/, '');
+  for (const outputDirectory of ['es', 'lib']) {
+    for (const extension of ['.js', '.d.ts']) {
+      const outputFile = path.join(
+        root,
+        outputDirectory,
+        `${relative}${extension}`,
+      );
+      if (!fs.existsSync(outputFile)) {
+        missingOutputs.push(path.relative(root, outputFile));
+      }
+    }
+  }
+}
+
+if (missingOutputs.length > 0) {
+  fail(`Missing build outputs:\n${missingOutputs.join('\n')}`);
+}
+
+const packageJson = JSON.parse(
+  fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
+);
+if (!packageJson.sideEffects?.includes('**/initDayjs.*')) {
+  fail('package.json must preserve the Day.js plugin initialization module.');
+}
+for (const field of ['main', 'module', 'types', 'unpkg']) {
+  const outputFile = path.join(root, packageJson[field]);
+  if (!fs.existsSync(outputFile)) {
+    fail(
+      `package.json#${field} points to a missing file: ${packageJson[field]}`,
+    );
+  }
+}
+
+const esmEntry = fs.readFileSync(path.join(root, packageJson.module), 'utf8');
+if (!esmEntry.includes('export * from "./card/index.js"')) {
+  fail('ESM entry does not preserve module exports with explicit extensions.');
+}
+
+const cjsEntry = fs.readFileSync(path.join(root, packageJson.main), 'utf8');
+if (!cjsEntry.includes('require("./card/index.js")')) {
+  fail(
+    'CommonJS entry does not preserve module exports with explicit extensions.',
+  );
+}
+
+const umdEntry = fs.readFileSync(path.join(root, packageJson.unpkg), 'utf8');
+for (const dependency of ['react', 'react-dom', 'antd', 'dayjs']) {
+  if (!umdEntry.includes(`require("${dependency}")`)) {
+    fail(
+      `UMD entry does not externalize ${dependency} for CommonJS consumers.`,
+    );
+  }
+}
+
+for (const entry of [packageJson.main, packageJson.unpkg]) {
+  const exports = require(path.join(root, entry));
+  if (
+    typeof exports.ProTable !== 'function' ||
+    typeof exports.ProForm !== 'function'
+  ) {
+    fail(`${entry} does not expose the expected public components.`);
+  }
+}
+
+const browserContext = {
+  React: require('react'),
+  ReactDOM: require('react-dom'),
+  antd: require('antd'),
+  dayjs: require('dayjs'),
+};
+browserContext.globalThis = browserContext;
+vm.runInNewContext(umdEntry, browserContext);
+if (
+  typeof browserContext.ProComponents?.ProTable !== 'function' ||
+  typeof browserContext.ProComponents?.ProForm !== 'function'
+) {
+  fail('UMD browser globals do not expose the expected public components.');
+}
+
+console.log(
+  `Build outputs verified: ${sourceFiles.length} source modules and package entry points.`,
+);
```

**File**: `tsconfig.build.json` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+{
+  "extends": "./tsconfig.json",
+  "compilerOptions": {
+    "rootDir": "./src",
+    "types": ["node"]
+  },
+  "include": ["src/**/*.ts", "src/**/*.tsx"],
+  "exclude": ["**/*.test.ts", "**/*.test.tsx"]
+}
```

---

### Incident Patch 10: `a3b7e781` (2026-10-03)
**Commit Message**: build: migrate lint and type checks to native toolchain (#9734)

**File**: `.eslintrc.cjs` (removed, +0/-330)
```diff
@@ -1,330 +0,0 @@
-module.exports = {
-  extends: [
-    'eslint:recommended',
-    'plugin:react/recommended',
-    'plugin:react-hooks/recommended',
-    'plugin:@typescript-eslint/recommended',
-  ],
-  parser: '@typescript-eslint/parser',
-  parserOptions: {
-    ecmaVersion: 2020,
-    sourceType: 'module',
-    ecmaFeatures: {
-      jsx: true,
-    },
-    project: './tsconfig.json',
-  },
-  ignorePatterns: [
-    '**/node_modules/**',
-    '**/dist/**',
-    '**/lib/**',
-    '**/es/**',
-    '**/coverage/**',
-    '**/.vscode/**',
-    '**/.umi/**',
-    '**/.github/**',
-    '**/scripts/**',
-    '**/server/**',
-    '**/*.md',
-    '**/*.json',
-    'typings.d.ts',
-    '.eslintrc.cjs',
-    'webpack.config.js',
-    'site-dumi-plugin.ts',
-  ],
-  plugins: ['react', 'react-hooks', '@typescript-eslint'],
-  settings: {
-    react: {
-      version: 'detect',
-    },
-  },
-  rules: {
-    'no-unescaped-entities': 'off', // Disable unescaped entities
-    'react/no-unescaped-entities': 'off', // Disable unescaped entities
-    'no-console': 'off', // Allow console statements
-    'react/react-in-jsx-scope': 'off', // Not needed in React 17+
-    'react/prop-types': 'off', // Not needed with TypeScript
-    'react/display-name': 'off', // Disable display name requirement
-    'react-hooks/exhaustive-deps': 'off',
-    'no-unsafe-optional-chaining': 'off', // Disable unsafe optional chaining
-    'no-empty': 'off', // Disable empty block statement
-    'no-useless-escape': 'off', // Disable useless escape
-    'no-prototype-builtins': 'off', // Disable prototype builtins
-    // TypeScript specific rules - make them less strict
-    '@typescript-eslint/no-unused-vars': [
-      'warn',
-      {
-        argsIgnorePattern: '^_',
-        varsIgnorePattern: '^_',
-        caughtErrorsIgnorePattern: '^_',
-      },
-    ],
-    '@typescript-eslint/no-explicit-any': 'off',
-    '@typescript-eslint/ban-types': 'off', // Disable ban-types
-    '@typescript-eslint/no-use-before-define': 'warn',
-    '@typescript-eslint/dot-notation': 'warn',
-    '@typescript-eslint/ban-ts-comment': 'off', // Allow @ts-ignore but warn
-    '@typescript-eslint/no-empty-object-type': 'off', // Disable empty object type
-    '@typescript-eslint/no-unsafe-function-type': 'off', // Disable unsafe function type
-    // Disable all formatting rules that conflict with Prettier
-    indent: 'off',
-    quotes: 'off',
-    semi: 'off',
-    'comma-dangle': 'off',
-    'comma-spacing': 'off',
-    'comma-style': 'off',
-    'computed-property-spacing': 'off',
-    'func-call-spacing': 'off',
-    'key-spacing': 'off',
-    'keyword-spacing': 'off',
-    'linebreak-style': 'off',
-    'max-len': 'off',
-    'no-mixed-spaces-and-tabs': 'off',
-    'no-multiple-empty-lines': 'off',
-    'no-trailing-spaces': 'off',
-    'object-curly-spacing': 'off',
-    'quote-props': 'off',
-    'space-before-blocks': 'off',
-    'space-before-function-paren': 'off',
-    'space-in-parens': 'off',
-    'space-infix-ops': 'off',
-    'arrow-spacing': 'off',
-    'block-spacing': 'off',
-    'brace-style': 'off',
-    camelcase: 'off',
-    'capitalized-comments': 'off',
-    'consistent-this': 'off',
-    'eol-last': 'off',
-    'func-name-matching': 'off',
-    'func-names': 'off',
-    'func-style': 'off',
-    'no-loss-of-precision': 'off',
-    'id-blacklist': 'off',
-    'id-length': 'off',
-    'id-match': 'off',
-    'jsx-quotes': 'off',
-    'lines-around-comment': 'off',
-    'lines-around-directive': 'off',
-    'max-depth': 'off',
-    'max-lines': 'off',
-    'max-nested-callbacks': 'off',
-    'max-params': 'off',
-    'max-statements': 'off',
-    'max-statements-per-line': 'off',
-    'multiline-ternary': 'off',
-    'new-cap': 'off',
-    'new-parens': 'off',
-    'newline-after-var': 'off',
-    'newline-before-return': 'off',
-    'newline-per-chained-call': 'off',
-    'no-array-constructor': 'off',
-    'no-bitwise': 'off',
-    'no-continue': 'off',
-    'no-inline-comments': 'off',
-    'no-lonely-if': 'off',
-    'no-mixed-operators': 'off',
-    'no-negated-condition': 'off',
-    'no-nested-ternary': 'off',
-    'no-new-object': 'off',
-    'no-plusplus': 'off',
-    'no-restricted-syntax': 'off',
-    'no-ternary': 'off',
-    'no-underscore-dangle': 'off',
-    'no-unneeded-ternary': 'off',
-    'no-var': 'off',
-    'object-shorthand': 'off',
-    'one-var': 'off',
-    'one-var-declaration-per-line': 'off',
-    'operator-assignment': 'off',
-    'operator-linebreak': 'off',
-    'prefer-arrow-callback': 'off',
-    'prefer-const': 'off',
-    'prefer-numeric-literals': 'off',
-    'prefer-reflect': 'off',
-    'prefer-rest-params': 'off',
-    'prefer-spread': 'off',
-    'no-unexpected-multiline': 'off',
-    'prefer-template': 'off',
-    'require-jsdoc': 'off',
-    'sort-imports': 'off',
-    'sort-keys': 'off',
-    'sort-vars': 'off',
-    'wrap-regex': 'off',
-    // React specific formatting rules
-    'react/jsx
```

**File**: `.oxlintrc.json` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+{
+  "$schema": "./node_modules/oxlint/configuration_schema.json",
+  "plugins": ["react", "typescript"],
+  "env": {
+    "browser": true,
+    "es6": true,
+    "node": true
+  },
+  "ignorePatterns": [
+    "**/node_modules/**",
+    "**/dist/**",
+    "**/lib/**",
+    "**/es/**",
+    "**/coverage/**",
+    "**/.vscode/**",
+    "**/.umi/**",
+    "**/.github/**",
+    "**/scripts/**",
+    "**/server/**",
+    "**/*.md",
+    "**/*.json",
+    "typings.d.ts",
+    "webpack.config.js",
+    "site-dumi-plugin.ts"
+  ],
+  "rules": {
+    "no-console": "off",
+    "no-empty": "off",
+    "no-loss-of-precision": "off",
+    "no-prototype-builtins": "off",
+    "no-unescaped-entities": "off",
+    "no-unsafe-optional-chaining": "off",
+    "no-useless-escape": "off",
+    "react/display-name": "off",
+    "react/globals": "off",
+    "react/immutability": "off",
+    "react/no-unescaped-entities": "off",
+    "react/preserve-manual-memoization": "off",
+    "react/react-in-jsx-scope": "off",
+    "react/refs": "off",
+    "react/set-state-in-effect": "off",
+    "react/use-memo": "off",
+    "react-hooks/exhaustive-deps": "off",
+    "typescript/ban-ts-comment": "off",
+    "typescript/dot-notation": "warn",
+    "typescript/no-empty-object-type": "off",
+    "typescript/no-explicit-any": "off",
+    "typescript/no-unsafe-function-type": "off",
+    "no-unreachable": "off",
+    "no-use-before-define": "warn",
+    "no-unused-vars": [
+      "warn",
+      {
+        "argsIgnorePattern": "^_",
+        "caughtErrorsIgnorePattern": "^_",
+        "varsIgnorePattern": "^_"
+      }
+    ]
+  },
+  "overrides": [
+    {
+      "files": ["tests/**/*.ts", "tests/**/*.tsx"],
+      "rules": {
+        "no-unused-vars": "off"
+      }
+    }
+  ]
+}
```

**File**: `demos/form/group/customize.tsx` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-﻿/* eslint-disable no-param-reassign */ import {
+﻿/* oxlint-disable no-param-reassign */ import {
   CopyOutlined,
   DeleteOutlined,
   HeartOutlined,
```

**File**: `demos/layout/error-boundaries.tsx` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ class CustomBoundary extends React.Component<
 
   componentDidCatch(error: any, errorInfo: ErrorInfo) {
     // You can also log the error to an error reporting service
-    // eslint-disable-next-line no-console
+    // oxlint-disable-next-line no-console
     console.error(error, errorInfo);
   }
 
```

**File**: `demos/table/error-boundaries.tsx` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ class CustomBoundary extends React.Component<
 
   componentDidCatch(error: any, errorInfo: ErrorInfo) {
     // You can also log the error to an error reporting service
-    // eslint-disable-next-line no-console
+    // oxlint-disable-next-line no-console
     console.error(error, errorInfo);
   }
 
```

**File**: `demos/table/linkage-form.tsx` (modified, +2/-2)
```diff
@@ -1,4 +1,4 @@
-/* eslint-disable no-console */ import { PlusOutlined } from '@ant-design/icons';
+/* oxlint-disable no-console */ import { PlusOutlined } from '@ant-design/icons';
 import type { ProColumns } from '@ant-design/pro-components';
 import { ProTable } from '@ant-design/pro-components';
 import { Button, Input, Select } from 'antd';
@@ -39,7 +39,7 @@ const MySelect: React.FC<{
         { label: '二月', value: 2 },
       ]);
     }
-    // eslint-disable-next-line react-hooks/exhaustive-deps
+    // oxlint-disable-next-line react-hooks/exhaustive-deps
   }, [JSON.stringify(state)]);
 
   return (
```

**File**: `docs/internal/oxlint-typescript-7-migration.md` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+# Oxlint and native TypeScript toolchain
+
+The repository uses native tooling for linting and project type checks:
+
+- `oxlint` replaces ESLint and its React, React Hooks, TypeScript, and Unicorn
+  plugin packages.
+- `@typescript/native` aliases the stable Go based TypeScript 7 package and
+  provides its `tsc` executable.
+
+## Commands
+
+```powershell
+pnpm run lint
+pnpm run lint:check
+pnpm run lint:fix
+pnpm run typecheck
+pnpm run check:published-types
+```
+
+`pnpm run lint` runs Oxlint followed by the native type checker. CI uses this
+command. `lint:fix` is explicit so CI and read-only checks do not modify the
+working tree.
+
+The `typescript` package name aliases `@typescript/typescript6` for build tools
+that use the JavaScript compiler API, including Father, Dumi, and Prettier's
+organize-imports plugin. Repository type checks and published-type fixture
+checks use TypeScript 7's native `tsc` from the `@typescript/native` alias.
+
+TypeScript 7 removes `baseUrl` and the legacy `node` module resolution mode.
+The root configuration therefore uses `moduleResolution: "bundler"` and
+explicit relative targets in `paths`.
```

**File**: `package.json` (modified, +8/-10)
```diff
@@ -43,7 +43,9 @@
     "docs:create": "pnpm docs create",
     "docs:check": "pnpm docs check",
     "prepublishOnly": "pnpm run check:safety && pnpm run test && pnpm run build && pnpm run check:declarations && pnpm run check:published-types",
-    "lint": "eslint --cache --ext .js,.jsx,.ts,.tsx  --fix ./ && npm run tsc",
+    "lint": "oxlint . && pnpm run typecheck",
+    "lint:check": "oxlint .",
+    "lint:fix": "oxlint --fix .",
     "prettier": "prettier --write \"**/**.{js,jsx,tsx,ts,less,md,yaml,json}\" --log-level warn",
     "createRelease": "node ./scripts/createRelease.mjs",
     "site": "npm run build && cross-env SITE_DEPLOY='TRUE' dumi build",
@@ -52,7 +54,8 @@
     "test:coverage": "cross-env TZ=UTC TEST_LOG=none vitest run --coverage",
     "test:ui": "cross-env TZ=UTC vitest --ui",
     "test:update": "cross-env TZ=UTC  vitest -u",
-    "tsc": "tsc --noEmit",
+    "tsc": "pnpm run typecheck",
+    "typecheck": "tsc --noEmit",
     "publish:beta": "npm publish --tag beta",
     "update:deps": "pnpm up --latest"
   },
@@ -86,7 +89,6 @@
   "devDependencies": {
     "@ant-design/antd-theme-variable": "^1.0.0",
     "@babel/core": "^7.29.7",
-    "@babel/eslint-plugin": "^7.29.7",
     "@babel/parser": "^7.29.9",
     "@babel/plugin-transform-object-rest-spread": "^7.29.7",
     "@babel/preset-env": "^7.29.7",
@@ -105,8 +107,7 @@
     "@types/react-helmet": "^6.1.11",
     "@types/shallowequal": "^1.1.5",
     "@types/warning": "^3.0.4",
-    "@typescript-eslint/eslint-plugin": "^8.70.1",
-    "@typescript-eslint/parser": "^8.70.1",
+    "@typescript/native": "npm:typescript@7.0.2",
     "@umijs/babel-preset-umi": "^3.5.43",
     "@umijs/doctor": "^1.2.1",
     "@umijs/plugin-analytics": "^0.2.4",
@@ -125,10 +126,6 @@
     "dumi": "^2.4.50",
     "dumi-theme-antd-style": "^0.31.1",
     "esbuild": "^0.28.2",
-    "eslint": "^8.57.1",
-    "eslint-plugin-react": "^7.37.5",
-    "eslint-plugin-react-hooks": "^4.6.2",
-    "eslint-plugin-unicorn": "^47.0.0",
     "execa": "^10.0.1",
     "express": "^5.2.1",
     "fast-deep-equal": "^3.1.3",
@@ -143,6 +140,7 @@
     "nprogress": "^0.2.0",
     "nwsapi": "2.2.24",
     "octokit": "^5.0.5",
+    "oxlint": "1.86.0",
     "playwright": "^1.63.0",
     "polished": "^4.3.1",
     "prettier": "^3.9.9",
@@ -163,7 +161,7 @@
     "timezone-mock": "^1.4.3",
     "ts-node": "^10.9.2",
     "tsx": "^4.23.15",
-    "typescript": "^5.9.3",
+    "typescript": "npm:@typescript/typescript6@6.0.2",
     "umi": "^4.7.20",
     "umi-request": "^1.4.0",
     "unified": "^11.0.5",
```

---

### Incident Patch 11: `b7f0c5a3` (2026-10-03)
**Commit Message**: docs: add issue regression demos and coverage matrix (#9733)

**File**: `demos/field/issue-regression-gallery.tsx` (added, +103/-0)
```diff
@@ -0,0 +1,103 @@
+import {
+  ProCard,
+  ProForm,
+  ProFormDigit,
+  ProFormSelect,
+  ProFormTreeSelect,
+} from '@ant-design/pro-components';
+import { Alert, Space, Typography } from 'antd';
+import { useState } from 'react';
+
+const remoteOptions = ['Alpha', 'Beta', 'Gamma', 'Delta'];
+
+export default () => {
+  const [lastSearch, setLastSearch] = useState('（尚未搜索）');
+  const [treeOpen, setTreeOpen] = useState(false);
+
+  return (
+    <ProCard direction="column" ghost gutter={[0, 16]}>
+      <Alert
+        type="info"
+        showIcon
+        message="字段回归场景"
+        description="覆盖对象形式 showSearch、受控 TreeSelect、只读空值、数字前后缀及混合 valueEnum。"
+      />
+      <ProCard title="SearchSelect 回调与远程请求（#9711）">
+        <Space direction="vertical" style={{ width: '100%' }}>
+          <Typography.Text type="secondary">
+            输入关键字时，自定义 onSearch 与 request 会同时收到关键字。
+          </Typography.Text>
+          <ProForm submitter={false}>
+            <ProFormSelect.SearchSelect
+              name="keyword"
+              label="远程搜索"
+              debounceTime={100}
+              request={async ({ keyWords }) => {
+                const keyword = keyWords ?? '';
+                return remoteOptions
+                  .filter((item) =>
+                    item.toLowerCase().includes(keyword.toLowerCase()),
+                  )
+                  .map((item) => ({ label: item, value: item }));
+              }}
+              fieldProps={{
+                showSearch: {
+                  onSearch: (value) => setLastSearch(value || '（空）'),
+                },
+              }}
+            />
+          </ProForm>
+          <Typography.Text code>onSearch: {lastSearch}</Typography.Text>
+        </Space>
+      </ProCard>
+      <ProCard title="字段数据流与只读展示（B7–B10）">
+        <ProForm
+          submitter={false}
+          initialValues={{ amount: 128, status: 0, category: 'frontend' }}
+          layout="horizontal"
+        >
+          <ProFormDigit
+            name="amount"
+            label="带前后缀数字"
+            fieldProps={{ prefix: '¥', addonAfter: '元' }}
+          />
+          <ProFormSelect
+            name="status"
+            label="混合值 valueEnum"
+            valueEnum={
+              new Map<string | number, React.ReactNode>([
+                [0, '未开始'],
+                ['1', '进行中'],
+                [2, '已完成'],
+              ])
+            }
+          />
+          <ProFormTreeSelect
+            name="category"
+            label="受控 TreeSelect"
+            fieldProps={{
+              open: treeOpen,
+              onOpenChange: setTreeOpen,
+              treeData: [
+                {
+                  title: '研发',
+                  value: 'development',
+                  children: [
+                    { title: '前端', value: 'frontend' },
+                    { title: '后端', value: 'backend' },
+                  ],
+                },
+              ],
+            }}
+          />
+          <ProFormDigit
+            label="只读空值"
+            name="empty"
+            readonly
+            fieldProps={{ addonAfter: '次' }}
+          />
+        </ProForm>
+      </ProCard>
+    </ProCard>
+  );
+};
```

**File**: `demos/form/issue-regression-gallery.tsx` (added, +152/-0)
```diff
@@ -0,0 +1,152 @@
+import type { ProFormInstance } from '@ant-design/pro-components';
+import {
+  BetaSchemaForm,
+  ModalForm,
+  ProCard,
+  ProForm,
+  ProFormList,
+  ProFormText,
+} from '@ant-design/pro-components';
+import { Alert, Button, Space, Tabs, Typography, message } from 'antd';
+import { useRef, useState } from 'react';
+
+const toList = (value: Record<string, string>) =>
+  Object.entries(value).map(([key, itemValue]) => ({
+    key,
+    value: itemValue,
+  }));
+
+const ListConvertValue = () => {
+  const formRef = useRef<ProFormInstance>();
+  return (
+    <ProForm
+      formRef={formRef}
+      submitter={false}
+      initialValues={{ configs: { first: 'one', second: 'two' } }}
+    >
+      <Space style={{ marginBlockEnd: 16 }}>
+        <Button
+          onClick={() =>
+            formRef.current?.setFieldsValue({ configs: { third: 'three' } })
+          }
+        >
+          setFieldsValue 写入对象
+        </Button>
+        <Typography.Text type="secondary">
+          对象会在初始值及外部写入时转换为列表。
+        </Typography.Text>
+      </Space>
+      <ProFormList name="configs" convertValue={toList}>
+        <ProFormText name="key" label="Key" />
+        <ProFormText name="value" label="Value" />
+      </ProFormList>
+    </ProForm>
+  );
+};
+
+const RequestReuse = () => {
+  const [id, setId] = useState(0);
+  return (
+    <Space direction="vertical" style={{ width: '100%' }}>
+      <Space>
+        {[0, 1, 0].map((value, index) => (
+          <Button key={`${value}-${index}`} onClick={() => setId(value)}>
+            参数 {value}
+          </Button>
+        ))}
+      </Space>
+      <ProForm
+        key="request-reuse-form"
+        params={{ id }}
+        request={async ({ id: requestId }) => ({
+          name: `服务端返回：参数 ${requestId}（${new Date().toLocaleTimeString()}）`,
+        })}
+        submitter={false}
+      >
+        <ProFormText name="name" label="请求结果" width="lg" />
+      </ProForm>
+    </Space>
+  );
+};
+
+const OverlayInitialization = () => {
+  const [open, setOpen] = useState(false);
+  const [record, setRecord] = useState({ name: 'Alice' });
+  return (
+    <Space>
+      {['Alice', 'Bob'].map((name) => (
+        <Button
+          key={name}
+          onClick={() => {
+            setRecord({ name });
+            setOpen(true);
+          }}
+        >
+          编辑 {name}
+        </Button>
+      ))}
+      <ModalForm
+        open={open}
+        onOpenChange={setOpen}
+        initialValues={record}
+        request={async () => record}
+        title="受控弹窗初始化"
+        onFinish={async ({ name }) => {
+          message.success(`已保存 ${name}`);
+          return true;
+        }}
+      >
+        <ProFormText name="name" label="姓名" />
+      </ModalForm>
+    </Space>
+  );
+};
+
+export default () => (
+  <ProCard direction="column" ghost gutter={[0, 16]}>
+    <Alert
+      type="info"
+      showIcon
+      message="表单初始化与转换回归场景"
+      description="覆盖弹层初始化、ProFormList convertValue、SchemaForm 独立宽度及重复参数请求。"
+    />
+    <ProCard>
+      <Tabs
+        items={[
+          {
+            key: 'overlay',
+            label: '弹层初始化',
+            children: <OverlayInitialization />,
+          },
+          {
+            key: 'list',
+            label: '列表转换 #8702',
+            children: <ListConvertValue />,
+          },
+          {
+            key: 'schema',
+            label: 'SchemaForm 宽度 #9061',
+            children: (
+              <BetaSchemaForm
+                submitter={false}
+                columns={[
+                  {
+                    title: '表格列宽 80，表单宽度 328',
+                    dataIndex: 'title',
+                    width: 80,
+                    formWidth: 328,
+                  },
+                ]}
+              />
+            ),
+          },
+          {
+            key: 'request',
+            label: '重复参数请求 #8375',
+            children: <RequestReuse />,
+          },
+        ]}
+      />
+    </ProCard>
+  </ProCard>
+);
```

**File**: `demos/layout/issue-regression-gallery.tsx` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+import {
+  CheckCard,
+  PageContainer,
+  ProCard,
+  ProConfigProvider,
+  ProLayout,
+} from '@ant-design/pro-components';
+import { Alert, ConfigProvider, Segmented, Space } from 'antd';
+import { useState } from 'react';
+
+const routes = [
+  {
+    path: '/dashboard',
+    name: 'Dashboard',
+    children: [
+      { path: '/dashboard/analysis', name: 'Analysis' },
+      { path: '/dashboard/monitor', name: 'Monitor' },
+    ],
+  },
+  { path: '/settings', name: 'Settings' },
+];
+
+export default () => {
+  const [navTheme, setNavTheme] = useState<'light' | 'realDark'>('light');
+
+  return (
+    <Space direction="vertical" size={16} style={{ width: '100%' }}>
+      <Alert
+        type="info"
+        showIcon
+        message="布局与主题 token 回归场景"
+        description="切换导航主题并悬停 Dashboard，检查深色菜单、弹层背景和 Card token。缩窄窗口可验证移动抽屉。"
+      />
+      <Segmented
+        value={navTheme}
+        options={[
+          { label: '浅色导航', value: 'light' },
+          { label: '真实深色', value: 'realDark' },
+        ]}
+        onChange={(value) => setNavTheme(value as 'light' | 'realDark')}
+      />
+      <ConfigProvider theme={{ components: { Card: { headerFontSize: 22 } } }}>
+        <ProConfigProvider
+          token={{
+            colorPrimary: '#722ed1',
+            components: { Card: { headerBg: '#f9f0ff' } },
+            layout: {
+              header: { colorBgMenuElevated: '#141414' },
+            },
+          }}
+        >
+          <ProCard title="ProConfigProvider Card token">
+            <CheckCard title="CheckCard 继承主题" description="#8929 #9125" />
+          </ProCard>
+          <div style={{ height: 480, marginBlockStart: 16 }}>
+            <ProLayout
+              title="Regression Demo"
+              layout="top"
+              navTheme={navTheme}
+              route={{ routes }}
+              location={{ pathname: '/dashboard/analysis' }}
+              menu={{ request: async () => routes }}
+            >
+              <PageContainer title="首屏布局稳定">
+                移动端抽屉、菜单分组、SSR 与首屏 padding 由对应自动化测试覆盖。
+              </PageContainer>
+            </ProLayout>
+          </div>
+        </ProConfigProvider>
+      </ConfigProvider>
+    </Space>
+  );
+};
```

**File**: `demos/list/issue-regression-gallery.tsx` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+import type { ActionType, ProColumns } from '@ant-design/pro-components';
+import { ProCard, ProList } from '@ant-design/pro-components';
+import { Alert, Button, Space, Typography } from 'antd';
+import { useRef, useState } from 'react';
+
+type Item = { id: number; title: string; description: string };
+
+const columns: ProColumns<Item>[] = [
+  { dataIndex: 'title', title: '标题', listSlot: 'title' },
+  { dataIndex: 'description', title: '说明', listSlot: 'description' },
+  {
+    title: '操作',
+    listSlot: 'actions',
+    render: () => [<a key="edit">编辑</a>],
+  },
+];
+
+export default () => {
+  const actionRef = useRef<ActionType>();
+  const [pageInfo, setPageInfo] = useState('等待请求完成');
+
+  return (
+    <ProCard direction="column" ghost gutter={[0, 16]}>
+      <Alert
+        type="info"
+        showIcon
+        message="ProList 展示与实时分页状态"
+        description="覆盖操作区 hover、grid itemRender gutter 及 actionRef.pageInfo。"
+      />
+      <ProList<Item>
+        actionRef={actionRef}
+        rowKey="id"
+        columns={columns}
+        showActions="hover"
+        grid={{ column: 2, gutter: [16, 24] }}
+        pagination={{ pageSize: 2 }}
+        request={async () => ({
+          success: true,
+          total: 42,
+          data: [
+            { id: 1, title: '项目 A', description: '悬停显示操作区' },
+            { id: 2, title: '项目 B', description: '卡片间距保持一致' },
+          ],
+        })}
+        itemRender={(item, index, defaultDom) => (
+          <ProCard title={`自定义 itemRender ${index + 1}`}>
+            {defaultDom}
+          </ProCard>
+        )}
+        toolBarRender={() => [
+          <Space key="page-info">
+            <Button
+              onClick={() =>
+                setPageInfo(JSON.stringify(actionRef.current?.pageInfo))
+              }
+            >
+              读取 pageInfo
+            </Button>
+            <Typography.Text code>{pageInfo}</Typography.Text>
+          </Space>,
+        ]}
+      />
+    </ProCard>
+  );
+};
```

**File**: `demos/table/issue-regression-gallery.tsx` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
+import type {
+  ActionType,
+  EditableFormInstance,
+} from '@ant-design/pro-components';
+import {
+  EditableProTable,
+  ProCard,
+  ProTable,
+} from '@ant-design/pro-components';
+import { Alert, Button, Space, Tabs, Typography, message } from 'antd';
+import { useRef, useState } from 'react';
+
+type Row = {
+  id: number;
+  name: string;
+  status?: 'active' | 'closed';
+  sort?: number;
+};
+
+const rows: Row[] = [
+  { id: 1, name: 'Alpha', status: 'active' },
+  { id: 2, name: 'Beta', status: 'closed' },
+  { id: 3, name: 'Gamma', status: 'active' },
+];
+
+const CursorPagination = () => (
+  <ProTable<Row>
+    rowKey="id"
+    search={false}
+    options={false}
+    columns={[
+      { title: 'ID', dataIndex: 'id' },
+      { title: '名称', dataIndex: 'name' },
+    ]}
+    pagination={{ type: 'cursor', pageSize: 1 }}
+    request={async ({ nextToken }) => {
+      const index = Number(nextToken ?? 0);
+      return {
+        success: true,
+        data: rows.slice(index, index + 1),
+        nextToken: index + 1 < rows.length ? String(index + 1) : undefined,
+      };
+    }}
+  />
+);
+
+const SortFilterState = () => {
+  const actionRef = useRef<ActionType>();
+  const [snapshot, setSnapshot] = useState('点击按钮读取');
+  return (
+    <ProTable<Row>
+      actionRef={actionRef}
+      rowKey="id"
+      search={false}
+      pagination={false}
+      dataSource={rows}
+      columns={[
+        { title: '名称', dataIndex: 'name', sorter: true },
+        {
+          title: '状态',
+          dataIndex: 'status',
+          filters: true,
+          valueEnum: { active: '启用', closed: '关闭' },
+        },
+      ]}
+      toolBarRender={() => [
+        <Space key="state">
+          <Button
+            onClick={() =>
+              setSnapshot(
+                JSON.stringify(actionRef.current?.getSortFilter?.() ?? {}),
+              )
+            }
+          >
+            读取排序和筛选
+          </Button>
+          <Typography.Text code>{snapshot}</Typography.Text>
+        </Space>,
+      ]}
+    />
+  );
+};
+
+const EditableDragSort = () => {
+  const [dataSource, setDataSource] = useState<Row[]>(rows);
+  return (
+    <EditableProTable<Row>
+      rowKey="id"
+      value={dataSource}
+      onChange={(value) => setDataSource([...value])}
+      columns={[
+        { title: '排序', dataIndex: 'sort', width: 64 },
+        {
+          title: '名称',
+          dataIndex: 'name',
+          formItemProps: {
+            rules: [{ required: true, message: '请填写名称' }],
+          },
+          errorType: 'default',
+        },
+      ]}
+      recordCreatorProps={false}
+      dragSortKey="sort"
+      editable={{ type: 'multiple', editableKeys: [1] }}
+      onDragSortEnd={(_, __, nextDataSource) => {
+        setDataSource(nextDataSource);
+        message.success('顺序已更新，编辑行保持编辑状态');
+      }}
+    />
+  );
+};
+
+const InlineValidation = () => {
+  const editableFormRef = useRef<EditableFormInstance<Row>>();
+  return (
+    <Space direction="vertical" style={{ width: '100%' }}>
+      <Button
+        onClick={() => {
+          editableFormRef.current?.validateFields().catch(() => undefined);
+        }}
+      >
+        验证并显示行内错误
+      </Button>
+      <EditableProTable<Row>
+        editableFormRef={editableFormRef}
+        rowKey="id"
+        value={[{ id: 1, name: '' }]}
+        recordCreatorProps={false}
+        columns={[
+          {
+            title: '名称',
+            dataIndex: 'name',
+            errorType: 'default',
+            formItemProps: {
+              rules: [{ required: true, message: '请填写名称' }],
+            },
+          },
+        ]}
+        editable={{ type: 'multiple', editableKeys: [1] }}
+      />
+    </Space>
+  );
+};
+
+export default () => (
+  <ProCard direction="column" ghost gutter={[0, 16]}>
+    <Alert
+      type="info"
+      showIcon
+      message="表格稳定性与新增能力"
+      description="覆盖游标分页、排序筛选状态、可编辑行拖拽和行内校验错误。"
+    />
+    <ProCard>
+      <Tabs
+        destroyOnHidden
+        items={[
+          {
+            key: 'cursor',
+            label: '游标分页 #9500',
+            children: <CursorPagination />,
+          },
+          {
+            key: 'state',
+            label: '排序筛选 #9197',
+            children: <SortFilterState />,
+          },
+          {
+            key: 'drag',
+            label: '编辑拖拽 #9046',
+            children: <EditableDragSort />,
+          },
+          {
+            key: 'error',
+            label: '行内错误 #8786',
+            children: <InlineValidation />,
+          },
+        ]}
+      />
+    </ProCard>
+  </ProCard>
+);
```

**File**: `docs/issue-regression-test-demo-matrix-2026-10-03.md` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+# Issue regression test and demo matrix (2026-10-03)
+
+This matrix is the acceptance checklist for the issue cleanup merged in PRs
+#9711 through #9732. PR #9710 was closed without merge; its reproductions were
+split into the focused PRs listed below.
+
+Every fixed issue has an automated regression test and a runnable demo or
+minimal executable example. A row can cover several issues when they share the
+same root cause. Documentation-only and bundle-size work use a checked code
+example or benchmark as the executable example.
+
+| PR    | Covered issues                                                                                                                                                                | Automated regression                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Runnable demo / minimal example                                                                                          |
+| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
+| #9711 | SearchSelect object `showSearch` callback pipeline                                                                                                                            | `tests/form/searchSelectObject.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `demos/field/issue-regression-gallery.tsx`                                                                               |
+| #9712 | #8672, #8712, #8748, #8916, #8976, #9168                                                                                                                                      | `tests/layout/mobile.test.tsx`, `tests/layout/menuStyle.test.ts`, `tests/layout/navThemeDark.test.tsx`, `tests/layout/ssr.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `demos/layout/issue-regression-gallery.tsx`                                                                              |
+| #9713 | #8929, #9125                                                                                                                                                                  | `tests/provider/index.test.tsx`, `tests/card/index.test.tsx`, `tests/card/checkcard.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                       
```

**File**: `site/components/field.en-US.md` (modified, +4/-0)
```diff
@@ -11,6 +11,10 @@ It is an atomic information component that standardizes field definitions across
 
 ## DEMO
 
+### Issue regression scenarios
+
+<code src="../../demos/field/issue-regression-gallery.tsx" title="Search, data flow, and read-only rendering"></code>
+
 <code src="../../demos/field/base.tsx" ></code>
 
 <code src="../../demos/field/_base-test.tsx" debug></code>
```

**File**: `site/components/field.md` (modified, +4/-0)
```diff
@@ -11,6 +11,10 @@ title: ProField 原子组件
 
 ## DEMO
 
+### Issue 回归场景
+
+<code src="../../demos/field/issue-regression-gallery.tsx" title="搜索、数据流与只读展示"></code>
+
 <code src="../../demos/field/base.tsx" ></code>
 
 <code src="../../demos/field/_base-test.tsx" debug></code>
```

---

### Incident Patch 12: `c9629f79` (2026-10-03)
**Commit Message**: fix: refresh form request data for reused params (#9727)

* fix: refresh form request data for reused params (#8375)

* test: cover default fetch deduplication

**File**: `src/form/BaseForm/BaseForm.tsx` (modified, +4/-0)
```diff
@@ -587,6 +587,10 @@ export function BaseForm<T = Record<string, any>, U = Record<string, any>>(
     request,
     params,
     proFieldKey: formKey,
+    // Request values are the source of truth for the active params. Returning
+    // to a recently used params value must revalidate instead of restoring a
+    // stale form snapshot from SWR's deduplication window (#8375).
+    dedupingInterval: 0,
   });
 
   const { getPrefixCls } = useContext(ConfigProvider.ConfigContext);
```

**File**: `src/utils/hooks/useFetchData/index.tsx` (modified, +2/-0)
```diff
@@ -12,6 +12,7 @@ export function useFetchData<T, U = Record<string, any>>(props: {
   proFieldKey?: React.Key;
   params?: U;
   request?: ProRequestData<T, U>;
+  dedupingInterval?: number;
 }): [T | undefined, boolean] {
   const abortRef = useRef<AbortController | null>(null);
   /** Key 是用来缓存请求的，如果不在是有问题 */
@@ -46,6 +47,7 @@ export function useFetchData<T, U = Record<string, any>>(props: {
     fetchData,
     {
       revalidateOnFocus: false,
+      dedupingInterval: props.dedupingInterval ?? 2000,
       shouldRetryOnError: false,
       onError: () => {
         // 这里可以添加错误处理逻辑
```

**File**: `tests/form/base.test.tsx` (modified, +25/-0)
```diff
@@ -409,6 +409,31 @@ describe('ProForm', () => {
     wrapper.unmount();
   });
 
+  it('refreshes request values when params return to a cached value (#8375)', async () => {
+    let requestCount = 0;
+    const request = vi.fn(async (params: Record<string, any>) => {
+      requestCount += 1;
+      const id = params.id as number;
+      return { content: `${id}-${requestCount}` };
+    });
+    const renderForm = (id: number) => (
+      <ProForm request={request} params={{ id }}>
+        <ProFormText name="content" />
+      </ProForm>
+    );
+    const wrapper = render(renderForm(0));
+
+    expect(await wrapper.findByDisplayValue('0-1')).toBeTruthy();
+
+    wrapper.rerender(renderForm(1));
+    expect(await wrapper.findByDisplayValue('1-2')).toBeTruthy();
+
+    wrapper.rerender(renderForm(0));
+    expect(await wrapper.findByDisplayValue('0-3')).toBeTruthy();
+    expect(request).toHaveBeenCalledTimes(3);
+    wrapper.unmount();
+  });
+
   it('📦 request rewrite initialsValue', async () => {
     const wrapper = render(
       <ProForm
```

---

### Incident Patch 13: `30ed3f07` (2026-10-02)
**Commit Message**: fix(layout): honor header popup background token (#8637) (#9723)

**File**: `src/layout/components/TopNavHeader/index.tsx` (modified, +14/-4)
```diff
@@ -19,6 +19,16 @@ export type TopNavHeaderProps = SiderMenuProps &
   GlobalHeaderProps &
   PrivateSiderMenuProps;
 
+export const getTopNavMenuPopupBg = (token: {
+  colorBgElevated?: string;
+  layout?: {
+    header?: {
+      colorBgMenuElevated?: string;
+    };
+  };
+}) =>
+  token.layout?.header?.colorBgMenuElevated || token.colorBgElevated;
+
 const TopNavHeader: React.FC<TopNavHeaderProps> = (
   props: TopNavHeaderProps,
 ) => {
@@ -49,6 +59,7 @@ const TopNavHeader: React.FC<TopNavHeaderProps> = (
     renderKey,
   );
   const { token } = useContext(ProProvider);
+  const menuPopupBg = getTopNavMenuPopupBg(token);
 
   const contentDom = useMemo(() => {
     const defaultDom = (
@@ -91,9 +102,9 @@ const TopNavHeader: React.FC<TopNavHeaderProps> = (
               itemSelectedColor:
                 token.layout?.header?.colorTextMenuSelected ||
                 'rgba(0, 0, 0, 1)',
-              popupBg: token?.colorBgElevated,
+              popupBg: menuPopupBg,
               darkSubMenuItemBg: 'transparent',
-              darkPopupBg: token?.colorBgElevated,
+              darkPopupBg: menuPopupBg,
             },
           },
           token: {
@@ -129,13 +140,12 @@ const TopNavHeader: React.FC<TopNavHeaderProps> = (
     token.layout?.header?.colorTextMenu,
     token.layout?.header?.colorTextMenuActive,
     token.layout?.header?.colorTextMenuSelected,
-    token.layout?.header?.colorBgMenuElevated,
     token.borderRadius,
     token?.colorBgTextHover,
     token?.colorTextSecondary,
     token?.colorText,
     token?.colorTextBase,
-    token.colorBgElevated,
+    menuPopupBg,
     dark,
     props,
     prefixCls,
```

**File**: `tests/layout/topNavHeader.test.ts` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+import { describe, expect, it } from 'vitest';
+import { getTopNavMenuPopupBg } from '../../src/layout/components/TopNavHeader';
+
+describe('TopNavHeader', () => {
+  it('uses the header popup token for submenu backgrounds (#8637)', () => {
+    expect(
+      getTopNavMenuPopupBg({
+        colorBgElevated: '#ffffff',
+        layout: {
+          header: {
+            colorBgMenuElevated: '#001529',
+          },
+        },
+      }),
+    ).toBe('#001529');
+  });
+
+  it('falls back to the global elevated background', () => {
+    expect(
+      getTopNavMenuPopupBg({
+        colorBgElevated: '#ffffff',
+      }),
+    ).toBe('#ffffff');
+  });
+});
```

---

### Incident Patch 14: `b7308796` (2026-10-02)
**Commit Message**: fix(form,table): resolve B20 regressions and localization (#9722)

* fix(form,table): Embed form callbacks (#8727), captcha i18n (#8899), density dropdown width (#9619) + B20 regression locks

- BetaSchemaForm Embed: render Form container when standalone (submitter=false),
  keep children passthrough when nested inside a Form (#8727)
- ProFormCaptcha: default text via intl captcha.getCaptcha/retryAfter,
  all 34 locales extended (#8899)
- DensityIcon: remove fixed 80px dropdown width for multilingual labels (#9619)
- docs: onCell merge-cells demo + API rows (zh/en) (#8701)
- regression locks: EXPAND_COLUMN position (#8913), ProTable in Tabs (#8747),
  valueEnum+ellipsis (#8694), layoutType switch (#8850), mix+split+sub (#9310)
- changelog 3.1.15-9 updated, todo.md B20 checked off

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* test: remove unused embed test imports

* test: tighten table regression assertions

---------

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `demos/table/colspan-rowspan.tsx` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+import type { ProColumns } from '@ant-design/pro-components';
+import { ProTable } from '@ant-design/pro-components';
+import React from 'react';
+
+interface TableColumn {
+  key: React.Key;
+  name: string;
+  age: number;
+  address: string;
+  tags: string[];
+}
+
+const dataSource: TableColumn[] = [
+  {
+    key: '1',
+    name: '胡彦祖',
+    age: 42,
+    address: '西湖区湖底公园 1 号',
+    tags: ['前端', '资深'],
+  },
+  {
+    key: '2',
+    name: '李大钊',
+    age: 32,
+    address: '西湖区湖底公园 1 号',
+    tags: ['前端', '资深'],
+  },
+  {
+    key: '3',
+    name: '王五',
+    age: 32,
+    address: '西湖区湖底公园 2 号',
+    tags: ['后端'],
+  },
+];
+
+const columns: ProColumns<TableColumn>[] = [
+  {
+    title: '姓名',
+    dataIndex: 'name',
+    key: 'name',
+  },
+  {
+    title: '年龄',
+    dataIndex: 'age',
+    key: 'age',
+    // 合并单元格：返回 colSpan/rowSpan，为 0 时该单元格不渲染
+    onCell: (_, index = 0) => {
+      // 第一行年龄向下合并一格
+      if (index === 0) return { rowSpan: 2 };
+      if (index === 1) return { rowSpan: 0 };
+      return {};
+    },
+  },
+  {
+    title: '地址',
+    dataIndex: 'address',
+    key: 'address',
+    onCell: (_, index = 0) => {
+      // 地址列整体合并为一列
+      if (index === 0) return { rowSpan: 3 };
+      return { rowSpan: 0 };
+    },
+  },
+  {
+    title: '标签',
+    dataIndex: 'tags',
+    key: 'tags',
+    render: (_, record) => record.tags.join(' / '),
+  },
+];
+
+export default () => (
+  <ProTable<TableColumn>
+    columns={columns}
+    dataSource={dataSource}
+    rowKey="key"
+    search={false}
+    options={false}
+    pagination={false}
+  />
+);
```

**File**: `site/changelog.en-US.md` (modified, +12/-0)
```diff
@@ -4,6 +4,18 @@
 
 ### 🐛 Bug Fixes
 
+- BetaSchemaForm
+  - 🐞 Fix form callbacks such as `onValuesChange` and `onFinish` when standalone `layoutType="Embed"` is used, while preserving passthrough inside an existing Form [#8727](https://github.com/ant-design/pro-components/issues/8727)
+  - ✅ Lock the layout switching regression from Form to LightFilter [#8850](https://github.com/ant-design/pro-components/issues/8850)
+- ProFormCaptcha
+  - 🐞 Localize the default captcha and countdown text across all bundled locales [#8899](https://github.com/ant-design/pro-components/issues/8899)
+- ProTable
+  - 🐞 Preserve the explicit `Table.EXPAND_COLUMN` position, and lock Tabs width/ellipsis and formatted valueEnum ellipsis regressions [#8913](https://github.com/ant-design/pro-components/issues/8913) [#8747](https://github.com/ant-design/pro-components/issues/8747) [#8694](https://github.com/ant-design/pro-components/issues/8694)
+  - 📚 Document and demonstrate merged cells through `onCell` rowSpan/colSpan [#8701](https://github.com/ant-design/pro-components/issues/8701)
+- ProLayout
+  - ✅ Lock `layout="mix"`, `splitMenus`, and `siderMenuType="sub"` child-menu rendering [#9310](https://github.com/ant-design/pro-components/issues/9310)
+- Density selector
+  - 💄 Let translated density menu labels determine the dropdown width [#9619](https://github.com/ant-design/pro-components/issues/9619)
 - Parse custom date formats and URL-synchronized second/millisecond timestamps consistently in edit fields [#8863](https://github.com/ant-design/pro-components/issues/8863) [#8810](https://github.com/ant-design/pro-components/issues/8810)
 - Preserve null fields when `omitNil=false`, forward field-level blur validation, and keep formatted ellipsis tooltips aligned with rendered text [#8044](https://github.com/ant-design/pro-components/issues/8044) [#8380](https://github.com/ant-design/pro-components/issues/8380) [#8542](https://github.com/ant-design/pro-components/issues/8542)
 - Refresh Select requests for controlled search values without repeating empty searches, preserve hidden QueryFilter fields, and respect responsive vertical layouts [#8801](https://github.com/ant-design/pro-components/issues/8801) [#8780](https://github.com/ant-design/pro-components/issues/8780) [#8928](https://github.com/ant-design/pro-components/issues/8928) [#8397](https://github.com/ant-design/pro-components/issues/8397) [#8836](https://github.com/ant-design/pro-components/issues/8836)
```

**File**: `site/changelog.md` (modified, +12/-0)
```diff
@@ -4,6 +4,18 @@
 
 ### 🐛 问题修复
 
+- BetaSchemaForm
+  - 🐞 修复 `layoutType="Embed"` 独立使用时 `onValuesChange`、`onFinish` 等回调不生效，并保持嵌套在已有 Form 内时仅透传字段 [#8727](https://github.com/ant-design/pro-components/issues/8727)
+  - ✅ 锁定 Form 与 LightFilter 布局切换回归 [#8850](https://github.com/ant-design/pro-components/issues/8850)
+- ProFormCaptcha
+  - 🐞 为全部内置语言补齐验证码按钮与倒计时默认文案 [#8899](https://github.com/ant-design/pro-components/issues/8899)
+- ProTable
+  - 🐞 保留 `Table.EXPAND_COLUMN` 的显式位置，并锁定 Tabs 内列宽与省略、valueEnum 格式化省略回归 [#8913](https://github.com/ant-design/pro-components/issues/8913) [#8747](https://github.com/ant-design/pro-components/issues/8747) [#8694](https://github.com/ant-design/pro-components/issues/8694)
+  - 📚 补充 `onCell` rowSpan/colSpan 合并单元格文档与示例 [#8701](https://github.com/ant-design/pro-components/issues/8701)
+- ProLayout
+  - ✅ 锁定 `layout="mix"`、`splitMenus` 与 `siderMenuType="sub"` 组合下的子菜单渲染 [#9310](https://github.com/ant-design/pro-components/issues/9310)
+- 密度选择器
+  - 💄 让多语言密度菜单按文案内容自适应宽度 [#9619](https://github.com/ant-design/pro-components/issues/9619)
 - 统一编辑字段中的自定义日期格式解析与 URL 同步的秒/毫秒时间戳回显 [#8863](https://github.com/ant-design/pro-components/issues/8863) [#8810](https://github.com/ant-design/pro-components/issues/8810)
 - 在 `omitNil=false` 时保留空字段，透传字段级失焦校验，并使 ellipsis tooltip 与格式化后的显示文本一致 [#8044](https://github.com/ant-design/pro-components/issues/8044) [#8380](https://github.com/ant-design/pro-components/issues/8380) [#8542](https://github.com/ant-design/pro-components/issues/8542)
 - 支持受控搜索值刷新 Select 请求且避免空搜索重复请求，正确处理 QueryFilter hidden 字段与响应式垂直布局 [#8801](https://github.com/ant-design/pro-components/issues/8801) [#8780](https://github.com/ant-design/pro-components/issues/8780) [#8928](https://github.com/ant-design/pro-components/issues/8928) [#8397](https://github.com/ant-design/pro-components/issues/8397) [#8836](https://github.com/ant-design/pro-components/issues/8836)
```

**File**: `site/components/table.en-US.md` (modified, +1/-0)
```diff
@@ -295,6 +295,7 @@ If you want **client-side** sorting/filtering (and **do not** want to trigger `r
 | hideInSetting                          | Do not display in configuration tool                                                                                                                                                                                                         | `boolean`                                                                                             | -             |
 | filters                                | The filter menu item in the header. When the value is true, valueEnum is automatically generated                                                                                                                                             | `boolean` \| `object[]`                                                                               | false         |
 | onFilter                               | Filter the form, use the built-in ProTable when it is true, turn off local filtering when it is false                                                                                                                                        | `(value, record) => boolean` \| `false`                                                               | false         |
+| onCell                                 | Same as antd Table. Set cell props; returning `colSpan` / `rowSpan` merges cells (0 hides the cell), identical to the [antd colspan/rowspan demo](https://ant.design/components/table#components-table-demo-colspan-rowspan)                  | `(record: T, index?: number) => React.TdHTMLAttributes<HTMLTableCellElement>`                          | -             |
 | request                                | Request enumeration from server                                                                                                                                                                                                              | [request](https://procomponents.ant.design/components/schema#request-%E5%92%8C-params)                | -             |
 | initialValue                           | Initial value of query form item                                                                                                                                                                                                             | `any`                                                                                                 | -             |
 | disable                                | Status of `disabled` in column settings                                                                                                                                                                                                      | `boolean` \| `{ checkbox: boolean; }`                                                                 | -             |
```

**File**: `site/components/table.md` (modified, +7/-0)
```diff
@@ -302,12 +302,19 @@ ref.current?.cancelEditable(rowKey);
 | hideInSetting                          | 不在配置工具中显示                                                                                                                               | `boolean`                                                                                                           | -      |
 | filters                                | 表头的筛选菜单项，当值为 true 时，自动使用 valueEnum 生成                                                                                        | `boolean` \| `object[]`                                                                                             | false  |
 | onFilter                               | 筛选表单，为 true 时使用 ProTable 自带的，为 false 时关闭本地筛选                                                                                | `(value, record) => boolean` \| `false`                                                                             | false  |
+| onCell                                 | 与 antd Table 相同，设置单元格属性，返回 `colSpan` / `rowSpan` 可实现合并单元格（值为 0 时不渲染该单元格），写法与 [antd 合并单元格示例](https://ant.design/components/table-cn#components-table-demo-colspan-rowspan) 完全一致 | `(record: T, index?: number) => React.TdHTMLAttributes<HTMLTableCellElement>`                                        | -      |
 | request                                | 从服务器请求枚举                                                                                                                                 | [request](https://procomponents.ant.design/components/schema#request-%E5%92%8C-params)                              | -      |
 | initialValue                           | 查询表单项初始值                                                                                                                                 | `any`                                                                                                               | -      |
 | disable                                | 列设置中`disabled`的状态                                                                                                                         | `boolean` \| `{ checkbox: boolean; }`                                                                               | -      |
 | readonly                               | 只读                                                                                                                                             | `boolean`                                                                                                           | -      |
 | listSlot                               | 列表键（ProList 插槽），指定该列映射到列表项的插槽位置，如 `title`、`avatar`、`description`、`subTitle`、`content`、`actions`、`aside`、`type`，私有属性 | `string`                                                              | -      |
 
+#### 合并单元格示例
+
+`onCell` 返回 `colSpan` / `rowSpan` 即可合并单元格，与 antd Table 完全一致（被合并的单元格返回 0）：
+
+<code src="../../demos/table/colspan-rowspan.tsx" background="var(--main-bg-color)"></code>
+
 ### valueType 值类型
 
 ProTable 封装了一些常用的值类型来减少重复的 `render` 操作，配置一个 [`valueType`](/components/schema-form#常见-valuetype) 即可展示格式化响应的数据。
```

**File**: `src/form/components/Captcha/index.tsx` (modified, +14/-4)
```diff
@@ -2,6 +2,7 @@
 import { Button, Form, Input } from 'antd';
 import type { NamePath } from 'antd/lib/form/interface';
 import React, { useEffect, useImperativeHandle, useState } from 'react';
+import { useIntl } from '../../../provider';
 import type { ProFormFieldItemProps } from '../../typing';
 import { warpField } from '../FormItem/warpField';
 
@@ -42,6 +43,7 @@ export type CaptFieldRef = {
 const BaseProFormCaptcha: React.FC<ProFormCaptchaProps> = React.forwardRef(
   (props, ref: any) => {
     const form = Form.useFormInstance();
+    const intl = useIntl();
     const [count, setCount] = useState<number>(props.countDown || 60);
     const [timing, setTiming] = useState(false);
     const [loading, setLoading] = useState<boolean>();
@@ -54,13 +56,21 @@ const BaseProFormCaptcha: React.FC<ProFormCaptchaProps> = React.forwardRef(
       phoneName,
       fieldProps,
       onTiming,
-      captchaTextRender = (paramsTiming, paramsCount) => {
-        return paramsTiming ? `${paramsCount} 秒后重新获取` : '获取验证码';
-      },
+      // #8899: 默认文案走 i18n（captcha.getCaptcha / captcha.retryAfter），
+      // 传入 captchaTextRender 时仍优先用户自定义
+      captchaTextRender,
       captchaProps,
       ...restProps
     } = props;
 
+    const defaultCaptchaText = (paramsTiming: boolean, paramsCount: number) => {
+      return paramsTiming
+        ? intl
+            .getMessage('captcha.retryAfter', '{count} 秒后重新获取')
+            ?.replace('{count}', String(paramsCount))
+        : intl.getMessage('captcha.getCaptcha', '获取验证码');
+    };
+
     const onGetCaptcha = async (mobile: string) => {
       try {
         setLoading(true);
@@ -150,7 +160,7 @@ const BaseProFormCaptcha: React.FC<ProFormCaptchaProps> = React.forwardRef(
             }
           }}
         >
-          {captchaTextRender(timing, count)}
+          {(captchaTextRender ?? defaultCaptchaText)(timing, count)}
         </Button>
       </div>
     );
```

**File**: `src/form/components/SchemaForm/layoutType/Embed.tsx` (modified, +32/-2)
```diff
@@ -1,3 +1,33 @@
-const Embed: React.FC<{ children: any }> = ({ children }) => <>{children}</>;
+import { Form } from 'antd';
+import React from 'react';
+import type { ProFormProps } from '../../../layouts/ProForm';
+import { ProForm } from '../../../layouts/ProForm';
 
-export default Embed;
+/**
+ * #8727: Embed 布局此前只渲染 children，没有 Form 容器，
+ * 导致单独使用时 onValuesChange / onFinish 等表单回调完全不生效，
+ * 字段也脱离 FormContext（"Can not find FormContext" 警告）。
+ *
+ * Embed 的语义是「把表单项嵌入到其他表单/容器中」：
+ * - 已处于某个 <Form> 内（如嵌套在 ProForm 中）：保持透传 children，
+ *   不再包一层 Form，避免嵌套 <form> 破坏外层表单
+ * - 独立使用：渲染 Form 容器（submitter=false，不附加额外 UI），
+ *   保证 onValuesChange、校验、提交能力可用
+ */
+const Embed = <T,>(props: ProFormProps<T>) => {
+  const { children, ...rest } = props;
+  // Form.useFormInstance() 在 <Form> 内部返回其实例，外部返回 undefined
+  const parentForm = Form.useFormInstance();
+
+  if (parentForm) {
+    return <>{children}</>;
+  }
+
+  return (
+    <ProForm<T> submitter={false} {...rest}>
+      {children as React.ReactNode}
+    </ProForm>
+  );
+};
+
+export default Embed as React.FC<ProFormProps<any>>;
```

**File**: `src/provider/locale/ar_EG.tsx` (modified, +4/-0)
```diff
@@ -79,6 +79,10 @@ const arEG: ProLocale = {
     open: 'مفتوح',
     close: 'غلق',
   },
+  captcha: {
+    getCaptcha: 'احصل على رمز التحقق',
+    retryAfter: 'أعد المحاولة بعد {count} ثانية',
+  },
 };
 
 export default arEG;
```

---

### Incident Patch 15: `70f13f77` (2026-10-02)
**Commit Message**: fix(list): restore display controls and live pagination state (#9721)

* fix(list,table): restore showActions/showExtra props (#7421) and add listItemTitleRender (#9620)

- ProList: restore showActions / showExtra / cardActionProps prop chain
  accidentally removed in c580ba323, with hover styles intact
- ProTable: options.setting.listItemTitleRender customizes column setting
  item title rendering (remove fixed 80px for adaptive single line)
- docs: list.md / list.en-US.md / table.md / table.en-US.md updated
- changelog: 3.1.15-9 bilingual entries incl. #7421 #7862 #8387 #9620
- todo.md: B19 batch checked off

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* fix(list): keep actions and pagination live

* fix: address list display review findings

---------

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `site/changelog.en-US.md` (modified, +4/-0)
```diff
@@ -21,6 +21,10 @@
   - ✅ Add regressions for copying `preserve={false}` fields, conditional remounts, and first-submit transforms [#8208](https://github.com/ant-design/pro-components/issues/8208) [#8896](https://github.com/ant-design/pro-components/issues/8896) [#8700](https://github.com/ant-design/pro-components/issues/8700)
 - BetaSchemaForm
   - 🆕 Pass the current row index to function props in `formList` sub-columns [#8561](https://github.com/ant-design/pro-components/issues/8561)
+- ProList
+  - 🐞 Restore `showActions`, `showExtra`, and card action placement, and lock grid gutter and live pagination regressions [#7421](https://github.com/ant-design/pro-components/issues/7421) [#8387](https://github.com/ant-design/pro-components/issues/8387) [#7862](https://github.com/ant-design/pro-components/issues/7862)
+- ProTable
+  - 🆕 Add `options.setting.listItemTitleRender` for adaptive column-setting titles [#9620](https://github.com/ant-design/pro-components/issues/9620)
 
 ### 📖 Documentation
 
```

**File**: `site/changelog.md` (modified, +4/-0)
```diff
@@ -22,6 +22,10 @@
   - ✅ 增加 `preserve={false}` 字段复制、条件重挂载及首次提交 transform 的回归测试 [#8208](https://github.com/ant-design/pro-components/issues/8208) [#8896](https://github.com/ant-design/pro-components/issues/8896) [#8700](https://github.com/ant-design/pro-components/issues/8700)
 - BetaSchemaForm
   - 🆕 在 `formList` 子列的函数式属性中传入当前行号 [#8561](https://github.com/ant-design/pro-components/issues/8561)
+- ProList
+  - 🐞 恢复 `showActions`、`showExtra` 与卡片操作区位置，并锁定栅格间距和实时分页回归 [#7421](https://github.com/ant-design/pro-components/issues/7421) [#8387](https://github.com/ant-design/pro-components/issues/8387) [#7862](https://github.com/ant-design/pro-components/issues/7862)
+- ProTable
+  - 🆕 增加 `options.setting.listItemTitleRender`，支持列设置标题自适应渲染 [#9620](https://github.com/ant-design/pro-components/issues/9620)
 
 ### 📖 文档
 
```

**File**: `site/components/list.en-US.md` (modified, +2/-0)
```diff
@@ -143,6 +143,8 @@ For other APIs, refer to [ProTable](/en-US/components/table).
 | loading            | Whether loading                                                                                                                                                                                      | `boolean` \| `{ spinning?: boolean }`                                                                                                                                                                        | `false`                |
 | split              | Whether to show a split line                                                                                                                                                                         | `boolean`                                                                                                                                                                                                    | `true`                 |
 | variant            | List appearance variant                                                                                                                                                                              | `'outlined'` \| `'borderless'` \| `'filled'`                                                                                                                                                                  | `'borderless'`         |
+| showActions        | When to show the actions area. `'hover'` shows actions when hovering or focusing the list item                                                                                                      | `'hover'` \| `'always'`                                                                                                                                                                                       | `'always'`             |
+| showExtra          | When to show the extra area (the `aside` slot). `'hover'` shows it only when hovering the list item. Not supported in CardList mode                                                                  | `'hover'` \| `'always'`                                                                                                                                                                                       | `'always'`             |
 | footer             | List footer                                                                                                                                                                                          | `ReactNode`                                                                                                                                                                                                  | -                      |
 | grid               | Grid configuration, enables card mode when set                                                                                                                                                       | `ListGridType`                                                                                                                                                                                               | -                      |
 | itemLayout         | List item layout direction                                                                                                                                                                           | `'horizontal'` \| `'vertical'`                                                                                                                                                                               | `'horizontal'`         |
```

**File**: `site/components/list.md` (modified, +2/-0)
```diff
@@ -149,6 +149,8 @@ ProList 基于 ProTable 封装，支持两种列配置方式：
 | loading            | 是否加载中                                                                                                                                                      | `boolean` \| `{ spinning?: boolean }`                                                                                                                                                                        | `false`            |
 | split              | 是否有分割线                                                                                                                                                    | `boolean`                                                                                                                                                                                                    | `true`             |
 | variant            | 列表外观变体                                                                                                                                                    | `'outlined'` \| `'borderless'` \| `'filled'`                                                                                                                                                                  | `'borderless'`    |
+| showActions        | 何时展示操作区（actions），`'hover'` 时悬浮或聚焦列表项才显示                                                                                                  | `'hover'` \| `'always'`                                                                                                                                                                                       | `'always'`         |
+| showExtra          | 何时展示附属内容（aside 插槽映射的 extra 区域），`'hover'` 时悬浮列表项才显示，CardList 模式下不生效                                                             | `'hover'` \| `'always'`                                                                                                                                                                                       | `'always'`         |
 | footer             | 列表底部                                                                                                                                                        | `ReactNode`                                                                                                                                                                                                  | -                  |
 | grid               | 栅格配置，开启后以卡片模式渲染                                                                                                                                  | `ListGridType`                                                                                                                                                                                               | -                  |
 | itemLayout         | 列表项布局方向                                                                                                                                                  | `'horizontal'` \| `'vertical'`                                                                                                                                                                               | `'horizontal'`     |
```

**File**: `site/components/table.en-US.md` (modified, +5/-0)
```diff
@@ -208,6 +208,11 @@ export type SettingOptionType = {
   extra?: React.ReactNode;
   children?: React.ReactNode;
   settingIcon?: React.ReactNode;
+  /** #9620: Custom title render for column setting list items, e.g. remove fixed width for adaptive single-line display */
+  listItemTitleRender?: (
+    title: React.ReactNode,
+    column: { key?: React.Key; title?: React.ReactNode; [key: string]: any },
+  ) => React.ReactNode;
 };
 ```
 
```

**File**: `site/components/table.md` (modified, +5/-0)
```diff
@@ -213,6 +213,11 @@ export type SettingOptionType = {
   extra?: React.ReactNode;
   children?: React.ReactNode;
   settingIcon?: React.ReactNode;
+  /** #9620: 自定义列设置面板列表项标题渲染，可取消固定宽度实现单行自适应 */
+  listItemTitleRender?: (
+    title: React.ReactNode,
+    column: { key?: React.Key; title?: React.ReactNode; [key: string]: any },
+  ) => React.ReactNode;
 };
 ```
 
```

**File**: `src/list/Item.tsx` (modified, +28/-2)
```diff
@@ -89,6 +89,12 @@ export type ItemProps<RecordType> = {
   rowSupportExpand?: boolean;
   onExpand?: (expand: boolean) => void;
   expandable?: ExpandableConfig<any>;
+  /** #7421: actions 渲染到 card 的哪个位置，默认 extra */
+  cardActionProps?: 'actions' | 'extra';
+  /** #7421: 何时展示 actions，'hover' 时鼠标悬浮列表项才显示 */
+  showActions?: 'hover' | 'always';
+  /** #7421: 何时展示 extra，'hover' 时鼠标悬浮列表项才显示 */
+  showExtra?: 'hover' | 'always';
   type?: 'new' | 'top' | 'inline' | 'subheader';
   isEditable: boolean;
   recordKey: string | number | undefined;
@@ -139,6 +145,9 @@ function ProListItemInner<RecordType>(props: ItemProps<RecordType>) {
     onExpand: propsOnExpand,
     expandable: expandableConfig,
     rowSupportExpand,
+    cardActionProps,
+    showActions,
+    showExtra,
     type,
     style,
     className: propsClassName = defaultClassName,
@@ -178,8 +187,10 @@ function ProListItemInner<RecordType>(props: ItemProps<RecordType>) {
   const className = clsx(
     {
       [`${defaultClassName}-selected`]: !cardProps && selected,
+      [`${defaultClassName}-show-action-hover`]: showActions === 'hover',
       [`${defaultClassName}-type-${type}`]: !!type,
       [`${defaultClassName}-editable`]: isEditable,
+      [`${defaultClassName}-show-extra-hover`]: showExtra === 'hover',
     },
     hashId,
     defaultClassName,
@@ -196,6 +207,12 @@ function ProListItemInner<RecordType>(props: ItemProps<RecordType>) {
     [actions],
   );
 
+  // #7421: cardActionProps 决定 actions 渲染到 card 的 extra 还是 actions 位置
+  const extraDom =
+    actionsArray && cardActionProps !== 'actions' ? actionsArray : undefined;
+  const actionsDom =
+    actionsArray && cardActionProps === 'actions' ? actionsArray : undefined;
+
   const titleDom =
     title || subTitle ? (
       <div className={clsx(`${defaultClassName}-header-container`, hashId)}>
@@ -277,7 +294,8 @@ function ProListItemInner<RecordType>(props: ItemProps<RecordType>) {
           {...cardProps}
           title={cardTitleDom}
           subTitle={subTitle}
-          extra={actionsArray}
+          extra={extraDom}
+          actions={actionsDom}
           bodyStyle={{ padding: token.paddingLG, ...cardProps.bodyStyle }}
           {...(itemProps as CheckCardProps)}
           onClick={(e) => {
@@ -304,14 +322,22 @@ function ProListItemInner<RecordType>(props: ItemProps<RecordType>) {
     [className]: className,
   });
 
+  // #7421:showExtra='hover' 时增加隐藏容器；默认路径保留原始节点结构。
+  const renderedExtra =
+    showExtra === 'hover' && extra !== null && extra !== undefined ? (
+      <div className={clsx(hashId, `${defaultClassName}-extra`)}>{extra}</div>
+    ) : (
+      extra
+    );
+
   return (
     <BaseListItem
       className={clsx(rowClassName, hashId, {
         [propsClassName]: propsClassName !== defaultClassName,
       })}
       {...rest}
       actions={actionsArray}
-      extra={extra}
+      extra={renderedExtra}
       {...onRow?.(record, index)}
       {...itemProps}
       onClick={(e: React.MouseEvent<HTMLDivElement>) => {
```

**File**: `src/list/ListView.tsx` (modified, +88/-75)
```diff
@@ -22,6 +22,7 @@ import { ProListContainer } from './ProListBase';
 
 type ListSlotColumn<RecordType> = TableColumnType<RecordType> & {
   listSlot: string;
+  cardActionProps?: 'extra' | 'actions';
 };
 type Key = React.Key;
 
@@ -46,6 +47,10 @@ export type ListViewProps<RecordType> = Omit<
     dataSource: readonly RecordType[];
     itemRender?: ProListItemRender<RecordType>;
     actionRef: React.MutableRefObject<ActionType | undefined>;
+    /** #7421: 何时展示 actions，'hover' 时悬浮列表项才显示 */
+    showActions?: 'hover' | 'always';
+    /** #7421: 何时展示 extra，'hover' 时悬浮列表项才显示 */
+    showExtra?: 'hover' | 'always';
     // 当非卡片模式时，用于为每一行的项目绑定事件，用户设置 `grid`时将会失效
     onRow?: GetComponentProps<RecordType>;
     // 兼容普通和卡片模式的事件绑定，代表每一个项目的事件，是对`onRow`的补充
@@ -75,6 +80,8 @@ function ListView<RecordType extends AnyObject>(
     expandable: expandableConfig,
     rowSelection,
     pagination, // List 的 pagination 默认是 false
+    showActions,
+    showExtra,
     onRow,
     onItem,
     rowClassName,
@@ -208,82 +215,88 @@ function ListView<RecordType extends AnyObject>(
   const selectItemDom = selectItemRender([])[0];
 
   const renderListItem = useRefFunction((item: RecordType, index: number) => {
-      const listItemProps: Partial<ItemProps<RecordType>> = {
-        className:
-          typeof rowClassName === 'function'
-            ? rowClassName(item, index)
-            : rowClassName,
-      };
-
-      listSlotColumns.forEach((column) => {
-        const dataIndex = (column.dataIndex ||
-          column.listSlot ||
-          column.key) as string;
-        const rawData = Array.isArray(dataIndex)
-          ? get(item, dataIndex as string[])
-          : item[dataIndex];
-
-        const data = column.render
-          ? column.render(rawData, item, index)
-          : rawData;
-        const propKey =
-          column.listSlot === 'aside' ? 'extra' : column.listSlot;
-        if (data !== '-') (listItemProps as any)[propKey] = data;
-      });
-      const checkboxDom = selectItemDom?.render?.(
-        item,
-        item,
-        index,
-      ) as React.ReactNode;
-
-      const { isEditable, recordKey } =
-        actionRef.current?.isEditable(item, index) || {};
-
-      const itemKey = getRowKey(item, index);
-      const isChecked = selectedKeySet.has(itemKey);
-
-      const cardProps = gridCardStaticProps
-        ? {
-            ...gridCardStaticProps,
-            checked: isChecked,
-            onChange: React.isValidElement(checkboxDom)
-              ? (changeChecked: boolean) =>
-                  (
-                    (checkboxDom as React.JSX.Element)?.props as any
-                  )?.onChange({
-                    nativeEvent: {},
-                    target: { checked: changeChecked },
-                    changeChecked,
-                  })
-              : undefined,
-          }
-        : undefined;
-
-      const defaultDom = (
-        <ProListItem
-          key={recordKey}
-          cardProps={cardProps}
-          {...listItemProps}
-          recordKey={recordKey}
-          isEditable={isEditable || false}
-          expandable={expandableConfig}
-          expand={mergedExpandedKeys.has(itemKey)}
-          onExpand={() => onTriggerExpand(item, index)}
-          index={index}
-          record={item}
-          item={item}
-          itemTitleRender={itemTitleRender}
-          itemHeaderRender={itemHeaderRender}
-          rowSupportExpand={!rowExpandable || rowExpandable(item)}
-          selected={selectedKeySet.has(itemKey)}
-          checkbox={checkboxDom as React.ReactElement}
-          onRow={onRow}
-          onItem={onItem}
-        />
-      );
-
-      return itemRender ? itemRender(item, index, defaultDom) : defaultDom;
+    const listItemProps: Partial<ItemProps<RecordType>> = {
+      className:
+        typeof rowClassName === 'function'
+          ? rowClassName(item, index)
+          : rowClassName,
+    };
+
+    listSlotColumns.forEach((column) => {
+      const dataIndex = (column.dataIndex ||
+        column.listSlot ||
+        column.key) as string;
+      const rawData = Array.isArray(dataIndex)
+        ? get(item, dataIndex as string[])
+        : item[dataIndex];
+
+      if (
+        column.listSlot === 'actions' &&
+        column.cardActionProps === 'actions'
+      ) {
+        listItemProps.cardActionProps = 'actions';
+      }
+
+      const data = column.render
+        ? column.render(rawData, item, index)
+        : rawData;
+      const propKey = column.listSlot === 'aside' ? 'extra' : column.listSlot;
+      if (data !== '-') (listItemProps as any)[propKey] = data;
     });
+    const checkboxDom = selectItemDom?.render?.(
+      item,
+      item,
+      index,
+    ) as React.ReactNode;
+
+    const { isEditable, recordKey } =
+      actionRef.current?.isEditable(item, index) || {};
+
+    const itemKey = getRowKey(item, index);
+    const isChecked = selectedKeySet.has(itemKey);
+
+    const cardProps = gridCardStatic
```

#### Recent Merged Pull Requests:
- **PR #9742** (2026-10-05): fix(card): expand antd Card path after #9740 (@leshalv)
- **PR #9741** (closed): fix(card): expand antd Card path after #9740 (@leshalv)
- **PR #9740** (2026-10-05): fix(card): align basic ProCard skin with antd Card (@chenshuai2144)
- **PR #9739** (2026-10-04): perf: remove swr and route-utils runtime costs (@chenshuai2144)
- **PR #9737** (2026-10-04): build: replace Father with Rslib (@chenshuai2144)
- **PR #9736** (2026-10-04): perf: reduce bundle size and selection scans (@chenshuai2144)
- **PR #9735** (2026-10-03): perf: share TypeScript program during lint (@chenshuai2144)
- **PR #9734** (2026-10-03): build: migrate lint and type checks to native toolchain (@chenshuai2144)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
