import { FunctionCallingConfigMode, GoogleGenAI } from '@google/genai';
import type {
  Content,
  FunctionCall,
  GenerateContentConfig,
  GenerateContentParameters,
  GenerateContentResponse,
  Part,
} from '@google/genai';
import { GEMINI_MODELS } from '../../constants';
import { ServiceParams } from '../types';
import {
  buildSystemTimeToolResult,
  isTimeQuery,
  resolveProviderState,
} from '../pipeline/serviceUtils';
import { buildGeminiAdapterContext } from '../adapters/registry';
import {
  getToolDefinition,
  isToolEnabled,
  SYSTEM_TIME_TOOL_NAME,
} from '../tools/toolRegistry';

type GeminiToolCall = FunctionCall & { name: string };

const getGeminiClient = (apiKey: string) => new GoogleGenAI({ apiKey });

const buildToolPayload = (config: {
  toolChoice: string;
  toolChoiceName?: string;
}): Pick<GenerateContentConfig, 'tools' | 'toolConfig'> | undefined => {
  const tool = getToolDefinition(SYSTEM_TIME_TOOL_NAME);
  if (!tool) return undefined;

  const toolChoice = config.toolChoice;
  const toolChoiceName = config.toolChoiceName || '';
  const isSpecific = toolChoice === 'specific';
  const specificAllowed = isSpecific && toolChoiceName === tool.name;

  if (toolChoice === 'none') {
    return undefined;
  }

  const mode =
    toolChoice === 'required' || specificAllowed
      ? FunctionCallingConfigMode.ANY
      : FunctionCallingConfigMode.AUTO;

  return {
    tools: [
      {
        functionDeclarations: [
          {
            name: tool.name,
            description: tool.description,
            parametersJsonSchema: tool.parameters,
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

const extractFunctionCall = (data: GenerateContentResponse) => {
  const calls = data.functionCalls;
  if (!Array.isArray(calls)) return undefined;
  return calls.find(
    (call): call is GeminiToolCall => !!call && typeof call.name === 'string'
  );
};

const extractToolInput = (call: GeminiToolCall) => {
  const args = call?.args;
  if (!args || typeof args !== 'object') return undefined;
  const format = (args as { format?: string }).format;
  return typeof format === 'string' ? format : undefined;
};

const streamGeminiText = async function* (
  stream: AsyncGenerator<GenerateContentResponse>
): AsyncGenerator<string> {
  let lastText = '';
  for await (const chunk of stream) {
    const text = chunk.text || '';
    if (!text) continue;
    if (text.startsWith(lastText)) {
      const delta = text.slice(lastText.length);
      if (delta) yield delta;
    } else {
      yield text;
    }
    lastText = text;
  }
};

export const streamGeminiResponse = async function* (params: ServiceParams) {
  const { message, providerConfig, errorMessage, useThinking } = params;

  const { config, streaming } = resolveProviderState(providerConfig);
  const modelToUse = useThinking
    ? GEMINI_MODELS.thinking
    : GEMINI_MODELS.default;

  if (!config.apiKey) {
    throw new Error(errorMessage || 'Missing API key for Gemini provider.');
  }

  const { contents, generationConfig, systemInstruction } =
    buildGeminiAdapterContext(params, config);

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
    : undefined;

  const requestConfig: GenerateContentConfig = {
    ...(generationConfig || {}),
    ...(systemInstruction ? { systemInstruction } : {}),
    ...(toolPayload || {}),
  };

  const client = getGeminiClient(config.apiKey);

  try {
    if (allowTool) {
      const toolData = (await client.models.generateContent({
        model: modelToUse,
        contents,
        config: requestConfig,
      } satisfies GenerateContentParameters)) as GenerateContentResponse;
      const functionCall = extractFunctionCall(toolData);
      if (functionCall?.name === SYSTEM_TIME_TOOL_NAME) {
        const toolResultPart: Part = {
          functionResponse: {
            name: functionCall.name,
            response: {
              content: buildSystemTimeToolResult(
                extractToolInput(functionCall)
              ),
            },
          },
        };
        const nextContents: Content[] = [
          ...contents,
          {
            role: 'model',
            parts: [{ functionCall }],
          },
          { role: 'user', parts: [toolResultPart] },
        ];

        if (streaming) {
          const stream = await client.models.generateContentStream({
            model: modelToUse,
            contents: nextContents,
            config: requestConfig,
          } satisfies GenerateContentParameters);
          yield* streamGeminiText(stream);
          return;
        }

        const followup = (await client.models.generateContent({
          model: modelToUse,
          contents: nextContents,
          config: requestConfig,
        } satisfies GenerateContentParameters)) as GenerateContentResponse;
        const text = followup.text || '';
        if (text) yield text;
        return;
      }
    }

    if (streaming) {
      const stream = await client.models.generateContentStream({
        model: modelToUse,
        contents,
        config: requestConfig,
      } satisfies GenerateContentParameters);
      yield* streamGeminiText(stream);
      return;
    }

    const response = (await client.models.generateContent({
      model: modelToUse,
      contents,
      config: requestConfig,
    } satisfies GenerateContentParameters)) as GenerateContentResponse;
    const text = response.text || '';
    if (text) yield text;
  } catch (error) {
    console.error('Gemini SDK Error:', error);
    const message =
      errorMessage || (error instanceof Error ? error.message : '');
    throw new Error(message);
  }
};
