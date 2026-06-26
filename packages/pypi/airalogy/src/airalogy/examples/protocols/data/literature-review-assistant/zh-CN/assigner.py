from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from typing import Any

from airalogy.assigner import AssignerResult, DefaultAssigner, assigner


DEFAULT_TIMEOUT_SECONDS = 120
DEFAULT_SEARCH_KEYWORDS = [
    {
        "concept": "极端降雨",
        "concept_role": "核心概念",
        "synonyms": "extreme rainfall; heavy precipitation; storm event; intense rainfall; 特大暴雨; 短历时强降雨",
        "must_have": True,
        "note": "关注事件尺度和暴雨后响应",
    },
    {
        "concept": "野外水样与地表水",
        "concept_role": "对象/场景",
        "synonyms": "surface water; river water; lake water; field water sampling; watershed; catchment; urban runoff",
        "must_have": True,
        "note": "优先河流、湖泊、湿地和流域研究",
    },
    {
        "concept": "水化学与生物地球化学响应",
        "concept_role": "指标/结局",
        "synonyms": "pH; dissolved oxygen; ORP; turbidity; nutrients; nitrogen; phosphorus; carbonates; redox; biogeochemistry",
        "must_have": True,
        "note": "覆盖现场快速指标和机理解释",
    },
    {
        "concept": "状态转变与脆弱性",
        "concept_role": "方法/模型",
        "synonyms": "regime shift; resilience; vulnerability assessment; disturbance; equilibrium; eutrophication; hypoxia",
        "must_have": False,
        "note": "用于寻找脆弱性分析和生态状态转变框架",
    },
]
DEFAULT_DEPENDENT_DATA = {
    "review_type": "范围综述",
    "target_output": "综述报告",
    "research_topic": "极端降雨扰动下野外水样水化学与生化环境响应",
    "research_question": "1. 短历时强降雨或特大暴雨如何改变地表水 pH、溶解氧、ORP、浊度、营养盐和微生物过程？ 2. 暴雨径流、底泥再悬浮和外源污染脉冲通过哪些化学或生物地球化学路径打破原有水体平衡？ 3. 季风期与非季风期的水体脆弱性、恢复能力和状态转变风险有什么差异？",
    "discipline_context": "环境科学/水文水化学/生物地球化学",
    "publication_time_scope": "近五年",
    "custom_time_scope_note": "默认优先检索近五年文献；若涉及经典机理或长期监测框架，可纳入更早的高引用研究。",
    "known_background": "已有一个野外水样观测协议，关注当天气象、场地条件、pH、溶解氧、浊度、电导率、ORP、营养盐、季风期/非季风期和极端降雨扰动。希望文献调研能为碱性条件下 NH4+/NH3 平衡、碳酸盐沉淀、金属氢氧化物沉淀、低氧还原环境、底泥再悬浮、营养盐释放和生态状态转变提供依据。",
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
    "search_keywords": DEFAULT_SEARCH_KEYWORDS,
    "preferred_source_scope": "优先检索 peer-reviewed 期刊论文和综述，可包含 ScienceDirect、SpringerLink、Wiley、ACS、AGU、Nature、Science、Environmental Science & Technology、Water Research、Journal of Hydrology、Biogeochemistry、Limnology and Oceanography、Google Scholar、Semantic Scholar 和 Web of Science 线索。中文资料可补充 CNKI、生态学报、环境科学学报和水科学进展，但最终需要记录可核验 DOI、URL 或数据库线索。",
    "inclusion_criteria": "纳入与地表水、河流、湖泊、湿地或流域暴雨径流相关的研究；优先包含现场监测、事件采样、长期时间序列、实验室水化学分析或机制模型；至少涉及 pH、DO、ORP、浊度、营养盐、底泥再悬浮、微生物过程、富营养化、缺氧或状态转变中的一个主题；优先近五年文献，经典机理研究不限年份。",
    "exclusion_criteria": "排除只讨论大气降雨但不连接水体响应的资料；排除没有明确研究对象、方法或数据来源的网页文章；排除无法核验题名、作者、年份、来源、DOI 或 URL 的模型生成引用；排除只关注饮用水处理工艺且与野外水体事件响应无关的研究。",
    "quality_focus": "重点评价采样是否覆盖降雨前、峰值期和退水期；是否有上游/下游或对照点；是否报告降雨量、水位、流量和土地利用背景；现场仪器是否校准；营养盐和微生物指标是否有实验室质控；结论是否区分稀释、冲刷、底泥再悬浮、内源释放和外源污染脉冲。",
    "ai_search_prompt": "请优先寻找能支持野外水样观测协议设计的文献：暴雨后事件采样、季风期/非季风期比较、pH 与氨氮形态、碳酸盐体系、ORP 与低氧还原过程、底泥再悬浮、氮磷脉冲、富营养化和状态转变。输出候选文献时必须给出 DOI 或可访问 URL；无法核验的来源标记为待复核，不要编造引用。",
    "ai_evidence_summary": "",
    "candidate_literature": [],
    "evidence_extractions": [],
    "quality_appraisals": [],
    "contradiction_notes": "",
    "synthesis_focus": "",
    "review_writing_style": "学术综述",
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
                    "你是严谨的科研文献调研助手。必须区分可核验事实、模型推断和待核验线索。"
                    "不要编造 DOI、题名、作者或 URL；无法确认时标记为待核验。"
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


def _common_context(dependent_fields: dict[str, Any]) -> str:
    return f"""
研究主题：{_as_text(dependent_fields.get("research_topic"), "（未填写）")}

核心研究问题：
{_as_text(dependent_fields.get("research_question"), "（未填写）")}

调研类型：{_as_text(dependent_fields.get("review_type"), "（未填写）")}

目标输出：{_as_text(dependent_fields.get("target_output"), "（未填写）")}

学科或应用场景：{_as_text(dependent_fields.get("discipline_context"), "（未填写）")}

时间范围：{_as_text(dependent_fields.get("publication_time_scope"), "（未填写）")}；{_as_text(dependent_fields.get("custom_time_scope_note"))}

已知背景与约束：
{_as_text(dependent_fields.get("known_background"), "（未填写）")}
""".strip()


@assigner(
    assigned_fields=[
        "llm_execution_note",
        "ai_search_plan",
        "ai_source_candidates",
        "ai_evidence_summary",
        "ai_research_gaps",
    ],
    dependent_fields=[
        "review_type",
        "target_output",
        "research_topic",
        "research_question",
        "discipline_context",
        "publication_time_scope",
        "custom_time_scope_note",
        "known_background",
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
        "search_keywords",
        "preferred_source_scope",
        "inclusion_criteria",
        "exclusion_criteria",
        "quality_focus",
        "ai_search_prompt",
    ],
    mode="manual",
)
def run_literature_search(dependent_fields) -> AssignerResult:
    prompt = f"""
请根据以下调研任务执行联网文献调研初筛。请优先使用可核验的学术来源，并输出固定二级标题：

## 检索策略
给出关键词组合、检索式、优先数据库或网站、纳入/排除逻辑。

## 候选文献
用 Markdown 表格列出最多 12 条候选来源，列包括：来源编号、题名、作者、年份、来源、DOI/URL、相关性、核验状态。找不到 DOI 或 URL 时必须写“待核验”。

## 证据摘要
按主题归纳关键发现，说明每条发现对应哪些来源编号。

## 研究空白与下一步
说明当前证据不足、争议点、需要全文阅读或补充检索的问题。

调研任务：
{_common_context(dependent_fields)}

检索关键词：
{_format_table_rows(dependent_fields.get("search_keywords"))}

优先检索来源：
{_as_text(dependent_fields.get("preferred_source_scope"), "（未填写）")}

纳入标准：
{_as_text(dependent_fields.get("inclusion_criteria"), "（未填写）")}

排除标准：
{_as_text(dependent_fields.get("exclusion_criteria"), "（未填写）")}

质量关注点：
{_as_text(dependent_fields.get("quality_focus"), "（未填写）")}

补充提示：
{_as_text(dependent_fields.get("ai_search_prompt"), "（无）")}
""".strip()

    try:
        content, raw = _call_openai_compatible_chat(dependent_fields, prompt)
        note = (
            f"已调用模型 `{_as_text(dependent_fields.get('llm_model'), 'qwen3.6-flash')}`。"
            "请人工核验候选文献的 DOI、URL、作者和年份后再纳入最终综述。"
        )
        raw_id = raw.get("id", "")
        if raw_id:
            note += f"\n\n模型响应 ID：`{raw_id}`"
        return AssignerResult(
            assigned_fields={
                "llm_execution_note": note,
                "ai_search_plan": _extract_section(content, "检索策略"),
                "ai_source_candidates": _extract_section(content, "候选文献"),
                "ai_evidence_summary": _extract_section(content, "证据摘要"),
                "ai_research_gaps": _extract_section(content, "研究空白与下一步"),
            }
        )
    except Exception as exc:
        error_note = f"模型联网初筛未完成：{exc}"
        return AssignerResult(
            assigned_fields={
                "llm_execution_note": error_note,
                "ai_search_plan": "",
                "ai_source_candidates": "",
                "ai_evidence_summary": "",
                "ai_research_gaps": "",
            }
        )


@assigner(
    assigned_fields=[
        "synthesis_matrix",
        "literature_review_report",
        "remaining_uncertainties",
        "followup_search_plan",
    ],
    dependent_fields=[
        "review_type",
        "target_output",
        "research_topic",
        "research_question",
        "discipline_context",
        "known_background",
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
        "ai_evidence_summary",
        "candidate_literature",
        "evidence_extractions",
        "quality_appraisals",
        "contradiction_notes",
        "synthesis_focus",
        "review_writing_style",
    ],
    mode="manual",
)
def draft_literature_synthesis(dependent_fields) -> AssignerResult:
    prompt = f"""
请基于研究者已经人工筛选和提取的证据生成文献综述草稿。输出固定二级标题：

## 证据矩阵
用表格按主题、主要证据、来源编号、证据强度、局限性整理。

## 综述草稿
按“研究背景、主要发现、机制或方法比较、争议与局限、对本研究的启示”组织；每个关键结论都要引用来源编号，不要引用未纳入或未核验来源。

## 剩余不确定性
列出证据不足、冲突、外推限制和需要全文复查的点。

## 后续检索计划
给出下一轮检索关键词、优先来源和要解决的问题。

调研任务：
{_common_context(dependent_fields)}

综合重点：
{_as_text(dependent_fields.get("synthesis_focus"), "（未填写）")}

综述风格：{_as_text(dependent_fields.get("review_writing_style"), "学术综述")}

AI 初筛证据摘要：
{_as_text(dependent_fields.get("ai_evidence_summary"), "（未填写）")}

人工筛选候选文献：
{_format_table_rows(dependent_fields.get("candidate_literature"))}

证据提取：
{_format_table_rows(dependent_fields.get("evidence_extractions"))}

质量评价：
{_format_table_rows(dependent_fields.get("quality_appraisals"))}

证据冲突记录：
{_as_text(dependent_fields.get("contradiction_notes"), "（未填写）")}
""".strip()

    try:
        content, _raw = _call_openai_compatible_chat(dependent_fields, prompt)
        return AssignerResult(
            assigned_fields={
                "synthesis_matrix": _extract_section(content, "证据矩阵"),
                "literature_review_report": _extract_section(content, "综述草稿"),
                "remaining_uncertainties": _extract_section(content, "剩余不确定性"),
                "followup_search_plan": _extract_section(content, "后续检索计划"),
            }
        )
    except Exception as exc:
        return AssignerResult(
            assigned_fields={
                "synthesis_matrix": "",
                "literature_review_report": f"综述草稿生成未完成：{exc}",
                "remaining_uncertainties": "",
                "followup_search_plan": "",
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
