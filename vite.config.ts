import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Tách React và React DOM thành chunk riêng
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Tách Supabase thành chunk riêng
          'supabase': ['@supabase/supabase-js'],
          // Tách UI components (Radix UI) thành chunk riêng
          'ui-vendor': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
          ],
          // Tách các utilities và icons thành chunk riêng
          'utils-vendor': [
            '@tanstack/react-query',
            'date-fns',
            'lucide-react',
            'class-variance-authority',
            'clsx',
            'tailwind-merge',
          ],
          // Tách charts thành chunk riêng (nếu dùng)
          'charts': ['recharts'],
        },
      },
    },
    // Tăng chunk size warning limit lên 600KB vì chúng ta đã tối ưu bằng manual chunks
    chunkSizeWarningLimit: 600,
  },
}));
