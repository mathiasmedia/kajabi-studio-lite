/**
 * Base Theme Validator — Validates base theme zip availability, structure,
 * and readiness before export workflows depend on it.
 *
 * Fail-early principle: detect missing/invalid base theme at generation time,
 * not at export time.
 */
import JSZip from 'jszip';

// ─── Types ─────────────────────────────────────────────────

export type BaseThemeHealth = 'ready' | 'invalid' | 'missing' | 'checking';

export interface BaseThemeValidation {
  health: BaseThemeHealth;
  rootPrefix: string | null;
  diagnostics: BaseThemeDiagnostic[];
  checkedAt: string;
}

export interface BaseThemeDiagnostic {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

// ─── Constants ─────────────────────────────────────────────

export type BaseThemeName =
  | 'streamlined-home'
  | 'streamlined-home-pro'
  | 'encore-page'
  | 'encore-page-pro';

const BASE_THEME_URLS: Record<BaseThemeName, string> = {
  'streamlined-home': '/base-theme/streamlined-home.zip',
  'streamlined-home-pro': '/base-theme/streamlined-home-pro.zip',
  'encore-page': '/base-theme/encore-page.zip',
  'encore-page-pro': '/base-theme/encore-page-pro.zip',
};

const REQUIRED_FOLDERS_BY_THEME: Record<BaseThemeName, string[]> = {
  'streamlined-home': ['config', 'layouts', 'templates', 'sections'],
  'streamlined-home-pro': ['config', 'layouts', 'templates', 'sections'],
  'encore-page': ['config', 'templates', 'sections', 'snippets'],
  'encore-page-pro': ['config', 'templates', 'sections', 'snippets'],
};

const REQUIRED_FILES = ['config/settings_data.json'];
const EXPECTED_FOLDERS = ['snippets', 'assets'];

const JUNK_PATTERNS = ['__MACOSX', '.DS_Store', '/._', '/.'];
function isJunkFile(path: string): boolean {
  return JUNK_PATTERNS.some(p => path.includes(p)) || path.startsWith('._');
}

const cachedValidationByTheme = new Map<BaseThemeName, BaseThemeValidation>();
const cachedZipByTheme = new Map<BaseThemeName, JSZip>();

export function getCachedValidation(theme: BaseThemeName = 'streamlined-home'): BaseThemeValidation | null {
  return cachedValidationByTheme.get(theme) ?? null;
}

export function getCachedZip(theme: BaseThemeName = 'streamlined-home'): JSZip | null {
  return cachedZipByTheme.get(theme) ?? null;
}

export function clearCache(theme?: BaseThemeName): void {
  if (theme) {
    cachedValidationByTheme.delete(theme);
    cachedZipByTheme.delete(theme);
  } else {
    cachedValidationByTheme.clear();
    cachedZipByTheme.clear();
  }
}

function detectTopLevelFolder(zip: JSZip): string | null {
  const topLevel = new Set<string>();
  zip.forEach((relativePath) => {
    if (isJunkFile(relativePath)) return;
    const first = relativePath.split('/')[0];
    if (first) topLevel.add(first);
  });
  if (topLevel.size === 1) {
    const name = [...topLevel][0];
    if (Object.keys(zip.files).some(f => f.startsWith(name + '/'))) {
      return name + '/';
    }
  }
  return null;
}

export async function validateBaseTheme(
  themeOrForce: BaseThemeName | boolean = 'streamlined-home',
  forceRefreshArg = false,
): Promise<BaseThemeValidation> {
  let theme: BaseThemeName;
  let forceRefresh: boolean;
  if (typeof themeOrForce === 'boolean') {
    theme = 'streamlined-home';
    forceRefresh = themeOrForce;
  } else {
    theme = themeOrForce;
    forceRefresh = forceRefreshArg;
  }

  const cached = cachedValidationByTheme.get(theme);
  if (cached && !forceRefresh) return cached;

  const url = BASE_THEME_URLS[theme];
  const requiredFolders = REQUIRED_FOLDERS_BY_THEME[theme];
  const diagnostics: BaseThemeDiagnostic[] = [];

  let resp: Response;
  try {
    resp = await fetch(url);
  } catch (e) {
    const result: BaseThemeValidation = {
      health: 'missing',
      rootPrefix: null,
      diagnostics: [{ level: 'error', code: 'FETCH_FAILED', message: `Cannot reach base theme at ${url}: ${e}` }],
      checkedAt: new Date().toISOString(),
    };
    cachedValidationByTheme.set(theme, result);
    return result;
  }

  if (!resp.ok) {
    const result: BaseThemeValidation = {
      health: 'missing',
      rootPrefix: null,
      diagnostics: [{ level: 'error', code: 'HTTP_ERROR', message: `Base theme returned HTTP ${resp.status} ${resp.statusText}` }],
      checkedAt: new Date().toISOString(),
    };
    cachedValidationByTheme.set(theme, result);
    return result;
  }

  let zip: JSZip;
  try {
    const buf = await resp.arrayBuffer();
    zip = await JSZip.loadAsync(buf);
  } catch (e) {
    const result: BaseThemeValidation = {
      health: 'invalid',
      rootPrefix: null,
      diagnostics: [{ level: 'error', code: 'ZIP_PARSE_FAILED', message: `Base theme is not a valid zip file: ${e}` }],
      checkedAt: new Date().toISOString(),
    };
    cachedValidationByTheme.set(theme, result);
    return result;
  }

  const rootPrefix = detectTopLevelFolder(zip) || '';
  if (!rootPrefix) {
    diagnostics.push({ level: 'warning', code: 'NO_ROOT_FOLDER', message: `No single top-level folder detected. Expected a folder like ${theme}/.` });
  }

  for (const folder of requiredFolders) {
    const fullPath = rootPrefix + folder + '/';
    const hasFolder = Object.keys(zip.files).some(f => f.startsWith(fullPath));
    if (!hasFolder) {
      diagnostics.push({ level: 'error', code: 'MISSING_REQUIRED_FOLDER', message: `Missing required folder: ${folder}/` });
    }
  }

  for (const file of REQUIRED_FILES) {
    const fullPath = rootPrefix + file;
    if (!zip.files[fullPath]) {
      diagnostics.push({ level: 'error', code: 'MISSING_REQUIRED_FILE', message: `Missing required file: ${file}` });
    }
  }

  for (const folder of EXPECTED_FOLDERS) {
    const fullPath = rootPrefix + folder + '/';
    const hasFolder = Object.keys(zip.files).some(f => f.startsWith(fullPath));
    if (!hasFolder) {
      diagnostics.push({ level: 'warning', code: 'MISSING_EXPECTED_FOLDER', message: `Expected folder not found: ${folder}/ (non-blocking)` });
    }
  }

  const settingsPath = rootPrefix + 'config/settings_data.json';
  const settingsFile = zip.files[settingsPath];
  if (settingsFile) {
    try {
      const text = await settingsFile.async('text');
      const parsed = JSON.parse(text);
      if (!parsed.current) {
        diagnostics.push({ level: 'warning', code: 'SETTINGS_NO_CURRENT', message: 'settings_data.json has no "current" key' });
      }
      diagnostics.push({ level: 'info', code: 'SETTINGS_OK', message: 'settings_data.json is valid JSON with expected structure' });
    } catch (e) {
      diagnostics.push({ level: 'error', code: 'SETTINGS_INVALID_JSON', message: `settings_data.json is not valid JSON: ${e}` });
    }
  }

  let junkCount = 0;
  zip.forEach((path) => { if (isJunkFile(path)) junkCount++; });
  if (junkCount > 0) {
    diagnostics.push({ level: 'warning', code: 'JUNK_FILES', message: `Found ${junkCount} junk file(s) (__MACOSX, .DS_Store, etc.)` });
  }

  let fileCount = 0;
  zip.forEach((path, file) => { if (!file.dir && !isJunkFile(path)) fileCount++; });
  diagnostics.push({ level: 'info', code: 'FILE_COUNT', message: `Base theme contains ${fileCount} file(s)` });

  const hasErrors = diagnostics.some(d => d.level === 'error');
  const health: BaseThemeHealth = hasErrors ? 'invalid' : 'ready';

  const result: BaseThemeValidation = {
    health,
    rootPrefix,
    diagnostics,
    checkedAt: new Date().toISOString(),
  };

  cachedValidationByTheme.set(theme, result);
  cachedZipByTheme.set(theme, zip);
  return result;
}

export function getBaseThemeHealth(theme: BaseThemeName = 'streamlined-home'): BaseThemeHealth {
  const cached = cachedValidationByTheme.get(theme);
  if (cached) return cached.health;
  validateBaseTheme(theme).catch(() => {});
  return 'checking';
}

// Backwards-compat alias for older callers.
export type BaseTheme = BaseThemeName;
