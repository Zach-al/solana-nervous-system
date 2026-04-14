# SOLNET System Requirements

SOLNET is optimized for a wide range of hardware, but performance and earnings depend on your system's resources.

## 🖥️ Desktop / Server (Full Node)
Recommended for maximum earnings and network stability.

| Resource | Minimum | Recommended |
| :--- | :--- | :--- |
| **CPU** | 2 Cores (x86_64 / ARM64) | 4+ Cores (High Clock Speed) |
| **RAM** | 4 GB | 8 GB+ |
| **Storage** | 20 GB SSD | 50 GB NVMe |
| **Network** | 50 Mbps Symmetric | 1 Gbps Symmetric |
| **OS** | Ubuntu 22.04+, macOS 13+, Windows 11 (WSL2) | Ubuntu 24.04 LTS |

### Software Dependencies
*   **Rust Compiler:** 1.75.0 or newer.
*   **OpenSSL Development Headers:** Required for secure P2P communication.
*   **Build Tools:** `build-essential` (Linux) or Xcode Command Line Tools (macOS).

---

## 📱 Mobile (Light Node)
Optimized for battery and data efficiency.

| Resource | Minimum | Recommended |
| :--- | :--- | :--- |
| **CPU** | Quad-Core ARM64 | Octa-Core ARM64 |
| **RAM** | 2 GB | 4 GB+ |
| **Storage** | 5 GB | 10 GB |
| **Network** | 4G / LTE | Wi-Fi 6 |
| **OS** | Android 10+ (Termux), iOS 15+ (iSH) | Android 13+ |

### Software Dependencies
*   **Environment:** Termux (Android) or iSH/Libterm (iOS).
*   **Packages:** `curl`, `git`, `rust`, `cargo`.

---

## 🍓 Raspberry Pi (Bridge Node)
The perfect 24/7 low-power node.

| Resource | Minimum | Recommended |
| :--- | :--- | :--- |
| **Hardware** | Raspberry Pi 4 (2GB) | Raspberry Pi 5 (4GB+) |
| **Storage** | 16 GB MicroSD (Class 10) | 32 GB USB 3.0 SSD |
| **OS** | Raspberry Pi OS (64-bit) | Ubuntu Server 24.04 (64-bit) |

---

## 🌐 Network Requirements

To participate effectively in the mesh, ensure the following:

1.  **Ports:** Allow incoming/outgoing traffic on `TCP 9001` (P2P Mesh) and `TCP 9000` (RPC Proxy).
2.  **Latency:** Nodes with < 20ms latency to the nearest Solana validator are prioritized for requests.
3.  **Stability:** High "Uptime Score" increases your node's reputation and reward multiplier.
