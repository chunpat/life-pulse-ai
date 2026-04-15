
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { parseLifeLog, getSmartSuggestions, normalizeSmartSuggestion, SmartSuggestion } from '../services/qwenService';
import { createFinanceRecord, deleteFinanceRecordsByLogId } from '../services/financeService';
import { storageService } from '../services/storageService';
import { runtimeConfig } from '../services/runtimeConfig';
import { ChatMessage, Goal, GoalCreateInput, LogEntry, ParseResult, Plan, PlanCreateInput, PlanParseResult, RewardProfile } from '../types';
import { buildSafeAreaInsetStyle, buildSafeAreaPaddingStyle } from '../utils/safeArea';
import { formatMessageTime, shouldShowTimeLabel } from '../utils/formatMessageTime';
import GoalPlanner from './GoalPlanner';
import NoticeToast from './NoticeToast';

// 兼容性 UUID 生成函数
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // 备用 UUID 生成方法
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const OFFICIAL_ACCENT_COLOR_MAP: Record<string, string> = {
  '#1d4ed8': '#f59e0b',
  '#7c3aed': '#d97706',
  '#059669': '#c2410c'
};

const DRAFT_STORAGE_KEY = 'lifepulse_unconfirmed_draft';
const DISMISSED_SMART_SUGGESTION_KEY = 'lifepulse_dismissed_smart_suggestion';
const DRAFT_STALE_HOURS = 24;
const UNDO_WINDOW_MS = 5 * 60 * 1000;
const INLINE_INPUT_FOCUS_RETRY_DELAYS = runtimeConfig.isNativeIos ? [0, 60, 180] : [0];

const focusTextControl = (element: HTMLInputElement | HTMLTextAreaElement | null) => {
  if (!element) return;

  const focus = () => {
    element.focus();

    if ('setSelectionRange' in element) {
      const cursorPosition = element.value.length;
      element.setSelectionRange(cursorPosition, cursorPosition);
    }
  };

  focus();

  INLINE_INPUT_FOCUS_RETRY_DELAYS.slice(1).forEach((delay) => {
    window.setTimeout(focus, delay);
  });
};

const focusInlineInputFromUserGesture = (
  event: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
  input: HTMLInputElement | null
) => {
  const target = event.target;
  if (target instanceof HTMLElement && target.closest('button')) {
    return;
  }

  focusTextControl(input);
};

const getSuggestionKey = (suggestion: SmartSuggestion | null) => {
  if (!suggestion?.content.trim()) return '';
  return `${suggestion.type}::${suggestion.trigger}::${suggestion.content}`;
};

function persistUnconfirmedDraft(draft: NonNullable<ReturnType<typeof buildDraftPreview>>) {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
      draft,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('Failed to persist draft', e);
  }
}

function loadPersistedDraft(): ReturnType<typeof buildDraftPreview> | null {
  try {
    const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!stored) return null;
    const { draft, timestamp } = JSON.parse(stored);
    const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);
    if (ageHours > DRAFT_STALE_HOURS) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return null;
    }

    const normalizedDraft = {
      ...draft,
      createdAt: typeof draft?.createdAt === 'number' ? draft.createdAt : timestamp
    };

    if (normalizedDraft.createdAt + UNDO_WINDOW_MS <= Date.now()) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return null;
    }

    return normalizedDraft;
  } catch (e) {
    console.warn('Failed to load persisted draft', e);
    return null;
  }
}

function clearPersistedDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear persisted draft', e);
  }
}

const formatDateKey = (value: number | string | Date) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeOfficialAccentColor = (accentColor?: string | null) => {
  const normalized = typeof accentColor === 'string' ? accentColor.trim().toLowerCase() : '';
  return OFFICIAL_ACCENT_COLOR_MAP[normalized] || accentColor || '#f59e0b';
};

const getLoggerGoalAccentColor = (goal: Goal) => {
  const metadataAccent = typeof goal.metadata?.accentColor === 'string' ? goal.metadata.accentColor : null;

  if (goal.planScope === 'official') {
    return normalizeOfficialAccentColor(metadataAccent);
  }

  return '#f59e0b';
};

const isDraftExpired = (draft: ReturnType<typeof buildDraftPreview>, now = Date.now()) => {
  return draft.createdAt + UNDO_WINDOW_MS <= now;
};

interface LoggerProps {
  onAddLog: (entry: LogEntry) => Promise<void>;
  onLogout: () => void;
  userId: string;
  isGuest?: boolean;
  logs: LogEntry[]; // Changed from logsCount to logs array
  chatMessages: ChatMessage[];
  hasMoreChatMessages?: boolean;
  goals: Goal[];
  rewardProfile?: RewardProfile | null;
  sidebarOpenRequestKey?: number;
  sidebarOpenTab?: 'goals' | 'record-add';
  isComposerOpen: boolean;
  isGoalActionLoading?: boolean;
  isLoadingOlderChatMessages?: boolean;
  onOpenComposer: () => void;
  onCloseComposer: () => void;
  onCreateGoal: (goalInput: GoalCreateInput) => Promise<void>;
  onCreateChatMessage: (message: { id?: string; role: 'user' | 'assistant'; content: string; messageType?: 'text' | 'confirmation'; timestamp?: number; metadata?: Record<string, unknown> }) => Promise<void>;
  onLoadOlderChatMessages: () => Promise<void>;
  onDeleteChatMessages: (messageIds: string[]) => Promise<void>;
  onCreatePlan: (planInput: PlanCreateInput) => Promise<Plan | undefined>;
  onDeleteLog: (logId: string) => Promise<void>;
  onDeletePlan: (planId: string) => Promise<void>;
  onPauseGoal: (goalId: string) => Promise<void>;
  onResumeGoal: (goalId: string) => Promise<void>;
  onSetPrimaryGoal: (goalId: string) => Promise<void>;
  onDeleteGoal: (goalId: string) => Promise<void>;
}

