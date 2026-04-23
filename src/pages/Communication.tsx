import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, Mail, Phone, History, Send, CreditCard, Edit } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useCustomers } from '@/hooks/useCustomerQueries';
import { useSuppliers } from '@/hooks/useInventoryQueries';

import {
  MessageTypeSelector,
  RecipientSelector,
  MessageComposer,
  BestPractices,
  SenderIdManager,
  SmsCreditWidget,
  useVerifySmsPurchase,
  useCommunicationTemplates,
  useCommunicationHistory,
  useCreateCommunicationHistory,
  sendSmsMessage,
  TransactionHistory,
  TemplateFormDrawer,
  type CommunicationTemplate,
  type CommunicationHistory,
  type PersonalizationTag
} from '@/shared-packages/communication';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

const STOCK_FLOW_TAGS: PersonalizationTag[] = [
  { tag: '{c_first_name}', label: 'Customer First Name', description: "Customer's first name" },
  { tag: '{c_last_name}', label: 'Customer Last Name', description: "Customer's last name" },
  { tag: '{c_phone}', label: 'Customer Phone', description: "Customer's phone number" },
  { tag: '{c_email}', label: 'Customer Email', description: "Customer's email address" },
  { tag: '{s_name}', label: 'Supplier Name', description: "Supplier's company name" },
  { tag: '{s_contact_person}', label: 'Supplier Contact Person', description: "Supplier's contact person" },
  { tag: '{s_email}', label: 'Supplier Email', description: "Supplier's email address" },
  { tag: '{s_phone}', label: 'Supplier Phone', description: "Supplier's phone number" },
  { tag: '{organization_name}', label: 'Organization Name', description: "Your organization's name" },
  { tag: '{organization_email}', label: 'Organization Email', description: "Your organization's email" },
  { tag: '{organization_phone}', label: 'Organization Phone', description: "Your organization's phone number" },
  { tag: '{organization_address}', label: 'Organization Address', description: "Your organization's address" },
];

