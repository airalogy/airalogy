from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from typing import Any

from airalogy.assigner import AssignerResult, DefaultAssigner, assigner


DEFAULT_TIMEOUT_SECONDS = 120
DEFAULT_DEPENDENT_DATA = {
    "stock_symbol": "BABA",
    "company_name": "阿里巴巴集团",
    "exchange_market": "美股",
    "quote_currency": "USD",
    "analysis_purpose": "长期基本面研究",
    "investment_horizon": "长期基本面",
    "core_analysis_questions": "1. 公司收入增长、利润率、现金流和资本回报是否体现可持续竞争力？ 2. 当前估值相对历史、同业和增长质量是否合理？ 3. 最大风险来自行业周期、监管、竞争、资产负债表还是治理结构？",
    "financial_period_scope": "近三年",
    "custom_financial_scope_note": "优先查看最近年报、最近季报和过去三年趋势；若公司处于周期拐点或重大重组阶段，需要补充更长时间序列。",
    "preferred_financial_sources": "优先使用公司年报、季报、投资者关系材料、交易所公告、SEC/EDGAR、港交所披露易、巨潮资讯、公司官网、审计财务报表和主流金融数据页面。模型给出的价格、估值倍数和财务数值必须标记日期和来源；无法核验的数据不得进入最终结论。",
    "peer_companies": "腾讯控股、京东、拼多多、亚马逊、MercadoLibre",
    "data_freshness_requirement": "优先使用最近一个交易日或最近披露期的数据；如果搜索来源日期不明确，必须标记为待复核。",
    "analysis_constraints": "不做短线价格预测，不给买卖点；重点分析商业模式、财务质量、增长驱动、估值区间、风险因素和需要继续核验的数据。",
    "llm_base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "llm_model": "qwen3.6-flash",
    "llm_api_key": "",
    "enable_web_search": True,
    "force_web_search": True,
    "search_strategy": "max",
    "search_freshness_days": "不限制",
    "llm_temperature": 0.2,
    "llm_max_tokens": 4096,
    "llm_extra_body_json": "{}",
    "ai_research_prompt": "请优先检索公司最新年报、季报、投资者关系材料和权威金融数据页面；输出必须区分事实、模型推断和待核验线索。重点关注收入结构、利润率、现金流、资产负债表、资本回报、竞争优势、行业格局、估值倍数、监管和治理风险。",
    "ai_source_checklist": "",
    "ai_company_profile": "",
    "ai_financial_quality_snapshot": "",
    "ai_valuation_snapshot": "",
    "ai_risk_watchlist": "",
    "financial_metrics": [],
    "business_segments": [],
    "moat_assessment": "",
    "management_governance_note": "",
    "valuation_comparables": [],
    "valuation_method_note": "优先使用 PE、PS、EV/EBITDA、自由现金流收益率、历史估值区间和同业比较；对于周期股、金融股、平台公司或高成长公司，需要说明为什么选择该估值口径。",
    "report_focus": "形成一份供内部研究使用的基本面备忘录，重点说明商业质量、财务质量、估值合理性、主要风险、需要继续核验的来源和下一步跟踪指标。",
    "conclusion_style": "中性分析",
}


def _as_text(value: Any, default: str = "") -> str:
    if value is None:
        return default
    if isinstance(value, str):
        return value
    return str(value)


def _as_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on", "是"}


def _as_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _as_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _loads_json_dict(value: Any) -> dict[str, Any]:
    if not value:
        return {}
    if isinstance(value, dict):
        return dict(value)
    text = str(value).strip()
    if not text:
        return {}
    loaded = json.loads(text)
    if not isinstance(loaded, dict):
        raise ValueError("额外请求体 JSON 必须是对象，例如 {\"enable_thinking\": false}")
    return loaded


def _completion_url(base_url: str) -> str:
    url = base_url.strip().rstrip("/")
    if not url:
        raise ValueError("Base URL 不能为空")
    if url.endswith("/chat/completions"):
        return url
    return f"{url}/chat/completions"


def _format_table_rows(rows: Any) -> str:
    if not rows:
        return "（未填写）"
    if not isinstance(rows, list):
        return str(rows)

    lines: list[str] = []
    for idx, row in enumerate(rows, start=1):
        if isinstance(row, dict):
            parts = [f"{key}: {value}" for key, value in row.items()]
            lines.append(f"{idx}. " + "；".join(parts))
        else:
            lines.append(f"{idx}. {row}")
    return "\n".join(lines)


