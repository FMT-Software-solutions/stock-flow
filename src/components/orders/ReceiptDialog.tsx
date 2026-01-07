import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Order } from '@/types/orders';
import { useOrganization } from '@/contexts/OrganizationContext';
import { format } from 'date-fns';
import { useCurrency } from '@/hooks/useCurrency';
import { Printer, Download } from 'lucide-react';
import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
}

export function ReceiptDialog({
  open,
  onOpenChange,
  order,
}: ReceiptDialogProps) {
  const { currentOrganization } = useOrganization();
  const { formatCurrency } = useCurrency();
  const contentRef = useRef<HTMLDivElement>(null);
  const paidAmount = Number(order.paid_amount ?? 0);
  const totalAmount = Number(order.total_amount ?? 0);
  const remainingAmount = Math.max(0, totalAmount - paidAmount);
  const customerName = order.customer
    ? `${order.customer.first_name || ''} ${
        order.customer.last_name || ''
      }`.trim() ||
      order.customer.name ||
      'Customer'
    : 'Walk-in Customer';
  const customerContact = order.customer?.phone || order.customer?.email || '';

  const handlePrint = useReactToPrint({
    contentRef: contentRef,
  });

  const handleSavePDF = async () => {
    if (!contentRef.current) return;

    try {
      const dataUrl = await toPng(contentRef.current, {
        quality: 1.0,
        backgroundColor: '#ffffff',
        pixelRatio: 2, // Higher resolution
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      // Calculate height maintaining aspect ratio
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      // Add image to PDF (centered horizontally if needed, or just top-left)
      // If content is smaller than page, we might want to center it or just place it
      // Here we scale to fit width
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);

      pdf.save(`receipt-${order.order_number}.pdf`);
      toast.success('Receipt saved as PDF');
    } catch (error) {
      console.error('Failed to generate PDF', error);
      toast.error('Failed to generate PDF');
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[95vh] overflow-auto">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-lg">Receipt Preview</h3>
        </div>

        <div
          className="border rounded-md p-6 bg-white text-black font-mono text-sm shadow-sm"
          ref={contentRef}
        >
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold mb-1">
              {currentOrganization?.name || 'Store Name'}
            </h2>
            <p className="text-xs text-gray-600">
              Location: {order.branch?.name || 'Main Branch'}
            </p>
            <p className="text-xs text-gray-600">
              Contact: {currentOrganization?.phone || '-'}
            </p>
            <div className="border-b-2 border-black my-3 w-full" />
          </div>

          <div className="flex justify-between mb-1">
            <span>Receipt #:</span>
            <span>{order.order_number}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span>Date:</span>
            <span>{format(new Date(order.date), 'MMMM dd, yyyy')}</span>
          </div>
          <div className="flex justify-between mb-4">
            <span>Time:</span>
            <span>{format(new Date(order.date), 'h:mm a')}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span>Customer:</span>
            <span>{customerName}</span>
          </div>
          {customerContact && (
            <div className="flex justify-between mb-4">
              <span>Contact:</span>
              <span>{customerContact}</span>
            </div>
          )}

          <div className="border-t border-dashed border-gray-400 my-2" />

          <div className="space-y-3">
            {order.items?.map((item) => (
              <div key={item.id}>
                <div className="flex justify-between font-bold">
                  <span>{item.product_name}</span>
                  <span>{formatCurrency(item.total_price)}</span>
                </div>
                <div className="text-gray-600 text-xs">
                  Qty: {item.quantity} × {formatCurrency(item.unit_price)}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-400 my-4" />

          <div className="flex justify-between text-lg font-bold">
            <span>TOTAL:</span>
            <span>{formatCurrency(order.total_amount)}</span>
          </div>
          <div className="flex justify-between mt-2">
            <span>PAID:</span>
            <span>{formatCurrency(paidAmount)}</span>
          </div>
          {remainingAmount > 0 && (
            <div className="flex justify-between">
              <span>REMAINING:</span>
              <span
                className={remainingAmount > 0 ? 'text-red-600 font-bold' : ''}
              >
                {formatCurrency(remainingAmount)}
              </span>
            </div>
          )}

          <div className="border-t border-dashed border-gray-400 my-4" />

          <div className="text-center text-xs mt-4">
            <p>Thank you for your business!</p>
            <p>Visit us again soon</p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            className="flex-1"
            onClick={() => handlePrint && handlePrint()}
          >
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button variant="outline" className="flex-1" onClick={handleSavePDF}>
            <Download className="mr-2 h-4 w-4" /> Save as PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
