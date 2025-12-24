import { ServiceParams, UploadedFileReference } from '../types';
import {
  getToolDefinition,
  isToolEnabled,
  SYSTEM_TIME_TOOL_NAME,
} from './toolRegistry';
import {
  buildSystemTimeToolResult,
  buildInstructionText,
  getThinkingSummaryPrompt,
  isTimeQuery,
  resolveProviderState,
  resolveThinkingBudget,
  withRetry,
} from './serviceUtils';

const buildGoogleParts = (
  text: string,
  attachments?: UploadedFileReference[]
) => {
  const parts: Array<{ text?: string; fileData?: any }> = [];
  if (text.trim()) {
    parts.push({ text });
  }

  attachments
    ?.filter(item => item.provider === 'google' && item.fileUri)
    .forEach(item => {
      parts.push({
        fileData: {
          fileUri: item.fileUri,
          mimeType: item.mimeType,
          displayName: item.name,
        },
      });
    });

  return parts.length ? parts : [{ text: '' }];
};

const buildToolPayload = (config: {
  toolChoice: string;
  toolChoiceName?: string;
}) => {
  const tool = getToolDefinition(SYSTEM_TIME_TOOL_NAME);
  if (!tool) return {};
  const toolChoice = config.toolChoice;
  const toolChoiceName = config.toolChoiceName || '';
  const isSpecific = toolChoice === 'specific';
  const specificAllowed = isSpecific && toolChoiceName === tool.name;

  if (toolChoice === 'none') {
    return {};
  }

  const mode = toolChoice === 'required' || specificAllowed ? 'ANY' : 'AUTO';
  return {
    tools: [
      {
        functionDeclarations: [
          {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        ],
      },
    ],
    toolConfig: {
      functionCallingConfig: {
        mode,
        ...(specificAllowed ? { allowedFunctionNames: [tool.name] } : {}),
      },
    },
  };
};

const extractFunctionCall = (data: any) => {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return undefined;
  const match = parts.find((part: any) => part?.functionCall);
  return match?.functionCall;
};

export const streamGoogleResponse = async function* (params: ServiceParams) {
  const {
    history,
    message,
    useThinking,
    useSearch,
    thinkingLevel,
    errorMessage,
    providerConfig,
  } = params;

  const {
    config,
    model: modelToUse,
    streaming,
  } = resolveProviderState(providerConfig);

  const contents = [
    ...history.map(item => ({
      role: item.role === 'model' ? 'model' : 'user',
      parts: buildGoogleParts(
        item.content || '',
        item.role === 'user' ? item.attachments : undefined
      ),
    })),
  ];

  const lastHistory = history[history.length - 1];
  const shouldAppendMessage =
    !lastHistory ||
    lastHistory.role !== 'user' ||
    lastHistory.content !== message;

  if (shouldAppendMessage) {
    contents.push({
      role: 'user',
      parts: buildGoogleParts(message, undefined),
    });
  }

  const systemInstruction = buildInstructionText({
    useThinking,
    useSearch,
    showThinkingSummary: config.showThinkingSummary,
  });

  const thinkingSummaryPrompt = getThinkingSummaryPrompt(
    useThinking,
    config.showThinkingSummary
  );
  if (thinkingSummaryPrompt) {
    const targetText = message.trim();
    const findText = (parts: Array<{ text?: string }>) =>
      parts
        .map(part => part.text || '')
        .join('')
        .trim();
    let targetIndex = -1;
    if (targetText) {
      for (let i = contents.length - 1; i >= 0; i -= 1) {
        if (contents[i].role !== 'user') continue;
        if (findText(contents[i].parts) === targetText) {
          targetIndex = i;
          break;
        }
      }
    }
    if (targetIndex === -1) {
      const lastUserIndex = [...contents]
        .reverse()
        .findIndex(item => item.role === 'user');
      targetIndex =
        lastUserIndex === -1 ? -1 : contents.length - 1 - lastUserIndex;
    }

    if (targetIndex === -1) {
      contents.push({
        role: 'user',
        parts: [{ text: thinkingSummaryPrompt }],
      });
    } else {
      const target = contents[targetIndex];
      contents[targetIndex] = {
        ...target,
        parts: [...target.parts, { text: `\n\n${thinkingSummaryPrompt}` }],
      };
    }
  }

  const generationConfig = {
    temperature: config.temperature ?? 0,
    ...(config.showAdvancedParams && config.topP !== undefined
      ? { topP: config.topP }
      : {}),
    ...(config.showAdvancedParams && config.topK !== undefined
      ? { topK: config.topK }
      : {}),
    ...(useThinking
      ? {
          thinkingConfig: {
            includeThoughts: true,
            thinkingBudget: resolveThinkingBudget(
              thinkingLevel,
              config.thinkingBudgetTokens
            ),
          },
        }
      : {}),
  };

  const toolConfig = config.toolConfig;
  const toolChoice = toolConfig?.toolChoice || 'auto';
  const toolChoiceName = toolConfig?.toolChoiceName || '';
  const toolEnabled = isToolEnabled(toolConfig, SYSTEM_TIME_TOOL_NAME);
  const specificAllowed =
    toolChoice === 'specific' && toolChoiceName === SYSTEM_TIME_TOOL_NAME;
  const allowTool =
    toolEnabled &&
    toolChoice !== 'none' &&
    (toolChoice === 'required' || specificAllowed || isTimeQuery(message));
  const toolPayload = allowTool
    ? buildToolPayload({ toolChoice, toolChoiceName })
    : {};

  try {
    if (allowTool) {
      const toolResponse = await withRetry(async () => {
        const response = await fetch('http://localhost:8787/api/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelToUse,
            contents,
            stream: false,
            generationConfig,
            ...(systemInstruction
              ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
              : {}),
            ...toolPayload,
          }),
        });
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(
            `HTTP ${response.status}: ${response.statusText} - ${text}`
          );
        }
        return response;
      });

      const toolData = await toolResponse.json();
      const functionCall = extractFunctionCall(toolData);
      if (functionCall?.name === SYSTEM_TIME_TOOL_NAME) {
        const toolResultPart = {
          functionResponse: {
            name: functionCall.name,
            response: {
              content: buildSystemTimeToolResult(functionCall.args?.format),
            },
          },
        };
        const nextContents = [
          ...contents,
          { role: 'model', parts: [{ functionCall }] },
          { role: 'user', parts: [toolResultPart] },
        ];

        if (!streaming) {
          const res = await withRetry(async () => {
            const response = await fetch('http://localhost:8787/api/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: modelToUse,
                contents: nextContents,
                stream: false,
                generationConfig,
                ...(systemInstruction
                  ? {
                      systemInstruction: {
                        parts: [{ text: systemInstruction }],
                      },
                    }
                  : {}),
                ...toolPayload,
              }),
            });
            if (!response.ok) {
              const text = await response.text().catch(() => '');
              throw new Error(
                `HTTP ${response.status}: ${response.statusText} - ${text}`
              );
            }
            return response;
          });

          const data = await res.json();
          const content =
            data.candidates?.[0]?.content?.parts
              ?.map((p: any) => p.text || '')
              .join('') || '';

          if (content) {
            yield content;
          }
          return;
        }

        const response = await withRetry(async () => {
          const res = await fetch('http://localhost:8787/api/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: modelToUse,
              contents: nextContents,
              stream: true,
              generationConfig,
              ...(systemInstruction
                ? {
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                  }
                : {}),
              ...toolPayload,
            }),
          });
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`HTTP ${res.status}: ${res.statusText} - ${text}`);
          }
          return res;
        });

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body from proxy');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let lastText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data || data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const text =
                parsed.candidates?.[0]?.content?.parts
                  ?.map((p: any) => p.text || '')
                  .join('') || '';

              if (!text) continue;

              if (text.startsWith(lastText)) {
                const delta = text.slice(lastText.length);
                if (delta) yield delta;
              } else {
                yield text;
              }
              lastText = text;
            } catch {
              // ignore
            }
          }
        }

        return;
      }
    }

    if (!streaming) {
      const res = await withRetry(async () => {
        const response = await fetch('http://localhost:8787/api/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelToUse,
            contents,
            stream: false,
            generationConfig,
            ...(systemInstruction
              ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
              : {}),
            ...toolPayload,
          }),
        });
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(
            `HTTP ${response.status}: ${response.statusText} - ${text}`
          );
        }
        return response;
      });

      const data = await res.json();
      const content =
        data.candidates?.[0]?.content?.parts
          ?.map((p: any) => p.text || '')
          .join('') || '';

      if (content) {
        yield content;
      }
      return;
    }

    const response = await withRetry(async () => {
      const res = await fetch('http://localhost:8787/api/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelToUse,
          contents,
          stream: true,
          generationConfig,
          ...(systemInstruction
            ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
            : {}),
          ...toolPayload,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${res.statusText} - ${text}`);
      }
      return res;
    });

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body from proxy');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let lastText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const text =
            parsed.candidates?.[0]?.content?.parts
              ?.map((p: any) => p.text || '')
              .join('') || '';

          if (!text) continue;

          if (text.startsWith(lastText)) {
            const delta = text.slice(lastText.length);
            if (delta) yield delta;
          } else {
            yield text;
          }
          lastText = text;
        } catch {
          // ignore
        }
      }
    }

    // Note: Google API doesn't provide usage info in the same way as OpenAI
    // We'll skip token usage for now until we find the correct way to extract it
  } catch (error) {
    console.error('Google API Error:', error);
    const message =
      errorMessage || (error instanceof Error ? error.message : '');
    throw new Error(message);
  }
};
