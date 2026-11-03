import React, { createContext, useContext, useState } from 'react';
import * as Crypto from 'expo-crypto';
import type { ImagePickerAsset } from 'expo-image-picker';

export type BookingDraft = {
  key: string; categoryId: string; deviceId?: string;
  bookingAnswers: Record<string, string | string[]>;
  issues: { category: string; description?: string }[];
  media: ImagePickerAsset[];
};
type BookingState = {
  drafts: BookingDraft[]; id: string; suggestedDiscountCode?: string;
  add: (draft: BookingDraft) => void; remove: (key: string) => void; clear: () => void;
  suggestDiscountCode: (code?: string) => void;
};
const Context = createContext<BookingState | null>(null);
export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [drafts, setDrafts] = useState<BookingDraft[]>([]);
  const [id, setId] = useState(() => Crypto.randomUUID());
  const [suggestedDiscountCode, setSuggestedDiscountCode] = useState<string | undefined>();
  function changed(update: (rows: BookingDraft[]) => BookingDraft[]) {
    setDrafts(update);
    setId(Crypto.randomUUID());
  }
  return <Context.Provider value={{ drafts, id, suggestedDiscountCode,
    add: draft => changed(rows => [...rows.filter(r => r.key !== draft.key), draft]),
    remove: key => changed(rows => rows.filter(r => r.key !== key)),
    clear: () => { setSuggestedDiscountCode(undefined); changed(() => []); },
    suggestDiscountCode: setSuggestedDiscountCode,
  }}>{children}</Context.Provider>;
}
export function useBooking() {
  const state = useContext(Context);
  if (!state) throw new Error('BookingProvider is required');
  return state;
}
