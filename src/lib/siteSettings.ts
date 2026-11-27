import { supabase } from './supabase';

export type HeadingScale = 'small' | 'medium' | 'large';

export type CategoryContent = {
  key: string;
  label: string;
  blurb: string;
  imageUrl: string;
  hoverImageUrl: string;
  hoverSwapEnabled: boolean;
};

export type TrustBadgeContent = {
  key: string;
  icon: 'truck' | 'shield' | 'clock';
  title: string;
  description: string;
  imageUrl: string;
};

export type SiteSettings = {
  primaryColor: string;
  navigationBarColor: string;
  accentColor: string;
  buttonHoverColor: string;
  navLinkHoverColor: string;
  pageBackgroundColor: string;
  surfaceBackgroundColor: string;
  headingScale: HeadingScale;
  hoverLiftEnabled: boolean;
  cardShadowHoverEnabled: boolean;
  buttonScaleHoverEnabled: boolean;
  buttonShadowHoverEnabled: boolean;
  navLinkHoverEnabled: boolean;
  announcementText: string;
  heroEyebrow: string;
  heroTitle: string;
  heroHighlight: string;
  heroBody: string;
  heroBackgroundImageUrl: string;
  shopNowLabel: string;
  browseCategoriesLabel: string;
  footerTagline: string;
  footerCategoriesTitle: string;
  footerCategories: string[];
  footerContactTitle: string;
  footerPhone: string;
  footerEmail: string;
  footerAddress: string;
  footerShopkeepersTitle: string;
  footerShopkeepersText: string;
  footerPaymentText: string;
  productsEmptyTitle: string;
  productsEmptyText: string;
  cartEmptyTitle: string;
  cartEmptyText: string;
  continueShoppingLabel: string;
  checkoutButtonLabel: string;
  allCategoryLabel: string;
  categoryFoodSauceLabel: string;
  categoryFruitsLabel: string;
  categorySpicesLabel: string;
  categoryKitchenWareLabel: string;
  categoryCookingFuelsLabel: string;
  categoryAndMoreLabel: string;
  categories: CategoryContent[];
  trustBadges: TrustBadgeContent[];
  decorativeImageUrl: string;
};

export type SiteSettingRecord = {
  setting_key: keyof SiteSettings;
  setting_value: SiteSettings[keyof SiteSettings];
  updated_by?: string | null;
  updated_by_name?: string | null;
  updated_at?: string | null;
};

export type SiteContentVersion = {
  id: string;
  version_number: number;
  content: SiteSettings;
  published_by?: string | null;
  published_by_name?: string | null;
  published_at?: string | null;
  change_summary?: unknown;
};

