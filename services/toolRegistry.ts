import type { ToolPermissionConfig } from '../types';

export type ToolRiskLevel = 'low' | 'medium' | 'high';

export type ToolDefinition = {
  name: string;
  title: string;
  titleKey?: string;
  description: string;
  descriptionKey?: string;
  parameters: Record<string, unknown>;
  riskLevel: ToolRiskLevel;
  managedByProxy?: boolean;
};

export const READ_FILE_TOOL_NAME = 'read_file';
export const SYSTEM_TIME_TOOL_NAME = 'get_system_time';

const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  [READ_FILE_TOOL_NAME]: {
    name: READ_FILE_TOOL_NAME,
    title: 'Read local file',
    titleKey: 'toolReadFileTitle',
    description:
      'Read a user-provided local file and return extracted text for analysis.',
    descriptionKey: 'toolReadFileDescription',
    parameters: {
      type: 'object',
      properties: {
        file_name: {
          type: 'string',
          description: 'Exact filename from the attachment list.',
        },
        file_id: {
          type: 'string',
          description: 'Attachment id from the attachment list.',
        },
      },
    },
    riskLevel: 'low',
  },
  [SYSTEM_TIME_TOOL_NAME]: {
    name: SYSTEM_TIME_TOOL_NAME,
    title: 'System time',
    titleKey: 'toolSystemTimeTitle',
    description: 'Get the current system date and time from the server.',
    descriptionKey: 'toolSystemTimeDescription',
    parameters: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          description: 'Optional format hint: "iso" or "local".',
        },
      },
    },
    riskLevel: 'low',
    managedByProxy: true,
  },
};

export const listTools = (): ToolDefinition[] => Object.values(TOOL_REGISTRY);

export const getToolDefinition = (name: string): ToolDefinition | undefined =>
  TOOL_REGISTRY[name];

export const getToolDefinitionsByNames = (
  names: string[],
  options?: { managedOnly?: boolean }
): ToolDefinition[] => {
  const managedOnly = options?.managedOnly === true;
  return names
    .map(name => TOOL_REGISTRY[name])
    .filter((tool): tool is ToolDefinition => !!tool)
    .filter(tool => !managedOnly || tool.managedByProxy);
};

export const getDefaultToolConfig = (): ToolPermissionConfig => ({
  enabledToolNames: [READ_FILE_TOOL_NAME, SYSTEM_TIME_TOOL_NAME],
  toolChoice: 'auto',
});

export const isToolEnabled = (
  config: ToolPermissionConfig | undefined,
  toolName: string
) => {
  const enabled = config?.enabledToolNames || [];
  return enabled.includes(toolName);
};
