'use client';

import { createContext, useContext } from 'react';

interface DrawerControl {
  openDrawer: () => void;
}

export const DrawerContext = createContext<DrawerControl>({ openDrawer: () => {} });

/** Screens call this instead of expo-router's `navigation.openDrawer()`. */
export function useDrawer() {
  return useContext(DrawerContext);
}
