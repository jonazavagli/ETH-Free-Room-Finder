import React, { Suspense } from 'react';
import { FreeRoomFinderApp } from '@/components/FreeRoomFinderApp';

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-[var(--text-muted)]">
          Loading Free Room Finder...
        </div>
      }
    >
      <FreeRoomFinderApp />
    </Suspense>
  );
}
