import { useSmsTransactions } from '../hooks/useSmsTransactions';
import { ArrowDownRight, ArrowUpRight, Gift, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface TransactionHistoryProps {
  organizationId?: string;
}

export function TransactionHistory({ organizationId }: TransactionHistoryProps) {
  const { data: transactions = [], isLoading } = useSmsTransactions(organizationId);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-muted rounded-md w-full" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
        <Calendar className="mx-auto h-8 w-8 mb-3 opacity-20" />
        <p>No transactions found.</p>
        <p className="text-sm mt-1">When you purchase credits or send messages, they will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {transactions.map((tx) => (
        <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-full ${tx.type === 'purchase' ? 'bg-green-500/10 text-green-500' :
                tx.type === 'bonus' ? 'bg-primary/10 text-primary' :
                  'bg-orange-500/10 text-orange-500'
              }`}>
              {tx.type === 'purchase' ? <ArrowDownRight className="h-4 w-4" /> :
                tx.type === 'bonus' ? <Gift className="h-4 w-4" /> :
                  <ArrowUpRight className="h-4 w-4" />}
            </div>
            <div>
              <p className="font-medium text-sm sm:text-base">{tx.description}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px] uppercase">
                  {tx.type}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(tx.created_at), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
            </div>
          </div>
          <div className={`text-right font-bold ${tx.amount > 0 ? 'text-green-500 dark:text-green-400' : 'text-orange-500 dark:text-orange-400'
            }`}>
            {tx.amount > 0 ? '+' : ''}{tx.amount}
          </div>
        </div>
      ))}
    </div>
  );
}