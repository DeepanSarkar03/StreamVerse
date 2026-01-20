'use client';
import Link from 'next/link';
import { Logo } from '@/components/icons';
import { UploadDialog } from '@/components/upload-dialog';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Logo className="h-6 w-auto" />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <UploadDialog />
        </div>
      </div>
    </header>
  );
}
