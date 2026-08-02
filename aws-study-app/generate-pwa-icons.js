/* global process */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');
const svgPath = path.join(publicDir, 'icon.svg');

if (!fs.existsSync(svgPath)) {
    console.error('icon.svg não encontrado!');
    process.exit(1);
}

const svgBuffer = fs.readFileSync(svgPath);

async function generateIcons() {
    console.log('Gerando ícones PWA...');

    // 192x192 PNG
    await sharp(svgBuffer)
        .resize(192, 192)
        .png()
        .toFile(path.join(publicDir, 'pwa-192x192.png'));
    console.log('✔ Criado public/pwa-192x192.png');

    // 512x512 PNG
    await sharp(svgBuffer)
        .resize(512, 512)
        .png()
        .toFile(path.join(publicDir, 'pwa-512x512.png'));
    console.log('✔ Criado public/pwa-512x512.png');

    // Apple Touch Icon (180x180 com fundo Indigo 600)
    await sharp({
        create: {
            width: 180,
            height: 180,
            channels: 4,
            background: { r: 79, g: 70, b: 229, alpha: 1 } // #4f46e5
        }
    })
    .composite([{
        input: await sharp(svgBuffer).resize(140, 140).toBuffer(),
        gravity: 'center'
    }])
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
    console.log('✔ Criado public/apple-touch-icon.png');

    // Maskable Icon 512x512 com Safe Zone
    await sharp({
        create: {
            width: 512,
            height: 512,
            channels: 4,
            background: { r: 79, g: 70, b: 229, alpha: 1 } // #4f46e5
        }
    })
    .composite([{
        input: await sharp(svgBuffer).resize(400, 400).toBuffer(),
        gravity: 'center'
    }])
    .png()
    .toFile(path.join(publicDir, 'maskable-icon-512x512.png'));
    console.log('✔ Criado public/maskable-icon-512x512.png');

    console.log('✨ Todos os ícones PWA foram gerados com sucesso!');
}

generateIcons().catch(err => {
    console.error('Erro ao gerar ícones:', err);
    process.exit(1);
});
