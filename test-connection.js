const { SolnetConnection } = require('./sdk/dist/index.js');

async function runTest() {
    const phoneRPC = "http://10.21.92.145:9000"; // Your phone's RPC port from the screenshot

    console.log("🛠️ Testing SOLNET RPC Bridge...");
    
    try {
        const client = new SolnetConnection(phoneRPC, 'confirmed');

        // This asks your phone node for its health/version
        console.log(`📡 Requesting Node Version from ${phoneRPC}...`);
        const version = await client.getGenesisHash(); 
        
        console.log("🚀 SUCCESS! Mac is communicating with the Phone Node.");
        console.log("🔗 Genesis Hash:", version);
        
    } catch (err) {
        console.error("❌ RPC Bridge Failed.");
        console.error("Check if your phone is still showing 'RPC proxy listening on http://0.0.0.0:9000'");
    }
}

runTest();