const DEFAULT_CATEGORY_CONTENT: CategoryContent[] = [
  {
    key: 'Food Sauce',
    label: 'Food Sauce',
    blurb: 'Fresh groceries & vegetables',
    imageUrl: '',
    hoverImageUrl: '',
    hoverSwapEnabled: false,
  },
  {
    key: 'Fruits',
    label: 'Fruits',
    blurb: 'Seasonal fresh fruits',
    imageUrl: '',
    hoverImageUrl: '',
    hoverSwapEnabled: false,
  },
  {
    key: 'Spices',
    label: 'Spices',
    blurb: 'Aromatic spices & seasonings',
    imageUrl: '',
    hoverImageUrl: '',
    hoverSwapEnabled: false,
  },
  {
    key: 'Kitchen Ware',
    label: 'Kitchen Ware',
    blurb: 'Cookware & dinnerware',
    imageUrl: '',
    hoverImageUrl: '',
    hoverSwapEnabled: false,
  },
  {
    key: 'Cooking Fuels',
    label: 'Cooking Fuels',
    blurb: 'Gas, charcoal & more',
    imageUrl: '',
    hoverImageUrl: '',
    hoverSwapEnabled: false,
  },
  {
    key: 'And More',
    label: 'And More',
    blurb: 'Everything else we stock',
    imageUrl: '',
    hoverImageUrl: '',
    hoverSwapEnabled: false,
  },
];

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  primaryColor: '#19A4DB',
  navigationBarColor: '#082F42',
  accentColor: '#050707',
  buttonHoverColor: '#0C86B8',
  navLinkHoverColor: '#19A4DB',
  pageBackgroundColor: '#F8FAFC',
  surfaceBackgroundColor: '#FFFFFF',
  headingScale: 'medium',
  hoverLiftEnabled: true,
  cardShadowHoverEnabled: true,
  buttonScaleHoverEnabled: false,
  buttonShadowHoverEnabled: true,
  navLinkHoverEnabled: true,
  announcementText:
    'Welcome to Shop for me Uganda - We offer a reliable, affordable, and convenient way to get everything you need delivered straight to your doorsteps.',
  heroEyebrow: 'Fresh deliveries across Uganda',
  heroTitle: 'List, Order &',
  heroHighlight: 'Delivered',
  heroBody:
    'Fresh groceries, kitchenware and cooking fuels - a reliable, affordable and convenient way to get everything you need at your doorsteps.',
  heroBackgroundImageUrl: '',
  shopNowLabel: 'Shop Now',
  browseCategoriesLabel: 'Browse Categories',
  footerTagline:
    'A reliable, affordable, and convenient way to get everything you need delivered straight to your doorsteps.',
  footerCategoriesTitle: 'Categories',
  footerCategories: ['Food Sauce', 'Fruits', 'Spices', 'Kitchen Ware', 'Cooking Fuels'],
  footerContactTitle: 'Contact',
  footerPhone: '+256 700 000 000',
  footerEmail: 'hello@shopforme.ug',
  footerAddress: 'Kampala, Uganda',
  footerShopkeepersTitle: 'For Shop Keepers',
  footerShopkeepersText: 'Switch to the merchant view to manage products, prices and orders.',
  footerPaymentText: 'Pay with MTN / Airtel Mobile Money',
  productsEmptyTitle: 'No products found.',
  productsEmptyText: 'Try a different category or search term.',
  cartEmptyTitle: 'Your cart is empty',
  cartEmptyText: 'Add fresh groceries and essentials to get started.',
  continueShoppingLabel: 'Continue Shopping',
  checkoutButtonLabel: 'Checkout',
  allCategoryLabel: 'All',
  categoryFoodSauceLabel: 'Food Sauce',
  categoryFruitsLabel: 'Fruits',
  categorySpicesLabel: 'Spices',
  categoryKitchenWareLabel: 'Kitchen Ware',
  categoryCookingFuelsLabel: 'Cooking Fuels',
  categoryAndMoreLabel: 'And More',
  categories: DEFAULT_CATEGORY_CONTENT,
  trustBadges: [
    {
      key: 'delivery',
      icon: 'truck',
      title: 'Doorstep Delivery',
      description: 'Across Uganda, fast & reliable',
      imageUrl: '',
    },
    {
      key: 'quality',
      icon: 'shield',
      title: 'Quality Promise',
      description: 'Fresh produce or refunded',
      imageUrl: '',
    },
    {
      key: 'hours',
      icon: 'clock',
      title: 'Convenient Hours',
      description: 'Order anytime, we deliver',
      imageUrl: '',
    },
  ],
  decorativeImageUrl: '',
};

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const LOCAL_SETTINGS_KEY = 'sfm-site-settings-cache';
const GLOBAL_SECTION_KEY = 'global';
let cachedSettings: SiteSettings | null = null;

const COLOR_KEYS: Array<keyof SiteSettings> = [
  'primaryColor',
  'navigationBarColor',
  'accentColor',
  'buttonHoverColor',
  'navLinkHoverColor',
  'pageBackgroundColor',
  'surfaceBackgroundColor',
];

const TEXT_LIMITS: Partial<Record<keyof SiteSettings, number>> = {
  announcementText: 180,
  heroEyebrow: 60,
  heroTitle: 45,
  heroHighlight: 24,
  heroBody: 220,
  shopNowLabel: 24,
  browseCategoriesLabel: 32,
  footerTagline: 220,
  footerCategoriesTitle: 40,
  footerContactTitle: 40,
  footerPhone: 40,
  footerEmail: 80,
  footerAddress: 100,
  footerShopkeepersTitle: 50,
  footerShopkeepersText: 180,
  footerPaymentText: 80,
  productsEmptyTitle: 60,
  productsEmptyText: 120,
  cartEmptyTitle: 60,
  cartEmptyText: 120,
  continueShoppingLabel: 28,
  checkoutButtonLabel: 28,
  allCategoryLabel: 20,
  categoryFoodSauceLabel: 28,
  categoryFruitsLabel: 28,
  categorySpicesLabel: 28,
  categoryKitchenWareLabel: 28,
  categoryCookingFuelsLabel: 28,
  categoryAndMoreLabel: 28,
};

