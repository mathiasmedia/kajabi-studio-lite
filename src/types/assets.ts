// ===== Project Asset Model =====

export interface AssetUsageReference {
  sectionId: string;
  blockId: string;
  settingKey: string; // e.g. 'image', 'background_image'
}

export interface ProjectAsset {
  assetId: string;
  projectId: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  storagePath: string; // path in storage bucket
  previewUrl: string;  // public URL for preview
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
