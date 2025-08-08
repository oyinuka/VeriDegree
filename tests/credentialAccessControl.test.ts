import { describe, it, expect, beforeEach } from "vitest";

interface AccessList {
	allowed: boolean;
}

interface AccessHistory {
	grantedAt: bigint;
	revokedAt: bigint | null;
}

interface MockNFTContract {
	owners: Map<bigint, string>;
	getCredentialOwner(
		credentialId: bigint
	): { value: string | undefined } | { error: number };
}

interface MockContract {
	admin: string;
	paused: boolean;
	nftContract: MockNFTContract;
	MAX_BATCH_SIZE: bigint;
	accessList: Map<string, AccessList>;
	accessHistory: Map<string, AccessHistory>;

	isAdmin(caller: string): boolean;
	setPaused(
		caller: string,
		pause: boolean
	): { value: boolean } | { error: number };
	setNftContract(
		caller: string,
		contract: MockNFTContract
	): { value: boolean } | { error: number };
	grantAccess(
		caller: string,
		credentialId: bigint,
		verifier: string
	): { value: boolean } | { error: number };
	revokeAccess(
		caller: string,
		credentialId: bigint,
		verifier: string
	): { value: boolean } | { error: number };
	batchGrantAccess(
		caller: string,
		credentialId: bigint,
		verifiers: string[]
	): { value: boolean } | { error: number };
	batchRevokeAccess(
		caller: string,
		credentialId: bigint,
		verifiers: string[]
	): { value: boolean } | { error: number };
	hasAccess(
		credentialId: bigint,
		verifier: string
	): { value: boolean } | { error: number };
	getAccessHistory(
		credentialId: bigint,
		verifier: string
	): { value: AccessHistory | undefined };
}

const mockNFTContract: MockNFTContract = {
	owners: new Map(),
	getCredentialOwner(credentialId: bigint) {
		if (!this.owners.has(credentialId)) return { error: 201 };
		return { value: this.owners.get(credentialId) };
	},
};

const mockContract: MockContract = {
	admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
	paused: false,
	nftContract: mockNFTContract,
	MAX_BATCH_SIZE: 10n,
	accessList: new Map(),
	accessHistory: new Map(),

	isAdmin(caller: string) {
		return caller === this.admin;
	},

	setPaused(caller: string, pause: boolean) {
		if (!this.isAdmin(caller)) return { error: 200 };
		this.paused = pause;
		return { value: pause };
	},

	setNftContract(caller: string, contract: MockNFTContract) {
		if (!this.isAdmin(caller)) return { error: 200 };
		if (contract === mockNFTContract && contract.owners.size === 0)
			return { error: 205 };
		this.nftContract = contract;
		return { value: true };
	},

	grantAccess(caller: string, credentialId: bigint, verifier: string) {
		if (this.paused) return { error: 203 };
		const ownerResult = this.nftContract.getCredentialOwner(credentialId);
		if ("error" in ownerResult) return ownerResult;
		if (ownerResult.value !== caller) return { error: 200 };
		if (verifier === "SP000000000000000000002Q6VF78") return { error: 202 };
		const key = `${credentialId}-${verifier}`;
		this.accessList.set(key, { allowed: true });
		this.accessHistory.set(key, { grantedAt: BigInt(100), revokedAt: null });
		return { value: true };
	},

	revokeAccess(caller: string, credentialId: bigint, verifier: string) {
		if (this.paused) return { error: 203 };
		const ownerResult = this.nftContract.getCredentialOwner(credentialId);
		if ("error" in ownerResult) return ownerResult;
		if (ownerResult.value !== caller) return { error: 200 };
		const key = `${credentialId}-${verifier}`;
		if (!this.accessHistory.has(key)) return { error: 200 };
		this.accessList.set(key, { allowed: false });
		this.accessHistory.set(key, {
			grantedAt: BigInt(100),
			revokedAt: BigInt(101),
		});
		return { value: true };
	},

	batchGrantAccess(caller: string, credentialId: bigint, verifiers: string[]) {
		if (this.paused) return { error: 203 };
		const ownerResult = this.nftContract.getCredentialOwner(credentialId);
		if ("error" in ownerResult) return ownerResult;
		if (ownerResult.value !== caller) return { error: 200 };
		if (BigInt(verifiers.length) > this.MAX_BATCH_SIZE) return { error: 204 };
		for (const verifier of verifiers) {
			if (verifier === "SP000000000000000000002Q6VF78") return { error: 202 };
			const key = `${credentialId}-${verifier}`;
			this.accessList.set(key, { allowed: true });
			this.accessHistory.set(key, { grantedAt: BigInt(100), revokedAt: null });
		}
		return { value: true };
	},

	batchRevokeAccess(caller: string, credentialId: bigint, verifiers: string[]) {
		if (this.paused) return { error: 203 };
		const ownerResult = this.nftContract.getCredentialOwner(credentialId);
		if ("error" in ownerResult) return ownerResult;
		if (ownerResult.value !== caller) return { error: 200 };
		if (BigInt(verifiers.length) > this.MAX_BATCH_SIZE) return { error: 204 };
		for (const verifier of verifiers) {
			const key = `${credentialId}-${verifier}`;
			if (!this.accessHistory.has(key)) return { error: 200 };
			this.accessList.set(key, { allowed: false });
			this.accessHistory.set(key, {
				grantedAt: BigInt(100),
				revokedAt: BigInt(101),
			});
		}
		return { value: true };
	},

	hasAccess(credentialId: bigint, verifier: string) {
		const ownerResult = this.nftContract.getCredentialOwner(credentialId);
		if ("error" in ownerResult) return ownerResult;
		const key = `${credentialId}-${verifier}`;
		return { value: this.accessList.get(key)?.allowed || false };
	},

	getAccessHistory(credentialId: bigint, verifier: string) {
		const key = `${credentialId}-${verifier}`;
		return { value: this.accessHistory.get(key) };
	},
};

