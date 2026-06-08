const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const authenticateToken = require('../middleware/auth');

const llmProvider = String(process.env.LLM_PROVIDER || (process.env.MINIMAX_API_KEY ? 'minimax' : 'qwen')).toLowerCase();
const qwenConfig = {
  provider: 'qwen',
  apiFormat: 'openai',
  apiKey: process.env.DASHSCOPE_API_KEY,
  model: process.env.QWEN_MODEL || 'qwen-plus',
  baseURL: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
};
const minimaxBaseURL = (process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1').replace(/\/+$/, '');
const minimaxConfig = {
  provider: 'minimax',
  apiFormat: String(process.env.MINIMAX_API_FORMAT || (minimaxBaseURL.includes('/anthropic') ? 'anthropic' : 'openai')).toLowerCase(),
  apiKey: process.env.MINIMAX_API_KEY,
  model: process.env.MINIMAX_MODEL || 'MiniMax-M3',
  baseURL: minimaxBaseURL
};
const llmConfig = llmProvider === 'minimax' ? minimaxConfig : qwenConfig;
const apiKey = llmConfig.apiKey;
const enableThinking = String(process.env.QWEN_ENABLE_THINKING || 'false').toLowerCase() === 'true';
const enableMultimodal = String(process.env.QWEN_ENABLE_MULTIMODAL || 'true').toLowerCase() !== 'false';
const minimaxMaxTokens = Number(process.env.MINIMAX_MAX_TOKENS || 4096);
const minimaxEnableThinking = String(process.env.MINIMAX_ENABLE_THINKING || 'false').toLowerCase() === 'true';

const THINKING_TOGGLE_MODELS = [
  'qwen3.5-plus',
  'qwen3.5-flash',
  'qwen-plus',
  'qwen-turbo',
  'qwen-max',
  'qwq-plus'
];

const openAiCompatibleClient = llmConfig.apiFormat === 'openai'
  ? new OpenAI({
      apiKey: apiKey,
      baseURL: llmConfig.baseURL,
    })
  : null;

function supportsThinkingToggle(model) {
  return THINKING_TOGGLE_MODELS.some((candidate) => model.startsWith(candidate));
}

function contentToText(content) {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      if (item.type === 'text') return item.text || '';
      if (item.type === 'image_url') return '[image attachment]';
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function isMiniMaxM3(model) {
  return String(model || '').toLowerCase().startsWith('minimax-m3');
}

function normalizeOpenAiCompatibleMessages(messages) {
  if (llmConfig.provider !== 'minimax' || isMiniMaxM3(llmConfig.model)) {
    return messages;
  }

  return (messages || []).map((message) => {
    if (!message || typeof message !== 'object' || typeof message.content === 'string') {
      return message;
    }

    return {
      ...message,
      content: contentToText(message.content)
    };
  });
}

function toAnthropicContentBlocks(content) {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  if (!Array.isArray(content)) {
    return [{ type: 'text', text: String(content || '') }];
  }

  const blocks = [];
  for (const item of content) {
    if (!item || typeof item !== 'object') continue;

    if (item.type === 'text' && item.text) {
      blocks.push({ type: 'text', text: item.text });
      continue;
    }

    const imageUrl = item.type === 'image_url' && typeof item.image_url?.url === 'string'
      ? item.image_url.url
      : '';
    if (imageUrl) {
      blocks.push({
        type: 'text',
        text: '[image attachment omitted: MiniMax Anthropic-compatible API does not support image input yet]'
      });
    }
  }

  return blocks.length > 0 ? blocks : [{ type: 'text', text: '' }];
}

function buildAnthropicRequest(payload) {
  const systemParts = [];
  const messages = [];

  for (const message of payload.messages || []) {
    if (!message || typeof message !== 'object') continue;

    if (message.role === 'system') {
      const text = contentToText(message.content);
      if (text) systemParts.push(text);
      continue;
    }

    if (message.role === 'user' || message.role === 'assistant') {
      messages.push({
        role: message.role,
        content: toAnthropicContentBlocks(message.content)
      });
    }
  }

  if (payload.response_format?.type === 'json_object') {
    systemParts.push('Return only a valid JSON object. Do not include Markdown fences, explanations, or extra text.');
  }

  const request = {
    model: llmConfig.model,
    max_tokens: Number.isFinite(minimaxMaxTokens) && minimaxMaxTokens > 0 ? minimaxMaxTokens : 4096,
    messages
  };

  if (systemParts.length > 0) {
    request.system = systemParts.join('\n\n');
  }

  if (typeof payload.temperature === 'number') {
    request.temperature = payload.temperature;
  }

  if (typeof payload.top_p === 'number') {
    request.top_p = payload.top_p;
  }

  if (!minimaxEnableThinking) {
    request.thinking = { type: 'disabled' };
  }

  return request;
}

function getAnthropicMessagesUrl(baseURL) {
  if (/\/v1$/i.test(baseURL)) return `${baseURL}/messages`;
  return `${baseURL}/v1/messages`;
}

function extractAnthropicText(responseData) {
  if (typeof responseData?.content === 'string') {
    return responseData.content;
  }

  if (!Array.isArray(responseData?.content)) {
    return '';
  }

  return responseData.content
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

function stripModelThinkingText(value) {
  return String(value || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
}

function extractJsonObjectText(value) {
  const text = stripModelThinkingText(value)
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!text) {
    throw new Error('AI 返回为空，无法解析 JSON');
  }

  if (text.startsWith('{') && text.endsWith('}')) {
    return text;
  }

  const start = text.indexOf('{');
  if (start < 0) {
    throw new Error('AI 返回中未找到 JSON 对象');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  throw new Error('AI 返回中的 JSON 对象不完整');
}

function parseJsonObjectFromModelText(value, fallback = null) {
  try {
    return JSON.parse(extractJsonObjectText(value));
  } catch (error) {
    if (fallback !== null) {
      return fallback;
    }
    throw error;
  }
}

async function createAnthropicChatCompletion(payload) {
  const response = await fetch(getAnthropicMessagesUrl(llmConfig.baseURL), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${llmConfig.apiKey}`,
      'x-api-key': llmConfig.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(buildAnthropicRequest(payload))
  });

  const responseText = await response.text();
  let responseData = {};
  if (responseText) {
    try {
      responseData = JSON.parse(responseText);
    } catch (error) {
      responseData = {};
    }
  }

  if (!response.ok) {
    const message = responseData?.error?.message || responseData?.message || responseText || 'MiniMax API request failed';
    throw new Error(message);
  }

  return {
    choices: [
      {
        message: {
          content: extractAnthropicText(responseData)
        }
      }
    ],
    model: responseData.model,
    usage: responseData.usage
  };
}

function createOpenAiCompatibleChatCompletion(payload) {
  const request = {
    model: llmConfig.model,
    ...payload,
    messages: normalizeOpenAiCompatibleMessages(payload.messages)
  };

  if (llmConfig.provider === 'qwen' && supportsThinkingToggle(llmConfig.model)) {
    request.enable_thinking = enableThinking;
  }

  if (llmConfig.provider === 'minimax' && !minimaxEnableThinking) {
    request.extra_body = {
      ...(request.extra_body || {}),
      thinking: { type: 'disabled' }
    };
  }

  return openAiCompatibleClient.chat.completions.create(request);
}

function createChatCompletion(payload) {
  if (llmConfig.apiFormat === 'anthropic') {
    return createAnthropicChatCompletion(payload);
  }

  return createOpenAiCompatibleChatCompletion(payload);
}

function getPlanHeuristicProfile(text) {
  const normalized = String(text || '').trim();
  if (!normalized) {
    return {
      normalized,
      hasStrongPlanVerb: false,
      hasActionVerb: false,
      hasTimeSignal: false,
      hasFutureDaySignal: false,
      looksLikeQuestion: false,
      looksLikeChat: false,
      likelyPlan: false,
      strongPlan: false
    };
  }

  const strongPlanVerb = /(提醒我|记得提醒|别忘了|待办|待做|截止|ddl|deadline|appointment|schedule|scheduled|remind me|todo)/i;
  const actionVerb = /(开会|会议|约见|预约|见面|出发|到达|体检|复诊|上课|航班|火车|高铁|面试|交房租|提交|办理|处理|参加|安排|计划|meeting|appointment|submit|departure|arrive|interview|rent|class|flight|train)/i;
  const timeSignal = /(今晚|明天|后天|周[一二三四五六日天]|星期[一二三四五六日天]|下周|下个月|上午|中午|下午|晚上|凌晨|明早|明晚|tomorrow|tonight|next week|next month|this evening|this afternoon|\d+[:：]\d+|\d+点半?|\d+号|\d+日)/i;
  const futureDaySignal = /(明天|后天|周[一二三四五六日天]|星期[一二三四五六日天]|下周|下个月|tomorrow|next week|next month)/i;
  const questionSignal = /(\?|？|吗$|呢$|么$|怎么|为什么|是不是|可不可以|能不能|要不要|what|why|how|can i|should i)/i;
  const casualChatSignal = /(哈哈|好的|行吧|在吗|收到|谢谢|晚安|早安|你好|hi|hello|ok|okay|lol)/i;

  const hasStrongPlanVerb = strongPlanVerb.test(normalized);
  const hasActionVerb = actionVerb.test(normalized);
  const hasTimeSignal = timeSignal.test(normalized);
  const hasFutureDaySignal = futureDaySignal.test(normalized);
  const looksLikeQuestion = questionSignal.test(normalized);
  const looksLikeChat = casualChatSignal.test(normalized);
  const strongPlan = hasStrongPlanVerb || (hasFutureDaySignal && hasActionVerb);
  const likelyPlan = hasStrongPlanVerb || ((hasTimeSignal || hasFutureDaySignal) && hasActionVerb);

  return {
    normalized,
    hasStrongPlanVerb,
    hasActionVerb,
    hasTimeSignal,
    hasFutureDaySignal,
    looksLikeQuestion,
    looksLikeChat,
    likelyPlan,
    strongPlan
  };
}

function isLikelyPlanText(text) {
  return getPlanHeuristicProfile(text).likelyPlan;
}

function isLikelyChatText(text) {
  const normalized = String(text || '').trim();
  if (!normalized) return false;

  const profile = getPlanHeuristicProfile(normalized);
  const assistantDirectedSignal = /(帮我|请问|你觉得|你认为|你能|可以帮|给我建议|怎么做|怎么办|为什么|你在吗|你好|早安|晚安|hi|hello|hey|can you|could you|would you|what do you think|please help|help me)/i;

  if (profile.looksLikeQuestion || profile.looksLikeChat) {
    return true;
  }

  return assistantDirectedSignal.test(normalized);
}

function buildDefaultAssistantReply(text, isEn) {
  return isEn
    ? `I got it. If you want, I can keep chatting with you, or help turn this into a plan, a life log, or a finance record: ${text}`
    : `收到。你可以继续直接和我聊，我也可以帮你把这句话整理成计划、记录或记账：${text}`;
}

function normalizeContextText(content, maxChars = 160) {
  const normalized = String(content || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1).trimEnd()}…`;
}

function sanitizeImageAttachments(attachments) {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments
    .filter((item) => item && item.type === 'image' && typeof item.url === 'string' && item.url.trim())
    .map((item) => ({
      type: 'image',
      url: item.url.trim(),
      name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : undefined,
      mimeType: typeof item.mimeType === 'string' && item.mimeType.trim() ? item.mimeType.trim() : undefined
    }));
}

async function inlineImageAttachmentsForMiniMax(attachments) {
  if (llmConfig.provider !== 'minimax' || llmConfig.apiFormat !== 'openai' || !isMiniMaxM3(llmConfig.model)) {
    return attachments;
  }

  const maxBytes = Number(process.env.MINIMAX_IMAGE_INLINE_MAX_BYTES || 5 * 1024 * 1024);

  return Promise.all(attachments.map(async (attachment) => {
    if (!/^https?:\/\//i.test(attachment.url)) {
      return attachment;
    }

    try {
      const response = await fetch(attachment.url);
      if (!response.ok) {
        return attachment;
      }

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > maxBytes) {
        return attachment;
      }

      const mimeType = response.headers.get('content-type')?.split(';')[0]
        || attachment.mimeType
        || 'image/jpeg';
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      return {
        ...attachment,
        mimeType,
        url: `data:${mimeType};base64,${base64}`
      };
    } catch (error) {
      return attachment;
    }
  }));
}

function buildAttachmentNote(attachments, isEn = false) {
  const count = sanitizeImageAttachments(attachments).length;
  if (!count) {
    return '';
  }

  return isEn ? ` [${count} image attachment${count > 1 ? 's' : ''}]` : ` [附带${count}张图片]`;
}

function buildParseUserContent(text, attachments, isEn) {
  const sanitizedAttachments = enableMultimodal ? sanitizeImageAttachments(attachments) : [];
  const normalizedText = String(text || '').trim();
  const promptText = sanitizedAttachments.length > 0
    ? (isEn
        ? `Please parse the user's latest input into structured JSON. Consider both the text and the attached image${sanitizedAttachments.length > 1 ? 's' : ''}. Latest text: "${normalizedText}"`
        : `请结合用户这次发送的文字和附带图片，一起解析成结构化 JSON。最新输入："${normalizedText}"`)
    : (isEn
      ? `Please parse the following input into structured JSON: "${normalizedText}"`
      : `请将以下输入解析为结构化 JSON： "${normalizedText}"`);

  if (!sanitizedAttachments.length) {
    return promptText;
  }

  return [
    {
      type: 'text',
      text: promptText
    },
    ...sanitizedAttachments.map((attachment) => ({
      type: 'image_url',
      image_url: {
        url: attachment.url
      }
    }))
  ];
}

function isContextMessageEligible(item) {
  if (!item || (item.role !== 'user' && item.role !== 'assistant')) return false;
  if (typeof item.content !== 'string' || !item.content.trim()) return false;
  if (item.messageType === 'confirmation') return false;

  if (item.role === 'assistant') {
    const kind = typeof item.metadata?.kind === 'string' ? item.metadata.kind : null;
    if (kind === 'pending_preview') return false;
    if (kind && kind !== 'chat') return false;
  }

  return true;
}

function buildConversationSummary(context, maxItems = 4, maxChars = 320) {
  const mergedMessages = context.reduce((accumulator, item) => {
    const normalizedContent = normalizeContextText(item.content, 90);
    if (!normalizedContent) return accumulator;

    const previousMessage = accumulator[accumulator.length - 1];
    if (previousMessage && previousMessage.role === item.role) {
      previousMessage.content = normalizeContextText(`${previousMessage.content} / ${normalizedContent}`, 140);
      return accumulator;
    }

    accumulator.push({ role: item.role, content: normalizedContent });
    return accumulator;
  }, []);

  const summary = mergedMessages
    .slice(-maxItems)
    .map((item) => `${item.role === 'user' ? 'user' : 'assistant'}: ${item.content}`)
    .join(' | ');

  if (summary.length <= maxChars) return summary;
  return `${summary.slice(0, maxChars - 1).trimEnd()}…`;
}

function buildRecentConversationArtifacts(context, maxUserTurns = 3) {
  if (!Array.isArray(context)) {
    return {
      recentContext: [],
      olderSummary: ''
    };
  }

  const eligibleContext = context
    .filter(isContextMessageEligible)
    .map((item) => ({
      role: item.role,
      content: normalizeContextText(`${item.content}${buildAttachmentNote(item.metadata?.attachments)}`)
    }));

  let userTurns = 0;
  let startIndex = 0;

  for (let index = eligibleContext.length - 1; index >= 0; index -= 1) {
    if (eligibleContext[index].role !== 'user') {
      continue;
    }

    userTurns += 1;
    startIndex = index;
    if (userTurns >= maxUserTurns) {
      break;
    }
  }

  return {
    recentContext: eligibleContext.slice(startIndex),
    olderSummary: buildConversationSummary(eligibleContext.slice(0, startIndex))
  };
}

function shouldAcceptPlanResult(text, parsedPlan) {
  if (!parsedPlan) return false;

  const profile = getPlanHeuristicProfile(text);
  const confidence = typeof parsedPlan.confidence === 'number'
    ? parsedPlan.confidence
    : Number(parsedPlan.confidence || 0);
  const hasConcreteTime = Boolean(parsedPlan.startAt || parsedPlan.dueAt || parsedPlan.reminderAt);
  const hasSpecificTitle = typeof parsedPlan.title === 'string'
    && parsedPlan.title.trim()
    && parsedPlan.title.trim() !== String(text || '').trim();

  if (profile.strongPlan) return true;
  if (profile.looksLikeQuestion && !profile.hasStrongPlanVerb) return false;
  if (profile.looksLikeChat && !profile.hasStrongPlanVerb && !profile.hasFutureDaySignal) return false;

  return (profile.likelyPlan && hasConcreteTime) || confidence >= 0.85 || (hasSpecificTitle && hasConcreteTime && confidence >= 0.7);
}

function normalizeTimestamp(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }

  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

function getTimeZoneOffsetMinutes(timeZone, date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  const zonedTimestamp = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second || 0),
    0
  );

  return Math.round((zonedTimestamp - date.getTime()) / (60 * 1000));
}

function getDateTimePartsInTimeZone(timeZone, date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute)
  };
}

