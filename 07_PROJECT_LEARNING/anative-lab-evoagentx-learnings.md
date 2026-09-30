# Forensic Learning Record (Deep Inspection): ANative-Lab/EvoAgentX

> **Canonical Artifact**: `07_PROJECT_LEARNING/anative-lab-evoagentx-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ANative-Lab/EvoAgentX](https://github.com/ANative-Lab/EvoAgentX))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:07:52.542Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ANative-Lab/EvoAgentX`
- **Description**: 🚀 EvoAgentX: Building a Self-Evolving Ecosystem of AI Agents
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3362 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Wonderful_workflow_corpus/execute_workflow.py`
```
import os
import argparse
import json
import importlib
from dotenv import load_dotenv
from evoagentx.models import OpenAILLMConfig, OpenAILLM
from evoagentx.workflow import WorkFlowGraph, WorkFlow
from evoagentx.agents import AgentManager
from evoagentx.tools.mcp import MCPToolkit


load_dotenv()

def dynamic_import(module: str, cls: str):
    mod = importlib.import_module(module)
    return getattr(mod, cls)

def load_tools_from_json(workdir: str):
    """Load tools from tools.json in the workflow directory"""
    tools = []
    tools_file = os.path.join(workdir, "tools.json")
    if os.path.exists(tools_file):
        with open(tools_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        for t in data.get("tools", []):
            ToolClass = dynamic_import(t["module"], t["class"])
            if "params" in t:
                tools.append(ToolClass(**t["params"]))
            else:
                tools.append(ToolClass())
    return tools

def main():
    parser = argparse.ArgumentParser(description="Universal workflow executor (goal only)")
    parser.add_argument("--workflow", required=True, help="Path to workflow.json")
    parser.add_argument("--goal", required=True, help="The goal input")
    parser.add_argument("--output", help="Where to save the result")
    args = parser.parse_args()

    # LLM config
    llm_config = OpenAILLMConfig(
        model="gpt-4o",
        openai_key=os.getenv("OPENAI_API_KEY"),
        stream=True,
        output_response=True,
        max_tokens=16000,
    )
    llm = OpenAILLM(config=llm_config)

    # Workflow 路径与目录
    workdir = os.path.dirname(args.workflow)

    
    tools = load_tools_from_json(workdir)

    # tool_names = [t.__class__.__name__ for t in tools]
    # if "MCPToolkit" in tool_names:
    
    #     mcp_config_path = "Wonderful_workflow_corpus/PhD_direction/mcp_direction.config"
    #     tools = [MCPToolkit(config_path=mcp_config_path) if isinstance(t, MCPToolkit) else t for t in tools]

    wf_graph = WorkFlowGraph.from_file(
        args.workflow,
        llm_config=llm_config,
        tools=tools,
    )

    agent_manager = AgentManager(tools=tools)
    agent_manager.add_agents_from_workflow(wf_graph, llm_config=llm_config)
    workflow = WorkFlow(graph=wf_graph, agent_manager=agent_manager, llm=llm)

    output = workflow.execute(inputs={"goal": args.goal})

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"✅ Output saved to {args.output}")
    else:
        print("====== Workflow Output ======")
        print(output)

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `Wonderful_workflow_corpus/invest/catl_data_functions.py`
```
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
股票数据抓取函数库
封装了所有数据抓取的核心功能，支持任意股票代码，可独立调用

作者: AI Assistant
日期: 2025-07-22
版本: 2.0
"""

import akshare as ak
import pandas as pd
import datetime
import logging
from pathlib import Path
import time

class StockDataFetcher:
    """股票数据抓取器 - 核心功能类"""
    
    def __init__(self, stock_code, auto_create_output_dir=True):
        """
        初始化数据抓取器
        
        Args:
            stock_code (str): 股票代码（如：300750、000001等）
            auto_create_output_dir (bool): 是否自动创建输出目录，默认True
        """
        self.stock_code = stock_code
        self.symbol_sz = f'sz{stock_code}' if stock_code.startswith('0') or stock_code.startswith('3') else f'sh{stock_code}'
        
        # 自动创建输出目录：output_股票编号
        if auto_create_output_dir:
            self.output_dir = Path(f'output_{stock_code}')
        else:
            self.output_dir = Path('output')
            
        self.output_dir.mkdir(exist_ok=True)
        
        # 配置日志
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
        
        # 获取股票名称
        self.stock_name = self._get_stock_name()
    
    def _get_stock_name(self):
        """获取股票名称"""
        try:
            # 尝试获取股票基本信息
            stock_info = ak.stock_individual_info_em(symbol=self.stock_code)
            if not stock_info.empty:
                name_row = stock_info[stock_info['item'] == '股票简称']
                if not name_row.empty:
                    return name_row['value'].iloc[0]
            return f"股票{self.stock_code}"
        except:
            return f"股票{self.stock_code}"
    
    def get_timestamp(self):
        """获取当前日期用于文件命名"""
        return datetime.datetime.now().strftime('%Y%m%d')
    
    def save_data(self, data, filename_prefix, description=""):
        """
        保存数据到CSV文件
        
        Args:
            data: 要保存的数据（pandas DataFrame）
            filename_prefix (str): 文件名前缀
            description (str): 数据描述
            
        Returns:
            str: 保存的文件路径，失败返回None
        """
        try:
            timestamp = self.get_timestamp()
            filename = f"{filename_prefix}_{timestamp}_{self.stock_code}.csv"
            filepath = self.output_dir / filename
            
            if isinstance(data, pd.DataFrame):
                data.to_csv(filepath, index=False, encoding='utf-8-sig')
                self.logger.info(f"✅ {description} 已保存: {filepath} (共{len(data)}条记录)")
            else:
                df = pd.DataFrame([data] if isinstance(data, dict) else data)
                df.to_csv(filepath, index=False, encoding='utf-8-sig')
                self.logger.info(f"✅ {description} 已保存: {filepath}")
            
            return str(filepath)
        except Exception as e:
            self.logger.error(f"❌ 保存{description}失败: {str(e)}")
            return None
    
    def fetch_stock_daily(self, days=30):
        """
        抓取股票日线数据
        
        Args:
            days (int): 抓取最近多少天的数据，默认30天
            
        Returns:
            pandas.DataFrame: 股票日线数据
        """
        try:
            self.logger.info(f"📈 开始抓取{self.stock_code}日线数据...")
            stock_df = ak.stock_zh_a_daily(symbol=self.symbol_sz).reset_index()
            
            # 只获取最近指定天数的数据
            stock_df['date'] = pd.to_datetime(stock_df['date'])
            days_ago = datetime.datetime.now() - datetime.timedelta(days=days)
            recent_data = stock_df[stock_df['date'] >= days_ago]
            
            self.save_data(recent_data, "stock_daily_catl", f"{self.stock_code}日线数据")
            return recent_data
            
        except Exception as e:
            self.logger.error(f"❌ 抓取股票日线数据失败: {str(e)}")
            return None
    
    def fetch_china_cpi(self):
        """
        抓取中国CPI数据 (限制为过去2年)
        
        Returns:
            pandas.DataFrame: 中国CPI数据
        """
        try:
            self.logger.info("📊 开始抓取中国CPI数据...")
            cpi_df = ak.macro_china_cpi()
            
            # 限制为过去2年的数据
            if not cpi_df.empty:
                # 处理中文日期格式
                if '月份' in cpi_df.columns:
                    def convert_chinese_date(date_str):
                        try:
                            if '年' in date_str and '月' in date_str:
                                year = date_str.split('年')[0]
                                month = date_str.split('年')[1].split('月')[0]
                                return f"{year}-{month.zfill(2)}-01"
                            else:
                                return date_str
                        except:
                            return None
                    cpi_df['月份'] = cpi_df['月份'].apply(convert_chinese_date)
                    # 强制转换为datetime，无法解析的变为NaT
                    cpi_df['月份'] = pd.to_datetime(cpi_df['月份'], errors='coerce')
                    cpi_df = cpi_df.dropna(subset=['月份'])
                    if not cpi_df.empty:
                        two_years_ago = datetime.datetime.now() - datetime.timedelta(days=2*365)
                        cpi_df = cpi_df[cpi_df['月份'] >= two_years_ago]
                        self.logger.info(f"✅ CPI数据已限制为过去2年: {len(cpi_df)} 条记录")
            
            return cpi_df
        except Exception as e:
            self.logger.error(f"❌ 抓取CPI数据失败: {str(e)}")
            return None
    
    def fetch_china_gdp(self):
        """
        抓取中国GDP数据
        
        Returns:
            pandas.DataFrame: 中国GDP数据
        """
        try:
            self.logger.info("📊 开始抓取中国GDP数据...")
            gdp_df = ak.macro_china_gdp_yearly()
            return gdp_df
        except Exception as e:
            self.logger.error(f"❌ 抓取GDP数据失败: {str(e)}")
            return None
    
    def fetch_industry_fund_flow(self):
        """
        抓取行业资金流数据
        
        Returns:
            pandas.DataFrame: 行业资金流数据
        """
        try:
            self.logger.info("💰 开始抓取行业资金流数据...")
            industry_fund_df = ak.stock_fund_flow_industry()
            return industry_fund_df
        except Exception as e:
            self.logger.error(f"❌ 抓取行业资金流数据失败: {str(e)}")
            return None
    
    def fetch_stock_news(self):
        """
        抓取个股新闻数据
        
        Returns:
            pandas.DataFrame: 个股新闻数据
        """
        try:
            self.logger.info(f"📰 开始抓取{self.stock_name}({self.stock_code})新闻数据...")
            # 尝试使用akshare的新闻接口
            news_df = ak.stock_news_em(symbol=self.stock_code)
            return news_df
        except Exception as e:
            self.logger.error(f"❌ 抓取新闻数据失败: {str(e)}")
            return None
    
    def fetch_market_summary(self):
        """
        抓取上交所市场概况
        
        Returns:
            pandas.DataFrame: 市场概况数据
        """
        try:
            self.logger.info("🏛️ 开始抓取上交所市场概况...")
            sse_summary = ak.stock_sse_summary()
            return sse_summary
        except Exception as e:
            self.logger.error(f"❌ 抓取市场概况失败: {str(e)}")
            return None
    
    def fetch_market_indices(self):
        """
        抓取重要指数行情
        
        Returns:
            pandas.DataFrame: 重要指数数据
        """
        try:
            self.logger.info("📊 开始抓取重要指数行情...")
            market_indices = ak.stock_zh_index_spot_em(symbol="沪深重要指数")
            return market_indices
        except Exception as e:
            self.logger.error(f"❌ 抓取市场指数失败: {str(e)}")
            return None
    
    def fetch_option_volatility(self):
        """
        抓取50ETF期权波动率指数 (限制为过去1个月)
        
        Returns:
            pandas.DataFrame: 期权波动率数据
        """
        try:
            self.logger.info("📈 开始抓取50ETF波动率指数...")
            vol50 = ak.index_option_50etf_qvix()
            
            # 限制为过去1个月的数据
            if not vol50.empty:
                if 'date' in vol50.columns:
                    vol50['date'] = pd.to_datet
```

