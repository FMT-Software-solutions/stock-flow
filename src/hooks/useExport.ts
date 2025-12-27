import { useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';

export type ExportFormat = 'csv' | 'excel' | 'pdf' | 'image' | 'print';

export interface ExportField {
  id: string;
  label: string;
  accessorFn?: (row: any) => any;
  isSelectedByDefault?: boolean;
  type?: 'text' | 'image' | 'number' | 'currency' | 'date';
}

const getDataUri = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
};

export interface ExportOptions {
  filename?: string;
  title?: string;
  description?: string;
  organizationName?: string;
  orientation?: 'portrait' | 'landscape';
}

export function useExport() {
  const exportToCsv = useCallback((data: any[], fields: ExportField[], options: ExportOptions | string = 'export') => {
    const { filename = 'export', title, description, organizationName } = 
      typeof options === 'string' ? { filename: options } : options;

    const headers = fields.map(f => f.label);
    const rows = data.map(row => 
      fields.map(field => {
        const value = field.accessorFn ? field.accessorFn(row) : row[field.id];
        // Handle objects/arrays by stringifying or specific logic
        if (typeof value === 'object' && value !== null) {
          if (value instanceof Date) return value.toLocaleDateString();
          return JSON.stringify(value);
        }
        return value;
      })
    );

    const metadata: string[] = [];
    if (organizationName) metadata.push(`Organization: ${organizationName}`);
    if (title) metadata.push(`Title: ${title}`);
    if (description) metadata.push(`Description: ${description}`);
    if (metadata.length > 0) metadata.push('');

    const csvContent = [
      ...metadata,
      headers.join(','),
      ...rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, []);

  const exportToExcel = useCallback((data: any[], fields: ExportField[], options: ExportOptions | string = 'export') => {
    const { filename = 'export', title, description, organizationName } = 
      typeof options === 'string' ? { filename: options } : options;

    const exportData = data.map(row => {
      const newRow: Record<string, any> = {};
      fields.forEach(field => {
        const value = field.accessorFn ? field.accessorFn(row) : row[field.id];
        newRow[field.label] = value;
      });
      return newRow;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([]); // Create empty sheet

    const metadata: string[][] = [];
    if (organizationName) metadata.push([`Organization: ${organizationName}`]);
    if (title) metadata.push([`Title: ${title}`]);
    if (description) metadata.push([`Description: ${description}`]);
    if (metadata.length > 0) metadata.push([]);

    XLSX.utils.sheet_add_aoa(ws, metadata, { origin: 'A1' });
    XLSX.utils.sheet_add_json(ws, exportData, { origin: `A${metadata.length + 1}`, skipHeader: false });

    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }, []);

  const exportToPdf = useCallback(async (data: any[], fields: ExportField[], options: ExportOptions = {}) => {
    const { filename = 'export', title, description, organizationName, orientation = 'portrait' } = options;
    const doc = new jsPDF({ orientation });

    let currentY = 15;

    if (organizationName) {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(organizationName, 14, currentY);
      currentY += 10;
    }

    if (title) {
      doc.setFontSize(18);
      doc.setTextColor(0);
      doc.text(title, 14, currentY);
      currentY += 10;
    }

    if (description) {
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(description, 14, currentY);
      currentY += 10;
    }

    const startY = currentY + 5;

    const headers = fields.map(f => f.label);
    
    // Pre-process rows to handle images
    const rows = await Promise.all(data.map(async row => {
      return await Promise.all(fields.map(async field => {
        const value = field.accessorFn ? field.accessorFn(row) : row[field.id];
        
        if (field.type === 'image' && typeof value === 'string' && value.startsWith('http')) {
           const base64 = await getDataUri(value);
           return { content: '', image: base64 };
        }

        if (value instanceof Date) return value.toLocaleDateString();
        if (typeof value === 'object' && value !== null) return JSON.stringify(value);
        return value;
      }));
    }));

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: startY,
      theme: 'grid',
      styles: { fontSize: 8, minCellHeight: 10 },
      headStyles: { fillColor: [41, 128, 185] },
      didDrawCell: (data) => {
        if (data.section === 'body') {
           const field = fields[data.column.index];
           if (field.type === 'image') {
              const cellRaw = data.cell.raw as any;
              if (cellRaw && cellRaw.image) {
                 const dim = data.cell.height - 2;
                 try {
                   doc.addImage(cellRaw.image, 'JPEG', data.cell.x + 1, data.cell.y + 1, dim, dim);
                 } catch (e) {
                   console.error('Error adding image to PDF', e);
                 }
              }
           }
        }
      }
    });

    doc.save(`${filename}.pdf`);
  }, []);

  const exportToImage = useCallback(async (elementId: string, filename: string = 'export') => {
    const element = document.getElementById(elementId);
    if (!element) return;

    try {
      const dataUrl = await toPng(element, { quality: 0.95, backgroundColor: 'white' });
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export image:', err);
    }
  }, []);

  // For print, we usually use the hook directly in the component, but we can return a helper
  // or the user uses useReactToPrint in the component. 
  // Here we can provide a trigger function if we pass the ref.
  // But useReactToPrint is a hook itself.
  
  return {
    exportToCsv,
    exportToExcel,
    exportToPdf,
    exportToImage,
  };
}
