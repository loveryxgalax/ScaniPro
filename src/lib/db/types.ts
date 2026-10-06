import type { CustodyAction } from '../core/types';

export type CaseRow = {
  id: string;
  title: string;
  reference: string | null;
  matter_date: string | null;
  notes: string | null;
  next_exhibit_number: number;
  created_at: string;
  updated_at: string;
};

export type CaseSummary = CaseRow & { exhibit_count: number; page_count: number; last_activity: string | null };

export type OcrStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';
export type ExhibitSource = 'scan' | 'book' | 'photos' | 'files';
export type ExhibitKind = 'pages' | 'pdf';

export type ExhibitRow = {
  id: string;
  case_id: string;
  number: number;
  title: string;
  page_count: number;
  captured_at: string;
  capture_digest: string;
  current_version_id: string | null;
  ocr_status: OcrStatus;
  source: ExhibitSource;
  kind: ExhibitKind;
  deleted_at: string | null;
  purged_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExhibitListItem = ExhibitRow & {
  current_sha256: string | null;
  current_version: number | null;
  first_page_path: string | null;
};

export type PageRow = {
  id: string;
  exhibit_id: string;
  page_index: number;
  original_path: string;
  sha256: string;
  width: number;
  height: number;
  bytes: number;
  ocr_text: string | null;
  ocr_lines: string | null;
};

export type VersionKind = 'original' | 'derived';

export type VersionRow = {
  id: string;
  exhibit_id: string;
  version: number;
  kind: VersionKind;
  parent_version_id: string | null;
  file_path: string;
  sha256: string;
  bytes: number;
  description: string;
  annotations: string | null;
  created_at: string;
};

export type CustodyRow = {
  id: number;
  exhibit_id: string;
  case_id: string;
  seq: number;
  timestamp: string;
  action: CustodyAction;
  details: string;
  device_model: string;
  os_name: string;
  os_version: string;
  app_version: string;
  app_build: string;
  file_sha256: string;
  prev_entry_hash: string;
  entry_hash: string;
};

export type SearchHit = {
  exhibit_id: string;
  case_id: string;
  page_index: number;
  exhibit_title: string;
  exhibit_number: number;
  case_title: string;
  snippet: string;
};
