require('dotenv').config();
const Web3 = require('web3');
const fs = require('fs');
const axios = require('axios');
const readline = require('readline');
const chalk = require('chalk');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

class Turnkey {
  constructor() {
    this.RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
    this.ERC20_CONTRACT_ABI = JSON.private.key(`[
      {"type":"function","name":"balanceOf","stateMutability":"view","inputs":[{"name":"address","type":"address"}],"outputs":[{"name":"","type":"uint256"}]}
    ]`);
    this.proxies = [];
    this.proxyIndex = 0;
    this.accountProxies = {};
    this.txCount = 0;
    this.minAmount = 0;
    this.maxAmount = 0;
    this.minDelay = 0;
    this.maxDelay = 0;
  }

  clearTerminal() {
    console.clear();
  }

  log(message) {
    const options = { timeZone: 'Asia/Jakarta', hour12: false };
    const timestamp = new Date().toLocaleString('en-GB', options);
    console.log(chalk.cyan(`[ ${timestamp} ]`) + ' | ' + message);
  }

  welcome() {
    console.log(chalk.green.bold('Turnkey') + ' ' + chalk.blue.bold('Automatic Bot'));
    console.log(chalk.green.bold('Creator') + ' ' + chalk.yellow.bold('<ZONA AIRDROP>'));
  }

