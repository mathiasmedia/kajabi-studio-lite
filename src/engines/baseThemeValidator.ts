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

export type BaseTheme = 'streamlined-home' | 'encore-page';
export const DEFAULT_BASE_THEME: BaseTheme = 'streamlined-home';

const BASE_THEME_URLS: Record<BaseTheme, string> = {
  'streamlined-home': '/base-theme/streamlined-home.zip',
  'encore-page': '/base-theme/encore-landing-page.zip',
};

const REQUIRED_FOLDERS = ['config', 'layouts', 'templates', 'sections'];
const REQUIRED_FILES = ['config/settings_data.json'];
const EXPECTED_FOLDERS = ['snippets', 'assets'];

const JUNK_PATTERNS = ['__MACOSX', '.DS_Store', '/._', '/.'];
function isJunkFile(path: string): boolean {
  return JUNK_PATTERNS.some(p => path.includes(p)) || path.startsWith('._');
}

// ─── Per-theme Cache ───────────────────────────────────────

const cachedValidations = new Map<BaseTheme, BaseThemeValidation>();
const cachedZips = new Map<BaseTheme, JSZip>();

export function getCachedValidation(theme: BaseTheme = DEFAULT_BASE_THEME): BaseThemeValidation | null {
  return cachedValidations.get(theme) ?? null;
}

export function getCachedZip(theme: BaseTheme = DEFAULT_BASE_THEME): JSZip | null {
  return cachedZips.get(theme) ?? null;
}

export function clearCache(theme?: BaseTheme): void {
  if (theme) {
    cachedValidations.delete(theme);
    cachedZips.delete(theme);
  } else {
    cachedValidations.clear();
    cachedZips.clear();
  }
}

// ─── Detection ─────────────────────────────────────────────

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

// ─── Validation ────────────────────────────────────────────

/**
 * Validate the base theme zip. Fetches it, parses it, checks structure.
 * Caches the result so subsequent calls are instant.
 */
