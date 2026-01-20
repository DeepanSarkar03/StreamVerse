'use client';

import { useState, useRef, useEffect, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { uploadVideo } from '@/app/actions';
import { Loader2, UploadCloud, FileVideo, X } from 'lucide-react';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Uploading...
        </>
      ) : (
        <>
         <UploadCloud className="mr-2 h-4 w-4" />
          Upload File
        </>
      )}
    </Button>
  );
}

export function UploadDialog() {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [state, formAction] = useActionState(uploadVideo, null);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        setFileName(selectedFile.name);
    } else {
        setFileName('');
    }
  };

  const clearFile = (e?: React.MouseEvent) => {
    e?.preventDefault(); // Prevent label from triggering file input again
    setFileName('');
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };
  
  useEffect(() => {
    if (!state) return;
    if (state.error) {
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: state.error,
      });
    } else if (state.success) {
      toast({
        title: 'Upload Successful',
        description: state.success,
      });
      setOpen(false);
    }
  }, [state, toast]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
            clearFile();
            formRef.current?.reset();
        }
    }}>
      <DialogTrigger asChild>
        <Button>
          <UploadCloud className="mr-2 h-4 w-4" />
          Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload a Video</DialogTitle>
          <DialogDescription>
            Select a video file to upload to OneDrive. The app will refresh automatically.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={formAction}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="file">Video File</Label>
               {/*
                The file input must always be present in the form for the submission to work correctly.
                Instead of conditionally rendering it, we make it transparent and layer it behind a custom UI.
                The label now acts as the clickable area.
              */}
              <Label htmlFor="file" className="relative block cursor-pointer">
                <Input
                  id="file"
                  name="file"
                  type="file"
                  required
                  accept="video/*"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />

                {fileName ? (
                  <div className="flex items-center justify-between p-2 h-10 rounded-md border bg-muted/50">
                    <div className="flex items-center gap-2 truncate">
                      <FileVideo className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-normal">{fileName}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 z-10"
                      onClick={clearFile}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm text-muted-foreground">
                    Click to select a file
                  </div>
                )}
              </Label>
            </div>
            <input type="hidden" name="destination" value="onedrive" />
          </div>
          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
