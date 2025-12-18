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
}

export interface ExportOptions {
  filename?: string;
  title?: string;
  description?: string;
  orientation?: 'portrait' | 'landscape';
}

export function useExport() {
  const exportToCsv = useCallback((data: any[], fields: ExportField[], filename: string = 'export') => {
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

    const csvContent = [
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

  const exportToExcel = useCallback((data: any[], fields: ExportField[], filename: string = 'export') => {
    const exportData = data.map(row => {
      const newRow: Record<string, any> = {};
      fields.forEach(field => {
        const value = field.accessorFn ? field.accessorFn(row) : row[field.id];
        newRow[field.label] = value;
      });
      return newRow;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }, []);

  const exportToPdf = useCallback((data: any[], fields: ExportField[], options: ExportOptions = {}) => {
    const { filename = 'export', title, orientation = 'portrait' } = options;
    const doc = new jsPDF({ orientation });

    if (title) {
      doc.setFontSize(18);
      doc.text(title, 14, 22);
    }

    const headers = fields.map(f => f.label);
    const rows = data.map(row => 
      fields.map(field => {
        const value = field.accessorFn ? field.accessorFn(row) : row[field.id];
        if (value instanceof Date) return value.toLocaleDateString();
        if (typeof value === 'object' && value !== null) return JSON.stringify(value);
        return value;
      })
    );

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: title ? 30 : 20,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
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
