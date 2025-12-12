import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet';
import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Separator } from '../ui/separator';
import { HelpCircle, Mail, Bug, MessageSquare, X, Info } from 'lucide-react';
import { IssueReportModal } from './IssueReportModal';
import { openExternalUrl } from '../../utils/external-url';

interface HelpDrawerProps {
  children: React.ReactNode;
}

export function HelpDrawer({ children }: HelpDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showIssueReport, setShowIssueReport] = useState(false);

  const handleContactFMT = () => {
    openExternalUrl('https://fmtsoftware.com/contact');
  };

  const handleAboutFMT = () => {
    openExternalUrl('https://fmtsoftware.com/about');
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>{children}</SheetTrigger>
        <SheetContent
          side="bottom"
          className="h-screen max-h-screen w-full p-4"
        >
          <div className="mx-auto w-full max-w-4xl h-full flex flex-col border">
            <SheetHeader className="flex flex-row items-center justify-between border-b pb-4">
              <div>
                <SheetTitle className="text-2xl">Help & Support</SheetTitle>
                <SheetDescription>
                  Get help with FMT Software solutions
                </SheetDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* About Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HelpCircle className="h-5 w-5" />
                      About
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium">stock-flow</h4>
                      <p className="text-sm text-muted-foreground">
                        Version 1.0.0
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-medium">Description</h4>
                      <p className="text-sm text-muted-foreground">
                        Stock or Inventory Tracking System for businesses
                        Built with React, Electron, and modern web technologies.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Contact & Support */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Contact & Support
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={handleAboutFMT}
                    >
                      <Info className="mr-2 h-4 w-4" />
                      About FMT
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={handleContactFMT}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Contact FMT
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setShowIssueReport(true)}
                    >
                      <Bug className="mr-2 h-4 w-4" />
                      Report an Issue
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setShowIssueReport(true)}
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Send Feedback
                    </Button>
                  </CardContent>
                </Card>

                {/* Getting Started */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Getting Started</CardTitle>
                    <CardDescription>
                      Quick guide to using this application
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="font-medium mb-2">Navigation</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>
                            • Use the sidebar to navigate between sections
                          </li>
                          <li>• Access your profile from the top-right menu</li>
                          <li>• Switch themes from the profile menu</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Features</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Automatic updates when available</li>
                          <li>• Multiple theme options</li>
                          <li>• Responsive design for all screen sizes</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <IssueReportModal
        isOpen={showIssueReport}
        onClose={() => setShowIssueReport(false)}
      />
    </>
  );
}
