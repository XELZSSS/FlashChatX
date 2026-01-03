import { useEffect, type MutableRefObject } from 'react';
import type { ChatConfig, ChatSession } from '../../../types';
import type { MemuConfig } from '../../../services/config/memuService';

type UseSyncRefsOptions = {
  input: string;
  currentSessionId: string | null;
  currentSession: ChatSession | null;
  isLoading: boolean;
  chatConfig: ChatConfig;
  memuConfig: MemuConfig;
  inputRef: MutableRefObject<string>;
  currentSessionIdRef: MutableRefObject<string | null>;
  currentSessionRef: MutableRefObject<ChatSession | null>;
  isLoadingRef: MutableRefObject<boolean>;
  chatConfigRef: MutableRefObject<ChatConfig>;
  memuConfigRef: MutableRefObject<MemuConfig>;
};

export const useSyncRefs = ({
  input,
  currentSessionId,
  currentSession,
  isLoading,
  chatConfig,
  memuConfig,
  inputRef,
  currentSessionIdRef,
  currentSessionRef,
  isLoadingRef,
  chatConfigRef,
  memuConfigRef,
}: UseSyncRefsOptions) => {
  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession, currentSessionRef]);

  useEffect(() => {
    inputRef.current = input;
  }, [input, inputRef]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId, currentSessionIdRef]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading, isLoadingRef]);

  useEffect(() => {
    chatConfigRef.current = chatConfig;
  }, [chatConfig, chatConfigRef]);

  useEffect(() => {
    memuConfigRef.current = memuConfig;
  }, [memuConfig, memuConfigRef]);
};
