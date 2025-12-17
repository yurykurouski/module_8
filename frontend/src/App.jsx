import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import MultiSigWalletABI from './MultiSigWallet.json';

const DEFAULT_CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

function App() {
  const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT_ADDRESS);
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [owners, setOwners] = useState([]);
  const [required, setRequired] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [txCount, setTxCount] = useState(0);
  const [balance, setBalance] = useState("0");
  const [depositAmount, setDepositAmount] = useState("");

  const [to, setTo] = useState("");
  const [value, setValue] = useState("0");
  const [data, setData] = useState("0x");

  /* New useEffect to listen for account changes */
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          // Re-connect to contract with new signer
          connectWithSigner(accounts[0]);
        } else {
          disconnectWallet();
        }
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const connectWithSigner = async (acc) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      // optionally verify signer address matches acc
      const multiSig = new ethers.Contract(contractAddress, MultiSigWalletABI.abi, signer);
      setContract(multiSig);
      loadContractData(multiSig);
    } catch (error) {
      console.error("Re-connection failed", error);
    }
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setAccount(address);

        const multiSig = new ethers.Contract(contractAddress, MultiSigWalletABI.abi, signer);
        setContract(multiSig);

        loadContractData(multiSig);
      } catch (error) {
        console.error("Connection failed", error);
        alert("Failed to connect wallet: " + error.message);
      }
    } else {
      alert("Please install Metamask!");
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setContract(null);
    setOwners([]);
    setTransactions([]);
  };

  const switchAccount = async () => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }]
        });
        // accountsChanged event will handle the rest
      } catch (error) {
        console.error(error);
      }
    }
  };

  const loadContractData = async (multiSig) => {
    try {
      const _owners = await multiSig.getOwners();
      setOwners(_owners);
      const _required = await multiSig.numConfirmationsRequired();
      setRequired(Number(_required));
      const _count = await multiSig.getTransactionCount();
      setTxCount(Number(_count));

      const _txs = [];
      for (let i = 0; i < Number(_count); i++) {
        const tx = await multiSig.getTransaction(i);
        _txs.push({
          index: i,
          to: tx.to,
          value: tx.value.toString(),
          data: tx.data,
          executed: tx.executed,
          numConfirmations: Number(tx.numConfirmations)
        });
      }
      setTransactions(_txs);

      // Get balance
      const bal = await multiSig.runner.provider.getBalance(multiSig.target);
      setBalance(ethers.formatEther(bal));

    } catch (error) {
      console.error("Error loading data", error);
      alert("Error loading contract data (check console)");
    }
  };

  const deposit = async () => {
    if (!contract || !depositAmount) return;
    try {
      const tx = await contract.runner.sendTransaction({
        to: contract.target,
        value: ethers.parseEther(depositAmount)
      });
      await tx.wait();
      loadContractData(contract);
      setDepositAmount("");
      alert("Deposit successful!");
    } catch (err) {
      console.error(err);
      alert("Deposit failed: " + err.reason || err.message);
    }
  };

  const submitTx = async () => {
    if (!contract) return;
    try {
      const tx = await contract.submitTransaction(to, ethers.parseEther(value), data);
      await tx.wait();
      loadContractData(contract);
      setTo("");
      setValue("0");
      setData("0x");
    } catch (err) {
      console.error(err);
      alert("Transaction failed: " + err.reason || err.message);
    }
  };

  const confirmTx = async (index) => {
    if (!contract) return;
    try {
      const tx = await contract.confirmTransaction(index);
      await tx.wait();
      loadContractData(contract);
    } catch (err) {
      console.error(err);
      alert("Confirm failed: " + err.reason || err.message);
    }
  };

  const revokeTx = async (index) => {
    if (!contract) return;
    try {
      const tx = await contract.revokeConfirmation(index);
      await tx.wait();
      loadContractData(contract);
    } catch (err) {
      console.error(err);
      alert("Revoke failed: " + err.reason || err.message);
    }
  };

  const executeTx = async (index) => {
    if (!contract) return;
    try {
      const tx = await contract.executeTransaction(index);
      await tx.wait();
      loadContractData(contract);
    } catch (err) {
      console.error(err);
      alert("Execute failed: " + err.reason || err.message);
    }
  };

  return (
    <div className="container">
      <h1>Multi-Signature Wallet</h1>

      <div className="card">
        <h2>Connection</h2>
        <div className="form-group">
          <label>Contract Address</label>
          <input
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            placeholder="0x..."
            className="input-field"
          />
        </div>
        {!account ? (
          <button onClick={connectWallet} className="primary-btn">Connect Wallet</button>
        ) : (
          <div className="connected-container">
            <p>Connected: <strong>{account}</strong></p>
            <div className="btn-group">
              <button onClick={switchAccount} className="secondary-btn">Switch Account</button>
              <button onClick={disconnectWallet} className="danger-btn">Disconnect</button>
            </div>
          </div>
        )}
      </div>

      {contract && (
        <>
          <div className="card">
            <h2>Wallet Info</h2>
            <div className="info-row">
              <span>Balance:</span> <strong>{balance} ETH</strong>
            </div>
            <div className="info-row">
              <span>Required Confirmations:</span> <strong>{required}</strong>
            </div>
            <div className="info-row">
              <span>Owners:</span>
              <ul className="owner-list">
                {owners.map(o => <li key={o}>{o}</li>)}
              </ul>
            </div>
          </div>

          <div className="card">
            <h2>Deposit Funds</h2>
            <div className="form-group">
              <input
                className="input-field"
                type="number"
                placeholder="Amount (ETH)"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
              <button onClick={deposit} className="action-btn">Deposit</button>
            </div>
          </div>

          <div className="card">
            <h2>Submit Transaction</h2>
            <div className="form-group">
              <input className="input-field" placeholder="To Address" value={to} onChange={(e) => setTo(e.target.value)} />
              <input className="input-field" type="number" placeholder="Value (ETH)" value={value} onChange={(e) => setValue(e.target.value)} />
              <input className="input-field" placeholder="Data (0x...)" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <button onClick={submitTx} className="action-btn">Submit</button>
          </div>

          <div className="card">
            <h2>Transactions</h2>
            {transactions.length === 0 ? <p>No transactions found</p> : (
              <div className="tx-list">
                {transactions.map(tx => (
                  <div key={tx.index} className={`transaction-item ${tx.executed ? 'executed' : ''}`}>
                    <div className="tx-header">
                      <span className="tx-index">#{tx.index}</span>
                      <span className={`status ${tx.executed ? 'success' : 'pending'}`}>
                        {tx.executed ? "Executed" : "Pending"}
                      </span>
                    </div>
                    <div className="tx-details">
                      <p><strong>To:</strong> {tx.to}</p>
                      <p><strong>Value:</strong> {ethers.formatEther(tx.value)} ETH</p>
                      <p><strong>Data:</strong> {tx.data}</p>
                      <p><strong>Confirmations:</strong> {tx.numConfirmations} / {required}</p>
                    </div>

                    {!tx.executed && (
                      <div className="actions">
                        <button onClick={() => confirmTx(tx.index)} className="confirm-btn">Confirm</button>
                        <button onClick={() => revokeTx(tx.index)} className="revoke-btn">Revoke</button>
                        <button onClick={() => executeTx(tx.index)} className="execute-btn">Execute</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
