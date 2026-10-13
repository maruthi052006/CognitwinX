const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function getDebuggerUrl(port) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const pageTarget = list.find(t => t.type === 'page');
          if (pageTarget) {
            resolve(pageTarget.webSocketDebuggerUrl);
          } else if (list.length > 0) {
            resolve(list[0].webSocketDebuggerUrl);
          } else {
            resolve(null);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function sendCommand(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 100000);
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        if (msg.error) {
          reject(new Error(`${method} error: ${JSON.stringify(msg.error)}`));
        } else {
          resolve(msg.result);
        }
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function run() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const debugPort = 9222;
  const targetUrl = 'http://localhost:5173/#dashboard';
  const tempDir = path.join(__dirname, '..', 'scratch', `chrome_profile_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  console.log(`[CDP Test] Launching Chrome headless on port ${debugPort}...`);
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${tempDir}`,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--disk-cache-size=0',
    'about:blank'
  ]);

  // Give Chrome 2 seconds to bind debug port
  await new Promise(r => setTimeout(r, 2000));

  let wsUrl;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      wsUrl = await getDebuggerUrl(debugPort);
      if (wsUrl) break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (!wsUrl) {
    console.error('Failed to get WebSocket debugger URL from Chrome.');
    chromeProc.kill();
    process.exit(1);
  }

  console.log(`[CDP Test] Connected to Chrome DevTools: ${wsUrl}`);
  const ws = new WebSocket(wsUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const consoleLogs = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
      consoleLogs.push({ type: msg.params.type, text });
      if (msg.params.type === 'error') {
        console.error(`[Browser Console Error] ${text}`);
      }
    } else if (msg.method === 'Runtime.exceptionThrown') {
      console.error(`[Browser Exception] ${JSON.stringify(msg.params.exceptionDetails)}`);
      consoleLogs.push({ type: 'exception', text: JSON.stringify(msg.params.exceptionDetails) });
    }
  });

  // Enable necessary domains
  await sendCommand(ws, 'Network.enable');
  await sendCommand(ws, 'Network.setCacheDisabled', { cacheDisabled: true });
  await sendCommand(ws, 'Page.enable');
  await sendCommand(ws, 'Runtime.enable');
  await sendCommand(ws, 'DOM.enable');

  console.log(`[CDP Test] Navigating to ${targetUrl}...`);
  await sendCommand(ws, 'Page.navigate', { url: targetUrl });

  // Wait for load and React mounting
  await new Promise(r => setTimeout(r, 4000));

  const breakpoints = [
    { name: 'desktop_1920', width: 1920, height: 1080 },
    { name: 'tablet_1024', width: 1024, height: 768 },
    { name: 'mobile_375', width: 375, height: 812 }
  ];

  const results = {};

  for (const bp of breakpoints) {
    console.log(`\n--- Testing Breakpoint: ${bp.name} (${bp.width}x${bp.height}) ---`);
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: bp.width,
      height: bp.height,
      deviceScaleFactor: 1,
      mobile: bp.width < 600
    });

    await new Promise(r => setTimeout(r, 1500));

    // Evaluate layout health: horizontal overflow, button count, active elements
    const evalRes = await sendCommand(ws, 'Runtime.evaluate', {
      expression: `(() => {
        const docWidth = document.documentElement.offsetWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const hasOverflow = scrollWidth > docWidth;
        const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
          text: (b.innerText || b.getAttribute('title') || '').slice(0, 30),
          width: b.offsetWidth,
          height: b.offsetHeight,
          visible: b.offsetWidth > 0 && b.offsetHeight > 0
        }));
        const smallButtons = buttons.filter(b => b.visible && (b.width < 28 || b.height < 28));
        return {
          docWidth,
          scrollWidth,
          hasOverflow,
          totalButtons: buttons.length,
          smallButtonsCount: smallButtons.length,
          title: document.title,
          heading: document.querySelector('h1')?.innerText || ''
        };
      })()`,
      returnByValue: true
    });

    results[bp.name] = evalRes.value;
    console.log(`Result for ${bp.name}:`, JSON.stringify(evalRes.value, null, 2));

    // Capture screenshot
    const shot = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
    const shotPath = path.join(__dirname, '..', `screenshot_${bp.name}.png`);
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot to ${shotPath}`);
  }

  // Check for critical console errors
  const criticalErrors = consoleLogs.filter(l => l.type === 'error' || l.type === 'exception');
  console.log(`\n[CDP Test] Total console messages: ${consoleLogs.length}`);
  console.log(`[CDP Test] Total console errors: ${criticalErrors.length}`);

  ws.close();
  chromeProc.kill();

  console.log('\n[CDP Test] FINISHED ALL BREAKPOINTS SUCCESSFULLY.');
}

run().catch(err => {
  console.error('[CDP Test Failed]:', err);
  process.exit(1);
});