export async function validateBaseTheme(
  themeOrForce: BaseTheme | boolean = DEFAULT_BASE_THEME,
  forceRefresh = false,
): Promise<BaseThemeValidation> {
  // Backwards compat: validateBaseTheme(true) === force refresh of default theme
  let theme: BaseTheme;
  let force: boolean;
  if (typeof themeOrForce === 'boolean') {
    theme = DEFAULT_BASE_THEME;
    force = themeOrForce;
  } else {
    theme = themeOrForce;
    force = forceRefresh;
  }

  const existing = cachedValidations.get(theme);
  if (existing && !force) return existing;

  const themeUrl = BASE_THEME_URLS[theme];
  const diagnostics: BaseThemeDiagnostic[] = [];

  // 1. Fetch the zip
  let resp: Response;
  try {
    resp = await fetch(themeUrl);
  } catch (e) {
    const result: BaseThemeValidation = {
      health: 'missing',
      rootPrefix: null,
      diagnostics: [{
        level: 'error',
        code: 'FETCH_FAILED',
        message: `Cannot reach base theme at ${themeUrl}: ${e}`,
      }],
      checkedAt: new Date().toISOString(),
    };
    cachedValidations.set(theme, result);
    return result;
  }

  if (!resp.ok) {
    const result: BaseThemeValidation = {
      health: 'missing',
      rootPrefix: null,
      diagnostics: [{
        level: 'error',
        code: 'HTTP_ERROR',
        message: `Base theme returned HTTP ${resp.status} ${resp.statusText}`,
      }],
      checkedAt: new Date().toISOString(),
    };
    cachedValidations.set(theme, result);
    return result;
  }

  // 2. Parse the zip
  let zip: JSZip;
  try {
    const buf = await resp.arrayBuffer();
    zip = await JSZip.loadAsync(buf);
  } catch (e) {
    const result: BaseThemeValidation = {
      health: 'invalid',
      rootPrefix: null,
      diagnostics: [{
        level: 'error',
        code: 'ZIP_PARSE_FAILED',
        message: `Base theme is not a valid zip file: ${e}`,
      }],
      checkedAt: new Date().toISOString(),
    };
    cachedValidations.set(theme, result);
    return result;
  }

  // 3. Detect root folder
  const rootPrefix = detectTopLevelFolder(zip) || '';
  if (!rootPrefix) {
    diagnostics.push({
      level: 'warning',
      code: 'NO_ROOT_FOLDER',
      message: `No single top-level folder detected. Expected a folder like ${theme}/.`,
    });
  }

  // 4. Check required folders
  for (const folder of REQUIRED_FOLDERS) {
    const fullPath = rootPrefix + folder + '/';
    const hasFolder = Object.keys(zip.files).some(f => f.startsWith(fullPath));
    if (!hasFolder) {
      diagnostics.push({
        level: 'error',
        code: 'MISSING_REQUIRED_FOLDER',
        message: `Missing required folder: ${folder}/`,
      });
    }
  }

  // 5. Check required files
  for (const file of REQUIRED_FILES) {
    const fullPath = rootPrefix + file;
    if (!zip.files[fullPath]) {
      diagnostics.push({
        level: 'error',
        code: 'MISSING_REQUIRED_FILE',
        message: `Missing required file: ${file}`,
      });
    }
  }

  // 6. Check expected (non-blocking) folders
  for (const folder of EXPECTED_FOLDERS) {
    const fullPath = rootPrefix + folder + '/';
    const hasFolder = Object.keys(zip.files).some(f => f.startsWith(fullPath));
    if (!hasFolder) {
      diagnostics.push({
        level: 'warning',
        code: 'MISSING_EXPECTED_FOLDER',
        message: `Expected folder not found: ${folder}/ (non-blocking)`,
      });
    }
  }

  // 7. Validate settings_data.json is parseable
  const settingsPath = rootPrefix + 'config/settings_data.json';
  const settingsFile = zip.files[settingsPath];
  if (settingsFile) {
    try {
      const text = await settingsFile.async('text');
      const parsed = JSON.parse(text);
      if (!parsed.current) {
        diagnostics.push({
          level: 'warning',
          code: 'SETTINGS_NO_CURRENT',
          message: 'settings_data.json has no "current" key',
        });
      }
      diagnostics.push({
        level: 'info',
        code: 'SETTINGS_OK',
        message: 'settings_data.json is valid JSON with expected structure',
      });
    } catch (e) {
      diagnostics.push({
        level: 'error',
        code: 'SETTINGS_INVALID_JSON',
        message: `settings_data.json is not valid JSON: ${e}`,
      });
    }
  }

  // 8. Check for junk files
  let junkCount = 0;
  zip.forEach((path) => {
    if (isJunkFile(path)) junkCount++;
  });
  if (junkCount > 0) {
    diagnostics.push({
      level: 'warning',
      code: 'JUNK_FILES',
      message: `Found ${junkCount} junk file(s) (__MACOSX, .DS_Store, etc.)`,
    });
  }

  // 9. Count real files
  let fileCount = 0;
  zip.forEach((path, file) => {
    if (!file.dir && !isJunkFile(path)) fileCount++;
  });
  diagnostics.push({
    level: 'info',
    code: 'FILE_COUNT',
    message: `Base theme contains ${fileCount} file(s)`,
  });

  // Determine health
  const hasErrors = diagnostics.some(d => d.level === 'error');
  const health: BaseThemeHealth = hasErrors ? 'invalid' : 'ready';

  const result: BaseThemeValidation = {
    health,
    rootPrefix,
    diagnostics,
    checkedAt: new Date().toISOString(),
  };

  cachedValidations.set(theme, result);
  cachedZips.set(theme, zip);
  return result;
}

// ─── Quick health check (non-blocking) ────────────────────

/**
 * Returns the cached health or triggers a background check.
 * Never blocks — returns 'checking' if no cached result exists yet.
 */
export function getBaseThemeHealth(theme: BaseTheme = DEFAULT_BASE_THEME): BaseThemeHealth {
  const cached = cachedValidations.get(theme);
  if (cached) return cached.health;
  // Trigger background validation
  validateBaseTheme(theme).catch(() => {});
  return 'checking';
}
