# Setting Up a SOLNET Relay Node

A relay node helps mobile and NAT-restricted peers
join the mesh. The Railway deployment is the
primary relay node.

## Step 1: Get your stable Peer ID

Start the daemon once to generate a keypair:
`cd sns-daemon && cargo run --release`

Look for this line in logs:
`"Set Railway env: SOLNET_NODE_KEY=<base64_key>"`

Copy that base64 key. You will need it in Step 2.

## Step 2: Set Railway environment variables

`railway variables set SOLNET_IS_RELAY=true`
`railway variables set SOLNET_NODE_KEY=<base64_from_step1>`
`railway variables set RELAY_MAX_RESERVATIONS=128`
`railway variables set RELAY_MAX_CIRCUITS=64`
`railway variables set SOLNET_DCUTR=true`
`railway variables set P2P_PORT=9001`

## Step 3: Redeploy
`railway up`

## Step 4: Get your relay Multiaddr

After deploy check logs or call:
`curl https://solnet-production.up.railway.app/mesh/status`

Look for multiaddrs array. Your bootstrap multiaddr is:
`/dns4/solnet-production.up.railway.app/tcp/9001/p2p/<PEER_ID>`

## Step 5: Share bootstrap addr with other nodes

Other nodes set:
`export SOLNET_BOOTSTRAP="/dns4/solnet-production.up.railway.app/tcp/9001/p2p/<PEER_ID>"`
`cargo run --release`

They will now discover each other through your relay
and attempt DCUtR hole punching for direct connections.

## Verifying relay is working

`curl https://solnet-production.up.railway.app/mesh/status`

Check:
- is_relay: true
- relay_reservations: > 0 (when peers connect)
- connected_peers: > 0

## Topology diagram

```text
Mobile Node (iOS)
     |
     | Cannot reach internet directly (NAT)
     |
     v
Railway Relay Node ←──── Desktop Node (India)
     |                        |
     | Circuit Relay v2       | DCUtR hole punch
     |                        | (if AutoNAT succeeds)
     v                        v
Desktop Node ←──────────────────────────────
(direct connection after hole punch)
```