function zonedDateTimeToUtcMs(timeZone, year, month, day, hour = 0, minute = 0) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const offsetMinutes = getTimeZoneOffsetMinutes(timeZone, new Date(utcGuess));
  return utcGuess - offsetMinutes * 60 * 1000;
}

function normalizePlanPayload(plan, originalText) {
  if (!plan || typeof plan !== 'object') {
    return null;
  }

  const planType = plan.planType === 'event' ? 'event' : 'reminder';
  const safeSyncTarget = ['ios-reminder', 'ios-calendar', 'none'].includes(plan.syncTargetSuggestion)
    ? plan.syncTargetSuggestion
    : 'none';

  return {
    title: typeof plan.title === 'string' && plan.title.trim() ? plan.title.trim() : originalText,
    notes: typeof plan.notes === 'string' && plan.notes.trim() ? plan.notes.trim() : undefined,
    planType,
    startAt: planType === 'event' ? normalizeTimestamp(plan.startAt) : null,
    endAt: planType === 'event' ? normalizeTimestamp(plan.endAt) : null,
    dueAt: planType === 'reminder' ? normalizeTimestamp(plan.dueAt || plan.startAt) : null,
    isAllDay: Boolean(plan.isAllDay),
    reminderAt: normalizeTimestamp(plan.reminderAt),
    syncTargetSuggestion: safeSyncTarget,
    confidence: typeof plan.confidence === 'number' ? plan.confidence : Number(plan.confidence || 0),
    originalText
  };
}

