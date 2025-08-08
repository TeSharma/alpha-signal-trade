import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HardDrive, Upload, FolderOpen } from 'lucide-react';
import { FileUpload } from './FileUpload';
import { FileManager } from './FileManager';

export const StorageCenter = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">File Storage</h1>
        <p className="text-muted-foreground">Upload, manage, and organize your files</p>
      </div>

      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Files
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Manage Files
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Avatar Upload */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Profile Pictures</h3>
              <FileUpload
                bucket="avatars"
                accept={{ 'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'] }}
                maxSize={2 * 1024 * 1024} // 2MB
                multiple={false}
              />
            </div>

            {/* Document Upload */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Documents</h3>
              <FileUpload
                bucket="documents"
                accept={{
                  'application/pdf': ['.pdf'],
                  'application/msword': ['.doc'],
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                  'text/plain': ['.txt']
                }}
                maxSize={10 * 1024 * 1024} // 10MB
                multiple={true}
              />
            </div>

            {/* General Upload */}
            <div>
              <h3 className="text-lg font-semibold mb-3">General Files</h3>
              <FileUpload
                bucket="uploads"
                accept={{
                  'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
                  'application/pdf': ['.pdf'],
                  'text/*': ['.txt'],
                  'application/*': []
                }}
                maxSize={50 * 1024 * 1024} // 50MB
                multiple={true}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="manage">
          <FileManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};