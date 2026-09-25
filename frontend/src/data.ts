export type DocStatus = 'Active' | 'Outdated' | 'Superseded';
export type ComplianceStatus = 'Compliant' | 'Needs Review' | 'Contradiction';

export interface DocumentRecord {
  id: string;
  docNumber: string;
  title: string;
  category: string;
  department: string;
  complianceScore: number;
  uploadDate: string;
  validity: DocStatus;
  compliance: ComplianceStatus;
}

export const mockDocuments: DocumentRecord[] = [
  { id: '1', docNumber: '#DOC-10245', title: '2026 Vendor IT Guidelines', category: 'Vendor Guidelines', department: 'Information Technology', complianceScore: 98, uploadDate: '18 min ago', validity: 'Active', compliance: 'Compliant' },
  { id: '2', docNumber: '#DOC-10244', title: 'Q3 Office Procurement Memo', category: 'Office Memoranda', department: 'Procurement', complianceScore: 85, uploadDate: '25 min ago', validity: 'Active', compliance: 'Compliant' },
  { id: '3', docNumber: '#DOC-10243', title: 'Standard Bidding Rules v2', category: 'Bidding Procedures', department: 'Legal & Compliance', complianceScore: 42, uploadDate: '1 hr ago', validity: 'Outdated', compliance: 'Needs Review' },
  { id: '4', docNumber: '#DOC-10242', title: 'Software Licensing Policy', category: 'Procurement Policy', department: 'Information Technology', complianceScore: 100, uploadDate: '3 hrs ago', validity: 'Active', compliance: 'Compliant' },
  { id: '5', docNumber: '#DOC-10241', title: 'Hardware Vendor Contracts', category: 'Contract Compliance', department: 'Legal & Compliance', complianceScore: 12, uploadDate: 'Yesterday', validity: 'Superseded', compliance: 'Contradiction' },
  { id: '6', docNumber: '#DOC-10240', title: 'Security Audit Guidelines', category: 'Vendor Guidelines', department: 'Security', complianceScore: 65, uploadDate: 'Yesterday', validity: 'Outdated', compliance: 'Needs Review' },
];

export const mockDepartments = [
  { id: '1', name: 'Procurement', head: 'Sarah Jenkins', docs: 145 },
  { id: '2', name: 'Legal & Compliance', head: 'Marcus Cole', docs: 89 },
  { id: '3', name: 'Finance', head: 'David Chen', docs: 36 },
  { id: '4', name: 'Information Technology', head: 'Amanda Reed', docs: 42 },
];

export const chartData = [
  { name: 'Mon', new: 240, review: 120 },
  { name: 'Tue', new: 300, review: 180 },
  { name: 'Wed', new: 280, review: 150 },
  { name: 'Thu', new: 380, review: 210 },
  { name: 'Fri', new: 320, review: 190 },
  { name: 'Sat', new: 180, review: 90 },
  { name: 'Sun', new: 210, review: 110 },
];

export const radarData = [
  { subject: 'Policies', A: 120, B: 110, fullMark: 150 },
  { subject: 'Vendor', A: 98, B: 130, fullMark: 150 },
  { subject: 'Contracts', A: 86, B: 130, fullMark: 150 },
  { subject: 'Memos', A: 99, B: 100, fullMark: 150 },
  { subject: 'Bidding', A: 85, B: 90, fullMark: 150 },
  { subject: 'Finance', A: 65, B: 85, fullMark: 150 },
];

// Replicating the visual reference calendar blocks
export const calendarDays = [
  { date: null, type: 'empty' }, { date: null, type: 'empty' },
  { date: 1, type: 'working' }, { date: 2, type: 'working' }, { date: 3, type: 'working' }, { date: 4, type: 'off' }, { date: 5, type: 'off' },
  { date: 6, type: 'working' }, { date: 7, type: 'working' }, { date: 8, type: 'working' }, { date: 9, type: 'off' }, { date: 10, type: 'working' }, { date: 11, type: 'off' }, { date: 12, type: 'working' },
  { date: 13, type: 'working' }, { date: 14, type: 'working' }, { date: 15, type: 'working' }, { date: 16, type: 'working' }, { date: 17, type: 'off' }, { date: 18, type: 'off' }, { date: 19, type: 'off' },
  { date: 20, type: 'working' }, { date: 21, type: 'working' }, { date: 22, type: 'working' }, { date: 23, type: 'off' }, { date: 24, type: 'working' }, { date: 25, type: 'working' }, { date: 26, type: 'off' },
  { date: 27, type: 'off' }, { date: 28, type: 'working' }, { date: 29, type: 'working' }, { date: 30, type: 'working' }, { date: 31, type: 'working' },
];
