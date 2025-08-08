import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { File, Trash2, Download, Eye, Search, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useFileStorage } from '@/hooks/useFileStorage';

interface FileManagerProps {
  className?: string;
}

export const FileManager: React.FC<FileManagerProps> = ({ className }) => {
  const { files, loading, deleteFile, getFileUrl, getSignedUrl } = useFileStorage();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBucket, setSelectedBucket] = useState<string>('all');

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         file.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBucket = selectedBucket === 'all' || file.bucket_id === selectedBucket;
    return matchesSearch && matchesBucket;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType?.startsWith('image/')) return '🖼️';
    if (mimeType?.includes('pdf')) return '📄';
    if (mimeType?.includes('document') || mimeType?.includes('word')) return '📝';
    if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return '📊';
    return '📎';
  };

  const handleView = async (file: any) => {
    if (file.bucket_id === 'avatars') {
      const url = getFileUrl(file.file_path, file.bucket_id);
      if (url) window.open(url, '_blank');
    } else {
      const signedUrl = await getSignedUrl(file.file_path, file.bucket_id);
      if (signedUrl) window.open(signedUrl, '_blank');
    }
  };

  const handleDownload = async (file: any) => {
    try {
      let url;
      if (file.bucket_id === 'avatars') {
        url = getFileUrl(file.file_path, file.bucket_id);
      } else {
        url = await getSignedUrl(file.file_path, file.bucket_id);
      }
      
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = file.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <File className="h-5 w-5" />
            File Manager
          </CardTitle>
          <CardDescription>
            Manage your uploaded files and documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={selectedBucket === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedBucket('all')}
              >
                All
              </Button>
              <Button
                variant={selectedBucket === 'avatars' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedBucket('avatars')}
              >
                Avatars
              </Button>
              <Button
                variant={selectedBucket === 'documents' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedBucket('documents')}
              >
                Documents
              </Button>
              <Button
                variant={selectedBucket === 'uploads' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedBucket('uploads')}
              >
                Uploads
              </Button>
            </div>
          </div>

          {/* Files List */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-[200px] mb-2" />
                    <Skeleton className="h-3 w-[100px]" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || selectedBucket !== 'all' 
                ? "No files match your search criteria" 
                : "No files uploaded yet"}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <div className="text-2xl">
                      {getFileIcon(file.mime_type || '')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{file.file_name}</h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {file.bucket_id}
                        </Badge>
                        {file.file_size && (
                          <span>{formatFileSize(file.file_size)}</span>
                        )}
                        <span>
                          {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {file.description && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {file.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleView(file)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(file)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete File</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{file.file_name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteFile(file.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};