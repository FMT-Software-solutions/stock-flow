import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { useCustomer } from '@/hooks/useCustomerQueries';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Phone, Mail, Building2, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface CustomerHoverLinkProps {
  customerId?: string | null;
  customerName?: string | null;
  className?: string;
}

export function CustomerHoverLink({ customerId, customerName, className = '' }: CustomerHoverLinkProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: customer, isLoading } = useCustomer(isOpen && customerId ? customerId : undefined);

  const displayName = customerName?.trim() || 'Unknown Customer';

  if (!customerId) {
    return <span className={className}>{displayName}</span>;
  }

  return (
    <HoverCard openDelay={300} closeDelay={100} onOpenChange={setIsOpen}>
      <HoverCardTrigger asChild>
        <Link
          to={`/customers/details/${customerId}`}
          className={`hover:underline ${className}`}
        >
          {displayName}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 p-4" align="start">
        <div className="flex gap-4">
          <Avatar className="h-12 w-12 border">
            {customer?.images?.[0] ? (
              <AvatarImage src={customer.images[0]} alt={displayName} />
            ) : (
              <AvatarFallback className="bg-primary/10 text-primary">
                <User className="h-6 w-6" />
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1 space-y-1">
            <h4 className="text-sm font-semibold leading-none">{displayName}</h4>
            
            {isLoading ? (
              <div className="space-y-2 pt-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ) : customer ? (
              <div className="text-xs text-muted-foreground space-y-2 pt-2">
                {customer.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{customer.address}</span>
                  </div>
                )}
                {customer.branchName && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3 w-3 shrink-0" />
                    <span>{customer.branchName}</span>
                  </div>
                )}
                {!customer.phone && !customer.email && !customer.address && !customer.branchName && (
                  <span className="italic">No additional details available</span>
                )}
              </div>
            ) : (
              <span className="text-xs italic pt-2 block">Failed to load details</span>
            )}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
