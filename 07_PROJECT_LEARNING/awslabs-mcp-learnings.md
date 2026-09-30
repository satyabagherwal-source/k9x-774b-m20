# Forensic Learning Record (Deep Inspection): awslabs/mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/awslabs-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/awslabs/mcp](https://github.com/awslabs/mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:38:04.637Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `awslabs/mcp`
- **Description**: Open source MCP Servers for AWS
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9744 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `docusaurus/docusaurus.config.ts`
```
import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Welcome to Open Source MCP Servers for AWS',
  tagline: 'Get started with open source MCP Servers for AWS and learn core features',
  favicon: 'img/aws-logo.svg',
  trailingSlash: false,

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
    faster: false, // Keep the webpack bundler; v4:true would otherwise enable Rspack (needs @docusaurus/faster), whose SWC HTML minifier errors on the existing i18n markup
  },

  // Set the production url of your site here
  url: 'https://awslabs.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/mcp/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'awslabs', // Usually your GitHub org/user name.
  projectName: 'mcp', // Usually your repo name.

  onBrokenLinks: 'throw',
  markdown: {
    hooks:  {
      onBrokenMarkdownLinks: 'throw'
    },
    // `future.v4: true` disables MDX v1 compat by default in Docusaurus 3.10,
    // which makes `.md` files parse `## Heading {#anchor}` as a strict MDX
    // expression and fail. Re-enable heading-id compat so the existing
    // explicit heading anchors (used across the ja/ i18n docs) keep working.
    mdx1Compat: {
      headingIds: true,
    },
  },

  // Add plugins
  plugins: [],

  // Add scripts to be loaded in the client
  scripts: [],

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ja'],
    localeConfigs: {
      en: {
        label: 'English',
        htmlLang: 'en',
      },
      ja: {
        label: '日本語',
        htmlLang: 'ja',
      },
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/awslabs/mcp/tree/main/',
          routeBasePath: '/', // Serve docs at the site's root
          remarkPlugins: [],
          rehypePlugins: [],
        },
        theme: {
          customCss: ['./src/css/custom.css', './src/css/doc-override.css'],
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    colorMode: {
      defaultMode: 'light',
      disableSwitch: true,
    },
    image: 'img/aws-logo.svg',
    navbar: {
      title: 'Open Source MCP Servers for AWS',
      logo: {
        alt: 'Open Source MCP Servers for AWS Logo',
        src: 'img/aws-logo.svg',
      },
      items: [
        {
          type: 'localeDropdown',
          position: 'right',
        },
        {
          href: 'https://github.com/awslabs/mcp',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Get Started',
              to: '/',
            },
            {
              label: 'Installation',
              to: '/installation',
            },
          ],
        },
        {
          title: 'Resources',
          items: [
            {
              label: 'AWS Blog',
              href: 'https://aws.amazon.com/blogs/machine-learning/introducing-aws-mcp-servers-for-code-assistants-part-1/',
            },
            {
              label: 'Model Context Protocol',
              href: 'https://modelcontextprotocol.io/introduction',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/awslabs/mcp',
            },
          ],
        },
      ],
      copyright: `© Amazon Web Services, Inc. or its affiliates. All rights reserved.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

```

### Core Architecture Module: `docusaurus/sidebars.ts`
```
import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  mainSidebar: [
    {
      type: "category",
      label: "Get Started",
      collapsed: false,
      items: ["intro", "installation", "vibe_coding"],
    },
    {
      type: "category",
      label: "Available MCP Servers for AWS",
      collapsed: false,
      items: [
        {
          type: "category",
          label: "Getting Started",
          items: [
            {
              type: 'link',
              label: 'AWS MCP',
              href: 'https://docs.aws.amazon.com/aws-mcp/latest/userguide/what-is-mcp-server.html',
            },
            "servers/aws-api-mcp-server",
            "servers/aws-knowledge-mcp-server",
          ],
        },
        {
          type: "category",
          label: "Documentation",
          items: ["servers/aws-documentation-mcp-server"],
        },
        {
          type: "category",
          label: "Migration & Modernization",
          items: [
            "servers/aws-transform-mcp-server",
          ],
        },
        {
          type: "category",
          label: "Infrastructure & Deployment",
          items: [
            "servers/aws-iac-mcp-server",
            "servers/ccapi-mcp-server",
            "servers/eks-mcp-server",
            "servers/ecs-mcp-server",
            "servers/finch-mcp-server",
            "servers/lambda-tool-mcp-server",
            "servers/stepfunctions-tool-mcp-server",
            "servers/aws-serverless-mcp-server",
            "servers/aws-support-mcp-server",
            "servers/aws-network-mcp-server",
            "servers/aws-for-sap-management-mcp-server",
          ],
        },
        {
          type: "category",
          label: "AI & Machine Learning",
          items: [
            "servers/bedrock-kb-retrieval-mcp-server",
            "servers/amazon-qindex-mcp-server",
            "servers/amazon-qbusiness-anonymous-mcp-server",
            'servers/amazon-translate-mcp-server',
            "servers/document-loader-mcp-server",
            "servers/aws-bedrock-custom-model-import-mcp-server",
            "servers/amazon-bedrock-agentcore-mcp-server",
            "servers/sagemaker-ai-mcp-server",
            "servers/roda-mcp-server"
          ],
        },
        {
          type: "category",
          label: "Data & Analytics",
          items: [
            "servers/documentdb-mcp-server",
            "servers/dynamodb-mcp-server",
            "servers/elasticache-mcp-server",
            "servers/valkey-mcp-server",
            "servers/memcached-mcp-server",
            "servers/timestream-for-influxdb-mcp-server",
            "servers/amazon-keyspaces-mcp-server",
            "servers/amazon-neptune-mcp-server",
            "servers/aurora-dsql-mcp-server",
            "servers/mssql-mcp-server",
            "servers/mysql-mcp-server",
            "servers/oracle-mcp-server",
            "servers/postgres-mcp-server",
            "servers/aws-dataprocessing-mcp-server",
            "servers/redshift-mcp-server",
            "servers/s3-tables-mcp-server",
            "servers/aws-appsync-mcp-server",
            "servers/aws-iot-sitewise-mcp-server",
            "servers/sagemaker-unified-studio-spark-troubleshooting-mcp-server",
            "servers/sagemaker-unified-studio-spark-upgrade-mcp-server",
            "servers/roda-mcp-server"

          ],
        },
        {
          type: "category",
          label: "Developer Tools & Support",
          items: [
            "servers/openapi-mcp-server",
            "servers/prometheus-mcp-server",
            "servers/iam-mcp-server",
            "servers/amazon-kendra-index-mcp-server",
            "servers/aws-location-mcp-server",
          ],
        },
        {
          type: "category",
          label: "Integration & Messaging",
          items: [
            "servers/amazon-mq-mcp-server",
            "servers/amazon-sns-sqs-mcp-server",
          ],
        },
        {
          type: "category",
          label: "Cost & Operations",
          items: [
            "servers/aws-pricing-mcp-server",
            "servers/cloudwatch-mcp-server",
            "servers/cloudwatch-applicationsignals-mcp-server",
            "servers/security-agent-mcp-server",
            "servers/well-architected-security-mcp-server",
            "servers/cloudtrail-mcp-server",
            "servers/billing-cost-management-mcp-server",
          ],
        },
        {
          type: "category",
          label: "Healthcare & Lifesciences",
          items: [
            "servers/aws-healthomics-mcp-server",
            "servers/healthimaging-mcp-server",
            "servers/healthlake-mcp-server",
            "servers/roda-mcp-server"
          ],
        },
      ],
    },
    {
      type: "category",
      label: "Samples",
      collapsed: false,
      items: [
        "samples/mcp-integration-with-kb",
        "samples/mcp-integration-with-nova-canvas",
        "samples/stepfunctions-tool-mcp-server",
      ],
    },
  ],
};

export default sidebars;

```

### Core Architecture Module: `docusaurus/src/components/ServerCards/index.tsx`
```
import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';
import serverCardsData from '@site/static/assets/server-cards.json';

type ServerCardProps = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  subcategory?: string;
  tags?: string[];
  workflows?: string[];
  source_path?: string;
};

type CategoryProps = {
  id: string;
  name: string;
  description: string;
  icon: string;
};

type WorkflowProps = {
  id: string;
  name: string;
  description: string;
  icon: string;
};

const ServerCard: React.FC<{ server: ServerCardProps }> = ({ server }) => {
  const categoryId = server.category.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Map category to local SVG icon path
  const getCategoryIcon = (category: string) => {
    const iconMap: Record<string, string> = {
      'Essential Setup': '/mcp/assets/icons/key.svg',
      'Documentation': '/mcp/assets/icons/book-open.svg',
      'Infrastructure & Deployment': '/mcp/assets/icons/server.svg',
      'AI & Machine Learning': '/mcp/assets/icons/cpu.svg',
      'Data & Analytics': '/mcp/assets/icons/database.svg',
      'Developer Tools & Support': '/mcp/assets/icons/tool.svg',
      'Integration & Messaging': '/mcp/assets/icons/share-2.svg',
      'Cost & Operations': '/mcp/assets/icons/dollar-sign.svg',
      'Healthcare & Lifesciences': '/mcp/assets/icons/activity.svg',
      'Core': '/mcp/assets/icons/zap.svg'
    };
    return iconMap[category] || '/mcp/assets/icons/help-circle.svg';
  };

  const categoryIconPath = getCategoryIcon(server.category);

  // Use external URL if source_path is a full URL, otherwise use local path
  const linkHref = server.source_path && (server.source_path.startsWith('http://') || server.source_path.startsWith('https://'))
    ? server.source_path
    : `/mcp/servers/${server.id}`;

  return (
    <a href={linkHref} className={styles.serverCardLink}>
      <div className={clsx(styles.serverCard)} data-id={server.id}>
        <div className={styles.serverCardHeader}>
          <div className={styles.serverCardIcon}>
            <img src={categoryIconPath} alt={`${server.category} icon`} style={{ width: '22px', height: '22px' }} />
          </div>
          <div className={styles.serverCardTitleSection}>
            <h3 className={styles.serverCardTitle}>{server.name || 'Unknown Server'}</h3>
            <div className={styles.serverCardTags}>
              <span
                className={clsx(
                  styles.serverCardCategory,
                  styles[`serverCardCategory${categoryId}`]
                )}
                data-category={server.category || ''}
              >
                {server.category || 'Uncategorized'}
              </span>
              {server.workflows?.map((workflow, index) => {
                const workflowData = serverCardsData.workflows.find(w => w.id === workflow);
                // Map workflow IDs to local SVG icon paths
                const getWorkflowIcon = (workflowId) => {
                  const iconMap = {
                    'vibe-coding': '/mcp/assets/icons/code.svg',
                    'conversational': '/mcp/assets/icons/message-circle.svg',
                    'autonomous': '/mcp/assets/icons/cpu.svg'
                  };
                  return iconMap[workflowId] || '/mcp/assets/icons/zap.svg';
                };

                const workflowIconPath = getWorkflowIcon(workflow);

                return (
                  <span key={index} className={styles.serverCardWorkflow} data-workflow={workflow}>
                    {workflowData?.name || workflow}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className={styles.serverCardContent}>
          <p className={styles.serverCardDescription}>
            {server.description || 'No description available'}
          </p>
        </div>
      </div>
    </a>
  );
};

export default function ServerCards(): React.ReactNode {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [workflowFilter, setWorkflowFilter] = useState('');
  const [sortOption, setSortOption] = useState('name-asc');
  const [filteredServers, setFilteredServers] = useState(serverCardsData.servers);

  useEffect(() => {
    // Filter servers based on search query and filters
    const filtered = serverCardsData.servers.filter(server => {
      const matchesSearch = !searchQuery ||
        server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        server.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (server.tags && server.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchesCategory = !categoryFilter || server.category === categoryFilter;

      const matchesWorkflow = !workflowFilter ||
        (server.workflows && server.workflows.some(workflow => {
          const workflowData = serverCardsData.workflows.find(w => w.id === workflow);
          return workflowData?.name === workflowFilter;
        }));

      return matchesSearch && matchesCategory && matchesWorkflow;
    });

    // Sort filtered servers
    const [sortField, sortDirection] = sortOption.split('-');
    const sorted = [...filtered].sort((a, b) => {
      let aValue, bValue;

      if (sortField === 'name') {
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
      } else if (sortField === 'category') {
        aValue = a.category.toLowerCase();
        bValue = b.category.toLowerCase();
      } else {
        aValue = a[sortField as keyof ServerCardProps] as string || '';
        bValue = b[sortField as keyof ServerCardProps] as string || '';
      }

      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    });

    setFilteredServers(sorted);
  }, [searchQuery, categoryFilter, workflowFilter, sortOption]);

  return (
    <div className={styles.serverCardsContainer} id="server-cards-container">
      <div className={styles.cardControls}>
        <div className={styles.cardControlsSearch}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search servers by name, description, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search servers"
          />
        </div>

        <div className={styles.cardControlsFilters}>
          <div className={styles.cardControlsFilterGroup}>
            <select
              id="category-filter"
              className={styles.cardControlsSelect}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {serverCardsData.categories.map((category: CategoryProps) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.cardControlsFilterGroup}>
            <select
              id="workflow-filter"
              className={styles.cardControlsSelect}
              value={workflowFilter}
              onChange={(e) => setWorkflowFilter(e.target.value)}
            >
              <option value="">All Workflows</option>
              {serverCardsData.workflows.map((workflow: WorkflowProps) => (
                <option key={workflow.id} value={workflow.name}>
                  {workflow.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.cardControlsFilterGroup}>
            <select
              id="sort-select"
        
```

### Core Architecture Module: `docusaurus/src/pages/servers.tsx`
```
import React from 'react';
import Layout from '@theme/Layout';
import ServerCards from '@site/src/components/ServerCards';

export default function Servers(): React.ReactNode {
  return (
    <Layout
      title="Open source MCP servers for AWS"
      description="Browse all available open source MCP servers for AWS">
      <main className="container margin-vert--lg">
        <h1 className="text--center margin-bottom--lg">Available MCP Servers</h1>
        <p className="text--center margin-bottom--xl">
          Browse all available MCP Servers for AWS. Use the filters and search to find the servers you need.
        </p>
        <ServerCards />
      </main>
    </Layout>
  );
}

```

### Core Architecture Module: `samples/mcp-integration-with-kb/clients/client_server.py`
```
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import boto3
import logging
import os
import sys
import traceback
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from langchain.schema.messages import HumanMessage, ToolMessage
from langchain_aws import ChatBedrock
from langchain_mcp_adapters.client import MultiServerMCPClient
from pydantic import BaseModel
from typing import Any, Dict, List


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

SYSTEM_PROMPT = """You're a helpful assistant that has access to various tools. Your job is to understand if it is necessary to use these tools to carry out a user's request or respond without them. If you do find the need to use tools, request the tools. If you receive a tool result, then process the results then return a normal output.

When using the query_knowledge_base tool, always use the kb_id parameter exactly as provided by the system. Do not hardcode or guess the kb_id value."""

# Initialize Bedrock client
try:
    bedrock_runtime = boto3.client(
        service_name='bedrock-runtime',
        region_name=os.getenv('AWS_REGION', 'us-west-2'),
    )
    logger.info('Successfully initialized Bedrock client')
except Exception as e:
    logger.error(f'Failed to initialize Bedrock client: {str(e)}')
    bedrock_runtime = None

# Initialize FastAPI app
app = FastAPI(title='Bedrock KB Assistant API')


# Add exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions in the FastAPI application."""
    logger.error(f'Global exception: {str(exc)}')
    logger.error(traceback.format_exc())
    return JSONResponse(status_code=500, content={'detail': f'An error occurred: {str(exc)}'})


# Define request/response models
class QueryRequest(BaseModel):
    """Request model for querying the knowledge base."""

    query: str
    kb_id: str


class QueryResponse(BaseModel):
    """Response model containing messages from the knowledge base query."""

    messages: List[Dict[str, Any]]


class KnowledgeBaseRequest(BaseModel):
    """Request model for knowledge base operations."""

    kb_id: str


class KnowledgeBaseResponse(BaseModel):
    """Response model for knowledge base operations."""

    message: str
    kb_id: str


# Connect to the MCP server and create an agent
async def process_query(query: str, kb_id: str) -> Dict[str, Any]:
    """Process a query using the Bedrock KB through MCP server.

    Args:
        query: The user's query
        kb_id: The knowledge base ID to query

    Returns:
        A dictionary with the processed messages
    """
    logger.info(f"Processing query: '{query}' for KB ID: {kb_id}")

    try:
        # Initialize MCP client using the awslabs.bedrock-kb-retrieval-mcp-server
        logger.info('Initializing MCP client with awslabs.bedrock-kb-retrieval-mcp-server')
        mcp_client = MultiServerMCPClient(
            {
                'bedrock_kb': {
                    'transport': 'stdio',
                    'command': 'uvx',
                    'args': ['awslabs.bedrock-kb-retrieval-mcp-server@latest'],
                    'env': {
                        'AWS_PROFILE': os.getenv('AWS_PROFILE', 'default'),
                        'AWS_REGION': os.getenv('AWS_REGION', 'us-west-2'),
                        'FASTMCP_LOG_LEVEL': 'ERROR',
                    },
                }
            }
        )

        # Create a Bedrock LLM
        logger.info('Creating Bedrock LLM')
        if not bedrock_runtime:
            raise ValueError('Bedrock client is not initialized')

        # Get tools from the MCP server
        logger.info('Getting tools from MCP server')
        tools = await mcp_client.get_tools()
        logger.info(
            f'Retrieved {len(tools)} tools from MCP server: {[tool.name for tool in tools]}'
        )

        if not tools:
            logger.warning('No tools were returned from the MCP server')
            return {
                'messages': [{'content': 'No tools available from the knowledge base server.'}]
            }

        # Create a ChatBedrock instance with tools
        logger.info('Creating ChatBedrock with tools')
        chat_model = ChatBedrock(
            client=bedrock_runtime,
            model_id='anthropic.claude-3-sonnet-20240229-v1:0',
            model_kwargs={
                'temperature': 0.7,
                'max_tokens': 2048,
                'anthropic_version': 'bedrock-2023-05-31',
            },
            streaming=False,
            system_prompt_with_tools=SYSTEM_PROMPT,
        )

        # Prepare tools for Bedrock
        logger.info('Preparing tools for Bedrock')
        model = chat_model.bind_tools(tools)

        # Start conversation with Bedrock - include KB ID in the message
        kb_info = f'Use knowledge base ID: {kb_id} for any knowledge base queries.'
        enhanced_query = f'{kb_info}\n\nUser query: {query}'
        messages = [HumanMessage(content=enhanced_query)]

        logger.info('Sending initial query to Bedrock')
        response = await model.ainvoke(
            messages,
        )

        # Check if Bedrock requested a tool
        if hasattr(response, 'tool_calls') and response.tool_calls:
            logger.info('Bedrock requested tool use')
            logger.info(f'Tool calls: {response.tool_calls}')

            for tool_call in response.tool_calls:
                tool_name = tool_call['name']
                tool_args = tool_call['args']
                tool_id = tool_call['id']

                logger.info(f'Tool requested: {tool_name} with args: {tool_args}')

                # Find the requested tool
                requested_tool = None
                for tool in tools:
                    if tool.name == tool_name:
                        requested_tool = tool
                        break

                if not requested_tool:
                    logger.warning(f'Requested tool {tool_name} not found')
                    continue

                # For query_knowledge_base tool, ensure we use the correct KB ID
                if tool_name == 'query_knowledge_base':
                    # Always override kb_id with the one from the request
                    tool_args['kb_id'] = kb_id

                # Execute the tool
                logger.info(f'Executing tool {tool_name}')
                tool_result = await requested_tool.ainvoke(tool_args)
                logger.debug(f'Tool result: {tool_result}')

                # Create a new conversation with the tool response - use the original query
                new_messages = [HumanMessage(content=enhanced_query)]
                new_messages.append(response)  # Add the original AI response with tool_calls
                new_messages.append(
                    ToolMessage(
                        content=str(tool_result),
                        tool_call_id=tool_id,
                        name=tool_name,
                    )
                )

                # Get final response from Bedrock with tool results
                logger.info('Sending tool results back to B
```

