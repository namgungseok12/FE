"use client";

import React, { useState, useEffect } from "react";
import { BrowserProvider, Contract, parseEther, formatEther } from "ethers";
import WordGuessingGameAbi from "./abis/WordGuessingGame.json";

const CONTRACT_ADDRESS = "0xdc3436926F104C2ED8577fef17a6C41be507Cfe5";

interface GameLog {
  player: string;
  guess: string;
  similarity: number;
  proximity: string;
}

const WordGuessingGame = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [userGuess, setUserGuess] = useState<string>("");
  const [gameLogs, setGameLogs] = useState<GameLog[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [prizePool, setPrizePool] = useState<string>("0");
  const [gameEnded, setGameEnded] = useState<boolean>(false);
  const [isOwner, setIsOwner] = useState<boolean>(false);



  const BACKEND_API_URL = "http://127.0.0.1:3000"; // 백엔드 API URL

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
        checkIfOwner(accounts[0]);
        setFeedback(`Connected to wallet: ${accounts[0]}`);
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      setFeedback("Failed to connect wallet.");
    }
  };

  // 지갑 연결 해제
  const disconnectWallet = () => {
    setWalletAddress(null);
    setFeedback("Wallet disconnected.");
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

  // 현재 연결된 계정이 Owner인지 확인
  const checkIfOwner = async (account: string) => {
    try {
      const contract = await getContract();
      const owner = await contract.owner();
      setIsOwner(owner.toLowerCase() === account.toLowerCase());
    } catch (error) {
      console.error("Failed to check owner:", error);
    }
  };

  // 상금 풀 및 게임 상태 가져오기
  const fetchGameState = async () => {
    try {
      const contract = await getContract();
      const [pool, ended] = await contract.getGameState();
      setPrizePool(formatEther(pool));
      setGameEnded(ended);
      console.log("Fetched game state:", { pool, ended });
    } catch (error) {
      console.error("Failed to fetch game state:", error);
    }
  };

  const fetchGameLogs = async () => {
    try {
      const response = await fetch(`${BACKEND_API_URL}/logs`);
      if (!response.ok) {
        throw new Error("Failed to fetch game logs from backend");
      }
      const logs = await response.json();
      setGameLogs(logs);
      localStorage.setItem("gameLogs", JSON.stringify(logs));
    } catch (error) {
      console.error("Error fetching game logs:", error);
    }
  };


  // 백엔드로 단어 및 지갑 주소 보내기
  const sendGuessToBackend = async () => {
    console.log("Sending data to backend:", {
      word: userGuess,
      walletAddress: walletAddress,
    }); 
    try {
      const response = await fetch(`${BACKEND_API_URL}/guess`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          word: userGuess,
          walletAddress: walletAddress,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send guess to backend.");
      }

      const result = await response.json();
      console.log("Backend Response:", result);

      // 로그 정보 업데이트
      const similarity = result.similarity || 0;
      const proximity = result.proximity || "far"; 

      const newLog = {
        player: walletAddress || "Unknown",
        guess: userGuess,
        similarity: result.similarity,
        proximity: result.proximity,
      };
      setGameLogs((prevLogs) => {
        const updatedLogs = [newLog, ...prevLogs];
        localStorage.setItem("gameLogs", JSON.stringify(updatedLogs));
        return updatedLogs;
      });
    } catch (error) {
      console.error("Error sending guess to backend:", error);
      setFeedback("Failed to send guess to backend.");
    }
  };

  // 단어 추측 제출
  const handleSubmitGuess = async () => {
    if (!userGuess) {
      setFeedback("Please enter a word.");
      return;
    }
    const alreadyGuessed = gameLogs.some((log) => log.guess === userGuess);
    if (alreadyGuessed) {
      setFeedback(`You have already guessed the word "${userGuess}".`);
      return;
    }


    try {
      const contract = await getContract();
      console.log(`Submitting ${parseEther("0.001")} ETH for guess:`, userGuess);
      const tx = await contract.guessWord(userGuess, {
        value: parseEther("0.001"),
      });
      await tx.wait();

      setFeedback(`Your guess "${userGuess}" has been submitted.`);

      // 백엔드로 데이터 전송
      await sendGuessToBackend();

      // 게임 상태 갱신
      fetchGameState();
    } catch (error) {
      console.error("Failed to submit guess:", error);
      setFeedback("Failed to submit your guess.");
    }
  };

  useEffect(() => {
    const savedLogs = localStorage.getItem("gameLogs");
    if (savedLogs) {
      setGameLogs(JSON.parse(savedLogs));
    }
    fetchGameState();
    fetchGameLogs();
  }, [walletAddress]);

  return (
    <div
      style={{
        backgroundColor: "#0C0C0C", 
        minHeight: "100vh",
        padding: "20px",
        fontFamily: "'Cinzel', serif", 
        color: "#FFD700",
      }}
    >
      {/* 헤더 */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          borderBottom: "2px solid #FFD700", 
          paddingBottom: "10px",
        }}
      >
        <h1 style={{ fontSize: "36px", margin: 0, textShadow: "0 0 10px #FFD700" }}>
          Word Guessing Game
        </h1>
        <div>
          {!walletAddress ? (
            <button
              onClick={connectWallet}
              style={{
                padding: "10px 20px",
                background: "linear-gradient(90deg, #FFD700, #FF4500)", 
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "18px", 
                boxShadow: "0 0 10px #FF4500",
              }}
            >
              Connect Wallet
            </button>
          ) : (
            <button
              onClick={disconnectWallet}
              style={{
                padding: "10px 20px",
                background: "linear-gradient(90deg, #FF4500, #FF6347)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "18px", 
                boxShadow: "0 0 10px #FF4500",
              }}
            >
              Disconnect Wallet
            </button>
          )}
        </div>
      </header>
  
      {/* 상금 풀 */}
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <h2
          style={{
            fontSize: "40px",
            color: "#FFD700",
            textShadow: "0 0 15px #FFD700",
          }}
        >
          Prize Pool: {prizePool} ETH
        </h2>
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
            border: "2px solid #FFD700", 
            borderRadius: "10px",
            backgroundColor: "#1A1A2E",
            color: "#FFD700",
            marginBottom: "10px",
            outline: "none", 
          }}
          onFocus={(e) => (e.target.style.border = "2px solid #FFD700")} // 포커스 시 테두리 흰색으로 변경 -> 취소(구림)
          onBlur={(e) => (e.target.style.border = "2px solid #FFD700")} // 포커스 해제 시 금색으로 복구
        />
        <br />
        <button
          onClick={handleSubmitGuess}
          style={{
            padding: "10px 25px",
            background: "linear-gradient(90deg, #FFD700, #FF4500)",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "18px", 
            boxShadow: "0 0 10px #FFD700",
          }}
        >
          Submit Guess
        </button>
      </div>
  
      {/* 피드백 메시지 */}
      {feedback && (
        <p
          style={{
            textAlign: "center",
            marginTop: "10px",
            color: "#FF4500",
            fontWeight: "bold",
            textShadow: "0 0 5px #FF6347",
          }}
        >
          {feedback}
        </p>
      )}
  
      {/* 게임 로그 */}
      <div style={{ marginTop: "30px" }}>
        <h3 style={{ color: "#FFD700", textShadow: "0 0 10px #FFD700" }}>
          Game Logs
        </h3>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {gameLogs.map((log, idx) => (
            <li
              key={idx}
              style={{
                backgroundColor: "#1A1A2E",
                color: "#FFD700",
                marginBottom: "10px",
                padding: "15px",
                borderRadius: "10px",
                boxShadow: "0 0 10px #FFD700",
                border: "1px solid #FFD700",
              }}
            >
              <strong>Player:</strong> {log.player} | <strong>Guess:</strong>{" "}
              {log.guess} | <strong>Similarity:</strong> {log.similarity}% |{" "}
              <strong>Proximity:</strong> {log.proximity}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
  
};
export default WordGuessingGame;