function parseRelativeDayOffset(text) {
  if (text.includes('后天')) return 2;
  if (text.includes('明天')) return 1;
  return 0;
}

function hasRelativeDayWord(text) {
  return /(今天|今晚|明天|后天)/.test(text);
}

function parseTimeParts(text) {
  const colonMatch = text.match(/(\d{1,2})[:：](\d{1,2})/);
  if (colonMatch) {
    return { hour: Number(colonMatch[1]), minute: Number(colonMatch[2]) };
  }

  const pointMatch = text.match(/(\d{1,2})点(半)?/);
  if (!pointMatch) return null;

  let hour = Number(pointMatch[1]);
  let minute = pointMatch[2] ? 30 : 0;

  if ((text.includes('下午') || text.includes('晚上')) && hour < 12) {
    hour += 12;
  }

  if (text.includes('凌晨') && hour === 12) {
    hour = 0;
  }

  return { hour, minute };
}

function applyRelativeDateOverride(plan, text, timeZone) {
  if (!plan || !hasRelativeDayWord(text)) {
    return plan;
  }

  const nowParts = getDateTimePartsInTimeZone(timeZone, new Date());
  const relativeOffset = parseRelativeDayOffset(text);
  const explicitTime = parseTimeParts(text);
  const targetYear = nowParts.year;
  const targetMonth = nowParts.month;
  const targetDay = nowParts.day + relativeOffset;

  const pickTime = (existingTimestamp, fallbackHour, fallbackMinute) => {
    if (explicitTime) {
      return explicitTime;
    }

    if (existingTimestamp) {
      const parts = getDateTimePartsInTimeZone(timeZone, new Date(existingTimestamp));
      return { hour: parts.hour, minute: parts.minute };
    }

    return { hour: fallbackHour, minute: fallbackMinute };
  };

  if (plan.planType === 'event') {
    const startClock = pickTime(plan.startAt, 9, 0);
    const startAt = zonedDateTimeToUtcMs(timeZone, targetYear, targetMonth, targetDay, startClock.hour, startClock.minute);
    const duration = plan.startAt && plan.endAt && plan.endAt > plan.startAt
      ? plan.endAt - plan.startAt
      : 60 * 60 * 1000;
    const reminderLead = plan.startAt && plan.reminderAt && plan.startAt > plan.reminderAt
      ? plan.startAt - plan.reminderAt
      : 30 * 60 * 1000;

    return {
      ...plan,
      startAt,
      endAt: startAt + duration,
      reminderAt: startAt - reminderLead
    };
  }

  const dueClock = pickTime(plan.dueAt || plan.startAt || plan.reminderAt, 9, 0);
  const dueAt = zonedDateTimeToUtcMs(timeZone, targetYear, targetMonth, targetDay, dueClock.hour, dueClock.minute);
  const reminderLead = plan.dueAt && plan.reminderAt && plan.dueAt > plan.reminderAt
    ? plan.dueAt - plan.reminderAt
    : 0;

  return {
    ...plan,
    startAt: null,
    endAt: null,
    dueAt,
    reminderAt: dueAt - reminderLead
  };
}

