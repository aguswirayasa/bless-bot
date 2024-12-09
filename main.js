const fs = require("fs").promises;
const { HttpsProxyAgent } = require("https-proxy-agent");
const readline = require("readline");

const apiBaseUrl = "https://gateway-run.bls.dev/api/v1";
const ipServiceUrl = "https://tight-block-2413.txlabs.workers.dev";
let useProxy;

async function loadFetch() {
  const fetch = await import("node-fetch").then((module) => module.default);
  return fetch;
}

async function readProxies() {
  const data = await fs.readFile("proxy.txt", "utf-8");
  const proxies = data
    .trim()
    .split("\n")
    .filter((proxy) => proxy);
  return proxies;
}

async function readNodeAndHardwareIds() {
  const data = await fs.readFile("id.txt", "utf-8");
  const ids = data
    .trim()
    .split("\n")
    .filter((id) => id)
    .map((id) => {
      const [nodeId, hardwareId] = id.split(":");
      return { nodeId, hardwareId };
    });
  return ids;
}

async function readAuthToken() {
  const data = await fs.readFile("user.txt", "utf-8");
  return data.trim();
}

async function promptUseProxy() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Do you want to use a proxy? (y/n): ", (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

async function fetchIpAddress(fetch, agent) {
  const response = await fetch(ipServiceUrl, { agent });
  const data = await response.json();
  console.log(`[${new Date().toISOString()}] IP fetch response:`, data);
  return data.ip;
}

async function registerNode(nodeId, hardwareId, ipAddress, proxy, authToken) {
  const fetch = await loadFetch();
  let agent;

  if (proxy) {
    agent = new HttpsProxyAgent(proxy);
  }

  const registerUrl = `${apiBaseUrl}/nodes/${nodeId}`;
  console.log(
    `[${new Date().toISOString()}] Registering node with IP: ${ipAddress}, Hardware ID: ${hardwareId}`
  );
  const response = await fetch(registerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      ipAddress,
      hardwareId,
    }),
    agent,
  });

  let data;
  try {
    data = await response.json();
  } catch (error) {
    const text = await response.text();
    console.error(
      `[${new Date().toISOString()}] Failed to parse JSON. Response text:`,
      text
    );
    throw error;
  }

  console.log(`[${new Date().toISOString()}] Registration response:`, data);
  return data;
}

async function startSession(nodeId, proxy, authToken) {
  const fetch = await loadFetch();
  let agent;

  if (proxy) {
    agent = new HttpsProxyAgent(proxy);
  }

  const startSessionUrl = `${apiBaseUrl}/nodes/${nodeId}/start-session`;
  console.log(
    `[${new Date().toISOString()}] Starting session for node ${nodeId}, it might take a while...`
  );
  const response = await fetch(startSessionUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
    agent,
  });
  const data = await response.json();
  console.log(`[${new Date().toISOString()}] Start session response:`, data);
  return data;
}

async function pingNode(nodeId, proxy, ipAddress, authToken) {
  const fetch = await loadFetch();
  const chalk = await import("chalk");
  let agent;

  if (proxy) {
    agent = new HttpsProxyAgent(proxy);
  }

  const pingUrl = `${apiBaseUrl}/nodes/${nodeId}/ping`;
  console.log(
    `[${new Date().toISOString()}] Pinging node ${nodeId} using proxy ${proxy}`
  );
  const response = await fetch(pingUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
    agent,
  });
  const data = await response.json();

  const status = data.status;
  const logMessage = `[${new Date().toISOString()}] Ping response, NodeID: ${chalk.default.green(
    nodeId
  )}, Status: ${chalk.default.yellow(
    status
  )}, Proxy: ${proxy}, IP: ${ipAddress}`;
  console.log(logMessage);

  return data;
}

