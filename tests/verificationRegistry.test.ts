import { describe, it, beforeEach, expect } from "vitest";

// ---- Types ----
interface Credential {
	revoked: boolean;
}

interface VerificationRequest {
	credentialId: bigint;
	verifier: string;
	requestTime: bigint;
	isVerified: boolean;
	verificationTime: bigint;
}

interface NFTContract {
	credentials: Map<bigint, Credential>;
	verificationRequests: Map<bigint, VerificationRequest>;
	requestCounter: bigint;
}

interface MockContract {
	nftContract: NFTContract;
	requestVerification: (
		verifier: string,
		credentialId: bigint
	) => { value: bigint };
	getVerificationRequest: (id: bigint) => { value?: VerificationRequest };
	batchRequestVerifications: (
		verifier: string,
		credentialIds: bigint[]
	) => { value: Array<{ value?: boolean; error?: number }> };
}

// ---- Mock Data ----
const NFT_CONTRACT: NFTContract = {
	credentials: new Map(),
	verificationRequests: new Map(),
	requestCounter: 0n,
};

const VERIFIER = "0xVerifierAddress";

// ---- Mock Contract Implementation ----
const mockContract: MockContract = {
	nftContract: NFT_CONTRACT,

	requestVerification: (verifier, credentialId) => {
		const id = ++mockContract.nftContract.requestCounter;
		mockContract.nftContract.verificationRequests.set(id, {
			credentialId,
			verifier,
			requestTime: 100n,
			isVerified: true,
			verificationTime: 100n,
		});
		return { value: id };
	},

	getVerificationRequest: (id) => {
		const request = mockContract.nftContract.verificationRequests.get(id);
		return { value: request };
	},

	batchRequestVerifications: (verifier, credentialIds) => {
		return {
			value: credentialIds.map((id) => {
				const cred = mockContract.nftContract.credentials.get(id);
				if (!cred || cred.revoked) return { error: 302 };
				return { value: true };
			}),
		};
	},
};

// ---- Test Helpers ----
function resetMockState() {
	NFT_CONTRACT.credentials.clear();
	NFT_CONTRACT.verificationRequests.clear();
	NFT_CONTRACT.requestCounter = 0n;

	// Ensure valid credentials for tests
	NFT_CONTRACT.credentials.set(1n, { revoked: false });
	NFT_CONTRACT.credentials.set(2n, { revoked: false });
}

// ---- Tests ----
describe("MockContract", () => {
	beforeEach(() => {
		mockContract.nftContract = NFT_CONTRACT;
		resetMockState();
	});

	it("should batch request verifications successfully", () => {
		const result = mockContract.batchRequestVerifications(VERIFIER, [1n, 2n]);
		expect(result).toEqual({
			value: [{ value: true }, { value: true }],
		});
	});

	it("should get a verification request", () => {
		const { value: requestId } = mockContract.requestVerification(VERIFIER, 1n);
		const result = mockContract.getVerificationRequest(requestId);

		expect(result).toEqual({
			value: {
				credentialId: 1n,
				verifier: VERIFIER,
				requestTime: 100n,
				isVerified: true,
				verificationTime: 100n,
			},
		});
	});
});
