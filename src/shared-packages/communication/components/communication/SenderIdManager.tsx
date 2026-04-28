import { useState } from 'react';
import { ShieldCheck, Plus, Trash2, CheckCircle2, Clock, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useSenderIdRequests,
  useCreateSenderIdRequest,
  useUpdateSenderIdRequest,
  useDeleteSenderIdRequest,
} from '../../hooks/useSenderIdRequests';

export function SenderIdManager() {
  const { currentOrganization, updateOrganization, refreshOrganizations } = useOrganization();
  const [open, setOpen] = useState(false);

  const [senderId, setSenderId] = useState('');
  const [reason, setReason] = useState(
    'Used to send order confirmations, product updates and other business notifications to our customers'
  );

  const { data: requests = [], isLoading, refetch, isRefetching } = useSenderIdRequests(currentOrganization?.id);
  const createRequest = useCreateSenderIdRequest();
  const updateRequest = useUpdateSenderIdRequest();
  const deleteRequest = useDeleteSenderIdRequest();

  // Add state to track which request is being edited
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [settingActiveId, setSettingActiveId] = useState<string | null>(null);

  const isValidSenderId = (id: string) => {
    const trimmed = id.trim();
    if (trimmed.length < 3 || trimmed.length > 11) return false;
    if (!/^[a-zA-Z0-9 ]+$/.test(trimmed)) return false;
    if (/^\d+$/.test(trimmed)) return false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentOrganization) return;

    const trimmedSenderId = senderId.trim();

    if (!isValidSenderId(trimmedSenderId)) {
      toast.error('Invalid Sender ID format.');
      return;
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    try {
      if (editingRequestId) {
        await updateRequest.mutateAsync({
          id: editingRequestId,
          organizationName: currentOrganization.name,
          senderId: trimmedSenderId,
          reason: reason.trim(),
        });
        setEditingRequestId(null);
      } else {
        await createRequest.mutateAsync({
          organizationId: currentOrganization.id,
          organizationName: currentOrganization.name,
          senderId: trimmedSenderId,
          reason: reason.trim(),
        });
      }

      setSenderId('');
      setReason('Used to send order confirmations, product updates and other business notifications to our customers');
    } catch (error) {
      // Error handled by hook toast
    }
  };

  const handleEditClick = (req: any) => {
    setSenderId(req.sender_id);
    setReason(req.reason);
    setEditingRequestId(req.id);
  };

  const handleCancelEdit = () => {
    setSenderId('');
    setReason('Used to send order confirmations, product updates and other business notifications to our customers');
    setEditingRequestId(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this Sender ID request?')) {
      try {
        await deleteRequest.mutateAsync(id);
        // After deletion, if it was the active one, the DB trigger will set the next active one.
        // We should refresh organization context to reflect any DB changes to sms_sender_id.
        setTimeout(() => refreshOrganizations(), 1000);
      } catch (error) {
        // Error handled by hook toast
      }
    }
  };

  const handleSetAsActive = async (newSenderId: string, reqId: string) => {
    if (!currentOrganization) return;

    setSettingActiveId(reqId);
    try {
      await updateOrganization({
        id: currentOrganization.id,
        sms_sender_id: newSenderId,
      });
      await refreshOrganizations();
      toast.success(`${newSenderId} is now your active Sender ID.`);
    } catch (error) {
      toast.error('Failed to update active Sender ID.');
    } finally {
      setSettingActiveId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ShieldCheck className="h-4 w-4" />
          Manage Sender IDs
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sender ID Management</DialogTitle>
          <DialogDescription>
            Request up to 3 custom Sender IDs. Approvals can take up to 72 hours.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Active Sender ID Banner */}
          <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Active Sender ID</p>
              <p className="text-xl font-bold text-primary">
                {/* @ts-ignore */}
                {currentOrganization?.sms_sender_id || (import.meta as any).env?.VITE_DEFAULT_SMS_SENDER_ID || 'FMTSoftware'}
              </p>
            </div>
            {!currentOrganization?.sms_sender_id && (
              <Badge variant="secondary">Global Default</Badge>
            )}
          </div>

          {/* List of existing requests */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Your Requests ({requests.length}/3)</h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => refetch()}
                disabled={isRefetching}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isRefetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading requests...</p>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">
                You haven't requested any custom Sender IDs yet.
              </p>
            ) : (
              requests.map((req) => {
                const isActive = req.sender_id === currentOrganization?.sms_sender_id;

                return (
                  <div key={req.id} className="border rounded-md p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{req.sender_id}</span>
                        {req.status === 'pending' && (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-600 bg-yellow-50">
                            <Clock className="h-3 w-3 mr-1" /> Pending
                          </Badge>
                        )}
                        {req.status === 'approved' && (
                          <Badge variant="outline" className="text-green-600 border-green-600 bg-green-50">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
                          </Badge>
                        )}
                        {req.status === 'rejected' && (
                          <Badge variant="outline" className="text-red-600 border-red-600 bg-red-50">
                            <XCircle className="h-3 w-3 mr-1" /> Rejected
                          </Badge>
                        )}
                        {isActive && (
                          <Badge className="bg-primary">Active</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1" title={req.reason}>
                        {req.reason}
                      </p>
                      {req.status === 'rejected' && req.rejection_reason && (
                        <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-100 p-2 rounded">
                          <strong>Rejection Reason:</strong> {req.rejection_reason}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-3 sm:mt-0">
                      {req.status === 'approved' && !isActive && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleSetAsActive(req.sender_id, req.id)}
                          disabled={settingActiveId === req.id}
                        >
                          {settingActiveId === req.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Setting...
                            </>
                          ) : (
                            'Use this'
                          )}
                        </Button>
                      )}
                      {req.status === 'rejected' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(req)}
                        >
                          Fix & Resubmit
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive h-8 w-8"
                        onClick={() => handleDelete(req.id)}
                        disabled={deleteRequest.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* New Request / Edit Form */}
          {(requests.length < 3 || editingRequestId) && (
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-semibold">
                  {editingRequestId ? 'Fix & Resubmit Sender ID' : 'Request New Sender ID'}
                </h4>
                {editingRequestId && (
                  <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                    Cancel Edit
                  </Button>
                )}
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="senderId">Sender ID (3-11 characters)</Label>
                  <Input
                    id="senderId"
                    placeholder="e.g. GraceChapel"
                    value={senderId}
                    onChange={(e: any) => setSenderId(e.target.value)}
                    maxLength={11}
                  />
                  <p className="text-xs text-muted-foreground">
                    Only letters and spaces allowed. No numbers-only or special characters.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason / Purpose</Label>
                  <Textarea
                    id="reason"
                    rows={3}
                    value={reason}
                    onChange={(e: any) => setReason(e.target.value)}
                    className="resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={!isValidSenderId(senderId) || !reason.trim() || createRequest.isPending || updateRequest.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {editingRequestId ? 'Resubmit Request' : 'Submit Request'}
                </Button>
              </form>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
