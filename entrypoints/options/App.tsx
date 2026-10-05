import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { deleteAllData } from '@/lib/db';
import { PhotosCard } from './PhotosCard';
import { ProviderCard } from './ProviderCard';

export default function App() {
  async function onDeleteAll() {
    if (!confirm('Delete your photos, API keys, try-on results and cart? This cannot be undone.')) return;
    await deleteAllData();
    location.reload();
  }

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-10">
      <header className="flex items-center gap-3">
        <img src="/icon/48.png" alt="" className="size-10" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Virtual Try-On</h1>
          <p className="text-muted-foreground text-sm">Set up your AI provider and photos once. Then click “Try On” on any clothing page.</p>
        </div>
      </header>
      <ProviderCard />
      <PhotosCard />
      <Card>
        <CardHeader>
          <CardTitle>Privacy and data</CardTitle>
          <CardDescription>
            Everything stays in this browser. When you click Generate, your photos and the product image are sent directly to the provider you selected, and nowhere else.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <Button variant="destructive" onClick={() => void onDeleteAll()}>
            <Trash2 className="size-4" /> Delete all data
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
