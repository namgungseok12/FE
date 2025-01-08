"use client";

import React, { useState, useEffect } from "react";
import { BrowserProvider, Contract, parseEther, formatEther } from "ethers";
import WordGuessingGameAbi from "./abis/WordGuessingGame.json";

const CONTRACT_ADDRESS = "0x6Ecf2D92C14372F83A742C35497c2C63d10C7d07";

interface GameLog {
  player: string;
  guess: string;
  similarity: number;
  rank: number;
}

const WordGuessingGame = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);
  const [userGuess, setUserGuess] = useState<string>("");
  const [gameLogs, setGameLogs] = useState<GameLog[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [prizePool, setPrizePool] = useState<string>("0");

  // 메타마스크 연결
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("MetaMask is not installed!");
        return;
      }
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
        setFeedback(`Connected to wallet: ${accounts[0]}`);
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      setFeedback("Failed to connect wallet.");
    }
  };

  // 메타마스크 연결 끊기
  const disconnectWallet = () => {
    setWalletAddress(null);
    setConnectedAccount(null);
    setFeedback("Disconnected from wallet.");
  };

  // 컨트랙트 인스턴스 가져오기
  const getContract = async (): Promise<Contract> => {
    if (!window.ethereum) {
      throw new Error("No crypto wallet found");
    }
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new Contract(CONTRACT_ADDRESS, WordGuessingGameAbi, signer);
  };

  // 상금 풀 가져오기
  const fetchPrizePool = async () => {
    try {
      const contract = await getContract(); 
      const pool = await contract.prizePool();
      setPrizePool(formatEther(pool));
    } catch (error) {
      console.error("Failed to fetch prize pool:", error);
    }
  };

  // 단어 추측 제출
  const handleSubmitGuess = async () => {
    if (!userGuess) {
      setFeedback("Please enter a word.");
      return;
    }

    try {
      const contract = await getContract();
      const tx = await contract.guessWord(userGuess, {
        value: parseEther("0.001"), // 0.001 ETH 전송
    });
      await tx.wait();

      // (임시) 유사도와 순위를 랜덤 생성
      const similarity = parseFloat((Math.random() * 100).toFixed(2));
      const rank = Math.floor(Math.random() * 1000);

      // 게임 로그 추가
      const newLog: GameLog = {
        player: walletAddress || "Unknown",
        guess: userGuess,
        similarity,
        rank,
      };
      setGameLogs((prev) => [newLog, ...prev]);

      // 입력 초기화
      setUserGuess("");
      setFeedback(`Your guess "${userGuess}" has been submitted.`);

      // 최신 상금 풀 가져오기
      fetchPrizePool();
    } catch (error) {
      console.error("Failed to submit guess:", error);
      setFeedback("Failed to submit your guess.");
    }
  };

  // 메타마스크 계정 변경 감지
  useEffect(() => {
    if (typeof window.ethereum !== "undefined") {
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setFeedback(`Switched to wallet: ${accounts[0]}`);
        } else {
          disconnectWallet();
        }
      });
    }
  }, []);

  useEffect(() => {
    if (walletAddress) {
      fetchPrizePool();
    }
  }, [walletAddress]);

  return (
    <div
      style={{
        backgroundColor: "#f9f9f9",
        minHeight: "100vh",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        color: "#333",
      }}
    >
      {/* 헤더 */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h1 style={{ color: "#0070f3", fontSize: "24px", margin: 0 }}>Word Guessing Game</h1>
        <div>
          {!walletAddress ? (
            <button
              onClick={connectWallet}
              style={{
                padding: "10px 15px",
                backgroundColor: "#0070f3",
                color: "#fff",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              Connect Wallet
            </button>
          ) : (
            <button
              onClick={disconnectWallet}
              style={{
                padding: "10px 15px",
                backgroundColor: "#dc3545",
                color: "#fff",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              Disconnect Wallet
            </button>
          )}
        </div>
      </header>

      {/* 상금 풀 */}
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <h2 style={{ color: "#28a745", fontSize: "32px" }}>Prize Pool: {prizePool} ETH</h2>
      </div>

      {/* 단어 추측 입력 */}
      <div style={{ textAlign: "center" }}>
        <input
          type="text"
          value={userGuess}
          onChange={(e) => setUserGuess(e.target.value)}
          placeholder="Enter your guess"
          style={{
            padding: "15px",
            fontSize: "16px",
            width: "50%",
            border: "2px solid #0070f3",
            borderRadius: "5px",
            marginBottom: "10px",
          }}
        />
        <br />
        <button
          onClick={handleSubmitGuess}
          style={{
            padding: "10px 20px",
            backgroundColor: "#0070f3",
            color: "#fff",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Submit Guess
        </button>
      </div>

      {/* 피드백 메시지 */}
      {feedback && <p style={{ textAlign: "center", marginTop: "10px", color: "#555" }}>{feedback}</p>}

      {/* 게임 로그 */}
      <div style={{ marginTop: "30px" }}>
        <h3 style={{ color: "#0070f3" }}>Game Logs</h3>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {gameLogs.map((log, idx) => (
            <li
              key={idx}
              style={{
                backgroundColor: "#fff",
                marginBottom: "10px",
                padding: "10px",
                borderRadius: "5px",
                boxShadow: "0 2px 5px rgba(0, 0, 0, 0.1)",
              }}
            >
              <strong>Player:</strong> {log.player} | <strong>Guess:</strong> {log.guess} |{" "}
              <strong>Similarity:</strong> {log.similarity}% | <strong>Rank:</strong> {log.rank}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default WordGuessingGame;
