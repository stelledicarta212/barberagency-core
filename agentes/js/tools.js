const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const fetch = require('node-fetch');

function createFile({ filePath, content }) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('createFile: filePath inválido.');
  }

  const absolutePath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, String(content || ''), 'utf8');
  return { success: true, filePath: absolutePath };
}

function runSQL({ query, connectionString }) {
  if (!query || typeof query !== 'string') {
    throw new Error('runSQL: query inválido.');
  }

  if (!connectionString || typeof connectionString !== 'string') {
    throw new Error('runSQL: connectionString inválido.');
  }

  return new Promise((resolve, reject) => {
    const cmd = `sqlcmd -S ${connectionString} -Q "${query.replace(/"/g, '\\"')}" -W -s ","`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`runSQL: ${stderr || error.message}`));
      }

      const rows = String(stdout || '')
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .map(line => line.split(','));

      resolve({ success: true, rows });
    });
  });
}

async function callAPI({ url, method = 'GET', headers = {}, body }) {
  if (!url || typeof url !== 'string') {
    throw new Error('callAPI: url inválida.');
  }

  const opts = {
    method: method.toUpperCase(),
    headers: { 'Content-Type': 'application/json', ...headers },
  };

  if (body !== undefined) {
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const response = await fetch(url, opts);
  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(`callAPI: ${response.status} ${response.statusText} - ${text}`);
  }

  return { success: true, status: response.status, data };
}

module.exports = { createFile, runSQL, callAPI };