def _build_request_payload(dependent_fields: dict[str, Any], user_prompt: str) -> dict[str, Any]:
    model = _as_text(dependent_fields.get("llm_model"), "qwen3.6-flash")
    temperature = _as_float(dependent_fields.get("llm_temperature"), 0.2)
    max_tokens = _as_int(dependent_fields.get("llm_max_tokens"), 4096)
    extra_body = _loads_json_dict(dependent_fields.get("llm_extra_body_json"))

    payload: dict[str, Any] = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "你是严谨的股票基本面研究助手，只能做研究辅助和信息整理。"
                    "必须区分公开事实、模型推断和待核验线索；不得编造财务数据、公告链接、估值倍数或来源。"
                    "不得输出买卖建议、目标价、收益承诺或确定性价格预测。"
                    "输出中文 Markdown，并保持固定二级标题。"
                ),
            },
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    if _as_bool(dependent_fields.get("enable_web_search"), True):
        payload["enable_search"] = True
        search_options: dict[str, Any] = {}
        strategy = _as_text(dependent_fields.get("search_strategy"), "max").strip()
        if strategy:
            search_options["search_strategy"] = strategy
        if _as_bool(dependent_fields.get("force_web_search"), True):
            search_options["forced_search"] = True
        freshness = _as_text(dependent_fields.get("search_freshness_days"), "不限制").strip()
        if freshness in {"7", "30", "180", "365"}:
            search_options["freshness"] = freshness

        extra_search_options = extra_body.get("search_options")
        if isinstance(extra_search_options, dict):
            search_options.update(extra_search_options)

        if search_options:
            payload["search_options"] = search_options

    for key, value in extra_body.items():
        if key == "search_options" and isinstance(value, dict):
            payload.setdefault("search_options", {}).update(value)
        else:
            payload[key] = value

    return payload


def _call_openai_compatible_chat(dependent_fields: dict[str, Any], user_prompt: str) -> tuple[str, dict[str, Any]]:
    api_key = _as_text(dependent_fields.get("llm_api_key")).strip()
    if not api_key:
        raise ValueError("请先填写 API Key；该字段使用 IgnoreStr，不会保存到记录中。")

    url = _completion_url(_as_text(dependent_fields.get("llm_base_url"), "https://dashscope.aliyuncs.com/compatible-mode/v1"))
    payload = _build_request_payload(dependent_fields, user_prompt)

    request = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=DEFAULT_TIMEOUT_SECONDS) as response:
            raw_text = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        error_text = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"模型接口返回 HTTP {exc.code}: {error_text[:1200]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"无法连接模型接口：{exc}") from exc

    data = json.loads(raw_text)
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError(f"模型响应缺少 choices: {raw_text[:1200]}")
    message = choices[0].get("message") or {}
    content = message.get("content", "")
    if isinstance(content, list):
        content = "\n".join(str(part.get("text", part)) if isinstance(part, dict) else str(part) for part in content)
    return str(content), data


def _extract_section(markdown: str, heading: str) -> str:
    pattern = rf"(?ms)^##\s*{re.escape(heading)}\s*\n(.*?)(?=^##\s+|\Z)"
    match = re.search(pattern, markdown)
    if match:
        return match.group(1).strip()
    return markdown.strip()


def _stock_context(dependent_fields: dict[str, Any]) -> str:
    return f"""
股票代码：{_as_text(dependent_fields.get("stock_symbol"), "（未填写）")}

公司名称：{_as_text(dependent_fields.get("company_name"), "（未填写）")}

交易市场：{_as_text(dependent_fields.get("exchange_market"), "（未填写）")}

报价货币：{_as_text(dependent_fields.get("quote_currency"), "（未填写）")}

分析目的：{_as_text(dependent_fields.get("analysis_purpose"), "（未填写）")}

期限视角：{_as_text(dependent_fields.get("investment_horizon"), "（未填写）")}

核心问题：
{_as_text(dependent_fields.get("core_analysis_questions"), "（未填写）")}

财务口径：{_as_text(dependent_fields.get("financial_period_scope"), "（未填写）")}；{_as_text(dependent_fields.get("custom_financial_scope_note"))}

优先来源：
{_as_text(dependent_fields.get("preferred_financial_sources"), "（未填写）")}

同业公司：{_as_text(dependent_fields.get("peer_companies"), "（未填写）")}

数据新鲜度要求：{_as_text(dependent_fields.get("data_freshness_requirement"), "（未填写）")}

研究约束：
{_as_text(dependent_fields.get("analysis_constraints"), "（未填写）")}
""".strip()