### Core Architecture Module: `samples/mcp-integration-with-kb/user_interfaces/chat_bedrock_st.py`
```
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import json
import requests
import streamlit as st
import time


# Set page configuration
st.set_page_config(
    page_title='MCP integration with KB',
    layout='wide',
    initial_sidebar_state='expanded',
)
st.title('MCP integration with KB')

# Initialize session state for knowledge base IDs
if 'kb_ids' not in st.session_state:
    st.session_state.kb_ids = []

if 'current_kb_id' not in st.session_state:
    st.session_state.current_kb_id = None

# Sidebar for Knowledge Base configuration
with st.sidebar:
    st.title('Knowledge Base Settings')

    # Knowledge Base selection
    st.subheader('Current Knowledge Base')
    if st.session_state.kb_ids:
        current_kb = st.selectbox(
            'Select Knowledge Base',
            options=st.session_state.kb_ids,
            index=0
            if st.session_state.current_kb_id is None
            else st.session_state.kb_ids.index(st.session_state.current_kb_id),
        )
        st.session_state.current_kb_id = current_kb
    else:
        st.info('No Knowledge Bases added yet')

    # Add new Knowledge Base
    st.subheader('Add Knowledge Base')
    new_kb_id = st.text_input('Knowledge Base ID')

    if st.button('Add Knowledge Base'):
        if new_kb_id and new_kb_id not in st.session_state.kb_ids:
            st.session_state.kb_ids.append(new_kb_id)
            st.session_state.current_kb_id = new_kb_id
            st.success(f'Added Knowledge Base: {new_kb_id}')
            st.rerun()
        elif not new_kb_id:
            st.error('Please enter a Knowledge Base ID')
        else:
            st.warning('This Knowledge Base ID already exists')

    # Remove Knowledge Base
    if st.session_state.kb_ids and st.button('Remove Selected Knowledge Base'):
        st.session_state.kb_ids.remove(st.session_state.current_kb_id)
        if st.session_state.kb_ids:
            st.session_state.current_kb_id = st.session_state.kb_ids[0]
        else:
            st.session_state.current_kb_id = None
        st.rerun()

# Display current Knowledge Base info in main area
if st.session_state.current_kb_id:
    st.info(f'Using Knowledge Base: {st.session_state.current_kb_id}')
else:
    st.warning('Please add a Knowledge Base ID in the sidebar')

# API configuration
API_URL = 'http://localhost:8000'


def query_api(prompt, kb_id):
    """Send a query to the FastAPI server and get the response."""
    try:
        response = requests.post(
            f'{API_URL}/query', json={'query': prompt, 'kb_id': kb_id}, timeout=30
        )
        response.raise_for_status()  # Raise an exception for HTTP errors
        return response.json()['messages']
    except requests.exceptions.RequestException as e:
        st.error(f'API Error: {str(e)}')
        return [{'content': f'Error communicating with the API: {str(e)}'}]


if 'messages' not in st.session_state:
    st.session_state.messages = []

for message in st.session_state.messages:
    with st.chat_message(message['role']):
        st.markdown(message['content'])

if prompt := st.chat_input('What would you like to ask your Bedrock Knowledge Base?'):
    st.session_state.messages.append({'role': 'user', 'content': prompt})
    with st.chat_message('user'):
        st.markdown(prompt)

    with st.chat_message('assistant'):
        message_placeholder = st.empty()
        full_response = ''

        # Check if KB ID is set before processing
        if not st.session_state.current_kb_id:
            full_response = 'Please add a Knowledge Base ID in the sidebar to continue.'
        else:
            try:
                # Call our API with the KB integration
                with st.spinner('Processing your query...'):
                    messages = query_api(prompt, st.session_state.current_kb_id)

                # Process the response
                for message in messages:
                    content = message.get('content', '')

                    # Check if content is JSON and extract relevant parts
                    try:
                        json_content = json.loads(content)
                        if isinstance(json_content, dict) and 'content' in json_content:
                            content = json_content['content']
                    except (json.JSONDecodeError, TypeError):
                        # Not JSON or not the expected format, use as is
                        pass

                    # Simulate stream of response with milliseconds delay
                    for chunk in content.split(' '):
                        full_response += chunk + ' '
                        if chunk.endswith('\n'):
                            full_response += ' '
                        time.sleep(0.05)

                        # Add a blinking cursor to simulate typing
                        message_placeholder.markdown(full_response + '▌')
            except Exception as e:
                full_response = f'Error: {str(e)}'

        message_placeholder.markdown(full_response)

    st.session_state.messages.append({'role': 'assistant', 'content': full_response})

```

### Core Architecture Module: `samples/mcp-integration-with-nova-canvas/clients/client_server.py`
```
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import boto3
import json
import logging
import os
import sys
import traceback
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from langchain_mcp_adapters.client import MultiServerMCPClient
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize Bedrock client
try:
    bedrock_runtime = boto3.client(
        service_name='bedrock-runtime',
        region_name=os.getenv('AWS_REGION', 'us-east-1'),
    )
    logger.info('Successfully initialized Bedrock client')
except Exception as e:
    logger.error(f'Failed to initialize Bedrock client: {str(e)}')
    bedrock_runtime = None

# Initialize FastAPI app
app = FastAPI(title='Nova Canvas Image Generator API')


# Add exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions in the FastAPI application."""
    logger.error(f'Global exception: {str(exc)}')
    logger.error(traceback.format_exc())
    return JSONResponse(status_code=500, content={'detail': f'An error occurred: {str(exc)}'})


# Define request/response models
class ImageGenerationRequest(BaseModel):
    """Request model for image generation."""

    prompt: str = Field(..., description='Text description of the image to generate')
    negative_prompt: Optional[str] = Field(
        '', description='Text to define what not to include in the image'
    )
    width: int = Field(
        1024, description='Width of the generated image (320-4096, divisible by 16)'
    )
    height: int = Field(
        1024, description='Height of the generated image (320-4096, divisible by 16)'
    )
    quality: str = Field(
        'standard', description="Quality of the generated image ('standard' or 'premium')"
    )
    cfg_scale: float = Field(
        6.5, description='How strongly the image adheres to the prompt (1.1-10.0)'
    )
    seed: Optional[int] = Field(None, description='Seed for generation (0-858,993,459)')
    number_of_images: int = Field(1, description='Number of images to generate (1-5)')
    use_improved_prompt: Optional[bool] = Field(
        False, description='Use improved prompt for image generation'
    )
    colors: Optional[List[str]] = Field(
        None, description='List of hexadecimal color values for color-guided generation'
    )


class ImageGenerationResponse(BaseModel):
    """Response model for image generation."""

    status: str
    message: str
    image_paths: List[str]
    improved_prompt: Optional[str] = ''


# Function to improve prompts with Nova Text Model
async def improve_prompt_with_nova_text(prompt: str) -> str:
    """Improve the image generation prompt using Nova Text Model.

    Args:
        prompt: Original prompt from the user

    Returns:
        str: Improved prompt for image generation
    """
    try:
        if not bedrock_runtime:
            logger.warning('Bedrock client not initialized, returning original prompt')
            return prompt

        # Define system prompt
        system_list = [
            {
                'text': 'You are an expert at improving image generation prompts by adding specific details about composition, lighting, style, and technical aspects.',
                'cachePoint': {'type': 'default'},
            }
        ]

        # Define message
        message_list = [
            {
                'role': 'user',
                'content': [
                    {
                        'text': f"""Enhance prompt with specific details:
                        - Composition: layout, perspective, focal point
                        - Lighting: direction, intensity, shadows
                        - Style: artistic technique, medium, texture
                        - Mood: atmosphere, emotion, time of day
                        - Technical: resolution, aspect ratio

                        Provide concise output (<1000 chars): {prompt}"""
                    }
                ],
            }
        ]

        # Configure inference parameters
        inf_params = {'max_new_tokens': 500}

        # Construct the request body
        request_body = {
            'schemaVersion': 'messages-v1',
            'messages': message_list,
            'system': system_list,
            'inferenceConfig': inf_params,
        }

        # Call Nova Text Model through Bedrock
        response = bedrock_runtime.invoke_model(
            modelId='amazon.nova-micro-v1:0', body=json.dumps(request_body)
        )

        # Parse response
        response_body = json.loads(response['body'].read())
        logger.info(f'Response body: {response_body}')
        improved_prompt = response_body['output']['message']['content'][0]['text'].strip()

        logger.info(f"Original prompt: '{prompt}'")
        logger.info(f"Improved prompt: '{improved_prompt}'")

        return improved_prompt

    except Exception as e:
        logger.error(f'Error improving prompt with Nova Text Model: {str(e)}')
        # Return original prompt if improvement fails
        return prompt


# Connect to the MCP server and generate images
async def generate_image(request: ImageGenerationRequest) -> Dict[str, Any]:
    """Generate an image using the Nova Canvas MCP server.

    Args:
        request: The image generation request parameters

    Returns:
        A dictionary with the generation results
    """
    logger.info(f"Processing image generation request with prompt: '{request.prompt}'")

    try:
        # Check if use_improved_prompt is True
        if request.use_improved_prompt:
            logger.info('Improving prompt with Nova Text Model')
            # Improve prompt using Nova Text Model
            improved_prompt = await improve_prompt_with_nova_text(request.prompt)
            # Update the request with improved prompt
            request.prompt = improved_prompt

        # Initialize MCP client using the awslabs.nova-canvas-mcp-server
        logger.info('Initializing MCP client with awslabs.nova-canvas-mcp-server')
        mcp_client = MultiServerMCPClient(
            {
                'nova_canvas': {
                    'transport': 'stdio',
                    'command': 'uvx',
                    'args': ['awslabs.nova-canvas-mcp-server@latest'],
                    'env': {
                        'AWS_PROFILE': os.getenv('AWS_PROFILE', 'default'),
                        'AWS_REGION': os.getenv('AWS_REGION', 'us-east-1'),
                    },
                }
            }
        )

        # Get tools from the MCP server
        logger.info('Getting tools from MCP server')
        tools = await mcp_client.get_tools()
        logger.info(
            f'Retrieved {len(tools)} tools from MCP server: {[tool.name for tool in tools]}'
        )

        if not tools:
            logger.warning('No tools were returned from the MCP server')
            return {
                'status': 'error',
                'message': 'No tools available from the Nova Canvas server.',
                'image_paths': [
```

