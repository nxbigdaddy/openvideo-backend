import { Injectable } from '@nestjs/common';
import { ProviderRuntimeConfig } from '../provider-config.service';
import { NonRetryableError } from '../../../common/errors/non-retryable.error';

export interface StoryGenInput {
  title: string;
  targetLength: number;
  style: string;
  audience: string;
  language: string;
}

export interface StoryGenOutput {
  title: string;
  summary: string;
  content: string;
}

export interface SceneGenOutput {
  sceneNo: number;
  sceneDesc: string;
  characterAction: string;
  narration: string;
}

export interface PromptGenOutput {
  positivePrompt: string;
  negativePrompt: string;
  paramsJson: string;
}

export type PromptOverride = {
  systemPrompt?: string;
  userPrompt: string;
};

export interface ImageGenOutput {
  imageUrl?: string;
  b64Json?: string;
  providerMeta?: unknown;
}

@Injectable()
export class LlmProviderService {
  private getTextProviderEnabledByEnv() {
    return Boolean(process.env.TEXT_PROVIDER_API_KEY && process.env.TEXT_PROVIDER_API_BASE_URL);
  }

  private getTextProviderBaseUrlByEnv() {
    return (process.env.TEXT_PROVIDER_API_BASE_URL ?? '').replace(/\/+$/, '');
  }

  private getTextProviderModelByEnv() {
    return process.env.TEXT_PROVIDER_MODEL ?? 'gpt-4.1-mini';
  }

