from typing import Any

from airalogy import Airalogy
from airalogy import markdown as aimd
from airalogy.assigner import AssignerResult, assigner
from openai import OpenAI
from openai.types.chat import (
    ChatCompletionContentPartParam,
    ChatCompletionMessageParam,
)


AIRALOGY_CLIENT = Airalogy()


def extract_image_data(aimd_content: str) -> tuple[list[str], list[str]]:
    try:
        image_ids = aimd.get_airalogy_image_ids(aimd_content)
    except Exception as exc:
        raise ValueError(f"Failed to parse AIMD for image IDs: {exc}") from exc

    image_urls: list[str] = []
    for file_id in image_ids:
        try:
            image_urls.append(AIRALOGY_CLIENT.get_file_url(file_id=file_id))
        except Exception:
            continue

    return image_ids, image_urls


def build_ai_description(
    aimd_content: str,
    image_urls: list[str],
    api_key: str,
    model: str = "qwen3-vl-flash",
) -> str:
    client = OpenAI(
        api_key=api_key,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )
    system_prompt = (
        "You are verifying that you can see images embedded in Airalogy Markdown. "
        "Use both the text and images provided. "
        "Briefly describe what each image shows (order matters), mention if any image URL seems invalid, "
        "and summarize key visual details in 3-6 sentences. Do not invent content."
    )

    user_content: list[ChatCompletionContentPartParam] = [
        {
            "type": "text",
            "text": aimd_content,
        }
    ]
    for url in image_urls:
        user_content.append(
            {
                "type": "image_url",
                "image_url": {"url": url},
            }
        )

    messages: list[ChatCompletionMessageParam] = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]

    completion = client.chat.completions.create(
        model=model,
        messages=messages,
    )
    content = completion.choices[0].message.content
    if not content:
        raise ValueError("LLM returned empty description.")
    return content.strip()


@assigner(
    assigned_fields=["image_ids", "image_urls", "ai_description"],
    dependent_fields=["aimd_content", "qwen_api_key", "model"],
    mode="manual",
)
def extract_and_describe(dependent_fields: dict[str, Any]) -> AssignerResult:
    aimd_content = dependent_fields["aimd_content"]
    api_key = dependent_fields.get("qwen_api_key") or ""
    model = dependent_fields.get("model") or "qwen3-vl-flash"

    try:
        image_ids, image_urls = extract_image_data(aimd_content)
        description = build_ai_description(
            aimd_content,
            image_urls,
            api_key=api_key,
            model=model,
        )
    except Exception as exc:
        return AssignerResult(
            success=False,
            error_message=f"AIMD image test failed: {exc}",
        )

    return AssignerResult(
        assigned_fields={
            "image_ids": image_ids,
            "image_urls": image_urls,
            "ai_description": description,
        }
    )