export function isHexColor(value: string) {
  return HEX_COLOR_PATTERN.test(value);
}

export function mergeSiteSettings(records: SiteSettingRecord[] = []): SiteSettings {
  const nextSettings = normalizeSiteSettings(DEFAULT_SITE_SETTINGS);

  records.forEach((record) => {
    const key = record.setting_key;
    if (key in nextSettings) {
      nextSettings[key] = record.setting_value as never;
    }
  });

  return normalizeSiteSettings(nextSettings);
}

export function normalizeSiteSettings(settings: Partial<SiteSettings> = {}): SiteSettings {
  const next = {
    ...DEFAULT_SITE_SETTINGS,
    ...settings,
    footerCategories: Array.isArray(settings.footerCategories)
      ? settings.footerCategories
      : DEFAULT_SITE_SETTINGS.footerCategories,
    categories: mergeCategoryContent(settings.categories),
    trustBadges: mergeTrustBadges(settings.trustBadges),
  };

  if (!settings.categories) {
    const legacyLabels: Record<string, string | undefined> = {
      'Food Sauce': settings.categoryFoodSauceLabel,
      Fruits: settings.categoryFruitsLabel,
      Spices: settings.categorySpicesLabel,
      'Kitchen Ware': settings.categoryKitchenWareLabel,
      'Cooking Fuels': settings.categoryCookingFuelsLabel,
      'And More': settings.categoryAndMoreLabel,
    };

    next.categories = next.categories.map((category) => ({
      ...category,
      label: legacyLabels[category.key] || category.label,
    }));
  }

  next.categoryFoodSauceLabel = getCategoryLabel(next, 'Food Sauce');
  next.categoryFruitsLabel = getCategoryLabel(next, 'Fruits');
  next.categorySpicesLabel = getCategoryLabel(next, 'Spices');
  next.categoryKitchenWareLabel = getCategoryLabel(next, 'Kitchen Ware');
  next.categoryCookingFuelsLabel = getCategoryLabel(next, 'Cooking Fuels');
  next.categoryAndMoreLabel = getCategoryLabel(next, 'And More');

  return next;
}

export async function fetchSiteSettings() {
  if (cachedSettings) return cachedSettings;

  try {
    const stored = window.localStorage.getItem(LOCAL_SETTINGS_KEY);
    if (stored) {
      cachedSettings = normalizeSiteSettings(JSON.parse(stored));
      applySiteSettings(cachedSettings);
    }
  } catch {
    cachedSettings = null;
  }

  const { data: contentData, error: contentError } = await supabase
    .from('site_content')
    .select('content')
    .eq('section_key', GLOBAL_SECTION_KEY)
    .eq('is_published', true)
    .maybeSingle();

  if (!contentError && contentData?.content) {
    cachedSettings = normalizeSiteSettings(contentData.content as Partial<SiteSettings>);
    cacheSiteSettings(cachedSettings);
    applySiteSettings(cachedSettings);
    return cachedSettings;
  }

  const { data, error } = await supabase
    .from('site_settings')
    .select('setting_key,setting_value')
    .order('setting_key');

  if (error) {
    const fallback = cachedSettings ?? DEFAULT_SITE_SETTINGS;
    applySiteSettings(fallback);
    return fallback;
  }

  cachedSettings = mergeSiteSettings((data ?? []) as SiteSettingRecord[]);
  cacheSiteSettings(cachedSettings);
  applySiteSettings(cachedSettings);
  return cachedSettings;
}

