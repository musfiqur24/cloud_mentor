import { runtimeConfig } from '../config/runtime.mjs';
import { validateObjectKey } from '../lib/files.mjs';
import { HttpError } from '../lib/http.mjs';
import { buildPrompt, titleFor } from '../prompts.mjs';
import { saveHistory } from './history.mjs';

const STRUCTURED_ACTIONS = new Set(['explain', 'quiz', 'flashcards', 'studyPlan']);
const SUPPORTED_ACTIONS = new Set(['explain', 'quiz', 'flashcards', 'studyPlan']);
const SYSTEM_MESSAGE = 'You are CloudMentor, a concise, helpful, classroom-safe AI tutor. Return clear Markdown unless the user prompt explicitly requests JSON.';

export async function handleAiAction(action, payload, user) {
  if (!SUPPORTED_ACTIONS.has(action)) {
    throw new HttpError(404, 'Unsupported AI action.');
  }

  validatePayload(action, payload, user);

  const prompt = buildPrompt(action, payload);
  const aiText = await callAi(prompt);
  const aiOutput = buildAiOutput(action, aiText, payload);

  const item = await saveHistory(user?.id, {
    type: action,
    title: titleFor(action, payload),
    request: safeRequest(payload),
    result: aiOutput.result,
    resultData: aiOutput.resultData
  });

  return {
    id: item.id,
    type: action,
    title: item.title,
    result: aiOutput.result,
    resultData: aiOutput.resultData,
    createdAt: item.createdAt
  };
}

export function isPlaceholderApiKey(value) {
  const key = String(value || '').trim();
  if (!key) return true;

  const lowered = key.toLowerCase();
  return [
    'your_api_key_here',
    'your_openai_api_key_here',
    'your_openrouter_api_key_here',
    'openai_api_key',
    'openrouter_api_key',
    'sk-your-key-here',
    'sk-proj-your_key_here'
  ].includes(lowered) || lowered.includes('your_api') || lowered.includes('your-key');
}

async function callAi(prompt) {
  const provider = getProvider();
  const request = buildProviderRequest(provider, prompt);
  let apiResponse;

  try {
    apiResponse = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(25_000)
    });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    throw new HttpError(502, timedOut
      ? `${provider.label} did not respond in time. Please try again.`
      : `Could not reach ${provider.label}. Check your internet connection and try again.`);
  }

  const data = await apiResponse.json().catch(() => ({}));
  if (!apiResponse.ok) {
    console.error('AI provider request failed', {
      provider: provider.id,
      status: apiResponse.status,
      errorCode: data?.error?.code || null
    });
    throw providerError(provider, apiResponse.status);
  }

  const text = provider.id === 'openrouter'
    ? extractOpenRouterText(data)
    : extractOpenAiText(data);

  if (!text) {
    throw new HttpError(502, `${provider.label} returned no text. Please try again.`);
  }

  return text;
}

function getProvider() {
  const providers = {
    openai: { id: 'openai', label: 'OpenAI' },
    openrouter: { id: 'openrouter', label: 'OpenRouter' }
  };
  const provider = providers[runtimeConfig.aiProvider];

  if (!provider) {
    throw new HttpError(500, 'AI_MODE must be either "openrouter" or "openai".');
  }

  if (isPlaceholderApiKey(runtimeConfig.aiApiKey)) {
    throw new HttpError(400, 'An AI API key is required. Set AI_API_KEY, OPENROUTER_API_KEY, or OPENAI_API_KEY in backend/env.json.');
  }

  return provider;
}

