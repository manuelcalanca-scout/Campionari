import React from 'react';
import type { HeaderData } from '../types';
import { ImageUploader } from './ImageUploader';
import { ArrowLeftIcon, DownloadIcon, SpinnerIcon, TrashIcon } from './icons';

interface HeaderProps {
  supplierName: string;
  onSupplierNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  data: HeaderData;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBusinessCardChange: (file: File | null) => void;
  onBack: () => void;
  onExport: () => void;
  isExporting: boolean;
  onDelete: () => void;
}

interface InputFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}

const InputField: React.FC<InputFieldProps> = ({ label, name, value, onChange, placeholder }) => (
    <div className="flex flex-col">
        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">{label}</label>
        <input
            type="text"
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder || '...'}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-full focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-black bg-white"
        />
    </div>
);

export const Header: React.FC<HeaderProps> = ({ supplierName, onSupplierNameChange, data, onChange, onBusinessCardChange, onBack, onExport, isExporting, onDelete }) => {
  const handleFactoryTypeClick = (e: React.MouseEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    if (input.value === data.factoryType) {
      // This radio is already checked. Clicking it again should uncheck it.
      // We simulate an onChange event with an empty value.
      const syntheticEvent = {
        target: { name: 'factoryType', value: '' },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }
  };

  return (
    <div className="p-4 sm:p-6 border-b-4 border-black relative">
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <button 
          onClick={onBack} 
          className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all"
          aria-label="Back to suppliers list"
        >
          <ArrowLeftIcon />
          <span>Back</span>
        </button>
        <button
            onClick={onExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 transition-all disabled:bg-green-400 disabled:cursor-not-allowed"
            aria-label="Export to Excel"
        >
            {isExporting ? <SpinnerIcon /> : <DownloadIcon />}
            <span>{isExporting ? 'Exporting...' : 'Export to Excel'}</span>
        </button>
      </div>
      
      <button
        onClick={onDelete}
        className="absolute top-4 right-4 p-2 text-gray-600 bg-gray-100 rounded-full hover:bg-red-100 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 transition-all"
        aria-label="Delete supplier"
      >
        <TrashIcon />
      </button>


      <div className="mt-20">
        <div className="mb-6">
          <label htmlFor="supplierName" className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-1">Supplier Name</label>
          <input
            id="supplierName"
            type="text"
            value={supplierName}
            onChange={onSupplierNameChange}
            placeholder="Enter supplier name"
            className="w-full text-2xl font-bold text-gray-800 border-b-2 border-gray-300 focus:border-blue-500 outline-none pb-1 transition-colors bg-white"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Business Card Section */}
          <div className="border border-gray-300 p-4 bg-gray-50 rounded-md">
            <ImageUploader 
                label="Business Card"
                image={data.businessCard}
                onImageSelect={onBusinessCardChange}
                className="h-full min-h-[200px]"
              />
          </div>

          {/* Form Section */}
          <div className="border border-gray-300 p-4 rounded-md flex flex-col justify-between">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <InputField label="Date" name="date" value={data.date} onChange={onChange} />
              <div className="flex items-center justify-end pt-5 space-x-4">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">TYPE</span>
                <div className="flex items-center">
                  <input 
                    id="factoryTypeTrading"
                    type="radio" 
                    name="factoryType" 
                    value="TRADING"
                    checked={data.factoryType === 'TRADING'} 
                    onChange={onChange}
                    onClick={handleFactoryTypeClick}
                    className="h-4 w-4 focus:ring-blue-500 text-blue-600 border-gray-300"
                  />
                  <label htmlFor="factoryTypeTrading" className="ml-2 text-sm text-gray-800">Trading</label>
                </div>
                <div className="flex items-center">
                  <input 
                    id="factoryTypeFactory"
                    type="radio" 
                    name="factoryType" 
                    value="FACTORY"
                    checked={data.factoryType === 'FACTORY'} 
                    onChange={onChange}
                    onClick={handleFactoryTypeClick}
                    className="h-4 w-4 focus:ring-blue-500 text-blue-600 border-gray-300"
                  />
                  <label htmlFor="factoryTypeFactory" className="ml-2 text-sm text-gray-800">Factory</label>
                </div>
              </div>
              <InputField label="Booth #" name="booth" value={data.booth} onChange={onChange} />
              <InputField label="Made In" name="madeIn" value={data.madeIn} onChange={onChange} />
              <InputField label="N. of Samples" name="numSamples" value={data.numSamples} onChange={onChange} />
              <InputField label="Samples Arriving Date" name="samplesArrivingDate" value={data.samplesArrivingDate} onChange={onChange} />
            </div>
            <div className="mt-4">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 block">Notes</label>
              <textarea 
                  name="notes"
                  value={data.notes}
                  onChange={onChange}
                  rows={4}
                  className="w-full text-sm p-2 border border-gray-300 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors duration-300 rounded-md text-black bg-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};