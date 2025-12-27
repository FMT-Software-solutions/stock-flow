import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Printer, FileSpreadsheet, FileText, Image as ImageIcon } from 'lucide-react';
import { useExport, type ExportFormat, type ExportField } from '@/hooks/useExport';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';

interface ExportDialogProps {
  data: any[];
  fields: ExportField[];
  trigger?: React.ReactNode;
  defaultFilename?: string;
  printRef?: React.RefObject<HTMLDivElement | null>; // For printing a specific component
}

export function ExportDialog({
  data,
  fields,
  trigger,
  defaultFilename = 'export',
  printRef,
}: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [format, setFormat] = useState<ExportFormat>('excel');
  const [filename, setFilename] = useState(defaultFilename);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  
  const { currentOrganization } = useOrganization();
  const { exportToCsv, exportToExcel, exportToPdf, exportToImage } = useExport();

  // Initialize selected fields with default selected fields
  useEffect(() => {
    if (open) {
      setSelectedFields(fields.filter(f => f.isSelectedByDefault !== false).map(f => f.id));
    }
  }, [open, fields]);

  const handlePrint = useReactToPrint({
    contentRef: printRef || { current: null }, // This needs to be handled carefully
    documentTitle: filename,
    onAfterPrint: () => toast.success('Print started'),
  });

  const handleExport = async () => {
    if (selectedFields.length === 0) {
      toast.error('Please select at least one field to export');
      return;
    }

    setIsExporting(true);
    const fieldsToExport = fields.filter(f => selectedFields.includes(f.id));
    const options = {
      filename,
      title,
      description,
      organizationName: currentOrganization?.name,
    };

    try {
      switch (format) {
        case 'csv':
          exportToCsv(data, fieldsToExport, options);
          break;
        case 'excel':
          exportToExcel(data, fieldsToExport, options);
          break;
        case 'pdf':
          await exportToPdf(data, fieldsToExport, options);
          break;
        case 'image':
          // For image, we usually need a DOM element.
          // If printRef is provided, we can try to use it, but it might be hidden.
          // Or we render a preview and export that.
          // For now, let's warn if no element is available or we need to rethink image export for raw data.
          if (printRef?.current) {
             await exportToImage(printRef.current.id, filename);
          } else {
             toast.error('Image export requires a visible view. Please use the Print option to save as PDF/Image.');
             return; 
          }
          break;
        case 'print':
          if (printRef?.current) {
            handlePrint();
          } else {
            // If no printRef, maybe we construct a printable table?
            // react-to-print works on a ref.
            // We might need to render a hidden table to print.
            toast.error('Print requires a printable view.');
            return;
          }
          break;
      }
      toast.success('Export successful');
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const toggleField = (id: string) => {
    setSelectedFields(prev => 
      prev.includes(id) 
        ? prev.filter(f => f !== id)
        : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedFields.length === fields.length) {
      setSelectedFields([]);
    } else {
      setSelectedFields(fields.map(f => f.id));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="ml-auto hidden h-8 lg:flex">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>Export Data</DialogTitle>
          <DialogDescription>
            Choose format and fields to export.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="filename" className="text-right">
              Filename
            </Label>
            <Input
              id="filename"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="col-span-3"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="format" className="text-right">
              Format
            </Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excel">
                  <div className="flex items-center">
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
                  </div>
                </SelectItem>
                <SelectItem value="csv">
                  <div className="flex items-center">
                    <FileText className="mr-2 h-4 w-4" /> CSV
                  </div>
                </SelectItem>
                <SelectItem value="pdf">
                  <div className="flex items-center">
                    <FileText className="mr-2 h-4 w-4" /> PDF
                  </div>
                </SelectItem>
                {/* Only show Print/Image if printRef is available, or we handle it otherwise */}
                {printRef && (
                  <>
                    <SelectItem value="print">
                      <div className="flex items-center">
                        <Printer className="mr-2 h-4 w-4" /> Print
                      </div>
                    </SelectItem>
                    <SelectItem value="image">
                      <div className="flex items-center">
                        <ImageIcon className="mr-2 h-4 w-4" /> Image
                      </div>
                    </SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3"
              placeholder="Optional title"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3"
              placeholder="Optional description"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Fields</Label>
              <Button variant="ghost" size="sm" onClick={toggleAll} className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground">
                {selectedFields.length === fields.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <ScrollArea className="h-50 rounded-md border p-4">
              <div className="space-y-4">
                {fields.map((field) => (
                  <div key={field.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`field-${field.id}`} 
                      checked={selectedFields.includes(field.id)}
                      onCheckedChange={() => toggleField(field.id)}
                    />
                    <Label htmlFor={`field-${field.id}`} className="text-sm font-normal cursor-pointer">
                      {field.label}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isExporting}>Cancel</Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