  private async chatCompletion(
    messages: Array<{ role: string; content: string }>,
    provider?: ProviderRuntimeConfig
  ) {
    const baseUrl = provider?.apiBaseUrl ?? this.getTextProviderBaseUrlByEnv();
    const apiKey = YOUR_SECRET ?? (process.env.TEXT_PROVIDER_API_KEY ?? '');
    const model = provider?.modelName ?? this.getTextProviderModelByEnv();

    const url = `${baseUrl}/chat/completions`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`llm http error: ${resp.status} ${text}`.trim());
    }

    const payload: any = await resp.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('llm empty content');
    }

    return content as string;
  }

  private tryParseJson<T>(raw: string): T {
    const cleaned = raw
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    return JSON.parse(cleaned) as T;
  }

  private isBlockedByEnv(text: string): { blocked: boolean; matched?: string } {
    const blocklistRaw = process.env.CONTENT_BLOCKLIST ?? '';
    const blocklist = blocklistRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!blocklist.length) return { blocked: false };

    const hit = blocklist.find((w) => text.includes(w));
    return hit ? { blocked: true, matched: hit } : { blocked: false };
  }

  async generateStory(
    input: StoryGenInput,
    provider?: ProviderRuntimeConfig,
    override?: PromptOverride
  ): Promise<StoryGenOutput> {
    const check = this.isBlockedByEnv([input.title, input.style, input.audience].join('\n'));
    if (check.blocked) {
      throw new NonRetryableError('content rejected by safety policy', '4101');
    }

    const enabled = Boolean(provider?.apiKey && provider?.apiBaseUrl) || this.getTextProviderEnabledByEnv();
    if (!enabled) {
      // 兜底：离线可跑通队列链路
      const content = [
        `【开场】围绕“${input.title}”展开，以${input.style}风格吸引${input.audience}受众。`,
        `【发展】人物遇到冲突并推动剧情，整体控制在约${input.targetLength}字。`,
        `【高潮与结尾】完成情绪释放，形成可继续拆分分镜的故事结构。`
      ].join('\n');

      return {
        title: input.title,
        summary: `一篇面向${input.audience}、${input.style}风格的短视频故事草稿。`,
        content
      };
    }

    const userPrompt =
      override?.userPrompt ??
      [
        `请生成短视频故事文本。`,
        `输入：标题=${input.title}；风格=${input.style}；受众=${input.audience}；目标字数=${input.targetLength}；语言=${input.language}`,
        `要求：`,
        `1) 输出严格JSON（不要代码块）。`,
        `2) content 字数尽量接近目标字数（允许上下10%）。`,
        `3) summary 要简洁、可用于视频文案。`,
        `输出JSON结构：`,
        `{"title":string,"summary":string,"content":string}`
      ].join('\n');

    const systemPrompt = override?.systemPrompt ?? `你是专业短视频编剧与内容合规助手。请只输出JSON对象。`;

    const content = await this.chatCompletion(
      [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
      ],
      provider
    );

    return this.tryParseJson<StoryGenOutput>(content);
  }

  async generateScenes(
    storyContent: string,
    provider?: ProviderRuntimeConfig,
    override?: PromptOverride
  ): Promise<SceneGenOutput[]> {
    const check = this.isBlockedByEnv(storyContent);
    if (check.blocked) {
      throw new NonRetryableError('content rejected by safety policy', '4102');
    }

    const enabled = Boolean(provider?.apiKey && provider?.apiBaseUrl) || this.getTextProviderEnabledByEnv();
    if (!enabled) {
      const blocks = storyContent.split('\n').filter((s) => s.trim().length > 0).slice(0, 5);
      return blocks.map((block, index) => ({
        sceneNo: index + 1,
        sceneDesc: `镜头${index + 1}：${block}`,
        characterAction: `角色在镜头${index + 1}中推进剧情动作`,
        narration: `旁白：${block}`
      }));
    }

    const userPrompt =
      override?.userPrompt ??
      [
        `请将故事拆分为镜头分镜。`,
        `要求：`,
        `1) 输出严格JSON对象（不要代码块），形如 {"scenes":[...]}。`,
        `2) scenes 至少5个镜头，sceneNo从1开始连续。`,
        `3) 每个scene元素字段：sceneNo、sceneDesc、characterAction、narration。`,
        `输入故事：`,
        storyContent
      ].join('\n');

    const systemPrompt = override?.systemPrompt ?? `你是专业分镜脚本编写助手。请只输出JSON对象。`;

    const content = await this.chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      provider
    );

    // 兼容：有的模型返回 {"scenes":[...]}，有的直接返回 [...]
    const parsed = this.tryParseJson<any>(content);
    if (Array.isArray(parsed)) {
      return parsed as SceneGenOutput[];
    }
    if (parsed?.scenes && Array.isArray(parsed.scenes)) {
      return parsed.scenes as SceneGenOutput[];
    }
    throw new Error('invalid scenes json');
  }

  async generatePrompt(
    sceneDesc: string,
    characterAction: string,
    provider?: ProviderRuntimeConfig,
    override?: PromptOverride
  ): Promise<PromptGenOutput> {
    const check = this.isBlockedByEnv([sceneDesc, characterAction].join('\n'));
    if (check.blocked) {
      throw new NonRetryableError('content rejected by safety policy', '4103');
    }

    const enabled = Boolean(provider?.apiKey && provider?.apiBaseUrl) || this.getTextProviderEnabledByEnv();
    if (!enabled) {
      return {
        positivePrompt: `cinematic, detailed, ${sceneDesc}, ${characterAction}, dramatic lighting, 4k`,
        negativePrompt: 'low quality, blurry, watermark, distorted face',
        paramsJson: JSON.stringify({ size: '1024x1024', steps: 30, cfg: 7 })
      };
    }

    const userPrompt =
      override?.userPrompt ??
      [
        `请为AI绘图生成提示词（正向/反向），并给出推荐图像模型参数。`,
        `输入：sceneDesc=${sceneDesc}；characterAction=${characterAction}`,
        `要求：`,
        `1) 输出严格JSON对象（不要代码块）。`,
        `2) positivePrompt 描述画面、镜头语言、风格元素。`,
        `3) negativePrompt 列出不希望出现的内容。`,
        `4) paramsJson 给出模型参数（允许为对象，最终返回时我会序列化为字符串）。`,
        `输出JSON结构：`,
        `{"positivePrompt":string,"negativePrompt":string,"paramsJson":object}`
      ].join('\n');

    const systemPrompt = override?.systemPrompt ?? `你是资深AI绘图提示词工程师。请只输出JSON对象。`;

    const content = await this.chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      provider
    );

    const parsed = this.tryParseJson<any>(content);
    return {
      positivePrompt: parsed.positivePrompt,
      negativePrompt: parsed.negativePrompt,
      paramsJson: typeof parsed.paramsJson === 'string' ? parsed.paramsJson : JSON.stringify(parsed.paramsJson)
    } as PromptGenOutput;
  }

  async generateImage(
    positivePrompt: string,
    negativePrompt: string | undefined,
    paramsJson: string | undefined,
    provider?: ProviderRuntimeConfig
  ): Promise<ImageGenOutput> {
    if (!provider?.apiKey || !provider?.apiBaseUrl) {
      // 离线兜底：保持链路可跑通
      return {
        imageUrl: `mock://image?prompt=${encodeURIComponent(positivePrompt.slice(0, 60))}`,
        providerMeta: { negativePromptProvided: Boolean(negativePrompt) }
      };
    }

    const url = `${provider.apiBaseUrl}/images/generations`;
    const paramsObj: Record<string, unknown> = paramsJson ? this.tryParseJson<Record<string, unknown>>(paramsJson) : {};

    // 兼容多类实现：尽量把未知参数透传给上游
    const body: Record<string, unknown> = {
      model: provider.modelName,
      prompt: positivePrompt,
      ...paramsObj
    };

    // 某些StableDiffusion类接口使用 negative_prompt
    if (negativePrompt) {
      body['negative_prompt'] = negativePrompt;
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`image http error: ${resp.status} ${text}`.trim());
    }

    const payload: any = await resp.json();
    const first = payload?.data?.[0] ?? {};
    return {
      imageUrl: first?.url,
      b64Json: first?.b64_json,
      providerMeta: payload
    };
  }
}
