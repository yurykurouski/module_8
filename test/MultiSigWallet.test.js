const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiSigWallet", function () {
    let MultiSigWallet;
    let wallet;
    let owner1, owner2, owner3, nonOwner;
    let owners;
    const required = 2;

    beforeEach(async function () {
        [owner1, owner2, owner3, nonOwner] = await ethers.getSigners();
        owners = [owner1.address, owner2.address, owner3.address];

        MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
        wallet = await MultiSigWallet.deploy(owners, required);
        await wallet.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set the right owners", async function () {
            const contractOwners = await wallet.getOwners();
            expect(contractOwners).to.have.lengthOf(3);
            expect(contractOwners[0]).to.equal(owner1.address);
            expect(contractOwners[1]).to.equal(owner2.address);
            expect(contractOwners[2]).to.equal(owner3.address);
        });

        it("Should set the right number of required confirmations", async function () {
            expect(await wallet.numConfirmationsRequired()).to.equal(required);
        });

        it("Should fail if owners is empty", async function () {
            await expect(MultiSigWallet.deploy([], required)).to.be.revertedWith(
                "owners required"
            );
        });

        it("Should fail if required confirmations is invalid", async function () {
            await expect(
                MultiSigWallet.deploy(owners, owners.length + 1)
            ).to.be.revertedWith("invalid number of required confirmations");
            await expect(MultiSigWallet.deploy(owners, 0)).to.be.revertedWith(
                "invalid number of required confirmations"
            );
        });

        it("Should fail if owners are not unique or zero address", async function () {
            await expect(
                MultiSigWallet.deploy([owner1.address, owner1.address, owner3.address], required)
            ).to.be.revertedWith("owner not unique");
            await expect(
                MultiSigWallet.deploy([owner1.address, ethers.ZeroAddress], required)
            ).to.be.revertedWith("invalid owner");
        });
    });

    describe("Deposit", function () {
        it("Should accept funds", async function () {
            const amount = ethers.parseEther("1.0");
            await owner1.sendTransaction({
                to: await wallet.getAddress(),
                value: amount,
            });
            expect(await ethers.provider.getBalance(await wallet.getAddress())).to.equal(
                amount
            );
        });

        it("Should emit Deposit event", async function () {
            const amount = ethers.parseEther("1.0");
            await expect(owner1.sendTransaction({
                to: await wallet.getAddress(),
                value: amount,
            }))
                .to.emit(wallet, "Deposit")
                .withArgs(owner1.address, amount, amount);
        });
    });

    describe("Submit Transaction", function () {
        it("Should submit transaction", async function () {
            const to = owner3.address;
            const value = ethers.parseEther("1.0");
            const data = "0x";

            await wallet.submitTransaction(to, value, data);

            const count = await wallet.getTransactionCount();
            expect(count).to.equal(1);

            const tx = await wallet.getTransaction(0);
            expect(tx.to).to.equal(to);
            expect(tx.value).to.equal(value);
            expect(tx.data).to.equal(data);
            expect(tx.executed).to.equal(false);
            expect(tx.numConfirmations).to.equal(0);
        });

        it("Should exist SubmitTransaction event", async function () {
            const to = owner3.address;
            const value = ethers.parseEther("1.0");
            const data = "0x";

            await expect(wallet.submitTransaction(to, value, data))
                .to.emit(wallet, "SubmitTransaction")
                .withArgs(owner1.address, 0, to, value, data);
        });

        it("Should fail if not owner", async function () {
            await expect(
                wallet.connect(nonOwner).submitTransaction(owner3.address, 0, "0x")
            ).to.be.revertedWith("not owner");
        });
    });

    describe("Confirm Transaction", function () {
        beforeEach(async function () {
            await wallet.submitTransaction(owner3.address, ethers.parseEther("1.0"), "0x");
        });

        it("Should confirm transaction", async function () {
            await wallet.confirmTransaction(0);
            const tx = await wallet.getTransaction(0);
            expect(tx.numConfirmations).to.equal(1);
            expect(await wallet.isConfirmed(0, owner1.address)).to.be.true;
        });

        it("Should emit ConfirmTransaction event", async function () {
            await expect(wallet.confirmTransaction(0))
                .to.emit(wallet, "ConfirmTransaction")
                .withArgs(owner1.address, 0);
        });

        it("Should fail if not owner", async function () {
            await expect(
                wallet.connect(nonOwner).confirmTransaction(0)
            ).to.be.revertedWith("not owner");
        });

        it("Should fail if tx does not exist", async function () {
            await expect(wallet.confirmTransaction(1)).to.be.revertedWith("tx does not exist");
        });

        it("Should fail if already confirmed", async function () {
            await wallet.confirmTransaction(0);
            await expect(wallet.confirmTransaction(0)).to.be.revertedWith("tx already confirmed");
        });
    });

    describe("Execute Transaction", function () {
        const amount = ethers.parseEther("1.0");

        beforeEach(async function () {
            // Fund wallet
            await owner1.sendTransaction({
                to: await wallet.getAddress(),
                value: amount,
            });
            // Submit tx to send funds to nonOwner
            await wallet.submitTransaction(nonOwner.address, amount, "0x");
        });

        it("Should execute transaction", async function () {
            await wallet.confirmTransaction(0);
            await wallet.connect(owner2).confirmTransaction(0);

            const initialBalance = await ethers.provider.getBalance(nonOwner.address);

            await wallet.executeTransaction(0);

            const tx = await wallet.getTransaction(0);
            expect(tx.executed).to.be.true;

            const finalBalance = await ethers.provider.getBalance(nonOwner.address);
            expect(finalBalance - initialBalance).to.equal(amount);
        });

        it("Should emit ExecuteTransaction event", async function () {
            await wallet.confirmTransaction(0);
            await wallet.connect(owner2).confirmTransaction(0);

            await expect(wallet.executeTransaction(0))
                .to.emit(wallet, "ExecuteTransaction")
                .withArgs(owner1.address, 0);
        });

        it("Should fail if validation check fails (not enough confirmations)", async function () {
            await wallet.confirmTransaction(0);
            await expect(wallet.executeTransaction(0)).to.be.revertedWith("cannot execute tx");
        });

        it("Should fail if already executed", async function () {
            await wallet.confirmTransaction(0);
            await wallet.connect(owner2).confirmTransaction(0);
            await wallet.executeTransaction(0);
            await expect(wallet.executeTransaction(0)).to.be.revertedWith("tx already executed");
        });
    });

    describe("Revoke Confirmation", function () {
        beforeEach(async function () {
            await wallet.submitTransaction(owner3.address, ethers.parseEther("1.0"), "0x");
            await wallet.confirmTransaction(0);
        });

        it("Should revoke confirmation", async function () {
            await wallet.revokeConfirmation(0);
            const tx = await wallet.getTransaction(0);
            expect(tx.numConfirmations).to.equal(0);
            expect(await wallet.isConfirmed(0, owner1.address)).to.be.false;
        });

        it("Should emit RevokeConfirmation event", async function () {
            await expect(wallet.revokeConfirmation(0))
                .to.emit(wallet, "RevokeConfirmation")
                .withArgs(owner1.address, 0);
        });

        it("Should fail if not confirmed", async function () {
            await wallet.revokeConfirmation(0);
            await expect(wallet.revokeConfirmation(0)).to.be.revertedWith("tx not confirmed");
        });
    });
});
