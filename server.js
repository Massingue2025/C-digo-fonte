const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

let loginEtapa = {};

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.post('/buscar', async (req, res) => {
  const { url, email, senha, codigo } = req.body;

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    if (url.includes('facebook.com') && !email && !senha) {
      loginEtapa[url] = 'login';
      await browser.close();
      return res.send('<script>window.location="/?etapa=login";</script>');
    }

    if (email && senha && !codigo) {
      await page.type('input#email', email, { delay: 50 });
      await page.type('input#pass', senha, { delay: 50 });
      await page.click('button[name="login"]');
      await page.waitForTimeout(5000);

      const pageContent = await page.content();

      if (pageContent.includes('Insira o código') || pageContent.includes('Digite o código') || pageContent.includes('código de login')) {
        loginEtapa[url] = '2fa';
        await browser.close();
        return res.send('<script>window.location="/?etapa=codigo";</script>');
      }
    }

    if (codigo) {
      // Facebook geralmente usa input[name="approvals_code"]
      await page.type('input[name="approvals_code"]', codigo, { delay: 50 });
      await page.click('button[name="submit[Continue]"]');
      await page.waitForTimeout(4000);

      // Confirmar navegador
      try {
        await page.click('button[name="submit[This was me]"]');
        await page.waitForTimeout(2000);
      } catch (e) {}

      // Prosseguir até a tela inicial
      try {
        await page.click('button[name="submit[Continue]"]');
        await page.waitForTimeout(2000);
      } catch (e) {}
    }

    // Extrair seletores
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