@assigner(
    assigned_fields=[
        "llm_execution_note",
        "ai_source_checklist",
        "ai_company_profile",
        "ai_financial_quality_snapshot",
        "ai_valuation_snapshot",
        "ai_risk_watchlist",
    ],
    dependent_fields=[
        "stock_symbol",
        "company_name",
        "exchange_market",
        "quote_currency",
        "analysis_purpose",
        "investment_horizon",
        "core_analysis_questions",
        "financial_period_scope",
        "custom_financial_scope_note",
        "preferred_financial_sources",
        "peer_companies",
        "data_freshness_requirement",
        "analysis_constraints",
        "llm_base_url",
        "llm_model",
        "llm_api_key",
        "enable_web_search",
        "force_web_search",
        "search_strategy",
        "search_freshness_days",
        "llm_temperature",
        "llm_max_tokens",
        "llm_extra_body_json",
        "ai_research_prompt",
    ],
    mode="manual",
)
def run_stock_fundamental_research(dependent_fields) -> AssignerResult:
    prompt = f"""
请根据以下股票基本面研究任务执行联网初筛。请优先使用公司公告、财报、投资者关系材料、交易所披露、监管文件和权威金融数据页面。输出固定二级标题：

## 来源核验清单
用 Markdown 表格列出最多 12 个候选来源，列包括：来源编号、来源名称、发布日期或数据日期、URL、覆盖内容、核验状态。无法确认日期或 URL 时写“待复核”。

## 公司基本面概览
概述商业模式、主要业务、收入来源、行业位置和近期经营变化。每个关键事实必须引用来源编号或标记待复核。

## 财务质量初筛
分析收入增长、毛利率、经营利润率、现金流、资产负债表、资本回报和会计质量线索。不要编造具体数值；无法核验时写待复核。

## 估值与同业初筛
梳理当前可核验的估值线索、历史估值区间、同业比较和估值口径适用性。不得输出目标价或买卖建议。

## 风险清单
按业务、财务、行业、监管、竞争、治理和估值风险分类，说明需要继续核验的数据。

研究任务：
{_stock_context(dependent_fields)}

补充提示：
{_as_text(dependent_fields.get("ai_research_prompt"), "（无）")}
""".strip()

    try:
        content, raw = _call_openai_compatible_chat(dependent_fields, prompt)
        note = (
            f"已调用模型 `{_as_text(dependent_fields.get('llm_model'), 'qwen3.6-flash')}`。"
            "模型输出仅作为研究线索；请人工核验公告、财报、日期、币种、估值倍数和数据来源。本协议不构成投资建议。"
        )
        raw_id = raw.get("id", "")
        if raw_id:
            note += f"\n\n模型响应 ID：`{raw_id}`"
        return AssignerResult(
            assigned_fields={
                "llm_execution_note": note,
                "ai_source_checklist": _extract_section(content, "来源核验清单"),
                "ai_company_profile": _extract_section(content, "公司基本面概览"),
                "ai_financial_quality_snapshot": _extract_section(content, "财务质量初筛"),
                "ai_valuation_snapshot": _extract_section(content, "估值与同业初筛"),
                "ai_risk_watchlist": _extract_section(content, "风险清单"),
            }
        )
    except Exception as exc:
        return AssignerResult(
            assigned_fields={
                "llm_execution_note": f"模型基本面初筛未完成：{exc}",
                "ai_source_checklist": "",
                "ai_company_profile": "",
                "ai_financial_quality_snapshot": "",
                "ai_valuation_snapshot": "",
                "ai_risk_watchlist": "",
            }
        )


