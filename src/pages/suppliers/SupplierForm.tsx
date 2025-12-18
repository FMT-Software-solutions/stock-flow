import { useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldLabel,
  FieldError,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useNavigate, useParams } from "react-router-dom"
import { ChevronLeft } from "lucide-react"
import { useCreateSupplier, useUpdateSupplier, useSupplier } from "@/hooks/useInventoryQueries"
import { useOrganization } from "@/contexts/OrganizationContext"
import { toast } from "sonner"

const supplierSchema = z.object({
  name: z.string().min(2, "Company name is required"),
  contactPerson: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
})

export function SupplierForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = !!id
  const { currentOrganization } = useOrganization()

  const { data: supplier, isLoading: isLoadingSupplier } = useSupplier(id)
  const createSupplier = useCreateSupplier()
  const updateSupplier = useUpdateSupplier()

  const form = useForm({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      website: "",
    },
  })

  useEffect(() => {
    if (supplier) {
      form.reset({
        name: supplier.name,
        contactPerson: supplier.contactPerson || "",
        email: supplier.email || "",
        phone: supplier.phone || "",
        address: supplier.address || "",
        website: supplier.website || "",
      })
    }
  }, [supplier, form])

  async function onSubmit(values: z.infer<typeof supplierSchema>) {
    if (!currentOrganization?.id) return

    try {
      if (isEditing && id) {
        await updateSupplier.mutateAsync({
          id,
          updates: values,
        })
        toast.success("Supplier updated successfully")
      } else {
        await createSupplier.mutateAsync({
          ...values,
          organizationId: currentOrganization.id,
        })
        toast.success("Supplier created successfully")
      }
      navigate("/suppliers")
    } catch (error) {
      console.error(error)
      toast.error(isEditing ? "Failed to update supplier" : "Failed to create supplier")
    }
  }

  if (isEditing && isLoadingSupplier) {
      return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/suppliers")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditing ? "Edit Supplier" : "New Supplier"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? "Update supplier information" : "Add a new supplier to your list"}
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Supplier Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <Controller
                    control={form.control}
                    name="name"
                    render={({ field, fieldState }) => (
                        <Field data-invalid={!!fieldState.error}>
                            <FieldLabel htmlFor="name">Company Name</FieldLabel>
                            <Input id="name" placeholder="Acme Corp" {...field} />
                            {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                        </Field>
                    )}
                />
                <Controller
                    control={form.control}
                    name="contactPerson"
                    render={({ field, fieldState }) => (
                        <Field data-invalid={!!fieldState.error}>
                            <FieldLabel htmlFor="contactPerson">Contact Person</FieldLabel>
                            <Input id="contactPerson" placeholder="Jane Doe" {...field} />
                            {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                        </Field>
                    )}
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <Controller
                    control={form.control}
                    name="email"
                    render={({ field, fieldState }) => (
                        <Field data-invalid={!!fieldState.error}>
                            <FieldLabel htmlFor="email">Email</FieldLabel>
                            <Input id="email" type="email" placeholder="contact@acme.com" {...field} />
                            {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                        </Field>
                    )}
                />
                <Controller
                    control={form.control}
                    name="phone"
                    render={({ field, fieldState }) => (
                        <Field data-invalid={!!fieldState.error}>
                            <FieldLabel htmlFor="phone">Phone</FieldLabel>
                            <Input id="phone" placeholder="+1 (555) 000-0000" {...field} />
                            {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                        </Field>
                    )}
                />
            </div>
            <Controller
                control={form.control}
                name="website"
                render={({ field, fieldState }) => (
                    <Field data-invalid={!!fieldState.error}>
                        <FieldLabel htmlFor="website">Website</FieldLabel>
                        <Input id="website" placeholder="https://acme.com" {...field} />
                        {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                    </Field>
                )}
            />
            <Controller
                control={form.control}
                name="address"
                render={({ field, fieldState }) => (
                    <Field data-invalid={!!fieldState.error}>
                        <FieldLabel htmlFor="address">Address</FieldLabel>
                        <Textarea id="address" placeholder="123 Industrial Way, City, Country" className="resize-none" {...field} />
                        {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                    </Field>
                )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
            <Button
              variant="outline"
              type="button"
              onClick={() => navigate("/suppliers")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : isEditing ? "Update Supplier" : "Create Supplier"}
            </Button>
        </div>
      </form>
    </div>
  )
}
