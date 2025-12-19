import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ExpensesList } from './expenses/ExpensesList';
import { ExpenseConfiguration } from './expenses/ExpenseConfiguration';
import { AddExpenseDialog } from './expenses/AddExpenseDialog';

export function Expenses() {
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Expenses</h2>
          <p className="text-muted-foreground">
            Manage your expenses and categories.
          </p>
        </div>
        <div className="flex gap-2">
          <AddExpenseDialog
            open={isAddExpenseOpen}
            onOpenChange={setIsAddExpenseOpen}
          >
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Record Expenses
            </Button>
          </AddExpenseDialog>
        </div>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Expenses List</TabsTrigger>
          <TabsTrigger value="configuration">Categories & Types</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <ExpensesList />
        </TabsContent>

        <TabsContent value="configuration" className="space-y-4">
          <ExpenseConfiguration />
        </TabsContent>
      </Tabs>
    </div>
  );
}