@assigner(
    assigned_fields=[
        "fundamental_score",
        "fundamental_score_rationale",
        "investment_thesis",
        "bear_case",
        "stock_fundamental_report",
        "monitoring_plan",
    ],
    dependent_fields=[
        "stock_symbol",
        "company_name",
        "exchange_market",
        "quote_currency",
        "analysis_purpose",
        "investment_horizon",
        "core_analysis_questions",
        "llm_base_url",
        "llm_model",
        "llm_api_key",
        "enable_web_search",
        "force_web_search",
        "search_strategy",
        "search_freshness_days",
        "llm_temperature",
        "llm_max_tokens",
        "llm_extra_body_json",
        "ai_source_checklist",
        "ai_company_profile",
        "ai_financial_quality_snapshot",
        "ai_valuation_snapshot",
        "ai_risk_watchlist",
        "financial_metrics",
        "business_segments",
        "moat_assessment",
        "management_governance_note",
        "valuation_comparables",
        "valuation_method_note",
        "report_focus",
        "conclusion_style",
    ],
    mode="manual",
)
def draft_stock_fundamental_report(dependent_fields) -> AssignerResult:
    prompt = f"""
请基于研究者已经核验或填写的材料生成股票基本面研究报告草稿。输出固定二级标题：

## 基本面评分
给出 0-100 的研究评分和评分解释。评分只是研究排序工具，不是买卖建议。

## 核心投资逻辑
用多空平衡方式说明商业质量、财务质量、估值、竞争优势和关键催化或跟踪变量。

## 反方观点
列出最强反方论据、关键风险、数据不确定性和可能推翻正面逻辑的信号。

## 基本面研究报告
按“公司概览、业务与竞争力、财务质量、估值与同业、风险因素、待核验事项、研究结论”组织；不得输出目标价、买卖建议或收益承诺。

## 后续跟踪计划
列出下一步要核验的公告、财报指标、经营数据、行业变量和风险触发器。

研究任务：
{_stock_context(dependent_fields)}

AI 来源核验清单：
{_as_text(dependent_fields.get("ai_source_checklist"), "（未填写）")}

AI 公司基本面概览：
{_as_text(dependent_fields.get("ai_company_profile"), "（未填写）")}

AI 财务质量初筛：
{_as_text(dependent_fields.get("ai_financial_quality_snapshot"), "（未填写）")}

AI 估值与同业初筛：
{_as_text(dependent_fields.get("ai_valuation_snapshot"), "（未填写）")}

AI 风险清单：
{_as_text(dependent_fields.get("ai_risk_watchlist"), "（未填写）")}

人工财务指标：
{_format_table_rows(dependent_fields.get("financial_metrics"))}

业务分部：
{_format_table_rows(dependent_fields.get("business_segments"))}

护城河与竞争优势：
{_as_text(dependent_fields.get("moat_assessment"), "（未填写）")}

管理层与治理观察：
{_as_text(dependent_fields.get("management_governance_note"), "（未填写）")}

同业估值比较：
{_format_table_rows(dependent_fields.get("valuation_comparables"))}

估值口径说明：
{_as_text(dependent_fields.get("valuation_method_note"), "（未填写）")}

报告综合重点：
{_as_text(dependent_fields.get("report_focus"), "（未填写）")}

结论口径：{_as_text(dependent_fields.get("conclusion_style"), "中性分析")}
""".strip()

    try:
        content, _raw = _call_openai_compatible_chat(dependent_fields, prompt)
        score_section = _extract_section(content, "基本面评分")
        score_match = re.search(r"\b(100|[1-9]?\d)\b", score_section)
        score = int(score_match.group(1)) if score_match else 0
        return AssignerResult(
            assigned_fields={
                "fundamental_score": max(0, min(100, score)),
                "fundamental_score_rationale": score_section,
                "investment_thesis": _extract_section(content, "核心投资逻辑"),
                "bear_case": _extract_section(content, "反方观点"),
                "stock_fundamental_report": _extract_section(content, "基本面研究报告"),
                "monitoring_plan": _extract_section(content, "后续跟踪计划"),
            }
        )
    except Exception as exc:
        return AssignerResult(
            assigned_fields={
                "fundamental_score": 0,
                "fundamental_score_rationale": "",
                "investment_thesis": "",
                "bear_case": "",
                "stock_fundamental_report": f"基本面研究报告生成未完成：{exc}",
                "monitoring_plan": "",
            }
        )


class Assigner:
    @classmethod
    def all_assigned_fields(cls) -> dict[str, dict[str, object]]:
        return DefaultAssigner.all_assigned_fields()

    @classmethod
    def export_dependency_graph_to_dict(cls) -> dict[str, object]:
        return DefaultAssigner.export_dependency_graph_to_dict()

    @classmethod
    def get_dependent_fields_of_assigned_key(cls, assigned_key: str) -> list[str]:
        return DefaultAssigner.get_dependent_fields_of_assigned_key(assigned_key)

    @classmethod
    def assign(cls, assigned_key: str, dependent_data: dict) -> AssignerResult:
        merged = dict(DEFAULT_DEPENDENT_DATA)
        if isinstance(dependent_data, dict):
            merged.update({key: value for key, value in dependent_data.items() if value is not None})
        return DefaultAssigner.assign(assigned_key, merged)
