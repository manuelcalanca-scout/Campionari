export interface ImageFile {
  dataUrl: string;
  name: string;
  type: string;
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
}

export interface Supplier {
  id: string;
  name: string;
  headerData: HeaderData;
  items: Item[];
}