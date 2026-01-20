'use client';

import { useState, useRef, useEffect } from 'react';
import { useFormStatus, useFormState } from 'react-dom';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
  const [state, formAction] = useFormState(uploadVideo, null);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        setFileName(selectedFile.name);
    } else {
        setFileName('');
    }
  };

  const clearFile = () => {
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
            Select a video file and choose where to upload it. The app will refresh automatically.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={formAction}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="file">Video File</Label>
              {fileName ? (
                <div className="flex items-center justify-between p-2 rounded-md border bg-muted/50">
                    <div className="flex items-center gap-2 truncate">
                        <FileVideo className="h-5 w-5 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm">{fileName}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearFile}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
              ) : (
                <Input id="file" name="file" type="file" required accept="video/*" onChange={handleFileChange} ref={fileInputRef}/>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">Upload Destination</Label>
              <RadioGroup required name="destination" defaultValue="gdrive" className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="gdrive" id="gdrive" />
                  <Label htmlFor="gdrive">Google Drive</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="onedrive" id="onedrive" />
                  <Label htmlFor="onedrive">OneDrive</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}