
export interface ReportType {
  code: string;
  name: string;
}


export const ADMIN_ALL_TYPE = 'admin-all';

export interface ReportFilters {
  from?: string;      
  to?: string;         
  status?: string;     
  spaceId?: string;
  resourceId?: string;
  userId?: string;
  careerId?: string;
}

export interface ReportRow {
  code: string;
  requester: string;
  date: string;        
  startTime: string;   
  endTime: string;    
  space: string;
  resources: string;
  reason: string;
  status: string;
  statusText: string;  
  requestDate: string; 
}

export interface ReportPreview {
  total: number;       
  rows: ReportRow[];
}

export interface ReportFile {
  blob: Blob;
  fileName: string;
}