function buildProviderRequest(provider, prompt) {
  const model = resolveModel(provider.id, runtimeConfig.aiModel);
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${runtimeConfig.aiApiKey}`
  };

  if (provider.id === 'openrouter') {
    if (runtimeConfig.openRouterSiteUrl) {
      headers['HTTP-Referer'] = runtimeConfig.openRouterSiteUrl;
    }
    if (runtimeConfig.openRouterAppTitle) {
      headers['X-OpenRouter-Title'] = runtimeConfig.openRouterAppTitle;
    }

    return {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      headers,
      body: {
        model,
        messages: [
          { role: 'system', content: SYSTEM_MESSAGE },
          { role: 'user', content: prompt }
        ],
        max_tokens: 3000
      }
    };
  }

  return {
    url: 'https://api.openai.com/v1/responses',
    headers,
    body: {
      model,
      input: [
        { role: 'system', content: SYSTEM_MESSAGE },
        { role: 'user', content: prompt }
      ],
      max_output_tokens: 3000
    }
  };
}

function resolveModel(providerId, configuredModel) {
  const model = String(configuredModel || '').trim();

  if (providerId === 'openrouter') {
    if (!model) return 'openai/gpt-4.1-mini';
    return model.includes('/') ? model : `openai/${model}`;
  }

  return model.replace(/^openai\//, '') || 'gpt-4.1-mini';
}

function providerError(provider, status) {
  if (status === 401 || status === 403) {
    return new HttpError(502, `${provider.label} rejected the API key or this key cannot use the selected model.`);
  }
  if (status === 429) {
    return new HttpError(429, `${provider.label} rate limit or account credit limit reached. Please try again later.`);
  }
  if (status >= 400 && status < 500) {
    return new HttpError(502, `${provider.label} rejected the request. Check the selected model and request settings.`);
  }
  return new HttpError(502, `${provider.label} is currently unavailable. Please try again.`);
}

function buildAiOutput(action, aiText, payload) {
  if (!STRUCTURED_ACTIONS.has(action)) {
    return { result: aiText, resultData: null };
  }

  const parsed = parseAiJson(aiText);
  if (!parsed) {
    return { result: aiText, resultData: null };
  }

  const normalized = normalizeStructuredData(action, parsed, payload);
  if (!normalized) {
    return { result: aiText, resultData: null };
  }

  return {
    result: stringifyStructuredResult(action, normalized),
    resultData: normalized
  };
}

function normalizeStructuredData(action, value, payload) {
  if (action === 'explain') {
    const sections = (Array.isArray(value.sections) ? value.sections : [])
      .slice(0, 5)
      .map((section) => ({
        heading: String(section?.heading || '').trim(),
        content: String(section?.content || '').trim()
      }))
      .filter((section) => section.heading && section.content);
    const directAnswer = String(value.directAnswer || '').trim();

    if (!directAnswer || sections.length < 1) return null;

    const workedExample = value.workedExample && typeof value.workedExample === 'object'
      ? {
          title: String(value.workedExample.title || 'Worked example').trim(),
          steps: Array.isArray(value.workedExample.steps)
            ? value.workedExample.steps.slice(0, 8).map((step) => String(step).trim()).filter(Boolean)
            : []
        }
      : { title: '', steps: [] };

    return {
      type: 'explanation',
      title: String(value.title || `Understanding ${payload.topic}`).trim(),
      subject: String(payload.subject || '').trim(),
      topic: String(payload.topic || '').trim(),
      directAnswer,
      sections,
      workedExample,
      commonMistakes: Array.isArray(value.commonMistakes)
        ? value.commonMistakes.slice(0, 5).map((item) => String(item).trim()).filter(Boolean)
        : [],
      keyTakeaways: Array.isArray(value.keyTakeaways)
        ? value.keyTakeaways.slice(0, 5).map((item) => String(item).trim()).filter(Boolean)
        : []
    };
  }

  if (action === 'quiz') {
    const questionCount = Number(payload.questionCount);
    const questions = Array.isArray(value.questions) ? value.questions : [];
    const normalizedQuestions = questions.slice(0, questionCount).map((question) => {
      const options = Array.isArray(question.options)
        ? question.options.slice(0, 4).map((option) => String(option).trim())
        : [];
      const answerIndex = Number(question.answerIndex);
      return {
        question: String(question.question || '').trim(),
        options,
        answerIndex,
        explanation: String(question.explanation || 'Review the notes and compare the options.').trim()
      };
    }).filter((question) => (
      question.question
      && question.options.length === 4
      && question.options.every(Boolean)
      && Number.isInteger(question.answerIndex)
      && question.answerIndex >= 0
      && question.answerIndex < question.options.length
    ));

    if (normalizedQuestions.length !== questionCount) return null;

    return {
      type: 'quiz',
      title: String(value.title || 'CloudMentor quiz').trim(),
      topic: String(payload.topic || '').trim(),
      questionCount,
      questions: normalizedQuestions,
      shortAnswerQuestions: Array.isArray(value.shortAnswerQuestions)
        ? value.shortAnswerQuestions.slice(0, 4).map((question) => String(question).trim()).filter(Boolean)
        : []
    };
  }

  if (action === 'flashcards') {
    const cards = Array.isArray(value.cards) ? value.cards : [];
    const normalizedCards = cards.slice(0, 12).map((card) => ({
      front: String(card.front || '').trim(),
      back: String(card.back || '').trim(),
      hint: String(card.hint || '').trim()
    })).filter((card) => card.front && card.back);

    if (normalizedCards.length < 1) return null;

    return {
      type: 'flashcards',
      title: String(value.title || 'CloudMentor flashcards').trim(),
      cards: normalizedCards
    };
  }

  if (action === 'studyPlan') {
    const dayCount = clampDays(payload.days || value.totalDays);
    const days = (Array.isArray(value.days) ? value.days : []).slice(0, dayCount).map((day, index) => ({
      day: Number(day.day || index + 1),
      title: String(day.title || `Day ${index + 1}`).trim(),
      focus: String(day.focus || '').trim(),
      activities: Array.isArray(day.activities)
        ? day.activities.slice(0, 5).map((activity) => String(activity).trim()).filter(Boolean)
        : [],
      practice: String(day.practice || '').trim(),
      outcome: String(day.outcome || '').trim()
    }));

    const valid = days.length === dayCount && days.every((day, index) => (
      day.day === index + 1
      && day.title
      && day.focus
      && day.activities.length > 0
      && day.practice
      && day.outcome
    ));
    if (!valid) return null;

    return {
      type: 'studyPlan',
      title: String(value.title || `${dayCount}-day study plan`).trim(),
      totalDays: dayCount,
      strategy: String(value.strategy || '').trim(),
      days,
      finalChecklist: Array.isArray(value.finalChecklist)
        ? value.finalChecklist.slice(0, 6).map((item) => String(item).trim()).filter(Boolean)
        : []
    };
  }

  return null;
}

function stringifyStructuredResult(action, data) {
  if (action === 'explain') {
    const sections = data.sections.map((section) => `## ${section.heading}\n${section.content}`).join('\n\n');
    const example = data.workedExample?.steps?.length
      ? `## ${data.workedExample.title || 'Worked example'}\n${data.workedExample.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`
      : '';
    const mistakes = data.commonMistakes?.length
      ? `## Common mistakes\n${data.commonMistakes.map((item) => `- ${item}`).join('\n')}`
      : '';
    const takeaways = data.keyTakeaways?.length
      ? `## Key takeaways\n${data.keyTakeaways.map((item) => `- ${item}`).join('\n')}`
      : '';
    return `# ${data.title || 'Detailed explanation'}\n\n## Direct answer\n${data.directAnswer}\n\n${[sections, example, mistakes, takeaways].filter(Boolean).join('\n\n')}`;
  }

  if (action === 'quiz') {
    return `## ${data.title || 'Interactive Quiz'}\n\n${data.questions.map((question, index) => {
      const options = question.options.map((option, optionIndex) => `   ${String.fromCharCode(65 + optionIndex)}. ${option}`).join('\n');
      return `${index + 1}. ${question.question}\n${options}\n   Answer: ${String.fromCharCode(65 + question.answerIndex)}\n   Explanation: ${question.explanation}`;
    }).join('\n\n')}\n\n### Short-answer practice\n${(data.shortAnswerQuestions || []).map((question, index) => `${index + 1}. ${question}`).join('\n')}`;
  }

  if (action === 'flashcards') {
    return `## ${data.title || 'Flashcards'}\n\n| Front | Back | Hint |\n|---|---|---|\n${data.cards.map((card) => `| ${escapeTableText(card.front)} | ${escapeTableText(card.back)} | ${escapeTableText(card.hint || '')} |`).join('\n')}`;
  }

  if (action === 'studyPlan') {
    return `## ${data.title || 'Study Plan'}\n\n${data.strategy || ''}\n\n${data.days.map((day) => `### Day ${day.day}: ${day.title}\n**Focus:** ${day.focus}\n\n${(day.activities || []).map((activity) => `- ${activity}`).join('\n')}\n\n**Practice:** ${day.practice}\n\n**Outcome:** ${day.outcome}`).join('\n\n')}\n\n### Final checklist\n${(data.finalChecklist || []).map((item) => `- ${item}`).join('\n')}`;
  }

  return JSON.stringify(data, null, 2);
}

function parseAiJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;

  try {
    return JSON.parse(candidate);
  } catch {
    const first = candidate.indexOf('{');
    const last = candidate.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(candidate.slice(first, last + 1));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function extractOpenRouterText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content.map((part) => {
      if (typeof part === 'string') return part;
      if (typeof part?.text === 'string') return part.text;
      if (typeof part?.content === 'string') return part.content;
      return '';
    }).join('').trim();
    if (text) return text;
  }
  return '';
}

function extractOpenAiText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks = [];
  for (const output of data.output || []) {
    for (const content of output.content || []) {
      if (content.type === 'output_text' && content.text) {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join('\n').trim();
}

function validatePayload(action, payload, user) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new HttpError(400, 'Please provide valid learning input.');
  }

  if (action === 'explain') {
    requireText(payload.subject, 'Subject name', 100);
    requireText(payload.topic, 'Topic', 160);
    requireText(payload.problem, 'Problem', 4000);
    return;
  }

  if (action === 'quiz') {
    requireText(payload.topic, 'Topic name', 160);
    const materialKey = requireText(payload.materialKey, 'Uploaded study material', 500);
    validateObjectKey(materialKey, user?.id);
    requireText(payload.materialText, 'Uploaded study material', runtimeConfig.maxExtractedChars);

    const level = String(payload.level || '').trim().toLowerCase();
    if (!['beginner', 'intermediate', 'advanced'].includes(level)) {
      throw new HttpError(400, 'Choose a valid quiz level.');
    }

    const questionCount = Number(payload.questionCount);
    if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 15) {
      throw new HttpError(400, 'Choose a quiz question count from 1 to 15.');
    }
    return;
  }

  requireText(payload.notes || payload.topic, 'Notes or topic', runtimeConfig.maxExtractedChars);

  if (action === 'studyPlan' && payload.days && Number(payload.days) > 30) {
    throw new HttpError(400, 'Study plans can be at most 30 days.');
  }

}

function requireText(value, label, maxLength) {
  if (typeof value !== 'string') {
    throw new HttpError(400, `${label} is required.`);
  }

  const text = value.trim();
  if (!text) {
    throw new HttpError(400, `${label} is required.`);
  }
  if (text.length > maxLength) {
    throw new HttpError(400, `${label} is too long. Keep it under ${maxLength} characters.`);
  }
  return text;
}

function clampDays(value) {
  const days = Number(value || 7);
  if (!Number.isFinite(days)) return 7;
  return Math.min(Math.max(Math.round(days), 1), 30);
}

function escapeTableText(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function safeRequest(payload) {
  const copy = { ...payload };
  delete copy.materialText;
  if (copy.notes && copy.notes.length > 1000) {
    copy.notes = `${copy.notes.slice(0, 1000)}...`;
  }
  return copy;
}