export async function fetchSiteSettingRecords() {
  const { data, error } = await supabase
    .from('site_content')
    .select('section_key,content,updated_by,updated_by_name,updated_at')
    .order('updated_at', { ascending: false });

  if (!error && data?.length) {
    return data.map((record) => ({
      setting_key: record.section_key as keyof SiteSettings,
      setting_value: record.content,
      updated_by: record.updated_by,
      updated_by_name: record.updated_by_name,
      updated_at: record.updated_at,
    })) as SiteSettingRecord[];
  }

  const legacy = await supabase
    .from('site_settings')
    .select('setting_key,setting_value,updated_by,updated_by_name,updated_at')
    .order('setting_key');

  if (legacy.error) return [];
  return (legacy.data ?? []) as SiteSettingRecord[];
}

export async function fetchSiteContentDraft() {
  const { data, error } = await supabase
    .from('site_content')
    .select('content')
    .eq('section_key', GLOBAL_SECTION_KEY)
    .eq('is_published', false)
    .maybeSingle();

  if (error || !data?.content) return null;
  return normalizeSiteSettings(data.content as Partial<SiteSettings>);
}

export async function fetchSiteContentVersions(limit = 10) {
  const { data, error } = await supabase
    .from('site_content_versions')
    .select('id,version_number,content,published_by,published_by_name,published_at,change_summary')
    .eq('section_key', GLOBAL_SECTION_KEY)
    .order('version_number', { ascending: false })
    .limit(limit);

  if (error) return [];
  return ((data ?? []) as SiteContentVersion[]).map((version) => ({
    ...version,
    content: normalizeSiteSettings(version.content),
  }));
}

export async function saveSiteSettings(
  settings: SiteSettings,
  actorUserId: string | null,
  actorName: string,
) {
  return saveSiteContentDraft(settings, actorUserId, actorName);
}

export async function saveSiteContentDraft(
  settings: SiteSettings,
  actorUserId: string | null,
  actorName: string,
) {
  const normalized = normalizeSiteSettings(settings);
  const validationError = validateSiteSettings(normalized);
  if (validationError) throw new Error(validationError);

  const { error } = await supabase.from('site_content').upsert(
    {
      section_key: GLOBAL_SECTION_KEY,
      content: normalized,
      version: 0,
      is_published: false,
      updated_by: actorUserId,
      updated_by_name: actorName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'section_key,is_published' },
  );

  if (error) throw new Error(formatSiteContentError(error.message));
  return normalized;
}

export async function publishSiteSettings(
  settings: SiteSettings,
  actorUserId: string | null,
  actorName: string,
  changeSummary: unknown,
) {
  const normalized = normalizeSiteSettings(settings);
  const validationError = validateSiteSettings(normalized);
  if (validationError) throw new Error(validationError);

  const { data: current } = await supabase
    .from('site_content')
    .select('version')
    .eq('section_key', GLOBAL_SECTION_KEY)
    .eq('is_published', true)
    .maybeSingle();

  const nextVersion = Number(current?.version ?? 0) + 1;
  const publishedAt = new Date().toISOString();

  const { error: upsertError } = await supabase.from('site_content').upsert(
    {
      section_key: GLOBAL_SECTION_KEY,
      content: normalized,
      version: nextVersion,
      is_published: true,
      updated_by: actorUserId,
      updated_by_name: actorName,
      updated_at: publishedAt,
    },
    { onConflict: 'section_key,is_published' },
  );

  if (upsertError) throw new Error(formatSiteContentError(upsertError.message));

  const { error: versionError } = await supabase.from('site_content_versions').insert({
    section_key: GLOBAL_SECTION_KEY,
    version_number: nextVersion,
    content: normalized,
    published_by: actorUserId,
    published_by_name: actorName,
    published_at: publishedAt,
    change_summary: changeSummary,
  });

  if (versionError) throw new Error(formatSiteContentError(versionError.message));

  await pruneSiteContentVersions();
  cachedSettings = normalized;
  cacheSiteSettings(normalized);
  applySiteSettings(normalized);
  return normalized;
}

export async function rollbackSiteSettings(
  version: SiteContentVersion,
  actorUserId: string | null,
  actorName: string,
) {
  return publishSiteSettings(version.content, actorUserId, actorName, {
    rollback_to_version: version.version_number,
  });
}

