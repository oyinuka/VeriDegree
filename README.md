# VeriDegree

A blockchain-powered platform for issuing, managing, and verifying tamper-proof digital credentials (e.g., diplomas, certificates, professional licenses) on the Clarity blockchain, empowering individuals with control over their credentials and enabling instant, fraud-resistant verification.

---

## Overview

VeriDegree leverages the Clarity smart contract language on the Stacks blockchain to create a decentralized, transparent, and secure ecosystem for digital credentials. The platform consists of four main smart contracts that work together to issue, share, verify, and incentivize participation in the credentialing process:

1. **CredentialNFT Contract** – Issues and manages digital credentials as non-fungible tokens (NFTs).
2. **CredentialAccessControl Contract** – Manages user-controlled access permissions for sharing credentials with verifiers.
3. **IncentiveToken Contract** – Issues and distributes tokens to reward issuers and verifiers.
4. **VerificationRegistry Contract** – Tracks and logs verification requests and outcomes.

---

## Features

- **Tamper-Proof Credentials**: Digital credentials issued as NFTs, ensuring immutability and authenticity.
- **User-Controlled Sharing**: Individuals grant or revoke access to their credentials for specific verifiers.
- **Instant Verification**: Employers or institutions can verify credentials directly on-chain.
- **Incentivized Ecosystem**: Issuers and verifiers earn tokens for participating in the ecosystem.
- **Transparent Audit Trail**: All credential-related actions (issuance, sharing, verification, revocation) are logged on-chain.
- **Privacy-First Design**: Users maintain control over their data with selective disclosure.

---

## Smart Contracts

### CredentialNFT Contract
- Mints digital credentials as NFTs with metadata (e.g., credential type, issuer, recipient, issuance date).
- Supports credential revocation by issuers.
- Provides public verification functions to check credential validity.

### CredentialAccessControl Contract
- Allows credential owners to grant or revoke access to specific verifiers.
- Maintains an access list for each credential, ensuring privacy and control.
- Emits events for access changes to ensure transparency.

### IncentiveToken Contract
- Issues fungible tokens (VeriDegree Tokens, VDT) to reward issuers and verifiers.
- Supports token minting for rewarding participation (e.g., issuing a credential or completing a verification).
- Includes token transfer and balance management functions.

### VerificationRegistry Contract
- Logs verification requests with details (credential ID, verifier, timestamp).
- Tracks verification outcomes for auditability.
- Emits events for verification requests and completions.


<!-- 
CredentialNFT Contract
CredentialAccessControl Contract
VerificationRegistry Contract
 -->