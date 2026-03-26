"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { X, Trash2, GripVertical, ImageIcon } from "lucide-react";

interface Photo {
  id: string;
  url: string;
  sort_order: number;
}

function SortablePhoto({
  photo,
  onDelete,
}: {
  photo: Photo;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style as React.CSSProperties}
      className="relative group"
    >
      <div className="overflow-hidden aspect-square p-0 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] hover:border-[var(--color-border-default)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>

      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 p-1.5 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} />
      </button>

      {/* Delete button */}
      <button
        onClick={() => onDelete(photo.id)}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
        aria-label="Delete photo"
      >
        <X size={14} />
      </button>
    </div>
  );
}

interface PhotoGridProps {
  userId: string;
}

export function PhotoGrid({ userId }: PhotoGridProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchPhotos = useCallback(async () => {
    const res = await fetch("/api/photos");
    if (res.ok) {
      const data = await res.json();
      setPhotos(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const handleDelete = async (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    const res = await fetch(`/api/photos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      // Revert on failure
      fetchPhotos();
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Remove all photos? This cannot be undone.")) return;
    setClearing(true);
    const prev = photos;
    setPhotos([]);
    const res = await fetch("/api/photos/clear", { method: "DELETE" });
    if (!res.ok) {
      setPhotos(prev);
      setClearing(false);
    }
    setClearing(false);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = photos.findIndex((p) => p.id === active.id);
    const newIndex = photos.findIndex((p) => p.id === over.id);
    const newPhotos = arrayMove(photos, oldIndex, newIndex);
    setPhotos(newPhotos);

    // Update sort orders for the two moved items
    const updates = newPhotos.map((p, i) => ({
      id: p.id,
      sort_order: i,
    }));

    // Optimistic — already reflected in state
    await Promise.all(
      updates.map(({ id, sort_order }) =>
        fetch(`/api/photos/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order }),
        })
      )
    );
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="aspect-square rounded-lg bg-[var(--color-bg-elevated)] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon size={14} className="text-[var(--color-text-muted)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">
            {photos.length} photo{photos.length !== 1 ? "s" : ""}
          </span>
        </div>
        {photos.length > 0 && (
          <Button
            variant="danger"
            size="sm"
            onClick={handleClearAll}
            disabled={clearing}
          >
            <Trash2 size={13} />
            {clearing ? "Clearing..." : "Clear all"}
          </Button>
        )}
      </div>

      {/* Grid */}
      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center mb-3">
            <ImageIcon size={20} className="text-[var(--color-text-muted)]" />
          </div>
          <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
            No photos yet
          </p>
          <p className="text-xs text-[var(--color-text-muted)] max-w-xs">
            Photos you add will appear here. Drag to reorder, click ✕ to remove.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <SortablePhoto
                  key={photo.id}
                  photo={photo}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
