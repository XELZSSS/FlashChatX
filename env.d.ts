interface ImportMetaEnv {
  SEARCH_BASE_URL: string;
  SEARCH_API_KEY: string;
  PROXY_BASE_URL: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly API_KEY?: string;
  readonly MODEL_NAME?: string;
  readonly OPENAI_API_KEY?: string;
  readonly OPENAI_MODEL?: string;
  readonly OPENROUTER_API_KEY?: string;
  readonly OPENROUTER_MODEL?: string;
  readonly XAI_API_KEY?: string;
  readonly XAI_MODEL?: string;
  readonly MIMO_API_KEY?: string;
  readonly MIMO_MODEL?: string;
  readonly DEEPSEEK_API_KEY?: string;
  readonly DEEPSEEK_MODEL?: string;
  readonly Z_API_KEY?: string;
  readonly Z_MODEL?: string;
  readonly Z_INTL_API_KEY?: string;
  readonly Z_INTL_MODEL?: string;
  readonly OPENAI_COMPATIBLE_API_KEY?: string;
  readonly OPENAI_COMPATIBLE_MODEL?: string;
  readonly OPENAI_COMPATIBLE_API_URL?: string;
  readonly BAILING_API_KEY?: string;
  readonly BAILING_MODEL?: string;
  readonly BAILING_THINKING_MODEL?: string;
  readonly LONGCAT_API_KEY?: string;
  readonly LONGCAT_MODEL?: string;
  readonly LONGCAT_THINKING_MODEL?: string;
  readonly MODELSCOPE_API_KEY?: string;
  readonly MODELSCOPE_MODEL?: string;
  readonly MOONSHOT_API_KEY?: string;
  readonly MOONSHOT_MODEL?: string;
  readonly MINIMAX_API_KEY?: string;
  readonly MINIMAX_MODEL?: string;
  readonly GOOGLE_API_KEY?: string;
  readonly GOOGLE_MODEL?: string;
  readonly MEMU_API_KEY?: string;
  readonly MEMU_BASE_URL?: string;
  readonly MEMU_ENABLED?: string;
  readonly MEMU_AUTO_SAVE?: string;
  readonly MEMU_MAX_MEMORIES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  electronAPI?: {
    minimize: () => void;
    toggleMaximize: () => void;
    close: () => void;
    setBackgroundColor?: (color: string) => void;
    getWindowState?: () => Promise<{
      isMaximized: boolean;
    }>;
    onWindowStateChange?: (
      callback: (state: { isMaximized: boolean }) => void
    ) => void | (() => void);
  };
}

declare module 'pdfjs-dist/legacy/build/pdf.worker?url' {
  const workerUrl: string;
  export default workerUrl;
}

declare module 'pdfjs-dist/legacy/build/pdf';
