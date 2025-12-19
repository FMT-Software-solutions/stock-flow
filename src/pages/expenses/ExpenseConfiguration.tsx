import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Search, Edit, Loader2 } from 'lucide-react';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useExpenseCategories,
  useExpenseTypes,
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
  useDeleteExpenseCategory,
  useCreateExpenseType,
  useDeleteExpenseType,
} from '@/hooks/useExpenseQueries';
import type { ExpenseCategory } from '@/types/expenses';
import { toast } from 'sonner';

export function ExpenseConfiguration() {
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id;

  const {
    data: categories = [],
    isLoading: isLoadingCategories,
  } = useExpenseCategories(organizationId);
  // Fetch all types initially, we can filter client side or optimize later
  const { data: allTypes = [], isLoading: isLoadingTypes } = useExpenseTypes(
    organizationId
  );

  const createCategory = useCreateExpenseCategory();
  const updateCategory = useUpdateExpenseCategory();
  const deleteCategory = useDeleteExpenseCategory();
  const createType = useCreateExpenseType();
  const deleteType = useDeleteExpenseType();

  // Configuration View State
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [categorySearch, setCategorySearch] = useState('');
  const [typeSearch, setTypeSearch] = useState('');

  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<Partial<ExpenseCategory>>({});

  const [
    editingCategory,
    setEditingCategory,
  ] = useState<ExpenseCategory | null>(null);
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);

  const [isAddTypeOpen, setIsAddTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

  // Derived state
  const types = selectedCategoryId
    ? allTypes.filter((t) => t.categoryId === selectedCategoryId)
    : [];

  const getCategoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name || 'Unknown';

  // Handlers
  const handleAddCategory = () => {
    if (!newCategory.name || !organizationId) return;

    createCategory.mutate(
      {
        name: newCategory.name,
        description: newCategory.description,
        organizationId,
      },
      {
        onSuccess: () => {
          toast.success('Category added successfully');
          setNewCategory({});
          setIsAddCategoryOpen(false);
        },
        onError: (err) => {
          toast.error('Failed to add category: ' + err.message);
        },
      }
    );
  };

  const handleDeleteCategory = (id: string) => {
    deleteCategory.mutate(id, {
      onSuccess: () => {
        toast.success('Category deleted successfully');
        if (selectedCategoryId === id) {
          setSelectedCategoryId(null);
        }
      },
      onError: (err) => {
        toast.error('Failed to delete category: ' + err.message);
      },
    });
  };

  const handleEditCategory = (category: ExpenseCategory) => {
    setEditingCategory(category);
    setIsEditCategoryOpen(true);
  };

  const handleUpdateCategory = () => {
    if (!editingCategory || !editingCategory.name) return;

    updateCategory.mutate(
      {
        id: editingCategory.id,
        updates: {
          name: editingCategory.name,
          description: editingCategory.description,
        },
      },
      {
        onSuccess: () => {
          toast.success('Category updated successfully');
          setIsEditCategoryOpen(false);
          setEditingCategory(null);
        },
        onError: (err) => {
          toast.error('Failed to update category: ' + err.message);
        },
      }
    );
  };

  const handleAddType = () => {
    if (!newTypeName || !selectedCategoryId || !organizationId) return;

    createType.mutate(
      {
        name: newTypeName,
        categoryId: selectedCategoryId,
        organizationId,
      },
      {
        onSuccess: () => {
          toast.success('Type added successfully');
          setNewTypeName('');
          setIsAddTypeOpen(false);
        },
        onError: (err) => {
          toast.error('Failed to add type: ' + err.message);
        },
      }
    );
  };

  const handleDeleteType = (id: string) => {
    deleteType.mutate(id, {
      onSuccess: () => {
        toast.success('Type deleted successfully');
      },
      onError: (err) => {
        toast.error('Failed to delete type: ' + err.message);
      },
    });
  };

  if (isLoadingCategories || isLoadingTypes) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-12 h-[calc(100vh-200px)] min-h-125">
      {/* Categories List */}
      <Card className="md:col-span-4 h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl">Categories</CardTitle>
          <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4" />
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
                <Button
                  onClick={handleAddCategory}
                  disabled={createCategory.isPending}
                >
                  {createCategory.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add Category
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0">
          <div className="mb-4 relative shrink-0">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search categories..."
              className="pl-8"
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
            />
          </div>
          <div className="space-y-2 overflow-y-auto pr-2 flex-1">
            {categories
              .filter((cat) =>
                cat.name.toLowerCase().includes(categorySearch.toLowerCase())
              )
              .map((cat) => (
                <div
                  key={cat.id}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedCategoryId === cat.id
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted border border-transparent'
                  }`}
                  onClick={() => setSelectedCategoryId(cat.id)}
                >
                  <div className="overflow-hidden">
                    <p className="font-medium truncate">{cat.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {cat.description}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditCategory(cat);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCategory(cat.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Types List */}
      <Card className="md:col-span-8 h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-xl">
              {selectedCategoryId
                ? `Types for ${getCategoryName(selectedCategoryId)}`
                : 'Expense Types'}
            </CardTitle>
            <CardDescription>
              {selectedCategoryId
                ? 'Manage types for this category'
                : 'Select a category to manage types'}
            </CardDescription>
          </div>
          <Dialog open={isAddTypeOpen} onOpenChange={setIsAddTypeOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                disabled={!selectedCategoryId}
                onClick={() => setNewTypeName('')}
              >
                <Plus className="h-4 w-4 mr-2" /> Add Type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Expense Type</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    value={
                      categories.find((c) => c.id === selectedCategoryId)
                        ?.name || ''
                    }
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddType} disabled={createType.isPending}>
                  {createType.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add Type
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0">
          {selectedCategoryId ? (
            <>
              <div className="mb-4 relative shrink-0">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search types..."
                  className="pl-8"
                  value={typeSearch}
                  onChange={(e) => setTypeSearch(e.target.value)}
                />
              </div>
              <div className="overflow-y-auto flex-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-25"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {types
                      .filter((t) =>
                        t.name.toLowerCase().includes(typeSearch.toLowerCase())
                      )
                      .map((type) => (
                        <TableRow key={type.id}>
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
                    {types.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="text-center text-muted-foreground h-24"
                        >
                          No types found for this category.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground border-2 border-dashed rounded-lg">
              <p>Select a category from the list to view its types</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Category Dialog */}
      <Dialog open={isEditCategoryOpen} onOpenChange={setIsEditCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editingCategory?.name || ''}
                onChange={(e) =>
                  setEditingCategory((prev) =>
                    prev ? { ...prev, name: e.target.value } : null
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={editingCategory?.description || ''}
                onChange={(e) =>
                  setEditingCategory((prev) =>
                    prev ? { ...prev, description: e.target.value } : null
                  )
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleUpdateCategory}
              disabled={updateCategory.isPending}
            >
              {updateCategory.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
