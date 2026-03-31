/**
 * Format timestamp to WeChat-style time label
 * - "刚刚" for < 1 minute ago
 * - "上午/下午 HH:mm" for today
 * - "昨天 HH:mm" for yesterday
 * - "MM/DD HH:mm" for older messages
 */
export function formatMessageTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const oneMinute = 60 * 1000;
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;

  // Less than 1 minute ago
  if (diff < oneMinute) {
    return '刚刚';
  }

  const messageDate = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = messageDate.getFullYear() === today.getFullYear() &&
    messageDate.getMonth() === today.getMonth() &&
    messageDate.getDate() === today.getDate();

  const isYesterday = messageDate.getFullYear() === yesterday.getFullYear() &&
    messageDate.getMonth() === yesterday.getMonth() &&
    messageDate.getDate() === yesterday.getDate();

  const hours = messageDate.getHours();
  const minutes = messageDate.getMinutes();
  const timeStr = `${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}`;

  if (isToday) {
    const period = hours < 12 ? '上午' : '下午';
    return `${period} ${timeStr}`;
  }

  if (isYesterday) {
    return `昨天 ${timeStr}`;
  }

  const month = messageDate.getMonth() + 1;
  const day = messageDate.getDate();
  return `${month}/${day} ${timeStr}`;
}

/**
 * Check if we should show a time label between two messages
 * Show when gap > 5 minutes or different day
 */
export function shouldShowTimeLabel(prevTimestamp: number, currTimestamp: number): boolean {
  const fiveMinutes = 5 * 60 * 1000;
  const diff = currTimestamp - prevTimestamp;

  if (diff > fiveMinutes) {
    return true;
  }

  const prevDate = new Date(prevTimestamp);
  const currDate = new Date(currTimestamp);

  const differentDay = prevDate.getFullYear() !== currDate.getFullYear() ||
    prevDate.getMonth() !== currDate.getMonth() ||
    prevDate.getDate() !== currDate.getDate();

  return differentDay;
}