  formatSeconds(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  async loadProxies(useProxyChoice) {
    const filename = "proxy.txt";
    try {
      if (useProxyChoice === 1) {
        const response = await axios.get("https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=protocolipport&format=text", { timeout: 30000 });
        const content = response.data;
        fs.writeFileSync(filename, content, 'utf8');
        this.proxies = content.split(/\r?\n/).filter(line => line.trim() !== '');
      } else {
        if (!fs.existsSync(filename)) {
          this.log(chalk.red.bold(`File ${filename} Not Found.`));
          return;
        }
        const content = fs.readFileSync(filename, 'utf8');
        this.proxies = content.split(/\r?\n/).filter(line => line.trim() !== '');
      }
      if (this.proxies.length === 0) {
        this.log(chalk.red.bold("No Proxies Found."));
        return;
      }
      this.log(chalk.green.bold(`Proxies Total  : `) + chalk.white.bold(`${this.proxies.length}`));
    } catch (error) {
      this.log(chalk.red.bold(`Failed To Load Proxies: ${error.message}`));
      this.proxies = [];
    }
  }

  checkProxyScheme(proxy) {
    const schemes = ["http://", "https://", "socks4://", "socks5://"];
    for (let scheme of schemes) {
      if (proxy.startsWith(scheme)) return proxy;
    }
    return "http://" + proxy;
  }

  getNextProxyForAccount(token) {
    if (!this.accountProxies[token]) {
      if (this.proxies.length === 0) return null;
      const proxy = this.checkProxyScheme(this.proxies[this.proxyIndex]);
      this.accountProxies[token] = proxy;
      this.proxyIndex = (this.proxyIndex + 1) % this.proxies.length;
    }
    return this.accountProxies[token];
  }

  rotateProxyForAccount(token) {
    if (this.proxies.length === 0) return null;
    const proxy = this.checkProxyScheme(this.proxies[this.proxyIndex]);
    this.accountProxies[token] = proxy;
    this.proxyIndex = (this.proxyIndex + 1) % this.proxies.length;
    return proxy;
  }

  generateAddress(privateKey) {
    try {
      const account = Web3.utils.toChecksumAddress(Web3.eth.accounts.privateKeyToAccount(privateKey).address);
      return account;
    } catch (error) {
      this.log(chalk.red.bold(`Generate Address Failed: ${error.message}`));
      return null;
    }
  }

  generateRandomReceiver() {
    try {
      const account = Web3.eth.accounts.create();
      return account.address;
    } catch (error) {
      this.log(chalk.red.bold(`Generate Random Receiver Failed: ${error.message}`));
      return null;
    }
  }

  maskAccount(account) {
    if (!account || account.length < 12) return account;
    return account.slice(0, 6) + '******' + account.slice(-6);
  }

  async getWeb3WithCheck(address, useProxy, retries = 3, timeout = 60000) {
    let providerUrl = this.RPC_URL;
    if (useProxy) {
      const proxy = this.getNextProxyForAccount(address);
      if (proxy) {
        this.log(`Using Proxy: ${proxy} for address ${address}`);
      }
    }
    let web3 = new Web3(providerUrl);
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await web3.eth.getBlockNumber();
        return web3;
      } catch (error) {
        if (attempt < retries - 1) {
          await delay(3000);
          continue;
        }
        throw new Error(`Failed to Connect to RPC: ${error.message}`);
      }
    }
  }

  async getTokenBalance(address, useProxy) {
    try {
      const web3 = await this.getWeb3WithCheck(address, useProxy);
      const balanceWei = await web3.eth.getBalance(address);
      const balanceEth = web3.utils.fromWei(balanceWei, 'ether');
      return parseFloat(balanceEth);
    } catch (error) {
      this.log(chalk.red.bold(`Error Getting Balance: ${error.message}`));
      return null;
    }
  }

  async performTransfer(privateKey, address, receiver, txAmount, useProxy) {
    try {
      const web3 = await this.getWeb3WithCheck(address, useProxy);
      const account = web3.eth.accounts.privateKeyToAccount(privateKey);
      const amountWei = web3.utils.toWei(txAmount.toString(), 'ether');
      const nonce = await web3.eth.getTransactionCount(address, 'pending');
      const gasPrice = await web3.eth.getGasPrice();

      const tx = {
        to: receiver,
        value: amountWei,
        gas: 21000,
        gasPrice: gasPrice,
        nonce: nonce,
        chainId: await web3.eth.getChainId()
      };

      const signedTx = await account.signTransaction(tx);
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      return { txHash: receipt.transactionHash, blockNumber: receipt.blockNumber };
    } catch (error) {
      this.log(chalk.red.bold(`Perform Transfer Failed: ${error.message}`));
      return { txHash: null, blockNumber: null };
    }
  }

  async printTimer() {
    let seconds = Math.floor(Math.random() * (this.maxDelay - this.minDelay + 1)) + this.minDelay;
    while (seconds > 0) {
      process.stdout.write(chalk.blue(`Wait For ${seconds} Seconds For Next Tx...`) + '\r');
      await delay(1000);
      seconds--;
    }
    console.log();
  }

  async printQuestion() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (query) => new Promise(resolve => rl.question(query, resolve));
    let input;

    while (true) {
      input = await question(chalk.yellow.bold('Tx Count For Each Wallet -> '));
      const txCount = parseInt(input.trim());
      if (txCount > 0) {
        this.txCount = txCount;
        break;
      } else {
        console.log(chalk.red.bold('Tx Count must be > 0.'));
      }
    }

    let minAmount;
    while (true) {
      input = await question(chalk.yellow.bold('Enter Min Tx Amount ( ETH Sepolia ) -> '));
      minAmount = parseFloat(input.trim());
      if (minAmount > 0) {
        this.minAmount = minAmount;
        break;
      } else {
        console.log(chalk.red.bold('Amount must be > 0.'));
      }
    }

    while (true) {
      input = await question(chalk.yellow.bold('Enter Max Tx Amount ( ETH Sepolia ) -> '));
      const maxAmount = parseFloat(input.trim());
      if (maxAmount >= this.minAmount) {
        this.maxAmount = maxAmount;
        break;
      } else {
        console.log(chalk.red.bold('Amount must be >= min tx amount.'));
      }
    }

    while (true) {
      input = await question(chalk.yellow.bold('Min Delay For Each Tx (seconds) -> '));
      const minDelay = parseInt(input.trim());
      if (minDelay >= 0) {
        this.minDelay = minDelay;
        break;
      } else {
        console.log(chalk.red.bold('Min Delay must be >= 0.'));
      }
    }

    while (true) {
      input = await question(chalk.yellow.bold('Max Delay For Each Tx (seconds) -> '));
      const maxDelay = parseInt(input.trim());
      if (maxDelay >= this.minDelay) {
        this.maxDelay = maxDelay;
        break;
      } else {
        console.log(chalk.red.bold('Max Delay must be >= Min Delay.'));
      }
    }

    let choose;
    while (true) {
      console.log(chalk.white.bold('1. Run With Free Proxyscrape Proxy'));
      console.log(chalk.white.bold('2. Run With Private Proxy'));
      console.log(chalk.white.bold('3. Run Without Proxy'));
      input = await question(chalk.blue.bold('Choose [1/2/3] -> '));
      choose = parseInt(input.trim());
      if ([1, 2, 3].includes(choose)) {
        const proxyType = choose === 1 ? "With Free Proxyscrape" : (choose === 2 ? "With Private" : "Without");
        console.log(chalk.green.bold(`Run ${proxyType} Proxy Selected.`));
        break;
      } else {
        console.log(chalk.red.bold('Please enter either 1, 2 or 3.'));
      }
    }
    rl.close();
    return choose;
  }

  async processPerformTransfer(privateKey, address, receiver, txAmount, useProxy) {
    const result = await this.performTransfer(privateKey, address, receiver, txAmount, useProxy);
    if (result.txHash && result.blockNumber) {
      const explorer = `https://sepolia.etherscan.io/tx/${result.txHash}`;
      this.log(chalk.green.bold(`Success!`));
      this.log(chalk.white.bold(`Block   : ${result.blockNumber}`));
      this.log(chalk.white.bold(`Tx Hash : ${result.txHash}`));
      this.log(chalk.white.bold(`Explorer: ${explorer}`));
    } else {
      this.log(chalk.red.bold(`Perform On-Chain Failed`));
    }
  }

  async processAccounts(privateKey, address, useProxy) {
    for (let i = 0; i < this.txCount; i++) {
      this.log(chalk.magenta.bold(`Transfer ${i + 1} Of ${this.txCount}`));
      const balance = await this.getTokenBalance(address, useProxy);
      const txAmount = parseFloat((Math.random() * (this.maxAmount - this.minAmount) + this.minAmount).toFixed(7));
      const receiver = this.generateRandomReceiver();
      this.log(chalk.cyan.bold(`Balance : ${balance} ETH Sepolia`));
      this.log(chalk.cyan.bold(`Amount  : ${txAmount} ETH Sepolia`));
      this.log(chalk.cyan.bold(`Receiver: ${receiver}`));
      if (!balance || balance <= txAmount) {
        this.log(chalk.yellow.bold(`Insufficient ETH Sepolia Token Balance`));
        return;
      }
      await this.processPerformTransfer(privateKey, address, receiver, txAmount, useProxy);
      await this.printTimer();
    }
  }

  async main() {
    try {
      if (!fs.existsSync('accounts.txt')) {
        this.log(chalk.red.bold("File 'accounts.txt' Not Found."));
        return;
      }
      const accounts = fs.readFileSync('accounts.txt', 'utf8')
        .split(/\r?\n/)
        .filter(line => line.trim() !== '');

      const useProxyChoice = await this.printQuestion();
      const useProxy = [1, 2].includes(useProxyChoice);

      while (true) {
        this.clearTerminal();
        this.welcome();
        this.log(chalk.green.bold(`Account's Total: `) + chalk.white.bold(`${accounts.length}`));

        if (useProxy) await this.loadProxies(useProxyChoice);

        const separator = '='.repeat(25);
        for (const privateKey of accounts) {
          if (privateKey) {
            const address = this.generateAddress(privateKey);
            this.log(chalk.cyan.bold(`${separator}[ ${this.maskAccount(address)} ]${separator}`));
            if (!address) continue;
            await this.processAccounts(privateKey, address, useProxy);
            await delay(3000);
          }
        }
        this.log(chalk.cyan.bold("=".repeat(72)));
        let seconds = 24 * 60 * 60;
        while (seconds > 0) {
          const formattedTime = this.formatSeconds(seconds);
          process.stdout.write(chalk.blue.bold(`[ Wait for ${formattedTime}... ] | All Accounts Have Been Processed.`) + '\r');
          await delay(1000);
          seconds--;
        }
        console.log();
      }
    } catch (error) {
      this.log(chalk.red.bold(`Error: ${error.message}`));
      throw error;
    }
  }
}

module.exports = Turnkey;

if (require.main === module) {
  (async () => {
    try {
      const bot = new Turnkey();
      await bot.main();
    } catch (error) {
      console.error(chalk.red.bold(`Bot encountered an error: ${error.message}`));
    }
  })();
}