function buildFallbackPlan(text, timeZone) {
  const nowParts = getDateTimePartsInTimeZone(timeZone, new Date());
  const offset = parseRelativeDayOffset(text);
  const defaultBase = zonedDateTimeToUtcMs(timeZone, nowParts.year, nowParts.month, nowParts.day + offset, 9, 0);
  const base = new Date(defaultBase);

  const parsedTime = parseTimeParts(text);
  if (parsedTime) {
    base.setTime(zonedDateTimeToUtcMs(timeZone, nowParts.year, nowParts.month, nowParts.day + offset, parsedTime.hour, parsedTime.minute));
  }

  const isEvent = /(开会|会议|约|预约|见面|体检|复诊|上课|出发|到达|面试)/.test(text) || Boolean(parsedTime);
  const syncTargetSuggestion = isEvent ? 'ios-calendar' : 'ios-reminder';
  const reminderAt = isEvent
    ? new Date(base.getTime() - 30 * 60 * 1000).getTime()
    : base.getTime();

  return {
    title: text,
    notes: undefined,
    planType: isEvent ? 'event' : 'reminder',
    startAt: isEvent ? base.getTime() : null,
    endAt: isEvent ? new Date(base.getTime() + 60 * 60 * 1000).getTime() : null,
    dueAt: isEvent ? null : base.getTime(),
    isAllDay: false,
    reminderAt,
    syncTargetSuggestion,
    confidence: 0.51,
    originalText: text
  };
}

