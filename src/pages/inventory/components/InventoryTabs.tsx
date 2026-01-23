import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface TabOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface InventoryTabsProps {
  activeTab: string;
  onTabChange: (value: string) => void;
  isLoading: boolean;
  tabs: TabOption[];
}

export function InventoryTabs({
  activeTab,
  onTabChange,
  isLoading,
  tabs,
}: InventoryTabsProps) {
  const selectedTabLabel = tabs.find((t) => t.value === activeTab)?.label;

  return (
    <>
      {/* Mobile View - Select */}
      <div className="md:hidden w-full">
        <Select
          value={activeTab}
          onValueChange={onTabChange}
          disabled={isLoading}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select tab">
              {selectedTabLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {tabs.map((tab) => (
              <SelectItem
                key={tab.value}
                value={tab.value}
                disabled={tab.disabled}
              >
                {tab.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop View - TabsList */}
      <div className="hidden md:block">
        <Tabs
          value={activeTab}
          onValueChange={onTabChange}
          className="space-y-0"
        >
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                disabled={isLoading || tab.disabled}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </>
  );
}
