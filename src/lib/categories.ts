export interface ContentCategory {
  key: string;
  labelAr: string;
  labelEn: string;
  emoji: string;
}

export const CONTENT_CATEGORIES: ContentCategory[] = [
  { key: 'all', labelAr: 'الكل', labelEn: 'All', emoji: '✨' },
  { key: 'general', labelAr: 'عام', labelEn: 'General', emoji: '🌐' },
  { key: 'tech', labelAr: 'تقنية وذكاء', labelEn: 'Tech & AI', emoji: '🤖' },
  { key: 'entertainment', labelAr: 'ترفيه', labelEn: 'Entertainment', emoji: '🎬' },
  { key: 'sports', labelAr: 'رياضة', labelEn: 'Sports', emoji: '⚽' },
  { key: 'education', labelAr: 'تعليم', labelEn: 'Education', emoji: '📚' },
  { key: 'news', labelAr: 'أخبار', labelEn: 'News', emoji: '📰' },
  { key: 'music', labelAr: 'موسيقى وألعاب', labelEn: 'Music & Gaming', emoji: '🎮' },
  { key: 'business', labelAr: 'أعمال', labelEn: 'Business', emoji: '💼' },
];

export const ASSIGNABLE_CATEGORIES = CONTENT_CATEGORIES.filter((c) => c.key !== 'all');

export function normalizeCategory(raw: unknown): string {
  const val = String(raw || 'general').trim().toLowerCase();
  if (ASSIGNABLE_CATEGORIES.some((c) => c.key === val)) return val;
  return 'general';
}

export function getCategoryLabel(key: string | undefined | null, lang: 'ar' | 'en'): ContentCategory {
  const found = CONTENT_CATEGORIES.find((c) => c.key === (key || 'general'));
  return (
    found || {
      key: 'general',
      labelAr: lang === 'ar' ? 'عام' : 'General',
      labelEn: 'General',
      emoji: '🌐',
    }
  );
}
