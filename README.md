# Turnkeyyy Bot Otomatis 

## 📝 Features

* Auto Fetch Wallet Info

* **Supports 3 Proxy Modes:**

| Proxy Mode              | Supported |
|-------------------------|-----------|
| Proxyscrape Free Proxy  | ✅        |
| Private Proxy           | ✅        |
| SOCKS5 Proxy            | ✅        |


- Auto Transfer to Random Wallet
- Multi-Account Support
- Easy Configuration
- Suport VPS & Termux

🖥️ Installation `Repo`
````
git clone https://github.com/ZonaAirdrop/Turnkeyyy.git
cd Turnkeyyy
````
🔖 Install dependencies
````
pip install -r requirements.txt
````
📝 Configuration

* `accounts.txt` — Add one private key per line:

  ```text
  your_private_key_1
  your_private_key_2
  ```
* `proxy.txt` — Add proxies like this: (Optional proky)

  ```text
  ip:port
  http://ip:port
  http://user:pass@ip:port
  ```
🤖 Runing Bot 
````
python3 bot.py
````
