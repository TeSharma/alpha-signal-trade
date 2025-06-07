
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      host: '::',
      port: 8080,
    },
    plugins: [
      react(),
      mode === 'development' && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      'process.env': {
        NEXT_PUBLIC_SUPABASE_URL: JSON.stringify('https://trbgjsurjfubezcdzpao.supabase.co'),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyYmdqc3VyamZ1YmV6Y2R6cGFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMjc4ODksImV4cCI6MjA2NDgwMzg4OX0._3CDlFbsFa-K805nSh5n6OGJfs-o0eHlceaMm-ykroo'),
      },
    },
  };
});
