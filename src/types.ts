export interface ImageFile {
  // Formato legacy: immagine base64 inline
  dataUrl?: string;

  // Formato ottimizzato: riferimento a file su Drive
  driveFileId?: string;

  // Proprietà comuni
  name: string;
  type: string;

  // Flag per indicare se l'immagine è stata caricata da Drive
  isLoaded?: boolean;
}

export interface Item {
  id: string;
  itemCode: string;
  description: string;
  moq: string;
  delivery: string;
  price: string;
  composition: string;
  notes: string;
  images: ImageFile[];
}

export interface HeaderData {
  businessCard: ImageFile | null;
  date: string;
  booth: string;
  madeIn: string;
  numSamples: string;
  samplesArrivingDate: string;
  notes: string;
  factoryType: 'TRADING' | 'FACTORY' | '';
  itemOrder?: string[]; // Array of item IDs to preserve custom order
}

export interface Supplier {
  id: string;
  name: string;
  headerData: HeaderData;
  items: Item[];
}