async function displayHeader() {
  console.log("");
  console.log(
    `███████╗██╗     ██╗  ██╗     ██████╗██╗   ██╗██████╗ ███████╗██████╗ `
  );
  console.log(
    `╚══███╔╝██║     ██║ ██╔╝    ██╔════╝╚██╗ ██╔╝██╔══██╗██╔════╝██╔══██╗`
  );
  console.log(
    `  ███╔╝ ██║     █████╔╝     ██║      ╚█���██╔╝ ██████╔╝█████╗  ██████╔╝`
  );
  console.log(
    ` ███╔╝  ██║     ██╔═██╗     ██║       ╚██╔╝  ██╔══██╗██╔══╝  ██╔══██╗`
  );
  console.log(
    `███████╗███████╗██║  ██╗    ╚██████╗   ██║   ██████╔╝███████╗██║  ██║`
  );
  console.log(
    `╚══════╝╚══════╝╚═╝  ╚═╝     ╚═════╝   ╚═╝   ╚═════╝ ╚══════╝╚═╝  ╚═╝`
  );
  console.log(
    `                 Running Blockless Node BETA CLI Version             `
  );
  console.log(
    `                t.me/zlkcyber *** github.com/zlkcyber                `
  );
  console.log("");
}

async function processNode(nodeId, hardwareId, proxy, ipAddress, authToken) {
  while (true) {
    try {
      console.log(
        `[${new Date().toISOString()}] Processing nodeId: ${nodeId}, hardwareId: ${hardwareId}, IP: ${ipAddress}`
      );

      const registrationResponse = await registerNode(
        nodeId,
        hardwareId,
        ipAddress,
        proxy,
        authToken
      );
      console.log(
        `[${new Date().toISOString()}] Node registration completed for nodeId: ${nodeId}. Response:`,
        registrationResponse
      );

      const startSessionResponse = await startSession(nodeId, proxy, authToken);
      console.log(
        `[${new Date().toISOString()}] Session started for nodeId: ${nodeId}. Response:`,
        startSessionResponse
      );

      console.log(
        `[${new Date().toISOString()}] Sending initial ping for nodeId: ${nodeId}`
      );
      await pingNode(nodeId, proxy, ipAddress, authToken);

      setInterval(async () => {
        try {
          console.log(
            `[${new Date().toISOString()}] Sending ping for nodeId: ${nodeId}`
          );
          await pingNode(nodeId, proxy, ipAddress, authToken);
        } catch (error) {
          console.error(
            `[${new Date().toISOString()}] Error during ping: ${error.message}`
          );
          throw error;
        }
      }, 60000);

      break;
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Error occurred for nodeId: ${nodeId}, restarting process: ${
          error.message
        }`
      );
    }
  }
}

async function loadAccounts() {
  const data = await fs.readFile("account.json", "utf-8");
  return JSON.parse(data);
}

async function runAll(initialRun = true) {
  try {
    if (initialRun) {
      await displayHeader();
      useProxy = await promptUseProxy();
    }

    const accounts = await loadAccounts();
    const proxies = await readProxies();
    let proxyIndex = 0;

    for (const account of accounts) {
      const authToken = account.token;
      const nodes = account.nodes;

      for (const node of nodes) {
        const [nodeId, hardwareId] = node.split(":");
        let proxy = null;
        let ipAddress = null;

        if (useProxy) {
          while (proxyIndex < proxies.length) {
            proxy = proxies[proxyIndex];
            try {
              ipAddress = await fetchIpAddress(
                await loadFetch(),
                new HttpsProxyAgent(proxy)
              );
              break; // Exit loop if successful
            } catch (error) {
              console.error(
                `[${new Date().toISOString()}] Proxy failed: ${proxy}. Trying next proxy.`
              );
              proxyIndex++;
            }
          }
        }

        if (proxyIndex >= proxies.length) {
          console.error(
            `[${new Date().toISOString()}] No more proxies available.`
          );
          return;
        }

        await processNode(nodeId, hardwareId, proxy, ipAddress, authToken);
        proxyIndex++;
      }
    }
  } catch (error) {
    const chalk = await import("chalk");
    console.error(
      chalk.default.yellow(
        `[${new Date().toISOString()}] An error occurred: ${error.message}`
      )
    );
  }
}

process.on("uncaughtException", (error) => {
  console.error(
    `[${new Date().toISOString()}] Uncaught exception: ${error.message}`
  );
  runAll(false);
});

runAll();