### Core Architecture Module: `samples/mcp-integration-with-nova-canvas/user_interfaces/image_generator_st.py`
```
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os
import random
import requests
import streamlit as st
from PIL import Image
from typing import List, Optional


# Set page configuration
st.set_page_config(
    page_title='Nova Canvas Image Generator',
    layout='wide',
    initial_sidebar_state='expanded',
)
st.title('Nova Canvas Image Generator')

# API configuration
API_URL = 'http://localhost:8000'

# Initialize session state for generated images
if 'generated_images' not in st.session_state:
    st.session_state.generated_images = []

if 'improved_prompt' not in st.session_state:
    st.session_state.improved_prompt = None

if 'generation_mode' not in st.session_state:
    st.session_state.generation_mode = 'text'  # 'text' or 'color'

if 'colors' not in st.session_state:
    st.session_state.colors = []


def add_color(color: str):
    """Add a color to the color palette."""
    if len(st.session_state.colors) < 10:  # Nova Canvas supports up to 10 colors
        st.session_state.colors.append(color)


def remove_color(index: int):
    """Remove a color from the color palette."""
    if 0 <= index < len(st.session_state.colors):
        st.session_state.colors.pop(index)


def clear_colors():
    """Clear all colors from the color palette."""
    st.session_state.colors = []


def generate_image(
    prompt: str,
    negative_prompt: str,
    width: int = 1024,
    height: int = 1024,
    quality: str = 'standard',
    cfg_scale: float = 6.5,
    seed: Optional[int] = None,
    number_of_images: int = 1,
    colors: Optional[List[str]] = None,
    use_improved_prompt: bool = False,
):
    """Send a request to the FastAPI server to generate an image."""
    try:
        payload = {
            'prompt': prompt,
            'negative_prompt': negative_prompt,
            'width': width,
            'height': height,
            'quality': quality,
            'cfg_scale': cfg_scale,
            'seed': seed,
            'number_of_images': number_of_images,
            'use_improved_prompt': use_improved_prompt,
        }
        if colors:
            payload['colors'] = colors

        response = requests.post(
            f'{API_URL}/generate',
            json=payload,
            timeout=120,  # Longer timeout for image generation
        )
        response.raise_for_status()  # Raise an exception for HTTP errors
        return response.json()
    except requests.exceptions.RequestException as e:
        st.error(f'API Error: {str(e)}')
        return {
            'status': 'error',
            'message': f'Error communicating with the API: {str(e)}',
            'image_paths': [],
        }


# Sidebar for generation settings
with st.sidebar:
    st.title('Image Generation Settings')

    # Generation mode selection
    st.subheader('Generation Mode')
    generation_mode = st.radio(
        'Select generation mode:',
        options=['Text-to-Image', 'Color-Guided Generation'],
        index=0 if st.session_state.generation_mode == 'text' else 1,
    )
    st.session_state.generation_mode = 'text' if generation_mode == 'Text-to-Image' else 'color'

    # Image dimensions
    st.subheader('Image Dimensions')
    width_options = [512, 768, 1024, 1536, 2048]
    height_options = [512, 768, 1024, 1536, 2048]

    col1, col2 = st.columns(2)
    with col1:
        width = st.selectbox('Width', options=width_options, index=2)  # Default to 1024
    with col2:
        height = st.selectbox('Height', options=height_options, index=2)  # Default to 1024

    # Quality settings
    st.subheader('Quality')
    quality = st.radio('Image quality:', options=['standard', 'premium'], index=0)

    # Advanced settings
    st.subheader('Advanced Settings')
    cfg_scale = st.slider(
        'CFG Scale',
        min_value=1.1,
        max_value=10.0,
        value=6.5,
        step=0.1,
        help='How strongly the image adheres to the prompt',
    )

    use_seed = st.checkbox('Use specific seed', value=False)
    if use_seed:
        seed = st.number_input(
            'Seed', min_value=0, max_value=858993459, value=random.randint(0, 858993459)
        )
    else:
        seed = None

    number_of_images = st.slider('Number of images', min_value=1, max_value=5, value=1)

# Main content area
st.header('Create Your Image')

# Prompt input
prompt = st.text_area(
    'Image Description',
    placeholder='Describe the image you want to generate...',
    help='Be specific and detailed about what you want to see in the image',
)

# Negative prompt input
negative_prompt = st.text_area(
    'Negative Prompt',
    placeholder="Describe what you DON'T want to see in the image...",
    help='Specify elements you want to exclude from the image.',
)

# Default negative prompt suggestion
if not negative_prompt:
    st.info(
        'Tip: Consider adding "people, anatomy, hands, low quality, low resolution, low detail" to your negative prompt for better results.'
    )

# Color palette section (only shown in color-guided mode)
if st.session_state.generation_mode == 'color':
    st.header('Color Palette')
    st.write('Select up to 10 colors to guide the image generation')

    # Display current color palette
    if st.session_state.colors:
        cols = st.columns(10)  # Up to 10 colors
        for i, color in enumerate(st.session_state.colors):
            with cols[i % 10]:
                st.color_picker(f'Color {i + 1}', color, key=f'color_display_{i}', disabled=True)
                if st.button('Remove', key=f'remove_{i}'):
                    remove_color(i)
                    st.rerun()

    # Add new color
    if len(st.session_state.colors) < 10:
        new_color = st.color_picker('Add a color', '#FF4B4B')
        if st.button('Add to Palette'):
            add_color(new_color)
            st.rerun()

    # Clear all colors
    if st.session_state.colors and st.button('Clear All Colors'):
        clear_colors()
        st.rerun()

# Checkbox for improved prompt
use_improved_prompt = bool(
    st.checkbox(
        'Use Improved Prompt',
        value=True,
        help='Improve the prompt using Amazon Nova Micro Model for image generation',
    )
)

# Generate button
if st.button('Generate Image', type='primary', disabled=not prompt or not negative_prompt):
    st.session_state.improved_prompt = None
    with st.spinner('Generating your image... This may take a minute.'):
        # Prepare colors if in color-guided mode
        colors = st.session_state.colors if st.session_state.generation_mode == 'color' else None

        # Call the API
        result = generate_image(
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            quality=quality,
            cfg_scale=cfg_scale,
            seed=seed,
            number_of_images=number_of_images,
            use_improved_prompt=use_improved_prompt,
            colors=colors,
        )

        # Store generated images
        st.session_state.generated_images = result['image_paths']

        if use_improved_prompt:
            improved_prompt = result['improved_prompt']
            if improved_prompt:
                st.session_state.improved_prompt = improved_prompt

        # Display success message or error
        if result['status'] == 'success':
            st.success(result['message'])
        else:
            st.error(f'Failed to generate image: {result["me
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4586** (2026-09-08): **aws-api-mcp-server: ImportError - McpError not found in mcp.shared.exceptions (MCP v2 compatibility)**
  *Symptoms*: ### Describe the bug  The aws-api-mcp-server package fails to import due to incorrect class name. The code imports `McpError` but MCP v2.x renamed it to `MCPError` (capital letters).   ### Expected Behavior  The server should start without import errors when running: uvx awslabs.aws-api-mcp-server   ### Current Behavior  ImportError: cannot import name 'McpError' from 'mcp.shared.exceptions' (C:\Users\...\mcp\shared\exceptions.py). Did you mean: 'MCPError'?  File location: awslabs/aws_api_mcp_server/core/aws/service.py line 47   ### Reproduction Steps  # Install uv if not installed pip install uv  # Run the MCP server uvx awslabs.aws-api-mcp-server@latest  # Result: ImportError on startup   ### Possible Solution  Change line 47 in awslabs/aws_api_mcp_server/core/aws/service.py  From: from mcp.shared.exceptions import McpError To:   from mcp.shared.exceptions import MCPError  The MCP v2.x library uses MCPError (capital letters), not McpError.   ### Additional Information/Context  Tested versions: 1.0.0, 1.3.47, 1.5.4 (all affected) The package requires mcp>=2.1.1 which uses the new class name MCPError.   ### OS  Windows 11  ### Server  aws-api-mcp-server  ### Server Version  1.5.4 (latest), also affects 1.0.0, 1.3.47  ### Region experiencing the issue  N/A - local execution issue  ### Other information  Python: 3.12 uv: latest mcp dependency resolved: 2.1.1   ### Service quota  - [x] I have reviewed the service quotas for this construct
  **Post-Mortem & Fix Analysis**:
  > Seeing this too, via a different install path — worth recording since the symptom looks different.  **Claude Desktop extension**, not `uvx`: `aws-api-mcp-server` 1.3.3 (`ant.dir.gh.awslabs.aws-api-mcp-server`) on Linux, uv 0.9.7, Python 3.12, resolved `mcp` 2.1.1. Same `ImportError` in `core/aws/service.py`. The user-visible symptom is just "Failed / Server disconnected" in the extension list — the traceback is only in the MCP log, so it isn't obvious where to look.  The root cause is the unbounded constraint rather than the import spelling alone: `pyproject.toml` declares `mcp>=1.23.0` with no upper bound, so a fresh resolve lands on 2.x. That means it breaks on a clean install with no user action.  Pinning below the rename works:  ```toml "mcp>=1.23.0,<2", ```  That resolves to mcp 1.29.1 / fastmcp 3.4.7, and the server starts and completes an MCP `initialize` handshake normally. As a workaround it's lost on the next extension update, though.  One note on the suggested fix in the des

- **Issue #4567** (2026-09-01): **aws-iac-mcp-server: crashes on startup with fastmcp 4.0.0 — No module named 'fastmcp.server.proxy' (repo-wide fastmcp cap audit)**
  *Symptoms*: > **Update (repo-wide audit):** I audited all 62 servers for uncapped `fastmcp` deps. **`aws-iac-mcp-server` is the only server that actually crashes on FastMCP 4.0.0** — it is the sole uncapped server that imports a module 4.0 removed (`fastmcp.server.proxy`). 11 other servers are uncapped but use import paths that still exist in 4.0.0, so they don't crash from *this* issue (though an explicit `<4` cap is still advisable). `openapi-mcp-server` is already capped `<4`. Full listing, methodology, and per-server results are in [this comment](https://github.com/awslabs/mcp/issues/4567#issuecomment-5500359528).  ---  ### Describe the bug  `awslabs.aws-iac-mcp-server` fails to start (crashes at import) when installed via `uvx ...@latest`, because it resolves **FastMCP 4.0.0**. The server imports `ProxyClient` from `fastmcp.server.proxy`, a module that was **removed** in FastMCP 4.0 (it moved to `fastmcp.server.providers.proxy`).  The package's `pyproject.toml` declares `fastmcp>=3.2.0` with **no upper bound**, so any fresh install now pulls FastMCP 4.0.0 and the server never comes up.  - Package version: `awslabs.aws-iac-mcp-server` 1.0.24 - Offending import: `src/awslabs/aws_iac_mcp_server/client/mcp_proxy.py:18` and `.../server.py:34` → `from fastmcp.server.proxy import ProxyClient` - Dependency declaration: `pyproject.toml` → `"fastmcp>=3.2.0"`  ### Expected Behavior  `uvx awslabs.aws-iac-mcp-server@latest` starts the MCP server successfully with the default (latest) dependency 
  **Post-Mortem & Fix Analysis**:
  > ## Repo-wide audit: which servers are actually affected  I cloned `awslabs/mcp@main` and audited **all 62 servers** for uncapped `fastmcp` dependencies that could crash on FastMCP 4.0.0. Summary: **13 servers declare a standalone `fastmcp` dependency; 12 are uncapped; but only `aws-iac-mcp-server` actually crashes** on 4.0.0.  The distinction matters: *uncapped ≠ vulnerable*. The crash only happens when a server **imports a module that FastMCP 4.0 removed/relocated**. Almost every server imports `fastmcp` symbols that still exist in 4.0.0.  ### How I tested 1. Extracted the `fastmcp` constraint from every `src/*/pyproject.toml`. 2. Collected every distinct `fastmcp` import used across those servers. 3. Ran each import against a real `fastmcp==4.0.0` to see which raise `ModuleNotFoundError`. 4. Booted representative servers over stdio under `fastmcp==4.0.0` and under `fastmcp<4`.  ### Only two import paths break under FastMCP 4.0.0 | Import | Status in 4.0.0 | Used by | |---|---|---| | 
  > The repo-wide audit table lists `aws-api-mcp-server` as **Crashes on 4.0.0? no**. It does crash — through a second path the audit didn't cover.  The audit asked "does the server import a module FastMCP 4.0 removed?", and for this server that answer is correctly **no**. But FastMCP 4.0 also bumps a *transitive* dependency: `fastmcp-slim 4.0.0` requires `mcp>=2.0.0,<3.0.0`. `aws-api-mcp-server` declares `mcp>=1.23.0` with no upper bound, so a fresh resolve lands on mcp 2.1.1 — and SDK v2 renamed `McpError` to `MCPError` with no alias for the old spelling.  Repro (`awslabs.aws-api-mcp-server` 1.5.4, resolves fastmcp 4.0.0 + mcp 2.1.1):  ``` $ uvx awslabs.aws-api-mcp-server@latest   File ".../aws_api_mcp_server/core/aws/service.py", line 47, in <module>     from mcp.shared.exceptions import McpError ImportError: cannot import name 'McpError' from 'mcp.shared.exceptions'. Did you mean: 'MCPError'? ```  `uv.lock` still pins mcp 1.29.0, so CI and local dev never hit this — only installs that 

- **Issue #4535** (2026-08-25): **aws-api-mcp-server: InvalidClientTokenId persists after full uninstall/reinstall of connector**
  *Symptoms*: ### Describe the bug  The aws-api-mcp-server connector (Claude/claude.ai connector integration) returns `InvalidClientTokenId` on every AWS CLI call, including basic read-only calls like `aws sts get-caller-identity`. This started mid-session without any credential/config change on my end.  Troubleshooting already tried: - Toggled the connector off/on in Connectors settings — no change - Fully uninstalled and reinstalled the connector — same InvalidClientTokenId error persists - Confirmed the error is not command-specific (fails even on a trivial `sts get-caller-identity` call)  This suggests the underlying credentials/session token backing the connector are invalid or expired at the integration level, and neither a toggle nor a full reinstall regenerates them.  ### Expected Behavior  Either the connector should refresh/regenerate valid credentials automatically on reinstall, or there should be a clear way for the user to re-authenticate / see why the token is invalid, instead of silently failing with InvalidClientTokenId indefinitely.  ### Current Behavior  Every call through the connector fails with:  An error occurred (InvalidClientTokenId) when calling the [operation] operation: The security token included in the request is invalid.  This happens even on the simplest possible call:  aws sts get-caller-identity --region us-east-2  Same InvalidClientTokenId error is returned before and after: (1) toggling the connector Enabled/Disabled, (2) fully uninstalling and reinstalli
  **Post-Mortem & Fix Analysis**:
  > resolved

- **Issue #4366** (2026-08-04): **aurora-dsql-mcp-server: flaky timing test test_dollar_quote_scan_is_linear (2.04s vs 2.0s threshold)**
  *Symptoms*: ### Describe the bug  `tests/test_readonly_enforcement.py::TestReadonlyEnforcement::test_dollar_quote_scan_is_linear` is a **flaky wall-clock timing test**. It feeds a 500k-`$` payload through `detect_mutating_keywords` / `check_sql_injection_risk` and asserts the run finishes in under 2 seconds:  ```python # src/aurora-dsql-mcp-server/tests/test_readonly_enforcement.py:399 assert elapsed < 2.0, f'dollar-heavy input too slow ({elapsed:.2f}s) — possible O(n^2)' ```  On a loaded CI runner the absolute wall-clock time occasionally creeps just over the threshold and fails the whole `Build aurora-dsql-mcp-server` job, even though the code is correct.  ### Observed failure  From the `main` post-merge run of #4360 ([job log](https://github.com/awslabs/mcp/actions/runs/30384985162/job/90361979166)):  ``` AssertionError: dollar-heavy input too slow (2.04s) — possible O(n^2) assert 2.042716128000002 < 2.0 tests/test_readonly_enforcement.py:399: AssertionError 1 failed, 237 passed in 7.03s ```  The failure (2.04s vs. a 2.0s threshold — ~2% over) is unrelated to that PR's dependency change; it is pure timing sensitivity. This is at least the second sighting of this same test tripping right at ~2.04s.  ### Why it's a false positive  The regression this test guards against — the old O(n²) `sql[i:]` slicing in `_end_of_dollar_quote` — takes *tens of seconds* on a 500k-`$` string. The linear implementation runs in well under a second, so a 2.0s bar leaves almost no headroom against runner ji

- **Issue #4356** (2026-07-28): **No module named 'mcp.server.fastmcp'**
  *Symptoms*: ### Describe the bug  Currently there is no upper bound for the `mcp[cli]` requirement on a number of the MCP servers as can be seen by their pyproject.toml files e.g. `mcp[cli]>=1.23.0` v2 of `mcp` is now available as of this afternoon which no longer requires the `fastmcp` library that was previously installed as a dependency of `mcp`. However, many of the MCP servers in this repo still require `fastmcp`. The only MCP servers in this repo that are protected from this issue are the ones that explicitly state `fastmcp` as one of the dependencies here e.g. aws-iac-mcp-server  Here's a list of the affected MCPs: - aws-documentation-mcp-server - eks-mcp-server - aws-serverless-mcp-server - bedrock-kb-retrieval-mcp-server - lambda-tool-mcp-server - cloudwatch-mcp-server - iam-mcp-server - aws-pricing-mcp-server - amazon-sns-sqs-mcp-server - finch-mcp-server - stepfunctions-tool-mcp-server - cloudtrail-mcp-server - well-architected-security-mcp-server - amazon-mq-mcp-server - sagemaker-ai-mcp-server - aws-location-mcp-server - cloudwatch-applicationsignals-mcp-server - amazon-kendra-index-mcp-server - prometheus-mcp-server    ### Expected Behavior  MCP servers are able to start which requires fastmcp to be installed.  ### Current Behavior  fastmcp is not being installed for 19 of the MCP servers in this repo because of the lack of an upper bound on the mcp version means that mcp v2 is being installed which doesn't use fastmcp  ### Reproduction Steps   Try installing any of the MCP
  **Post-Mortem & Fix Analysis**:
  > This appears to be caused by `mcp==2.0.0`, which was released recently: https://pypi.org/project/mcp/  `awslabs.cloudwatch-mcp-server==0.1.5` imports:  ```python from mcp.server.fastmcp import Context ```  With `mcp==2.0.0`, that import fails:  ```text ModuleNotFoundError: No module named 'mcp.server.fastmcp' ```  Temporary workaround:  ```bash uv pip install --force-reinstall "mcp==1.29.0" "awslabs.cloudwatch-mcp-server==0.1.5" ```  After pinning `mcp==1.29.0`, the import works again.  It looks like the package dependency range may allow `mcp>=2`, but the code is still using the pre-2.0 SDK module layout. The package should probably pin `mcp<2` or update the imports/API usage for `mcp==2.x`. 

- **Issue #4318** (2026-09-28): **awslabs.ec2-mcp-server fails to start — TypeError: FastMCP.__init__() got an unexpected keyword argument 'description'**
  *Symptoms*: ### Describe the bug  The awslabs.ec2-mcp-server MCP server fails to start immediately after installation with the following traceback:  Traceback (most recent call last):   File "<frozen runpy>", line 198, in _run_module_as_main   File "<frozen runpy>", line 88, in _run_code   File "...\Scripts\awslabs.ec2-mcp-server.exe\__main__.py", line 4, in <module>     from awslabs.ec2_mcp_server.server import main   File "...\Lib\site-packages\awslabs\ec2_mcp_server\server.py", line 74, in <module>     mcp = FastMCP(         name="AWS EC2 MCP Server",     ...     ) TypeError: FastMCP.__init__() got an unexpected keyword argument 'description' Steps to reproduce:    Impact:  The server is completely non-functional for all users on the current release.  ### Expected Behavior  It should have started with Claude code ok.  ### Current Behavior  This log error: Traceback (most recent call last):   File "<frozen runpy>", line 198, in _run_module_as_main   File "<frozen runpy>", line 88, in _run_code   File "...\Scripts\awslabs.ec2-mcp-server.exe\__main__.py", line 4, in <module>     from awslabs.ec2_mcp_server.server import main   File "...\Lib\site-packages\awslabs\ec2_mcp_server\server.py", line 74, in <module>     mcp = FastMCP(         name="AWS EC2 MCP Server",     ...     ) TypeError: FastMCP.__init__() got an unexpected keyword argument 'description'  ### Reproduction Steps  Add awslabs.ec2-mcp-server@latest to your MCP client config using uvx Start the MCP client The server installs 
  **Post-Mortem & Fix Analysis**:
  > Opened a fix in #4320 -- adds the missing `src/ec2-mcp-server/` source tree (the package was on PyPI but absent from `main`) and removes the `description`/`version` kwargs from the `FastMCP()` constructor call, which are no longer accepted in `mcp>=1.28.0`.
  > This issue is now marked as stale because it hasn't seen activity for a while. Add a comment or it will be closed soon. If you wish to exclude this issue from being marked as stale, add the "backlog" label.
  > Closing this issue as it hasn't seen activity for a while. Please add a comment @mentioning a maintainer to reopen. If you wish to exclude this issue from being marked as stale, add the "backlog" label.

- **Issue #4138** (2026-07-27): **amazon-bedrock-agentcore-mcp-server : ensure_ready() crashes with HTTP Error 404 fetching llms.txt (docs source deprecated)**
  *Symptoms*: ### Describe the bug  The server crashes on startup and never completes MCP initialization. All tool groups register successfully, then `main()` calls `cache.ensure_ready()`, which fetches the hardcoded docs index at:  https://aws.github.io/bedrock-agentcore-starter-toolkit/llms.txt  That URL now returns HTTP 404. The startup fetch has no error handling, so the`urllib.error.HTTPError` escapes out of `main()` and the process exits. The MCP client sees the stdio server die and marks it as failed.  The root cause is external: the aws/bedrock-agentcore-starter-toolkit docs site has been deprecated, and the MkDocs llmstxt plugin that generated llms.txt was removed. From that repo's documentation/mkdocs.yaml:  > SITE DEPRECATION: the content-generating plugins (macros, include-markdown, mkdocstrings, llmstxt) were removed. Every page now serves a redirect ... > The starter toolkit is heading to EOL in favor of the new AgentCore CLI, and this GitHub Pages site is being deprecated.  So llms.txt is gone permanently at that location; both llms.txt and llms-full.txt return 404.  ### Expected Behavior  A transient or permanent failure to fetch the configured llms.txt should not prevent the server from starting. Documentation search/fetch tools can degrade gracefully, and the unrelated tools should remain usable.   ### Current Behavior  Process exits with a traceback during startup:  ``` INFO ... Code interpreter tools registered (9 tools) Traceback (most recent call last):   File ".../bi
  **Post-Mortem & Fix Analysis**:
  > encountering this issue as well
  > the same issue:  awslabs.amazon-bedrock-agentcore-mcp-server (all versions incl. 0.1.1) hardcodes a docs-index URL in config.py and fetches it at startup before serving. That URL — https://aws.github.io/bedrock-agentcore-starter-toolkit/llms.txt — now returns 404, crashing the whole MCP server so no Browser/Code-Interpreter tools register.  
  > +1, facing the same issue in my mac. When can we expect a fix?

- **Issue #4110** (2026-09-18): **(module name): (short issue description)**
  *Symptoms*: ### Describe the bug  [bugreport-sunny_global-SKQ1.210908.001-2026-06-23-01-19-50-dumpstate_log-9136.txt](https://github.com/user-attachments/files/29876445/bugreport-sunny_global-SKQ1.210908.001-2026-06-23-01-19-50-dumpstate_log-9136.txt) [bugreport-sunny_global-SKQ1.210908.001-2026-06-23-01-17-01-dumpstate_log-1003.txt](https://github.com/user-attachments/files/29876443/bugreport-sunny_global-SKQ1.210908.001-2026-06-23-01-17-01-dumpstate_log-1003.txt) [bugreport-sunny_global-SKQ1.210908.001-2026-06-23-01-19-50.zip](https://github.com/user-attachments/files/29876444/bugreport-sunny_global-SKQ1.210908.001-2026-06-23-01-19-50.zip)  ### Expected Behavior  [bugreport-sunny_global-SKQ1.210908.001-2026-06-25-08-37-53-dumpstate_log-14607.txt](https://github.com/user-attachments/files/29876430/bugreport-sunny_global-SKQ1.210908.001-2026-06-25-08-37-53-dumpstate_log-14607.txt) [bugreport-sunny_global-SKQ1.210908.001-2026-06-25-08-41-34-dumpstate_log-19735.txt](https://github.com/user-attachments/files/29876431/bugreport-sunny_global-SKQ1.210908.001-2026-06-25-08-41-34-dumpstate_log-19735.txt)  ### Current Behavior  [bugreport-sunny_global-SKQ1.210908.001-2026-06-19-00-54-29-dumpstate_log-25835.txt](https://github.com/user-attachments/files/29876450/bugreport-sunny_global-SKQ1.210908.001-2026-06-19-00-54-29-dumpstate_log-25835.txt) [bugreport-sunny_global-SKQ1.210908.001-2026-06-19-11-23-54-dumpstate_log-11031.txt](https://github.com/user-attachments/files/29876451/bugreport-sunny_glo
  **Post-Mortem & Fix Analysis**:
  > This issue is now marked as stale because it hasn't seen activity for a while. Add a comment or it will be closed soon. If you wish to exclude this issue from being marked as stale, add the "backlog" label.
  > Closing this issue as it hasn't seen activity for a while. Please add a comment @mentioning a maintainer to reopen. If you wish to exclude this issue from being marked as stale, add the "backlog" label.

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

### Incident Patch 1: `4b9401bc` (2026-09-30)
**Commit Message**: fix: service name interpreation in policy (#4693)

**File**: `src/aws-api-mcp-server/awslabs/aws_api_mcp_server/core/aws/service.py` (modified, +2/-1)
```diff
@@ -112,7 +112,8 @@ def is_read_only_func(service: str, operation: str) -> bool:
     ):
         return PolicyDecision.ELICIT if policy.supports_elicitation else PolicyDecision.DENY
 
-    service_name = ir.command_metadata.service_sdk_name
+    # Policy entries use the CLI service name (e.g. s3api), which can differ from the SDK name (s3)
+    service_name = ir.command_metadata.service_cli_name or ir.command_metadata.service_sdk_name
     operation_name = ir.command_metadata.operation_sdk_name
     is_read_only = is_operation_read_only(ir, read_only_operations)
 
```

**File**: `src/aws-api-mcp-server/awslabs/aws_api_mcp_server/core/common/command_metadata.py` (modified, +1/-0)
```diff
@@ -23,3 +23,4 @@ class CommandMetadata:
     service_full_sdk_name: str | None
     operation_sdk_name: str
     has_streaming_output: bool = False
+    service_cli_name: str | None = None
```

**File**: `src/aws-api-mcp-server/awslabs/aws_api_mcp_server/core/parser/parser.py` (modified, +1/-0)
```diff
@@ -431,6 +431,7 @@ def _handle_service_command(
         service_full_sdk_name=_service_full_name(service_command.service_model),
         operation_sdk_name=operation_command._operation_model.name,
         has_streaming_output=operation_command._operation_model.has_streaming_output,
+        service_cli_name=service,
     )
     _validate_global_args(service, global_args)
     region = getattr(global_args, 'region', None)
```

**File**: `src/aws-api-mcp-server/awslabs/aws_api_mcp_server/core/security/aws_api_customization.json` (modified, +3/-3)
```diff
@@ -267,7 +267,7 @@
         "aws emr wait"
       ]
     },
-    "emr terminate-cluster": {
+    "emr terminate-clusters": {
       "api_calls": [
         "aws emr terminate-job-flows"
       ]
@@ -279,12 +279,12 @@
         "aws iam update-assume-role-policy"
       ]
     },
-    "gamelist get-game-session-log": {
+    "gamelift get-game-session-log": {
       "api_calls": [
         "aws gamelift get-game-session-log-url"
       ]
     },
-    "gamelist upload-build": {
+    "gamelift upload-build": {
       "api_calls": [
         "aws gamelift create-build",
         "aws gamelift request-upload-credentials",
```

**File**: `src/aws-api-mcp-server/tests/aws/test_driver.py` (modified, +25/-5)
```diff
@@ -91,7 +91,10 @@ def test_get_local_credentials_raises_no_credentials_error(mock_session_class):
             S3_CLI_NO_REGION,
             IRTranslation(
                 command_metadata=CommandMetadata(
-                    's3', 'Amazon Simple Storage Service', 'ListBuckets'
+                    's3',
+                    'Amazon Simple Storage Service',
+                    'ListBuckets',
+                    service_cli_name='s3api',
                 ),
             ),
         ),
@@ -142,7 +145,10 @@ def test_get_local_credentials_raises_no_credentials_error(mock_session_class):
                     ).as_failure()
                 ],
                 command_metadata=CommandMetadata(
-                    'cloud9', 'AWS Cloud9', 'DescribeEnvironmentStatus'
+                    'cloud9',
+                    'AWS Cloud9',
+                    'DescribeEnvironmentStatus',
+                    service_cli_name='cloud9',
                 ),
             ),
         ),
@@ -156,7 +162,12 @@ def test_get_local_credentials_raises_no_credentials_error(mock_session_class):
                         CommandMetadata('kinesis', 'Amazon Kinesis', 'GetRecords'),
                     ).as_failure()
                 ],
-                command_metadata=CommandMetadata('kinesis', 'Amazon Kinesis', 'GetRecords'),
+                command_metadata=CommandMetadata(
+                    'kinesis',
+                    'Amazon Kinesis',
+                    'GetRecords',
+                    service_cli_name='kinesis',
+                ),
             ),
         ),
         (
@@ -206,6 +217,7 @@ def test_get_local_credentials_raises_no_credentials_error(mock_session_class):
                     's3',
                     'Amazon Simple Storage Service',
                     'GetBucketIntelligentTieringConfiguration',
+                    service_cli_name='s3api',
                 ),
             ),
         ),
@@ -267,13 +279,21 @@ def test_get_local_credentials_raises_no_credentials_error(mock_session_class):
             IRTranslation(
                 command=IRCommand(
                     command_metadata=CommandMetadata(
-                        'kinesis', 'Amazon Kinesis', 'DescribeStream'
+                        'kinesis',
+                        'Amazon Kinesis',
+                        'DescribeStream',
+                        service_cli_name='kinesis',
                     ),
                     region='us-east-1',
                     parameters={},
                     is_awscli_customization=False,
                 ),
-                command_metadata=CommandMetadata('kinesis', 'Amazon Kinesis', 'DescribeStream'),
+                command_metadata=CommandMetadata(
+                    'kinesis',
+                    'Amazon Kinesis',
+                    'DescribeStream',
+                    service_cli_name='kinesis',
+                ),
             ),
         ),
     ],
```

---

### Incident Patch 2: `32f2aea6` (2026-09-29)
**Commit Message**: fix(billing-cost-management-mcp-server): normalize ResourceType and Finding casing in get_idle_recommendations (#4682)

Case-fold ResourceType and Finding filter values onto the idle enums read
from the installed botocore service model, echo the normalized filters as
applied_filters, and return the valid enums on InvalidParameterValueException.

**File**: `src/billing-cost-management-mcp-server/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -38,6 +38,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Corrected AWS Compute Optimizer ECS and Lambda recommendation response field names that read non-existent SDK fields and returned null. ECS now reads `currentPerformanceRisk`, `autoScalingConfiguration`, and `projectedUtilizationMetrics` (previously the non-existent `currentPerformance`, `autoScalingGroupArn`, and `projectedPerformance`), and Lambda derives the function name from the ARN (there is no `functionName` field).
 - Fixed `aws-pricing` tool error responses omitting a structured error type. Each `aws-pricing` operation caught exceptions and returned `format_response('error', ...)` (everything nested under `data`, no top-level `error_type`/`operation`), so the `handle_aws_error` call in the tool wrapper was never reached and failures surfaced without a classifiable type. Operation error paths now route through `handle_aws_error` so responses carry top-level `error_type` and `operation`, and the two non-exception "no results" cases (`get_service_attributes` service-not-found, `get_pricing_from_api` empty price list) carry `error_type='no_results'` plus `operation`. The legacy `data` payload is preserved for backward compatibility.
 - Fixed `session-sql` tool error responses omitting a structured error type. `execute_session_sql` caught every failure and returned a bare `{'status': 'error', 'message': ...}` with no `error_type`/`operation`, so failures surfaced without a classifiable type. Error responses now carry top-level `error_type`, `operation` (`session_sql`), and `service` (`SQL`). The `error_type` is the exception class name (e.g. `OperationalError`, `IntegrityError`, `ValueError`) -- a fixed identifier that never contains the query text or bound values, so no query content is exposed. The legacy `status='error'` and `message` payload is preserved for backward compatibility.
+- Fixed the AWS Compute Optimizer `get_idle_recommendations` operation rejecting `ResourceType` and `Finding` filter values whose casing differs from the idle enums (e.g. `EbsVolume` instead of `EBSVolume`, `idle` instead of `Idle`). Passed values are now normalized case-insensitively against the idle enums read from the installed botocore service model, and the response echoes the normalized filters as `applied_filters`. An `InvalidParameterValueException` now returns a structured error listing `valid_resource_type_values` and `valid_finding_values` so callers can self-correct instead of retrying the same request.
 
 ## [0.0.4] - 2025-10-27
 ### Added
```

**File**: `src/billing-cost-management-mcp-server/awslabs/billing_cost_management_mcp_server/tools/compute_optimizer_tools.py` (modified, +90/-4)
```diff
@@ -17,6 +17,7 @@
 Updated to use shared utility functions.
 """
 
+import botocore.session
 import os
 from ..utilities.aws_service_base import (
     create_aws_client,
@@ -28,7 +29,8 @@
 from ..utilities.time_utils import timestamp_to_utc_iso_string
 from botocore.exceptions import ClientError
 from fastmcp import Context, FastMCP
-from typing import Any, Dict, Optional
+from functools import lru_cache
+from typing import Any, Dict, List, Optional
 
 
 compute_optimizer_server = FastMCP(
@@ -75,7 +77,8 @@
 - Unattached: Resource exists but isn't connected to anything
 - Unused: Resource is provisioned but sees no meaningful activity
 Its `filters` accept the filter names `Finding` (values: Idle, Unattached, Unused) and
-`ResourceType`.""",
+`ResourceType`. Finding and ResourceType values are matched case-insensitively and
+normalized to the idle enum spelling (e.g. ebsvolume is sent as EBSVolume, idle as Idle).""",
 )
 async def compute_optimizer(
     ctx: Context,
@@ -809,6 +812,59 @@ async def get_ecs_service_recommendations(
     return format_response('success', formatted_response)
 
 
+# Idle filter name -> botocore enum shape that holds its valid values.
+_IDLE_FILTER_ENUM_SHAPES = {
+    'ResourceType': 'IdleRecommendationResourceType',
+    'Finding': 'IdleFinding',
+}
+
+
+@lru_cache(maxsize=None)
+def _idle_enum_canonical_map(shape_name: str) -> Dict[str, str]:
+    """Build a casefolded -> canonical map of an idle filter enum from the boto model.
+
+    Used to normalize passed `ResourceType` and `Finding` values onto the exact spelling
+    the idle API expects (e.g. `EbsVolume` -> `EBSVolume`, `idle` -> `Idle`); every valid
+    value is recoverable by case-folding alone. The enum is read from the installed
+    botocore service model rather than hardcoded, so new values are supported
+    automatically whenever boto3 is upgraded. The model is loaded offline (no AWS call).
+
+    Returns:
+        Mapping of casefolded value to canonical value. Returns an empty map if the
+        service model or shape cannot be loaded (normalization is then skipped).
+    """
+    try:
+        service_model: Any = botocore.session.get_session().get_service_model('compute-optimizer')
+        enum_values = service_model.shape_for(shape_name).enum
+    except Exception:
+        # Older boto3 without this shape, or model load failure: skip normalization.
+        return {}
+    return {value.casefold(): value for value in enum_values or []}
+
+
+def _normalize_idle_filters(filters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
+    """Fold `ResourceType` and `Finding` filter values onto the canonical idle enum spelling.
+
+    Unrecognized values are passed through unchanged: the installed botocore model is a
+    floor, so the service stays the authority on which values are valid.
+    """
+    normalized = []
+    for f in filters:
+        name = f.get('name') if isinstance(f, dict) else None
+        shape_name = _IDLE_FILTER_ENUM_SHAPES.get(name) if isinstance(name, str) else None
+        canonical = _idle_enum_canonical_map(shape_name) if shape_name else {}
+        if canonical:
+            values = f.get('values') or []
+            f = {
+                **f,
+                'values': [
+                    canonical.get(v.casefold(), v) if isinstance(v, str) else v for v in values
+                ],
+            }
+        normalized.append(f)
+    return normalized
+
+
 async def get_idle_recommendations(ctx, co_client, max_results, filters, account_ids, next_token):
     """Get idle resource recommendations.
 
@@ -828,7 +884,7 @@ async def get_idle_recommendations(ctx, co_client, max_results, filters, account
 
     # Parse the filters if provided
     if filters:
-        request_params['filters'] = parse_json(filters, 'filters')
+        request_params['filters'] = _normalize_idle_filters(parse_json(filters, 'filters'))
 
     # Parse the account IDs if provided
     if account_ids:
@@ -840,13 +896,43 @@ as
```

**File**: `src/billing-cost-management-mcp-server/tests/tools/test_compute_optimizer_tools.py` (modified, +159/-0)
```diff
@@ -763,6 +763,165 @@ async def test_with_filters(self, mock_context, mock_co_client):
             assert call_kwargs['accountIds'] == ['123456789012']
             assert call_kwargs['nextToken'] == 'next-page-idle'
 
+    async def test_resource_type_filter_normalized_to_idle_casing(
+        self, mock_context, mock_co_client
+    ):
+        """Passed ResourceType and Finding values are normalized to the idle enum spelling."""
+        filters = json.dumps(
+            [
+                {'name': 'ResourceType', 'values': ['EbsVolume', 'ec2instance', 'NatGateway']},
+                {'name': 'Finding', 'values': ['unattached', 'IDLE', 'Unused']},
+            ]
+        )
+
+        result = await get_idle_recommendations(
+            mock_context,
+            mock_co_client,
+            max_results=None,
+            filters=filters,
+            account_ids=None,
+            next_token=None,
+        )
+
+        expected = [
+            {'name': 'ResourceType', 'values': ['EBSVolume', 'EC2Instance', 'NatGateway']},
+            {'name': 'Finding', 'values': ['Unattached', 'Idle', 'Unused']},
+        ]
+        call_kwargs = mock_co_client.get_idle_recommendations.call_args[1]
+        assert call_kwargs['filters'] == expected
+        assert result['status'] == 'success'
+        assert result['data']['applied_filters'] == expected
+
+    async def test_unknown_resource_type_passed_through(self, mock_context, mock_co_client):
+        """Values the installed model doesn't know (or non-strings) are forwarded unchanged."""
+        filters = json.dumps([{'name': 'ResourceType', 'values': ['SomeFutureType', 42]}])
+
+        await get_idle_recommendations(mock_context, mock_co_client, None, filters, None, None)
+
+        call_kwargs = mock_co_client.get_idle_recommendations.call_args[1]
+        assert call_kwargs['filters'] == [
+            {'name': 'ResourceType', 'values': ['SomeFutureType', 42]}
+        ]
+
+    async def test_unrelated_filter_names_passed_through(self, mock_context, mock_co_client):
+        """Filters without a known enum (other names, non-dict entries) are left untouched."""
+        filters = json.dumps([{'name': 'SomethingElse', 'values': ['ebsvolume']}, 'raw'])
+
+        await get_idle_recommendations(mock_context, mock_co_client, None, filters, None, None)
+
+        call_kwargs = mock_co_client.get_idle_recommendations.call_args[1]
+        assert call_kwargs['filters'] == [
+            {'name': 'SomethingElse', 'values': ['ebsvolume']},
+            'raw',
+        ]
+
+    async def test_invalid_parameter_value_returns_valid_enum(self, mock_context, mock_co_client):
+        """InvalidParameterValueException is returned with the valid ResourceType/Finding sets."""
+        from botocore.exceptions import ClientError
+
+        mock_co_client.get_idle_recommendations.side_effect = ClientError(
+            {
+                'Error': {
+                    'Code': 'InvalidParameterValueException',
+                    'Message': 'Invalid filter value',
+                }
+            },
+            'GetIdleRecommendations',
+        )
+        filters = json.dumps([{'name': 'ResourceType', 'values': ['LambdaFunction']}])
+
+        result = await get_idle_recommendations(
+            mock_context, mock_co_client, None, filters, None, None
+        )
+
+        assert result['status'] == 'error'
+        assert result['data']['error_type'] == 'invalid_parameter_value'
+        assert result['data']['filters'] == [
+            {'name': 'ResourceType', 'values': ['LambdaFunction']}
+        ]
+        valid = result['data']['valid_resource_type_values']
+        assert 'EBSVolume' in valid
+        assert 'LambdaFunction' not in valid
+        assert result['data']['valid_finding_values'] == ['Idle', 'Unattached', 'Unused']
+
+    async def test_other_client_errors_propagate(self, mock_context, mock_co_client):
+        """Non-InvalidParameterValue errors still reach the dispatche
```

---

### Incident Patch 3: `69a3cb03` (2026-09-29)
**Commit Message**: fix(billing-cost-management): add structured error_type to session-sql failures (#4680)

`execute_session_sql` caught every failure and returned a bare
`{'status': 'error', 'message': ...}` with no error_type, operation, or
service, so callers could not categorize session-sql tool failures and every
one surfaced as an unclassifiable error.

Error responses now carry a top-level `error_type`, `operation`
('session_sql'), and `service` ('SQL') alongside the existing status/message.
The `error_type` is the exception class name (e.g. 'OperationalError',
'IntegrityError', 'ValueError') -- a fixed Python identifier that never
contains the query text or any bound values, so no customer data is exposed.

The legacy `status='error'` and `message` payload is preserved unchanged for
backward compatibility. Adds unit tests for the SQLite and validation error
paths.

**File**: `src/billing-cost-management-mcp-server/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -37,6 +37,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Corrected AWS Compute Optimizer recommendation response field names so EC2, Auto Scaling group, Lambda, and RDS tools return actual values instead of null. Fixed the shared savings-opportunity parser (`savingsOpportunityPercentage`), projected utilization metrics, EC2/RDS idle flags, nested ASG instance types, and the RDS instance/storage recommendation schema.
 - Corrected AWS Compute Optimizer ECS and Lambda recommendation response field names that read non-existent SDK fields and returned null. ECS now reads `currentPerformanceRisk`, `autoScalingConfiguration`, and `projectedUtilizationMetrics` (previously the non-existent `currentPerformance`, `autoScalingGroupArn`, and `projectedPerformance`), and Lambda derives the function name from the ARN (there is no `functionName` field).
 - Fixed `aws-pricing` tool error responses omitting a structured error type. Each `aws-pricing` operation caught exceptions and returned `format_response('error', ...)` (everything nested under `data`, no top-level `error_type`/`operation`), so the `handle_aws_error` call in the tool wrapper was never reached and failures surfaced without a classifiable type. Operation error paths now route through `handle_aws_error` so responses carry top-level `error_type` and `operation`, and the two non-exception "no results" cases (`get_service_attributes` service-not-found, `get_pricing_from_api` empty price list) carry `error_type='no_results'` plus `operation`. The legacy `data` payload is preserved for backward compatibility.
+- Fixed `session-sql` tool error responses omitting a structured error type. `execute_session_sql` caught every failure and returned a bare `{'status': 'error', 'message': ...}` with no `error_type`/`operation`, so failures surfaced without a classifiable type. Error responses now carry top-level `error_type`, `operation` (`session_sql`), and `service` (`SQL`). The `error_type` is the exception class name (e.g. `OperationalError`, `IntegrityError`, `ValueError`) -- a fixed identifier that never contains the query text or bound values, so no query content is exposed. The legacy `status='error'` and `message` payload is preserved for backward compatibility.
 
 ## [0.0.4] - 2025-10-27
 ### Added
```

**File**: `src/billing-cost-management-mcp-server/awslabs/billing_cost_management_mcp_server/utilities/sql_utils.py` (modified, +11/-1)
```diff
@@ -1495,7 +1495,17 @@ async def execute_session_sql(
         # Use context logger for consistent error reporting
         ctx_logger = get_context_logger(ctx, __name__)
         await ctx_logger.error(error_message, exc_info=True)
-        return {'status': 'error', 'message': error_message}
+
+        # Add a structured error_type/operation/service so failures are
+        # classifiable. error_type is the exception class name only (e.g.
+        # 'OperationalError').
+        return {
+            'status': 'error',
+            'service': 'SQL',
+            'operation': 'session_sql',
+            'error_type': type(e).__name__,
+            'message': error_message,
+        }
 
     finally:
         # Close connection only if it was successfully opened
```

**File**: `src/billing-cost-management-mcp-server/tests/utilities/test_sql_utils.py` (modified, +44/-0)
```diff
@@ -497,6 +497,50 @@ async def test_execute_with_error(self, mock_get_path, mock_connect, mock_contex
         assert 'Error executing SQL query' in result['message']
         assert 'SQL syntax error' in result['message']
 
+        # The error envelope carries a structured, query-content-free error_type
+        # plus operation/service so failures are classifiable. This exception is
+        # a manually constructed sqlite3.Error (no sqlite_errorname), so it falls
+        # back to the exception-class name ('Error').
+        assert result['error_type'] == 'Error'
+        assert result['operation'] == 'session_sql'
+        assert result['service'] == 'SQL'
+
+    @patch('awslabs.billing_cost_management_mcp_server.utilities.sql_utils.get_session_db_path')
+    async def test_execute_error_classified_by_exception_class(self, mock_get_path, mock_context):
+        """A real SQLite failure classifies by its exception class name."""
+        # Use a real in-memory connection (no sqlite3.connect mock) so a genuine
+        # sqlite3.OperationalError is raised.
+        mock_get_path.return_value = ':memory:'
+
+        # Query a table that does not exist -> real sqlite3.OperationalError.
+        result = await execute_session_sql(mock_context, 'SELECT * FROM missing_table')
+
+        assert result['status'] == 'error'
+        assert 'Error executing SQL query' in result['message']
+        assert result['error_type'] == 'OperationalError'
+        assert result['operation'] == 'session_sql'
+        assert result['service'] == 'SQL'
+
+    @patch('sqlite3.connect')
+    @patch('awslabs.billing_cost_management_mcp_server.utilities.sql_utils.get_session_db_path')
+    async def test_execute_validation_error_classified(
+        self, mock_get_path, mock_connect, mock_context
+    ):
+        """A blocked/harmful query classifies by its exception class ('ValueError')."""
+        mock_get_path.return_value = '/mock/path/session.db'
+        mock_connection = MagicMock()
+        mock_connection.cursor.return_value = MagicMock()
+        mock_connect.return_value = mock_connection
+
+        # validate_sql_query raises ValueError before execute is reached.
+        result = await execute_session_sql(mock_context, 'DROP TABLE users')
+
+        assert result['status'] == 'error'
+        assert 'Error executing SQL query' in result['message']
+        assert result['error_type'] == 'ValueError'
+        assert result['operation'] == 'session_sql'
+        assert result['service'] == 'SQL'
+
     @patch('sqlite3.connect')
     @patch('awslabs.billing_cost_management_mcp_server.utilities.sql_utils.get_session_db_path')
     async def test_execute_query_write_operation(self, mock_get_path, mock_connect, mock_context):
```

---

### Incident Patch 4: `1941e37b` (2026-09-25)
**Commit Message**: fix(billing-cost-management): route aws-pricing errors through handle_aws_error (#4676)

Each aws-pricing operation wrapped its body in a broad `except Exception`
that returned `format_response('error', ...)` — nesting everything under
`data` with no top-level `error_type`/`operation`. As a result the
`handle_aws_error` call in the tool wrapper was effectively dead code and
every aws-pricing failure surfaced without a classifiable error type.

Route each operation's except block through the shared `handle_aws_error`
so responses carry top-level `error_type` and `operation`, and give the two
non-exception "no results" cases (`get_service_attributes` service-not-found
and `get_pricing_from_api` empty price list) `error_type='no_results'` plus
`operation`. The legacy `data` payload is preserved for backward
compatibility. Adds unit tests covering each operation's error path.

**File**: `src/billing-cost-management-mcp-server/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -35,6 +35,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Fixed `get_savings_plans_utilization_details` reporting every plan's utilization and savings as zero, from the same two causes. Rows now pass through as the API sends them, including the previously discarded `AmortizedCommitment` block and the whole of `Attributes` -- superseding the `summary` block, which read lowercase keys the API does not send, and exposing the owning `AccountId`
 - Corrected AWS Compute Optimizer recommendation response field names so EC2, Auto Scaling group, Lambda, and RDS tools return actual values instead of null. Fixed the shared savings-opportunity parser (`savingsOpportunityPercentage`), projected utilization metrics, EC2/RDS idle flags, nested ASG instance types, and the RDS instance/storage recommendation schema.
 - Corrected AWS Compute Optimizer ECS and Lambda recommendation response field names that read non-existent SDK fields and returned null. ECS now reads `currentPerformanceRisk`, `autoScalingConfiguration`, and `projectedUtilizationMetrics` (previously the non-existent `currentPerformance`, `autoScalingGroupArn`, and `projectedPerformance`), and Lambda derives the function name from the ARN (there is no `functionName` field).
+- Fixed `aws-pricing` tool error responses omitting a structured error type. Each `aws-pricing` operation caught exceptions and returned `format_response('error', ...)` (everything nested under `data`, no top-level `error_type`/`operation`), so the `handle_aws_error` call in the tool wrapper was never reached and failures surfaced without a classifiable type. Operation error paths now route through `handle_aws_error` so responses carry top-level `error_type` and `operation`, and the two non-exception "no results" cases (`get_service_attributes` service-not-found, `get_pricing_from_api` empty price list) carry `error_type='no_results'` plus `operation`. The legacy `data` payload is preserved for backward compatibility.
 
 ## [0.0.4] - 2025-10-27
 ### Added
```

**File**: `src/billing-cost-management-mcp-server/awslabs/billing_cost_management_mcp_server/tools/aws_pricing_operations.py` (modified, +68/-36)
```diff
@@ -23,6 +23,7 @@
 from ..utilities.aws_service_base import (
     create_aws_client,
     format_response,
+    handle_aws_error,
     parse_json,
 )
 from ..utilities.logging_utils import get_context_logger
@@ -31,6 +32,8 @@
 from typing import Any, Dict, Optional
 
 
+AWS_PRICING_SERVICE_NAME = 'AWS Pricing'
+
 PRICING_API_REGIONS = {
     'classic': ['us-east-1', 'eu-central-1', 'ap-south-1'],
     'china': ['cn-northwest-1'],
@@ -140,8 +143,12 @@ async def get_service_codes(ctx: Context, max_results: Optional[int] = None) ->
         )
 
     except Exception as e:
-        # Use standard error format
-        return format_response('error', {'message': f'Error retrieving service codes: {str(e)}'})
+        # Route through the shared handler so the response carries a top-level
+        # error_type + operation (consistent structured error shape), while
+        # keeping the legacy `data.message` payload for backward compatibility.
+        classified = await handle_aws_error(ctx, e, 'get_service_codes', AWS_PRICING_SERVICE_NAME)
+        classified['data'] = {'message': f'Error retrieving service codes: {str(e)}'}
+        return classified
 
 
 async def get_service_attributes(ctx: Context, service_code: str) -> Dict[str, Any]:
@@ -165,9 +172,17 @@ async def get_service_attributes(ctx: Context, service_code: str) -> Dict[str, A
 
         # Check if service exists
         if not response.get('Services'):
-            return format_response(
-                'error', {'message': f'No service found with code: {service_code}'}
-            )
+            # Not an exception, but still an error response. Emit a top-level
+            # error_type + operation (consistent structured error shape) while
+            # keeping the legacy `data.message` payload for compatibility.
+            message = f'No service found with code: {service_code}'
+            return {
+                **format_response('error', {'message': message}),
+                'service': AWS_PRICING_SERVICE_NAME,
+                'operation': 'get_service_attributes',
+                'error_type': 'no_results',
+                'message': message,
+            }
 
         # Extract attributes
         attributes = []
@@ -189,11 +204,16 @@ async def get_service_attributes(ctx: Context, service_code: str) -> Dict[str, A
         )
 
     except Exception as e:
-        # Use standard error format
-        return format_response(
-            'error',
-            {'message': f'Failed to retrieve attributes for service {service_code}: {str(e)}'},
+        # Route through the shared handler so the response carries a top-level
+        # error_type + operation (consistent structured error shape), while
+        # keeping the legacy `data.message` payload for backward compatibility.
+        classified = await handle_aws_error(
+            ctx, e, 'get_service_attributes', AWS_PRICING_SERVICE_NAME
         )
+        classified['data'] = {
+            'message': f'Failed to retrieve attributes for service {service_code}: {str(e)}'
+        }
+        return classified
 
 
 async def get_attribute_values(
@@ -272,13 +292,16 @@ async def get_attribute_values(
         )
 
     except Exception as e:
-        # Use standard error format
-        return format_response(
-            'error',
-            {
-                'message': f'Failed to retrieve values for attribute {attribute_name} of service {service_code}: {str(e)}'
-            },
+        # Route through the shared handler so the response carries a top-level
+        # error_type + operation (consistent structured error shape), while
+        # keeping the legacy `data.message` payload for backward compatibility.
+        classified = await handle_aws_error(
+            ctx, e, 'get_attribute_values', AWS_PRICING_SERVICE_NAME
         )
+        classified['data'] = {
+            'message': f'Failed to retrieve values for attribute {attribute_name} of service {service_code}: {str(e)}'
+        }
```

**File**: `src/billing-cost-management-mcp-server/awslabs/billing_cost_management_mcp_server/tools/aws_pricing_tools.py` (modified, +2/-1)
```diff
@@ -21,6 +21,7 @@
 
 # Import operation handlers from local module
 from .aws_pricing_operations import (
+    AWS_PRICING_SERVICE_NAME,
     get_attribute_values,
     get_pricing_from_api,
     get_service_attributes,
@@ -134,4 +135,4 @@ async def aws_pricing(
 
     except Exception as e:
         # Use shared error handler for consistent error reporting
-        return await handle_aws_error(ctx, e, operation, 'AWS Pricing')
+        return await handle_aws_error(ctx, e, operation, AWS_PRICING_SERVICE_NAME)
```

**File**: `src/billing-cost-management-mcp-server/tests/tools/test_aws_pricing_tools.py` (modified, +100/-0)
```diff
@@ -737,6 +737,101 @@ async def test_ap_real_get_service_attributes_reload_identity_decorator(mock_con
     assert 'service_code is required' in res2.get('data', {}).get('message', '')
 
 
+# ---------------------------------------------------------------------------
+# Every aws-pricing error response must carry a top-level error_type +
+# operation so error metrics have a structured type to classify. The legacy
+# `data.*` payload is preserved for backward compatibility.
+# ---------------------------------------------------------------------------
+
+
+@pytest.mark.asyncio
+@patch('awslabs.billing_cost_management_mcp_server.tools.aws_pricing_operations.create_aws_client')
+async def test_get_service_codes_error_carries_classifier_fields(mock_create_client):
+    """get_service_codes exception path: top-level error_type + operation, legacy data kept."""
+    mock_context = AsyncMock()
+    mock_create_client.side_effect = Exception('boom')
+
+    result = await get_service_codes(mock_context)
+
+    assert result['status'] == 'error'
+    assert 'error_type' in result
+    assert result['operation'] == 'get_service_codes'
+    # Backward-compatible legacy payload preserved.
+    assert 'Error retrieving service codes' in result['data']['message']
+
+
+@pytest.mark.asyncio
+@patch('awslabs.billing_cost_management_mcp_server.tools.aws_pricing_operations.create_aws_client')
+async def test_get_service_attributes_error_carries_classifier_fields(mock_create_client):
+    """get_service_attributes exception path: top-level error_type + operation, legacy data kept."""
+    mock_context = AsyncMock()
+    mock_client = MagicMock()
+    mock_create_client.return_value = mock_client
+    mock_client.describe_services.side_effect = Exception('boom')
+
+    result = await get_service_attributes(mock_context, 'AmazonEC2')
+
+    assert result['status'] == 'error'
+    assert 'error_type' in result
+    assert result['operation'] == 'get_service_attributes'
+    assert 'Failed to retrieve attributes' in result['data']['message']
+
+
+@pytest.mark.asyncio
+@patch('awslabs.billing_cost_management_mcp_server.tools.aws_pricing_operations.create_aws_client')
+async def test_get_service_attributes_no_results_carries_classifier_fields(mock_create_client):
+    """get_service_attributes 'no service found': error_type=no_results, legacy data.message kept."""
+    mock_context = AsyncMock()
+    mock_client = MagicMock()
+    mock_create_client.return_value = mock_client
+    mock_client.describe_services.return_value = {'Services': []}
+
+    result = await get_service_attributes(mock_context, 'NonExistentService')
+
+    assert result['status'] == 'error'
+    assert result['error_type'] == 'no_results'
+    assert result['operation'] == 'get_service_attributes'
+    assert 'NonExistentService' in result['message']
+    assert 'NonExistentService' in result['data']['message']
+
+
+@pytest.mark.asyncio
+@patch('awslabs.billing_cost_management_mcp_server.tools.aws_pricing_operations.create_aws_client')
+async def test_get_attribute_values_error_carries_classifier_fields(mock_create_client):
+    """get_attribute_values exception path: top-level error_type + operation, legacy data kept."""
+    mock_context = AsyncMock()
+    mock_client = MagicMock()
+    mock_create_client.return_value = mock_client
+    mock_client.get_attribute_values.side_effect = Exception('boom')
+
+    result = await get_attribute_values(mock_context, 'AmazonEC2', 'instanceType')
+
+    assert result['status'] == 'error'
+    assert 'error_type' in result
+    assert result['operation'] == 'get_attribute_values'
+    assert 'Failed to retrieve values' in result['data']['message']
+
+
+@pytest.mark.asyncio
+@patch('awslabs.billing_cost_management_mcp_server.tools.aws_pricing_operations.create_aws_client')
+async def test_get_pricing_from_api_error_carries_classifier_fields(mock_create_client):
+    """get_pricing_from_api exception path: top-level error_type + operation, lega
```

---

### Incident Patch 5: `3e0418ff` (2026-09-23)
**Commit Message**: fix(aws-documentation-mcp-server)!: correct read-path output and make failures raise (#4650)

Correctness fixes in the HTML-to-markdown read path, plus a deliberate change to how the
read tools signal failure. All of it was found by reading real docs.aws.amazon.com pages
through the server and comparing the output to the rendered page.

Text was fused where markup separated it
- get_text(strip=True) strips each text node and joins them with nothing, so two
  endpoints came back as 'sts.a.amazonaws.comsts.a.api.aws' and the protocol cell as
  'HTTPSHTTPS'. Values now join with '; ', which keeps the Nth value in one column
  aligned with the Nth in the next.
- The same strip deleted the spaces around inline tags, so 'use the <code>Switch
  Role</code> feature' became 'use theSwitch Rolefeature'. Cells holding a link took a
  separate path that spaced correctly, so identical prose rendered two ways depending on
  whether an anchor happened to be present.
- Both section-title matches were affected, which is not cosmetic: a heading of
  'Using the <code>Switch Role</code> API' normalized to 'UsingtheSwitchRoleAPI', so a
  caller passing the heading as rendered got no match, and the erro

**File**: `src/aws-documentation-mcp-server/awslabs/aws_documentation_mcp_server/models.py` (modified, +0/-1)
```diff
@@ -129,5 +129,4 @@ class SearchTableResponse(BaseModel):
     tables_searched: int
     tables_with_matches: int
     results: List[TableResult]
-    error: Optional[str] = None
     hint: Optional[str] = None
```

**File**: `src/aws-documentation-mcp-server/awslabs/aws_documentation_mcp_server/server_aws.py` (modified, +0/-1)
```diff
@@ -338,7 +338,6 @@ async def search_table(
     - tables_searched: Number of tables searched
     - tables_with_matches: Number of tables containing matching rows
     - hint: Guidance message when no matches found, section not found, or no tables on page
-    - error: Error message on HTTP/transport failures only
     - results: Array of table result objects, each with:
         - table_heading: The sub-heading above the table (if any)
         - columns: Column headers for that table
```

**File**: `src/aws-documentation-mcp-server/awslabs/aws_documentation_mcp_server/server_aws_cn.py` (modified, +7/-1)
```diff
@@ -22,6 +22,7 @@
 
 # Import utility functions
 from awslabs.aws_documentation_mcp_server.util import (
+    UnreadablePageError,
     enforce_redirect_allowlist,
     extract_content_from_html,
     format_documentation_result,
@@ -234,7 +235,12 @@ async def get_available_services(
         )
 
     if is_html_content(page_raw, content_type):
-        content = extract_content_from_html(page_raw)
+        try:
+            content = extract_content_from_html(page_raw)
+        except UnreadablePageError as e:
+            logger.error(f'Failed to read {url_str}: {e}')
+            await ctx.error(f'Failed to read {url_str}: {e}')
+            content = f'Note: {e}'
     else:
         content = page_raw
 
```

**File**: `src/aws-documentation-mcp-server/awslabs/aws_documentation_mcp_server/server_utils.py` (modified, +122/-54)
```diff
@@ -13,12 +13,14 @@
 # limitations under the License.
 import httpx
 import os
+import posixpath
 from awslabs.aws_documentation_mcp_server.models import (
     SearchResponse,
     SearchTableResponse,
     TableResult,
 )
 from awslabs.aws_documentation_mcp_server.util import (
+    UnreadablePageError,
     enforce_redirect_allowlist,
     extract_content_from_html,
     extract_sections_from_html,
@@ -27,6 +29,7 @@
     truncate_large_tables,
 )
 from collections import deque
+from dataclasses import dataclass
 from importlib.metadata import version
 from loguru import logger
 from mcp.server.mcpserver import Context
@@ -64,6 +67,53 @@ def _docs_client(allowed_domain_regexes: Sequence[str]) -> httpx.AsyncClient:
 )
 
 
+# - '/a/index.html' 301s to '/a/' everywhere on the site
+# - a missing page gets a 302 to '/a/' instead
+_DIRECTORY_INDEX_FILENAME = 'index.html'
+
+
+def _normalize_path(path: str) -> str:
+    """Reduce a URL path to the page it addresses, so cosmetic rewrites compare equal."""
+    # normpath collapses interior '//' but keeps a leading one, so strip it.
+    resolved = posixpath.normpath(path or '/').replace('//', '/', 1)
+    if posixpath.basename(resolved).lower() == _DIRECTORY_INDEX_FILENAME:
+        resolved = posixpath.dirname(resolved)
+    return resolved.rstrip('/') or '/'
+
+
+def _page_identity(url: str) -> str:
+    """Reduce a URL to host and path, so scheme, query, fragment and path spelling do not differ."""
+    parsed = httpx.URL(url)
+    return f'{parsed.host}{_normalize_path(parsed.path)}'
+
+
+def _without_query(url: str) -> str:
+    """Drop the session and query parameters, so URLs compare and display cleanly."""
+    return url.split('?', 1)[0]
+
+
+@dataclass(frozen=True)
+class Page:
+    """The page asked for and the page that answered."""
+
+    requested: str
+    served: str
+
+    @classmethod
+    def of(cls, url_str: str, response: httpx.Response) -> 'Page':
+        """Build from a completed response, stripping query parameters from both URLs."""
+        return cls(_without_query(url_str), _without_query(str(response.url)))
+
+    def message(self, *parts: str) -> str:
+        """Join a substitution note and any reasons into one sentence run."""
+        note = (
+            f'Requested {self.requested}; served {self.served}.'
+            if _page_identity(self.served) != _page_identity(self.requested)
+            else ''
+        )
+        return ' '.join(part for part in (note, *parts) if part)
+
+
 async def read_documentation_impl(
     ctx: Context,
     url_str: str,
@@ -97,24 +147,36 @@ async def read_documentation_impl(
             error_msg = f'Failed to fetch {url_str}: {str(e)}'
             logger.error(error_msg)
             await ctx.error(error_msg)
-            return error_msg
+            raise ValueError(error_msg) from e
+
+        page = Page.of(url_str, response)
 
         if response.status_code >= 400:
-            error_msg = f'Failed to fetch {url_str} - status code {response.status_code}'
+            error_msg = page.message(
+                f'Failed to fetch {page.served} - status code {response.status_code}'
+            )
             logger.error(error_msg)
             await ctx.error(error_msg)
-            return error_msg
+            raise ValueError(error_msg)
 
         page_raw = response.text
         content_type = response.headers.get('content-type', '')
 
     if is_html_content(page_raw, content_type):
-        content = extract_content_from_html(page_raw)
-        content = truncate_large_tables(content, url=url_str)
+        try:
+            content = extract_content_from_html(page_raw)
+        except UnreadablePageError as e:
+            error_msg = page.message(f'{page.served} could not be read: {e}')
+            logger.error(error_msg)
+            await ctx.error(error_msg)
+            raise ValueError(error_msg) from e
+        content = truncate_large_tables(content, url=page.served)
     else:
        
```

**File**: `src/aws-documentation-mcp-server/awslabs/aws_documentation_mcp_server/table_utils.py` (modified, +135/-15)
```diff
@@ -14,11 +14,119 @@
 """Table parsing and filtering utilities for AWS Documentation MCP Server."""
 
 import re
+from awslabs.aws_documentation_mcp_server.util import (
+    UnreadablePageError,
+    has_empty_link_target,
+    has_readable_text,
+)
 from bs4 import BeautifulSoup, Tag
 from bs4.element import NavigableString
 from typing import Optional
 
 
+# callout markup: block gets 'awsdocs-note', title gets 'awsdocs-note-title'
+_CALLOUT_CLASSES = ('awsdocs-note-title', 'awsdocs-note')
+_CALLOUT_TITLE_CLASS = 'awsdocs-note-title'
+_HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
+
+
+def _in_callout(element: Tag) -> bool:
+    """Report whether an element belongs to a callout rather than to content."""
+    for candidate in (element, *element.parents):
+        classes = candidate.get('class') or [] if isinstance(candidate, Tag) else []
+        if any(cls in _CALLOUT_CLASSES for cls in classes):
+            return True
+    return False
+
+
+# '; ' keeps the Nth value in one column aligned with the Nth in the next
+# without it two endpoints fuse: 'sts.a.amazonaws.comsts.a.api.aws'
+_VALUE_DELIMITER = '; '
+_BREAK_MARKER = '\x00'  # boundary marker; whitespace would be stripped, this survives
+# - callout prose is not a value, it modifies one
+# - so its boundary collapses to a space
+_SOFT_MARKER = '\x01'
+_BREAK_TAGS = ['br', 'p', 'div', 'li', 'dt', 'dd', 'tr']
+
+
+# - 'a | callout | b' -> 'a callout; b'
+# - absorb before, keep after
+_ADJACENT_MARKERS = re.compile(f'[{_BREAK_MARKER}\\s]*{_SOFT_MARKER}[{_SOFT_MARKER}\\s]*')
+# - a leading callout has no value before it, so it qualifies the one after
+# - 'callout | a | b' -> 'callout a; b'
+_LEADING_CALLOUT = re.compile(
+    f'^([{_BREAK_MARKER}\\s]*{_SOFT_MARKER}[^{_BREAK_MARKER}]*){_BREAK_MARKER}+'
+)
+
+
+def _join_values(text: str) -> str:
+    """Join marker-separated values with '; ', dropping empty segments."""
+    absorbed = _ADJACENT_MARKERS.sub(_SOFT_MARKER, text)
+    absorbed = _LEADING_CALLOUT.sub(f'\\1{_SOFT_MARKER}', absorbed)
+    segments = (_collapse_soft_breaks(segment) for segment in absorbed.split(_BREAK_MARKER))
+    return _VALUE_DELIMITER.join(segment for segment in segments if segment)
+
+
+def _collapse_soft_breaks(segment: str) -> str:
+    """Reduce soft boundaries and surrounding whitespace to single spaces."""
+    return ' '.join(segment.replace(_SOFT_MARKER, ' ').split())
+
+
+def _mark_breaks(cell: Tag) -> None:
+    """Insert boundary markers at <br /> and block-element edges inside a cell."""
+    for tag in (t for t in cell.find_all(_BREAK_TAGS) if isinstance(t, Tag)):
+        marker = _SOFT_MARKER if _in_callout(tag) else _BREAK_MARKER
+        if tag.name == 'br':
+            tag.replace_with(NavigableString(marker))
+        else:
+            tag.insert_before(NavigableString(marker))
+            tag.insert_after(NavigableString(marker))
+
+
+def _mark_preformatted_lines(cell: Tag) -> None:
+    """Treat newlines inside <pre> as value boundaries, where they are significant markup."""
+    for pre in (p for p in cell.find_all('pre') if isinstance(p, Tag)):
+        for text in list(pre.find_all(string=True)):
+            raw = str(text)
+            if '\n' in raw:
+                text.replace_with(NavigableString(re.sub(r'\n+', _BREAK_MARKER, raw)))
+
+
+def _strip_callout_titles(cell: Tag) -> None:
+    """Remove 'Note' and 'Important' labels, which are chrome rather than cell content."""
+    for title in (t for t in cell.find_all(class_=_CALLOUT_TITLE_CLASS) if isinstance(t, Tag)):
+        title.decompose()
+
+
+def _replace_images_with_alt(cell: Tag) -> None:
+    """Replace each image with its alt text; an icon's meaning is written only there."""
+    for img in (i for i in cell.find_all('img') if isinstance(i, Tag)):
+        alt = str(img.get('alt', '')).strip()
+        img.replace_with(NavigableString(f' {alt} ' if alt else ''))
+
+
+def _cell_text(cell: Tag) -> str:
+    """Extract cell text, joining mu
```

---

### Incident Patch 6: `2fec2904` (2026-09-22)
**Commit Message**: fix(aws-healthomics-mcp-server): report truthful pagination state for date-filtered ListRuns (#4639)

* fix(aws-healthomics-mcp-server): emit nextToken on truncated date-filtered list_runs results

When created_after/created_before is supplied, list_runs filters runs
client-side after fetching raw batches from the HealthOmics API. If the
filtered set exceeded max_results, the response was truncated and
nextToken was always omitted, so callers had no signal that more
matching runs existed and would treat a partial page as complete.

Re-emit the upstream nextToken on this path when one is available,
populating the same optional response key already used on the
unfiltered path with the same kind of value (the raw upstream
continuation token). This does not change what nextToken means for
existing callers.

Known residual limitation, documented in code: resuming with this
token can skip matches that were already fetched into the truncated
batch but excluded by the max_results slice, since continuation only
resumes from unfetched upstream pages. This is a strict improvement
over the prior behavior (which always silently claimed completeness)
and is called out for follow-up rather than s

**File**: `src/aws-healthomics-mcp-server/awslabs/aws_healthomics_mcp_server/tools/workflow_execution.py` (modified, +26/-8)
```diff
@@ -548,14 +548,32 @@ async def list_runs(
 
             result = {'runs': result_runs}
 
-            # If we have more filtered results than max_results, we could implement
-            # a custom pagination token, but for simplicity we'll omit nextToken
-            # when client-side filtering is applied
-            if len(filtered_runs) > max_results:
-                logger.info(
-                    f'Client-side filtering returned {len(filtered_runs)} results, '
-                    f'truncated to {max_results}. Pagination not supported with date filters.'
-                )
+            # If the filtered set was truncated to max_results, signal that more
+            # matching runs may exist rather than silently returning a short page.
+            # The upstream token (if any) is a best-effort resume point, not a fully
+            # correct cursor: resuming with it fetches upstream pages after the
+            # batches already scanned, so it skips the excess matches that were
+            # already fetched into this batch but discarded here by truncation.
+            if len(filtered_runs) >= max_results:
+                if current_token:
+                    result['nextToken'] = current_token
+                    logger.info(
+                        f'Client-side filtering returned {len(filtered_runs)} results, '
+                        f'truncated to {max_results}. Returning upstream nextToken so '
+                        'the caller can continue pagination.'
+                    )
+                elif len(filtered_runs) > max_results:
+                    # Matching runs were discarded by the max_results slice above and
+                    # upstream is exhausted, so there is no token to hand back at all.
+                    # Raise the pagination.has_more flag the wrapper's nested-pagination
+                    # idiom already recognizes, so it reports this page as incomplete
+                    # instead of fabricating a COMPLETE result.
+                    result['pagination'] = {'has_more': True}
+                    logger.info(
+                        f'Client-side filtering returned {len(filtered_runs)} results, '
+                        f'truncated to {max_results}. No further upstream pages are '
+                        'available, so no nextToken can be issued for the remaining matches.'
+                    )
 
             return result
         else:
```

**File**: `src/aws-healthomics-mcp-server/awslabs/aws_healthomics_mcp_server/utils/pagination.py` (modified, +1/-1)
```diff
@@ -191,7 +191,7 @@ async def wrapper(*args: Any, **kwargs: Any) -> Any:
         if isinstance(nested, dict) and 'has_more' in nested:
             token = nested.get('continuation_token')
             is_complete = not bool(nested['has_more'])
-            returned_count = len(result.get('results', []))
+            returned_count = _first_list_length(result.values())
             nested.update(
                 _pagination_block(is_complete, returned_count, tool_name, param_name, token)
             )
```

**File**: `src/aws-healthomics-mcp-server/tests/test_pagination_hints_real_shapes.py` (modified, +159/-5)
```diff
@@ -41,8 +41,10 @@
 import pytest
 from awslabs.aws_healthomics_mcp_server.tools.ecr_tools import list_ecr_repositories
 from awslabs.aws_healthomics_mcp_server.tools.genomics_file_search import search_genomics_files
+from awslabs.aws_healthomics_mcp_server.tools.workflow_execution import list_runs
 from awslabs.aws_healthomics_mcp_server.tools.workflow_management import list_workflows
 from awslabs.aws_healthomics_mcp_server.utils.pagination import paginating
+from datetime import datetime, timedelta, timezone
 
 # Reusing test_ecr_tools.py's private mock-building helpers deliberately, per
 # this task's brief, rather than duplicating a second copy of the ECR client
@@ -61,11 +63,9 @@
 # ---------------------------------------------------------------------------
 # Dict + nextToken idiom: ListAHOWorkflows.
 #
-# list_runs (workflow_execution.py) uses this idiom's response shape too, but
-# is deliberately NOT pinned here: it has a separate, already-tracked
-# false-completeness bug (client-side date filtering can truncate results
-# without ever setting nextToken), and a guard test would either bake that
-# bug in as "correct" or assert a fix that doesn't exist yet. list_workflows
+# list_runs (workflow_execution.py) uses this idiom's response shape too;
+# its own date-filter truncation cases are pinned separately below in
+# TestDictNextTokenIdiomAgainstRealListRunsDateFilterTruncation. list_workflows
 # builds its response the same way (a single transformed list plus a
 # conditionally-present nextToken key) without that complication, so it pins
 # the idiom's shape invariant on its own.
@@ -147,6 +147,160 @@ async def test_complete_page_pagination_block_matches_real_response(self):
         assert 'no further calls are needed' in pagination['instruction'].lower()
 
 
+class TestDictNextTokenIdiomAgainstRealListRunsDateFilterTruncation:
+    """Wraps the real ``list_runs`` with a mocked ``get_omics_client``.
+
+    Pins the two false-completeness cases in ListAHORuns' client-side
+    date-filter truncation path: the ``== max_results`` boundary, and the
+    falsy-token case where upstream is exhausted at the moment of
+    truncation.
+    """
+
+    def _run_items(self, count: int):
+        base_time = datetime(2023, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
+        return [
+            {
+                'id': f'run-{i}',
+                'name': f'run-{i}',
+                'status': 'COMPLETED',
+                'workflowId': f'wfl-{i}',
+                'workflowType': 'WDL',
+                'creationTime': base_time + timedelta(days=i),
+            }
+            for i in range(count)
+        ]
+
+    @pytest.mark.asyncio
+    async def test_boundary_exact_max_results_with_upstream_token_is_incomplete(self):
+        """Filtered set == max_results and an upstream current_token exists.
+
+        Before the fix, the truncation check was strictly
+        ``len(filtered_runs) > max_results``, so an exact match emitted no
+        nextToken even though more matching runs might exist upstream, and
+        the wrapper reported this page as COMPLETE.
+        """
+        mock_response = {
+            'items': self._run_items(10),  # exactly max_results
+            'nextToken': 'upstream-token-boundary',
+        }
+
+        mock_ctx = AsyncMock()
+        mock_client = MagicMock()
+        mock_client.list_runs.return_value = mock_response
+
+        wrapped = paginating('ListAHORuns', list_runs)
+
+        with patch(
+            'awslabs.aws_healthomics_mcp_server.tools.workflow_execution.get_omics_client',
+            return_value=mock_client,
+        ):
+            result = await wrapped(
+                ctx=mock_ctx,
+                max_results=10,
+                next_token=None,
+                status=None,
+                created_after='2023-06-10T00:00:00Z',
+                created_before=None,
+                run_group_id=None,
+            )
+
+        assert len(result['runs']) == 10
+       
```

**File**: `src/aws-healthomics-mcp-server/tests/test_workflow_execution.py` (modified, +104/-0)
```diff
@@ -810,6 +810,110 @@ async def test_list_runs_with_both_date_filters():
     assert result['runs'][0]['id'] == 'run-2'
 
 
+@pytest.mark.asyncio
+async def test_list_runs_date_filter_truncation_emits_next_token():
+    """Test that truncating date-filtered results still signals continuation.
+
+    When client-side date filtering leaves more matching runs than max_results,
+    and the upstream API still has more pages available, the response must
+    include a nextToken so callers know the page is not the complete result set.
+    """
+    base_time = datetime(2023, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
+
+    # 15 runs all created after the created_after filter, fetched in a single
+    # upstream batch that itself still has more pages (nextToken present).
+    items = []
+    for i in range(15):
+        items.append(
+            {
+                'id': f'run-{i}',
+                'name': f'run-{i}',
+                'status': 'COMPLETED',
+                'workflowId': f'wfl-{i}',
+                'workflowType': 'WDL',
+                'creationTime': base_time + timedelta(days=i),
+            }
+        )
+
+    mock_response = {
+        'items': items,
+        'nextToken': 'upstream-token-abc',
+    }
+
+    mock_ctx = AsyncMock()
+    mock_client = MagicMock()
+    mock_client.list_runs.return_value = mock_response
+
+    with patch(
+        'awslabs.aws_healthomics_mcp_server.tools.workflow_execution.get_omics_client',
+        return_value=mock_client,
+    ):
+        result = await list_runs(
+            ctx=mock_ctx,
+            max_results=10,
+            next_token=None,
+            status=None,
+            created_after='2023-06-10T00:00:00Z',
+            created_before=None,
+            run_group_id=None,
+        )
+
+    # Truncated to max_results, but more matching runs exist upstream.
+    assert len(result['runs']) == 10
+    assert 'nextToken' in result, (
+        'truncated date-filtered page must carry a continuation token so the '
+        'caller does not treat a partial result as complete'
+    )
+    assert result['nextToken'] == 'upstream-token-abc'
+
+
+@pytest.mark.asyncio
+async def test_list_runs_date_filter_truncation_no_upstream_token():
+    """Test truncated date-filtered results with no further upstream pages.
+
+    When the upstream API has no more pages (no nextToken), there is no valid
+    resume point to hand back even though the filtered set was truncated. The
+    response must omit nextToken rather than fabricate one.
+    """
+    base_time = datetime(2023, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
+
+    items = [
+        {
+            'id': f'run-{i}',
+            'name': f'run-{i}',
+            'status': 'COMPLETED',
+            'workflowId': f'wfl-{i}',
+            'workflowType': 'WDL',
+            'creationTime': base_time + timedelta(days=i),
+        }
+        for i in range(15)
+    ]
+
+    # No nextToken: this is the final upstream page.
+    mock_response = {'items': items}
+
+    mock_ctx = AsyncMock()
+    mock_client = MagicMock()
+    mock_client.list_runs.return_value = mock_response
+
+    with patch(
+        'awslabs.aws_healthomics_mcp_server.tools.workflow_execution.get_omics_client',
+        return_value=mock_client,
+    ):
+        result = await list_runs(
+            ctx=mock_ctx,
+            max_results=10,
+            next_token=None,
+            status=None,
+            created_after='2023-06-10T00:00:00Z',
+            created_before=None,
+            run_group_id=None,
+        )
+
+    assert len(result['runs']) == 10
+    assert 'nextToken' not in result
+
+
 @pytest.mark.asyncio
 async def test_list_runs_invalid_created_after():
     """Test list_runs with invalid created_after datetime."""
```

---

### Incident Patch 7: `92067994` (2026-09-21)
**Commit Message**: fix(aurora-dsql): use parser-based SQL policy guard (#4653)

* fix(aurora-dsql): use parser-based SQL policy guard

* fix(aurora-dsql): address SQL guard review findings

* chore(aurora-dsql): avoid empty exception handler

* fix(aurora-dsql): match psycopg placeholder scanning

* fix(aurora-dsql): preserve unmatched percent markers

* fix(aurora-dsql): handle repeated explain analyze options

---------

Co-authored-by: Spencer Corwin <spencor@amazon.com>

**File**: `src/aurora-dsql-mcp-server/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Security
 
+- Add a subsequent `pglast` policy layer after the existing SQL heuristics, so function and read-only checks use PostgreSQL-decoded quoted and Unicode-escaped identifiers. The parser guard matches psycopg parameter handling and supports Aurora DSQL asynchronous DDL and AWS IAM syntax during validation.
 - Close read-only bypasses in `readonly_query` / `transact` (read-only mode), aligning the SQL classifier with the `postgres-mcp-server` sibling:
   - Detect Postgres session-state mutation that a `BEGIN TRANSACTION READ ONLY` does not block, using a broad keyword approach matched at statement start (mirroring the sibling) rather than an assignment-shape regex: assignment `SET <name> = ...` / `... TO ...`, keyword-syntax `SET ROLE` / `SET SESSION AUTHORIZATION` / `SET SCHEMA` / `SET NAMES`, the session commands `RESET` / `DISCARD` / `LISTEN` / `NOTIFY` / `UNLISTEN` / `LOCK` / `EXECUTE`, prepared-statement / cursor commands `PREPARE` / `DEALLOCATE` / `DECLARE ... CURSOR` (session-scoped, not cleared by `RESET ALL`), and the `set_config(...)` function form (including when embedded as a `SELECT` subquery). `SET TRANSACTION READ ONLY` / isolation-only remains allowed so read-only mode can be asserted, but `SET TRANSACTION ... READ WRITE` (an escalation) is blocked, including when split across a newline.
   - Normalize SQL (strip comments, unwrap double-quoted identifiers) before matching so comment-injection payloads like `SET/**/search_path = ...` can no longer slip past the classifier. This replaces the earlier `sqlparse`-based comment stripping with a self-contained, literal- and dollar-quote-aware normalizer (matching the `postgres-mcp-server` sibling), removing the `sqlparse` dependency.
```

