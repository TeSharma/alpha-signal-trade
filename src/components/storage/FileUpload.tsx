import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, File, X, Eye, Download, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFileStorage } from '@/hooks/useFileStorage';

interface FileUploadProps {
  bucket: 'avatars' | 'documents' | 'uploads';
  accept?: Record<string, string[]>;
  maxSize?: number;
  multiple?: boolean;
  onUploadComplete?: (filePaths: string[]) => void;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  bucket,
  accept = {
    'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
    'application/pdf': ['.pdf'],
    'text/*': ['.txt', '.doc', '.docx'],
  },
  maxSize = 5 * 1024 * 1024, // 5MB
  multiple = false,
  onUploadComplete,
  className
}) => {
  const { uploadFile, uploadProgress } = useFileStorage();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const uploadPromises = acceptedFiles.map(file => uploadFile(file, bucket));
    const results = await Promise.all(uploadPromises);
    const successfulUploads = results.filter(Boolean) as string[];
    
    if (onUploadComplete && successfulUploads.length > 0) {
      onUploadComplete(successfulUploads);
    }
  }, [bucket, uploadFile, onUploadComplete]);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
    fileRejections
  } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple
  });

  return (
    <div className={className}>
      <Card>
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              isDragActive && !isDragReject && "border-primary bg-primary/5",
              isDragReject && "border-destructive bg-destructive/5",
              !isDragActive && "border-muted-foreground/25 hover:border-primary/50"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            
            {isDragActive ? (
              <p className="text-lg font-medium">
                {isDragReject ? "File type not supported" : "Drop files here..."}
              </p>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">
                  Drag & drop files here, or click to select
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {multiple ? "Upload multiple files" : "Upload a single file"} 
                  (max {Math.round(maxSize / 1024 / 1024)}MB each)
                </p>
                <Button variant="outline">
                  Select Files
                </Button>
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {uploadProgress.length > 0 && (
            <div className="mt-6 space-y-3">
              <h4 className="text-sm font-medium">Uploading Files</h4>
              {uploadProgress.map((progress) => (
                <div key={progress.fileName} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{progress.fileName}</span>
                    <Badge 
                      variant={
                        progress.status === 'completed' ? 'default' :
                        progress.status === 'error' ? 'destructive' : 'secondary'
                      }
                    >
                      {progress.status === 'completed' ? 'Done' :
                       progress.status === 'error' ? 'Error' : `${progress.progress}%`}
                    </Badge>
                  </div>
                  {progress.status === 'uploading' && (
                    <Progress value={progress.progress} className="h-2" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Rejected Files */}
          {fileRejections.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-destructive mb-2">
                Rejected Files
              </h4>
              <div className="space-y-1">
                {fileRejections.map(({ file, errors }) => (
                  <div key={file.name} className="text-sm text-muted-foreground">
                    <span className="font-medium">{file.name}</span>
                    {errors.map((error) => (
                      <div key={error.code} className="text-destructive">
                        {error.message}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};