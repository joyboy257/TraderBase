import { createClient } from "@/lib/supabase/server";
import { PhotoGrid } from "@/components/photos/PhotoGrid";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, ImageIcon } from "lucide-react";

export default async function PhotosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? "";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-text-primary)] tracking-tight">
          Photos
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          Manage your photo gallery — drag to reorder, click ✕ to delete
        </p>
      </div>

      {/* Photo Grid */}
      <Card className="p-5">
        <PhotoGrid userId={userId} />
      </Card>

      {/* Add Photo */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 uppercase tracking-wider text-[var(--color-text-muted)]">
          Add Photo
        </h2>
        <form
          action={async (formData) => {
            "use server";
            const supabase = await createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const url = formData.get("url") as string;
            if (!url) return;

            const { data: existing } = await supabase
              .from("user_photos")
              .select("sort_order")
              .eq("user_id", user.id)
              .order("sort_order", { ascending: false })
              .limit(1);

            const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order ?? 0) + 1 : 0;

            await supabase
              .from("user_photos")
              .insert({ user_id: user.id, url, sort_order: nextOrder });

            // Revalidate the photos page
            const { revalidatePath } = await import("next/cache");
            revalidatePath("/photos");
          }}
          className="flex gap-3"
        >
          <Input
            name="url"
            placeholder="https://example.com/photo.jpg"
            className="flex-1"
            required
          />
          <Button type="submit">
            <Plus size={14} />
            Add
          </Button>
        </form>
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          Enter a URL to add a photo to your gallery
        </p>
      </Card>
    </div>
  );
}
