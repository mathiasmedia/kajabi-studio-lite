// ===== Project Asset Model =====

export interface AssetUsageReference {
  sectionId: string;
  blockId: string;
  settingKey: string;
}

export interface ProjectAsset {
  assetId: string;
  projectId: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  previewUrl: string;
  createdAt: string;
  usages: AssetUsageReference[];
}

export interface AssetValidationIssue {
  type: 'missing_asset' | 'broken_binding' | 'orphaned_asset' | 'name_collision' | 'missing_for_export';
  assetId?: string;
  sectionId?: string;
  blockId?: string;
  settingKey?: string;
  message: string;
}