function getDateKeyInTimeZone(timeZone, timestamp) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(timestamp));
  } catch (error) {
    return new Date(timestamp).toISOString().slice(0, 10);
  }
}

function getPlanEffectiveTimestamp(plan) {
  if (!plan) return null;

  if (plan.planType === 'event') {
    return plan.endAt || plan.startAt || plan.reminderAt || null;
  }

  return plan.dueAt || plan.startAt || plan.reminderAt || null;
}

function shiftTimestampToNextDay(timeZone, timestamp) {
  if (!timestamp) return null;

  const parts = getDateTimePartsInTimeZone(timeZone, new Date(timestamp));
  return zonedDateTimeToUtcMs(timeZone, parts.year, parts.month, parts.day + 1, parts.hour, parts.minute);
}

function buildTomorrowSuggestedPlan(plan, timeZone) {
  if (!plan) return undefined;

  if (plan.planType === 'event') {
    return {
      startAt: shiftTimestampToNextDay(timeZone, plan.startAt),
      endAt: shiftTimestampToNextDay(timeZone, plan.endAt),
      dueAt: null,
      reminderAt: shiftTimestampToNextDay(timeZone, plan.reminderAt)
    };
  }

  const baseDueAt = plan.dueAt || plan.startAt || plan.reminderAt;
  if (!baseDueAt) {
    return undefined;
  }

  return {
    startAt: null,
    endAt: null,
    dueAt: shiftTimestampToNextDay(timeZone, baseDueAt),
    reminderAt: plan.reminderAt
      ? shiftTimestampToNextDay(timeZone, plan.reminderAt)
      : shiftTimestampToNextDay(timeZone, baseDueAt)
  };
}

function attachPlanTimeValidation(plan, timeZone, isEn) {
  if (!plan) {
    return plan;
  }

  const effectiveTimestamp = getPlanEffectiveTimestamp(plan);
  if (!effectiveTimestamp || plan.isAllDay) {
    return plan;
  }

  const now = Date.now();
  const todayKey = getDateKeyInTimeZone(timeZone, now);
  const targetDayKey = getDateKeyInTimeZone(timeZone, effectiveTimestamp);

  if (targetDayKey !== todayKey || effectiveTimestamp >= now) {
    return plan;
  }

  return {
    ...plan,
    timeValidation: {
      status: 'past',
      message: isEn
        ? 'This time has already passed today. You can move it to tomorrow at the same time.'
        : '这个时间今天已经过去了，可以改到明天同一时间。',
      suggestedPlan: buildTomorrowSuggestedPlan(plan, timeZone)
    }
  };
}

