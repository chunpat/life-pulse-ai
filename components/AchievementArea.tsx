import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RewardBadge, RewardLedgerEntry, RewardProfile } from '../types';
import { buildSafeAreaPaddingStyle } from '../utils/safeArea';

interface AchievementAreaProps {
  rewardProfile: RewardProfile;
  rewardBadges: RewardBadge[];
  rewardLedger: RewardLedgerEntry[];
}

type BadgeFilter = 'all' | 'official' | 'personal';
const LEVEL_STEP_POINTS = 50;

const formatLedgerDate = (value: string | undefined, locale: string) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString(locale.startsWith('zh') ? 'zh-CN' : 'en-US', {
    month: locale.startsWith('zh') ? '2-digit' : 'short',
    day: '2-digit'
  });
};

const formatBadgeDate = (value: number, locale: string) => new Date(value).toLocaleDateString(
  locale.startsWith('zh') ? 'zh-CN' : 'en-US',
  { month: 'short', day: 'numeric' }
);

const formatTimelineDateLabel = (value: string, locale: string, todayLabel: string) => {
  const date = new Date(value);
  const today = new Date();
  const isToday = date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();

  if (isToday) {
    return todayLabel;
  }

  return date.toLocaleDateString(locale.startsWith('zh') ? 'zh-CN' : 'en-US', {
    month: locale.startsWith('zh') ? '2-digit' : 'short',
    day: '2-digit'
  });
};

