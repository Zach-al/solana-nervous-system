# SOLNET Mobile User Guide (V1.2)

SOLNET is designed to run everywhere, from enterprise servers to the phone in your pocket. This guide covers how to install and run a SOLNET **Light Node** on iOS, Android, and Raspberry Pi.

## 🚀 One-Command Install

For most users on Linux-based mobile environments (PostmarketOS, Ubuntu Touch) or Raspberry Pi, use our universal installer:

```bash
curl -fsSL https://raw.githubusercontent.com/Zach-al/solana-nervous-system/main/install.sh | sh
```

---

## 📱 Platform Guides

### 🍎 iOS (via iSH or Libterm)
iOS nodes currently run via terminal emulation.
1.  Install **iSH Shell** from the App Store.
2.  Open iSH and run:
    ```bash
    apk add curl git rust cargo build-base openssl-dev
    curl -fsSL https://raw.githubusercontent.com/Zach-al/solana-nervous-system/main/install.sh | sh
    ```
3.  **Note:** iOS nodes automatically activate **Battery Guard** to prevent background drain.

### 🤖 Android (via Termux)
1.  Install [Termux](https://termux.dev).
2.  Update packages: `pkg update && pkg upgrade`.
3.  Install dependencies: `pkg install curl git rust binutils`.
4.  Run installer:
    ```bash
    curl -fsSL https://raw.githubusercontent.com/Zach-al/solana-nervous-system/main/install.sh | sh
    ```

### 🍓 Raspberry Pi
Raspberry Pi acts as a "Bridge Node"—more powerful than a phone but more efficient than a desktop.
1.  Run the Pi-optimized installer:
    ```bash
    curl -fsSL https://raw.githubusercontent.com/Zach-al/solana-nervous-system/main/scripts/install-pi.sh | sh
    ```
2.  Enable auto-start on boot:
    ```bash
    sudo cp scripts/solnet.service /etc/systemd/system/
    sudo systemctl enable solnet && sudo systemctl start solnet
    ```

---

## ⚡ How it Works: Light Mode

Mobile nodes operate in **Light Mode** to preserve battery and data:

1.  **Proxied Routing:** Instead of running a heavy P2P DHT, mobile nodes register with a "Bootstrap Node" via HTTP.
2.  **Delegated Discovery:** The network assigns you to the nearest healthy Desktop Node to route your traffic.
3.  **Battery Guard:** The daemon monitors your battery level.
    *   **< 40% Battery:** Requests are halved to save power.
    *   **< 20% Battery:** The node enters "Passive Mode" and stops processing new requests until charged.

## 💰 Earning Rewards

Even as a Light Node, you earn **$SOLNET** rewards for every request your device helps verify or route. 

*   **Tip:** Keep your device charging and on Wi-Fi to maximize your routing priority and earnings.
*   **Monitor:** View your mobile node's status live on the [SOLNET Dashboard](https://solnet-wheat.vercel.app).

---

## 🛠️ Troubleshooting

*   **Connection Dropped:** Ensure "Background App Refresh" is enabled for your terminal app.
*   **Low Earnings:** Mobile nodes have lower priority than Desktop nodes unless high-bandwidth Wi-Fi is detected.
*   **Build Errors:** Ensure you have at least 2GB of free storage for the Rust compilation process.
