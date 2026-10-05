import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCart, onCartChanged, type CartItem } from '@/lib/cart';
import { CartTab } from './CartTab';
import { TryOnTab } from './TryOnTab';

const pendingCount = (items: CartItem[]) => items.filter((i) => !i.bought).length;

export default function App() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    void getCart().then((items) => setCount(pendingCount(items)));
    return onCartChanged((items) => setCount(pendingCount(items)));
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 font-semibold">
          <img src="/icon/32.png" alt="" className="size-6" /> Virtual Try-On
        </div>
        <Button variant="ghost" size="icon" aria-label="Settings" onClick={() => void browser.runtime.openOptionsPage()}>
          <Settings className="size-4" />
        </Button>
      </header>
      <Tabs defaultValue="tryon" className="flex-1 p-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tryon">Try on</TabsTrigger>
          <TabsTrigger value="cart">Cart{count > 0 && ` (${count})`}</TabsTrigger>
        </TabsList>
        {/* forceMount keeps an in-flight generation alive while the cart tab is open */}
        <TabsContent value="tryon" forceMount className="data-[state=inactive]:hidden">
          <TryOnTab />
        </TabsContent>
        <TabsContent value="cart" forceMount className="data-[state=inactive]:hidden">
          <CartTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
