import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  mockExpenses,
  mockExpenseCategories,
  mockExpenseTypes,
} from '@/data/mock-expenses';
import type { Expense, ExpenseCategory, ExpenseType } from '@/types/expenses';
import { useCurrency } from '@/hooks/useCurrency';

export function Expenses() {
  const { formatCurrency } = useCurrency();
  const [expenses, setExpenses] = useState<Expense[]>(mockExpenses);
  const [categories, setCategories] = useState<ExpenseCategory[]>(
    mockExpenseCategories
  );
  const [types, setTypes] = useState<ExpenseType[]>(mockExpenseTypes);

  // Forms state
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAddTypeOpen, setIsAddTypeOpen] = useState(false);

  // New Expense State
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    date: new Date().toISOString().split('T')[0],
    status: 'pending',
    paymentMethod: 'cash',
  });

  // New Category State
  const [newCategory, setNewCategory] = useState<Partial<ExpenseCategory>>({});

  // New Type State
  const [newType, setNewType] = useState<Partial<ExpenseType>>({});

  // Helper to get category name
  const getCategoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name || 'Unknown';
  const getTypeName = (id: string) =>
    types.find((t) => t.id === id)?.name || 'Unknown';

  // Handlers
  const handleAddCategory = () => {
    if (!newCategory.name) return;
    const category: ExpenseCategory = {
      id: `cat-${Date.now()}`,
      name: newCategory.name,
      description: newCategory.description,
    };
    setCategories([...categories, category]);
    setNewCategory({});
    setIsAddCategoryOpen(false);
  };

  const handleAddType = () => {
    if (!newType.name || !newType.categoryId) return;
    const type: ExpenseType = {
      id: `type-${Date.now()}`,
      name: newType.name,
      categoryId: newType.categoryId,
      description: newType.description,
    };
    setTypes([...types, type]);
    setNewType({});
    setIsAddTypeOpen(false);
  };

  const handleAddExpense = () => {
    if (
      !newExpense.amount ||
      !newExpense.categoryId ||
      !newExpense.typeId ||
      !newExpense.description
    )
      return;
    const expense: Expense = {
      id: `exp-${Date.now()}`,
      date: newExpense.date || new Date().toISOString().split('T')[0],
      amount: Number(newExpense.amount),
      categoryId: newExpense.categoryId,
      typeId: newExpense.typeId,
      description: newExpense.description,
      paymentMethod: newExpense.paymentMethod as any,
      status: (newExpense.status as any) || 'pending',
    };
    setExpenses([expense, ...expenses]);
    setNewExpense({
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      paymentMethod: 'cash',
    });
    setIsAddExpenseOpen(false);
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses(expenses.filter((e) => e.id !== id));
  };

  const handleDeleteCategory = (id: string) => {
    // Also delete associated types? Or warn? For now just delete category.
    setCategories(categories.filter((c) => c.id !== id));
    setTypes(types.filter((t) => t.categoryId !== id));
  };

  const handleDeleteType = (id: string) => {
    setTypes(types.filter((t) => t.id !== id));
  };

  // Filter types based on selected category in Expense Form
  const filteredTypes = newExpense.categoryId
    ? types.filter((t) => t.categoryId === newExpense.categoryId)
    : [];

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
          <Button onClick={() => setIsAddExpenseOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Expense
          </Button>
        </div>
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Expense</DialogTitle>
            <DialogDescription>Create a new expense record.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={newExpense.date}
                  onChange={(e) =>
                    setNewExpense({ ...newExpense, date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={newExpense.amount}
                  onChange={(e) =>
                    setNewExpense({
                      ...newExpense,
                      amount: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={newExpense.categoryId}
                onValueChange={(val) =>
                  setNewExpense({
                    ...newExpense,
                    categoryId: val,
                    typeId: undefined,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Expense Type</Label>
              <Select
                value={newExpense.typeId}
                onValueChange={(val) =>
                  setNewExpense({ ...newExpense, typeId: val })
                }
                disabled={!newExpense.categoryId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      newExpense.categoryId
                        ? 'Select Type'
                        : 'Select Category First'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={newExpense.description}
                onChange={(e) =>
                  setNewExpense({ ...newExpense, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payment">Payment Method</Label>
                <Select
                  value={newExpense.paymentMethod}
                  onValueChange={(val: any) =>
                    setNewExpense({ ...newExpense, paymentMethod: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={newExpense.status}
                  onValueChange={(val: any) =>
                    setNewExpense({ ...newExpense, status: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddExpenseOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddExpense}>Save Expense</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Expenses List</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Expenses</CardTitle>
              <CardDescription>View and manage your expenses.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{expense.date}</TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell>
                        {getCategoryName(expense.categoryId)}
                      </TableCell>
                      <TableCell>{getTypeName(expense.typeId)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            expense.status === 'paid'
                              ? 'default'
                              : expense.status === 'approved'
                              ? 'secondary'
                              : expense.status === 'pending'
                              ? 'outline'
                              : 'destructive'
                          }
                        >
                          {expense.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteExpense(expense.id)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Categories */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Categories</CardTitle>
                  <CardDescription>Manage expense categories</CardDescription>
                </div>
                <Dialog
                  open={isAddCategoryOpen}
                  onOpenChange={setIsAddCategoryOpen}
                >
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Category</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={newCategory.name || ''}
                          onChange={(e) =>
                            setNewCategory({
                              ...newCategory,
                              name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          value={newCategory.description || ''}
                          onChange={(e) =>
                            setNewCategory({
                              ...newCategory,
                              description: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddCategory}>Add Category</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((cat) => (
                      <TableRow key={cat.id}>
                        <TableCell className="font-medium">
                          {cat.name}
                        </TableCell>
                        <TableCell>{cat.description}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteCategory(cat.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Types */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Types</CardTitle>
                  <CardDescription>
                    Manage expense types per category
                  </CardDescription>
                </div>
                <Dialog open={isAddTypeOpen} onOpenChange={setIsAddTypeOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Expense Type</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                          value={newType.categoryId}
                          onValueChange={(val) =>
                            setNewType({ ...newType, categoryId: val })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={newType.name || ''}
                          onChange={(e) =>
                            setNewType({ ...newType, name: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddType}>Add Type</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {types.map((type) => (
                      <TableRow key={type.id}>
                        <TableCell>
                          {getCategoryName(type.categoryId)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {type.name}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteType(type.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