// 解析生活日志 - 允许游客访问，前端负责次数限制
router.post('/parse', async (req, res) => {
  try {
    const { text, lang, timezone, mode = 'auto', context = [], contextSummary = '', attachments = [] } = req.body;
    if (!text) return res.status(400).json({ message: '请提供文本内容' });

    if (!apiKey) {
      return res.status(500).json({ message: '服务器未配置 AI API Key' });
    }

    // Determine language based on parameter or header
    // 只要包含 zh 就认为是中文，否则如果包含 en 认为是英文，默认中文
    const reqLang = lang || req.headers['accept-language'] || 'zh';
    const isEn = !reqLang.toLowerCase().includes('zh') && reqLang.toLowerCase().includes('en');

    const now = new Date();
    const resolvedTimezone = typeof timezone === 'string' && timezone.trim() ? timezone.trim() : 'Asia/Shanghai';
    const planHint = mode === 'log' ? false : isLikelyPlanText(text);
    const chatHint = isLikelyChatText(text);
    const imageAttachments = await inlineImageAttachmentsForMiniMax(sanitizeImageAttachments(attachments));
    const { recentContext, olderSummary } = buildRecentConversationArtifacts(context, 3);
    const sanitizedContextSummary = normalizeContextText(contextSummary, 320) || olderSummary;
    const contextPrompt = recentContext.length > 0
      ? recentContext.map((item, index) => `${index + 1}. ${item.role === 'user' ? 'user' : 'assistant'}: ${item.content}`).join('\n')
      : '';

    const systemPromptZh = `你是一位生活助理，需要先判断用户输入属于以下四类之一：
1. chat：普通对话、提问、寒暄、求建议、表达感受，希望你直接回复
2. log：已经发生或正在发生的生活记录
3. plan：未来安排、提醒、会议、约会、待办、日程
4. finance：主要在表达收支

请返回纯 JSON，不要返回 Markdown。
当前参考时间：${now.toISOString()}。
当前用户时区：${resolvedTimezone}。

如果句子里出现“明天、周五、晚上 8 点、提醒我、开会、预约、截止、提交、出发”等明确未来安排信号，优先识别为 plan。
如果只是闲聊、提问、感叹、表达感受，或者虽然提到时间但没有安排/提醒语义，不要识别为 plan，而应优先识别为 chat。

返回格式：
{
  "intent": "chat | log | plan | finance",
  "assistantReply": "当 intent=chat 时给用户的自然回复，其他情况可为空字符串",
  "activity": "生活记录摘要，非 log 时可为空字符串",
  "category": "Work | Leisure | Health | Chores | Social | Other",
  "durationMinutes": 0,
  "mood": "平静",
  "importance": 3,
  "finance": [],
  "plan": {
    "title": "计划标题",
    "notes": "补充说明",
    "planType": "reminder | event",
    "startAt": 1743415200000,
    "endAt": null,
    "dueAt": null,
    "isAllDay": false,
    "reminderAt": null,
    "syncTargetSuggestion": "ios-reminder | ios-calendar | none",
    "confidence": 0.95
  }
}

规则：
1. 如果 intent 是 chat，必须返回 assistantReply，语气自然，像助理一样简洁回复。
2. 如果 intent 是 plan，必须返回完整的 plan 对象。
3. 有明确发生时间或时间段的安排，优先用 event。
4. 只有提醒、截止、待办语义时，优先用 reminder。
5. 相对时间要换算成时间戳毫秒。
6. 如果 intent 是 log，按生活记录填写 activity、category、durationMinutes、mood、importance。`;

    const systemPromptEn = `You are a life assistant. Classify the user input into one of these intents:
1. chat: casual conversation, questions, greetings, requests for advice, or emotional expression that should receive a direct assistant reply
2. log: something that already happened or is happening
3. plan: a future arrangement, reminder, meeting, task, appointment, or schedule item
4. finance: mostly about income or expense

Return pure JSON only, no Markdown.
Current reference time: ${now.toISOString()}.
Current user timezone: ${resolvedTimezone}.

If the sentence contains clear future scheduling signals like tomorrow, Friday, 8 PM, remind me, meeting, appointment, deadline, submit, or departure, prefer intent=plan.
If the message is casual chat, a question, or general conversation without scheduling or reminder intent, do not classify it as plan. Prefer intent=chat.

Return format:
{
  "intent": "chat | log | plan | finance",
  "assistantReply": "natural reply for the user when intent=chat, empty string otherwise",
  "activity": "summary for log, empty string when not needed",
  "category": "Work | Leisure | Health | Chores | Social | Other",
  "durationMinutes": 0,
  "mood": "Calm",
  "importance": 3,
  "finance": [],
  "plan": {
    "title": "plan title",
    "notes": "extra notes",
    "planType": "reminder | event",
    "startAt": 1743415200000,
    "endAt": null,
    "dueAt": null,
    "isAllDay": false,
    "reminderAt": null,
    "syncTargetSuggestion": "ios-reminder | ios-calendar | none",
    "confidence": 0.95
  }
}

Rules:
1. If intent is chat, you must return assistantReply in a concise, helpful assistant tone.
2. If intent is plan, you must return a plan object.
3. Use event for time-specific arrangements.
4. Use reminder for to-do or deadline semantics.
5. Convert relative time into unix milliseconds.
6. If intent is log, fill activity, category, durationMinutes, mood, and importance.`;

    const response = await createChatCompletion({
      messages: [
        {
          role: "system",
          content: `${isEn ? systemPromptEn : systemPromptZh}\n\nHeuristic hint: ${planHint ? 'This input contains strong future scheduling or reminder signals. Prefer intent=plan unless clearly contradicted.' : chatHint ? 'This input looks like casual conversation or a direct question to the assistant. Prefer intent=chat unless there is explicit structured log, finance, or schedule intent.' : 'No strong scheduling intent detected. Use chat for conversation, log for life records, finance for money statements, and only use plan when there is explicit reminder or schedule intent.'}`
        },
        ...(sanitizedContextSummary ? [{
          role: "system",
          content: isEn
            ? `Earlier conversation summary. Use it only to resolve references and maintain continuity, not as the latest user request.\n${sanitizedContextSummary}`
            : `更早对话摘要。只用它来理解上下文指代和连续性，不要把它当成最新用户请求。\n${sanitizedContextSummary}`
        }] : []),
        ...(contextPrompt ? [{
          role: "system",
          content: isEn
            ? `Recent conversation context. Use it to understand references, pronouns, and follow-up questions, but classify only the latest user input.\n${contextPrompt}`
            : `最近对话上下文。请用它理解指代、省略和追问，但分类对象仍然只针对最新这句用户输入。\n${contextPrompt}`
        }] : []),
        ...(imageAttachments.length > 0 ? [{
          role: "system",
          content: isEn
            ? `The latest user message also includes ${imageAttachments.length} image attachment${imageAttachments.length > 1 ? 's' : ''}. Use the visual content together with the text.`
            : `用户最新一条消息还附带了 ${imageAttachments.length} 张图片，请结合图片内容和文字一起理解。`
        }] : []),
        {
          role: "user",
          content: buildParseUserContent(text, imageAttachments, isEn)
        }
      ],
      response_format: { type: "json_object" }
    });

    const parsedData = parseJsonObjectFromModelText(response.choices[0].message.content);
    const normalizedIntent = ['chat', 'log', 'plan', 'finance'].includes(parsedData.intent)
      ? parsedData.intent
      : (parsedData.plan ? 'plan' : parsedData.finance?.length ? 'finance' : chatHint ? 'chat' : 'log');

    parsedData.intent = normalizedIntent;
    parsedData.assistantReply = normalizedIntent === 'chat'
      ? String(parsedData.assistantReply || '').trim() || buildDefaultAssistantReply(text, isEn)
      : undefined;
    parsedData.plan = normalizedIntent === 'plan'
      ? applyRelativeDateOverride(normalizePlanPayload(parsedData.plan, text), text, resolvedTimezone)
      : undefined;

    if (parsedData.intent === 'plan' && !shouldAcceptPlanResult(text, parsedData.plan)) {
      parsedData.intent = chatHint ? 'chat' : 'log';
      parsedData.plan = undefined;
      parsedData.assistantReply = parsedData.intent === 'chat'
        ? String(parsedData.assistantReply || '').trim() || buildDefaultAssistantReply(text, isEn)
        : undefined;
    }

    if (getPlanHeuristicProfile(text).strongPlan && !parsedData.plan) {
      parsedData.intent = 'plan';
      parsedData.plan = buildFallbackPlan(text, resolvedTimezone);
      parsedData.assistantReply = undefined;
    }

    if (parsedData.plan) {
      parsedData.plan = attachPlanTimeValidation(parsedData.plan, resolvedTimezone, isEn);
    }

    res.json(parsedData);
  } catch (error) {
    console.error("AI Parse Error:", error);
    res.status(500).json({ message: 'AI 解析失败', error: error.message });
  }
});

