import { ServiceParams } from '../types';
import {
  getToolDefinition,
  isToolEnabled,
  SYSTEM_TIME_TOOL_NAME,
} from './toolRegistry';
import {
  buildSystemTimeToolResult,
  isTimeQuery,
  postProxyJson,
  resolveProviderState,
} from './serviceUtils';
import { buildGooglePayload, streamGoogleProvider } from './requestPipeline';
import { buildGoogleAdapterContext } from './adapters/registry';

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
  const { message, providerConfig, errorMessage } = params;

  const {
    config,
    model: modelToUse,
    streaming,
  } = resolveProviderState(providerConfig);

  const { contents, generationConfig, systemInstruction } =
    buildGoogleAdapterContext(params, config);

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

  const basePayload = buildGooglePayload({
    model: modelToUse,
    contents,
    generationConfig,
    systemInstruction,
    toolPayload,
    stream: false,
  });

  try {
    if (allowTool) {
      const toolData = await postProxyJson('google', {
        ...basePayload,
        stream: false,
      });
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
        yield* streamGoogleProvider({
          params,
          payload: buildGooglePayload({
            model: modelToUse,
            contents: nextContents,
            generationConfig,
            systemInstruction,
            toolPayload,
            stream: streaming,
          }),
        });
        return;
      }
    }

    yield* streamGoogleProvider({
      params,
      payload: buildGooglePayload({
        model: modelToUse,
        contents,
        generationConfig,
        systemInstruction,
        toolPayload,
        stream: streaming,
      }),
    });
  } catch (error) {
    console.error('Google API Error:', error);
    const message =
      errorMessage || (error instanceof Error ? error.message : '');
    throw new Error(message);
  }
};