export function Communication() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'compose');
  const verifyPurchaseMutation = useVerifySmsPurchase();
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading: isLoadingCustomers } = useCustomers(currentOrganization?.id);
  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useSuppliers(currentOrganization?.id);

  const [messageType, setMessageType] = useState<'email' | 'sms'>('sms');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const [selectAllCustomers, setSelectAllCustomers] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);

  const [selectAllSuppliers, setSelectAllSuppliers] = useState(false);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);

  const [additionalRecipients, setAdditionalRecipients] = useState<string>('');
  const [recipientSearch, setRecipientSearch] = useState('');

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: dbTemplates = [] } = useCommunicationTemplates();
  const { data: dbHistory = [] } = useCommunicationHistory();
  const createHistoryMutation = useCreateCommunicationHistory();

  const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  useEffect(() => {
    const fullUrl = new URL(window.location.href);
    const urlParams = new URLSearchParams(fullUrl.search || window.location.search);

    const verifyPayment = urlParams.get('verify_payment') || searchParams.get('verify_payment');
    const reference = urlParams.get('reference') || urlParams.get('trxref') || searchParams.get('reference') || searchParams.get('trxref');
    const amountGhs = urlParams.get('amount') || searchParams.get('amount');
    const creditsPurchased = urlParams.get('credits') || searchParams.get('credits');
    const orgName = urlParams.get('org_name') || searchParams.get('org_name');
    const appName = urlParams.get('app_name') || searchParams.get('app_name');

    if (!currentOrganization?.id || !user?.id) return;

    if (verifyPayment === 'true' && reference && amountGhs && creditsPurchased) {
      const verify = async () => {
        try {
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('verify_payment');
          newParams.delete('reference');
          newParams.delete('trxref');
          newParams.delete('amount');
          newParams.delete('credits');
          newParams.delete('org_name');
          newParams.delete('app_name');
          setSearchParams(newParams, { replace: true });

          const url = new URL(window.location.href);
          url.search = '';
          window.history.replaceState({}, document.title, url.toString());

          await verifyPurchaseMutation.mutateAsync({
            organizationId: currentOrganization.id,
            organizationName: orgName || currentOrganization.name,
            userId: user.id,
            reference,
            amountGhs: Number(amountGhs),
            creditsPurchased: Number(creditsPurchased),
            appName: appName || 'StockFlow',
          });
          toast.success(`Successfully verified and added ${creditsPurchased} SMS credits!`);
        } catch (error: any) {
          toast.error(error.message || 'Failed to verify payment. Please contact support.');
        }
      };
      verify();
    }
  }, [searchParams, currentOrganization?.id, user?.id]);

  const targetCustomers = useMemo(() => {
    if (selectAllCustomers) return customers;
    return customers.filter(c => selectedCustomerIds.includes(c.id));
  }, [customers, selectAllCustomers, selectedCustomerIds]);

  const targetSuppliers = useMemo(() => {
    if (selectAllSuppliers) return suppliers;
    return suppliers.filter(s => selectedSupplierIds.includes(s.id));
  }, [suppliers, selectAllSuppliers, selectedSupplierIds]);

  const handleTemplateSelect = (templateId: string) => {
    const template = dbTemplates.find((t: CommunicationTemplate) => t.id === templateId);
    if (template) {
      setSubject(template.subject || '');
      setMessage(template.content);
      setSelectedTemplate(templateId);
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (messageType === 'sms' && val.length > 150) return;
    setMessage(val);
  };

  const handleSendMessage = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    const manualPhones = additionalRecipients.split(',').map(p => p.trim()).filter(p => p.length > 0);
    const targetMembers = [...targetCustomers, ...targetSuppliers];

    if (targetMembers.length === 0 && manualPhones.length === 0) {
      toast.error('Please select at least one recipient or enter a manual phone number');
      return;
    }

    if (messageType === 'email' && !subject.trim()) {
      toast.error('Please enter a subject for the email');
      return;
    }

    try {
      if (messageType === 'sms') {
        const expectedVariables = [...message.matchAll(/\{([^}]+)\}/g)].map(match => match[1]);

        const recipients = [
          ...targetCustomers.map(c => {
            const addressObj = currentOrganization?.address as Record<string, string> | undefined;
            const orgAddressString = addressObj ? `${addressObj.street || ''}, ${addressObj.city || ''}, ${addressObj.state || ''}`.replace(/^, | ,|, $/g, '').trim() : '';

            const fullData: Record<string, unknown> = {
              ...c,
              c_first_name: c.firstName || '',
              c_last_name: c.lastName || '',
              c_phone: c.phone || '',
              c_email: c.email || '',
              organization_name: currentOrganization?.name || '',
              organization_email: currentOrganization?.email || '',
              organization_phone: currentOrganization?.phone || '',
              organization_address: orgAddressString,
            };

            const filteredData: Record<string, unknown> = { phone: fullData.phone };
            expectedVariables.forEach(v => {
              filteredData[v] = fullData[v];
            });
            return filteredData;
          }),
          ...targetSuppliers.map(s => {
            const addressObj = currentOrganization?.address as Record<string, string> | undefined;
            const orgAddressString = addressObj ? `${addressObj.street || ''}, ${addressObj.city || ''}, ${addressObj.state || ''}`.replace(/^, | ,|, $/g, '').trim() : '';

            const fullData: Record<string, unknown> = {
              ...s,
              s_name: s.name || '',
              s_contact_person: s.contactPerson || '',
              s_email: s.email || '',
              s_phone: s.phone || '',
              organization_name: currentOrganization?.name || '',
              organization_email: currentOrganization?.email || '',
              organization_phone: currentOrganization?.phone || '',
              organization_address: orgAddressString,
            };

            const filteredData: Record<string, unknown> = { phone: fullData.phone };
            expectedVariables.forEach(v => {
              filteredData[v] = fullData[v];
            });
            return filteredData;
          }),
          ...manualPhones.map(phone => {
            const addressObj = currentOrganization?.address as Record<string, string> | undefined;
            const orgAddressString = addressObj ? `${addressObj.street || ''}, ${addressObj.city || ''}, ${addressObj.state || ''}`.replace(/^, | ,|, $/g, '').trim() : '';

            const manualData: Record<string, unknown> = { phone };
            const orgVars: Record<string, string> = {
              organization_name: currentOrganization?.name || '',
              organization_email: currentOrganization?.email || '',
              organization_phone: currentOrganization?.phone || '',
              organization_address: orgAddressString,
            };

            expectedVariables.forEach(v => {
              manualData[v] = orgVars[v] !== undefined ? orgVars[v] : '';
            });
            return manualData;
          })
        ].filter(r => Boolean(r.phone && String(r.phone).trim().length > 0));

        if (recipients.length === 0) {
          toast.error('None of the selected customers or manually entered numbers have a valid phone number');
          return;
        }

        const orgSenderId = (currentOrganization as { sms_sender_id?: string })?.sms_sender_id;
        let senderId = orgSenderId || (import.meta as { env?: { VITE_DEFAULT_SMS_SENDER_ID?: string } }).env?.VITE_DEFAULT_SMS_SENDER_ID || currentOrganization?.name || 'StockFlow';
        senderId = senderId.substring(0, 11);

        await sendSmsMessage({
          sender: senderId,
          message,
          recipients: recipients as { phone: string;[key: string]: unknown }[],
          sandbox: false,
          organizationId: currentOrganization?.id
        });

        queryClient.invalidateQueries({ queryKey: ['sms_balance', currentOrganization?.id] });
      }

      const totalRecipientsCount = targetCustomers.length + targetSuppliers.length + manualPhones.length;

      await createHistoryMutation.mutateAsync({
        type: messageType,
        subject: messageType === 'email' ? subject : undefined,
        content: message,
        recipient_type: (selectAllCustomers && selectAllSuppliers) ? 'all' : 'custom',
        recipient_ids: [...targetCustomers.map(c => c.id), ...targetSuppliers.map(s => s.id)],
        recipient_count: totalRecipientsCount,
        status: 'sent',
      });

      toast.success(`${messageType.toUpperCase()} sent successfully to ${totalRecipientsCount} recipients`);

      setPreviewOpen(false);
      setSelectedTemplate('');
      setSubject('');
      setMessage('');
      setSelectedCustomerIds([]);
      setSelectedSupplierIds([]);
    } catch (error) {
      toast.error('Failed to send message');
      console.error(error);
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!recipientSearch) return customers;
    const lower = recipientSearch.toLowerCase();
    return customers.filter(c =>
      c.firstName.toLowerCase().includes(lower) ||
      c.lastName.toLowerCase().includes(lower) ||
      (c.email && c.email.toLowerCase().includes(lower)) ||
      (c.phone && c.phone.includes(lower))
    );
  }, [customers, recipientSearch]);

  const filteredSuppliers = useMemo(() => {
    if (!recipientSearch) return suppliers;
    const lower = recipientSearch.toLowerCase();
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(lower) ||
      (s.contactPerson && s.contactPerson.toLowerCase().includes(lower)) ||
      (s.email && s.email.toLowerCase().includes(lower)) ||
      (s.phone && s.phone.includes(lower))
    );
  }, [suppliers, recipientSearch]);

  const handleCustomerToggle = (id: string) => {
    setSelectedCustomerIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSupplierToggle = (id: string) => {
    setSelectedSupplierIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Communication</h1>
        </div>
        <div className="flex items-center gap-2">
          <SenderIdManager />
          <SmsCreditWidget
            organizationId={currentOrganization?.id}
            organizationName={currentOrganization?.name || undefined}
            organizationEmail={currentOrganization?.email || undefined}
            organizationPhone={currentOrganization?.phone || undefined}
            userId={user?.id}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full h-[100px] md:h-fit md:grid-cols-4 lg:w-[800px]">
          <TabsTrigger value="compose" className="flex items-center gap-2">
            <Send className="h-4 w-4" /> Compose Message
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" /> Message History
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> SMS Billing
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Edit className="h-4 w-4" /> Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <MessageTypeSelector messageType={messageType} onChange={setMessageType} />

              <RecipientSelector
                additionalRecipients={additionalRecipients}
                setAdditionalRecipients={setAdditionalRecipients}
                targetCount={targetCustomers.length + targetSuppliers.length + additionalRecipients.split(',').filter(p => p.trim().length > 0).length}
                isLoadingTargets={isLoadingCustomers || isLoadingSuppliers}
              >
                <div className="space-y-4">
                  <Tabs defaultValue="customers" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="customers">Customers</TabsTrigger>
                      <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
                    </TabsList>

                    <TabsContent value="customers" className="space-y-4 mt-4">
                      <div className="flex items-center justify-between border-b pb-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="all-customers"
                            checked={selectAllCustomers}
                            onCheckedChange={(c) => {
                              setSelectAllCustomers(!!c);
                              if (c) setSelectedCustomerIds([]);
                            }}
                          />
                          <Label htmlFor="all-customers" className="font-semibold">All Customers ({customers.length})</Label>
                        </div>
                      </div>

                      {!selectAllCustomers && (
                        <div className="space-y-4">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="search"
                              placeholder="Search customers..."
                              className="pl-8"
                              value={recipientSearch}
                              onChange={(e) => setRecipientSearch(e.target.value)}
                            />
                          </div>

                          <div className="flex justify-between items-center text-sm text-muted-foreground">
                            <span>{selectedCustomerIds.length} selected</span>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedCustomerIds(filteredCustomers.map(c => c.id))}>
                              Select All Visible
                            </Button>
                          </div>

                          <ScrollArea className="h-[300px] border rounded-md p-4">
                            {filteredCustomers.length === 0 ? (
                              <div className="text-center text-muted-foreground py-8">No customers found</div>
                            ) : (
                              <div className="space-y-3">
                                {filteredCustomers.map(customer => (
                                  <div key={customer.id} className="flex items-center space-x-3">
                                    <Checkbox
                                      id={`cust-${customer.id}`}
                                      checked={selectedCustomerIds.includes(customer.id)}
                                      onCheckedChange={() => handleCustomerToggle(customer.id)}
                                    />
                                    <Label htmlFor={`cust-${customer.id}`} className="flex-1 cursor-pointer">
                                      <div className="font-medium">{customer.firstName} {customer.lastName}</div>
                                      <div className="text-xs text-muted-foreground">{customer.phone || 'No phone'}</div>
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="suppliers" className="space-y-4 mt-4">
                      <div className="flex items-center justify-between border-b pb-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="all-suppliers"
                            checked={selectAllSuppliers}
                            onCheckedChange={(c) => {
                              setSelectAllSuppliers(!!c);
                              if (c) setSelectedSupplierIds([]);
                            }}
                          />
                          <Label htmlFor="all-suppliers" className="font-semibold">All Suppliers ({suppliers.length})</Label>
                        </div>
                      </div>

                      {!selectAllSuppliers && (
                        <div className="space-y-4">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="search"
                              placeholder="Search suppliers..."
                              className="pl-8"
                              value={recipientSearch}
                              onChange={(e) => setRecipientSearch(e.target.value)}
                            />
                          </div>

                          <div className="flex justify-between items-center text-sm text-muted-foreground">
                            <span>{selectedSupplierIds.length} selected</span>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedSupplierIds(filteredSuppliers.map(s => s.id))}>
                              Select All Visible
                            </Button>
                          </div>

                          <ScrollArea className="h-[300px] border rounded-md p-4">
                            {filteredSuppliers.length === 0 ? (
                              <div className="text-center text-muted-foreground py-8">No suppliers found</div>
                            ) : (
                              <div className="space-y-3">
                                {filteredSuppliers.map(supplier => (
                                  <div key={supplier.id} className="flex items-center space-x-3">
                                    <Checkbox
                                      id={`supp-${supplier.id}`}
                                      checked={selectedSupplierIds.includes(supplier.id)}
                                      onCheckedChange={() => handleSupplierToggle(supplier.id)}
                                    />
                                    <Label htmlFor={`supp-${supplier.id}`} className="flex-1 cursor-pointer">
                                      <div className="font-medium">{supplier.name}</div>
                                      <div className="text-xs text-muted-foreground">{supplier.contactPerson ? `${supplier.contactPerson} • ` : ''}{supplier.phone || 'No phone'}</div>
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </RecipientSelector>

              <MessageComposer
                messageType={messageType}
                templates={dbTemplates.filter((t: CommunicationTemplate) => t.type === messageType)}
                selectedTemplate={selectedTemplate}
                onTemplateSelect={handleTemplateSelect}
                subject={subject}
                setSubject={setSubject}
                message={message}
                handleMessageChange={handleMessageChange}
                previewOpen={previewOpen}
                setPreviewOpen={setPreviewOpen}
                handleSend={handleSendMessage}
                targetMembers={[...targetCustomers, ...targetSuppliers] as Record<string, any>[]}
                additionalRecipients={additionalRecipients}
                tags={STOCK_FLOW_TAGS}
              />
            </div>

            <div className="space-y-6">
              <BestPractices />

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dbHistory.slice(0, 5).map((item: CommunicationHistory) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          {item.type === 'email' ? <Mail className="h-3 w-3 text-muted-foreground" /> : <MessageSquare className="h-3 w-3 text-muted-foreground" />}
                          <span className="truncate max-w-[230px]" title={item.subject || item.content}>{item.subject || item.content}</span>
                        </div>
                        <span className="text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                    {dbHistory.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>}
                  </div>
                  <Button variant="link" className="w-full mt-4" onClick={() => setActiveTab('history')}>View All History</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Message History</CardTitle>
              <CardDescription>View previously sent messages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dbHistory.map((item: CommunicationHistory) => (
                  <div key={item.id} className="flex items-start justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {item.type === 'email' ? <Mail className="h-4 w-4 text-blue-500" /> : <Phone className="h-4 w-4 text-green-500" />}
                        <span className="font-medium">{item.subject || item.content.substring(0, 50) + '...'}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Sent to {item.recipient_count} recipients • {new Date(item.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge variant={['delivered', 'sent'].includes(item.status) ? 'default' : 'secondary'} className={['delivered', 'sent'].includes(item.status) ? 'bg-green-500' : ''}>
                      {item.status}
                    </Badge>
                  </div>
                ))}
                {dbHistory.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="mx-auto h-12 w-12 opacity-20 mb-4" />
                    <p>No messages sent yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Transaction History</CardTitle>
                  <CardDescription>View your SMS credit purchases and usage</CardDescription>
                </CardHeader>
                <CardContent>
                  <TransactionHistory organizationId={currentOrganization?.id} />
                </CardContent>
              </Card>
            </div>
            <div>
              <SmsCreditWidget
                organizationId={currentOrganization?.id}
                organizationName={currentOrganization?.name || undefined}
                organizationEmail={currentOrganization?.email || undefined}
                organizationPhone={currentOrganization?.phone || undefined}
                userId={user?.id}
              />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="templates">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Communication Templates</CardTitle>
                <CardDescription>Manage your SMS and Email templates</CardDescription>
              </div>
              <Button onClick={() => {
                setEditingTemplateId(null);
                setTemplateDrawerOpen(true);
              }}>
                Create Template
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {dbTemplates.map((template: CommunicationTemplate) => (
                  <Card key={template.id} className="relative group overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base line-clamp-1 pr-8">{template.name}</CardTitle>
                        <Badge variant={template.type === 'email' ? 'secondary' : 'default'} className="absolute top-4 right-4">
                          {template.type}
                        </Badge>
                      </div>
                      {template.subject && <CardDescription className="line-clamp-1">{template.subject}</CardDescription>}
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{template.content}</p>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          setEditingTemplateId(template.id);
                          setTemplateDrawerOpen(true);
                        }}>
                          Edit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {dbTemplates.length === 0 && (
                  <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                    <Edit className="mx-auto h-12 w-12 opacity-20 mb-4" />
                    <p>No templates found</p>
                    <Button variant="link" onClick={() => {
                      setEditingTemplateId(null);
                      setTemplateDrawerOpen(true);
                    }}>Create your first template</Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <TemplateFormDrawer
        open={templateDrawerOpen}
        onOpenChange={setTemplateDrawerOpen}
        messageType={messageType}
        templateToEdit={editingTemplateId ? dbTemplates.find((t: CommunicationTemplate) => t.id === editingTemplateId) : undefined}
        tags={STOCK_FLOW_TAGS}
      />
    </div>
  );
}