export function applySiteSettings(settings: SiteSettings) {
  const root = document.documentElement;
  const primaryScale = buildColorScale(settings.primaryColor);
  const accentScale = buildColorScale(settings.accentColor);

  Object.entries(primaryScale).forEach(([shade, rgb]) => {
    root.style.setProperty(`--color-brand-${shade}`, rgb);
  });
  Object.entries(accentScale).forEach(([shade, rgb]) => {
    root.style.setProperty(`--color-gold-${shade}`, rgb);
  });

  root.style.setProperty('--sfm-primary-color', settings.primaryColor);
  root.style.setProperty('--sfm-navigation-bar-color', settings.navigationBarColor);
  root.style.setProperty('--sfm-accent-color', settings.accentColor);
  root.style.setProperty('--sfm-button-hover-color', settings.buttonHoverColor);
  root.style.setProperty('--sfm-nav-link-hover-color', settings.navLinkHoverColor);
  root.style.setProperty('--sfm-page-bg', settings.pageBackgroundColor);
  root.style.setProperty('--sfm-surface-bg', settings.surfaceBackgroundColor);

  document.body.dataset.sfmHeadingScale = settings.headingScale;
  document.body.classList.toggle('sfm-hover-lift-off', !settings.hoverLiftEnabled);
  document.body.classList.toggle('sfm-hover-shadow-off', !settings.cardShadowHoverEnabled);
  document.body.classList.toggle('sfm-button-scale-on', settings.buttonScaleHoverEnabled);
  document.body.classList.toggle('sfm-button-shadow-off', !settings.buttonShadowHoverEnabled);
  document.body.classList.toggle('sfm-nav-hover-off', !settings.navLinkHoverEnabled);

  document.querySelectorAll<HTMLElement>('[data-site-text]').forEach((element) => {
    const key = element.dataset.siteText as keyof SiteSettings | undefined;
    if (key && typeof settings[key] === 'string') {
      element.textContent = String(settings[key]);
    }
  });

  document.querySelectorAll<HTMLImageElement>('[data-site-image]').forEach((element) => {
    const key = element.dataset.siteImage as keyof SiteSettings | undefined;
    if (key && typeof settings[key] === 'string' && settings[key]) {
      element.src = String(settings[key]);
    }
  });
}

export function validateSiteSettings(settings: SiteSettings) {
  for (const key of COLOR_KEYS) {
    if (!isHexColor(String(settings[key]))) {
      return `${formatSettingKey(key)} must be a valid hex color.`;
    }
  }

  if (!['small', 'medium', 'large'].includes(settings.headingScale)) {
    return 'Heading scale must be small, medium, or large.';
  }

  for (const [key, limit] of Object.entries(TEXT_LIMITS)) {
    const value = String(settings[key as keyof SiteSettings] ?? '');
    if (!value.trim()) return `${formatSettingKey(key)} cannot be empty.`;
    if (limit && value.length > limit) {
      return `${formatSettingKey(key)} must be ${limit} characters or fewer.`;
    }
  }

  for (const category of settings.categories) {
    if (!category.label.trim()) return `${category.key} category label cannot be empty.`;
    if (category.label.length > 32) return `${category.key} category label must be 32 characters or fewer.`;
    if (category.blurb.length > 80) return `${category.key} category blurb must be 80 characters or fewer.`;
  }

  for (const badge of settings.trustBadges) {
    if (!badge.title.trim()) return `${badge.key} trust badge title cannot be empty.`;
    if (!badge.description.trim()) return `${badge.key} trust badge description cannot be empty.`;
  }

  return null;
}

export function resetSettingsSection(
  settings: SiteSettings,
  section: 'colors' | 'text' | 'hover' | 'pages' | 'images' | 'style',
) {
  const nextSettings = normalizeSiteSettings(settings);
  const keys =
    section === 'colors' || section === 'style'
      ? ([
          ...COLOR_KEYS,
          'headingScale',
          'buttonScaleHoverEnabled',
          'buttonShadowHoverEnabled',
          'navLinkHoverEnabled',
          'hoverLiftEnabled',
          'cardShadowHoverEnabled',
        ] as Array<keyof SiteSettings>)
      : section === 'hover'
        ? ([
            'hoverLiftEnabled',
            'cardShadowHoverEnabled',
            'buttonScaleHoverEnabled',
            'buttonShadowHoverEnabled',
            'navLinkHoverEnabled',
          ] as Array<keyof SiteSettings>)
        : section === 'images'
          ? (['heroBackgroundImageUrl', 'decorativeImageUrl', 'categories', 'trustBadges'] as Array<keyof SiteSettings>)
          : ([
              ...Object.keys(TEXT_LIMITS),
              'footerCategories',
              'categories',
              'trustBadges',
            ] as Array<keyof SiteSettings>);

  keys.forEach((key) => {
    nextSettings[key] = DEFAULT_SITE_SETTINGS[key] as never;
  });

  return normalizeSiteSettings(nextSettings);
}

