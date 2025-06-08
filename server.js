const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/index.html'));
});

app.post('/buscar', async (req, res) => {
  const url = req.body.url;
  if (!url || !url.startsWith('http')) {
    return res.send('URL inválida.');
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const selectors = await page.evaluate(() => {
      function getUniqueSelector(el) {
        if (!el || el.tagName === 'HTML') return 'html';
        if (el.id) return `#${el.id}`;
        let path = el.tagName.toLowerCase();
        if (el.name) path += `[name="${el.name}"]`;
        return getUniqueSelector(el.parentElement) + ' > ' + path;
      }

      const fields = Array.from(document.querySelectorAll('input, textarea, select, button'));
      return fields.map(el => ({
        tag: el.tagName.toLowerCase(),
        selector: getUniqueSelector(el)
      }));
    });

    const html = `
    <!DOCTYPE html>
    <html lang="pt">
    <head>
      <meta charset="UTF-8">
      <title>Selectores</title>
      <style>
        body { font-family: sans-serif; padding: 20px; }
        .selector { margin-bottom: 10px; padding: 5px; border-bottom: 1px solid #ccc; }
        code { background: #eee; padding: 2px 5px; }
      </style>
    </head>
    <body>
      <h1>Selectores da página</h1>
      <p><strong>URL:</strong> ${url}</p>
      ${selectors.map(s => `<div class="selector"><strong>${s.tag}:</strong> <code>${s.selector}</code></div>`).join('')}
    </body>
    </html>`;

    fs.writeFileSync(path.join(__dirname, 'public/seletores.html'), html);

    await browser.close();
    res.redirect('/seletores.html');

  } catch (err) {
    console.error(err);
    res.send('Erro ao processar a página.');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