const Logger: React.FC<LoggerProps> = ({
  onAddLog,
  onLogout,
  userId,
  isGuest = false,
  logs,
  chatMessages,
  hasMoreChatMessages = false,
  goals,
  rewardProfile,
  sidebarOpenRequestKey = 0,
  sidebarOpenTab = 'goals',
  isComposerOpen,
  isGoalActionLoading = false,
  isLoadingOlderChatMessages = false,
  onOpenComposer,
  onCloseComposer,
  onCreateGoal,
  onCreateChatMessage,
  onLoadOlderChatMessages,
  onDeleteChatMessages,
  onCreatePlan,
  onDeleteLog,
  onDeletePlan,
  onPauseGoal,
  onResumeGoal,
  onSetPrimaryGoal,
  onDeleteGoal
}) => {
  const { t, i18n } = useTranslation();
  const isNativeIos = runtimeConfig.isNativeIos;
  const [inputText, setInputText] = useState('');
  const [draftParse, setDraftParse] = useState<ReturnType<typeof buildDraftPreview> | null>(null);
  const [draftTriggerMessageId, setDraftTriggerMessageId] = useState<string | null>(null);
  const [draftPendingMessageId, setDraftPendingMessageId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<SmartSuggestion | null>(null);
  const [dismissedSuggestionKey, setDismissedSuggestionKey] = useState(() => localStorage.getItem(DISMISSED_SMART_SUGGESTION_KEY) || '');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [voiceErrorType, setVoiceErrorType] = useState<'permission' | 'unsupported' | null>(null);
  const [voiceInputSupported, setVoiceInputSupported] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LogEntry['location']>(undefined);
  const [isUploading, setIsUploading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isWeChat, setIsWeChat] = useState(false);
  const [wxReady, setWxReady] = useState(false);
  const [showShareOverlay, setShowShareOverlay] = useState(false);
  const [showGoalDrawer, setShowGoalDrawer] = useState(false);
  const [showTimelineDrawer, setShowTimelineDrawer] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'goals' | 'record-add'>('goals');
  const [composerMode, setComposerMode] = useState<'chat' | 'record-add'>('chat');
  const [imageDirectAnalyze, setImageDirectAnalyze] = useState(false);
  const [showInlineKeyboard, setShowInlineKeyboard] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: 'success' | 'error' | 'info' } | null>(null);
  const [expandedPendingMessageId, setExpandedPendingMessageId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const chatLoadTopRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatScrollRootRef = useRef<HTMLElement | null>(null);
  const hasInitialAutoScrollRef = useRef(false);
  const isPrependingChatHistoryRef = useRef(false);
  const hasUserScrolledAwayFromBottomRef = useRef(false);
  const lastChatScrollTopRef = useRef(0);
  const previousChatHeightRef = useRef<number | null>(null);
  const voiceTranscriptRef = useRef('');
  const voiceDraftRef = useRef('');
  const shouldRestartListeningRef = useRef(false);
  const shouldSubmitVoiceOnEndRef = useRef(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const drawerHeaderSafeStyle = buildSafeAreaPaddingStyle({ top: '1rem', right: '1.25rem', left: '1.25rem' });
  const centeredModalSafeStyle = buildSafeAreaPaddingStyle({ top: '1rem', right: '1rem', bottom: '1rem', left: '1rem' });
  const shareOverlaySafeStyle = buildSafeAreaPaddingStyle({ top: '1rem', right: '1rem', bottom: '1.5rem', left: '1rem' });
  const shareArrowSafeStyle = buildSafeAreaInsetStyle({ top: '0.5rem', right: '1.5rem' });
  const timelineGroupStickySafeStyle = buildSafeAreaInsetStyle({ top: '5.5rem' });
  const composerSheetStyle = false
    ? {
        maxHeight: 'calc(100vh - env(safe-area-inset-top) - 0.5rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)'
      }
    : undefined;
  const composerHeaderSafeStyle = false
    ? buildSafeAreaPaddingStyle({ top: '0.75rem' })
    : undefined;

  const activeGoals = goals.filter((goal) => goal.status === 'active');
  const primaryGoal = activeGoals.find((goal) => goal.rewardRole === 'primary') || activeGoals[0] || null;
  const interruptedGoalsCount = goals.filter((goal) => goal.status === 'failed').length;
  const focusGoal = primaryGoal || goals.find((goal) => goal.status === 'paused') || null;
  const todayKey = formatDateKey(Date.now());

  const recentConversation = logs.slice(0, 6).reverse();
  const recentChatMessages = chatMessages;
  const timelineLogs = [...recentConversation].sort((a, b) => b.timestamp - a.timestamp);
  const timelineGroups = buildTimelineGroups(timelineLogs);
  const latestPendingPreviewId = [...recentChatMessages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.metadata?.kind === 'pending_preview')?.id || null;
  const latestUndoableConfirmationId = [...recentChatMessages]
    .reverse()
    .find((message) => {
      if (message.role !== 'assistant' || message.messageType !== 'confirmation') return false;
      return Number(message.metadata?.undoExpiresAt || 0) > currentTime;
    })?.id || null;
  const latestUndoableUserMessageId = [...recentChatMessages]
    .reverse()
    .find((message) => {
      if (message.role !== 'user') return false;
      return message.timestamp + UNDO_WINDOW_MS > currentTime;
    })?.id || null;
  const isCurrentDraftExpired = draftParse ? isDraftExpired(draftParse, currentTime) : false;
  const currentDraftTimeValidation = draftParse?.parsed.intent === 'plan' ? draftParse.parsed.plan?.timeValidation : undefined;
  const activeSuggestionKey = getSuggestionKey(suggestion);
  const shouldShowFloatingSuggestion = Boolean(suggestion?.content.trim()) && activeSuggestionKey !== dismissedSuggestionKey && !isComposerOpen;

  useEffect(() => {
    if (!sidebarOpenRequestKey) return;
    setSidebarTab(sidebarOpenTab);
    setShowGoalDrawer(true);
  }, [sidebarOpenRequestKey, sidebarOpenTab]);

  useEffect(() => {
    const persisted = loadPersistedDraft();
    if (persisted && !draftParse) {
      setDraftParse(persisted);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!logs.length) return;

    const cachedSuggestion = localStorage.getItem('current_suggestion');
    const lastFetch = localStorage.getItem('last_suggestion_fetch');
    const now = Date.now();

    if (cachedSuggestion && lastFetch && now - Number(lastFetch) < 4 * 60 * 60 * 1000) {
      try {
        const parsedSuggestion = normalizeSmartSuggestion(JSON.parse(cachedSuggestion));
        if (parsedSuggestion) {
          setSuggestion(parsedSuggestion);
          return;
        }

        localStorage.removeItem('current_suggestion');
        localStorage.removeItem('last_suggestion_fetch');
      } catch (error) {
        console.warn('Failed to read cached suggestion', error);
      }
    }

    let cancelled = false;
    const fetchSuggestion = async () => {
      try {
        const nextSuggestion = await getSmartSuggestions(logs, i18n.language);
        if (!cancelled && nextSuggestion) {
          setSuggestion(nextSuggestion);
          localStorage.setItem('current_suggestion', JSON.stringify(nextSuggestion));
          localStorage.setItem('last_suggestion_fetch', String(now));
        } else if (!cancelled) {
          setSuggestion(null);
          localStorage.removeItem('current_suggestion');
          localStorage.removeItem('last_suggestion_fetch');
        }
      } catch (error) {
        console.warn('Failed to fetch smart suggestion', error);
      }
    };

    fetchSuggestion();

    return () => {
      cancelled = true;
    };
  }, [logs, i18n.language]);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const inWeChat = /micromessenger/.test(ua);
    setIsWeChat(inWeChat);
    setWxReady(Boolean(inWeChat && (window as any).wx));
  }, []);

  useEffect(() => {
    if (isWeChat) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      recognitionRef.current = null;
      setVoiceInputSupported(false);
      return;
    }

    setVoiceInputSupported(true);

    const recognition = new SpeechRecognition();
    recognition.lang = i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let finalChunk = '';
      let interimChunk = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index]?.[0]?.transcript || '';
        if (!transcript) continue;

        if (event.results[index].isFinal) {
          finalChunk += transcript;
        } else {
          interimChunk += transcript;
        }
      }

      if (finalChunk) {
        voiceTranscriptRef.current = `${voiceTranscriptRef.current} ${finalChunk}`.trim();
      }

      voiceDraftRef.current = `${voiceTranscriptRef.current} ${interimChunk}`.trim();
      setInputText(voiceDraftRef.current);
      setVoiceErrorType(null);
    };

    recognition.onerror = (event: any) => {
      shouldRestartListeningRef.current = false;
      shouldSubmitVoiceOnEndRef.current = false;
      if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
        setVoiceErrorType('permission');
      } else if (event?.error === 'language-not-supported') {
        setVoiceErrorType('unsupported');
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      if (shouldRestartListeningRef.current) {
        try {
          recognition.start();
          return;
        } catch (error) {
          console.error(error);
        }
      }

      const finalTranscript = voiceDraftRef.current.trim();
      const shouldSubmit = shouldSubmitVoiceOnEndRef.current;
      shouldSubmitVoiceOnEndRef.current = false;
      shouldRestartListeningRef.current = false;
      setIsListening(false);

      if (shouldSubmit && finalTranscript) {
        voiceTranscriptRef.current = '';
        voiceDraftRef.current = '';
        const cleanedText = finalTranscript.replace(/[。，？！]$/, '');
        void analyzeTextInput(cleanedText);
        return;
      }

      voiceTranscriptRef.current = '';
      voiceDraftRef.current = '';
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop?.();
      recognitionRef.current = null;
      setVoiceInputSupported(false);
    };
  }, [i18n.language, isWeChat]);

  useEffect(() => {
    if (!isComposerOpen) return;

    const timer = window.setTimeout(() => {
      focusTextControl(textareaRef.current);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [isComposerOpen]);

  useEffect(() => {
    if (isComposerOpen || !showInlineKeyboard) return;

    const timer = window.setTimeout(() => {
      focusTextControl(inlineInputRef.current);
    }, 80);

    return () => window.clearTimeout(timer);
  }, [isComposerOpen, showInlineKeyboard]);

  useEffect(() => {
    if (!isListening) return;

    const handleGlobalRelease = () => {
      stopVoiceInputAndSubmit();
    };

    window.addEventListener('touchend', handleGlobalRelease);
    window.addEventListener('touchcancel', handleGlobalRelease);
    window.addEventListener('mouseup', handleGlobalRelease);

    return () => {
      window.removeEventListener('touchend', handleGlobalRelease);
      window.removeEventListener('touchcancel', handleGlobalRelease);
      window.removeEventListener('mouseup', handleGlobalRelease);
    };
  }, [isListening]);

  useEffect(() => {
    const root = chatBottomRef.current?.closest('main');
    if (!root) return;

    const scrollRoot = root as HTMLElement;
    chatScrollRootRef.current = scrollRoot;
    lastChatScrollTopRef.current = scrollRoot.scrollTop;

    const updateScrollIntent = () => {
      const distanceFromBottom = scrollRoot.scrollHeight - (scrollRoot.scrollTop + scrollRoot.clientHeight);
      const hasScrolledUp = scrollRoot.scrollTop < lastChatScrollTopRef.current;

      if (distanceFromBottom <= 24) {
        hasUserScrolledAwayFromBottomRef.current = false;
      } else if (hasScrolledUp) {
        hasUserScrolledAwayFromBottomRef.current = true;
      }

      lastChatScrollTopRef.current = scrollRoot.scrollTop;
    };

    scrollRoot.addEventListener('scroll', updateScrollIntent, { passive: true });

    return () => {
      scrollRoot.removeEventListener('scroll', updateScrollIntent);
      if (chatScrollRootRef.current === scrollRoot) {
        chatScrollRootRef.current = null;
      }
    };
  }, [recentChatMessages.length]);

  useEffect(() => {
    if (isPrependingChatHistoryRef.current) {
      const scrollContainer = chatBottomRef.current?.closest('main');
      if (scrollContainer && previousChatHeightRef.current !== null) {
        const nextHeight = scrollContainer.scrollHeight;
        scrollContainer.scrollTop += nextHeight - previousChatHeightRef.current;
      }
      previousChatHeightRef.current = null;
      isPrependingChatHistoryRef.current = false;
      return;
    }

    const scrollBehavior = hasInitialAutoScrollRef.current ? 'smooth' : 'auto';
    const timer = window.setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: scrollBehavior, block: 'end' });
      hasInitialAutoScrollRef.current = true;
    }, 80);

    return () => window.clearTimeout(timer);
  }, [recentChatMessages.length, draftParse, uploadedImages.length, isProcessing, isListening, inputText, showInlineKeyboard]);

  const handleRequestOlderChatMessages = () => {
    const root = chatScrollRootRef.current || chatBottomRef.current?.closest('main');
    if (!root || isLoadingOlderChatMessages) return;

    previousChatHeightRef.current = root.scrollHeight;
    isPrependingChatHistoryRef.current = true;
    hasUserScrolledAwayFromBottomRef.current = false;
    void onLoadOlderChatMessages();
  };

  useEffect(() => {
    if (!hasMoreChatMessages) return;

    const root = chatBottomRef.current?.closest('main');
    const target = chatLoadTopRef.current;
    if (!root || !target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (!firstEntry?.isIntersecting || isLoadingOlderChatMessages) return;
        if (!hasUserScrolledAwayFromBottomRef.current) return;
        if (root.scrollHeight <= root.clientHeight + 24) return;

        previousChatHeightRef.current = root.scrollHeight;
        isPrependingChatHistoryRef.current = true;
        hasUserScrolledAwayFromBottomRef.current = false;
        void onLoadOlderChatMessages();
      },
      {
        root,
        threshold: 0.1,
        rootMargin: '120px 0px 0px 0px'
      }
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [hasMoreChatMessages, isLoadingOlderChatMessages, onLoadOlderChatMessages, recentChatMessages.length]);

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    setCurrentTime(Date.now());
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setExpandedPendingMessageId(latestPendingPreviewId);
  }, [latestPendingPreviewId]);

  const showNotice = (message: string, tone: 'success' | 'error' | 'info' = 'info') => {
    setNotice({ message, tone });
  };

  const handleDismissSuggestion = () => {
    if (!activeSuggestionKey) return;
    localStorage.setItem(DISMISSED_SMART_SUGGESTION_KEY, activeSuggestionKey);
    setDismissedSuggestionKey(activeSuggestionKey);
  };

  const analyzeTextInput = async (text: string, options?: { openComposer?: boolean }) => {
    const normalizedText = text.trim();
    if (!normalizedText || isProcessing) return;

    if (isGuest && logs.length >= 3) {
      setShowLimitModal(true);
      return;
    }

    if (options?.openComposer) {
      onOpenComposer();
    }

    // 如果有未确认的预览，转成待处理消息保留在对话中
      if (draftParse) {
        const pendingContent = draftParse.kind === 'plan'
          ? t('logger.pending_plan_preview', { title: draftParse.summary })
          : draftParse.kind === 'finance'
            ? t('logger.pending_finance_preview', { count: draftParse.parsed.finance?.length })
            : t('logger.pending_log_preview', { activity: draftParse.summary });
        const pendingMsgId = generateUUID();
        void onCreateChatMessage({
          id: pendingMsgId,
          role: 'assistant',
          content: pendingContent,
          messageType: 'text',
          timestamp: Date.now(),
          metadata: { kind: 'pending_preview', draftData: draftParse, triggerMessageId: draftTriggerMessageId }
        });
        setDraftPendingMessageId(pendingMsgId);
        setExpandedPendingMessageId(pendingMsgId);
      }

    setInputText(normalizedText);
    setDraftParse(null);
    setDraftTriggerMessageId(null);
    clearPersistedDraft();
    setIsProcessing(true);
    const userMsgId = generateUUID();
    void onCreateChatMessage({
      id: userMsgId,
      role: 'user',
      content: normalizedText,
      messageType: 'text',
      timestamp: Date.now(),
      metadata: {
        source: options?.openComposer ? 'composer' : 'chat'
      }
    });

    try {
      const parsed = await parseLifeLog(
        normalizedText,
        i18n.language,
        'auto',
        recentChatMessages.slice(-6).map((message) => ({
          role: message.role,
          content: message.content
        }))
      );

      if (parsed.intent === 'chat') {
        await onCreateChatMessage({
          id: generateUUID(),
          role: 'assistant',
          content: parsed.assistantReply || (i18n.language.startsWith('zh') ? '我在，继续说。' : 'I am here. Go on.'),
          messageType: 'text',
          timestamp: Date.now(),
          metadata: {
            kind: 'chat'
          }
        });
        setInputText('');
        setDraftParse(null);
        return;
      }

      const preview = buildDraftPreview(parsed, normalizedText);
      persistUnconfirmedDraft(preview);
      setDraftParse(preview);
      setDraftTriggerMessageId(userMsgId);
    } catch (error) {
      console.error(error);
      showNotice(t('logger.parse_failed', '解析失败，已按普通记录保存'), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const imageUrl = await storageService.uploadImage(file);
      setUploadedImages((prev) => [...prev, imageUrl]);
      setImageDirectAnalyze(false);
    } catch (error) {
      console.error(error);
      showNotice(t('logger.image_upload_failed', '图片上传失败，请重试'), 'error');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const captureLocation = async () => {
    if (!navigator.geolocation) {
      showNotice(t('logger.location_failed', '当前设备不支持定位'), 'error');
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        setCurrentLocation({
          name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          latitude,
          longitude
        });
        setIsGettingLocation(false);
      },
      (error) => {
        console.error(error);
        setIsGettingLocation(false);
        showNotice(t('logger.location_failed', '定位失败，请检查权限'), 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  const startVoiceInput = (event?: React.TouchEvent | React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();

    if (isListening || isProcessing) return;

    setVoiceErrorType(null);
    setDraftParse(null);
    clearPersistedDraft();
    setShowInlineKeyboard(false);
    setInputText('');
    voiceTranscriptRef.current = '';
    voiceDraftRef.current = '';
    shouldSubmitVoiceOnEndRef.current = false;

    if (isWeChat) {
      const wx = (window as any).wx;
      if (!wx) {
        setVoiceErrorType('unsupported');
        showNotice(t('logger.wechat_hint'), 'error');
        return;
      }

      setIsListening(true);
      wx.startRecord({
        success: () => {
          wx.onVoiceRecordEnd({
            complete: (res: any) => {
              const localId = res.localId;
              setIsListening(false);
              wx.translateVoice({
                localId,
                isShowProgressTips: 1,
                success: (response: any) => {
                  const text = response.translateResult;
                  if (text) {
                    const cleanedText = text.replace(/[。，？！]$/, '');
                    setInputText(cleanedText);
                    void analyzeTextInput(cleanedText);
                  }
                }
              });
            }
          });
        },
        cancel: () => {
          setIsListening(false);
          showNotice('您拒绝了授权录音', 'error');
        },
        fail: (error: any) => {
          console.error('Start record failed', error);
          setIsListening(false);
          setVoiceErrorType('permission');
        }
      });
      return;
    }

    const recognition = recognitionRef.current;
    if (!voiceInputSupported || !recognition || typeof recognition.start !== 'function') {
      setVoiceErrorType('unsupported');
      showNotice(t(isNativeIos ? 'logger.voice_ios_hint' : 'logger.voice_unsupported_hint'), 'error');
      return;
    }

    shouldRestartListeningRef.current = true;
    setIsListening(true);
    try {
      recognition.start();
    } catch (error) {
      console.error(error);
      shouldRestartListeningRef.current = false;
      setIsListening(false);
      setVoiceErrorType('permission');
    }
  };

  const stopVoiceInputAndSubmit = (event?: React.TouchEvent | React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();

    if (!isListening || isProcessing) return;

    if (isWeChat) {
      const wx = (window as any).wx;
      if (!wx) {
        setIsListening(false);
        return;
      }

      wx.stopRecord({
        success: (res: any) => {
          const localId = res.localId;
          setIsListening(false);
          wx.translateVoice({
            localId,
            isShowProgressTips: 1,
            success: (response: any) => {
              const text = response.translateResult;
              if (text) {
                const cleanedText = text.replace(/[。，？！]$/, '');
                setInputText(cleanedText);
                void analyzeTextInput(cleanedText);
              }
            },
            fail: (error: any) => {
              console.error('Stop record failed', error);
            }
          });
        },
        fail: (error: any) => {
          console.error('Stop record failed', error);
          setIsListening(false);
        }
      });
      return;
    }

    shouldRestartListeningRef.current = false;
    shouldSubmitVoiceOnEndRef.current = true;
    recognitionRef.current?.stop();
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    if (showInlineKeyboard) {
      inlineInputRef.current?.blur();
      if (isNativeIos) {
        setShowInlineKeyboard(false);
      }
    }
    await analyzeTextInput(inputText);
  };

  const handleOpenInlineKeyboard = () => {
    if (isListening) {
      stopVoiceInputAndSubmit();
      return;
    }

    // 如果有未确认的预览，转成待处理消息保留在对话中
    if (draftParse) {
      const pendingContent = draftParse.kind === 'plan'
        ? t('logger.pending_plan_preview', { title: draftParse.summary })
        : draftParse.kind === 'finance'
          ? t('logger.pending_finance_preview', { count: draftParse.parsed.finance?.length })
          : t('logger.pending_log_preview', { activity: draftParse.summary });
      const pendingMsgId = generateUUID();
      void onCreateChatMessage({
        id: pendingMsgId,
        role: 'assistant',
        content: pendingContent,
        messageType: 'text',
        timestamp: Date.now(),
        metadata: { kind: 'pending_preview', draftData: draftParse, triggerMessageId: draftTriggerMessageId }
      });
      setDraftPendingMessageId(pendingMsgId);
      // Auto expand the newly created pending preview
      setExpandedPendingMessageId(pendingMsgId);
    }

    setDraftParse(null);
    clearPersistedDraft();

    setShowInlineKeyboard(true);
    focusTextControl(inlineInputRef.current);
  };

  const handleInlineInputContainerPress = (event: React.MouseEvent<HTMLFormElement> | React.TouchEvent<HTMLFormElement>) => {
    focusInlineInputFromUserGesture(event, inlineInputRef.current);
  };

  const handleSwitchToVoiceInput = () => {
    inlineInputRef.current?.blur();
    textareaRef.current?.blur();
    setShowInlineKeyboard(false);
  };

  const handleApplyDraftTimeSuggestion = (draftData: NonNullable<ReturnType<typeof buildDraftPreview>>) => {
    const adjustedDraft = buildAdjustedDraftPreview(draftData);
    if (!adjustedDraft) {
      return;
    }

    persistUnconfirmedDraft(adjustedDraft);
    setDraftParse(adjustedDraft);
    showNotice(t('logger.plan_time_adjusted'), 'success');
  };

  const handleConfirmDraft = async () => {
    if (!draftParse || isProcessing) return;

    if (isDraftExpired(draftParse)) {
      setDraftParse(null);
      setDraftTriggerMessageId(null);
      setDraftPendingMessageId(null);
      clearPersistedDraft();
      showNotice(t('logger.preview_expired'), 'error');
      return;
    }

    if (draftParse.parsed.intent === 'plan' && draftParse.parsed.plan?.timeValidation) {
      showNotice(draftParse.parsed.plan.timeValidation.message, 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const parsed = draftParse.parsed;

      if (parsed.intent === 'plan' && parsed.plan) {
        if (isGuest) {
          showNotice(t('plans.login_required'), 'error');
          return;
        }

        const createdPlan = await onCreatePlan({
          title: parsed.plan.title || inputText,
          notes: parsed.plan.notes,
          planType: parsed.plan.planType,
          source: 'ai',
          startAt: parsed.plan.startAt ?? null,
          endAt: parsed.plan.endAt ?? null,
          dueAt: parsed.plan.dueAt ?? null,
          isAllDay: parsed.plan.isAllDay ?? false,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          reminderAt: parsed.plan.reminderAt ?? null,
          syncTarget: parsed.plan.syncTargetSuggestion || 'none',
          metadata: {
            originalText: draftParse.originalText,
            location: currentLocation || null,
            images: uploadedImages
          }
        });

        if (draftPendingMessageId) {
          await onDeleteChatMessages([draftPendingMessageId]);
        }

        const confirmationTimestamp = Date.now();

        void onCreateChatMessage({
          id: generateUUID(),
          role: 'assistant',
          content: t('logger.chat_saved_plan', { title: parsed.plan.title || inputText }),
          messageType: 'confirmation',
          timestamp: confirmationTimestamp,
          metadata: {
            kind: 'plan',
            undoEntityType: 'plan',
            undoEntityId: createdPlan?.id,
            undoUserMessageId: draftTriggerMessageId,
            undoExpiresAt: confirmationTimestamp + UNDO_WINDOW_MS
          }
        });

        resetComposerState();
        setDraftPendingMessageId(null);
        setDraftTriggerMessageId(null);
        showNotice(t('plans.created_from_text'), 'success');
        return;
      }

      // 生成统一的 ID，确保 Log 和 Finance 使用同一个 ID 关联
      const newLogId = generateUUID();

      // 自动保存财务记录
      if (parsed.finance && parsed.finance.length > 0) {
        try {
          // 关联 logId 并创建财务记录
          await Promise.all(parsed.finance.map(f => createFinanceRecord({ ...f, logId: newLogId })));
        } catch (e) {
          console.error("Finance create failed", e);
        }
      }

      const newEntry: LogEntry = {
        id: newLogId,
        userId, 
        timestamp: Date.now(),
        rawText: draftParse.originalText,
        activity: parsed.activity || draftParse.originalText,
        category: (parsed.category as any) || 'Other',
        durationMinutes: parsed.durationMinutes || 0,
        mood: parsed.mood || '平静',
        importance: parsed.importance || 3,
        location: currentLocation,
        images: uploadedImages
      };

      await onAddLog(newEntry);
      if (draftPendingMessageId) {
        await onDeleteChatMessages([draftPendingMessageId]);
      }
      const confirmationTimestamp = Date.now();
      void onCreateChatMessage({
        id: generateUUID(),
        role: 'assistant',
        content: parsed.finance && parsed.finance.length > 0
          ? t('logger.chat_saved_finance', { count: parsed.finance.length, activity: parsed.activity || draftParse.originalText })
          : t('logger.thread_saved_format', { activity: parsed.activity || draftParse.originalText }),
        messageType: 'confirmation',
        timestamp: confirmationTimestamp,
        metadata: {
          kind: parsed.finance && parsed.finance.length > 0 ? 'finance' : 'log',
          undoEntityType: 'log',
          undoEntityId: newLogId,
          undoUserMessageId: draftTriggerMessageId,
          undoExpiresAt: confirmationTimestamp + UNDO_WINDOW_MS
        }
      });
      resetComposerState();
      setDraftPendingMessageId(null);
      setDraftTriggerMessageId(null);
    } catch (e) {
      console.error(e);
      showNotice(e instanceof Error ? e.message : t('logger.parse_failed', '解析失败，已按普通记录保存'), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestorePendingDraft = (draftData: NonNullable<ReturnType<typeof buildDraftPreview>>) => {
    if (isDraftExpired(draftData)) {
      showNotice(t('logger.preview_expired'), 'error');
      return;
    }

    persistUnconfirmedDraft(draftData);
    setDraftParse(draftData);
    setShowInlineKeyboard(false);
    onOpenComposer();
    // 滚动到输入区域
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  };

  const handleUndoConfirmation = async (message: ChatMessage) => {
    const undoEntityType = typeof message.metadata?.undoEntityType === 'string' ? message.metadata.undoEntityType : null;
    const undoEntityId = typeof message.metadata?.undoEntityId === 'string' ? message.metadata.undoEntityId : null;
    const undoUserMessageId = typeof message.metadata?.undoUserMessageId === 'string' ? message.metadata.undoUserMessageId : null;
    const undoExpiresAt = Number(message.metadata?.undoExpiresAt || 0);

    if (!undoEntityType || !undoEntityId || undoExpiresAt <= Date.now()) {
      showNotice(t('logger.undo_expired'), 'error');
      return;
    }

    try {
      if (undoEntityType === 'plan') {
        await onDeletePlan(undoEntityId);
      }

      if (undoEntityType === 'log') {
        await deleteFinanceRecordsByLogId(undoEntityId);
        await onDeleteLog(undoEntityId);
      }

      await onDeleteChatMessages([message.id, undoUserMessageId].filter(Boolean) as string[]);
      showNotice(t('logger.undo_success'), 'success');
    } catch (error) {
      console.error(error);
      showNotice(t('logger.undo_failed'), 'error');
    }
  };

  const handleUndoUserMessage = async (messageId: string) => {
    const startIndex = recentChatMessages.findIndex((message) => message.id === messageId);
    if (startIndex === -1) {
      showNotice(t('logger.undo_failed'), 'error');
      return;
    }

    const affectedMessages = recentChatMessages.slice(startIndex);
    const expired = affectedMessages[0]?.timestamp + UNDO_WINDOW_MS <= Date.now();
    if (expired) {
      showNotice(t('logger.undo_expired'), 'error');
      return;
    }

    try {
      const confirmationMessages = affectedMessages.filter(
        (message) => message.role === 'assistant' && message.messageType === 'confirmation'
      );

      for (const confirmationMessage of confirmationMessages) {
        const undoEntityType = typeof confirmationMessage.metadata?.undoEntityType === 'string'
          ? confirmationMessage.metadata.undoEntityType
          : null;
        const undoEntityId = typeof confirmationMessage.metadata?.undoEntityId === 'string'
          ? confirmationMessage.metadata.undoEntityId
          : null;

        if (!undoEntityType || !undoEntityId) continue;

        if (undoEntityType === 'plan') {
          await onDeletePlan(undoEntityId);
        }

        if (undoEntityType === 'log') {
          await deleteFinanceRecordsByLogId(undoEntityId);
          await onDeleteLog(undoEntityId);
        }
      }

      if (draftTriggerMessageId === messageId) {
        setDraftParse(null);
        setDraftTriggerMessageId(null);
        setDraftPendingMessageId(null);
        clearPersistedDraft();
      }

      await onDeleteChatMessages(affectedMessages.map((message) => message.id));
      showNotice(t('logger.undo_success'), 'success');
    } catch (error) {
      console.error(error);
      showNotice(t('logger.undo_failed'), 'error');
    }
  };

  const handleCancelDraft = () => {
    const messageIdsToDelete: string[] = [];
    if (draftTriggerMessageId) {
      messageIdsToDelete.push(draftTriggerMessageId);
    }
    if (draftPendingMessageId) {
      messageIdsToDelete.push(draftPendingMessageId);
    }
    if (messageIdsToDelete.length > 0) {
      onDeleteChatMessages(messageIdsToDelete);
    }
    setDraftParse(null);
    setDraftTriggerMessageId(null);
    setDraftPendingMessageId(null);
    clearPersistedDraft();
  };

  const handleQuickCompose = (text?: string) => {
    // First cancel the current draft to remove trigger and pending messages
    if (draftParse) {
      const messageIdsToDelete: string[] = [];
      if (draftTriggerMessageId) {
        messageIdsToDelete.push(draftTriggerMessageId);
      }
      if (draftPendingMessageId) {
        messageIdsToDelete.push(draftPendingMessageId);
      }
      if (messageIdsToDelete.length > 0) {
        onDeleteChatMessages(messageIdsToDelete);
      }
      setDraftParse(null);
      setDraftTriggerMessageId(null);
      setDraftPendingMessageId(null);
      clearPersistedDraft();
    }

    setComposerMode('chat');
    setInputText(text || '');

    setShowInlineKeyboard(true);
    onCloseComposer();
  };

  const handleOpenRecordAdd = () => {
    setSidebarTab('record-add');
    setShowGoalDrawer(true);
  };

  const handleOpenRecordAddComposer = () => {
    setComposerMode('record-add');
    setShowGoalDrawer(false);
    onOpenComposer();
  };

  const handleTimelineTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  };

  const handleTimelineTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (startX === null || startY === null) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    if (Math.abs(deltaY) > 60 || Math.abs(deltaX) < 70) return;

    if (!showTimelineDrawer && startX >= window.innerWidth - 56 && deltaX < -70) {
      setShowTimelineDrawer(true);
      return;
    }

    if (!showTimelineDrawer && deltaX < -110) {
      setShowTimelineDrawer(true);
      return;
    }

    if (showTimelineDrawer && deltaX > 70) {
      setShowTimelineDrawer(false);
    }
  };

  const handleImageFlowAction = async () => {
    if (imageDirectAnalyze) {
      await analyzeTextInput(t('logger.image_direct_prompt'));
      return;
    }

    handleQuickCompose('');
  };

  const handleCloseComposer = () => {
    if (isProcessing) return;
    setDraftParse(null);
    clearPersistedDraft();
    onCloseComposer();
  };

  const resetComposerState = () => {
    setInputText('');
    setUploadedImages([]);
    setCurrentLocation(undefined);
    setDraftParse(null);
    clearPersistedDraft();
    setShowInlineKeyboard(false);
    onCloseComposer();
  };

  return (
    <>
      <NoticeToast
        open={Boolean(notice)}
        message={notice?.message || ''}
        tone={notice?.tone || 'info'}
        onClose={() => setNotice(null)}
      />
      <div
        className="relative flex h-full min-h-full flex-col animate-in fade-in slide-in-from-bottom-4 duration-500"
        onTouchStart={handleTimelineTouchStart}
        onTouchEnd={handleTimelineTouchEnd}
      >
      <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />

      <div className="flex-1 px-4 pb-44 pt-2 sm:pb-40">
        <div className="space-y-4">
          <div className="space-y-3">
            {(hasMoreChatMessages || isLoadingOlderChatMessages) && (
              <div ref={chatLoadTopRef} className="flex justify-center py-2">
                {isLoadingOlderChatMessages ? (
                  <div className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200 shadow-sm">
                    {t('logger.loading_previous_messages', '正在加载更早对话...')}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestOlderChatMessages}
                    className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200 shadow-sm transition-colors hover:text-slate-700"
                  >
                    {t('logger.pull_up_for_history', '上滑可加载更早对话')}
                  </button>
                )}
              </div>
            )}

            <div className="flex justify-start">
              <div className="max-w-[84%] rounded-[1.6rem] rounded-bl-md bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm ring-1 ring-slate-200">
                {t('logger.chat_assistant_intro')}
              </div>
            </div>

            {shouldShowFloatingSuggestion && suggestion && (
              <div className="pointer-events-none sticky top-2 z-[19] h-0 overflow-visible px-1">
                <div className="pointer-events-auto mx-auto w-full max-w-[400px]">
                  <div className="rounded-[1.6rem] border border-amber-200/80 bg-amber-50/95 px-4 py-3 shadow-xl shadow-amber-100/70 backdrop-blur-md">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-xl">
                        {suggestion.type === 'health' ? '🌿' : suggestion.type === 'productivity' ? '🚀' : suggestion.type === 'work_life_balance' ? '⚖️' : '💡'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">{t('logger.smart_suggestion')}</p>
                            <p className="mt-1 text-sm font-medium leading-snug text-slate-700">{suggestion.content}</p>
                          </div>
                          <button
                            type="button"
                            onClick={handleDismissSuggestion}
                            className="rounded-full p-1 text-slate-300 transition-colors hover:text-slate-500"
                            aria-label={t('common.cancel', '关闭')}
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {recentChatMessages.map((message, index: number) => {
              const prevMessage = index > 0 ? recentChatMessages[index - 1] : null;
              const showTimeLabel = index === 0 ||
                (prevMessage && shouldShowTimeLabel(prevMessage.timestamp, message.timestamp));

              return (
                <React.Fragment key={message.id}>
                  {showTimeLabel && (
                    <div className="flex justify-center">
                      <span className="text-xs text-slate-400">{formatMessageTime(message.timestamp)}</span>
                    </div>
                  )}
                  <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={message.role === 'user'
                      ? 'max-w-[82%] rounded-[1.6rem] rounded-br-md bg-amber-400 px-4 py-3 text-left text-sm font-medium leading-relaxed text-slate-950 shadow-sm'
                      : 'max-w-[86%] rounded-[1.6rem] rounded-bl-md bg-[#fffaf0] px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm ring-1 ring-amber-100'}>
                      {message.role === 'assistant' && message.messageType === 'confirmation' && (
                        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
                          {t('logger.thread_saved_label')}
                        </div>
                      )}
                      <div className={message.role === 'assistant' && message.messageType === 'confirmation' ? 'mt-1' : ''}>
                        {message.content}
                      </div>
                      {message.role === 'user' && latestUndoableUserMessageId === message.id && (
                        <div className="mt-3 flex items-center justify-end gap-2">
                          <span className="text-[11px] text-slate-800/70">
                            {t('logger.undo_available_window')}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleUndoUserMessage(message.id)}
                            className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-amber-200 transition-colors hover:text-red-600 hover:ring-red-200"
                          >
                            {t('logger.undo_latest_message')}
                          </button>
                        </div>
                      )}
                      {message.role === 'assistant' && message.messageType === 'confirmation' && latestUndoableConfirmationId === message.id && (
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleUndoConfirmation(message)}
                            className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-amber-200 transition-colors hover:text-red-600 hover:ring-red-200"
                          >
                            {t('logger.undo_latest_record')}
                          </button>
                          <span className="text-[11px] text-slate-400">
                            {t('logger.undo_available_window')}
                          </span>
                        </div>
                      )}
                      {message.role === 'assistant' && message.metadata?.kind === 'pending_preview' && message.metadata?.draftData && (() => {
                        const draftData = message.metadata.draftData as ReturnType<typeof buildDraftPreview>;
                        const isExpanded = expandedPendingMessageId ? expandedPendingMessageId === message.id : message.id === latestPendingPreviewId;
                        const isExpired = isDraftExpired(draftData, currentTime);
                        return (
                          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedPendingMessageId((currentId) => currentId === message.id ? null : message.id);
                              }}
                              className="w-full px-3 py-2 flex items-center justify-between text-left"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
                                  {t('logger.preview_label')}
                                </span>
                                <span className="text-xs text-slate-500">{draftData.summary}</span>
                              </div>
                              <svg
                                className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {isExpanded && (
                              <div className="px-3 pb-3 border-t border-amber-100">
                                <div className="pt-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">
                                        {t(`logger.preview_kind.${draftData.kind}`)}
                                      </p>
                                      <p className="mt-1 text-sm text-slate-600">{draftData.summary}</p>
                                    </div>
                                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-amber-200 shrink-0">
                                      {isExpired ? t('logger.preview_expired') : t('logger.preview_ready')}
                                    </span>
                                  </div>
                                  {draftData.meta.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {draftData.meta.map((item: string) => (
                                        <span key={item} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {draftData.kind === 'plan' && draftData.parsed.plan?.timeValidation && (
                                    <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                      <p className="font-bold uppercase tracking-[0.18em]">
                                        {t('logger.plan_time_warning_label')}
                                      </p>
                                      <p className="mt-1 leading-relaxed">{draftData.parsed.plan.timeValidation.message}</p>
                                    </div>
                                  )}
                                  <div className="mt-3 flex items-center justify-between gap-2">
                                    <span className="text-[11px] text-slate-500">
                                      {isExpired ? t('logger.preview_expired') : t('logger.preview_available_window')}
                                    </span>
                                    {!isExpired && (
                                      <button
                                        type="button"
                                        onClick={() => handleRestorePendingDraft(draftData)}
                                        disabled={isProcessing}
                                        className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                                      >
                                        {t('logger.retry_confirm')}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            {!isComposerOpen && draftParse && (
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-[1.6rem] rounded-bl-md border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-slate-700 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">
                        {t('logger.preview_label')}
                      </p>
                      <h4 className="mt-1 text-base font-black text-slate-900">
                        {t(`logger.preview_kind.${draftParse.kind}`)}
                      </h4>
                      <p className="mt-1 leading-relaxed text-slate-600">
                        {draftParse.summary}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-500 ring-1 ring-amber-200">
                      {t('logger.preview_ready')}
                    </span>
                  </div>

                  {draftParse.meta.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {draftParse.meta.map((item) => (
                        <span key={item} className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}

                  {currentDraftTimeValidation && (
                    <div className="mt-3 rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-700">
                        {t('logger.plan_time_warning_label')}
                      </p>
                      <p className="mt-1 leading-relaxed">{currentDraftTimeValidation.message}</p>
                      {currentDraftTimeValidation.suggestedPlan && (
                        <button
                          type="button"
                          onClick={() => handleApplyDraftTimeSuggestion(draftParse)}
                          disabled={isProcessing || isCurrentDraftExpired}
                          className="mt-3 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {t('logger.plan_time_adjust_cta')}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    <span className="flex items-center text-[11px] text-slate-500">
                      {isCurrentDraftExpired ? t('logger.preview_expired') : t('logger.preview_available_window')}
                    </span>
                    <button
                      type="button"
                      onClick={handleConfirmDraft}
                      disabled={isProcessing || isCurrentDraftExpired || Boolean(currentDraftTimeValidation)}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {t('logger.confirm_save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUndoConfirm(true)}
                      disabled={isProcessing}
                      className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-400 ring-1 ring-slate-200 hover:text-red-500 hover:ring-red-200 disabled:opacity-60"
                    >
                      {t('logger.cancel_draft')}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {uploadedImages.length > 0 && (
              <>
                <div className="flex justify-end">
                  <div className="max-w-[86%] rounded-[1.6rem] rounded-br-md bg-white px-3 py-3 shadow-sm ring-1 ring-slate-200">
                    <div className="grid grid-cols-3 gap-2">
                      {uploadedImages.map((url, idx) => (
                        <div key={idx} className="relative overflow-hidden rounded-xl bg-slate-100">
                          <img src={url} alt="Uploaded" className="h-24 w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setUploadedImages((prev) => prev.filter((_, imageIndex) => imageIndex !== idx))}
                            className="absolute right-1 top-1 rounded-full bg-black/55 p-1 text-white"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-start">
                  <div className="max-w-[88%] rounded-[1.6rem] rounded-bl-md bg-[#fffaf0] px-4 py-3 text-sm text-slate-700 shadow-sm ring-1 ring-amber-100">
                    <label className="flex items-center gap-2 font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={imageDirectAnalyze}
                        onChange={(event) => setImageDirectAnalyze(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-300"
                      />
                      {t('logger.image_direct_toggle')}
                    </label>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      {imageDirectAnalyze ? t('logger.image_direct_hint') : t('logger.image_describe_hint')}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleImageFlowAction()}
                        className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white"
                      >
                        {imageDirectAnalyze ? t('logger.image_direct_action') : t('logger.image_describe_action')}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div ref={chatBottomRef} className="h-px scroll-mb-28" />
          </div>
        </div>
      </div>

      {recentConversation.length > 0 && !showTimelineDrawer && (
        <button
          type="button"
          onClick={() => setShowTimelineDrawer(true)}
          className="fixed right-0 top-1/2 z-30 -translate-y-1/2 rounded-l-2xl border border-r-0 border-amber-200 bg-white/95 px-2 py-4 text-[11px] font-bold tracking-[0.2em] text-amber-700 shadow-lg shadow-amber-100/60 backdrop-blur"
          aria-label={t('logger.record_stream_open', '打开最近记录时间线')}
        >
          {t('logger.record_stream_tab', '记录')}
        </button>
      )}

      {showTimelineDrawer && (
        <div className="fixed inset-0 z-[88]">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px]" onClick={() => setShowTimelineDrawer(false)} />
          <aside className="absolute right-0 top-0 h-full w-[86%] max-w-[380px] overflow-y-auto border-l border-slate-200 bg-white shadow-2xl animate-in slide-in-from-right duration-300" style={buildSafeAreaPaddingStyle({ bottom: '1rem' })}>
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 pb-4 backdrop-blur-sm" style={drawerHeaderSafeStyle}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    {t('logger.record_stream_label', '最近记录')}
                  </p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                    {t('logger.record_timeline_title', '生活时间线')}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {t('logger.record_timeline_desc', '右侧抽屉只展示已经保存的记录，和聊天区分开。')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTimelineDrawer(false)}
                  className="rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="px-5 py-5">
              <div className="space-y-6">
                {timelineGroups.map((group) => (
                  <section key={group.key} className="space-y-4">
                    <div className="sticky z-[1] -mx-1 px-1 py-1" style={timelineGroupStickySafeStyle}>
                      <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 ring-1 ring-slate-200">
                        {group.key === 'today'
                          ? t('logger.timeline_group_today', '今天')
                          : group.key === 'yesterday'
                            ? t('logger.timeline_group_yesterday', '昨天')
                            : t('logger.timeline_group_earlier', '更早')}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {group.items.map((log, index) => (
                        <div key={log.id} className="relative pl-8">
                          <div className="absolute left-[11px] top-0 h-full w-px bg-amber-100"></div>
                          <div className="absolute left-0 top-2 h-6 w-6 rounded-full border-4 border-white bg-amber-400 shadow-sm"></div>
                          <div className="rounded-[1.5rem] bg-[#fffaf0] px-4 py-4 ring-1 ring-amber-100 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
                                {new Date(log.timestamp).toLocaleString(i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
                                {index + 1}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800">
                              {log.rawText}
                            </p>
                            <p className="mt-2 text-sm leading-relaxed text-slate-500">
                              {t('logger.thread_saved_format', { activity: log.activity })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}

      {showGoalDrawer && (
        <div className="fixed inset-0 z-[85]">
          <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px]" onClick={() => setShowGoalDrawer(false)} />
          <aside className="absolute left-0 top-0 h-full w-[88%] max-w-[360px] overflow-y-auto bg-white shadow-2xl ring-1 ring-slate-200 animate-in slide-in-from-left duration-300" style={buildSafeAreaPaddingStyle({ bottom: '1rem' })}>
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 pb-4 backdrop-blur-sm" style={drawerHeaderSafeStyle}>
              <div className="mb-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  {t('logger.sidebar_menu_title')}
                </p>
                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => setSidebarTab('record-add')}
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-colors ${sidebarTab === 'record-add' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    <span>
                      <span className="block text-sm font-bold">{t('logger.record_add_label')}</span>
                      <span className={`mt-1 block text-xs ${sidebarTab === 'record-add' ? 'text-slate-300' : 'text-slate-500'}`}>{t('logger.record_add_hint')}</span>
                    </span>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  </button>

                  {!isGuest && (
                    <button
                      type="button"
                      onClick={() => setSidebarTab('goals')}
                      className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-colors ${sidebarTab === 'goals' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
                    >
                      <span>
                        <span className="block text-sm font-bold">{t('logger.goal_drawer_label')}</span>
                        <span className={`mt-1 block text-xs ${sidebarTab === 'goals' ? 'text-amber-100' : 'text-amber-700/80'}`}>{focusGoal ? t('logger.goal_drawer_goal_hint', { count: activeGoals.length }) : t('logger.goal_drawer_empty_hint')}</span>
                      </span>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
                    {sidebarTab === 'goals' ? t('logger.goal_drawer_label') : t('logger.record_add_label')}
                  </p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                    {sidebarTab === 'goals' ? t('goals.analytics_title') : t('logger.record_add_title')}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {sidebarTab === 'goals'
                      ? (focusGoal ? t('logger.goal_drawer_focus_desc', { title: focusGoal.title }) : t('logger.goal_drawer_manage_desc'))
                      : t('logger.record_add_panel_desc')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGoalDrawer(false)}
                  className="rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {sidebarTab === 'goals' ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-amber-100">
                    {t('logger.goal_drawer_active_count', { count: activeGoals.length })}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200">
                    {t('logger.goal_drawer_failed_count', { count: interruptedGoalsCount })}
                  </span>
                  {rewardProfile && (
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200">
                      {t('rewards.points_value', { count: rewardProfile.availablePoints })}
                    </span>
                  )}
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleOpenRecordAddComposer}
                    className="rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-white"
                  >
                    {t('logger.record_add_open_full')}
                  </button>
                </div>
              )}
            </div>

            <div className="px-4 py-4">
              {sidebarTab === 'goals' ? (
                <GoalPlanner
                  goals={goals}
                  logsCount={logs.length}
                  isGoalActionLoading={isGoalActionLoading}
                  onCreateGoal={onCreateGoal}
                  onPauseGoal={onPauseGoal}
                  onResumeGoal={onResumeGoal}
                  onSetPrimaryGoal={onSetPrimaryGoal}
                  onDeleteGoal={onDeleteGoal}
                />
              ) : (
                <div className="space-y-4 rounded-[1.5rem] border border-slate-200 bg-[#fffaf0] p-4">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t('logger.record_add_keep_tools')}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">{t('logger.record_add_keep_tools_desc')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={captureLocation}
                    disabled={isGettingLocation}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition-colors ${currentLocation ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {currentLocation ? currentLocation.name : t('logger.record_add_location_action')}
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenRecordAddComposer}
                    className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
                  >
                    {t('logger.record_add_open_full')}
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-20 flex justify-center px-3">
        <div className="pointer-events-auto w-full max-w-[400px] px-1">
          <div className="rounded-[2rem] border border-slate-200 bg-white/92 px-3 py-3 shadow-2xl shadow-slate-200/70 backdrop-blur-xl">
            {isListening && (
              <div className="mb-3 rounded-[1.4rem] border border-red-100 bg-red-50 px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-500">
                      {i18n.language.startsWith('zh') ? '正在录音' : 'Listening'}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-700">
                      {inputText || (i18n.language.startsWith('zh') ? '请继续说，松开发送。' : 'Keep speaking, release to send.')}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-red-500 ring-1 ring-red-100">
                    {i18n.language.startsWith('zh') ? '松开发送' : 'Release to send'}
                  </span>
                </div>
              </div>
            )}

            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isListening}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100/95 text-slate-500 ring-1 ring-slate-200 transition-colors hover:bg-slate-50 hover:text-amber-700"
                title={t('logger.camera_or_upload')}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h4l2-2h6l2 2h4v11a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 16a3 3 0 100-6 3 3 0 000 6z" /></svg>
              </button>
              {showInlineKeyboard ? (
                <form
                  onSubmit={handleSubmit}
                  onClick={handleInlineInputContainerPress}
                  onTouchEnd={handleInlineInputContainerPress}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-3 py-1.5 ring-1 ring-slate-200"
                >
                  <input
                    ref={inlineInputRef}
                    type="text"
                    value={inputText}
                    onChange={(event) => setInputText(event.target.value)}
                    placeholder={t('logger.placeholder')}
                    inputMode="text"
                    enterKeyHint="send"
                    autoCapitalize="sentences"
                    autoCorrect="on"
                    autoComplete="off"
                    spellCheck={false}
                    lang={i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US'}
                    className="min-w-0 flex-1 border-none bg-transparent px-1 py-2 text-base text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || isProcessing}
                    className="rounded-full bg-amber-500 p-2.5 text-slate-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isProcessing ? (
                      <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onTouchStart={startVoiceInput}
                  onMouseDown={startVoiceInput}
                  className={`flex-1 rounded-full px-5 py-3 text-sm font-bold transition-colors touch-none select-none ${isListening ? 'bg-red-500 text-white' : 'bg-amber-500 text-white hover:bg-amber-400'}`}
                >
                  {isListening
                    ? (i18n.language.startsWith('zh') ? '松开发送' : 'Release to send')
                    : (i18n.language.startsWith('zh') ? '按住说话' : 'Hold to talk')}
                </button>
              )}
              <button
                type="button"
                onClick={showInlineKeyboard ? handleSwitchToVoiceInput : handleOpenInlineKeyboard}
                disabled={isListening}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${isListening ? 'bg-red-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                title={showInlineKeyboard ? t('logger.voice_input') : t('logger.keyboard_input')}
              >
                {showInlineKeyboard ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18.5a3.5 3.5 0 003.5-3.5V8a3.5 3.5 0 10-7 0v7a3.5 3.5 0 003.5 3.5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11.5a7 7 0 01-14 0" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18.5v3" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12h.01M10 12h.01M13 12h.01M16 12h.01M7 15h10" /></svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isComposerOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4" style={centeredModalSafeStyle}>
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={handleCloseComposer} />
          <div className="relative z-10 w-full max-h-[88vh] overflow-y-auto rounded-t-[2rem] border border-slate-100 bg-[#fffaf0] shadow-2xl sm:max-w-xl sm:rounded-[2rem]" style={composerSheetStyle}>
            <div className="sticky top-0 rounded-t-[2rem] border-b border-slate-100 bg-[#fffaf0]/95 px-5 pt-5 pb-4 backdrop-blur-sm" style={composerHeaderSafeStyle}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
                    {t('logger.launcher_label')}
                  </p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                    {t('logger.modal_title')}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                    {t('logger.modal_desc')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseComposer}
                  className="p-2 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-[1.5rem] rounded-bl-md bg-slate-900 px-4 py-3 text-sm leading-relaxed text-white shadow-sm">
                  {t('logger.chat_assistant_modal_intro')}
                </div>
              </div>

              <div className="relative rounded-[2rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm transition-shadow hover:shadow-md">
                <textarea
                  ref={textareaRef}
                  autoFocus
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    if (draftParse) {
                      setDraftParse(null);
                    }
                  }}
                  onFocus={() => focusTextControl(textareaRef.current)}
                  placeholder={t('logger.placeholder')}
                  enterKeyHint="send"
                  autoCapitalize="sentences"
                  autoCorrect="on"
                  className="min-h-[140px] w-full resize-none rounded-[1.5rem] border-none bg-transparent pb-12 text-lg text-slate-800 placeholder:text-slate-400 focus:ring-0"
                />

                {draftParse && (
                  <div className="mb-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">
                          {t('logger.preview_label')}
                        </p>
                        <h4 className="mt-1 text-base font-black text-slate-900">
                          {t(`logger.preview_kind.${draftParse.kind}`)}
                        </h4>
                        <p className="mt-1 leading-relaxed text-slate-600">
                          {draftParse.summary}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-500 ring-1 ring-amber-200">
                        {t('logger.preview_ready')}
                      </span>
                    </div>

                    {draftParse.meta.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {draftParse.meta.map((item) => (
                          <span key={item} className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                            {item}
                          </span>
                        ))}
                      </div>
                    )}

                    {currentDraftTimeValidation && (
                      <div className="mt-3 rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-700">
                          {t('logger.plan_time_warning_label')}
                        </p>
                        <p className="mt-1 leading-relaxed">{currentDraftTimeValidation.message}</p>
                        {currentDraftTimeValidation.suggestedPlan && (
                          <button
                            type="button"
                            onClick={() => handleApplyDraftTimeSuggestion(draftParse)}
                            disabled={isProcessing || isCurrentDraftExpired}
                            className="mt-3 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {t('logger.plan_time_adjust_cta')}
                          </button>
                        )}
                      </div>
                    )}

                    <div className="mt-4 flex gap-2">
                      <span className="flex items-center text-[11px] text-slate-500">
                        {isCurrentDraftExpired ? t('logger.preview_expired') : t('logger.preview_available_window')}
                      </span>
                      <button
                        type="button"
                        onClick={handleConfirmDraft}
                        disabled={isProcessing || isCurrentDraftExpired || Boolean(currentDraftTimeValidation)}
                        className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t('logger.confirm_save')}
                      </button>
                    </div>
                  </div>
                )}

                {(uploadedImages.length > 0 || currentLocation) && composerMode === 'record-add' && (
                  <div className="flex flex-wrap gap-2 mb-4 px-1">
                    {uploadedImages.map((url, idx) => (
                      <div key={idx} className="relative group w-14 h-14 rounded-xl overflow-hidden border border-slate-100 shadow-sm">
                        <img src={url} alt="Uploaded" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setUploadedImages(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                    {currentLocation && (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-full border border-emerald-100 animate-fade-in max-w-full">
                        <svg className="w-3.5 h-3.5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        <span className="truncate">{currentLocation.name}</span>
                        <button type="button" onClick={() => setCurrentLocation(undefined)} className="hover:text-emerald-900 ml-1 flex-none text-sm leading-none">×</button>
                      </div>
                    )}
                  </div>
                )}

                <div className="-mx-5 -mb-5 flex items-center justify-between rounded-b-[2rem] border-t border-slate-100 bg-slate-50 px-5 py-3">
                  {composerMode === 'record-add' ? (
                  <div className="flex items-center gap-2 relative overflow-x-auto no-scrollbar flex-1 mr-2 py-1">
                    <button 
                      type="button"
                      onTouchStart={startVoiceInput}
                      onMouseDown={startVoiceInput}
                      className={`flex-none p-2.5 rounded-xl transition-all ${
                        isListening 
                          ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-100' 
                          : voiceErrorType === 'permission' 
                            ? 'bg-red-50 text-red-400' 
                            : 'bg-white text-slate-500 hover:text-amber-700 hover:bg-white shadow-sm border border-slate-100'
                      }`}
                      title={isListening ? (i18n.language.startsWith('zh') ? '松开发送' : 'Release to send') : (i18n.language.startsWith('zh') ? '按住说话' : 'Hold to talk')}
                    >
                      <svg className="w-5 h-5 flex-none" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className={`flex-none p-2.5 rounded-xl bg-white text-slate-500 hover:text-amber-700 shadow-sm border border-slate-100 transition-all ${isUploading ? 'animate-pulse' : ''}`}
                      title={t('logger.upload_image')}
                    >
                      {isUploading ? (
                        <svg className="w-5 h-5 animate-spin flex-none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      ) : (
                        <svg className="w-5 h-5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={captureLocation}
                      disabled={isGettingLocation}
                      className={`flex-none p-2.5 rounded-xl transition-all shadow-sm border border-slate-100 ${currentLocation ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-white text-slate-500 hover:text-amber-700 transition-colors'} ${isGettingLocation ? 'animate-bounce' : ''}`}
                      title={t('logger.capture_location')}
                    >
                      <svg className="w-5 h-5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>

                    {isWeChat && (
                      <button
                        type="button"
                        onClick={() => setShowShareOverlay(true)}
                        className="flex-none p-2.5 rounded-xl bg-white text-slate-500 hover:text-amber-700 shadow-sm border border-slate-100 transition-all"
                        title={t('logger.share')}
                      >
                        <svg className="w-5 h-5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </button>
                    )}

                    {voiceErrorType && (
                      <div className="absolute top-full left-0 mt-2 w-max max-w-[200px] bg-red-50 text-red-500 text-xs p-2 rounded-lg border border-red-100 shadow-sm z-10 animate-in fade-in zoom-in-95 duration-200">
                        <p className="font-bold mb-1">{t('logger.voice_error_title')}</p>
                        {isWeChat ? (
                          wxReady ? (
                            <span>{t('logger.wechat_error')}</span>
                          ) : (
                            <span>{t('logger.wechat_hint')}</span>
                          )
                        ) : voiceErrorType === 'unsupported' ? (
                          <span>{t(isNativeIos ? 'logger.voice_ios_hint' : 'logger.voice_unsupported_hint')}</span>
                        ) : (
                          <span>{t('logger.browser_voice_hint')}</span>
                        )}
                      </div>
                    )}
                  </div>
                  ) : (
                    <div className="flex-1 pr-3 text-xs leading-relaxed text-slate-500">
                      {t('logger.keyboard_mode_hint')}
                    </div>
                  )}

                  <div className="relative flex-none">
                    <button
                      onClick={handleSubmit}
                      disabled={!inputText.trim() || isProcessing || Boolean(draftParse)}
                      className={`whitespace-nowrap rounded-full px-6 py-3 font-bold transition-all ${
                        isProcessing ? 'cursor-wait bg-slate-400 text-white' : 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-200 hover:bg-amber-400 active:scale-95'
                      }`}
                    >
                      {isProcessing ? t('logger.processing') : t('logger.submit')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 微信分享引导蒙层 */}
      {showShareOverlay && (
        <div 
          className="fixed inset-0 z-[100] flex flex-col items-center justify-start bg-black/90 animate-in fade-in duration-200"
          style={shareOverlaySafeStyle}
          onClick={() => setShowShareOverlay(false)}
        >
          {/* 指示箭头 */}
          <div className="absolute flex flex-col items-end text-white" style={shareArrowSafeStyle}>
             {/* 修正箭头的 SVG 路径，使其更形象地指向右上角菜单 */}
             <svg className="w-16 h-16 animate-bounce text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 5h7m0 0v7m0-7L8 14" />
             </svg>
             <div className="mt-2 text-right bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20">
               <p className="text-lg font-bold">{t('logger.share_overlay.click_menu')}</p>
               <p className="text-xs opacity-80 mt-1">{t('logger.share_overlay.select_friend')}</p>
               <div className="flex gap-2 mt-2 justify-end">
                   <div className="w-8 h-8 rounded bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                   </div>
               </div>
             </div>
          </div>
          
          <div className="text-white text-center px-10 mt-32">
            <div className="w-20 h-20 bg-amber-500 text-slate-950 rounded-2xl mx-auto mb-6 shadow-2xl shadow-amber-300/30 flex items-center justify-center">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
            </div>
            <h3 className="text-2xl font-bold mb-4 tracking-tight">{t('logger.share_overlay.title')}</h3>
            <p className="mb-12 text-white/60 leading-relaxed text-sm whitespace-pre-line">
              {t('logger.share_overlay.desc')}
            </p>
            <button className="px-8 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white font-medium hover:bg-white/20 transition-colors active:scale-95">
              {t('logger.share_overlay.button')}
            </button>
          </div>
        </div>
      )}

      {/* 游客限制弹窗 */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" style={centeredModalSafeStyle}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">{t('common.guest_limit_title')}</h3>
            <p className="text-slate-600 mb-6">
              {t('common.guest_limit_desc')}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={onLogout}
                className="w-full py-3 bg-amber-500 text-slate-950 rounded-xl font-bold hover:bg-amber-400 transition-colors"
              >
                {t('common.login_register')}
              </button>
              <button
                onClick={() => setShowLimitModal(false)}
                className="w-full py-3 text-slate-400 font-medium hover:text-slate-600 transition-colors"
              >
                {t('common.cancel_view')}
              </button>
            </div>
          </div>
        </div>
      )}
      {showUndoConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" style={centeredModalSafeStyle}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">{t('logger.undo_confirm_title')}</h3>
            <p className="text-slate-600 mb-6">
              {t('logger.undo_confirm_desc')}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowUndoConfirm(false);
                  handleCancelDraft();
                }}
                className="w-full py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
              >
                {t('logger.undo_confirm_yes')}
              </button>
              <button
                onClick={() => setShowUndoConfirm(false)}
                className="w-full py-3 text-slate-400 font-medium hover:text-slate-600 transition-colors"
              >
                {t('logger.undo_confirm_no')}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

const getPreviewPlanTimestamp = (plan: NonNullable<Awaited<ReturnType<typeof parseLifeLog>>['plan']>) => {
  return plan.planType === 'reminder'
    ? (plan.dueAt || plan.reminderAt || plan.startAt || Date.now())
    : (plan.startAt || plan.dueAt || plan.reminderAt || Date.now());
};

const getTimelineGroupKey = (timestamp: number) => {
  const target = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();

  if (targetDay === today) return 'today';
  if (targetDay === yesterday) return 'yesterday';
  return 'earlier';
};

const buildTimelineGroups = (logs: LogEntry[]) => {
  const groups: Array<{ key: 'today' | 'yesterday' | 'earlier'; items: LogEntry[] }> = [
    { key: 'today', items: [] },
    { key: 'yesterday', items: [] },
    { key: 'earlier', items: [] }
  ];

  logs.forEach((log) => {
    const key = getTimelineGroupKey(log.timestamp);
    const group = groups.find((item) => item.key === key);
    group?.items.push(log);
  });

  return groups.filter((group) => group.items.length > 0);
};

const buildDraftPreview = (parsed: Awaited<ReturnType<typeof parseLifeLog>>, originalText: string) => {
  const kind = parsed.intent === 'plan'
    ? 'plan'
    : parsed.finance && parsed.finance.length > 0
      ? 'finance'
      : 'log';

  if (kind === 'plan' && parsed.plan) {
    const timeLabel = getPreviewPlanTimestamp(parsed.plan)
      ? new Date(getPreviewPlanTimestamp(parsed.plan)).toLocaleString()
      : null;

    return {
      createdAt: Date.now(),
      kind,
      originalText,
      parsed,
      summary: parsed.plan.title || originalText,
      meta: [
        parsed.plan.planType === 'event' ? '日程事件' : '提醒事项',
        timeLabel,
        parsed.plan.syncTargetSuggestion === 'ios-calendar' ? '建议同步到 iOS 日历' : parsed.plan.syncTargetSuggestion === 'ios-reminder' ? '建议同步到 iOS 提醒事项' : null
      ].filter(Boolean) as string[]
    };
  }

  if (kind === 'finance' && parsed.finance && parsed.finance.length > 0) {
    const total = parsed.finance.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return {
      createdAt: Date.now(),
      kind,
      originalText,
      parsed,
      summary: parsed.activity || originalText,
      meta: [
        `识别出 ${parsed.finance.length} 条账目`,
        `金额合计 ${total}`,
        parsed.finance[0]?.category || null
      ].filter(Boolean) as string[]
    };
  }

  return {
    createdAt: Date.now(),
    kind,
    originalText,
    parsed,
    summary: parsed.activity || originalText,
    meta: [
      parsed.category || 'Other',
      parsed.durationMinutes ? `${parsed.durationMinutes} 分钟` : null,
      parsed.mood || null
    ].filter(Boolean) as string[]
  };
};

const buildAdjustedDraftPreview = (draft: NonNullable<ReturnType<typeof buildDraftPreview>>) => {
  const suggestedPlan = draft.parsed.plan?.timeValidation?.suggestedPlan;
  if (!suggestedPlan || !draft.parsed.plan) {
    return null;
  }

  const nextParsed: ParseResult = {
    ...draft.parsed,
    plan: {
      ...draft.parsed.plan,
      ...suggestedPlan,
      timeValidation: undefined
    } as PlanParseResult
  };

  return {
    ...buildDraftPreview(nextParsed, draft.originalText),
    createdAt: draft.createdAt
  };
};

export default Logger;

const PlanFocusCard: React.FC<{
  goal: Goal | null;
  activeGoalsCount: number;
  interruptedGoalsCount: number;
  rewardProfile?: RewardProfile | null;
  todayKey: string;
  onOpenComposer: () => void;
  onOpenPlanner: () => void;
}> = ({ goal, activeGoalsCount, interruptedGoalsCount, rewardProfile, todayKey, onOpenComposer, onOpenPlanner }) => {
  const { t } = useTranslation();

  if (!goal) {
    return (
      <div className="rounded-[2rem] border border-amber-200 bg-[linear-gradient(135deg,#fff8eb_0%,#fff1d3_55%,#fffbeb_100%)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
              {t('logger.plan_focus_label')}
            </p>
            <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              {interruptedGoalsCount > 0
                ? t('logger.plan_focus_interrupted_title', { count: interruptedGoalsCount })
                : t('logger.plan_focus_empty_title')}
            </h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {interruptedGoalsCount > 0
                ? t('logger.plan_focus_interrupted_desc')
                : t('logger.plan_focus_empty_desc')}
            </p>
            {rewardProfile && (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-bold text-slate-600 border border-white shadow-sm">
                  {t('rewards.points_value', { count: rewardProfile.availablePoints })}
        setExpandedPendingMessageId(pendingMsgId);
                  {t('rewards.level_value', { level: rewardProfile.level })}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={interruptedGoalsCount > 0 ? onOpenComposer : onOpenPlanner}
            className="shrink-0 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-colors"
          >
            {interruptedGoalsCount > 0 ? t('logger.plan_primary_cta') : t('logger.plan_secondary_cta')}
          </button>
        </div>
      </div>
    );
  }

  const isTodayDone = goal.lastCheckInDate === todayKey;
  const progress = Math.min((goal.completedDays / goal.totalDays) * 100, 100);
  const remainingDays = Math.max(goal.totalDays - goal.completedDays, 0);
  const accentColor = getLoggerGoalAccentColor(goal);
  const streakSegmentCount = Math.min(goal.totalDays, 7);
  const streakActiveCount = Math.min(goal.currentStreak, streakSegmentCount);
  const streakOverflowCount = Math.max(goal.currentStreak - streakSegmentCount, 0);
  const streakRingProgress = Math.min((goal.currentStreak / Math.max(goal.totalDays, 1)) * 100, 100);
  const statusSummary = goal.status === 'active'
    ? (isTodayDone ? t('goals.today_done') : t('goals.today_pending'))
    : goal.status === 'paused'
      ? t('goals.paused_hint')
      : goal.status === 'completed'
        ? t('goals.completed_hint', { days: goal.totalDays })
        : t('goals.failed_hint');
  const streakDashboardSummary = goal.status === 'active'
    ? t('logger.streak_dashboard_desc_active', { count: goal.currentStreak })
    : goal.status === 'paused'
      ? t('logger.streak_dashboard_desc_paused', { count: goal.currentStreak })
      : goal.status === 'completed'
        ? t('logger.streak_dashboard_desc_completed', { count: goal.currentStreak })
        : t('logger.streak_dashboard_desc_failed', { count: goal.currentStreak });

  return (
    <div
      className="plan-focus-card rounded-[2rem] border p-5 shadow-sm"
      style={{
        borderColor: `${accentColor}33`,
        background: `linear-gradient(135deg, ${accentColor}26 0%, rgba(255,248,235,0.96) 48%, rgba(255,255,255,0.98) 100%)`
      }}
    >
      <div className="flex flex-col gap-5">
        <div className="plan-focus-card-shell">
          <div className="plan-focus-card-summary min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-bold text-amber-700 border border-white shadow-sm">
                {t('logger.plan_focus_label')}
              </span>
              <span className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white">
                {goal.planScope === 'official' ? t('goals.official_plan_badge') : t('goals.primary_badge')}
              </span>
              {activeGoalsCount > 1 && (
                <span className="rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-bold text-slate-600 border border-white shadow-sm">
                  {t('logger.plan_parallel_hint', { count: activeGoalsCount })}
                </span>
              )}
            </div>

            <h3 className="mt-4 text-3xl font-black tracking-tight text-slate-950 leading-tight">
              {goal.title}
            </h3>

            <p className="mt-3 text-sm text-slate-700 leading-relaxed">
              {statusSummary}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-bold text-slate-700 border border-white shadow-sm">
                {goal.goalType === '21_DAY' ? t('goals.type_21_day') : t('goals.type_7_day')}
              </span>
              {goal.rewardTitle && (
                <span className="rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-bold text-slate-700 border border-white shadow-sm">
                  {t('goals.reward_inline', { reward: goal.rewardTitle })}
                </span>
              )}
              {rewardProfile && (
                <span className="rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-bold text-slate-700 border border-white shadow-sm">
                  {t('rewards.points_value', { count: rewardProfile.availablePoints })}
                </span>
              )}
            </div>
          </div>

          <div className="plan-focus-card-aside rounded-[1.6rem] bg-slate-950 px-4 py-4 text-white shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200">
              {t('logger.streak_dashboard_label')}
            </p>

            <div className="mt-4 flex items-center gap-4">
              <div
                className="relative h-24 w-24 shrink-0 rounded-full"
                style={{
                  background: `conic-gradient(${accentColor} 0% ${streakRingProgress}%, rgba(255,255,255,0.12) ${streakRingProgress}% 100%)`
                }}
              >
                <div className="absolute inset-[7px] rounded-full bg-slate-950"></div>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-lg leading-none">🔥</span>
                  <span className="mt-1 text-3xl font-black text-white">{goal.currentStreak}</span>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white">
                  {t('goals.streak_label')}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  {streakDashboardSummary}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${isTodayDone ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-100'}`}>
                    {isTodayDone ? t('goals.today_short_done') : t('goals.today_short_pending')}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {t('logger.streak_today_status_label')}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-white/6 px-3 py-3 border border-white/10">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold text-slate-300">
                  {t('logger.streak_momentum_label')}
                </span>
                {streakOverflowCount > 0 && (
                  <span className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-bold text-amber-100">
                    {t('logger.streak_overflow_days', { count: streakOverflowCount })}
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1.5">
                {Array.from({ length: streakSegmentCount }).map((_, index) => {
                  const isActive = index < streakActiveCount;
                  const isCurrentEdge = isActive && index === streakActiveCount - 1;

                  return (
                    <div
                      key={index}
                      className={`h-2.5 rounded-full transition-all ${isCurrentEdge ? 'scale-y-125' : ''}`}
                      style={{
                        background: isActive
                          ? `linear-gradient(90deg, ${accentColor} 0%, #fbbf24 100%)`
                          : 'rgba(255,255,255,0.12)',
                        boxShadow: isCurrentEdge ? `0 0 0 1px ${accentColor}66` : 'none'
                      }}
                    ></div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={goal.status === 'active' ? onOpenComposer : onOpenPlanner}
                className="flex-1 rounded-2xl bg-amber-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300 transition-colors"
              >
                {goal.status === 'active' ? t('logger.plan_primary_cta') : t('logger.plan_secondary_cta')}
              </button>
              {goal.status === 'active' && (
                <button
                  type="button"
                  onClick={onOpenPlanner}
                  className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white border border-white/10 hover:bg-white/15 transition-colors"
                >
                  {t('logger.plan_secondary_cta')}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] bg-white/85 border border-white px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-slate-500">
            <span>{t('goals.progress_inline', { current: goal.completedDays, total: goal.totalDays })}</span>
            <span>{t('goals.remaining_label')} {remainingDays}</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: accentColor }}
            ></div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <PlanStat label={t('goals.progress_label')} value={`${goal.completedDays}/${goal.totalDays}`} />
            <PlanStat label={t('goals.streak_label')} value={`${goal.currentStreak}`} />
            <PlanStat label={t('goals.today_label')} value={isTodayDone ? t('goals.today_short_done') : t('goals.today_short_pending')} />
          </div>
        </div>
      </div>
    </div>
  );
};

const PlanStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center border border-slate-100">
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
    <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
  </div>
);

const RewardSnapshotCard: React.FC<{ rewardProfile: RewardProfile }> = ({ rewardProfile }) => {
  const { t, i18n } = useTranslation();
  const latestBadge = rewardProfile.latestBadges[0] || null;
  const latestBadgeAccent = latestBadge?.accentColor || '#f59e0b';
  const levelProgress = Math.min((rewardProfile.pointsIntoCurrentLevel / rewardProfile.levelStepPoints) * 100, 100);
  const badgeDate = latestBadge
    ? new Date(latestBadge.issuedAt).toLocaleDateString(i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric'
    })
    : null;

  return (
    <div className="rounded-[1.6rem] border border-amber-200 bg-[linear-gradient(135deg,#fffaf0_0%,#fff6e5_58%,#ffffff_100%)] p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
            {t('logger.reward_summary_label')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 border border-amber-100 shadow-sm">
              {t('rewards.points_value', { count: rewardProfile.availablePoints })}
            </span>
            <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 border border-amber-100 shadow-sm">
              {t('rewards.level_value', { level: rewardProfile.level })}
            </span>
            <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 border border-amber-100 shadow-sm">
              {t('rewards.badge_count_label')} {rewardProfile.totalBadgeCount}
            </span>
          </div>
        </div>

        <div className="min-w-0 lg:w-[280px] rounded-2xl bg-white/85 border border-white px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-slate-500">
            <span>{t('rewards.level_progress_value', { current: rewardProfile.pointsIntoCurrentLevel, total: rewardProfile.levelStepPoints })}</span>
            <span>{t('rewards.next_level_remaining', { level: rewardProfile.level + 1, count: rewardProfile.pointsToNextLevel })}</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#fbbf24_0%,#f59e0b_100%)] transition-all duration-500"
              style={{ width: `${levelProgress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {latestBadge && (
        <div className="mt-4 rounded-2xl px-4 py-3 text-white" style={{ background: `linear-gradient(135deg, ${latestBadgeAccent} 0%, rgba(15,23,42,0.9) 100%)` }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-100">{t('rewards.latest_badge_label')}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-sm font-black text-white truncate">{latestBadge.title}</p>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/90">
                  {latestBadge.planScope === 'official' ? t('rewards.official_badge') : t('rewards.personal_badge')}
                </span>
              </div>
              {badgeDate && (
                <p className="mt-1 text-xs text-white/75">
                  {t('rewards.badge_earned_at', { date: badgeDate })}
                </p>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-white">
              {latestBadge.shortTitle}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
