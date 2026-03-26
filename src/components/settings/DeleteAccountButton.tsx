"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { deleteAccount } from "@/app/actions/settings";

export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    const result = await deleteAccount();
    if (result?.error) {
      setError(result.error);
      setConfirming(false);
    }
    // If success, page will revalidate to login
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--color-sell)]">Are you sure?</span>
        <Button variant="danger" size="sm" onClick={handleDelete}>Yes, delete</Button>
        <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
      </div>
    );
  }

  return (
    <Button variant="danger" size="sm" onClick={handleDelete}>
      Delete Account
    </Button>
  );
}