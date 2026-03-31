import { ChatMessage, ChatMessageCreateInput } from '../types';
import { apiClient } from './apiClient';

const STORAGE_KEY = 'lifepulse_chat_messages_v1';
const TOKEN_KEY = 'lifepulse_token';
const API_BASE_URL = '/api/chat-messages';

export const fetchChatMessages = async (): Promise<ChatMessage[]> => {
  const token = localStorage.getItem(TOKEN_KEY);

  if (token) {
    try {
      const messages = await apiClient(API_BASE_URL);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      return messages;
    } catch (error) {
      console.warn('Backend chat fetch failed, falling back to local storage', error);
    }
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];

  try {
    return JSON.parse(saved);
  } catch (error) {
    console.error('Failed to parse chat messages', error);
    return [];
  }
};

export const createChatMessage = async (message: ChatMessage): Promise<ChatMessage> => {
  const token = localStorage.getItem(TOKEN_KEY);

  if (token) {
    try {
      return await apiClient(API_BASE_URL, {
        method: 'POST',
        body: message
      });
    } catch (error) {
      console.error('Backend chat save failed', error);
    }
  }

  const messages = await fetchChatMessages();
  const nextMessages = [...messages, message].sort((a, b) => a.timestamp - b.timestamp);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMessages));
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
    } catch (error) {
      console.error('Backend chat delete failed', error);
    }
  }

  const messages = await fetchChatMessages();
  const nextMessages = messages.filter((message) => !messageIds.includes(message.id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMessages));
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