### Core Architecture Module: `Wonderful_workflow_corpus/invest/csv_to_llm_converter.py`
```
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSV数据转LLM JSON格式转换器
将股票数据CSV文件转换为适合LLM分析的JSON格式
"""

import os
import json
import pandas as pd
from pathlib import Path
from typing import Dict, List, Optional, Union

class CSVToLLMConverter:
    """CSV转LLM JSON格式转换器"""
    
    def __init__(self, data_dir: str):
        """
        初始化转换器
        
        Args:
            data_dir (str): 数据目录路径（如 output_300750）
        """
        self.data_dir = Path(data_dir)
        
        # 文件优先级和行数配置
        self.file_priority = {
            'stock_daily_catl': {'weight': 'high', 'max_rows': 30},
            'institution_recommendation_catl': {'weight': 'high', 'max_rows': 20},
            'stock_news_catl': {'weight': 'high', 'max_rows': 15},
            'china_cpi': {'weight': 'medium', 'max_rows': 10},
            'china_gdp': {'weight': 'medium', 'max_rows': 10},
            'industry_fund_flow': {'weight': 'medium', 'max_rows': 15},
            'market_overview': {'weight': 'normal', 'max_rows': 5},
            'regional_indices': {'weight': 'normal', 'max_rows': 10},
            'option_volatility': {'weight': 'normal', 'max_rows': 8},
            'fund_flow_industry': {'weight': 'normal', 'max_rows': 12}
        }
    
    def find_csv_files(self) -> Dict[str, Dict]:
        """查找并分类CSV文件"""
        csv_files = {}
        
        if not self.data_dir.exists():
            print(f"❌ 数据目录不存在: {self.data_dir}")
            return csv_files
        
        for file_path in self.data_dir.glob("*.csv"):
            filename = file_path.name
            
            # 跳过collection_report文件
            if 'collection_report' in filename.lower():
                continue
            
            # 通过文件名识别数据类型
            file_type = self._identify_file_type(filename)
            if file_type:
                csv_files[file_type] = {
                    'file_path': file_path,
                    'filename': filename,
                    'config': self.file_priority.get(file_type, {'weight': 'normal', 'max_rows': 10})
                }
        
        return csv_files
    
    def _identify_file_type(self, filename: str) -> Optional[str]:
        """根据文件名识别数据类型"""
        filename_lower = filename.lower()
        
        # 定义文件名关键词映射
        type_mapping = {
            'stock_daily_catl': ['stock_daily'],
            'institution_recommendation_catl': ['institution_recommendation'],
            'stock_news_catl': ['stock_news'],
            'china_cpi': ['china_cpi'],
            'china_gdp': ['china_gdp'],
            'industry_fund_flow': ['industry_fund_flow'],
            'market_overview': ['market_overview'],
            'regional_indices': ['regional_indices'],
            'option_volatility': ['option_volatility'],
            'fund_flow_industry': ['fund_flow_industry']
        }
        
        for file_type, keywords in type_mapping.items():
            if any(keyword in filename_lower for keyword in keywords):
                return file_type
        
        return None
    
    def read_and_process_csv(self, file_path: Path, max_rows: int, weight: str) -> List[Dict]:
        """读取并处理CSV文件"""
        try:
            df = pd.read_csv(file_path, encoding='utf-8-sig')
            
            if df.empty:
                print(f"⚠️ 文件为空: {file_path.name}")
                return []
            
            # 根据权重选择数据行
            if weight == 'high':
                # 高优先级：取最新的数据（末尾）
                processed_df = df.tail(max_rows)
            else:
                # 其他优先级：取开头的数据
                processed_df = df.head(max_rows)
            
            # 填充NaN值
            processed_df = processed_df.fillna('')
            
            # 转换为字典列表
            records = processed_df.to_dict(orient='records')
            
            print(f"✅ 处理完成 {file_path.name}: {len(records)} 条记录")
            return records
            
        except Exception as e:
            print(f"❌ 处理文件失败 {file_path.name}: {e}")
            return []
    
    def generate_llm_analysis_prompt(self) -> str:
        """生成适合LLM分析的提示格式"""
        csv_files = self.find_csv_files()
        
        if not csv_files:
            return "No valid CSV files found in the specified directory."
        
        # 按权重排序，股票日线数据优先
        def sort_priority(item):
            file_type, file_info = item
            weight = file_info['config']['weight']
            
            # 股票日线数据最优先
            if 'stock_daily_catl' in file_type:
                return (0, 0)  # 最高优先级
            
            weight_order = {'high': 1, 'medium': 2, 'normal': 3}
            base_priority = weight_order.get(weight, 4)
            
            # 在同权重内，按文件类型细分
            if weight == 'high':
                if 'institution_recommendation' in file_type:
                    return (base_priority, 1)
                elif 'stock_news' in file_type:
                    return (base_priority, 2)
            
            return (base_priority, 0)
        
        sorted_files = sorted(csv_files.items(), key=sort_priority)
        
        # 构建LLM分析提示
        prompt_parts = []
        
        # 添加总体说明
        stock_code = self._extract_stock_code()
        prompt_parts.append(f"# 股票 {stock_code} 综合数据分析")
        prompt_parts.append("\n以下是该股票的各类数据，请进行综合分析并给出投资建议：\n")
        
        # 添加数据概览
        prompt_parts.append("## 📊 数据概览")
        for i, (file_type, file_info) in enumerate(sorted_files, 1):
            weight_emoji = {"high": "🔥", "medium": "⭐", "normal": "📋"}
            emoji = weight_emoji.get(file_info['config']['weight'], "📋")
            prompt_parts.append(f"{i}. {emoji} {self._get_chinese_name(file_type)} ({file_info['filename']})")
        
        prompt_parts.append("\n## 📈 详细数据\n")
        
        # 添加每个数据集
        for i, (file_type, file_info) in enumerate(sorted_files, 1):
            file_path = file_info['file_path']
            config = file_info['config']
            
            # 读取和处理数据
            data = self.read_and_process_csv(file_path, config['max_rows'], config['weight'])
            
            if not data:
                continue
            
            # 添加数据集标题
            chinese_name = self._get_chinese_name(file_type)
            priority_label = {"high": "(重点关注)", "medium": "(重要参考)", "normal": "(背景信息)"}
            priority = priority_label.get(config['weight'], "")
            
            prompt_parts.append(f"### Dataset {i}: {chinese_name} {priority}")
            prompt_parts.append(f"文件: {file_info['filename']}")
            prompt_parts.append(f"数据量: {len(data)} 条记录\n")
            
            # 添加JSON数据
            json_data = json.dumps(data, ensure_ascii=False, indent=2)
            prompt_parts.append("```json")
            prompt_parts.append(json_data)
            prompt_parts.append("```\n")
        
        # 添加分析要求
        prompt_parts.append("## 🎯 分析要求")
        prompt_parts.append("请基于以上数据进行以下分析：")
        prompt_parts.append("1. **价格趋势分析**: 根据股票日线数据分析价格走势")
        prompt_parts.append("2. **技术指标评估**: 结合移动平均线、成交量等技术指标")
        prompt_parts.append("3. **机构观点**: 分析机构评级和目标价")
        prompt_parts.append("4. **市场环境**: 考虑宏观经济数据和行业资金流向")
        prompt_parts.append("5. **新闻影响**: 评估相关新闻对股价的潜在影响")
        prompt_parts.append("6. **投资建议**: 给出明确的买入/持有/卖出建议及理由")
        prompt_parts.append("\n请用中文回答，并提供具体的数据支撑。")
        
        return "\n".join(prompt_parts)
    
    def _extract_stock_code(self) -> str:
        """从目录名提取股票代码"""
        dir_name = self.data_dir.name
        if 'output_' in dir_name:
            return dir_name.replace('output_', '')
        return dir_name
    
    def _get_chinese_name(self, file_type: str) -> str:
        """获取数据类型的中文名称"""
        name_mapping = {
            'stock_daily_catl': 'Stock Daily Price Data (股票日线数据)',
            'institution_recommendation_catl': 'Institution Recommendations (机构评级)',
            'stock_news_catl': 'Stock News (股票新闻)',
            'china_cpi': 'China CPI (中国CPI)',
        
```

### Core Architecture Module: `Wonderful_workflow_corpus/invest/html_report_generator.py`
```
#!/usr/bin/env python3
"""
HTML Report Generator for Stock Analysis
Generates a beautiful neomorphism-style HTML page with optimized content layout.
"""

import os
import re
import json
import base64
import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import markdown
from dataclasses import dataclass
import shutil


@dataclass
class ReportSection:
    """Represents a section of the report with its content and metadata."""
    title: str
    content: Dict[str, Any]
    order: int
    visible: bool = True


class MarkdownParser:
    """Parses markdown content and extracts structured data."""
    
    def __init__(self, md_content: str):
        self.md_content = md_content
        self.sections = {}
        self.metadata = {}
        self.parse_content()
    
    def parse_content(self):
        """Parse the markdown content into structured sections."""
        lines = self.md_content.split('\n')
        current_section = None
        current_content = []
        
        # Extract metadata first
        self.metadata = self._extract_metadata(lines)
        
        for line in lines:
            line = line.strip()
            
            # Main section headers (##)
            if line.startswith('## '):
                if current_section:
                    section_data = {
                        'subsections': self._parse_subsections(current_content),
                        'raw_content': '\n'.join(current_content)
                    }
                    # Only add sections with actual content
                    if section_data['subsections']:
                        self.sections[current_section] = section_data
                current_section = line[3:].strip()
                current_content = []
            
            # Subsection headers (###)
            elif line.startswith('### '):
                current_content.append(line)
            
            else:
                current_content.append(line)
        
        # Store the last section
        if current_section:
            section_data = {
                'subsections': self._parse_subsections(current_content),
                'raw_content': '\n'.join(current_content)
            }
            # Only add sections with actual content
            if section_data['subsections']:
                self.sections[current_section] = section_data
    
    def _extract_metadata(self, lines: List[str]) -> Dict[str, str]:
        """Extract metadata from the markdown header."""
        metadata = {}
        
        for line in lines:
            # Extract key-value pairs like **Date**: 2025年07月25日
            if '**' in line and ':' in line:
                match = re.search(r'\*\*([^*]+)\*\*:\s*(.+)', line)
                if match:
                    key = match.group(1).strip()
                    value = match.group(2).strip()
                    metadata[key] = value
        
        return metadata
    
    def _parse_subsections(self, content: List[str]) -> Dict[str, Any]:
        """Parse subsections from content lines."""
        subsections = {}
        current_subsection = None
        current_content = []
        
        for line in content:
            if line.startswith('### '):
                if current_subsection:
                    subsection_data = self._parse_subsection_content(current_content)
                    # Only add subsections with actual content
                    if self._has_content(subsection_data):
                        subsections[current_subsection] = subsection_data
                current_subsection = line[4:].strip()
                current_content = []
            else:
                current_content.append(line)
        
        if current_subsection:
            subsection_data = self._parse_subsection_content(current_content)
            # Only add subsections with actual content
            if self._has_content(subsection_data):
                subsections[current_subsection] = subsection_data
        
        return subsections
    
    def _has_content(self, subsection_data: Dict[str, Any]) -> bool:
        """Check if subsection has meaningful content."""
        tables = subsection_data.get('tables', [])
        lists = subsection_data.get('lists', [])
        text = subsection_data.get('text', [])
        
        # Check for meaningful tables (not empty or header-only)
        meaningful_tables = []
        for table in tables:
            rows = table.get('rows', [])
            if rows and not all(all(cell in ['', '-', 'N/A', '无', '0'] for cell in row) for row in rows):
                meaningful_tables.append(table)
        
        # Check for meaningful lists
        meaningful_lists = [lst for lst in lists if lst and any(item.strip() for item in lst)]
        
        # Check for meaningful text
        meaningful_text = [line for line in text if line.strip() and line.strip() not in ['---', '无', '-']]
        
        return bool(meaningful_tables or meaningful_lists or meaningful_text)
    
    def _parse_subsection_content(self, content: List[str]) -> Dict[str, Any]:
        """Parse subsection content including tables, lists, and text."""
        tables = []
        lists = []
        text_content = []
        
        i = 0
        while i < len(content):
            line = content[i].strip()
            
            # Skip empty lines
            if not line:
                i += 1
                continue
            
            # Parse tables
            if '|' in line and line.count('|') >= 2:
                table_data, consumed_lines = self._extract_table(content, i)
                if table_data:
                    tables.append(table_data)
                    i += consumed_lines
                    continue
            
            # Parse lists
            elif line.startswith('- ') or line.startswith('* '):
                list_items, consumed_lines = self._extract_list(content, i)
                if list_items:
                    lists.append(list_items)
                    i += consumed_lines
                    continue
            
            # Regular text
            elif line and not line.startswith('---'):
                text_content.append(line)
            
            i += 1
        
        return {
            'tables': tables,
            'lists': lists,
            'text': text_content
        }
    
    def _extract_table(self, content: List[str], start_idx: int) -> Tuple[Optional[Dict[str, Any]], int]:
        """Extract table data starting from start_idx and return consumed lines count."""
        if start_idx >= len(content):
            return None, 0
        
        table_lines = []
        i = start_idx
        
        # Collect table lines
        while i < len(content) and content[i].strip() and '|' in content[i]:
            table_lines.append(content[i].strip())
            i += 1
        
        if len(table_lines) < 2:
            return None, 1
        
        # Parse headers
        header_line = table_lines[0]
        headers = [h.strip() for h in header_line.split('|') if h.strip()]
        
        # Find data lines (skip separator line if present)
        data_start_idx = 1
        if len(table_lines) > 1 and all(c in '-|: ' for c in table_lines[1]):
            data_start_idx = 2
        
        # Parse data rows
        rows = []
        for line in table_lines[data_start_idx:]:
            if '|' in line:
                cells = [cell.strip() for cell in line.split('|') if cell.strip()]
                if len(cells) == len(headers):
                    rows.append(cells)
        
        consumed_lines = len(table_lines)
        
        if headers and rows:
            return {
                'headers': headers,
                'rows': rows
            }, consumed_lines
        
        return None, consumed_lines
    
    def _extract_list(self, content: List[str], start_idx: int) -> Tuple[List[
```

### Core Architecture Module: `Wonderful_workflow_corpus/invest/stock_analysis.py`
```
# Main function to run
import platform
import sys
import os
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
import time

# Set matplotlib backend to avoid threading issues
import matplotlib
matplotlib.use('Agg')

sys.path.append(os.path.abspath(os.path.dirname(__file__)))
from catl_data_functions import fetch_stock_data
from stock_chart_tools import generate_stock_charts
# EvoAgentX imports
from evoagentx.models import OpenAILLMConfig, OpenAILLM, OpenRouterConfig, OpenRouterLLM
from evoagentx.workflow import WorkFlowGraph, WorkFlow, WorkFlowGenerator
from evoagentx.agents import AgentManager
from evoagentx.tools import StorageToolkit, CMDToolkit

load_dotenv()

# Read API keys from files
def read_api_key(filename):
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except FileNotFoundError:
        return None

OPENAI_API_KEY = read_api_key("openai_api_key.txt") or os.getenv("OPENAI_API_KEY")
OPEN_ROUTER_API_KEY = read_api_key("openrouter_api_key.txt") or os.getenv("OPENROUTER_API_KEY")

# Fixed variables and paths
available_funds = 100000
current_positions = 500
average_price = 280
position_type = "call"
report_date = datetime.now().strftime('%Y-%m-%d')
llm = OpenAILLM(config=OpenAILLMConfig(model="gpt-4o-mini", openai_key=OPENAI_API_KEY, stream=True, output_response=True, max_tokens=16000))
tools = [StorageToolkit(), CMDToolkit()]

# Path to the workflow module (should be pre-generated)
module_save_path = "invest_demo_4o_mini_v1.json"

# Workflow generation goal (commented out for future use)
WORKFLOW_GOAL = """Create a daily trading decision workflow for A-share stocks.

## Workflow Overview:
A multi-step workflow for daily trading decisions with fixed capital, making trading decisions based on market data and current positions.

## Task Description:
**Name:** daily_trading_decision
**Description:** A comprehensive trading decision system that analyzes market data and generates daily trading operations with detailed analysis.

## Input:
- **goal** (string): Contains stock code, available funds, current positions, data folder path, output file path, and optional past report path

## Output:
- **trading_report** (string): A comprehensive daily trading report with complete analysis

## Analysis Requirements:
The workflow should analyze three key aspects of the stock:

1. **Background Analysis**: Market environment, industry trends, news sentiment, expert opinions, economic factors, and regulatory environment that affect stock prices
2. **Price Analysis**: Historical price patterns, technical indicators, support/resistance levels, and trading volume analysis
3. **Performance Review**: Past trading decisions, performance evaluation, and lessons learned from previous reports

## Workflow Structure:
- Start with file discovery to identify and categorize available data sources
- Perform the three analyses in parallel where possible for efficiency
- Compile all findings into a comprehensive trading report

## Agent Guidelines:
- Agents should use appropriate tools to discover and read files from the data folder
- Each analysis should focus on its specific domain without overlap
- Agents should filter out irrelevant files and focus on data relevant to their analysis
- All analysis must be based on actual data from files - no fake or estimated data
- Present complete data without omissions or truncations

## Report Structure:
The final report should include:
1. **Background Analysis**: Market environment and external factors
2. **Price Analysis**: Technical patterns and indicators
3. **Performance Review**: Historical performance and lessons learned
4. **Trading Recommendations**: Specific buy/sell/hold decisions with quantities and prices

## Critical Requirements:
- Base all analysis on actual data read from files
- If no relevant files are found, report this clearly and do not make up data
- Provide specific trading recommendations with quantities and price targets
- Consider current positions and available capital in decision making
- Structure the report with clear sections and data tables
- Return complete analysis without summarization
"""


def get_directories(stock_code, timestamp):
    """Get directory paths for a given stock code and timestamp"""
    base_dir = Path(f"./{stock_code}")
    data_dir = base_dir / timestamp / "data"
    report_dir = base_dir  / "reports"
    graphs_dir = base_dir / timestamp / "graphs"
    return base_dir, data_dir, report_dir, graphs_dir


def check_data_exists(data_dir):
    """Check if data files already exist in the data directory"""
    if not data_dir.exists():
        return False
    
    # Check for common data file patterns
    expected_files = [
        "stock_daily_catl_*.csv",
        "china_cpi_*.csv", 
        "china_gdp_yearly_*.csv",
        "industry_fund_flow_*.csv",
        "stock_news_catl_*.csv",
        "market_summary_sse_*.csv",
        "market_indices_*.csv",
        "option_volatility_50etf_*.csv",
        "institution_recommendation_catl_*.csv"
    ]
    
    existing_files = list(data_dir.glob("*.csv"))
    if len(existing_files) >= 5:  # At least 5 data files exist
        print(f"✅ 数据文件已存在: {data_dir}")
        print(f"   发现 {len(existing_files)} 个数据文件")
        return True
    
    return False


def check_charts_exist(graphs_dir, stock_code):
    """Check if chart files already exist"""
    if not graphs_dir.exists():
        return False
    
    expected_charts = [
        f"{stock_code}_technical_charts.png",
        f"{stock_code}_candlestick_chart.png"
    ]
    
    existing_charts = [f.name for f in graphs_dir.glob("*.png")]
    if all(chart in existing_charts for chart in expected_charts):
        print(f"✅ 图表文件已存在: {graphs_dir}")
        print(f"   发现 {len(existing_charts)} 个图表文件")
        return True
    
    return False




def execute_workflow(stock_code, data_dir, report_dir, timestamp):
    """Execute the workflow with the given parameters"""
    try:
        # Load workflow graph
        workflow_file = "workflow.json"  # 默认 Linux/macOS
        if platform.system() == "Windows":
            workflow_file = "workflow_windows.json"
        workflow_graph = WorkFlowGraph.from_file(
            workflow_file,
            llm_config=llm.config,
            tools=tools,
        )
        agent_manager = AgentManager(tools=tools)
        agent_manager.add_agents_from_workflow(workflow_graph, llm_config=llm.config)
        workflow = WorkFlow(graph=workflow_graph, agent_manager=agent_manager, llm=llm)
        workflow.init_module()

        # Construct the goal string
        output_file = report_dir / f"text_report_{stock_code}_{timestamp}.md"
        past_report = report_dir / f"text_report_{stock_code}_{timestamp}_previous.md"
        
        goal = f"""I need a daily trading decision for stock {stock_code}.
Available funds: {available_funds} RMB
Current positions: {current_positions} shares of {stock_code} at average price {average_price} RMB
Date: {report_date}
Type of position: {position_type}
Data folder: {data_dir}
Past report folder: {past_report}

Please read ALL files in the data folder and generate a comprehensive trading decision report in Chinese based on real data. Return the complete content.
"""

        output = workflow.execute({"goal": goal})
        try:
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(output)
            print(f"Trading decision report saved to: {output_file}")
            # # Also save a backup
            # with open(report_dir / f"text_report_{stock_code}_{timestamp}_back.md", "w", encoding="utf-8") as f:
            #     f.write(output)
        except Exception as e:
            print(f"Error saving report: {e}")
    except Exception as e:
        print(f"Error executing workflow: {e}")
        import traceback
        traceback.print_exc()


def generate_html_report(stock_code, base_dir, report_dir, g
```

### Core Architecture Module: `Wonderful_workflow_corpus/invest/stock_chart_tools.py`
```
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
股票技术分析图表生成工具
为任意A股股票生成专业的技术分析图表和K线图
"""

import os
import sys
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Union
import warnings
warnings.filterwarnings('ignore')

# Set matplotlib backend to avoid threading issues
import matplotlib
matplotlib.use('Agg')

class StockChartGenerator:
    """股票技术分析图表生成器"""
    
    def __init__(self, symbol: str, output_dir: str = "output"):
        """
        初始化图表生成器
        
        Args:
            symbol (str): 股票代码（如：300750、600519等）
            output_dir (str): 输出目录，默认为"output"
        """
        self.symbol = symbol
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # 数据缓存
        self.stock_data = None
        self.processed_data = None
    
    def generate_mock_data(self) -> pd.DataFrame:
        """生成模拟股票数据用于演示"""
        dates = pd.date_range(start=datetime.now() - timedelta(days=365), end=datetime.now(), freq='D')
        dates = [d for d in dates if d.weekday() < 5]  # 只保留工作日
        
        np.random.seed(42)
        base_price = 1500 if self.symbol == "600519" else 100
        
        prices = []
        current_price = base_price
        
        for i in range(len(dates)):
            change = np.random.normal(0, 0.02)
            current_price = current_price * (1 + change)
            prices.append(current_price)
        
        data = []
        for i, (date, close) in enumerate(zip(dates, prices)):
            volatility = close * 0.03
            high = close + np.random.uniform(0, volatility)
            low = close - np.random.uniform(0, volatility)
            open_price = prices[i-1] if i > 0 else close
            volume = np.random.randint(100000, 1000000)
            
            data.append({
                'date': date.strftime('%Y-%m-%d'),
                'open': round(open_price, 2),
                'high': round(high, 2),
                'low': round(low, 2),
                'close': round(close, 2),
                'volume': volume,
            })
        
        df = pd.DataFrame(data)
        print(f"生成了 {len(df)} 条模拟数据")
        return df
    
    def get_stock_data(self) -> pd.DataFrame:
        """获取股票数据"""
        if self.stock_data is not None:
            return self.stock_data
        
        try:
            import akshare as ak
            print(f"获取股票 {self.symbol} 的数据...")
            
            try:
                df = ak.stock_zh_a_hist(symbol=self.symbol, period="daily", adjust="qfq")
            except:
                try:
                    formatted_symbol = f"sh{self.symbol}" if self.symbol.startswith('6') else f"sz{self.symbol}"
                    df = ak.stock_zh_a_hist(symbol=formatted_symbol, period="daily", adjust="qfq")
                except:
                    print("获取真实数据失败，使用模拟数据...")
                    return self.generate_mock_data()
            
            if df.empty:
                return self.generate_mock_data()
            
            # 重命名列
            df = df.rename(columns={
                '日期': 'date',
                '开盘': 'open',
                '收盘': 'close', 
                '最高': 'high',
                '最低': 'low',
                '成交量': 'volume',
            })
            
            print(f"成功获取 {len(df)} 条真实数据")
            self.stock_data = df.tail(250)  # 只保留最近250天的数据
            return self.stock_data
            
        except Exception as e:
            print(f"获取数据失败，使用模拟数据: {e}")
            return self.generate_mock_data()
    
    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """计算技术指标"""
        # 创建副本避免修改原数据
        df = df.copy()
        
        # 移动平均线
        df['MA5'] = df['close'].rolling(window=5).mean()
        df['MA10'] = df['close'].rolling(window=10).mean()
        df['MA20'] = df['close'].rolling(window=20).mean()
        
        # RSI
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['RSI'] = 100 - (100 / (1 + rs))
        
        # MACD
        ema12 = df['close'].ewm(span=12).mean()
        ema26 = df['close'].ewm(span=26).mean()
        df['MACD'] = ema12 - ema26
        df['MACD_signal'] = df['MACD'].ewm(span=9).mean()
        df['MACD_histogram'] = df['MACD'] - df['MACD_signal']
        
        # 布林带
        df['BB_middle'] = df['close'].rolling(window=20).mean()
        bb_std = df['close'].rolling(window=20).std()
        df['BB_upper'] = df['BB_middle'] + (bb_std * 2)
        df['BB_lower'] = df['BB_middle'] - (bb_std * 2)
        
        # 填充NaN值
        df = df.fillna(method='ffill').fillna(method='bfill')
        
        self.processed_data = df
        return df
    
    def create_technical_chart(self) -> Optional[str]:
        """创建技术分析图表"""
        try:
            import matplotlib.pyplot as plt
            import matplotlib.dates as mdates
            from matplotlib import rcParams
            
            # 设置中文字体
            plt.rcParams['font.sans-serif'] = ['SimHei', 'DejaVu Sans', 'Arial Unicode MS']
            plt.rcParams['axes.unicode_minus'] = False
            
            # 获取处理后的数据
            if self.processed_data is None:
                df = self.get_stock_data()
                df = self.calculate_indicators(df)
            else:
                df = self.processed_data
            
            # 转换日期格式
            df['date'] = pd.to_datetime(df['date'])
            df = df.sort_values('date')
            
            # 创建图表
            fig, axes = plt.subplots(4, 1, figsize=(15, 20))
            fig.suptitle(f'{self.symbol} 技术分析图表', fontsize=16, fontweight='bold')
            
            # 1. 价格和移动平均线
            ax1 = axes[0]
            ax1.plot(df['date'], df['close'], label='收盘价', linewidth=2, color='blue')
            ax1.plot(df['date'], df['MA5'], label='MA5', alpha=0.8, color='orange')
            ax1.plot(df['date'], df['MA10'], label='MA10', alpha=0.8, color='green')
            ax1.plot(df['date'], df['MA20'], label='MA20', alpha=0.8, color='red')
            
            # 布林带
            ax1.fill_between(df['date'], df['BB_upper'], df['BB_lower'], alpha=0.1, color='gray', label='布林带')
            ax1.plot(df['date'], df['BB_upper'], alpha=0.5, color='gray', linestyle='--')
            ax1.plot(df['date'], df['BB_lower'], alpha=0.5, color='gray', linestyle='--')
            
            ax1.set_title('价格走势与技术指标')
            ax1.set_ylabel('价格 (元)')
            ax1.legend()
            ax1.grid(True, alpha=0.3)
            
            # 2. 成交量
            ax2 = axes[1]
            colors = ['red' if df.iloc[i]['close'] >= df.iloc[i]['open'] else 'green' 
                     for i in range(len(df))]
            ax2.bar(df['date'], df['volume'], color=colors, alpha=0.7)
            ax2.set_title('成交量')
            ax2.set_ylabel('成交量')
            ax2.grid(True, alpha=0.3)
            
            # 3. RSI
            ax3 = axes[2]
            ax3.plot(df['date'], df['RSI'], label='RSI', color='purple', linewidth=2)
            ax3.axhline(y=70, color='r', linestyle='--', alpha=0.7, label='超买线(70)')
            ax3.axhline(y=30, color='g', linestyle='--', alpha=0.7, label='超卖线(30)')
            ax3.fill_between(df['date'], 30, 70, alpha=0.1, color='yellow', label='正常区间')
            ax3.set_title('RSI指标')
            ax3.set_ylabel('RSI')
            ax3.set_ylim(0, 100)
            ax3.legend()
            ax3.grid(True, alpha=0.3)
            
            # 4. MACD
            ax4 = axes[3]
            ax4.plot(df['date'], df['MACD'], label='MACD', color='blue', linewidth=2)
            ax4.plot(df['date'], df['MACD_signal'], label='信号线', color='red', linewidth=2)
            
            # MACD柱状图
            colors = ['red' if x > 0 else 
```

### Core Architecture Module: `evoagentx/__init__.py`
```

__version__ = '0.1.4'

```

### Core Architecture Module: `evoagentx/actions/__init__.py`
```
from .action import Action, ActionInput, ActionOutput
from .code_verification import CodeVerification
from .code_extraction import CodeExtraction

__all__ = ["Action", "ActionInput", "ActionOutput", "CodeVerification", "CodeExtraction"]
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #212** (2026-04-22): **[Bug] Using official examples, but generating results keeps generating the same content cyclically**
  *Symptoms*: ### Describe the Bug  - code ```ts openai_config = OpenAILLMConfig(     model="deepseek-chat",       # 指定模型名称     openai_key="sk-25b***************813", # 直接传入密钥     base_url="https://api.deepseek.com/v1",     stream=True,               # 启用流式响应     output_response=True       # 打印响应到标准输出 ) llm = OpenAILLM(config=openai_config)  goal = "生成可以在浏览器中玩的俄罗斯方块游戏的html代码。请使用中文" wf_generator = WorkFlowGenerator(llm=llm) workflow_graph: WorkFlowGraph = wf_generator.generate_workflow(goal=goal) # 可视化工作流结构（可选） workflow_graph.display()  # 将工作流保存为 JSON 文件（可选） workflow_graph.save_module("./workflow_demo.json") ``` - result  <img width="1130" height="1124" alt="Image" src="https://github.com/user-attachments/assets/48b9d159-b145-4992-99e7-74e747dd78cc" />  This is just an example. It's repeated a lot.    ### Operating System  macos 15.7.1  ### Python Version  3.10.18  ### Steps to Reproduce  1. Use official examples  ### Logs or Screenshots  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi, I noticed that you are using deepseek model as the backbone model. However, most of our prompts are optimised based on the OpenAI series model, since other models sometimes failed to follow the instructions. Please try OpenAI models instead. 

- **Issue #199** (2025-10-17): **[Bug] JSON output parser not properly escaping**
  *Symptoms*: ### Describe the Bug  If there is dirty json coming from the output parser in the models/base_model.py causing the workflow execution to fail. Troublesome non-escaped is "[:port]". The parser should be built very strong to handle all sorts of situations and to prevent prompt injection attacks and allow to finish.  ### Operating System  Windows   ### Python Version  3.11  ### Steps to Reproduce  1. Open examples, workflow, workflow_direction.py 2. Paste this goal:   ```goal = """Return only valid JSON containing at least one string value with the literal substring "[:port]" (exact characters). Example JSON should include a field "endpoint" with value "http://localhost[:port]/api" and nothing else outside the JSON."""``` 4. Run it  ### Logs or Screenshots  ``` Traceback (most recent call last):   File "C:\EvoAgentX\evoagentx\models\base_model.py", line 168, in _parse_json     data = yaml.safe_load(json_str)            ^^^^^^^^^^^^^^^^^^^^^^^^   File "C:\EvoAgentX\.venv\Lib\site-packages\yaml\__init__.py", line 125, in s     return load(stream, SafeLoader)            ^^^^^^^^^^^^^^^^^^^^^^^^   File "C:\EvoAgentX\.venv\Lib\site-packages\yaml\__init__.py", line 81, in lo     return loader.get_single_data()            ^^^^^^^^^^^^^^^^^^^^^^^^   File "C:\EvoAgentX\.venv\Lib\site-packages\yaml\constructor.py", line 49, in     node = self.get_single_node()            ^^^^^^^^^^^^^^^^^^^^^^   File "C:\EvoAgentX\.venv\Lib\site-packages\yaml\composer.py", line 36, in ge     document = se
  **Post-Mortem & Fix Analysis**:
  > We have fixed this issue. Please check the latest PR

- **Issue #196** (2025-11-05): **[Bug] RAG failure when we tried to load existing index**
  *Symptoms*: ### Describe the Bug  <img width="682" height="126" alt="Image" src="https://github.com/user-attachments/assets/3624252e-fbe4-4926-a30e-5356637739ee" />  ### Operating System  windows11  ### Python Version  3.10.12  ### Steps to Reproduce  I writed my own implementation based on the rag_engine. If I tried to load the existing index, this error will show up.  ### Logs or Screenshots  <img width="682" height="126" alt="Image" src="https://github.com/user-attachments/assets/4e5733ac-901c-4356-abba-64b949384dec" />  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi, the bug has been received.

- **Issue #181** (2025-09-12): **[Bug] import feedparser the feedparser can not be found**
  *Symptoms*: ### Describe the Bug  <img width="424" height="160" alt="Image" src="https://github.com/user-attachments/assets/1a5336b6-8744-464d-a398-eceb0e88494d" />  ### Operating System  windows11  ### Python Version  3.10.2  ### Steps to Reproduce  The feedparser for windows installation has some issue  ### Logs or Screenshots  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > <img width="1089" height="309" alt="Image" src="https://github.com/user-attachments/assets/2547a2ae-759a-4c5a-b10c-9728449216b7" />  Hi, it seems feedparser can be installed on Windows.
  > Thanks for your reply, here is my screenshot.  <!-- Failed to upload "image.png" -->I use the admin mode and update the setuptool by pip install --upgrade setuptools but it does not work
  > Thanks for your reply, here is my screenshot.  I use the admin mode and update the setuptool by pip install --upgrade setuptools but it does not work  <img width="567" height="365" alt="Image" src="https://github.com/user-attachments/assets/5b0cd918-80ad-47c2-80ce-53448d7844c5" />

- **Issue #180** (2025-09-16): **[Bug] WikipediaSearchToolkit seems can not install on windows, so the __init__.py will have error so the windows can not use this package.**
  *Symptoms*: ### Describe the Bug  WikipediaSearchToolkit seems can not install on windows, so the __init__.py will have error so the windows can not use this package. Recommend to comment this comment  ### Operating System  windows11  ### Python Version  3.10  ### Steps to Reproduce  run the install step on windows and you will get this error.  ### Logs or Screenshots  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi, thanks for reporting the bug. Can you share the complete error message?
  > Hi, thanks for reporting this issue! I just tested on Windows and was able to install and use wikipedia without errors, and it’s already included in the requirements.txt. Could you please share the complete error message? That will help me better understand and reproduce the problem.
  > Thanks, here is my screenshot  <img width="712" height="50" alt="Image" src="https://github.com/user-attachments/assets/e131cd26-09a8-4520-b936-d6d62bc35f56" />

- **Issue #160** (2025-09-04): **[Bug] aflow_math example fail to evaluate**
  *Symptoms*: ### Describe the Bug  run aflow_math.py report evaluation failed  Evaluation failed: 'coroutine' object is not subscriptable  ### Operating System  debian  ### Python Version  3.10  ### Steps to Reproduce  1. change executor_llm and optimizer_llm config (which works in textgrad example) 2. run aflow_math.py 3. observe Evaluation failed: 'coroutine' object is not subscriptable,   ### Logs or Screenshots  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > fixed, network problem

- **Issue #144** (2025-09-14): **[Bug] There are bugs when using AliyunLLM as the backend LLM**
  *Symptoms*: ### Describe the Bug  When I run textgrad_optimizer.ipynb with AliyunLLM as the backend LLM, it print the following log:  2025-08-20 22:28:24.505 | ERROR    | evoagentx.workflow.workflow:async_execute:104 - An Error occurs when executing the workflow: Error during single_generate_async of AliyunLLM: HTTPSConnectionPool(host='dashscope.aliyuncs.com', port=443): Max retries exceeded with url: /api/v1/services/aigc/text-generation/generation (Caused by ProxyError('Unable to connect to proxy', RemoteDisconnected('Remote end closed connection without response'))) Error processing async stream: 'async for' requires an object with __aiter__ method, got generator 2025-08-20 22:28:36.875 | WARNING  | evoagentx.evaluators.evaluator:_evaluate_single_example:197 - Error evaluating example and set the metrics to None: Example: {'id': 'test-3600', 'problem': 'Subtract the number of positive multiples of $3$ that are less than $20$ from the number of positive multiples of $6$ that are less than $20$.', 'level': 'Level 4', 'type': 'Prealgebra', 'solution': 'The positive multiples of $3$ that are less than $20$ are $$3, 6, 9, 12, 15, 18.$$The positive multiples of $6$ that are less than $20$ are $$6, 12, 18.$$Therefore, there are $6$ positive multiples of $3$ and $3$ positive multiples of $6$, so our final answer is    $$3 - 6 = -(6 - 3) = \\boxed{-3}.$$'} Error: Error during single_generate_async of AliyunLLM: Failed to process async stream response: 'async for' requires an object with __ait
  **Post-Mortem & Fix Analysis**:
  > Hi, thanks for pointing out this issue. It seems like this issue is due to the connection error. Have you tried disconnecting your VPN and running the code again? 
  > I tried that and found that if I call the AliyunLLM API directly, it works and returns a response. However, when I use it as the backend LLM for the TextGrad optimizer, I encounter the following error: 'Error during single_generate_async of AliyunLLM: Failed to process async stream response: "async for" requires an object with an aiter method, but got a generator.
  > Hi, can you turn off the stream of AliyunLLM? It looks like the error is due to that you return a normal generator instead of async generator. 

- **Issue #133** (2025-09-14): **[Bug] Model-specific failure with kimi-k2: missing goal variable in WorkflowExecutorAgent prompt**
  *Symptoms*: ### Describe the Bug  Using kimi-k2 results in an error because the agent prompt doesn’t include a reference to the goal input variable.  ### Operating System  Windows11  ### Python Version  3.12  ### Steps to Reproduce  Run kimi-k2 workflow  ### Logs or Screenshots  Expected  Either robust templating that guarantees required variables or a clear pre-execution validation error. Actual  Failure attributed to missing goal in prompt (and likely model sensitivity).    ### Additional Context  Suggested Fix •	Add template validation (assert required variables present). •	Document recommended high-performance models and known limitations. Priority  P2

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

### Incident Patch 1: `d77fd6b9` (2026-08-27)
**Commit Message**: Merge pull request #256 from bitkira/fix/alita-generated-tool-output

fix(alita): preserve generated tool results with stdout logs

**File**: `evoagentx/tools/alita_agent.py` (modified, +74/-18)
```diff
@@ -1,16 +1,15 @@
 import json
 import os
-from typing import Any, Dict, List, Optional
+import uuid
+from typing import TYPE_CHECKING, Any, ClassVar, Dict, List, Optional
 
 from ..core.logging import logger
-from ..models.model_configs import LLMConfig
-from ..agents import CustomizeAgent
 
 from .tool import Tool, Toolkit
-from .storage_file import StorageToolkit
-from .search_serpapi import SerpAPIToolkit
-from .interpreter_docker import DockerInterpreterToolkit
-from .interpreter_python import PythonInterpreterToolkit
+
+if TYPE_CHECKING:
+    from ..agents import CustomizeAgent
+    from ..models.model_configs import LLMConfig
 
 
 class GeneratedCodeTool(Tool):
@@ -43,6 +42,8 @@ class GeneratedCodeTool(Tool):
         }
     }
     required: Optional[List[str]] = []
+    _RESULT_MARKER_PREFIX: ClassVar[str] = "__ALITA_GENERATED_TOOL_RESULT__"
+    _RESULT_MARKER: ClassVar[str] = "__ALITA_GENERATED_TOOL_RESULT__="
 
     def __init__(
         self,
@@ -77,12 +78,17 @@ def __call__(self, payload: dict = None) -> Dict[str, Any]:
 
         # Inject payload and user code into a small wrapper that expects the
         # user to set `result` and prints it as JSON.
+        result_marker = f"{self._RESULT_MARKER_PREFIX}_{uuid.uuid4().hex}="
         wrapper_code = (
-            "import json\n\n"
-            f"payload = json.loads({json.dumps(payload_json)})\n\n"
+            "import json as __alita_json\n\n"
+            f"payload = __alita_json.loads({json.dumps(payload_json)})\n\n"
             "result = None\n\n"
             f"{self._source_code}\n\n"
-            "print(json.dumps(result, ensure_ascii=False))\n"
+            "import json as __alita_json\n"
+            "print("
+            f"{json.dumps(result_marker)} + "
+            "__alita_json.dumps(result, ensure_ascii=False)"
+            ")\n"
         )
 
         try:
@@ -101,7 +107,49 @@ def __call__(self, payload: dict = None) -> Dict[str, Any]:
                 "error": "Code executor returned no output for generated tool.",
             }
 
-        # Try to parse the output as JSON; if that fails, return raw text.
+        # Parse the wrapper's marked result while preserving user stdout logs.
+        return self._parse_execution_output(output, marker=result_marker)
+
+    @classmethod
+    def _parse_execution_output(
+        cls, output: str, marker: Optional[str] = None
+    ) -> Dict[str, Any]:
+        result_marker = marker or cls._RESULT_MARKER
+        marker_index = output.rfind(result_marker)
+        failed_result_text = None
+        while marker_index != -1:
+            result_start = marker_index + len(result_marker)
+            line_end = output.find("\n", result_start)
+            if line_end == -1:
+                line_end = len(output)
+                after_result = ""
+            else:
+                after_result = output[line_end + 1 :]
+
+            result_text = output[result_start:line_end].strip()
+            try:
+                parsed = json.loads(result_text)
+            except Exception:
+                failed_result_text = result_text
+            else:
+                result = {
+                    "success": True,
+                    "result": parsed,
+                    "raw_output": output,
+                }
+                logs = (output[:marker_index] + after_result).strip()
+                if logs:
+                    result["logs"] = logs
+                return result
+            marker_index = output.rfind(result_marker, 0, marker_index)
+
+        if failed_result_text is not None:
+            logger.warning(
+                "Failed to parse marked generated tool result as JSON: {}",
+                failed_result_text,
+            )
+
+        # Backward-compatible fallback for unmarked executor output.
         try:
             parsed = json.loads(output)
             return {
@@ -110,10 +158,12 @@ def __call__(self, payload: dict = None) -> Dict[str, Any]:
                 "raw_outpu
```

**File**: `tests/src/tools/test_alita_generated_code_tool.py` (added, +154/-0)
```diff
@@ -0,0 +1,154 @@
+import contextlib
+import io
+from pathlib import Path
+from typing import Dict, List, Optional
+
+from evoagentx.tools.alita_agent import GeneratedCodeTool
+from evoagentx.tools.interpreter_python import PythonExecuteTool, PythonInterpreter
+from evoagentx.tools.tool import Tool
+
+
+class FakePythonExecutor(Tool):
+    name: str = "fake_python_execute"
+    description: str = "Execute Python code and return stdout."
+    inputs: Dict[str, Dict[str, str]] = {
+        "code": {"type": "string", "description": "Python source code."},
+        "language": {"type": "string", "description": "Execution language."},
+    }
+    required: Optional[List[str]] = ["code"]
+
+    def __call__(self, code: str, language: str = "python") -> str:
+        stdout = io.StringIO()
+        with contextlib.redirect_stdout(stdout):
+            exec(code, {})
+        return stdout.getvalue()
+
+
+class AppendingPythonExecutor(FakePythonExecutor):
+    name: str = "appending_python_execute"
+    description: str = "Execute Python code and append output after execution."
+    inputs: Dict[str, Dict[str, str]] = {
+        "code": {"type": "string", "description": "Python source code."},
+        "language": {"type": "string", "description": "Execution language."},
+    }
+    required: Optional[List[str]] = ["code"]
+
+    def __call__(self, code: str, language: str = "python") -> str:
+        return super().__call__(code, language) + "stderr: warning\n"
+
+
+class MarkerCollisionPythonExecutor(FakePythonExecutor):
+    name: str = "marker_collision_python_execute"
+    description: str = "Execute Python code and append a colliding marker line."
+    inputs: Dict[str, Dict[str, str]] = {
+        "code": {"type": "string", "description": "Python source code."},
+        "language": {"type": "string", "description": "Execution language."},
+    }
+    required: Optional[List[str]] = ["code"]
+
+    def __call__(self, code: str, language: str = "python") -> str:
+        marker_start = code.rfind(GeneratedCodeTool._RESULT_MARKER_PREFIX)
+        marker_end = code.find("=", marker_start)
+        assert marker_start != -1
+        assert marker_end != -1
+        marker = code[marker_start : marker_end + 1]
+        return super().__call__(code, language) + f"{marker}not-json\n"
+
+
+def test_generated_code_tool_returns_structured_result_without_logs():
+    tool = GeneratedCodeTool(
+        code_executor=FakePythonExecutor(),
+        tool_name="clean_tool",
+        description="Clean generated tool",
+        code='result = {"echo": payload.get("text")}',
+    )
+
+    output = tool(payload={"text": "hello"})
+
+    assert output["success"] is True
+    assert output["result"] == {"echo": "hello"}
+    assert output["raw_output"]
+    assert "logs" not in output
+
+
+def test_generated_code_tool_separates_stdout_logs_from_result():
+    tool = GeneratedCodeTool(
+        code_executor=FakePythonExecutor(),
+        tool_name="noisy_tool",
+        description="Noisy generated tool",
+        code='print("debug: starting")\nresult = {"echo": payload.get("text")}',
+    )
+
+    output = tool(payload={"text": "hello"})
+
+    assert output["success"] is True
+    assert output["result"] == {"echo": "hello"}
+    assert output["logs"] == "debug: starting"
+    assert "debug: starting" in output["raw_output"]
+
+
+def test_generated_code_tool_handles_output_after_marked_result():
+    tool = GeneratedCodeTool(
+        code_executor=AppendingPythonExecutor(),
+        tool_name="stderr_tool",
+        description="Generated tool with post-result output",
+        code='print("debug: starting")\nresult = {"echo": payload.get("text")}',
+    )
+
+    output = tool(payload={"text": "hello"})
+
+    assert output["success"] is True
+    assert output["result"] == {"echo": "hello"}
+    assert output["logs"] == "debug: starting\nstderr: warning"
+
+
+def test_generated_code_tool_ignores_invalid_marker_collision_after_result():
+    to
```

---

### Incident Patch 2: `f0c179ee` (2026-08-27)
**Commit Message**: Merge pull request #253 from bitkira/fix/evoprompt-state-isolation

fix(evoprompt): isolate registry state during concurrent evaluation

**File**: `evoagentx/optimizers/engine/base.py` (modified, +8/-3)
```diff
@@ -1,7 +1,12 @@
-from typing import Any, Callable, Dict, List, Optional
+from __future__ import annotations
+
 import abc
+from typing import Any, Callable, Dict, List, Optional, TYPE_CHECKING
+
 from .decorators import EntryPoint
-from .registry import ParamRegistry
+
+if TYPE_CHECKING:
+    from .registry import ParamRegistry
 
 class BaseOptimizer(abc.ABC):
     # def __init__(
@@ -67,4 +72,4 @@ def optimize(self):
         if self.program is None:
             raise RuntimeError("No entry function provided or registered.")
         print(f"Starting optimization from entry: {self.program.__name__}")
-        raise NotImplementedError
\ No newline at end of file
+        raise NotImplementedError
```

**File**: `evoagentx/optimizers/engine/decorators.py` (modified, +6/-2)
```diff
@@ -1,5 +1,9 @@
-from typing import Any, Callable, List, Tuple, Optional
-from .registry import ParamRegistry
+from __future__ import annotations
+
+from typing import Any, Callable, List, Tuple, Optional, TYPE_CHECKING
+
+if TYPE_CHECKING:
+    from .registry import ParamRegistry
 
 # --------- EntryPoint decorator ---------
 class EntryPoint:
```

**File**: `evoagentx/optimizers/evoprompt_optimizer.py` (modified, +73/-31)
```diff
@@ -12,6 +12,8 @@
 #   https://opensource.microsoft.com/codeofconduct/
 # -----------------------------------------------------------------------------
 
+from __future__ import annotations
+
 import asyncio
 import json
 import random
@@ -20,19 +22,19 @@
 import csv
 import time
 import itertools
-from typing import Callable, Dict, List
+from typing import Callable, Dict, List, TYPE_CHECKING
 from datetime import datetime
 
 import numpy as np
 from tqdm.asyncio import tqdm as aio_tqdm
-import matplotlib.pyplot as plt
 
-from evoagentx.agents import CustomizeAgent
-from evoagentx.benchmark.bigbenchhard import BIGBenchHard
 from evoagentx.core.logging import logger
-from evoagentx.models import OpenAILLMConfig
 from evoagentx.optimizers.engine.base import BaseOptimizer
-from evoagentx.optimizers.engine.registry import ParamRegistry
+
+if TYPE_CHECKING:
+    from evoagentx.benchmark.bigbenchhard import BIGBenchHard
+    from evoagentx.models import OpenAILLMConfig
+    from evoagentx.optimizers.engine.registry import ParamRegistry
 
 
 class EvopromptOptimizer(BaseOptimizer):
@@ -77,6 +79,7 @@ def __init__(self,
         self.iterations = iterations
         self.llm_config = llm_config
         self.semaphore = asyncio.Semaphore(concurrency_limit)
+        self._program_config_lock = asyncio.Lock()
         self.combination_sample_size = combination_sample_size
 
         # Logging configuration
@@ -100,6 +103,7 @@ def __init__(self,
         self.avg_combo_scores_per_gen: Dict[str, float] = {}
         
         # Initialize paraphrase agent for prompt generation
+        from evoagentx.agents import CustomizeAgent
         self.paraphrase_agent = CustomizeAgent(
             name="ParaphraseAgent",
             description="An agent that paraphrases a given instruction.",
@@ -215,6 +219,8 @@ def _log_detailed_evaluation(self, generation: int, combinations: List[Dict[str,
     def _create_single_metric_plot(self, metric_name: str, generations: List[int],
                                    best_scores: List[float], avg_scores: List[float],
                                    algorithm_name: str, plot_dir: str):
+        import matplotlib.pyplot as plt
+
         fig, ax = plt.subplots(figsize=(12, 7))
         ax.plot(generations, best_scores, marker='o', linestyle='-', linewidth=2, markersize=8, label='Best Score')
         ax.plot(generations, avg_scores, marker='x', linestyle='--', linewidth=2, markersize=8, label='Average Score')
@@ -242,9 +248,12 @@ def _create_single_metric_plot(self, metric_name: str, generations: List[int],
             plt.close(fig)
 
     def _plot_and_save_performance_graph(self, algorithm_name: str):
-        if not self.enable_logging or plt is None:
-            if plt is None:
-                logger.warning("Matplotlib not found, skipping plot generation.")
+        if not self.enable_logging:
+            return
+        try:
+            import matplotlib.pyplot as plt
+        except ImportError:
+            logger.warning("Matplotlib not found, skipping plot generation.")
             return
         if not self.best_scores_per_gen and not self.best_combo_scores_per_gen:
             logger.warning("No performance data to plot.")
@@ -460,8 +469,7 @@ async def _evaluate_combination_list(self, combinations: List[Dict], benchmark:
         all_scores = []
         pbar = aio_tqdm(total=len(combinations), desc="Evaluating batch", leave=False)
         for combo in combinations:
-            tasks = [self._evaluate_combination_on_example(combo, benchmark, ex) for ex in eval_dev_set]
-            example_scores = await asyncio.gather(*tasks)
+            example_scores = await self._evaluate_combination_on_examples(combo, benchmark, eval_dev_set)
             avg_score = sum(example_scores) / len(example_scores) if example_scores else 0.0
             all_scores.append(avg_score)
             pbar.update(1)
@@ -507,47 +515,79 @@ def _generate_combinations(self, node_populations: Dict[str, List
```

**File**: `tests/src/optimizers/test_evoprompt_state_isolation.py` (added, +185/-0)
```diff
@@ -0,0 +1,185 @@
+import asyncio
+import threading
+
+import pytest
+
+from evoagentx.optimizers.engine.base import BaseOptimizer
+from evoagentx.optimizers.evoprompt_optimizer import EvopromptOptimizer
+
+
+class FakeBenchmark:
+    def get_input_keys(self):
+        return ["case"]
+
+    def get_label(self, example):
+        return example["target"]
+
+    def evaluate(self, prediction, label):
+        return {"em": float(prediction == label)}
+
+
+class RaisingBenchmark(FakeBenchmark):
+    def evaluate(self, prediction, label):
+        raise RuntimeError("evaluation failed")
+
+
+class SimpleProgram:
+    def __init__(self):
+        self.prompt = "base"
+
+    def __call__(self, case):
+        return self.prompt, {"case": case}
+
+
+class PromptRegistry:
+    def __init__(self, program):
+        self.program = program
+        self.fields = {"prompt": object()}
+
+    def get(self, name):
+        assert name == "prompt"
+        return self.program.prompt
+
+    def set(self, name, value):
+        assert name == "prompt"
+        self.program.prompt = value
+
+    def names(self):
+        return ["prompt"]
+
+
+class CoordinatedExampleProgram:
+    def __init__(self):
+        self._prompt = "base"
+        self.slow_started = threading.Event()
+        self.fast_returned = threading.Event()
+        self.base_restored_after_fast = threading.Event()
+        self.observed = {}
+
+    @property
+    def prompt(self):
+        return self._prompt
+
+    @prompt.setter
+    def prompt(self, value):
+        self._prompt = value
+        if value == "base" and self.fast_returned.is_set():
+            self.base_restored_after_fast.set()
+
+    def __call__(self, case):
+        if case == "fast":
+            self.slow_started.wait(timeout=1.0)
+            observed = self.prompt
+            self.observed[case] = observed
+            self.fast_returned.set()
+            return observed, {"case": case}
+
+        if case == "slow":
+            self.slow_started.set()
+            self.fast_returned.wait(timeout=1.0)
+            self.base_restored_after_fast.wait(timeout=0.05)
+            observed = self.prompt
+            self.observed[case] = observed
+            return observed, {"case": case}
+
+        observed = self.prompt
+        self.observed[case] = observed
+        return observed, {"case": case}
+
+
+class CrossCombinationProgram:
+    def __init__(self):
+        self.prompt = "base"
+        self.combo_a_entered = threading.Event()
+        self.combo_b_entered = threading.Event()
+        self.observed = []
+
+    def __call__(self, case):
+        initial_prompt = self.prompt
+        if initial_prompt == "combo-a":
+            self.combo_a_entered.set()
+            self.combo_b_entered.wait(timeout=0.05)
+        elif initial_prompt == "combo-b":
+            self.combo_b_entered.set()
+            self.combo_a_entered.wait(timeout=0.05)
+
+        observed = self.prompt
+        self.observed.append((case, initial_prompt, observed))
+        return observed, {"case": case}
+
+
+def make_optimizer(program, concurrency_limit=2):
+    registry = PromptRegistry(program)
+
+    class TestOptimizer(EvopromptOptimizer):
+        def __init__(self):
+            BaseOptimizer.__init__(self, registry=registry, program=program)
+            self.semaphore = asyncio.Semaphore(concurrency_limit)
+            self._program_config_lock = asyncio.Lock()
+            self._eval_cache = {}
+
+        async def optimize(self):
+            return None
+
+    return TestOptimizer()
+
+
+@pytest.mark.asyncio
+async def test_combination_config_is_kept_until_all_examples_finish():
+    program = CoordinatedExampleProgram()
+    optimizer = make_optimizer(program, concurrency_limit=2)
+    benchmark = FakeBenchmark()
+
+    scores = await optimizer._evaluate_combination_on_examples(
+        {"prompt": "optimized"},
+        benchmark,
+        [
+            {"case": "fast", "target": "optimized"},
+          
```

---

### Incident Patch 3: `317a8dfc` (2026-06-28)
**Commit Message**: Merge pull request #263 from FBISiri/docs/fix-missing-os-import-readme

docs: add missing import os in OpenAI API key example

**File**: `README.md` (modified, +1/-0)
```diff
@@ -228,6 +228,7 @@ OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
 Once the API key is set, initialise the LLM with:
 
 ```python
+import os
 from evoagentx.models import OpenAILLMConfig, OpenAILLM
 
 # Load the API key from environment
```

---

### Incident Patch 4: `e0b4f5fc` (2026-06-27)
**Commit Message**: remove auto fix for json schema

**File**: `evoagentx/utils/utils.py` (modified, +0/-45)
```diff
@@ -359,51 +359,6 @@ def params_to_json(params: List[Parameter], ignore: List[str] = []) -> str:
     return params_json
 
 
-def fix_property_name(object: Any, json_schema: Dict) -> Any:
-    """
-    Recursively fixes the property names of `object` to match the provided JSON schema.
-    """
-    if object is None:
-        return object
-
-    if json_schema["type"] == "array" and json_schema["items"]["type"] == "object":
-        return [fix_property_name(item, json_schema["items"]) for item in object]
-
-    elif json_schema["type"] == "object":
-        fixed_object = dict()
-        properties = json_schema.get("properties")
-
-        if properties is None:
-            return object
-
-        for property_name, property_schema in properties.items():
-
-            if property_schema["type"] == "array":
-                property = object.get(property_name, None)
-                if property is not None:
-                    fixed_object[property_name] = [fix_property_name(item, property_schema["items"]) for item in property]
-
-            elif property_schema["type"] == "object":
-                property = object.get(property_name, None)
-                if property is not None:
-                    fixed_object[property_name] = fix_property_name(property, property_schema)
-
-            else:
-                object_properties_lower = {name.lower(): name for name in object}
-                schema_properties_lower = {name.lower(): name for name in properties}
-
-                for name in object_properties_lower:
-                    if name in schema_properties_lower:
-                        fixed_object[schema_properties_lower[name]] = object[object_properties_lower[name]]
-                    else:
-                        fixed_object[object_properties_lower[name]] = object[object_properties_lower[name]]
-
-        return fixed_object
-
-    else:
-        return object
-
-
 def resolve_json_schema_ref(json_schema: Any, root_schema: Optional[Dict] = None) -> Any:
     """
     Recursively resolve all $ref in a JSON schema.
```

**File**: `evoagentx/workflow/workflow.py` (modified, +2/-17)
```diff
@@ -2,7 +2,7 @@
 import traceback
 from copy import deepcopy
 from pydantic import Field, ValidationError, create_model
-from typing import Dict, Literal, Optional, List, Union
+from typing import Literal, Optional, List, Union
 from ..core.logging import logger
 from ..core.exception import DisplayableException, InputValidationError
 from ..core.module import BaseModule
@@ -19,7 +19,7 @@
 from .action_graph import ActionGraph
 from ..hitl import HITLManager, HITLBaseAgent
 from ..utils.async_utils import call_maybe_async, is_method_overridden, run_coroutine_sync
-from ..utils.utils import generate_dynamic_class_name, fix_property_name, format_validation_error
+from ..utils.utils import generate_dynamic_class_name, format_validation_error
 from ..actions import ActionInput, ActionOutput
 
 
@@ -193,26 +193,11 @@ async def _execute_workflow(self, inputs: Optional[dict] = None, extract_output:
             output: str = await self.workflow_manager.extract_output(graph=self.graph, env=self.environment)
         else:
             output: dict = self.environment.get_execution_data(self.output_names)
-            output = self._fix_outputs(output)
 
         self.graph.reset_graph()
         logger.info("Workflow execution completed successfully")
         return output
 
-    def _fix_outputs(self, outputs: Dict) -> Dict:
-        """
-        Recursively fixes the property names of the outputs to match the provided JSON schema.
-        """
-        outputs_copy = deepcopy(outputs)
-
-        for output_name, output in outputs_copy.items():
-            json_schema = self.graph.workflow_outputs_dict[output_name].json_schema
-
-            if json_schema:
-                outputs_copy[output_name] = fix_property_name(output, json_schema)
-
-        return outputs_copy
-
     def _validate_inputs(self, inputs: dict):
         workflow_inputs = [param.to_dict(ignore=["class_name"]) for param in self.graph.workflow_inputs]
         input_validator = CustomizeAgent.create_action_input(workflow_inputs, "workflow_inputs")
```

**File**: `evoagentx/workflow/workflow_graph.py` (modified, +46/-145)
```diff
@@ -300,7 +300,7 @@ def get_output_names(self, required: bool = False) -> List[str]:
         else:
             return [param.name for param in self.outputs]
 
-    def check_agents(self, auto_fix: bool = False):
+    def check_agents(self):
         """
         Checks if any agent assigned to this node accept the node inputs and if any agent outputs the node outputs.
         """
@@ -333,25 +333,17 @@ def _check_agent_dict(agent_dict: dict, inputs_or_outputs: Literal["inputs", "ou
             # "input" or "output"
             input_or_output = inputs_or_outputs[:-1]
 
-            for i, agent_input_or_output in enumerate(agent_dict[inputs_or_outputs]):
+            for agent_input_or_output in agent_dict[inputs_or_outputs]:
                 if agent_input_or_output["name"] in node_inputs_outputs[inputs_or_outputs]:
                     in_agents[inputs_or_outputs][agent_input_or_output["name"]] = True
                     agent_input_or_output_param = Parameter(**agent_input_or_output)
-                    try:
-                        validate_param(
-                            node_inputs_outputs[inputs_or_outputs][agent_input_or_output["name"]],
-                            agent_input_or_output_param,
-                            f"node '{self.name}' {input_or_output}",
-                            f"agent '{agent_dict['name']}' {input_or_output}",
-                        )
-                    except ValueError as e:
-                        if auto_fix:
-                            logger.warning(e)
-                            logger.info(f"Auto-fixed agent '{agent_dict['name']}' {input_or_output}: '{agent_input_or_output['name']}'")
-                            agent_dict[inputs_or_outputs][i] = node_inputs_outputs[inputs_or_outputs][agent_input_or_output["name"]].to_dict(ignore=["class_name"])
-                        else:
-                            raise
-            
+                    validate_param(
+                        node_inputs_outputs[inputs_or_outputs][agent_input_or_output["name"]],
+                        agent_input_or_output_param,
+                        f"node '{self.name}' {input_or_output}",
+                        f"agent '{agent_dict['name']}' {input_or_output}",
+                    )
+
             return agent_dict
 
 
@@ -374,23 +366,15 @@ def _check_agent(agent: Agent, inputs_or_outputs: Literal["inputs", "outputs"])
                 
                 action_params = pydantic_to_parameters(action_format, ignore=ignore)
 
-                for j, param in enumerate(action_params):
+                for param in action_params:
                     if param.name in node_inputs_outputs[inputs_or_outputs]:
                         in_agents[inputs_or_outputs][param.name] = True
-                        try:
-                            validate_param(
-                                node_inputs_outputs[inputs_or_outputs][param.name],
-                                param,
-                                f"node '{self.name}' {input_or_output}",
-                                f"agent action '{agent_actions.name}' {input_or_output}",
-                            )
-                        except ValueError as e:
-                            if auto_fix:
-                                logger.warning(e)
-                                logger.info(f"Auto-fixed agent action '{agent_actions.name}' {inputs_or_outputs}: '{param.name}'")
-                                action_params[j] = node_inputs_outputs[inputs_or_outputs][param.name]
-                            else:
-                                raise
+                        validate_param(
+                            node_inputs_outputs[inputs_or_outputs][param.name],
+                            param,
+                            f"node '{self.name}' {input_or_output}",
+                            f"agent action '{agent_actions.name}' {input_or_output}",
+                        )
 
                 action_params = [p
```

**File**: `tests/src/workflow/test_workflow_graph.py` (modified, +4/-110)
```diff
@@ -499,91 +499,23 @@ def test_node_output_uniqueness(self):
                 workflow_outputs=[Parameter(name="workflow_out", type="string", description="desc")]
             )
 
-    def test_auto_fix_mismatched_params(self):
-        """Test that auto_fix correctly updates node parameters to match workflow/agent parameters."""
-        # Create a node with a mismatched type compared to workflow input
+    def test_mismatched_params_raise(self):
+        """A node parameter that mismatches the workflow parameter (type/required) must raise."""
         mismatched_node = WorkFlowNode(
             name="MismatchedNode",
             description="test",
             inputs=[Parameter(name="input", type="number", description="desc", required=False)], # Should be string, required=True
             outputs=[Parameter(name="output", type="boolean", description="desc")],
             agents=["TestAgent"]
         )
-        
-        # This should fail without auto_fix
+
         with pytest.raises(ValueError):
             WorkFlowGraph(
-                goal="Test Auto-fix",
+                goal="Test mismatch",
                 nodes=[mismatched_node],
                 workflow_inputs=[Parameter(name="input", type="string", description="desc", required=True)],
                 workflow_outputs=[Parameter(name="output", type="string", description="desc")],
             )
-            
-        graph = WorkFlowGraph(
-            goal="Test Auto-fix",
-            nodes=[mismatched_node],
-            workflow_inputs=[Parameter(name="input", type="string", description="desc", required=True)],
-            workflow_outputs=[Parameter(name="output", type="string", description="desc")],
-            auto_fix=True
-        )
-        
-        # Verify it was fixed
-        fixed_input = graph.get_node("MismatchedNode").inputs[0]
-        self.assertEqual(fixed_input.type, "string")
-        self.assertTrue(fixed_input.required)
-
-        fixed_output = graph.get_node("MismatchedNode").outputs[0]
-        self.assertEqual(fixed_output.type, "string")
-        self.assertTrue(fixed_output.required)
-
-    def test_auto_fix_mismatched_params_from_dict(self):
-        """Test that auto_fix correctly updates node parameters when using WorkFlowGraph.from_dict."""
-
-        graph_dict = {
-            "goal": "Test Auto-fix",
-            "nodes": [{
-                "name": "MismatchedNode",
-                "description": "test",
-                "inputs": [{"name": "input", "type": "number", "description": "desc", "required": False}],
-                "outputs": [{"name": "output", "type": "boolean", "description": "desc"}],
-                "agents": [
-                    {
-                        "name": "TestAgent",
-                        "description": "test",
-                        "inputs": [{"name": "input", "type": "integer", "description": "desc", "required": False}],
-                        "outputs": [{"name": "output", "type": "number", "description": "desc", "required": False}],
-                        "prompt_template": {
-                            "class_name": "ChatTemplate",
-                            "instruction": "instruction"
-                        }
-                    }
-                ]
-            }],
-            "workflow_inputs": [{"name": "input", "type": "string", "description": "desc", "required": True}],
-            "workflow_outputs": [{"name": "output", "type": "string", "description": "desc"}],
-        }
-        
-        graph = WorkFlowGraph.from_dict(graph_dict, auto_fix=True)
-
-        # Verify it was fixed
-        fixed_node_input = graph.get_node("MismatchedNode").inputs[0]
-        self.assertEqual(fixed_node_input.type, "string")
-        self.assertTrue(fixed_node_input.required)
-
-        fixed_node_output = graph.get_node("MismatchedNode").outputs[0]
-        self.assertEqual(fixed_node_output.type, "string")
-        self.assertTrue(fixed_node_output.required)
-
-   
```

---

### Incident Patch 5: `23107114` (2026-06-27)
**Commit Message**: fix get_next_task None handling

**File**: `evoagentx/workflow/workflow.py` (modified, +5/-2)
```diff
@@ -238,12 +238,15 @@ def _prepare_inputs(self, inputs: dict) -> dict:
             
         return inputs 
     
-    async def get_next_task(self) -> WorkFlowNode:
+    async def get_next_task(self) -> Optional[WorkFlowNode]:
         task_execution_history = " -> ".join(self.environment.task_execution_history)
         if not task_execution_history:
             task_execution_history = "None"
         logger.info(f"Task Execution Trajectory: {task_execution_history}. Scheduling next subtask ...")
-        task: WorkFlowNode = await self.workflow_manager.schedule_next_task(graph=self.graph, env=self.environment)
+        task: Optional[WorkFlowNode] = await self.workflow_manager.schedule_next_task(graph=self.graph, env=self.environment)
+        if task is None:
+            logger.info("No next subtask could be scheduled (the scheduler returned None).")
+            return None
         logger.info(f"The next subtask to be executed is: {task.name}")
         return task
         
```

---

### Incident Patch 6: `72a5502a` (2026-06-27)
**Commit Message**: fix edge priority issue

**File**: `evoagentx/workflow/workflow_graph.py` (modified, +30/-6)
```diff
@@ -748,11 +748,12 @@ def _init_from_nodes(self, nodes: List[WorkFlowNode] = [], explicit_edges: Optio
         a name with an input of B.
 
         Any user-provided `explicit_edges` are merged *in addition to* the inferred edges
-        (deduplicated by `(source, target)`), so explicit edges supplement — but never replace —
-        the inferred data-flow topology. This lets users express ordering dependencies that carry
-        no shared data, while wrong/incomplete explicit edges can no longer silently break the graph.
-        Explicit edges referencing unknown nodes raise; explicit edges with no matching input/output
-        are kept but emit a warning (see `add_edge`).
+        (deduplicated by `(source, target)`). If an explicit edge has the same `(source, target)`
+        as an inferred edge, the explicit edge replaces the inferred edge's metadata (e.g.
+        `priority`) while preserving the inferred data-flow topology. This lets users express
+        ordering dependencies that carry no shared data, while wrong/incomplete explicit edges can
+        no longer silently break the graph. Explicit edges referencing unknown nodes raise;
+        explicit edges with no matching input/output are kept but emit a warning (see `add_edge`).
         """
         self.nodes = []
         self.edges = []
@@ -767,11 +768,34 @@ def _init_from_nodes(self, nodes: List[WorkFlowNode] = [], explicit_edges: Optio
             for edge in explicit_edges:
                 pair = (edge.source, edge.target)
                 if pair in seen_pairs:
+                    self._replace_edge_by_pair(edge)
                     continue
                 seen_pairs.add(pair)
                 extra_edges.append(edge)
             self.add_edges(*extra_edges, update_graph=False)
 
+    def _replace_edge_by_pair(self, edge: WorkFlowEdge) -> bool:
+        """
+        Replace an existing edge with the same source/target pair, preserving one edge
+        in both `self.edges` and the underlying NetworkX graph.
+        """
+        if not isinstance(edge, WorkFlowEdge):
+            raise ValueError(f"{edge} is not a valid WorkFlowEdge instance!")
+
+        for i, existing_edge in enumerate(self.edges):
+            if existing_edge.source != edge.source or existing_edge.target != edge.target:
+                continue
+
+            self.edges[i] = edge
+            edge_data = self.graph.get_edge_data(edge.source, edge.target, default={})
+            for attrs in edge_data.values():
+                ref = attrs.get("ref")
+                if isinstance(ref, WorkFlowEdge) and ref.source == edge.source and ref.target == edge.target:
+                    attrs["ref"] = edge
+                    return True
+            return True
+        return False
+
     def _init_from_multidigraph(self, graph: MultiDiGraph, nodes: List[WorkFlowNode] = []):
         graph_nodes = [deepcopy(node_attrs["ref"]) for _, node_attrs in graph.nodes(data=True)]
         graph_edges = [deepcopy(edge_attrs["ref"]) for *_, edge_attrs in graph.edges(data=True)]
@@ -1879,4 +1903,4 @@ class SEWWorkFlowGraph(SequentialWorkFlowGraph):
     def __init__(self, **kwargs):
         goal = kwargs.pop("goal", SEW_WORKFLOW["goal"])
         tasks = kwargs.pop("tasks", SEW_WORKFLOW["tasks"])
-        super().__init__(goal=goal, tasks=tasks, **kwargs)
\ No newline at end of file
+        super().__init__(goal=goal, tasks=tasks, **kwargs)
```

**File**: `tests/src/workflow/test_workflow_graph.py` (modified, +36/-0)
```diff
@@ -689,6 +689,42 @@ def make_agent(name, in_name, out_name):
         next_tasks = graph.next()
         self.assertEqual(["A"], [task.name for task in next_tasks])
 
+    def test_explicit_edge_priority_overrides_inferred_edge_priority(self):
+        """When an explicit edge matches an inferred data-flow edge, preserve the explicit metadata."""
+        graph_dict = {
+            "goal": "Test Explicit Edge Priority",
+            "nodes": [
+                {
+                    "name": "A",
+                    "description": "source",
+                    "inputs": [{"name": "wf_in", "type": "string", "description": "desc"}],
+                    "outputs": [{"name": "outA", "type": "string", "description": "desc"}],
+                    "agents": ["AgentA"],
+                },
+                {
+                    "name": "B",
+                    "description": "target",
+                    "inputs": [{"name": "outA", "type": "string", "description": "desc"}],
+                    "outputs": [{"name": "outB", "type": "string", "description": "desc"}],
+                    "agents": ["AgentB"],
+                },
+            ],
+            # A -> B is also inferred from outA, but the explicit priority must win.
+            "edges": [{"source": "A", "target": "B", "priority": 7}],
+            "workflow_inputs": [{"name": "wf_in", "type": "string", "description": "desc"}],
+            "workflow_outputs": [{"name": "outB", "type": "string", "description": "desc"}],
+        }
+
+        graph = WorkFlowGraph.from_dict(graph_dict)
+
+        self.assertEqual([("A", "B", 7)], [(edge.source, edge.target, edge.priority) for edge in graph.edges])
+        graph_edge_refs = [
+            attrs["ref"]
+            for source, target, attrs in graph.graph.edges(data=True)
+            if source == "A" and target == "B"
+        ]
+        self.assertEqual([7], [edge.priority for edge in graph_edge_refs])
+
     def test_to_dict_supports_string_and_dict_agents(self):
         """get_config()/to_dict() must support string agents and convert a callable
         parse_func in a dict agent to its function name (JSON-serializable)."""
```

---

### Incident Patch 7: `235f5d5d` (2026-06-27)
**Commit Message**: fix workflow graph

**File**: `evoagentx/utils/utils.py` (modified, +10/-6)
```diff
@@ -282,7 +282,12 @@ def validate_param(
     actual_params_name: str,
 ):
     """
-    Checks if `actual_param` has the same type, required, description and json_schema value as `required_param`.
+    Checks if `actual_param` is compatible with `required_param`.
+
+    Only the attributes that affect runtime behavior are strictly enforced: `type` and
+    `required`. `description` is free-form text and is not compared. `json_schema` is
+    compared softly — only when both params provide one (matching `Parameter`'s own
+    "provide to validate, omit to skip" semantics).
     """
 
     def format_error_msg(
@@ -306,11 +311,10 @@ def format_error_msg(
     if required_param.required != actual_param.required:
         raise ValueError(format_error_msg("required", required_param.required, actual_param.required))
 
-    if required_param.description != actual_param.description:
-        raise ValueError(format_error_msg("description", required_param.description, actual_param.description))
-
-    if required_param.json_schema != actual_param.json_schema:
-        raise ValueError(format_error_msg("json_schema", required_param.json_schema, actual_param.json_schema))
+    # `json_schema` is optional: only enforce it when both sides provide one.
+    if required_param.json_schema is not None and actual_param.json_schema is not None:
+        if required_param.json_schema != actual_param.json_schema:
+            raise ValueError(format_error_msg("json_schema", required_param.json_schema, actual_param.json_schema))
 
 
 def format_validation_error(error: ValidationError) -> str:
```

**File**: `evoagentx/workflow/workflow_graph.py` (modified, +38/-10)
```diff
@@ -172,13 +172,19 @@ async def patched_async_execute(*args, **kwargs):
 
     def to_dict(self, exclude_none: bool = True, ignore: List[str] = [], **kwargs) -> dict:
         
-        agents_dict: List[dict] = []
+        agents_dict: List[Union[str, dict]] = []
         if self.agents:
             for agent in self.agents:
-                if isinstance(agent, Agent):
+                if isinstance(agent, str):
+                    agents_dict.append(agent)
+                elif isinstance(agent, Agent):
                     agents_dict.append(agent.get_config())
                 elif isinstance(agent, dict):
-                    agents_dict.append(recursive_to_dict(agent))
+                    agent_dict = recursive_to_dict(agent)
+                    # for CustomizeAgent: a callable parse_func is not serializable, store its name
+                    if "parse_func" in agent_dict and callable(agent_dict["parse_func"]):
+                        agent_dict["parse_func"] = agent_dict["parse_func"].__name__
+                    agents_dict.append(agent_dict)
                 else:
                     raise TypeError(f"'{type(agent)}' is an unknown agent type!")
 
@@ -632,21 +638,33 @@ def init_module(self):
         else:
             raise TypeError(f"{type(self.graph)} is an unknown type for graph. Supported types: [MultiDiGraph, WorkFlowGraph]")
         
+        def _dedup_params(params: List[Parameter]) -> List[Parameter]:
+            # Multiple initial/end nodes may share a parameter name (e.g. a common workflow
+            # input). Keep the first occurrence so the derived list passes the uniqueness check.
+            seen = set()
+            deduped = []
+            for param in params:
+                if param.name in seen:
+                    continue
+                seen.add(param.name)
+                deduped.append(param)
+            return deduped
+
         # If `workflow_inputs` is not provided, set it to the inputs of initial nodes
         if self.workflow_inputs is None:
             initial_nodes = [node for node, in_degree in self.graph.in_degree() if in_degree==0]
             workflow_inputs = []
             for node_name in initial_nodes:
                 workflow_inputs.extend(self.get_node(node_name).inputs)
-            self.workflow_inputs = workflow_inputs
+            self.workflow_inputs = _dedup_params(workflow_inputs)
 
         # If `workflow_outputs` is not provided, set it to the outputs of end nodes
         if self.workflow_outputs is None:
             end_nodes = [node for node, out_degree in self.graph.out_degree() if out_degree==0]
             workflow_outputs = []
             for node_name in end_nodes:
                 workflow_outputs.extend(self.get_node(node_name).outputs)
-            self.workflow_outputs = workflow_outputs
+            self.workflow_outputs = _dedup_params(workflow_outputs)
 
         self.workflow_inputs_dict = {param.name: param for param in self.workflow_inputs}
         self.workflow_outputs_dict = {param.name: param for param in self.workflow_outputs}
@@ -1351,11 +1369,17 @@ def filter_nodes_with_uncompleted_predecessors(self, nodes: List[Union[str, Work
 
     def get_next_candidate_nodes(self) -> List[str]:
 
+        # `find_initial_nodes` classifies a node as initial purely from data readiness
+        # (its required inputs are a subset of the workflow inputs). A node can satisfy that
+        # while still having incoming edges — an explicit control edge, or an inferred edge
+        # feeding one of its optional inputs. Those nodes must not start before their
+        # predecessors, so filter the initial candidates by predecessor completion as well.
         uncomplete_initial_nodes = self.get_uncomplete_initial_nodes()
-        if len(uncomplete_initial_nodes) > 0:
-            return uncomplete_initial_nodes
-        
-        # find the last completed nodes in all paths starting from initial nodes. 
+        ready_initial_nodes =
```

**File**: `tests/src/utils/test_validate_param.py` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+import unittest
+
+from evoagentx.core.base_config import Parameter
+from evoagentx.utils.utils import validate_param
+
+
+class TestValidateParam(unittest.TestCase):
+
+    def _validate(self, required: Parameter, actual: Parameter):
+        validate_param(required, actual, "node", "agent")
+
+    def test_differing_description_is_allowed(self):
+        """Description is free-form text and must not cause a validation failure."""
+        required = Parameter(name="p", type="string", description="node-side wording")
+        actual = Parameter(name="p", type="string", description="agent-side wording")
+        # Should not raise.
+        self._validate(required, actual)
+
+    def test_type_mismatch_raises(self):
+        required = Parameter(name="p", type="string", description="d")
+        actual = Parameter(name="p", type="integer", description="d")
+        with self.assertRaises(ValueError):
+            self._validate(required, actual)
+
+    def test_required_mismatch_raises(self):
+        required = Parameter(name="p", type="string", description="d", required=True)
+        actual = Parameter(name="p", type="string", description="d", required=False)
+        with self.assertRaises(ValueError):
+            self._validate(required, actual)
+
+    def test_json_schema_skipped_when_one_side_missing(self):
+        """json_schema is soft: if either side omits it, it is not compared."""
+        schema = {"type": "object", "properties": {"a": {"type": "string"}}}
+        required = Parameter(name="p", type="object", description="d", json_schema=schema)
+        actual = Parameter(name="p", type="object", description="d")  # no json_schema
+        # Should not raise.
+        self._validate(required, actual)
+        # Other direction too.
+        self._validate(actual, required)
+
+    def test_json_schema_enforced_when_both_provided(self):
+        required = Parameter(
+            name="p", type="object", description="d",
+            json_schema={"type": "object", "properties": {"a": {"type": "string"}}},
+        )
+        actual = Parameter(
+            name="p", type="object", description="d",
+            json_schema={"type": "object", "properties": {"a": {"type": "integer"}}},
+        )
+        with self.assertRaises(ValueError):
+            self._validate(required, actual)
+
+    def test_json_schema_match_passes(self):
+        schema = {"type": "object", "properties": {"a": {"type": "string"}}}
+        required = Parameter(name="p", type="object", description="d", json_schema=dict(schema))
+        actual = Parameter(name="p", type="object", description="d", json_schema=dict(schema))
+        # Should not raise.
+        self._validate(required, actual)
+
+
+if __name__ == "__main__":
+    unittest.main()
```

**File**: `tests/src/workflow/test_workflow_graph.py` (modified, +196/-0)
```diff
@@ -216,6 +216,90 @@ def test_fork_join_execution(self):
         next_tasks = self.fork_join_graph.next()
         self.assertEqual(0, len(next_tasks))
     
+    def test_control_edge_not_executed_in_parallel(self):
+        """An explicit control edge (A -> B with no shared data) must be respected even
+        when B's required inputs are all workflow inputs and therefore B is data-initial."""
+        node_a = WorkFlowNode(
+            name="A",
+            description="control source",
+            inputs=[Parameter(name="input1", type="string", description="workflow input")],
+            outputs=[Parameter(name="outputA", type="string", description="output A")],
+            agents=["TestAgent"],
+        )
+        node_b = WorkFlowNode(
+            name="B",
+            description="control target",
+            inputs=[Parameter(name="input1", type="string", description="workflow input")],
+            outputs=[Parameter(name="outputB", type="string", description="output B")],
+            agents=["TestAgent"],
+        )
+        graph = WorkFlowGraph(
+            goal="Control Edge Workflow",
+            nodes=[node_a, node_b],
+            edges=[WorkFlowEdge(source="A", target="B")],
+            workflow_inputs=[Parameter(name="input1", type="string", description="workflow input")],
+            workflow_outputs=[
+                Parameter(name="outputA", type="string", description="output A"),
+                Parameter(name="outputB", type="string", description="output B"),
+            ],
+        )
+
+        # Both A and B are data-initial, but only A may run first.
+        self.assertEqual({"A", "B"}, set(graph.find_initial_nodes()))
+        next_tasks = graph.next()
+        self.assertEqual(1, len(next_tasks))
+        self.assertEqual("A", next_tasks[0].name)
+
+        graph.set_node_status("A", WorkFlowNodeState.COMPLETED)
+        next_tasks = graph.next()
+        self.assertEqual(1, len(next_tasks))
+        self.assertEqual("B", next_tasks[0].name)
+
+    def test_optional_input_edge_respects_dependency(self):
+        """An inferred edge feeding an optional input must be respected even though the
+        target's required inputs are all workflow inputs (so it is data-initial)."""
+        node_a = WorkFlowNode(
+            name="A",
+            description="optional source",
+            inputs=[Parameter(name="input1", type="string", description="workflow input")],
+            outputs=[Parameter(name="outA", type="string", description="output A")],
+            agents=["TestAgent"],
+        )
+        node_b = WorkFlowNode(
+            name="B",
+            description="optional target",
+            inputs=[
+                Parameter(name="input1", type="string", description="workflow input"),
+                Parameter(name="outA", type="string", description="optional from A", required=False),
+            ],
+            outputs=[Parameter(name="outputB", type="string", description="output B")],
+            agents=["TestAgent"],
+        )
+        graph = WorkFlowGraph(
+            goal="Optional Input Workflow",
+            nodes=[node_a, node_b],
+            workflow_inputs=[Parameter(name="input1", type="string", description="workflow input")],
+            workflow_outputs=[
+                Parameter(name="outA", type="string", description="output A"),
+                Parameter(name="outputB", type="string", description="output B"),
+            ],
+        )
+
+        # The A -> B edge is inferred from the shared `outA` name (B's optional input).
+        edge_pairs = [(edge.source, edge.target) for edge in graph.edges]
+        self.assertIn(("A", "B"), edge_pairs)
+
+        # B is data-initial (only required input is the workflow input) but must wait for A.
+        self.assertEqual({"A", "B"}, set(graph.find_initial_nodes()))
+        next_tasks = graph.next()
+        self.assertEqual(1, len(next_tasks))
+        self.assertEqual("A", next_tasks[0].name)
+

```

---

### Incident Patch 8: `adcf8e41` (2026-06-26)
**Commit Message**: fix pytest errors

**File**: `evoagentx/actions/customize_action.py` (modified, +14/-5)
```diff
@@ -72,8 +72,6 @@ def __init__(self, **kwargs):
             self.add_tools(tools)
         self.tool_schemas: List[dict] = compile_tool_schemas(self.tools)
 
-        self.semaphore = asyncio.Semaphore(self.max_tool_call_concurrency)
-
     def prepare_extraction_prompt(self, llm_output_content: str) -> str:
         """Prepare extraction prompt for fallback extraction when parsing fails.
 
@@ -244,7 +242,11 @@ async def _async_extract_output(self, llm_output: Union[str, LLMOutputParser], l
             output = self.outputs_format(**llm_extracted_data)
             return output
 
-    async def _call_single_tool(self, function_param: dict) -> ToolResult:
+    async def _call_single_tool(self, function_param: dict, semaphore: Optional[asyncio.Semaphore] = None) -> ToolResult:
+        # When called outside of `_calling_tools` (e.g. directly in tests), create a
+        # loop-bound semaphore on the fly so concurrency limiting still applies.
+        if semaphore is None:
+            semaphore = asyncio.Semaphore(self.max_tool_call_concurrency)
         tool_call_id = function_param.get("id")
         function_name = function_param.get("function_name") or ""
         function_args = function_param.get("function_args") or {}
@@ -268,7 +270,7 @@ async def _call_single_tool(self, function_param: dict) -> ToolResult:
             return ToolResult(result=output, metadata=metadata, id=tool_call_id)
 
         try:
-            async with self.semaphore:
+            async with semaphore:
                 tool_args_str = json.dumps(function_args, indent=4, ensure_ascii=False)
                 logger.info(f"[Tool Call] Executing tool `{function_name}` with parameters:\n{tool_args_str}")
 
@@ -289,8 +291,15 @@ async def _call_single_tool(self, function_param: dict) -> ToolResult:
             return ToolResult(result={"error": str(e)}, metadata=metadata, id=tool_call_id)
 
     async def _calling_tools(self, tool_call_args: List[dict]) -> List[ToolResult]:
+        # Create the semaphore inside the running event loop. `asyncio.Semaphore`
+        # binds to the loop on first await, so a long-lived instance attribute would
+        # be reused across the fresh loops that `execute()` spins up via
+        # `asyncio.run()` / the thread-pool loop, raising "Semaphore is bound to a
+        # different event loop". A per-call semaphore is loop-safe and still bounds
+        # concurrency within a single tool-calling round.
+        semaphore = asyncio.Semaphore(self.max_tool_call_concurrency)
         tasks = [
-            self._call_single_tool(args)
+            self._call_single_tool(args, semaphore)
             for args in tool_call_args
         ]
 
```

**File**: `pyproject.toml` (modified, +4/-0)
```diff
@@ -91,6 +91,9 @@ tools = [
 multimodal = [
     "torch",
     "datasets>=3.4.0",
+    # Transitive dep of `datasets`; 0.70.18+ resource_tracker raises a harmless
+    # AttributeError at shutdown on some Python builds. Pin below it.
+    "multiprocess<0.70.18",
     "voyageai"
 ]
 optimizers = [
@@ -147,6 +150,7 @@ all = [
     "google-auth-httplib2>=0.1.0",
     "torch",
     "datasets>=3.4.0",
+    "multiprocess<0.70.18",
     "voyageai",
     "textgrad>=0.1.8",
     "dspy",
```

**File**: `requirements.txt` (modified, +4/-0)
```diff
@@ -70,6 +70,10 @@ google-auth-httplib2>=0.1.0
 # multimodal
 # torch  # uncomment and pin as needed, e.g. for cu118: --extra-index-url https://download.pytorch.org/whl/cu118
 datasets>=3.4.0
+# Pulled in transitively by `datasets`. 0.70.18+ resource_tracker calls
+# RLock._recursion_count(), which is absent on some Python builds, raising a
+# harmless AttributeError at interpreter shutdown. Pin below it to avoid the noise.
+multiprocess<0.70.18
 voyageai
 
 # optimizers
```

---

### Incident Patch 9: `7583895c` (2026-06-23)
**Commit Message**: add json schema auto fix in LLMOutputParser

**File**: `evoagentx/models/base_model.py` (modified, +127/-6)
```diff
@@ -6,14 +6,15 @@
 from abc import ABC, abstractmethod
 from collections.abc import Callable
 from copy import copy, deepcopy
-from typing import Any, Dict, List, Optional, Type, Union
+from typing import Any, ClassVar, Dict, List, Optional, Type, Union
 
 import yaml
 from jsonschema import Draft7Validator
 from jsonschema.exceptions import ValidationError as JSONSchemaValidationError
 from pydantic import Field, model_validator
 from pydantic_core import PydanticUndefined
 
+from ..core.logging import logger
 from ..core.module_utils import (
     extract_code_blocks,
     get_type_name,
@@ -39,6 +40,7 @@ class LLMOutputParser(Parser):
         content: The raw text generated by the LLM.
     """
     content: str = Field(default=None, exclude=True, description=RAW_LLM_OUTPUT_DESCRIPTION)
+    fix_json_schema_error: ClassVar[bool] = False
 
     def init_module(self):
         if "_raw_llm_output" in self.kwargs:
@@ -60,8 +62,10 @@ def json_schema_validation(cls, data: dict) -> dict:
                 final_data = remove_none(final_data)
                 validator.validate(final_data)
             except JSONSchemaValidationError as e:
-                raise ValueError(e)
-                
+                if not cls.fix_json_schema_error:
+                    raise ValueError(e)
+                final_data = LLMOutputParser.fix_data_on_validation_fail(validator, final_data)
+
         else:
             for field_name, field_info in cls.model_fields.items():
 
@@ -73,10 +77,128 @@ def json_schema_validation(cls, data: dict) -> dict:
                         try:
                             validator.validate(field_value)
                         except JSONSchemaValidationError as e:
-                            raise ValueError(e)
+                            if not cls.fix_json_schema_error:
+                                raise ValueError(e)
+                            field_value = LLMOutputParser.fix_data_on_validation_fail(validator, field_value)
+                            final_data[field_name] = field_value
 
         return final_data
-    
+
+
+    @staticmethod
+    def fix_data_on_validation_fail(validator, data: dict) -> dict:
+        """Attempts to fix JSON schema validation errors by modifying the data.
+
+        Args:
+            validator: The JSON schema validator.
+            data: The data to fix.
+
+        Returns:
+            The modified data.
+        """
+        fixed_data = deepcopy(data)
+
+        try:
+            fixed_data = LLMOutputParser._recursive_fix(fixed_data, validator.schema)
+        except Exception as e:
+            logger.exception(f"Failed to fix data on JSON schema validation fail. {e}")
+            pass
+
+        try:
+            validator.validate(fixed_data)
+        except JSONSchemaValidationError as e:
+            raise ValueError(e)
+
+        return fixed_data
+
+
+    @staticmethod
+    def _recursive_fix(data: dict, schema: dict) -> dict:
+        """Recursively fixes data against schema."""
+        if schema is None:
+            return data
+
+        # 1. Fix children first (Bottom-Up)
+        if isinstance(data, dict) and "properties" in schema:
+            for k, sub_schema in schema["properties"].items():
+                if k in data:
+                    data[k] = LLMOutputParser._recursive_fix(data[k], sub_schema)
+
+        elif isinstance(data, list) and "items" in schema:
+            items_schema = schema["items"]
+            for i in range(len(data)):
+                data[i] = LLMOutputParser._recursive_fix(data[i], items_schema)
+
+        # 2. Validate and fix current level
+        # Loop because fixing one error may introduce new ones or require re-checking.
+        max_iter = 10
+        validator = Draft7Validator(schema)
+
+        for _ in range(max_iter):
+            errors = sorted(validator.iter_errors(data), key=lambda e: len(e.path), reverse=True)
+
+            if not errors:
+                break
+
+            try:

```

**File**: `evoagentx/models/model_configs.py` (modified, +2/-0)
```diff
@@ -171,6 +171,8 @@ class OpenRouterConfig(LLMConfig):
     tool_choice: Optional[Union[str, dict]] = Field(default=None, description="Controls which tool is called by model. Can be 'none', 'auto', 'required', or specific tool configuration.")
 
     stream: Optional[bool] = Field(default=None, description="If set to true, it sends partial message deltas. Tokens will be sent as they become available, with the stream terminated by a [DONE] message.")
+    extra_body: Optional[dict] = Field(default=None, description="Additional request body parameters for provider-specific features.")
+
     def __str__(self):
         return self.model
 
```

---

### Incident Patch 10: `7fc9d44e` (2026-06-23)
**Commit Message**: fix parse_data_from_text typing and simplify JSON parsing

**File**: `evoagentx/core/module_utils.py` (modified, +44/-49)
```diff
@@ -1,7 +1,8 @@
 import json
 import os
 from datetime import date, datetime
-from typing import Any, Dict, List, Optional, Type, Union, get_args, get_origin
+from types import UnionType
+from typing import Any, Dict, List, Type, Union, get_args, get_origin
 from uuid import uuid4
 
 import regex
@@ -84,29 +85,6 @@ def save_json(data, path: str, type: str="json", use_indent: bool=True) -> str:
     return path
 
 
-def extract_fenced_blocks(text: str, labels: Optional[List[str]] = None) -> List[str]:
-    """
-    Extract fenced code blocks from the given text.
-
-    Args:
-        text (str): The text to extract fenced code blocks from.
-        labels (List[str]): The labels to extract fenced code blocks for.
-
-    Returns:
-        List[str]: Code blocks with specified labels.
-    """
-    # Pattern to match fenced blocks: ```label\ncode\n```
-    pattern = r"```([a-zA-Z0-9_\-\+]*)\s*\n*(.*?)\n*```"
-    matches = regex.findall(pattern, text, regex.DOTALL)
-    
-    if labels:
-        # Normalize labels for case-insensitive matching
-        labels_lower = {label.lower() for label in labels}
-        return [code.strip() for lang, code in matches if lang.strip().lower() in labels_lower]
-    
-    return [code.strip() for _, code in matches]
-
-
 def escape_json_values(string: str) -> str:
 
     def escape_value(match):
@@ -196,30 +174,25 @@ def _replacer(match) -> str:
 
 def fix_json(string: str) -> str:
     string = remove_json_comments(string)
-    string = fix_json_booleans(string)
+    # string = fix_json_booleans(string)
     string = escape_json_values(string)
     return string
 
 
 def parse_json_from_text(text: str) -> List[str]:
     """
-    Autoregressively extract JSON object from text 
+    Autoregressively extract JSON object from text
+
+    Args:
+        text (str): a text that includes JSON data
 
-    Args: 
-        text (str): a text that includes JSON data 
-    
     Returns:
         List[str]: a list of parsed JSON data
     """
-    fenced_blocks = extract_fenced_blocks(text)
-    if fenced_blocks:
-        matches = fenced_blocks
-    else:
-        json_pattern = r"""(?:\{(?:[^{}]*|(?R))*\}|\[(?:[^\[\]]*|(?R))*\])"""
-        pattern = regex.compile(json_pattern, regex.VERBOSE)
-        matches = pattern.findall(text)
-
-    matches = [fix_json(m) for m in matches]
+    json_pattern = r"""(?:\{(?:[^{}]*|(?R))*\}|\[(?:[^\[\]]*|(?R))*\])"""
+    pattern = regex.compile(json_pattern, regex.VERBOSE)
+    matches = pattern.findall(text)
+    matches = [fix_json(match) for match in matches]
     return matches
 
 
@@ -231,28 +204,50 @@ def parse_xml_from_text(text: str, label: str) -> List[str]:
         values = [match.strip() for match in matches]
     return values
 
-def parse_data_from_text(text: str, datatype: str):
-
-    if datatype == "str":
+def parse_data_from_text(text: str, datatype: Type):
+    if datatype is str:
         data = text
-    elif datatype == "int":
+
+    elif datatype is int:
         data = int(text)
-    elif datatype == "float":
+
+    elif datatype is float:
         data = float(text)
-    elif datatype == "bool":
+
+    elif datatype is bool:
         data = text.lower() in ("true", "yes", "1", "on", "True")
-    elif datatype == "list":
-        data = eval(text)
-    elif datatype == "dict":
-        data = eval(text)
+
+    elif datatype is list:
+        try:
+            data = json.loads(text)
+        except json.JSONDecodeError:
+            data = [item.strip() for item in text.split(",")]
+            type_args = get_args(datatype)
+            if len(type_args) == 1:
+                data = [parse_data_from_text(item, type_args[0]) for item in data]
+
+    elif datatype is dict:
+        data = json.loads(text)
+
+    elif get_origin(datatype) is Union or get_origin(datatype) is UnionType:
+        type_args = get_args(datatype)
+        for i, type_arg in enumerate(type_args):
+            try:
+                data = parse_data_from_text(text, 
```

#### Recent Merged Pull Requests:
- **PR #274** (closed): fix(evaluator): stop concurrent Evaluator workers sharing one Agent's short_term_memory (@AmirF194)
- **PR #268** (2026-08-14): Add Novita AI as a supported LLM provider (@jax-novita)
- **PR #265** (2026-06-28): Feat/workflow upgrade (@fangjy6)
- **PR #264** (2026-06-27): Feat/agent upgrade (@fangjy6)
- **PR #263** (2026-06-28): docs: add missing import os in OpenAI API key example (@FBISiri)
- **PR #262** (2026-06-24): Upgrade EAX Core (@fangjy6)
- **PR #261** (2026-06-23): chore: sync and clean up project dependencies (@fangjy6)
- **PR #260** (2026-06-23): [codex] Remove legacy FastAPI app (@fangjy6)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
