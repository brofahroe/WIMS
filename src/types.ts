export type TaggingType = "LOGFILE" | "LEFTOVERS";

export type TransactionType =
  | "INBOUND"
  | "OUTBOUND"
  | "BORROW IN"
  | "BORROW OUT"
  | "TRANSFER IN"
  | "TRANSFER OUT"
  | "RETURN IN"
  | "RETURN OUT";

export interface WarehouseOption {
  whId: string | null;
  whGci: string | null;
  picWh: string | null;
}

export interface MasterData {
  transactionTypes: string[];
  taggingTypes: string[];
  units: string[];
  sources: string[];
  typeMaterials: string[];
  conditions: string[];
  warehouses: WarehouseOption[];
  labelPrefixes: Array<{ material: string | null; prefix: string | null }>;
  cableRolls: string[];
  materialMilestones: string[];
}

export interface MaterialItem {
  rowId: string | null;
  typeMaterial: string | null;
  sourceMaterial: string | null;
  materialCode: string | null;
  materialName: string | null;
  unit: string | null;
  inbound: number;
  outbound: number;
  transferIn: number;
  transferOut: number;
  borrowIn: number;
  borrowOut: number;
  stockWh: number;
  leftoversStock: number;
  addRemark: string | null;
}

export interface DeliveryOrder {
  id?: number;
  siteId: string | null;
  siteName: string | null;
  subcon: string | null;
  region: string | null;
  city: string | null;
  dropCity: string | null;
  doNumber: string | null;
  dnNumber: string | null;
  materialPickUpdate: string | null;
  materialName: string | null;
  qty: number;
}

export interface SiteItem {
  id?: number;
  no: number | string | null;
  region: string | null;
  city: string | null;
  siteId: string | null;
  siteName: string | null;
  address: string | null;
  team: string | null;
  permit: string | null;
  snd: string | null;
  donation: string | null;
  implementation: string | null;
  atp: string | null;
  acceptance: string | null;
  finalMilestone: string | null;
  materialRequest: string | null;
  milestoneByZte: string | null;
  projectName: string | null;
  statusCity: string | null;
  materials: Record<string, number>;
}

export interface TransactionRecord {
  id: string;
  source: "logfile" | "leftovers" | "temp";
  rowId: string | null;
  tagId?: string | null;
  lineId: number | string | null;
  taggingType: TaggingType;
  transactionType: string | null;
  notaNo: string | null;
  whGci: string | null;
  picWarehouse: string | null;
  date: string | null;
  time: string | null;
  sourceDestination: string | null;
  typeMaterial: string | null;
  materialName: string | null;
  materialCode: string | null;
  unit: string | null;
  qty: number;
  siteId: string | null;
  siteName: string | null;
  doNumber: string | null;
  dnNumber: string | null;
  condition: string | null;
  picDelivery: string | null;
  vendorSupplier: string | null;
  idCard: string | null;
  carPlate: string | null;
  remarks: string | null;
  taggingManual?: string | null;
  cableLengthMarker?: string | null;
  cableRoll?: string | null;
  inOutQty?: number | string | null;
  loCriteria?: string | null;
  drumNumber?: string | null;
}

export interface SeedData {
  sourceWorkbook: string;
  generatedAt: string;
  master: MasterData;
  materials: MaterialItem[];
  deliveryOrders: DeliveryOrder[];
  sites: SiteItem[];
  logRows: TransactionRecord[];
  leftoverRows: TransactionRecord[];
}

export interface InventoryRow extends MaterialItem {
  inboundCalc: number;
  outboundCalc: number;
  transferInCalc: number;
  transferOutCalc: number;
  borrowInCalc: number;
  borrowOutCalc: number;
  returnInCalc: number;
  returnOutCalc: number;
  stockWhCalc: number;
  leftoversStockCalc: number;
}

export interface TransactionFormState {
  taggingType: TaggingType;
  transactionType: string;
  notaNo: string;
  whGci: string;
  date: string;
  time: string;
  sourceDestination: string;
  materialName: string;
  qty: string;
  siteName: string;
  condition: string;
  picDelivery: string;
  vendorSupplier: string;
  idCard: string;
  carPlate: string;
  remarks: string;
  doNumber?: string;
  dnNumber?: string;
  drumNumber?: string;
}

export interface ActionEvent {
  id: string;
  at: string;
  user: string;
  action: string;
  details: string;
  status: "SUCCESS" | "WARNING" | "INFO";
}

export type ViewKey = "dashboard" | "transactions" | "inventory" | "logfile" | "sites" | "nota" | "material" | "report" | "leftovers" | "material_history" | "delivery_orders";

export type UserRole = "Admin" | "Manager" | "Staff Gudang";

export interface User {
  id: string;
  email: string;
  role: UserRole;
}