// 获取洞察 (每日/周/月)
router.post('/insight', authenticateToken, async (req, res) => {
  try {
    // period: 'day' | 'week' | 'month' (default: 'day')
    const { logs, period = 'day', lang = 'zh' } = req.body;
    if (!logs || !Array.isArray(logs)) return res.status(400).json({ message: '数据格式错误' });

    if (!apiKey) {
      return res.status(500).json({ message: '服务器未配置 AI API Key' });
    }

    const isEn = lang && lang.startsWith('en');

    // 简单的类别汉化映射
    const categoryMapZh = {
      'Work': '工作',
      'Leisure': '休闲',
      'Health': '健康',
      'Social': '社交',
      'Chores': '家务',
      'Other': '其他'
    };

    const logSummary = logs.map(l => {
      // 如果不是英文模式，尝试将类别转为中文
      const displayCategory = !isEn ? (categoryMapZh[l.category] || l.category) : l.category;
      return `${l.activity} (耗时 ${l.durationMinutes}分钟, 类别 ${displayCategory})`;
    }).join(', ');

    const periodTextMap = isEn ? {
      'day': 'day',
      'week': 'week',
      'month': 'month'
    } : {
      'day': '一天',
      'week': '一周',
      'month': '一月'
    };
    const periodText = periodTextMap[period] || (isEn ? 'period' : '一段时间');
  
    const systemPrompt = isEn 
    ? `You are a keen life data analyst. Review the user's activity logs for the ${periodText} and return a JSON analysis report.
Please do NOT use Markdown formatting, return the JSON object directly.

JSON Structure Requirements:
{
  "summary": "A short summary (max 40 words, qualitative like 'Productive ${periodText}')",
  "bulletPoints": [
    { "icon": "👍", "text": "Highlights (e.g., Maintained exercise habit)" },
    { "icon": "📊", "text": "Time allocation (e.g., Work ratio is high)" },
    { "icon": "💡", "text": "Suggestions (e.g., Take short breaks)" }
  ]
}
Ensure bulletPoints array has at least 3 items.`
    : `你是一个敏锐的生活数据分析师。请回顾用户${periodText}的活动日志，并返回 JSON 格式的分析报告。
请不要使用 Markdown 格式，直接返回 JSON 对象。

JSON 结构要求：
{
  "summary": "一句简短的总结 (30字以内，要有如'高效充实的${periodText}'这种定性)",
  "bulletPoints": [
    { "icon": "👍", "text": "做得好的地方 (例如：坚持了运动习惯)" },
    { "icon": "📊", "text": "时间分配简评 (例如：工作时长占比过高)" },
    { "icon": "💡", "text": "具体的改进建议 (例如：建议增加每小时的短暂休息)" }
  ]
}
确保 bulletPoints 数组至少包含 3 条内容。`;

    const response = await createChatCompletion({
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: isEn ? `My activities for this ${periodText}: ${logSummary}` : `我的${periodText}活动：${logSummary}`
        }
      ],
      response_format: { type: "json_object" }
    });
  
    const insightData = parseJsonObjectFromModelText(response.choices[0].message.content, { summary: '', bulletPoints: [] });
    res.json({ insight: JSON.stringify(insightData) });
  } catch (error) {
    console.error("AI Insight Error:", error);
    res.status(500).json({ message: '生成洞察失败', error: error.message });
  }
});