const formatTimelineTime = (value: string | undefined, locale: string) => {
  if (!value) return '';
  return new Date(value).toLocaleTimeString(locale.startsWith('zh') ? 'zh-CN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const hexToRgba = (hex: string, alpha: number) => {
  const safeHex = hex.replace('#', '');
  const normalized = safeHex.length === 3
    ? safeHex.split('').map((char) => `${char}${char}`).join('')
    : safeHex;

  if (normalized.length !== 6) {
    return `rgba(15, 23, 42, ${alpha})`;
  }

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const getBadgeSurfaceStyle = (badge: RewardBadge) => ({
  borderColor: hexToRgba(badge.accentColor, 0.16),
  background: `linear-gradient(180deg, ${hexToRgba(badge.accentColor, 0.1)} 0%, rgba(255,255,255,0.98) 24%, rgba(255,255,255,0.98) 100%)`
});

const getTimelineTone = (eventType: string) => {
  if (eventType === 'official_plan_completed') {
    return {
      dotClass: 'bg-sky-500',
      chipClass: 'bg-sky-50 text-sky-700',
      chipLabelKey: 'rewards.timeline_tag_official'
    };
  }

  if (eventType === 'goal_completed_7_day' || eventType === 'goal_completed_21_day') {
    return {
      dotClass: 'bg-amber-500',
      chipClass: 'bg-amber-50 text-amber-700',
      chipLabelKey: 'rewards.timeline_tag_completion'
    };
  }

  if (eventType === 'daily_primary_goal_progress') {
    return {
      dotClass: 'bg-orange-500',
      chipClass: 'bg-orange-50 text-orange-700',
      chipLabelKey: 'rewards.timeline_tag_progress'
    };
  }

  return {
    dotClass: 'bg-emerald-500',
    chipClass: 'bg-emerald-50 text-emerald-700',
    chipLabelKey: 'rewards.timeline_tag_daily'
  };
};

const AchievementArea: React.FC<AchievementAreaProps> = ({ rewardProfile, rewardBadges, rewardLedger }) => {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<BadgeFilter>('all');
  const [selectedBadge, setSelectedBadge] = useState<RewardBadge | null>(null);

  const filteredBadges = useMemo(() => {
    if (filter === 'official') {
      return rewardBadges.filter((badge) => badge.planScope === 'official');
    }

    if (filter === 'personal') {
      return rewardBadges.filter((badge) => badge.planScope === 'personal');
    }

    return rewardBadges;
  }, [filter, rewardBadges]);

  const recentBadges = rewardBadges.slice(0, 3);
  const recentLedger = rewardLedger.slice(0, 4);
  const officialCount = rewardBadges.filter((badge) => badge.planScope === 'official').length;
  const personalCount = rewardBadges.filter((badge) => badge.planScope === 'personal').length;
  const levelStepPoints = rewardProfile.levelStepPoints || LEVEL_STEP_POINTS;
  const nextLevelThreshold = rewardProfile.nextLevelThreshold;
  const pointsIntoCurrentLevel = rewardProfile.pointsIntoCurrentLevel;
  const pointsToNextLevel = rewardProfile.pointsToNextLevel;
  const levelProgress = Math.min((pointsIntoCurrentLevel / levelStepPoints) * 100, 100);
  const timelineGroups = useMemo(() => {
    const grouped = new Map<string, RewardLedgerEntry[]>();

    recentLedger.forEach((entry) => {
      const dateKey = entry.createdAt ? new Date(entry.createdAt).toISOString().slice(0, 10) : 'unknown';
      const existing = grouped.get(dateKey) || [];
      existing.push(entry);
      grouped.set(dateKey, existing);
    });

    return Array.from(grouped.entries()).map(([dateKey, entries]) => ({ dateKey, entries }));
  }, [recentLedger]);

  return (
    <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
      <div className="rounded-[1.75rem] border border-amber-100 bg-[linear-gradient(135deg,#fffaf0_0%,#fff5da_56%,#f8fafc_100%)] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch xl:justify-between">
          <div className="min-w-0 xl:max-w-[48%]">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('rewards.achievement_title')}</p>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{t('rewards.points_value', { count: rewardProfile.availablePoints })}</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{t('rewards.achievement_desc')}</p>
          </div>

          <div className="flex-1 rounded-[1.4rem] bg-slate-950 px-4 py-4 text-white shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-200">{t('rewards.level_label')}</p>
                <p className="mt-1 text-2xl font-black">{t('rewards.level_value', { level: rewardProfile.level })}</p>
              </div>
              <span className="inline-flex w-fit rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-amber-100">
                {t('rewards.next_level_remaining', { level: rewardProfile.level + 1, count: pointsToNextLevel })}
              </span>
            </div>

            <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#fbbf24_0%,#f59e0b_100%)] transition-all duration-500"
                style={{ width: `${levelProgress}%` }}
              ></div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-bold text-slate-300">
              <span>{t('rewards.level_progress_value', { current: pointsIntoCurrentLevel, total: levelStepPoints })}</span>
              <span>{t('rewards.next_level_target', { count: nextLevelThreshold })}</span>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              {t('rewards.level_rule', { count: levelStepPoints })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
          <AchievementStat label={t('rewards.available_label')} value={`${rewardProfile.availablePoints}`} />
          <AchievementStat label={t('rewards.lifetime_label')} value={`${rewardProfile.lifetimePoints}`} />
          <AchievementStat label={t('rewards.badge_count_label')} value={`${rewardProfile.totalBadgeCount}`} />
          <AchievementStat label={t('rewards.official_badge_count_label')} value={`${officialCount}`} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4 xl:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-black text-slate-900 tracking-tight">{t('rewards.badge_wall_title')}</h4>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">{t('rewards.badge_wall_desc')}</p>
            </div>
            <div className="rounded-2xl bg-white p-1 border border-slate-200 flex w-full sm:w-auto items-center gap-1 overflow-x-auto">
              {(['all', 'official', 'personal'] as BadgeFilter[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors ${filter === option ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {t(`rewards.filter_${option}`)}
                </button>
              ))}
            </div>
          </div>

          {filteredBadges.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
              {filteredBadges.map((badge) => (
                <div
                  key={badge.id}
                  className="rounded-[1.35rem] border p-4 shadow-sm min-h-[164px] cursor-pointer transition-transform duration-200 hover:-translate-y-0.5"
                  style={getBadgeSurfaceStyle(badge)}
                  onClick={() => setSelectedBadge(badge)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                          style={{
                            backgroundColor: hexToRgba(badge.accentColor, 0.14),
                            color: badge.accentColor
                          }}
                        >
                          {badge.planScope === 'official' ? t('rewards.official_badge') : t('rewards.personal_badge')}
                        </span>
                        {badge.officialPlanTitle && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/90 text-slate-600 border border-slate-200 truncate max-w-full">
                            {badge.officialPlanTitle}
                          </span>
                        )}
                      </div>
                      <h5 className="mt-4 text-sm font-black text-slate-900 leading-snug">{badge.title}</h5>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">{badge.shortTitle}</p>
                    </div>

                    <div
                      className="shrink-0 rounded-2xl w-11 h-11 flex items-center justify-center text-white text-lg font-black shadow-sm"
                      style={{ background: `linear-gradient(135deg, ${badge.accentColor} 0%, ${hexToRgba(badge.accentColor, 0.7)} 100%)` }}
                    >
                      {badge.planScope === 'official' ? 'O' : 'P'}
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3 text-[11px] font-bold text-slate-500">
                    <span>{formatBadgeDate(badge.issuedAt, i18n.language)}</span>
                    <span style={{ color: badge.accentColor }}>{badge.theme || t('rewards.default_theme')}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-sm text-slate-500 leading-relaxed">
              {t('rewards.empty_badge_wall')}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4">
            <h4 className="text-sm font-black text-slate-900 tracking-tight">{t('rewards.recent_badges_title')}</h4>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">{t('rewards.recent_badges_desc')}</p>

            {recentBadges.length > 0 ? (
              <div className="mt-4 space-y-3">
                {recentBadges.map((badge) => (
                  <button
                    key={badge.id}
                    type="button"
                    onClick={() => setSelectedBadge(badge)}
                    className="w-full text-left rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{badge.title}</p>
                        <p className="mt-1 text-xs text-slate-500 truncate">
                          {badge.officialPlanTitle || badge.shortTitle}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: hexToRgba(badge.accentColor, 0.12), color: badge.accentColor }}>
                        {formatBadgeDate(badge.issuedAt, i18n.language)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 leading-relaxed">
                {t('rewards.empty_recent')}
              </div>
            )}
          </div>

          <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-black text-slate-900 tracking-tight">{t('rewards.recent_activity_title')}</h4>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">{t('rewards.recent_activity_desc')}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-white text-[10px] font-bold text-slate-500 border border-slate-200">
                {t('rewards.timeline_count', { count: recentLedger.length })}
              </span>
            </div>

            {recentLedger.length > 0 ? (
              <div className="mt-4 space-y-4">
                {timelineGroups.map((group) => (
                  <div key={group.dateKey} className="grid grid-cols-[auto_1fr] gap-3 items-start">
                    <div className="pt-1">
                      <span className="inline-flex rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-white whitespace-nowrap">
                        {group.dateKey === 'unknown' ? '--' : formatTimelineDateLabel(group.dateKey, i18n.language, t('rewards.today_label'))}
                      </span>
                    </div>

                    <div className="relative pl-5">
                      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200"></div>
                      <div className="space-y-3">
                        {group.entries.map((entry) => {
                          const eventKey = `rewards.events.${entry.eventType}`;
                          const metaTitle = typeof entry.metadata?.title === 'string' ? entry.metadata.title : '';
                          const metaDateKey = typeof entry.metadata?.dateKey === 'string' ? entry.metadata.dateKey : '';
                          const tone = getTimelineTone(entry.eventType);

                          return (
                            <div key={entry.id} className="relative">
                              <span className={`absolute -left-[1px] top-4 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm ${tone.dotClass}`}></span>
                              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${tone.chipClass}`}>
                                        {t(tone.chipLabelKey)}
                                      </span>
                                      <p className="text-sm font-black text-slate-900">
                                        {t(`${eventKey}.title`, { defaultValue: entry.eventType })}
                                      </p>
                                      <span className="text-[10px] font-bold text-slate-400">
                                        {formatTimelineTime(entry.createdAt, i18n.language)}
                                      </span>
                                    </div>

                                    <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                                      {t(`${eventKey}.desc`, {
                                        title: metaTitle,
                                        date: metaDateKey,
                                        defaultValue: metaTitle || t('rewards.balance_after', { count: entry.balanceAfter })
                                      })}
                                    </p>

                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-400">
                                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">
                                        {t('rewards.balance_after', { count: entry.balanceAfter })}
                                      </span>
                                      {metaTitle && (
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">
                                          {metaTitle}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <p className={`text-sm font-black shrink-0 ${entry.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {entry.amount >= 0 ? `+${entry.amount}` : entry.amount}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 leading-relaxed">
                {t('rewards.no_ledger')}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedBadge && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center" style={buildSafeAreaPaddingStyle({ top: '1rem', right: '1rem', bottom: '1rem', left: '1rem' })}>
          <button
            type="button"
            aria-label={t('rewards.close_detail')}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
            onClick={() => setSelectedBadge(null)}
          />

          <div className="relative z-10 w-full max-w-md rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('rewards.badge_detail_title')}</p>
                <h4 className="mt-2 text-xl font-black text-slate-900 leading-snug">{selectedBadge.title}</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBadge(null)}
                className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200"
              >
                {t('rewards.close_detail')}
              </button>
            </div>

            <div className="mt-4 rounded-[1.4rem] border p-4" style={getBadgeSurfaceStyle(selectedBadge)}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span
                    className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold"
                    style={{ backgroundColor: hexToRgba(selectedBadge.accentColor, 0.14), color: selectedBadge.accentColor }}
                  >
                    {selectedBadge.planScope === 'official' ? t('rewards.official_badge') : t('rewards.personal_badge')}
                  </span>
                  <p className="mt-3 text-sm font-black text-slate-900">{selectedBadge.shortTitle}</p>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">{t('rewards.badge_detail_desc')}</p>
                </div>
                <div
                  className="shrink-0 rounded-2xl w-14 h-14 flex items-center justify-center text-white text-xl font-black shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${selectedBadge.accentColor} 0%, ${hexToRgba(selectedBadge.accentColor, 0.72)} 100%)` }}
                >
                  {selectedBadge.planScope === 'official' ? 'O' : 'P'}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <BadgeMetaRow label={t('rewards.earned_date_label')} value={formatBadgeDate(selectedBadge.issuedAt, i18n.language)} />
              <BadgeMetaRow label={t('rewards.badge_scope_label')} value={selectedBadge.planScope === 'official' ? t('rewards.official_badge') : t('rewards.personal_badge')} />
              <BadgeMetaRow label={t('rewards.badge_theme_label')} value={selectedBadge.theme || t('rewards.default_theme')} />
              {selectedBadge.officialPlanTitle && (
                <BadgeMetaRow label={t('rewards.badge_source_label')} value={selectedBadge.officialPlanTitle} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AchievementStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl bg-white px-3 py-4 text-center border border-slate-200 shadow-sm">
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
    <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
  </div>
);

const BadgeMetaRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</span>
    <span className="text-sm font-bold text-slate-900 text-right">{value}</span>
  </div>
);

export default AchievementArea;