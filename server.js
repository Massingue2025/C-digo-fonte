const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.post('/buscar', async (req, res) => {
  const url = req.body.url;

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    const elementos = await page.evaluate(() => {
      const tipos = ['input', 'textarea', 'select', 'button'];
      const dados = [];

      tipos.forEach(tag => {
        const els = Array.from(document.querySelectorAll(tag));
        els.forEach(el => {
          try {
            let path = '';
            let current = el;
            while (current && current.nodeType === 1 && current.tagName.toLowerCase() !== 'html') {
              let name = current.tagName.toLowerCase();
              if (current.id) name += `#${current.id}`;
              if (current.className) name += `.${current.className.trim().replace(/\s+/g, '.')}`;
              path = `${name} > ${path}`;
              current = current.parentElement;
            }
            dados.push(`${tag.toUpperCase()}: html > ${path.slice(0, -3)}`);
          } catch (e) {}
        });
      });

      return dados;
    });

    await browser.close();

    const htmlContent = `
      <html>
        <head><meta charset="UTF-8"><title>Selecionados</title></head>
        <body>
          <h2>Campos encontrados:</h2>
          <pre>${elementos.join('\n')}</pre>
        </body>
      </html>
    `;

    fs.writeFileSync(__dirname + '/public/seletores.html', htmlContent, 'utf-8');
    res.redirect('/seletores.html');
  } catch (err) {
    console.error('Erro Puppeteer:', err);
    res.send(`<h3>Erro ao processar a página</h3><pre>${err.message}\n\n${err.stack}</pre>`);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
