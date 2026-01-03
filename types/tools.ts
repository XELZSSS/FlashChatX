export type ToolChoiceMode = 'auto' | 'none' | 'required' | 'specific';

export interface ToolPermissionConfig {
  enabledToolNames: string[];
  toolChoice: ToolChoiceMode;
  toolChoiceName?: string;
}
