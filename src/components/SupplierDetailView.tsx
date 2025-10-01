import React, { useState } from 'react';
import type { Supplier, ImageFile } from '../types';
import { Header } from './Header';
import { ItemList } from './ItemList';
import { Modal } from './Modal';
import { googleDrive } from '../services/googleDrive';

interface SupplierDetailViewProps {
  supplier: Supplier;
  onSupplierNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onHeaderChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBusinessCardChange: (file: File | null) => void;
  onItemChange: (itemId: string, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onAddItemImages: (itemId: string, files: FileList | null) => void;
  onRemoveItemImage: (supplierId: string, itemId: string, index: number) => void;
  onAddItem: () => void;
  onRemoveItem: (supplierId: string, itemId: string) => void;
  onRemoveSupplier: (supplierId: string) => void;
  onBack: () => void;
}

// Declare ExcelJS to be available on the window object
declare const ExcelJS: any;

export const SupplierDetailView: React.FC<SupplierDetailViewProps> = ({
  supplier,
  onSupplierNameChange,
  onHeaderChange,
  onBusinessCardChange,
  onItemChange,
  onAddItemImages,
  onRemoveItemImage,
  onAddItem,
  onRemoveItem,
  onRemoveSupplier,
  onBack,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleDeleteClick = () => {
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    onRemoveSupplier(supplier.id);
    // The view will change automatically via the useEffect in App.tsx
    setIsDeleteModalOpen(false);
  };

  const closeModal = () => {
    setIsDeleteModalOpen(false);
  };

  // Funzione per precaricare tutte le immagini prima dell'export
  const preloadAllImages = async (supplier: Supplier): Promise<Supplier> => {
    console.log('📤 Preloading images for Excel export...');

    // Precarica business card
    let businessCard = supplier.headerData.businessCard;
    if (businessCard && businessCard.driveFileId && !businessCard.dataUrl) {
      console.log('📤 Preloading business card:', businessCard.name);
      businessCard = await googleDrive.loadImageData(businessCard);
    }

    // Precarica immagini degli item
    const items = await Promise.all(
      supplier.items.map(async (item) => {
        const images = await Promise.all(
          item.images.map(async (image) => {
            if (image.driveFileId && !image.dataUrl) {
              console.log('📤 Preloading item image:', image.name);
              return await googleDrive.loadImageData(image);
            }
            return image;
          })
        );
        return { ...item, images };
      })
    );

    console.log('📤 All images preloaded for export');
    return {
      ...supplier,
      headerData: {
        ...supplier.headerData,
        businessCard
      },
      items
    };
  };

  const handleExport = async () => {
    setIsExporting(true);

    // Precarica tutte le immagini prima dell'export (fuori dal try block)
    const supplierWithImages = await preloadAllImages(supplier);

    try {
      if (typeof ExcelJS === 'undefined') {
        alert('ExcelJS library not loaded. Please check your internet connection and try again.');
        setIsExporting(false);
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(supplierWithImages.name.replace(/[\\/*?[\]:]/g, '').substring(0, 31));

      // --- STYLING ---
      const BOLD_STYLE = { font: { bold: true, size: 14 }, alignment: { vertical: 'middle' } };
      const NORMAL_STYLE = { font: { size: 13 }, alignment: { vertical: 'middle', wrapText: false } };
      const THICK_BLACK_BORDER = { style: 'thick', color: { argb: 'FF000000' } };
      const THIN_BLACK_BORDER = { style: 'thin', color: { argb: 'FF000000' } };
      const DASHED_BLACK_BORDER = { style: 'dashed', color: { argb: 'FF000000' } };
      
      const CHECKBOX_STYLE = { 
          font: { size: 14 }, 
          alignment: { vertical: 'middle', horizontal: 'center' },
          border: {
              top: THIN_BLACK_BORDER,
              left: THIN_BLACK_BORDER,
              bottom: THIN_BLACK_BORDER,
              right: THIN_BLACK_BORDER,
          }
      };
      
      const SECTION_HEADER_STYLE = { font: { bold: true, size: 16 }, alignment: { vertical: 'middle', horizontal: 'center' } };

      const applyOuterBorder = (startRow: number, startCol: number, endRow: number, endCol: number, border: any) => {
        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const cell = worksheet.getCell(r, c);
                cell.border = cell.border || {};
                if (r === startRow) cell.border.top = border;
                if (r === endRow) cell.border.bottom = border;
                if (c === startCol) cell.border.left = border;
                if (c === endCol) cell.border.right = border;
            }
        }
      };
      
      const calculateDynamicHeight = (text: string, charsPerLine: number): number => {
        const baseHeight = 20; // Base height for a single line in points
        const lineHeight = 18; // Approx height per line for font size 13
        if (!text || text.trim() === '') {
            return baseHeight;
        }
        const manualLines = text.split('\n');
        const totalLines = manualLines.reduce((acc, line) => {
            // Each line is at least 1 line high, plus wrapped lines
            return acc + Math.max(1, Math.ceil(line.length / charsPerLine));
        }, 0);

        const height = totalLines * lineHeight;
        return Math.max(baseHeight, height); // Ensure a minimum height and return calculated
      };


      // --- LAYOUT & SIZING ---
       worksheet.columns = [
        // A-F Business Card
        { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 },
        // G Spacer
        { width: 3 },
        // H-P Details
        { width: 32 }, // H: Labels, increased for SAMPLES ARRIVING DATE
        { width: 15 }, // I: Values
        { width: 15 }, // J: Values
        { width: 15 }, // K: Values
        { width: 15 }, // L: Values
        { width: 15 }, // M: Values
        { width: 12 }, // N: TRADING/FACTORY Label
        { width: 6 },  // O: Checkbox
        { width: 6 },  // P: End of block margin
    ];
      
      // Hide gridlines for a cleaner, print-like appearance
      worksheet.views = [{ showGridLines: false }];

      // --- HEADER SECTION ---

      // --- Right Block: Details (drawn first to determine height) ---
      let headerCurrentRow = 2;

      // Row 2: Date & Trading
      worksheet.getCell(`H${headerCurrentRow}`).value = 'DATE';
      worksheet.getCell(`H${headerCurrentRow}`).style = BOLD_STYLE;
      worksheet.mergeCells(`I${headerCurrentRow}:L${headerCurrentRow}`);
      worksheet.getCell(`I${headerCurrentRow}`).value = supplierWithImages.headerData.date;
      worksheet.getCell(`I${headerCurrentRow}`).style = NORMAL_STYLE;
      worksheet.getCell(`L${headerCurrentRow}`).border = { bottom: DASHED_BLACK_BORDER };

      worksheet.getCell(`N${headerCurrentRow}`).value = 'TRADING';
      worksheet.getCell(`N${headerCurrentRow}`).style = { ...BOLD_STYLE, alignment: { ...BOLD_STYLE.alignment, horizontal: 'left' }};
      const tradingCheckbox = worksheet.getCell(`O${headerCurrentRow}`);
      tradingCheckbox.style = CHECKBOX_STYLE;
      if (supplierWithImages.headerData.factoryType === 'TRADING') tradingCheckbox.value = '✓';
      
      headerCurrentRow++; // Row 3
      worksheet.getCell(`N${headerCurrentRow}`).value = 'FACTORY';
      worksheet.getCell(`N${headerCurrentRow}`).style = { ...BOLD_STYLE, alignment: { ...BOLD_STYLE.alignment, horizontal: 'left' }};
      const factoryCheckbox = worksheet.getCell(`O${headerCurrentRow}`);
      factoryCheckbox.style = CHECKBOX_STYLE;
      if (supplierWithImages.headerData.factoryType === 'FACTORY') factoryCheckbox.value = '✓';

      headerCurrentRow += 1; // Row 4: Booth - Reduced spacing as requested
      worksheet.getCell(`H${headerCurrentRow}`).value = 'BOOTH #';
      worksheet.getCell(`H${headerCurrentRow}`).style = BOLD_STYLE;
      worksheet.mergeCells(`I${headerCurrentRow}:M${headerCurrentRow}`);
      worksheet.getCell(`I${headerCurrentRow}`).value = supplierWithImages.headerData.booth;
      worksheet.getCell(`I${headerCurrentRow}`).style = NORMAL_STYLE;
      worksheet.getCell(`M${headerCurrentRow}`).border = { bottom: DASHED_BLACK_BORDER };
      
      headerCurrentRow += 2; // Row 6: Made In
      worksheet.getCell(`H${headerCurrentRow}`).value = 'MADE IN';
      worksheet.getCell(`H${headerCurrentRow}`).style = BOLD_STYLE;
      worksheet.mergeCells(`I${headerCurrentRow}:M${headerCurrentRow}`);
      worksheet.getCell(`I${headerCurrentRow}`).value = supplierWithImages.headerData.madeIn;
      worksheet.getCell(`I${headerCurrentRow}`).style = NORMAL_STYLE;
      worksheet.getCell(`M${headerCurrentRow}`).border = { bottom: DASHED_BLACK_BORDER };
      
      headerCurrentRow += 2; // Row 8: N. of Samples
      worksheet.getCell(`H${headerCurrentRow}`).value = 'N. OF SAMPLES';
      worksheet.getCell(`H${headerCurrentRow}`).style = BOLD_STYLE;
      worksheet.mergeCells(`I${headerCurrentRow}:M${headerCurrentRow}`);
      worksheet.getCell(`I${headerCurrentRow}`).value = supplierWithImages.headerData.numSamples;
      worksheet.getCell(`I${headerCurrentRow}`).style = NORMAL_STYLE;
      worksheet.getCell(`M${headerCurrentRow}`).border = { bottom: DASHED_BLACK_BORDER };

      headerCurrentRow += 2; // Row 10: Samples Arriving Date (now one line)
      worksheet.getCell(`H${headerCurrentRow}`).value = 'SAMPLES ARRIVING DATE';
      worksheet.getCell(`H${headerCurrentRow}`).style = BOLD_STYLE;
      worksheet.mergeCells(`I${headerCurrentRow}:M${headerCurrentRow}`);
      worksheet.getCell(`I${headerCurrentRow}`).value = supplierWithImages.headerData.samplesArrivingDate;
      worksheet.getCell(`I${headerCurrentRow}`).style = NORMAL_STYLE;
      worksheet.getCell(`M${headerCurrentRow}`).border = { bottom: DASHED_BLACK_BORDER };
      
      headerCurrentRow += 2; // Row 12: Notes
      const notesRowNumber = headerCurrentRow;
      const notesRow = worksheet.getRow(notesRowNumber);

      // Calculate and set dynamic height
      const headerNotesCharsPerLine = 85; // Approx chars for columns I-O
      notesRow.height = calculateDynamicHeight(supplierWithImages.headerData.notes, headerNotesCharsPerLine);
      
      worksheet.getCell(`H${notesRowNumber}`).value = 'NOTES';
      worksheet.getCell(`H${notesRowNumber}`).style = { ...BOLD_STYLE, alignment: { ...BOLD_STYLE.alignment, vertical: 'top' } };
      
      worksheet.mergeCells(`I${notesRowNumber}:O${notesRowNumber}`);
      const noteCell = worksheet.getCell(`I${notesRowNumber}`);
      noteCell.value = supplierWithImages.headerData.notes;
      noteCell.style = { 
          font: { size: 13 },
          alignment: { wrapText: true, vertical: 'top' }
      };

      const headerBlockEndRow = notesRowNumber;

      // --- Left Block: Business Card ---
      worksheet.mergeCells('A1:F1');
      worksheet.getCell('A1').value = 'BUSINESS CARD';
      worksheet.getCell('A1').style = SECTION_HEADER_STYLE;

      if (supplierWithImages.headerData.businessCard) {
        const imageId = workbook.addImage({
          base64: supplierWithImages.headerData.businessCard.dataUrl,
          extension: supplierWithImages.headerData.businessCard.type.split('/')[1] || 'png',
        });
        worksheet.addImage(imageId, `A2:F${headerBlockEndRow}`);
      }
      
      // --- Apply Outer Borders ---
      applyOuterBorder(1, 1, headerBlockEndRow, 6, THICK_BLACK_BORDER); // A-F
      applyOuterBorder(1, 8, headerBlockEndRow, 16, THICK_BLACK_BORDER); // H-P

      let currentRow = headerBlockEndRow + 1;

      // --- ITEMS SECTION ---
      for (const [index, item] of supplierWithImages.items.entries()) {
        const itemStartRow = currentRow;
        // Separator
        worksheet.mergeCells(`A${itemStartRow}:P${itemStartRow}`);
        worksheet.getRow(itemStartRow).getCell(1).border = { bottom: THICK_BLACK_BORDER };
        currentRow += 2;
        
        const itemHeaderRow = currentRow;
        worksheet.mergeCells(itemHeaderRow, 1, itemHeaderRow, 5);
        const itemHeaderCell = worksheet.getRow(itemHeaderRow).getCell(1);
        itemHeaderCell.value = `ITEM ${index + 1}`;
        itemHeaderCell.style = { font: { bold: true, size: 16 }, alignment: { vertical: 'middle' }};
        currentRow++;

        const fieldsStartRow = currentRow;
        
        const addItemField = (label: string, value: string, startCol: number, endCol: number) => {
            const row = worksheet.getRow(currentRow);
            const labelCell = row.getCell(startCol);
            labelCell.value = label;
            labelCell.style = BOLD_STYLE;
            
            worksheet.mergeCells(currentRow, startCol + 1, currentRow, endCol);
            const valueCell = row.getCell(startCol + 1);
            valueCell.value = value;
            valueCell.style = NORMAL_STYLE;
            valueCell.border = { bottom: DASHED_BLACK_BORDER };
        };
        
        addItemField('ITEM', item.itemCode, 1, 8); // A-H
        currentRow++;
        addItemField('DESCRIPTION', item.description, 1, 8); // A-H
        currentRow++;
        
        // Side by side fields
        addItemField('MOQ', item.moq, 1, 4); // A-D
        addItemField('DELIVERY', item.delivery, 5, 8); // E-H
        currentRow++;
        
        addItemField('PRICE', item.price, 1, 4); // A-D
        addItemField('COMPOSITION', item.composition, 5, 8); // E-H
        currentRow++;
        
        const itemNotesRowNumber = currentRow;
        const itemNotesRow = worksheet.getRow(itemNotesRowNumber);

        const itemNotesCharsPerLine = 100; // Approx chars for columns B-H
        itemNotesRow.height = calculateDynamicHeight(item.notes, itemNotesCharsPerLine);
        
        itemNotesRow.getCell(1).value = 'NOTES';
        itemNotesRow.getCell(1).style = { ...BOLD_STYLE, alignment: { vertical: 'top' } };
        worksheet.mergeCells(itemNotesRowNumber, 2, itemNotesRowNumber, 8);
        const itemNotesCell = itemNotesRow.getCell(2);
        itemNotesCell.value = item.notes;
        itemNotesCell.style = {
            font: { size: 13 },
            alignment: { wrapText: true, vertical: 'top' },
            border: { bottom: DASHED_BLACK_BORDER }
        };

        const textBlockEndRow = itemNotesRowNumber;

        // --- IMAGES ---
        const imageStartColNum = 9; // Column I
        let imageBlockEndRow = fieldsStartRow;

        if (item.images.length > 0) {
            const imagesPerRow = 4;
            const rowsPerImage = 14;
            const numImageRows = Math.ceil(item.images.length / imagesPerRow);
            imageBlockEndRow = fieldsStartRow + (numImageRows * rowsPerImage) - 1;

            item.images.forEach((image, imgIdx) => {
                const rowOffset = Math.floor(imgIdx / imagesPerRow);
                const colOffset = imgIdx % imagesPerRow;
                
                const imgRow = fieldsStartRow + (rowOffset * rowsPerImage);
                const imgCol = imageStartColNum + colOffset * 2; // Leave space between images

                const imageExt = image.type.split('/')[1] || 'png';
                const imageId = workbook.addImage({ base64: image.dataUrl, extension: imageExt as 'jpeg' | 'png' | 'gif' });
                
                worksheet.addImage(imageId, {
                  tl: { col: imgCol - 1, row: imgRow - 1 },
                  ext: { width: 200, height: 200 }
                });
            });
        }
        
        currentRow = Math.max(textBlockEndRow, imageBlockEndRow) + 2;
      }

      // --- GENERATE & DOWNLOAD ---
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheet.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${supplierWithImages.name || 'supplier'}_spec_sheet.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert(`An error occurred while exporting the file. See console for details.\n${(error as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={closeModal}
        onConfirm={confirmDelete}
        title="Delete Supplier"
      >
        Are you sure you want to delete this supplier and all its data? This action cannot be undone.
      </Modal>
      <main className="max-w-7xl mx-auto bg-white shadow-2xl rounded-lg overflow-hidden border border-gray-200">
        <Header
          supplierName={supplier.name}
          onSupplierNameChange={onSupplierNameChange}
          data={supplier.headerData}
          onChange={onHeaderChange}
          onBusinessCardChange={onBusinessCardChange}
          onBack={onBack}
          onExport={handleExport}
          isExporting={isExporting}
          onDelete={handleDeleteClick}
        />
        <ItemList
          supplierId={supplier.id}
          items={supplier.items}
          onItemChange={onItemChange}
          onAddItemImages={onAddItemImages}
          onRemoveItemImage={onRemoveItemImage}
          onAddItem={onAddItem}
          onRemoveItem={onRemoveItem}
        />
      </main>
    </>
  );
};