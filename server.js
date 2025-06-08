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

    // Etapa 1: Detectar se é página de login do Facebook
    if (url.includes('facebook.com') && !email && !senha) {
      loginEtapa[url] = 'login';
      await browser.close();
      return res.send('<script>window.location="/?etapa=login";</script>');
    }

    // Etapa 2: Preencher email/senha
    if (email && senha && !codigo) {
      await page.type('input#email', email, { delay: 50 });
      await page.type('input#pass', senha, { delay: 50 });
      await page.click('button[name="login"]');
      await page.waitForTimeout(5000);

      const content = await page.content();

      // Detectar erro de senha
      if (content.includes('senha incorreta') || content.includes('credenciais inválidas') || content.includes('tentar novamente')) {
        await browser.close();
        return res.send('<h3>Erro: Email ou senha incorretos. <a href="/">Voltar</a></h3>');
      }

      // Detectar pedido de código 2FA
      if (content.includes('Insira o código') || content.includes('Digite o código') || content.includes('código de login')) {
        loginEtapa[url] = '2fa';
        await browser.close();
        return res.send('<script>window.location="/?etapa=codigo";</script>');
      }

      // Detectar se login falhou de outra forma
      if (page.url().includes('/login')) {
        await browser.close();
        return res.send('<h3>Erro: Login não foi concluído. <a href="/">Tentar novamente</a></h3>');
      }
    }

    // Etapa 3: Autenticação em 2 fatores
    if (codigo) {
      await page.type('input[name="approvals_code"]', codigo, { delay: 50 });
      await page.click('button[name="submit[Continue]"]');
      await page.waitForTimeout(4000);

      const content = await page.content();

      // Detectar erro de código
      if (content.includes('código inválido') || content.includes('tente novamente')) {
        await browser.close();
        return res.send('<h3>Erro: Código de autenticação inválido. <a href="/">Tentar novamente</a></h3>');
      }

      // Confirmar navegador
      try {
        await page.click('button[name="submit[This was me]"]');
        await page.waitForTimeout(2000);
      } catch (e) {}

      try {
        await page.click('button[name="submit[Continue]"]');
        await page.waitForTimeout(2000);
      } catch (e) {}
    }

    // Após login: extrair todos os seletores
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