describe("VeriDegree CredentialAccessControl Contract", () => {
	const ADMIN = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
	const OWNER = "ST2CY5V39N7V71J3X4H8E3T63Z84Y5P3W6Z8G3";
	const VERIFIER = "ST3NBRSFKX28F3V56Z1XJ3X4H8E3T63Z84Y5P3W6Z8G3";
	const VERIFIER2 = "ST4J8K9M2N3V5P7Q6R8S9T0U1V2W3X4Y5Z6A7B8C9";
	const ZERO_ADDRESS = "SP000000000000000000002Q6VF78";
	const NFT_CONTRACT = {
		owners: new Map<bigint, string>([[1n, OWNER]]),
		getCredentialOwner(credentialId: bigint) {
			if (!this.owners.has(credentialId)) return { error: 201 };
			return { value: this.owners.get(credentialId) };
		},
	};

	beforeEach(() => {
		mockContract.admin = ADMIN;
		mockContract.paused = false;
		mockContract.nftContract = NFT_CONTRACT;
		mockContract.accessList = new Map();
		mockContract.accessHistory = new Map();
	});

	it("should set NFT contract when called by admin", () => {
		const result = mockContract.setNftContract(ADMIN, NFT_CONTRACT);
		expect(result).toEqual({ value: true });
		expect(mockContract.nftContract).toBe(NFT_CONTRACT);
	});

	it("should prevent non-admin from setting NFT contract", () => {
		const result = mockContract.setNftContract(OWNER, NFT_CONTRACT);
		expect(result).toEqual({ error: 200 });
	});

	it("should prevent setting NFT contract to invalid contract", () => {
		const result = mockContract.setNftContract(ADMIN, mockNFTContract);
		expect(result).toEqual({ error: 205 });
	});

	it("should grant access to a verifier", () => {
		const result = mockContract.grantAccess(OWNER, 1n, VERIFIER);
		expect(result).toEqual({ value: true });
		expect(mockContract.accessList.get(`1-${VERIFIER}`)).toEqual({
			allowed: true,
		});
		expect(mockContract.accessHistory.get(`1-${VERIFIER}`)).toEqual({
			grantedAt: 100n,
			revokedAt: null,
		});
	});

	it("should prevent non-owner from granting access", () => {
		const result = mockContract.grantAccess(VERIFIER, 1n, VERIFIER2);
		expect(result).toEqual({ error: 200 });
	});

	it("should prevent granting access to zero address", () => {
		const result = mockContract.grantAccess(OWNER, 1n, ZERO_ADDRESS);
		expect(result).toEqual({ error: 202 });
	});

	it("should prevent granting access for non-existent credential", () => {
		const result = mockContract.grantAccess(OWNER, 2n, VERIFIER);
		expect(result).toEqual({ error: 201 });
	});

	it("should revoke access from a verifier", () => {
		mockContract.grantAccess(OWNER, 1n, VERIFIER);
		const result = mockContract.revokeAccess(OWNER, 1n, VERIFIER);
		expect(result).toEqual({ value: true });
		expect(mockContract.accessList.get(`1-${VERIFIER}`)).toEqual({
			allowed: false,
		});
		expect(mockContract.accessHistory.get(`1-${VERIFIER}`)).toEqual({
			grantedAt: 100n,
			revokedAt: 101n,
		});
	});

	it("should prevent non-owner from revoking access", () => {
		mockContract.grantAccess(OWNER, 1n, VERIFIER);
		const result = mockContract.revokeAccess(VERIFIER, 1n, VERIFIER);
		expect(result).toEqual({ error: 200 });
	});

	it("should prevent revoking access for non-existent access record", () => {
		const result = mockContract.revokeAccess(OWNER, 1n, VERIFIER);
		expect(result).toEqual({ error: 200 });
	});

	it("should batch grant access to multiple verifiers", () => {
		const result = mockContract.batchGrantAccess(OWNER, 1n, [
			VERIFIER,
			VERIFIER2,
		]);
		expect(result).toEqual({ value: true });
		expect(mockContract.accessList.get(`1-${VERIFIER}`)).toEqual({
			allowed: true,
		});
		expect(mockContract.accessList.get(`1-${VERIFIER2}`)).toEqual({
			allowed: true,
		});
		expect(mockContract.accessHistory.get(`1-${VERIFIER}`)).toEqual({
			grantedAt: 100n,
			revokedAt: null,
		});
		expect(mockContract.accessHistory.get(`1-${VERIFIER2}`)).toEqual({
			grantedAt: 100n,
			revokedAt: null,
		});
	});

	it("should prevent batch granting access exceeding max batch size", () => {
		const verifiers = Array(Number(mockContract.MAX_BATCH_SIZE) + 1).fill(
			VERIFIER
		);
		const result = mockContract.batchGrantAccess(OWNER, 1n, verifiers);
		expect(result).toEqual({ error: 204 });
	});

	it("should batch revoke access from multiple verifiers", () => {
		mockContract.batchGrantAccess(OWNER, 1n, [VERIFIER, VERIFIER2]);
		const result = mockContract.batchRevokeAccess(OWNER, 1n, [
			VERIFIER,
			VERIFIER2,
		]);
		expect(result).toEqual({ value: true });
		expect(mockContract.accessList.get(`1-${VERIFIER}`)).toEqual({
			allowed: false,
		});
		expect(mockContract.accessList.get(`1-${VERIFIER2}`)).toEqual({
			allowed: false,
		});
		expect(mockContract.accessHistory.get(`1-${VERIFIER}`)).toEqual({
			grantedAt: 100n,
			revokedAt: 101n,
		});
		expect(mockContract.accessHistory.get(`1-${VERIFIER2}`)).toEqual({
			grantedAt: 100n,
			revokedAt: 101n,
		});
	});

	it("should prevent batch revoking access for non-existent access records", () => {
		const result = mockContract.batchRevokeAccess(OWNER, 1n, [VERIFIER]);
		expect(result).toEqual({ error: 200 });
	});

	it("should check if a verifier has access", () => {
		mockContract.grantAccess(OWNER, 1n, VERIFIER);
		const result = mockContract.hasAccess(1n, VERIFIER);
		expect(result).toEqual({ value: true });
		mockContract.revokeAccess(OWNER, 1n, VERIFIER);
		const resultAfterRevoke = mockContract.hasAccess(1n, VERIFIER);
		expect(resultAfterRevoke).toEqual({ value: false });
	});

	it("should prevent access check for non-existent credential", () => {
		const result = mockContract.hasAccess(2n, VERIFIER);
		expect(result).toEqual({ error: 201 });
	});

	it("should return access history", () => {
		mockContract.grantAccess(OWNER, 1n, VERIFIER);
		const result = mockContract.getAccessHistory(1n, VERIFIER);
		expect(result).toEqual({ value: { grantedAt: 100n, revokedAt: null } });
		mockContract.revokeAccess(OWNER, 1n, VERIFIER);
		const resultAfterRevoke = mockContract.getAccessHistory(1n, VERIFIER);
		expect(resultAfterRevoke).toEqual({
			value: { grantedAt: 100n, revokedAt: 101n },
		});
	});
});