// 获取智能生活建议 (基于历史习惯)
router.post('/suggestions', authenticateToken, async (req, res) => {
  try {
    const { logs, currentHour, currentWeekday, lang = 'zh' } = req.body;
    
    if (!logs || !Array.isArray(logs)) return res.status(400).json({ message: '数据格式错误' });
    if (!apiKey) return res.status(500).json({ message: 'AI API Key 未配置' });

    const isEn = lang.startsWith('en');
    const daysZh = ['日', '一', '二', '三', '四', '五', '六'];
    const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Handle legacy calls where currentWeekday might be a string (though we just changed frontend)
    // or just use the index if it's a number.
    let dayLabel = '';
    if (typeof currentWeekday === 'number') {
       dayLabel = isEn ? daysEn[currentWeekday] : `星期${daysZh[currentWeekday]}`;
    } else {
       dayLabel = String(currentWeekday); // Fallback
    }

    const timeStr = isEn ? `${currentHour}:00` : `${currentHour}点`;

    const systemPromptZh = `你是一个贴心的生活管家。请根据用户最近的活动日志，结合当前时间（${dayLabel}，${timeStr}），提供 1-2 条暖心的生活平衡建议。
          
关注点：
1. 是否过度劳累（连续长时间工作）？
2. 是否缺乏运动或休闲？
3. 作息是否规律？
4. 如果当前是深夜，提醒休息；如果是周末，建议放松。

请直接返回 JSON 格式：
{
  "suggestions": [
    { 
      "id": "gen-id",
      "type": "health" | "work_life_balance" | "productivity" | "other",
      "content": "建议内容，语气要像朋友一样自然温暖 (20字以内)",
      "trigger": "触发原因 (例如：检测到连续3天熬夜)"
    }
  ]
}`;

    const systemPromptEn = `You are a thoughtful life assistant. Based on the user's recent activity logs and the current time (${dayLabel}, ${timeStr}), provide 1-2 warm life balance suggestions.

Focus on:
1. Overwork (long consecutive work hours)?
2. Lack of exercise or leisure?
3. Irregular sleep schedule?
4. If it's late night, suggest rest; if weekend, suggest relaxation.

Return in JSON format:
{
  "suggestions": [
    { 
      "id": "gen-id",
      "type": "health" | "work_life_balance" | "productivity" | "other",
      "content": "Suggestion content in English. Tone should be natural and warm like a friend (within 20 words)",
      "trigger": "Trigger reason (e.g., detected 3 consecutive late nights)"
    }
  ]
}`;

    // 只取最近 50 条记录避免 Token 溢出，重点看时间戳最近的
    const recentLogs = logs.slice(0, 50).map(l => 
      `[${new Date(l.timestamp).toLocaleDateString()} ${l.category}] ${l.activity} (${l.durationMinutes}m)`
    ).join('\n');

    const userPromptZh = `最近活动记录：\n${recentLogs}\n\n当前状态：今天是${dayLabel}，现在是${timeStr}。请给出建议。`;
    const userPromptEn = `Recent logs:\n${recentLogs}\n\nCurrent status: Today is ${dayLabel}, time is ${timeStr}. Please provide suggestions.`;

    const response = await createChatCompletion({
      messages: [
        {
          role: "system",
          content: isEn ? systemPromptEn : systemPromptZh
        },
        {
          role: "user",
          content: isEn ? userPromptEn : userPromptZh
        }
      ],
      response_format: { type: "json_object" }
    });


    res.json(parseJsonObjectFromModelText(response.choices[0].message.content, { suggestions: [] }));

  } catch (error) {
    console.error("AI Suggestion Error:", error);
    res.status(500).json({ message: '生成建议失败', error: error.message });
  }
});

module.exports = router;
