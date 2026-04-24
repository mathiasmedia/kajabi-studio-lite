/**
 * Asset Manager — pure pipeline functions used by the export engine.
 *
 * NOTE: Upload/download/delete via remote storage are intentionally NOT
 * included in milestone 1. Lovable Cloud (Supabase) wiring will be added
 * later when the builder needs persistent assets. Until then, callers must
 * provide pre-resolved `ProjectAsset` objects (with a usable `previewUrl`
 * — typically a blob: or data: URL).
 */
import type {
  ProjectAsset,
  AssetUsageReference,
  AssetValidationIssue,
} from '@/types/assets';

// ---- Binding ----

export function bindAssetToBlock(
  asset: ProjectAsset,
  sectionId: string,
  blockId: string,
  settingKey: string,
): ProjectAsset {
  const usage: AssetUsageReference = { sectionId, blockId, settingKey };
  const exists = asset.usages.some(
    (u) =>
      u.sectionId === sectionId &&
      u.blockId === blockId &&
      u.settingKey === settingKey,
  );
  if (!exists) {
    return { ...asset, usages: [...asset.usages, usage] };
  }
  return asset;
}

export function unbindAssetFromBlock(
  asset: ProjectAsset,
  sectionId: string,
  blockId: string,
  settingKey: string,
): ProjectAsset {
  return {
    ...asset,
    usages: asset.usages.filter(
      (u) =>
        !(
          u.sectionId === sectionId &&
          u.blockId === blockId &&
          u.settingKey === settingKey
        ),
    ),
  };
}

// ---- Resolution ----

/**
 * Resolve asset references in settings_data for preview.
 * Replaces `asset:<uuid>` references with each asset's previewUrl.
 */
export function resolveAssetsForPreview(
  settingsData: Record<string, unknown>,
  assets: ProjectAsset[],
): Record<string, unknown> {
  const assetMap = new Map(
    assets.map((a) => [`asset:${a.assetId}`, a.previewUrl]),
  );
  const json = JSON.stringify(settingsData);
  const resolved = json.replace(
    /asset:[0-9a-f-]{36}/g,
    (match) => assetMap.get(match) || match,
  );
  return JSON.parse(resolved);
}

/**
 * Resolve asset references for export. Returns a new settings_data with
 * `asset:<uuid>` references rewritten to theme-relative `assets/<id>.<ext>`,
 * plus a map describing which source URL each export path came from.
 */
export function resolveAssetsForExport(
  settingsData: Record<string, unknown>,
  assets: ProjectAsset[],
): {
  resolvedSettings: Record<string, unknown>;
  assetExportMap: Map<string, { storagePath: string; exportPath: string }>;
} {
  const assetExportMap = new Map<
    string,
    { storagePath: string; exportPath: string }
  >();
  const json = JSON.stringify(settingsData);

  const resolved = json.replace(/asset:[0-9a-f-]{36}/g, (match) => {
    const asset = assets.find((a) => `asset:${a.assetId}` === match);
    if (!asset) return match;

    const ext = asset.originalFileName.split('.').pop() || 'png';
    const exportFileName = `${asset.assetId}.${ext}`;
    const exportPath = `assets/${exportFileName}`;

    assetExportMap.set(asset.assetId, {
      // `storagePath` here is reused as the source URL we'll fetch from in
      // milestone 1 — typically a blob: URL produced from a File the user
      // dragged in, or the asset's previewUrl.
      storagePath: asset.previewUrl || asset.storagePath,
      exportPath,
    });

    return exportPath;
  });

  return {
    resolvedSettings: JSON.parse(resolved),
    assetExportMap,
  };
}

/**
 * Fetch an asset's bytes for inclusion in the export zip.
 * In milestone 1 this fetches via the browser (blob:/http(s):/data: URLs).
 * When Lovable Cloud is wired, swap this to pull from Supabase Storage.
 */
export async function downloadAssetBlob(
  sourceUrl: string,
): Promise<Uint8Array> {
  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(
      `Failed to download asset from ${sourceUrl}: ${res.status} ${res.statusText}`,
    );
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

// ---- Validation ----

export function validateAssets(
  settingsData: Record<string, unknown>,
  assets: ProjectAsset[],
): AssetValidationIssue[] {
  const issues: AssetValidationIssue[] = [];
  const json = JSON.stringify(settingsData);
  const assetRefs = json.match(/asset:[0-9a-f-]{36}/g) || [];
  const uniqueRefs = [...new Set(assetRefs)];

  for (const ref of uniqueRefs) {
    const assetId = ref.replace('asset:', '');
    const asset = assets.find((a) => a.assetId === assetId);
    if (!asset) {
      issues.push({
        type: 'missing_asset',
        assetId,
        message: `Settings reference asset ${assetId} but it's not in the asset list`,
      });
    }
  }

  for (const asset of assets) {
    const ref = `asset:${asset.assetId}`;
    if (!json.includes(ref) && asset.usages.length === 0) {
      issues.push({
        type: 'orphaned_asset',
        assetId: asset.assetId,
        message: `Asset "${asset.originalFileName}" is uploaded but not used anywhere`,
      });
    }
  }

  const exportNames = new Map<string, string>();
  for (const asset of assets) {
    const ext = asset.originalFileName.split('.').pop() || 'png';
    const exportName = `${asset.assetId}.${ext}`;
    if (exportNames.has(exportName)) {
      issues.push({
        type: 'name_collision',
        assetId: asset.assetId,
        message: `Export name collision: ${exportName}`,
      });
    }
    exportNames.set(exportName, asset.assetId);
  }

  return issues;
}

// ---- Usage Index ----

export function getAssetsForSection(
  assets: ProjectAsset[],
  sectionId: string,
): ProjectAsset[] {
  return assets.filter((a) =>
    a.usages.some((u) => u.sectionId === sectionId),
  );
}

export function getSectionsUsingAsset(asset: ProjectAsset): string[] {
  return [...new Set(asset.usages.map((u) => u.sectionId))];
}
