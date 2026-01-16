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
      react({
        tsDecorators: true,
        tsconfig: './tsconfig.json',
      }),
      mode === 'development' && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    esbuild: {
      // Override tsconfig.json for the build - use React JSX settings
      jsx: 'automatic',
      target: 'es2020',
      tsconfigRaw: {
        compilerOptions: {
          jsx: 'react-jsx',
          jsxImportSource: 'react',
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'bundler',
          baseUrl: '.',
          paths: {
            '@/*': ['./src/*'],
          },
        },
      },
    },
    build: {
      target: 'es2020',
      rollupOptions: {
        // Exclude Solidity files from the build
        external: (id) => id.endsWith('.sol'),
      },
    },
    define: {
      'process.env': {
        NEXT_PUBLIC_SUPABASE_URL: 'https://trbgjsurjfubezcdzpao.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyYmdqc3VyamZ1YmV6Y2R6cGFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMjc4ODksImV4cCI6MjA2NDgwMzg4OX0._3CDlFbsFa-K805nSh5n6OGJfs-o0eHlceaMm-ykroo',
      },
    },
  };
});
