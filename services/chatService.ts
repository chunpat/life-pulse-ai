import { ChatMessage, ChatMessageCreateInput } from '../types';
import { apiClient } from './apiClient';

const STORAGE_KEY = 'lifepulse_chat_messages_v1';
const TOKEN_KEY = 'lifepulse_token';
const API_BASE_URL = '/api/chat-messages';

export interface FetchChatMessagesOptions {
  limit?: number;
  beforeTimestamp?: number;
}

export interface ChatMessagePage {
  messages: ChatMessage[];
  hasMore: boolean;
}

const readStoredChatMessages = (): ChatMessage[] => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];

  try {
    return JSON.parse(saved);
  } catch (error) {
    console.error('Failed to parse chat messages', error);
    return [];
  }
};

const writeStoredChatMessages = (messages: ChatMessage[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
};

const mergeMessages = (current: ChatMessage[], incoming: ChatMessage[]) => {
  const messageMap = new Map<string, ChatMessage>();

  [...current, ...incoming].forEach((message) => {
    messageMap.set(message.id, message);
  });

  return Array.from(messageMap.values()).sort((a, b) => a.timestamp - b.timestamp);
};

export const fetchChatMessages = async (options: FetchChatMessagesOptions = {}): Promise<ChatMessagePage> => {
  const { limit = 20, beforeTimestamp } = options;
  const token = localStorage.getItem(TOKEN_KEY);

  if (token) {
    try {
      const page = await apiClient(API_BASE_URL, {
        params: {
          limit: String(limit),
          ...(typeof beforeTimestamp === 'number' ? { beforeTimestamp: String(beforeTimestamp) } : {})
        }
      }) as ChatMessagePage;
      const cached = readStoredChatMessages();
      writeStoredChatMessages(mergeMessages(cached, page.messages));
      return page;
    } catch (error) {
      console.warn('Backend chat fetch failed, falling back to local storage', error);
    }
  }

  const storedMessages = readStoredChatMessages();
  const filtered = typeof beforeTimestamp === 'number'
    ? storedMessages.filter((message) => message.timestamp < beforeTimestamp)
    : storedMessages;
  const messages = filtered.slice(-limit);

  return {
    messages,
    hasMore: filtered.length > messages.length
  };
};

export const createChatMessage = async (message: ChatMessage): Promise<ChatMessage> => {
  const token = localStorage.getItem(TOKEN_KEY);

  if (token) {
    try {
      const savedMessage = await apiClient(API_BASE_URL, {
        method: 'POST',
        body: message
      });
      const cached = readStoredChatMessages();
      writeStoredChatMessages(mergeMessages(cached, [savedMessage]));
      return savedMessage;
    } catch (error) {
      console.error('Backend chat save failed', error);
    }
  }

  const messages = readStoredChatMessages();
  const nextMessages = [...messages, message].sort((a, b) => a.timestamp - b.timestamp);
  writeStoredChatMessages(nextMessages);
  return message;
};

export const deleteChatMessages = async (messageIds: string[]): Promise<void> => {
  if (!messageIds.length) return;

  const token = localStorage.getItem(TOKEN_KEY);

  if (token) {
    try {
      await apiClient(`${API_BASE_URL}/bulk`, {
        method: 'DELETE',
        body: { messageIds }
      });
      const cached = readStoredChatMessages();
      writeStoredChatMessages(cached.filter((message) => !messageIds.includes(message.id)));
      return;
    } catch (error) {
      console.error('Backend chat delete failed', error);
    }
  }

  const messages = readStoredChatMessages();
  const nextMessages = messages.filter((message) => !messageIds.includes(message.id));
  writeStoredChatMessages(nextMessages);
};

export const syncLocalChatToCloud = async (): Promise<void> => {
  const token = localStorage.getItem(TOKEN_KEY);
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!token || !saved) return;

  try {
    const messages = JSON.parse(saved) as ChatMessageCreateInput[];
    if (!messages.length) return;

    await apiClient(`${API_BASE_URL}/sync`, {
      method: 'POST',
      body: { messages }
    });
  } catch (error) {
    console.error('Chat sync to cloud failed', error);
  }
};