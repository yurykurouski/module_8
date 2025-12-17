# Multi-Signature Wallet Project

This project implements a Multi-Signature Wallet smart contract with a React frontend.

## Demo Instructions

### 1. Start the Local Blockchain
Open a terminal and run the local chain command. This simulates the Ethereum network on your machine.
```bash
npm run chain
```
*Note: This command will print a list of 20 accounts with their private keys. **Keep this terminal open.***

### 2. Deploy the Contract
In a **new terminal window**, deploy your Multi-Sig contract to the local network.
```bash
npm run deploy
```
**Copy the deployed contract address** from the output. You will need it in the frontend.

### 3. Configure MetaMask
You need to connect MetaMask to your local blockchain and import the "owner" accounts.
1.  **Add Network**:
    *   **RPC URL**: `http://127.0.0.1:8545`
    *   **Chain ID**: `31337`
    *   **Currency Symbol**: `ETH`
2.  **Import Accounts**:
    *   Copy the **Private Key** of `Account 0` from the `npm run chain` terminal and import it into MetaMask. This is **Owner 1**.
    *   Do the same for `Account 1`. This is **Owner 2**.
    *   (Optional) Do the same for `Account 2`. This is **Owner 3**.

### 4. Run the Frontend
1.  Install frontend dependencies (first time only):
    ```bash
    npm run frontend:install
    ```
2.  Start the app:
    ```bash
    npm run frontend:start
    ```
3.  Open the URL shown (e.g., `http://localhost:5173`) in your browser.

### 5. Demo the Flow
1.  **Connect**: Click "Connect Wallet" (ensure you are on the local network in MetaMask).
2.  **Verify Address**: Paste the contract address from Step 2 into the "Contract Address" field if it's not auto-filled.
3.  **Deposit Funds**:
    *   The transaction requires the contract to have funds.
    *   Enter an amount (e.g. `2.0`) in the "Deposit Funds" section and click **Deposit**.
4.  **Propose Transaction (Owner 1)**:
    *   Enter a recipient address and an ETH amount (e.g., `1.0`).
    *   Click **Submit**. The transaction will appear in the list as "Pending".
5.  **Confirm Transaction (Owner 2)**:
    *   Switch to the **Owner 2** account in MetaMask (or use the "Switch Account" button).
    *   Click **Connect Wallet** again to refresh the account connection.
    *   Find the pending transaction and click **Confirm**.
6.  **Execute Transaction**:
    *   Once 2 confirmations are reached, click **Execute**.
    *   The transaction status should change to **Executed**.

## Design & Security Report

### Introduction
This project implements a Multi-Signature (Multi-Sig) Wallet smart contract in Solidity. A multi-sig wallet requires multiple owners to approve a transaction before it can be executed. This adds an extra layer of security compared to a standard single-owner wallet.

### Architecture
#### Owners and Confirmations
*   **Owners**: The contract is initialized with a set of unique owner addresses. Only these addresses can submit and confirm transactions.
*   **Required Confirmations**: A threshold (e.g., 2 out of 3) must be met for a transaction to be executed.

#### Data Structures
*   **Transaction Struct**: Stores destination (`to`), value (`value`), data (`data`), execution status (`executed`), and confirmation count (`numConfirmations`).
*   **Mappings**: `isOwner` for O(1) owner checks, and `isConfirmed` to track approvals per transaction per owner.

### Key Functions
1.  **`submitTransaction`**: Allows an owner to propose a new transaction.
2.  **`confirmTransaction`**: Allows an owner to approve a pending transaction.
3.  **`revokeConfirmation`**: Allows an owner to undo their approval before execution.
4.  **`executeTransaction`**: Executes a confirmed transaction if the confirmation threshold is met.

### Security Analysis
#### Access Control
All sensitive state-changing functions are restricted with the `onlyOwner` modifier, ensuring only authorized parties can interact with the wallet funds.

#### Reentrancy Protection
The `executeTransaction` function follows the Checks-Effects-Interactions pattern:
1.  **Checks**: Verifies confirmations and execution status.
2.  **Effects**: Marks the transaction as `executed` *before* the external call.
3.  **Interactions**: Performs the external `call`.
This prevents reentrancy attacks where a malicious contract calls back into `executeTransaction` before the state is updated.

#### Validation
*   Constructor ensures owners are unique and non-zero.
*   Required confirmations must be valid (greater than 0 and less than or equal to owner count).

### Testing
The contract is verified with a comprehensive Hardhat test suite ensuring 100% functional coverage of success scenarios and failure/revert cases.