export function getCategoryContent(settings: SiteSettings, category: string) {
  return settings.categories.find((item) => item.key === category);
}

export function getCategoryDisplayLabel(settings: SiteSettings, category: string) {
  if (category === 'All') return settings.allCategoryLabel;
  return getCategoryContent(settings, category)?.label ?? category;
}

function cacheSiteSettings(settings: SiteSettings) {
  try {
    window.localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Cache is helpful, not required.
  }
}

async function pruneSiteContentVersions() {
  const versions = await fetchSiteContentVersions(10);
  const keepIds = versions.map((version) => version.id);
  if (keepIds.length < 10) return;

  await supabase
    .from('site_content_versions')
    .delete()
    .eq('section_key', GLOBAL_SECTION_KEY)
    .not('id', 'in', `(${keepIds.join(',')})`);
}

function mergeCategoryContent(categories?: CategoryContent[]) {
  return DEFAULT_CATEGORY_CONTENT.map((fallback) => ({
    ...fallback,
    ...(categories?.find((category) => category.key === fallback.key) ?? {}),
  }));
}

function mergeTrustBadges(badges?: TrustBadgeContent[]) {
  return DEFAULT_SITE_SETTINGS.trustBadges.map((fallback) => ({
    ...fallback,
    ...(badges?.find((badge) => badge.key === fallback.key) ?? {}),
  }));
}

function getCategoryLabel(settings: SiteSettings, category: string) {
  return settings.categories.find((item) => item.key === category)?.label ?? category;
}

function buildColorScale(hex: string) {
  return {
    50: hexToRgb(mixHex(hex, '#ffffff', 0.9)),
    100: hexToRgb(mixHex(hex, '#ffffff', 0.78)),
    200: hexToRgb(mixHex(hex, '#ffffff', 0.6)),
    300: hexToRgb(mixHex(hex, '#ffffff', 0.38)),
    400: hexToRgb(mixHex(hex, '#ffffff', 0.18)),
    500: hexToRgb(hex),
    600: hexToRgb(mixHex(hex, '#000000', 0.16)),
    700: hexToRgb(mixHex(hex, '#000000', 0.28)),
    800: hexToRgb(mixHex(hex, '#000000', 0.4)),
    900: hexToRgb(mixHex(hex, '#000000', 0.52)),
    950: hexToRgb(mixHex(hex, '#000000', 0.68)),
  };
}

function mixHex(baseHex: string, mixWithHex: string, amount: number) {
  const base = parseHex(baseHex);
  const mix = parseHex(mixWithHex);
  return rgbToHex(
    Math.round(base.r * (1 - amount) + mix.r * amount),
    Math.round(base.g * (1 - amount) + mix.g * amount),
    Math.round(base.b * (1 - amount) + mix.b * amount),
  );
}

function parseHex(hex: string) {
  const normalized = isHexColor(hex) ? hex.slice(1) : DEFAULT_SITE_SETTINGS.primaryColor.slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function hexToRgb(hex: string) {
  const color = parseHex(hex);
  return `${color.r} ${color.g} ${color.b}`;
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function formatSettingKey(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}

function formatSiteContentError(message: string) {
  if (message.includes("public.site_content") || message.includes('site_content')) {
    return 'Site content tables are missing in Supabase. Apply the site_content CMS migration, then publish again.';
  }

  if (message.includes('Bucket not found') || message.includes('site-assets')) {
    return 'Site asset storage is missing in Supabase. Apply the site-assets storage migration, then upload again.';
  }

  return message;
}
