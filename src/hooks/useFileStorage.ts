import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserFile {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  bucket_id: string;
  description?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
}

export const useFileStorage = () => {
  const [files, setFiles] = useState<UserFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const { toast } = useToast();

  // Fetch user files
  const fetchFiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_files')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast({
        title: "Error",
        description: "Failed to fetch files",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Upload file to storage
  const uploadFile = async (
    file: File,
    bucket: 'avatars' | 'documents' | 'uploads',
    description?: string
  ): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Add to upload progress
      setUploadProgress(prev => [...prev, {
        fileName: file.name,
        progress: 0,
        status: 'uploading'
      }]);

      // Upload to storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (storageError) throw storageError;

      // Update progress
      setUploadProgress(prev => 
        prev.map(p => 
          p.fileName === file.name 
            ? { ...p, progress: 50, status: 'uploading' }
            : p
        )
      );

      // Save file metadata to database
      const { error: dbError } = await supabase
        .from('user_files')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: storageData.path,
          file_size: file.size,
          mime_type: file.type,
          bucket_id: bucket,
          description,
          is_public: bucket === 'avatars'
        });

      if (dbError) throw dbError;

      // Complete upload progress
      setUploadProgress(prev => 
        prev.map(p => 
          p.fileName === file.name 
            ? { ...p, progress: 100, status: 'completed' }
            : p
        )
      );

      // Remove from progress after delay
      setTimeout(() => {
        setUploadProgress(prev => prev.filter(p => p.fileName !== file.name));
      }, 2000);

      toast({
        title: "Success",
        description: `${file.name} uploaded successfully`,
      });

      await fetchFiles();
      return storageData.path;
    } catch (error) {
      console.error('Error uploading file:', error);
      
      // Update progress to error
      setUploadProgress(prev => 
        prev.map(p => 
          p.fileName === file.name 
            ? { ...p, status: 'error' }
            : p
        )
      );

      toast({
        title: "Error",
        description: `Failed to upload ${file.name}`,
        variant: "destructive",
      });
      
      return null;
    }
  };

  // Delete file
  const deleteFile = async (fileId: string) => {
    try {
      const file = files.find(f => f.id === fileId);
      if (!file) return;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(file.bucket_id)
        .remove([file.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('user_files')
        .delete()
        .eq('id', fileId);

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: `${file.file_name} deleted successfully`,
      });

      await fetchFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive",
      });
    }
  };

  // Get file URL
  const getFileUrl = (filePath: string, bucket: string) => {
    if (bucket === 'avatars') {
      const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);
      return data.publicUrl;
    } else {
      // For private files, you'd need to create a signed URL
      return null;
    }
  };

  // Get signed URL for private files
  const getSignedUrl = async (filePath: string, bucket: string, expiresIn = 3600) => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, expiresIn);

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  return {
    files,
    loading,
    uploadProgress,
    uploadFile,
    deleteFile,
    getFileUrl,
    getSignedUrl,
    refetch: fetchFiles,
  };
};