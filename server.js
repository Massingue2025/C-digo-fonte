const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

let browser, page;
let sessionCookies = null;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.post('/start', async (req, res) => {
  const { url } = req.body;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    page = await browser.newPage();

    if (fs.existsSync('cookies.json')) {
      const cookies = JSON.parse(fs.readFileSync('cookies.json', 'utf-8'));
      await page.setCookie(...cookies);
    }

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const isFacebookLogin = page.url().includes('facebook.com/login');

    if (isFacebookLogin) {
      res.send({ etapa: 'login' });
    } else {
      const seletores = await extrairSeletores(page);
      res.send({ etapa: 'seletores', seletores });
    }
  } catch (err) {
    console.error('Erro:', err);
    res.send({ erro: err.message });
  }
});

app.post('/login-facebook', async (req, res) => {
  const { email, senha } = req.body;

  try {
    await page.type('input[name="email"]', email, { delay: 50 });
    await page.type('input[name="pass"]', senha, { delay: 50 });
    await Promise.all([
      page.click('button[name="login"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
    ]);

    if (page.url().includes('checkpoint')) {
      res.send({ etapa: '2fa' });
    } else {
      await salvarSessao();
      const seletores = await extrairSeletores(page);
      res.send({ etapa: 'seletores', seletores });
    }
  } catch (err) {
    console.error('Erro login:', err);
    res.send({ erro: err.message });
  }
});

app.post('/auth-code', async (req, res) => {
  const { codigo } = req.body;

  try {
    await page.type('input[name="approvals_code"]', codigo, { delay: 50 });
    await Promise.all([
      page.click('#checkpointSubmitButton'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
    ]);

    await page.waitForSelector('#checkpointSubmitButton');
    await page.click('#checkpointSubmitButton');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    await salvarSessao();
    const seletores = await extrairSeletores(page);
    res.send({ etapa: 'seletores', seletores });
  } catch (err) {
    console.error('Erro código:', err);
    res.send({ erro: err.message });
  }
});

async function salvarSessao() {
  const cookies = await page.cookies();
  fs.writeFileSync('cookies.json', JSON.stringify(cookies));
}

async function extrairSeletores(pagina) {
  return await pagina.evaluate(() => {
    const tags = ['input', 'textarea', 'select', 'button'];
    const dados = [];

    tags.forEach(tag => {
      document.querySelectorAll(tag).forEach(el => {
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
        } catch (_) {}
      });
    });

    return dados;
  });
}

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