**File**: `src/aurora-dsql-mcp-server/awslabs/aurora_dsql_mcp_server/server.py` (modified, +29/-2)
```diff
@@ -59,6 +59,7 @@
     detect_mutating_keywords,
     detect_transaction_bypass_attempt,
 )
+from awslabs.aurora_dsql_mcp_server.sql_guard import SqlPolicyError, assert_executable
 from botocore.config import Config
 from loguru import logger
 from mcp.server.mcpserver import Context, MCPServer
@@ -221,6 +222,20 @@ async def readonly_query(
         await ctx.error(ERROR_TRANSACTION_BYPASS_ATTEMPT)
         raise Exception(ERROR_TRANSACTION_BYPASS_ATTEMPT)
 
+    # Parse with PostgreSQL's own grammar after the legacy heuristic checks.
+    # This closes lexical differentials such as U&-escaped identifiers while
+    # preserving the existing, more specific user-facing errors above.
+    try:
+        assert_executable(
+            sql,
+            allow_write_query=False,
+            parameter_count=len(params) if params is not None else None,
+        )
+    except SqlPolicyError as error:
+        logger.warning(f'readonly_query rejected by SQL policy guard: {error}')
+        await ctx.error(f'{ERROR_QUERY_INJECTION_RISK}: {error}')
+        raise Exception(f'{ERROR_QUERY_INJECTION_RISK}: {error}') from error
+
     try:
         conn = await get_connection(ctx)
 
@@ -361,7 +376,7 @@ async def transact(
     # detection only run in read-only mode where those operations are
     # prohibited. Callers that need stacked statements should split them
     # into separate sql_list items.
-    for sql in sql_list:
+    for index, sql in enumerate(sql_list):
         if read_only:
             mutating_matches = detect_mutating_keywords(sql)
             if mutating_matches:
@@ -384,6 +399,18 @@ async def transact(
             await ctx.error(ERROR_TRANSACTION_BYPASS_ATTEMPT)
             raise Exception(ERROR_TRANSACTION_BYPASS_ATTEMPT)
 
+        try:
+            parameters = params_list[index] if params_list is not None else None
+            assert_executable(
+                sql,
+                allow_write_query=not read_only,
+                parameter_count=len(parameters) if parameters is not None else None,
+            )
+        except SqlPolicyError as error:
+            logger.warning(f'transact rejected by SQL policy guard: {error}')
+            await ctx.error(f'{ERROR_QUERY_INJECTION_RISK}: {error}')
+            raise Exception(f'{ERROR_QUERY_INJECTION_RISK}: {error}') from error
+
     try:
         conn = await get_connection(ctx)
 
@@ -401,7 +428,7 @@ async def transact(
         try:
             rows = []
             for idx, query in enumerate(sql_list):
-                p = params_list[idx] if params_list else None
+                p = params_list[idx] if params_list is not None else None
                 rows = await execute_query(ctx, conn, query, p)
             await execute_query(ctx, conn, COMMIT_TRANSACTION_SQL)
             return rows
```

