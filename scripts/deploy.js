const hre = require("hardhat");

async function main() {
    const [owner1, owner2, owner3] = await hre.ethers.getSigners();

    if (!owner1 || !owner2 || !owner3) {
        console.error("Not enough signers available. Need at least 3.");
        process.exit(1);
    }

    const owners = [owner1.address, owner2.address, owner3.address];
    const required = 2;

    console.log("Deploying MultiSigWallet with owners:", owners);
    console.log("Required confirmations:", required);

    const MultiSigWallet = await hre.ethers.getContractFactory("MultiSigWallet");
    const multiSigWallet = await MultiSigWallet.deploy(owners, required);

    await multiSigWallet.waitForDeployment();

    console.log("MultiSigWallet deployed to:", await multiSigWallet.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
