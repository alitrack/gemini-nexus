import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv, Plugin } from 'vite';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function copyExtensionFiles(): Plugin {
  return {
    name: 'copy-extension-files',
    writeBundle() {
      const filesToCopy = [
        { src: 'manifest.json', dest: 'manifest.json' },
        { src: 'logo.png', dest: 'logo.png' },
        { src: 'background', dest: 'background' },
        { src: 'content', dest: 'content' },
        { src: 'lib', dest: 'lib' }
      ];

      const distDir = path.resolve(__dirname, 'dist');

      for (const { src, dest } of filesToCopy) {
        const srcPath = path.resolve(__dirname, src);
        const destPath = path.resolve(distDir, dest);

        if (!fs.existsSync(srcPath)) {
          console.warn(`[copy-extension-files] Source not found: ${src}`);
          continue;
        }

        try {
          const stat = fs.statSync(srcPath);
          if (stat.isDirectory()) {
            copyDir(srcPath, destPath);
            console.log(`[copy-extension-files] Copied directory: ${src} -> ${dest}`);
          } else {
            fs.copyFileSync(srcPath, destPath);
            console.log(`[copy-extension-files] Copied file: ${src} -> ${dest}`);
          }
        } catch (err) {
          console.error(`[copy-extension-files] Failed to copy ${src}:`, err);
        }
      }
    }
  };
}

function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [copyExtensionFiles()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        input: {
          sidepanel: path.resolve(__dirname, 'sidepanel/index.html'),
          sandbox: path.resolve(__dirname, 'sandbox/index.html')
        }
      }
    }
  };
});