**File**: `src/aurora-dsql-mcp-server/awslabs/aurora_dsql_mcp_server/sql_guard.py` (added, +520/-0)
```diff
@@ -0,0 +1,520 @@
+# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+r"""Parser-based SQL policy for the Aurora DSQL MCP Server.
+
+The policy uses PostgreSQL's parser through pglast. PostgreSQL escape syntax,
+including Unicode-escaped identifiers such as ``U&"pg_sl\\0065ep"``, is decoded
+before names are checked. The guard and Aurora DSQL therefore interpret
+identifiers with the same PostgreSQL lexical rules.
+
+This is defense in depth. Database permissions and read-only transactions remain
+the authoritative controls for function semantics that cannot be inferred from
+syntax, such as user-defined wrapper functions.
+"""
+
+from loguru import logger
+from pglast import ast, parse_sql, scan
+from pglast.enums import DiscardMode, VariableSetKind
+from typing import NoReturn
+
+
+READ_ONLY_ALLOWED_ROOT = frozenset(
+    {'SelectStmt', 'VariableShowStmt', 'ExplainStmt', 'VariableSetStmt'}
+)
+READ_ONLY_ALLOWED_STMT_NODES = frozenset(
+    {
+        'RawStmt',
+        'SelectStmt',
+        'VariableShowStmt',
+        'ExplainStmt',
+        'ExecuteStmt',
+        'VariableSetStmt',
+    }
+)
+
+READ_ONLY_PROHIBITED_FUNCTIONS = frozenset({'set_config'})
+
+READ_ONLY_PROHIBITED_MUTATING_FUNCTIONS = frozenset(
+    {
+        'nextval',
+        'setval',
+        'pg_stat_force_next_flush',
+        'pg_stat_reset',
+        'pg_stat_reset_backend_stats',
+        'pg_stat_reset_shared',
+        'pg_stat_reset_single_table_counters',
+        'pg_stat_reset_single_function_counters',
+        'pg_stat_reset_slru',
+        'pg_stat_reset_replication_slot',
+        'pg_stat_reset_subscription_stats',
+        'pg_restore_relation_stats',
+        'pg_clear_relation_stats',
+        'pg_restore_attribute_stats',
+        'pg_clear_attribute_stats',
+        'pg_stat_statements_reset',
+        'pg_stat_monitor_reset',
+        'pg_start_backup',
+        'pg_stop_backup',
+        'pg_backup_start',
+        'pg_backup_stop',
+        'pg_switch_wal',
+        'pg_create_restore_point',
+        'pg_log_standby_snapshot',
+        'pg_logical_emit_message',
+        'pg_create_physical_replication_slot',
+        'pg_create_logical_replication_slot',
+        'pg_copy_physical_replication_slot',
+        'pg_copy_logical_replication_slot',
+        'pg_drop_replication_slot',
+        'pg_replication_slot_advance',
+        'pg_sync_replication_slots',
+        'pg_logical_slot_get_changes',
+        'pg_logical_slot_get_binary_changes',
+        'pg_replication_origin_create',
+        'pg_replication_origin_drop',
+        'pg_replication_origin_advance',
+        'pg_replication_origin_session_setup',
+        'pg_replication_origin_session_reset',
+        'pg_replication_origin_xact_setup',
+        'pg_replication_origin_xact_reset',
+        'brin_summarize_new_values',
+        'brin_summarize_range',
+        'brin_desummarize_range',
+        'gin_clean_pending_list',
+        'lo_creat',
+        'lo_create',
+        'lo_from_bytea',
+        'lo_put',
+        'lo_truncate',
+        'lo_truncate64',
+        'lo_unlink',
+        'lowrite',
+        'pg_import_system_collations',
+        'setseed',
+        'pg_advisory_unlock',
+        'pg_advisory_unlock_shared',
+        'pg_advisory_unlock_all',
+        'autoprewarm_dump_now',
+        'pg_truncate_visibility_map',
+        'postgres_fdw_disconnect',
+        'postgres_fdw_disconnect
```

**File**: `src/aurora-dsql-mcp-server/pyproject.toml` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ dependencies = [
     "boto3>=1.38.5",
     "botocore>=1.38.5",
     "psycopg[binary]>=3.0",
+    "pglast>=8.4,<9",
     "httpx>=0.27.0",
     "dsql-lint>=0.2.17,<0.3",
 ]
```

**File**: `src/aurora-dsql-mcp-server/tests/test_sql_guard.py` (added, +413/-0)
```diff
@@ -0,0 +1,413 @@
+# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+"""Regression tests for the parser-based Aurora DSQL SQL guard."""
+
+import pytest
+from awslabs.aurora_dsql_mcp_server import sql_guard
+from awslabs.aurora_dsql_mcp_server.sql_guard import (
+    SqlPolicyError,
+    _normalize_dsql_syntax,
+    _normalize_placeholders,
+    assert_executable,
+)
+
+
+@pytest.mark.parametrize(
+    'sql',
+    [
+        r'''SELECT U&"pg_read_fil\0065"('/etc/passwd')''',
+        r'''SELECT U&"lo_impor\0074"(0, '/etc/passwd')''',
+        r'''SELECT U&"pg_sl\0065ep"(10)''',
+        r'''SELECT U&"dblin\006b"('host=169.254.169.254', 'SELECT 1')''',
+    ],
+)
+@pytest.mark.parametrize('allow_write_query', [False, True])
+def test_unicode_escaped_dangerous_functions_are_rejected(sql, allow_write_query):
+    """PostgreSQL-decoded function names cannot bypass the denylist."""
+    with pytest.raises(SqlPolicyError, match='Dangerous function'):
+        assert_executable(sql, allow_write_query=allow_write_query)
+
+
+@pytest.mark.parametrize(
+    'sql',
+    [
+        'SELECT 1',
+        "SELECT '%s is data', $tagé$%s is also data$tagé$",
+        'EXPLAIN ANALYZE SELECT * FROM t',
+        'SELECT 10 % sqrt(4)',
+    ],
+)
+def test_unparameterized_read_queries_are_allowed(sql):
+    """Valid reads preserve PostgreSQL percent operators and quoted data."""
+    assert_executable(sql)
+
+
+@pytest.mark.parametrize(
+    ('sql', 'parameter_count'),
+    [
+        ('SELECT * FROM t WHERE tenant_id = %s', 1),
+        ('SELECT * FROM t WHERE a = %b AND b = %t', 2),
+        ('SELECT 10 %% 3', 0),
+        ('SELECT %s -- progress 100%', 1),
+        ('SELECT %s -- progress 100%\n', 1),
+    ],
+)
+def test_bound_psycopg_placeholders_are_allowed(sql, parameter_count):
+    """Psycopg placeholders are normalized only when parameters are supplied."""
+    assert_executable(sql, parameter_count=parameter_count)
+
+
+def test_placeholder_normalization_matches_psycopg_raw_query_scanning():
+    """Placeholders are converted across the raw text exactly as psycopg does."""
+    sql = (
+        """SELECT '%s', "%s", U&"%s", $tagé$%s$tagé$, value FROM t -- %s\r"""
+        'WHERE id = %s AND payload = %b AND label = %t AND ratio = 10 %% 3'
+    )
+    assert _normalize_placeholders(sql, parameter_count=8) == (
+        """SELECT '$1', "$2", U&"$3", $tagé$$4$tagé$, value FROM t -- $5\r"""
+        'WHERE id = $6 AND payload = $7 AND label = $8 AND ratio = 10 % 3'
+    )
+
+
+def test_placeholder_normalization_matches_reported_driver_differential():
+    """Markers inside strings and comments contribute to psycopg numbering."""
+    sql = "SELECT '%s', id FROM t WHERE id = %s -- %s"
+    assert _normalize_placeholders(sql, parameter_count=3) == (
+        "SELECT '$1', id FROM t WHERE id = $2 -- $3"
+    )
+
+
+@pytest.mark.parametrize(
+    'sql',
+    [
+        'SELECT %s -- progress 100%',
+        'SELECT %s -- progress 100%\n',
+    ],
+)
+def test_placeholder_normalization_preserves_psycopg_unmatched_percent(sql):
+    """Terminal percent and percent before a line feed remain unchanged."""
+    assert _normalize_placeholders(sql, parameter_count=1) == sql.replace('%s', '$1')
+
+
+@pytest.mark.parametrize(
+    ('sql', 'parameter_count'),
+    [
+        ('SELECT %s', 0),
+        ('SELECT 1', 1),
+        ("SELECT '%s', id FROM t WHERE id = %s -- %s", 1),
+    ],
```

---

### Incident Patch 8: `2773b69a` (2026-09-21)
**Commit Message**: test(document-loader-mcp-server): write-path CI-env sandbox regression test + changelog 1.0.21 heading (#4611)

Co-authored-by: Andy Widjaja <awidjaja@amazon.com>

**File**: `src/document-loader-mcp-server/CHANGELOG.md` (modified, +2/-0)
```diff
@@ -7,6 +7,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [1.0.21] - 2026-09-01
+
 ### Security
 - Fixed a path containment bypass in the `DOCUMENT_BASE_DIR` sandbox (CVE pending).
   `_get_base_directory()` previously returned the filesystem root (`/`) whenever
```

**File**: `src/document-loader-mcp-server/tests/test_server.py` (modified, +49/-0)
```diff
@@ -1276,6 +1276,55 @@ async def test_extract_slides_general_exception():
                     print('✓ extract_slides_as_images general exception covered')
 
 
+def test_output_dir_containment_enforced_under_ci_env(tmp_path):
+    """Regression: the write path (output_dir) stays sandboxed under ambient CI env.
+
+    Companion to ``test_sandbox_enforced_under_ci_env_end_to_end`` (read path).
+    ``extract_slides_as_images`` validates ``output_dir`` via
+    ``validate_output_dir`` -> ``_is_within_base_directory`` -> ``_get_base_directory``,
+    the same helper the ``CI`` / ``GITHUB_ACTIONS`` / ``PYTEST_CURRENT_TEST`` bypass
+    affected. Pre-fix, the bypass widened the base to ``/`` so any ``output_dir``
+    was accepted (arbitrary-directory write). This asserts write-path containment
+    holds regardless of ambient CI signals.
+    """
+    from pathlib import Path
+
+    base_dir = tmp_path / 'sandbox'
+    base_dir.mkdir()
+
+    env = {
+        'DOCUMENT_BASE_DIR': str(base_dir),
+        'CI': 'true',
+        'GITHUB_ACTIONS': 'true',
+        'PYTEST_CURRENT_TEST': 'x',
+    }
+    with patch.dict(os.environ, env, clear=True):
+        # An output_dir OUTSIDE the sandbox is denied even with CI env present.
+        outside = tmp_path / 'evil_output'
+        error = validate_output_dir(str(outside))
+        assert error is not None
+        assert 'Access denied' in error
+
+        # An output_dir INSIDE the sandbox is allowed.
+        inside = base_dir / 'slides_out'
+        assert validate_output_dir(str(inside)) is None
+
+    # With no base configured, the default is the resolved cwd even under CI.
+    # Use a controlled cwd (not '/') so the check is platform-neutral and not
+    # dependent on where the suite runs.
+    with patch.dict(os.environ, {'CI': 'true'}, clear=True):
+        original_cwd = Path.cwd()
+        cwd_dir = tmp_path / 'cwd'
+        cwd_dir.mkdir()
+        os.chdir(cwd_dir)
+        try:
+            outside = tmp_path / 'evil_output'  # sibling of cwd, outside it
+            assert validate_output_dir(str(outside)) is not None
+        finally:
+            os.chdir(original_cwd)
+    print('✓ output_dir containment enforced under ambient CI env')
+
+
 if __name__ == '__main__':
     asyncio.run(test_server())
     asyncio.run(test_mcp_tool_functions())
```

---

### Incident Patch 9: `61d8b456` (2026-09-19)
**Commit Message**: fix(ecs-mcp-server): apply sensitive data redaction consistently (#4623)

* fix(ecs-mcp-server): apply sensitive data redaction consistently

Move the ALLOW_SENSITIVE_DATA redaction of container environment values
and secret references into shared helpers in utils/security.py, and apply
it in find_task_definitions and for DescribeExpressGatewayService so that
every tool returning container configuration follows the same policy as
DescribeTaskDefinition. Names are kept; only values and ARNs are replaced.

* fix(ecs-mcp-server): apply sensitive field redaction consistently

Replace the per-shape redaction helpers with one recursive redactor for
the typed fields the ECS API uses for configuration values and
credentials: environment values, environment file locations, secret and
credential references, credential spec ARNs and ExecuteCommand session
tokens, wherever they appear in a response. Apply it through one policy
helper in find_task_definitions, ecs_api_operation and delete_app, and
extend SENSITIVE_DATA_OPERATIONS to every supported operation whose
response can carry such a field per the ECS API model. Tests derive the
operation set from the model and check that every secret-lik

**File**: `src/ecs-mcp-server/README.md` (modified, +1/-1)
```diff
@@ -270,7 +270,7 @@ Controls whether write operations (creating or deleting infrastructure) are allo
 
 ### ALLOW_SENSITIVE_DATA
 
-Controls whether tools that return logs and detailed resource information are allowed.
+Controls whether tools that return logs and detailed resource information are allowed. When disabled, the `ecs_troubleshooting_tool` actions that fetch logs, service events, task failures and network configuration return an error, and every other response (`ecs_resource_management`, `ecs_troubleshooting_tool` guidance, `delete_app`) has container environment variable values, environment file locations, and secret and credential references redacted rather than returned.
 
 ```bash
 # Enable access to sensitive data
```

**File**: `src/ecs-mcp-server/awslabs/ecs_mcp_server/api/express.py` (modified, +5/-2)
```diff
@@ -32,7 +32,10 @@
     get_aws_client,
 )
 from awslabs.ecs_mcp_server.utils.docker import build_and_push_image
-from awslabs.ecs_mcp_server.utils.security import validate_app_name
+from awslabs.ecs_mcp_server.utils.security import (
+    redact_unless_sensitive_data_allowed,
+    validate_app_name,
+)
 
 logger = logging.getLogger(__name__)
 
@@ -224,7 +227,7 @@ async def delete_express_gateway_service(service_arn: str) -> Dict[str, Any]:
             "status": "deleted",
             "service_arn": service_arn,
             "message": "Express Gateway Service deleted successfully",
-            "details": response.get("service", {}),
+            "details": redact_unless_sensitive_data_allowed(response.get("service", {})),
         }
 
     except Exception as e:
```

**File**: `src/ecs-mcp-server/awslabs/ecs_mcp_server/api/resource_management.py` (modified, +27/-54)
```diff
@@ -19,20 +19,39 @@
 using a consistent interface.
 """
 
-import copy
 import logging
 import re
 from typing import Any, Dict, Set
 
 from awslabs.ecs_mcp_server.utils.aws import get_aws_client
+from awslabs.ecs_mcp_server.utils.security import redact_unless_sensitive_data_allowed
 
 logger = logging.getLogger(__name__)
 
-# Operations that return sensitive data (environment variables, secrets, etc.)
-# These require ALLOW_SENSITIVE_DATA=true or their responses will be sanitized.
+# Supported operations whose responses can carry environment variable values, environment
+# file locations, secret or credential references, or session tokens (see
+# redact_sensitive_fields).
+# Their responses are redacted unless ALLOW_SENSITIVE_DATA=true. Derived from the ECS API
+# model; tests/unit/api/test_resource_management_sensitive_data.py checks it stays in sync.
 SENSITIVE_DATA_OPERATIONS: Set[str] = {
+    "CreateExpressGatewayService",
+    "CreateService",
+    "DeleteExpressGatewayService",
+    "DeleteService",
+    "DeleteTaskDefinitions",
+    "DeregisterTaskDefinition",
+    "DescribeExpressGatewayService",
+    "DescribeServiceRevisions",
+    "DescribeServices",
     "DescribeTaskDefinition",
     "DescribeTasks",
+    "ExecuteCommand",
+    "RegisterTaskDefinition",
+    "RunTask",
+    "StartTask",
+    "StopTask",
+    "UpdateExpressGatewayService",
+    "UpdateService",
 }
 
 # List of supported ECS API operations
@@ -128,50 +147,6 @@ def camel_to_snake(name):
     return re.sub("([a-z0-9])([A-Z])", r"\1_\2", name).lower()
 
 
-def _sanitize_sensitive_response(response: Dict[str, Any], api_operation: str) -> Dict[str, Any]:
-    """
-    Sanitize sensitive fields from API responses when ALLOW_SENSITIVE_DATA is false.
-
-    For DescribeTaskDefinition: redacts containerDefinitions[].environment values
-    and containerDefinitions[].secrets.
-    For DescribeTasks: redacts containers[].environment values and overrides.
-
-    Args:
-        response: The raw API response
-        api_operation: The operation that produced the response
-
-    Returns:
-        A sanitized copy of the response with sensitive fields redacted
-    """
-    sanitized = copy.deepcopy(response)
-
-    if api_operation == "DescribeTaskDefinition":
-        task_def = sanitized.get("taskDefinition", {})
-        for container in task_def.get("containerDefinitions", []):
-            # Redact environment variable values (keep names for debugging)
-            for env_var in container.get("environment", []):
-                env_var["value"] = "[REDACTED]"
-            # Remove secrets entirely (they reference SSM/Secrets Manager ARNs)
-            if "secrets" in container:
-                container["secrets"] = [
-                    {"name": s.get("name", ""), "valueFrom": "[REDACTED]"}
-                    for s in container["secrets"]
-                ]
-
-    elif api_operation == "DescribeTasks":
-        for task in sanitized.get("tasks", []):
-            # Redact container overrides environment values
-            for override in task.get("overrides", {}).get("containerOverrides", []):
-                for env_var in override.get("environment", []):
-                    env_var["value"] = "[REDACTED]"
-            # Redact container-level environment from containers
-            for container in task.get("containers", []):
-                for env_var in container.get("environment", []):
-                    env_var["value"] = "[REDACTED]"
-
-    return sanitized
-
-
 async def ecs_api_operation(api_operation: str, api_params: Dict[str, Any]) -> Dict[str, Any]:
     """
     Execute an ECS API operation with the provided parameters.
@@ -186,7 +161,7 @@ async def ecs_api_operation(api_operation: str, api_params: Dict[str, Any]) -> D
     Note:
         Operations starting with "Describe" or "List" are read-only.
         All other operations require WRITE permission (ALLOW_WRITE=true).
-        Operations in SENSITIVE_DATA_OPERATIONS have t
```

**File**: `src/ecs-mcp-server/awslabs/ecs_mcp_server/api/troubleshooting_tools/utils.py` (modified, +17/-13)
```diff
@@ -26,6 +26,7 @@
 
 from awslabs.ecs_mcp_server.utils.arn_parser import parse_arn
 from awslabs.ecs_mcp_server.utils.aws import get_aws_client
+from awslabs.ecs_mcp_server.utils.security import redact_unless_sensitive_data_allowed
 
 logger = logging.getLogger(__name__)
 
@@ -254,7 +255,9 @@ async def find_task_definitions(
     Returns
     -------
     List[Dict[str, Any]]
-        List of task definition dictionaries with full details.
+        List of task definition dictionaries with full details. Environment variable
+        values and secret or credential references are redacted unless ALLOW_SENSITIVE_DATA
+        is enabled.
 
     Raises
     ------
@@ -272,27 +275,28 @@ async def find_task_definitions(
         )
         return []
 
+    task_definitions: List[Dict[str, Any]] = []
     try:
         if cluster_name and service_name:
-            return await _get_task_definition_by_service(cluster_name, service_name, ecs_client)
-
-        if cluster_name and task_id:
-            return await _get_task_definition_by_task(task_id, cluster_name, ecs_client)
-
-        if stack_name:
-            return await _get_task_definitions_by_stack(stack_name, ecs_client)
-
-        if family_prefix:
-            return await _get_task_definitions_by_family_prefix(family_prefix, ecs_client)
-
+            task_definitions = await _get_task_definition_by_service(
+                cluster_name, service_name, ecs_client
+            )
+        elif cluster_name and task_id:
+            task_definitions = await _get_task_definition_by_task(task_id, cluster_name, ecs_client)
+        elif stack_name:
+            task_definitions = await _get_task_definitions_by_stack(stack_name, ecs_client)
+        elif family_prefix:
+            task_definitions = await _get_task_definitions_by_family_prefix(
+                family_prefix, ecs_client
+            )
     except ClientError as e:
         logger.warning(f"AWS client error in find_task_definitions: {e}")
         return []
     except Exception as e:
         logger.warning(f"Unexpected error in find_task_definitions: {e}")
         return []
 
-    return []
+    return redact_unless_sensitive_data_allowed(task_definitions)
 
 
 async def get_cloudformation_stack_if_exists(resource_arn: str) -> Optional[Dict[str, Any]]:
```

**File**: `src/ecs-mcp-server/awslabs/ecs_mcp_server/modules/troubleshooting.py` (modified, +2/-0)
```diff
@@ -81,6 +81,8 @@ async def mcp_ecs_troubleshooting_tool(
         - Required: ecs_cluster_name
         - Optional: ecs_service_name (Name of the ECS Service to troubleshoot),
                    symptoms_description (Description of symptoms experienced by the user)
+        - Note: task definition environment variable values and secret or credential
+                references in the response are redacted unless ALLOW_SENSITIVE_DATA=true
         - Example: action="get_ecs_troubleshooting_guidance",
                    parameters={"ecs_cluster_name": "my-cluster", "ecs_service_name": "my-service",
                                "symptoms_description": "ALB returning 503 errors"}
```

---

### Incident Patch 10: `a9429548` (2026-09-18)
**Commit Message**: fix(aws-dataprocessing-mcp-server): apply --allow-sensitive-data-access per field on read operations (#4640)

Operations returning records that mix operational metadata with customer
content were handled inconsistently: the singular form checked
--allow-sensitive-data-access and refused the call, while the list form
returned the same records unfiltered.

Both forms now behave identically, and neither is refused. Without the flag the
operation succeeds and the fields that can carry customer content are omitted
from each record:

- manage_aws_emr_ec2_steps (describe-step, list-steps): Config.Args,
  Config.Properties, Status.StateChangeReason.Message, Status.FailureDetails
- manage_aws_glue_jobs (get-job-run, get-job-runs): Arguments, ErrorMessage,
  StateDetail
- manage_aws_glue_statements (get-statement, list-statements): Code,
  Output.Data, Output.ErrorValue, Output.Traceback
- manage_aws_emr_serverless_job_runs (get-job-run, list-job-runs): jobDriver,
  configurationOverrides, tags, stateDetails

Record identity, state, timings and configuration remain available, so
discovery and monitoring still work without the flag. The response message
names the omitted fields and points at 

**File**: `src/aws-dataprocessing-mcp-server/README.md` (modified, +24/-14)
```diff
@@ -283,19 +283,29 @@ All other statements (including `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `DROP`,
 
 #### `--allow-sensitive-data-access` (optional)
 
-Enables access to operations that expose sensitive user data. When disabled (default), the following operations are restricted:
+Enables access to sensitive user data. When disabled (default), the flag is enforced two ways, depending on what the operation returns.
 
-**CRITICAL - Database Credentials:**
-* `get-connection` and `list-connections`: Automatically enforces `hide_password=True` to prevent exposure of plaintext database passwords in connection properties
+**Refused outright**, because the response is itself customer data and filtering would leave nothing meaningful:
 
-**HIGH - User Data:**
-* `get-query-results` (Athena): Blocks retrieval of actual query result data
-* `get-statement` (Glue Interactive Sessions): Blocks retrieval of statement execution outputs
-* `get-entity-records` (Data Catalog): Blocks retrieval of preview data from connected sources
+* `get-query-results` (Athena): query result data
+* `get-entity-records` (Data Catalog): preview data from connected sources
 
-**MEDIUM - Job Outputs and Logs:**
-* `get-job-run` (Glue ETL & EMR Serverless): Blocks access to job run details that may contain sensitive arguments and error messages
-* `describe-step` (EMR EC2): Blocks access to step configurations and error details
+**Answered with sensitive fields omitted**, so the operation stays usable for discovery and monitoring while the sensitive fields are withheld:
+
+| Operations | Omitted without the flag | Still returned |
+| --- | --- | --- |
+| `describe-step`, `list-steps` (EMR EC2) | `Config.Args`, `Config.Properties`, `Status.StateChangeReason.Message`, `Status.FailureDetails` | step id, name, state, timeline, jar, execution role |
+| `get-job-run`, `get-job-runs` (Glue ETL) | `Arguments`, `ErrorMessage`, `StateDetail` | run id, job name, state, timings, capacity, worker config |
+| `get-statement`, `list-statements` (Glue Interactive Sessions) | `Code`, `Output.Data`, `Output.ErrorValue`, `Output.Traceback` | statement id, state, progress, timings |
+| `get-job-run`, `list-job-runs` (EMR Serverless) | `jobDriver`, `configurationOverrides`, `tags`, `stateDetails` | run id, application id, state, timings, execution role |
+
+**Redacted by the AWS API:**
+
+* `get-connection` and `list-connections`: enforces `hide_password=True` so plaintext passwords are never returned in connection properties
+
+When fields are omitted, the response message names them and points at this flag, so a caller can tell the difference between a field that was empty and one that was withheld.
+
+Both the singular and list form of an operation are treated identically, because the AWS APIs behind them return the same records: Glue `GetJobRuns` returns full `JobRun` entries, Glue `ListStatements` returns full `Statement` entries including output data, and EMR `ListSteps` returns step arguments and state-change messages. Filtering only the singular form would make the flag mean different things depending on which form was called. Operations returning only identifiers, such as Athena `list-query-executions`, are unaffected.
 
 * Default: false (Access to sensitive data is restricted by default)
 * Security Note: Only enable this flag in trusted environments when you need access to actual data
@@ -378,7 +388,7 @@ Controls whether the MCP server adds and verifies MCP-managed tags on resources.
 | Tool Name | Description | Key Operations | Requirements |
 |-----------|-------------|----------------|--------------|
 | manage_aws_glue_sessions | Manage AWS Glue Interactive Sessions for Spark and Ray workloads | create-session, delete-session, get-session, list-sessions, stop-session | --allow-write flag for create/delete/stop operations, appropriate AWS permissions |
-| manage_aws_glue_statements | Execute and manage code statements within Glue Interactive Sessions | run-statemen
```

**File**: `src/aws-dataprocessing-mcp-server/awslabs/aws_dataprocessing_mcp_server/handlers/emr/emr_ec2_steps_handler.py` (modified, +29/-14)
```diff
@@ -28,6 +28,12 @@
     LogLevel,
     log_with_request_id,
 )
+from awslabs.aws_dataprocessing_mcp_server.utils.sensitive_data_filter import (
+    EMR_STEP_FIELDS,
+    filter_record,
+    filter_records,
+    redaction_notice,
+)
 from mcp.server.mcpserver import Context
 from mcp.types import CallToolResult, TextContent
 from pydantic import Field
@@ -59,7 +65,7 @@ async def manage_aws_emr_ec2_steps(
         operation: Annotated[
             str,
             Field(
-                description='Operation to perform: add-steps, cancel-steps, describe-step, list-steps. Choose read-only operations when write access is disabled.',
+                description='Operation to perform: add-steps, cancel-steps, describe-step, list-steps. Choose read-only operations when write access is disabled. (step arguments and failure text require --allow-sensitive-data-access)',
             ),
         ],
         cluster_id: Annotated[
@@ -113,13 +119,14 @@ async def manage_aws_emr_ec2_steps(
 
         ## Requirements
         - The server must be run with the `--allow-write` flag for add-steps and cancel-steps operations
+        - The server must be run with the `--allow-sensitive-data-access` flag to receive step arguments (Config.Args, Config.Properties) and failure text (Status.StateChangeReason.Message, Status.FailureDetails) from describe-step and list-steps. Without it these fields are omitted from the response and named in the response message
         - Appropriate AWS permissions for EMR step operations
 
         ## Operations
         - **add-steps**: Add new steps to a running EMR cluster (max 256 steps per job flow)
         - **cancel-steps**: Cancel pending or running steps on an EMR cluster (EMR 4.8.0+ except 5.0.0)
-        - **describe-step**: Get detailed information about a specific step's configuration and status
-        - **list-steps**: List and filter steps for an EMR cluster with pagination support
+        - **describe-step**: Get detailed information about a specific step's configuration and status (step arguments and failure text require --allow-sensitive-data-access)
+        - **list-steps**: List and filter steps for an EMR cluster with pagination support (step arguments and failure text require --allow-sensitive-data-access)
 
         ## Usage Tips
         - Each step consists of a JAR file, its main class, and arguments
@@ -300,28 +307,27 @@ async def manage_aws_emr_ec2_steps(
                 if step_id is None:
                     raise ValueError('step_id is required for describe-step operation')
 
-                # SECURITY: Step details may contain sensitive data in arguments, configurations, and error messages
-                # Require --allow-sensitive-data-access flag to prevent unauthorized data exposure
-                if not self.allow_sensitive_data_access:
-                    error_message = 'Operation describe-step may contain sensitive data in step arguments and error messages, and requires --allow-sensitive-data-access flag'
-                    log_with_request_id(ctx, LogLevel.ERROR, error_message)
-                    return CallToolResult(
-                        isError=True,
-                        content=[TextContent(type='text', text=error_message)],
-                    )
-
                 # Describe step
                 response = self.emr_client.describe_step(
                     ClusterId=cluster_id,
                     StepId=step_id,
                 )
 
+                step = response.get('Step', {})
                 success_message = (
                     f'Successfully described step {step_id} on EMR cluster {cluster_id}'
                 )
+
+                if not self.allow_sensitive_data_access:
+                    step, omitted = filter_record(step, EMR_STEP_FIELDS)
+                    notice = redaction_notice('describe-step', omitted)
+                    if notice:
+                        log_with_request_id(ctx, LogLevel.INFO, notice)
+     
```

**File**: `src/aws-dataprocessing-mcp-server/awslabs/aws_dataprocessing_mcp_server/handlers/emr/emr_serverless_job_run_handler.py` (modified, +29/-11)
```diff
@@ -29,6 +29,12 @@
     LogLevel,
     log_with_request_id,
 )
+from awslabs.aws_dataprocessing_mcp_server.utils.sensitive_data_filter import (
+    EMR_SERVERLESS_JOB_RUN_FIELDS,
+    filter_record,
+    filter_records,
+    redaction_notice,
+)
 from mcp.server.mcpserver import Context
 from mcp.types import CallToolResult, TextContent
 from pydantic import Field
@@ -69,7 +75,7 @@ async def manage_aws_emr_serverless_job_runs(
         operation: Annotated[
             str,
             Field(
-                description='Operation to perform: start-job-run, get-job-run, cancel-job-run, list-job-runs, get-dashboard-for-job-run. Choose read-only operations when write access is disabled.',
+                description='Operation to perform: start-job-run, get-job-run, cancel-job-run, list-job-runs, get-dashboard-for-job-run. Choose read-only operations when write access is disabled. (job driver, overrides, tags and failure details require --allow-sensitive-data-access)',
             ),
         ],
         application_id: Annotated[
@@ -188,14 +194,15 @@ async def manage_aws_emr_serverless_job_runs(
 
         ## Requirements
         - The server must be run with the `--allow-write` flag for start-job-run and cancel-job-run operations
+        - The server must be run with the `--allow-sensitive-data-access` flag to receive jobDriver, configurationOverrides, tags and stateDetails from get-job-run and list-job-runs. Without it these fields are omitted from the response and named in the response message
         - Application must exist and be in appropriate state for job execution
         - Appropriate AWS permissions for EMR Serverless job run operations
 
         ## Operations
         - **start-job-run**: Start a new job run on an EMR Serverless application
-        - **get-job-run**: Get detailed information about a specific job run
+        - **get-job-run**: Get detailed information about a specific job run (job driver, overrides, tags and failure details require --allow-sensitive-data-access)
         - **cancel-job-run**: Cancel a running job run
-        - **list-job-runs**: List job runs for an application with optional filtering
+        - **list-job-runs**: List job runs for an application with optional filtering (job driver, overrides, tags and failure details require --allow-sensitive-data-access)
         - **get-dashboard-for-job-run**: Get the dashboard URL for monitoring a job run
 
         ## Example
@@ -339,22 +346,24 @@ async def manage_aws_emr_serverless_job_runs(
                     )
                     return self._create_error_response(operation, error_message)
 
-                # SECURITY: Job run details may contain sensitive data in arguments, error messages, and logs
-                # Require --allow-sensitive-data-access flag to prevent unauthorized data exposure
-                if not self.allow_sensitive_data_access:
-                    error_message = 'Operation get-job-run may contain sensitive data in job arguments and logs, and requires --allow-sensitive-data-access flag'
-                    log_with_request_id(ctx, LogLevel.ERROR, error_message)
-                    return self._create_error_response(operation, error_message)
-
                 # Get job run
                 response = self.emr_serverless_client.get_job_run(
                     applicationId=application_id,
                     jobRunId=job_run_id,
                 )
 
+                job_run = response.get('jobRun', {})
                 success_message = f'Successfully retrieved job run {job_run_id} details'
+
+                if not self.allow_sensitive_data_access:
+                    job_run, omitted = filter_record(job_run, EMR_SERVERLESS_JOB_RUN_FIELDS)
+                    notice = redaction_notice('get-job-run', omitted)
+                    if notice:
+                        log_with_request_id(ctx, LogLevel.INFO, notice)
+                        success_message = f'{success_message}. {notice}'
+
 
```

**File**: `src/aws-dataprocessing-mcp-server/awslabs/aws_dataprocessing_mcp_server/handlers/glue/glue_etl_handler.py` (modified, +29/-14)
```diff
@@ -34,6 +34,12 @@
     LogLevel,
     log_with_request_id,
 )
+from awslabs.aws_dataprocessing_mcp_server.utils.sensitive_data_filter import (
+    GLUE_JOB_RUN_FIELDS,
+    filter_record,
+    filter_records,
+    redaction_notice,
+)
 from botocore.exceptions import ClientError
 from mcp.server.mcpserver import Context
 from mcp.types import CallToolResult, TextContent
@@ -66,7 +72,7 @@ async def manage_aws_glue_jobs(
         operation: Annotated[
             str,
             Field(
-                description='Operation to perform: create-job, delete-job, get-job, get-jobs, update-job, start-job-run, stop-job-run, get-job-run, get-job-runs, batch-stop-job-run, get-job-bookmark, reset-job-bookmark. Choose "get-job", "get-jobs", "get-job-run", "get-job-runs", or "get-job-bookmark" for read-only operations when write access is disabled.',
+                description='Operation to perform: create-job, delete-job, get-job, get-jobs, update-job, start-job-run, stop-job-run, get-job-run, get-job-runs, batch-stop-job-run, get-job-bookmark, reset-job-bookmark. Choose "get-job", "get-jobs", or "get-job-bookmark" for read-only operations when write access is disabled. (job arguments and error messages require --allow-sensitive-data-access)',
             ),
         ],
         job_name: Annotated[
@@ -167,6 +173,7 @@ async def manage_aws_glue_jobs(
 
         ## Requirements
         - The server must be run with the `--allow-write` flag for create-job, delete-job, update-job, start-job-run, stop-job-run, and batch-stop-job-run operations
+        - The server must be run with the `--allow-sensitive-data-access` flag to receive job Arguments, ErrorMessage and StateDetail from get-job-run and get-job-runs. Without it these fields are omitted from the response and named in the response message
         - Appropriate AWS permissions for Glue ETL job operations
 
         ## Job Operations
@@ -179,8 +186,8 @@ async def manage_aws_glue_jobs(
 
         ## Job Run Operations
         - **stop-job-run**: Stop a job run using a job name and run ID
-        - **get-job-run**: Retrieve detailed information about a specific job run
-        - **get-job-runs**: List all job runs for a specific job
+        - **get-job-run**: Retrieve detailed information about a specific job run (job arguments and error messages require --allow-sensitive-data-access)
+        - **get-job-runs**: List all job runs for a specific job (job arguments and error messages require --allow-sensitive-data-access)
         - **batch-stop-job-run**: Stop one or more running jobs
 
         ## Usage Tips
@@ -534,16 +541,6 @@ async def manage_aws_glue_jobs(
                         'job_name and job_run_id are required for get-job-run operation'
                     )
 
-                # SECURITY: Job run details may contain sensitive data in error messages, arguments, and logs
-                # Require --allow-sensitive-data-access flag to prevent unauthorized data exposure
-                if not self.allow_sensitive_data_access:
-                    error_message = 'Operation get-job-run may contain sensitive data in error messages and job arguments, and requires --allow-sensitive-data-access flag'
-                    log_with_request_id(ctx, LogLevel.ERROR, error_message)
-                    return CallToolResult(
-                        isError=True,
-                        content=[TextContent(type='text', text=error_message)],
-                    )
-
                 # Prepare parameters
                 params = {'JobName': job_name, 'RunId': job_run_id}
                 if predecessors_included is not None:
@@ -552,11 +549,20 @@ async def manage_aws_glue_jobs(
                 # Get the job run
                 response = self.glue_client.get_job_run(**params)
 
+                job_run_details = response.get('JobRun', {})
                 success_message = f'Successfully retrieved job run {job_run_id} for job {job_name}'
+
+                if not self.a
```

**File**: `src/aws-dataprocessing-mcp-server/awslabs/aws_dataprocessing_mcp_server/handlers/glue/interactive_sessions_handler.py` (modified, +32/-16)
```diff
@@ -30,6 +30,12 @@
     LogLevel,
     log_with_request_id,
 )
+from awslabs.aws_dataprocessing_mcp_server.utils.sensitive_data_filter import (
+    GLUE_STATEMENT_FIELDS,
+    filter_record,
+    filter_records,
+    redaction_notice,
+)
 from botocore.exceptions import ClientError
 from mcp.server.mcpserver import Context
 from mcp.types import CallToolResult, TextContent
@@ -509,7 +515,7 @@ async def manage_aws_glue_statements(
         operation: Annotated[
             str,
             Field(
-                description='Operation to perform: run-statement, cancel-statement, get-statement, list-statements. Choose "get-statement" or "list-statements" for read-only operations when write access is disabled.',
+                description='Operation to perform: run-statement, cancel-statement, get-statement, list-statements. (statement code and execution output require --allow-sensitive-data-access)',
             ),
         ],
         session_id: Annotated[
@@ -557,14 +563,15 @@ async def manage_aws_glue_statements(
 
         ## Requirements
         - The server must be run with the `--allow-write` flag for run-statement and cancel-statement operations
+        - The server must be run with the `--allow-sensitive-data-access` flag to receive the submitted Code and the execution Output.Data from get-statement and list-statements. Without it these fields are omitted from the response and named in the response message
         - Appropriate AWS permissions for Glue Interactive Session Statement operations
         - A valid session ID is required for all operations
 
         ## Operations
         - **run-statement**: Execute code in an interactive session and get a statement ID
         - **cancel-statement**: Cancel a running statement by ID
-        - **get-statement**: Retrieve detailed information and results of a specific statement
-        - **list-statements**: List all statements in a session with their status
+        - **get-statement**: Retrieve detailed information and results of a specific statement (the code and execution output require --allow-sensitive-data-access)
+        - **list-statements**: List all statements in a session (the code and execution output require --allow-sensitive-data-access)
 
         ## Example
         ```python
@@ -668,16 +675,6 @@ async def manage_aws_glue_statements(
                 if statement_id is None:
                     raise ValueError('statement_id is required for get-statement operation')
 
-                # SECURITY: This operation returns statement execution output (customer data)
-                # Require --allow-sensitive-data-access flag to prevent unauthorized data exposure
-                if not self.allow_sensitive_data_access:
-                    error_message = 'Operation get-statement returns execution output with customer data and requires --allow-sensitive-data-access flag'
-                    log_with_request_id(ctx, LogLevel.ERROR, error_message)
-                    return CallToolResult(
-                        isError=True,
-                        content=[TextContent(type='text', text=error_message)],
-                    )
-
                 # Prepare get statement parameters
                 get_params = {
                     'SessionId': session_id,
@@ -689,13 +686,22 @@ async def manage_aws_glue_statements(
                 # Get the statement
                 response = self.glue_client.get_statement(**get_params)
 
+                statement = response.get('Statement', {})
                 success_message = (
                     f'Successfully retrieved statement {statement_id} in session {session_id}'
                 )
+
+                if not self.allow_sensitive_data_access:
+                    statement, omitted = filter_record(statement, GLUE_STATEMENT_FIELDS)
+                    notice = redaction_notice('get-statement', omitted)
+                    if notice:
+                        log_with_request_id(ctx, LogLevel.I
```

#### Recent Merged Pull Requests:
- **PR #4695** (2026-09-30): chore: release/2026.09.20260930084625 (@awslabs-mcp)
- **PR #4693** (2026-09-30): fix(aws-api-mcp): service name interpretation in policy (@arnewouters)
- **PR #4685** (closed): feat(billing-cost-management): add read-only AWS Organizations account tools (@zcjoss)
- **PR #4682** (2026-09-29): fix(billing-cost-management-mcp-server): normalize ResourceType casin… (@pputra)
- **PR #4680** (2026-09-29): fix(billing-cost-management): add structured error_type to session-sql failures (@bhatia-di)
- **PR #4678** (2026-09-30): chore: add @ChristianBusch as codeowner for aws-pricing-mcp-server (@aytech-in)
- **PR #4676** (2026-09-25): fix(billing-cost-management): route aws-pricing errors through handle_aws_error (@bhatia-di)
- **PR #4663** (2026-09-28): feat(billing-cost-management): add list-billing-view-segments tool (@anatoliivasilev)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
