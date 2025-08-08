import { describe, it, expect, beforeEach } from "vitest";

interface Credential {
	credentialType: string;
	issuer: string;
	recipientName: string;
	issueDate: bigint;
	revoked: boolean;
	metadataUri: string;
}

interface MockContract {
	admin: string;
	paused: boolean;
	totalCredentials: bigint;
	lastCredentialId: bigint;
	credentials: Map<bigint, Credential>;
	credentialOwners: Map<bigint, string>;
	MAX_BATCH_SIZE: bigint;
	accessControlContract: string | null;

	isAdmin(caller: string): boolean;
	setPaused(
		caller: string,
		pause: boolean
	): { value: boolean } | { error: number };
	setAccessControl(
		caller: string,
		contract: string | null
	): { value: boolean } | { error: number };
	issueCredential(
		caller: string,
		recipient: string,
		credentialType: string,
		issuer: string,
		recipientName: string,
		metadataUri: string
	): { value: bigint } | { error: number };
	issueBatchCredentials(
		caller: string,
		recipients: string[],
		credentialTypes: string[],
		issuers: string[],
		recipientNames: string[],
		metadataUris: string[]
	): { value: boolean } | { error: number };
	revokeCredential(
		caller: string,
		credentialId: bigint
	): { value: boolean } | { error: number };
	transferCredential(
		caller: string,
		credentialId: bigint,
		recipient: string
	): { value: boolean } | { error: number };
	verifyCredential(
		caller: string,
		credentialId: bigint
	): { value: Credential } | { error: number };
	getCredential(credentialId: bigint): { value: Credential | undefined };
	getCredentialOwner(credentialId: bigint): { value: string | undefined };
	getTotalCredentials(): { value: bigint };
}

const mockContract: MockContract = {
	admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
	paused: false,
	totalCredentials: 0n,
	lastCredentialId: 0n,
	credentials: new Map(),
	credentialOwners: new Map(),
	MAX_BATCH_SIZE: 10n,
	accessControlContract: null,

	isAdmin(caller: string) {
		return caller === this.admin;
	},

	setPaused(caller: string, pause: boolean) {
		if (!this.isAdmin(caller)) return { error: 100 };
		this.paused = pause;
		return { value: pause };
	},

	setAccessControl(caller: string, contract: string | null) {
		if (!this.isAdmin(caller)) return { error: 100 };
		this.accessControlContract = contract;
		return { value: true };
	},

	issueCredential(
		caller: string,
		recipient: string,
		credentialType: string,
		issuer: string,
		recipientName: string,
		metadataUri: string
	) {
		if (this.paused) return { error: 107 };
		if (!this.isAdmin(caller)) return { error: 100 };
		if (recipient === "SP000000000000000000002Q6VF78") return { error: 104 };
		if (
			credentialType.length === 0 ||
			issuer.length === 0 ||
			recipientName.length === 0 ||
			metadataUri.length === 0
		) {
			return { error: 105 };
		}
		const credentialId = this.lastCredentialId + 1n;
		this.credentials.set(credentialId, {
			credentialType,
			issuer,
			recipientName,
			issueDate: BigInt(100), // Mock block height
			revoked: false,
			metadataUri,
		});
		this.credentialOwners.set(credentialId, recipient);
		this.lastCredentialId = credentialId;
		this.totalCredentials += 1n;
		return { value: credentialId };
	},

	issueBatchCredentials(
		caller: string,
		recipients: string[],
		credentialTypes: string[],
		issuers: string[],
		recipientNames: string[],
		metadataUris: string[]
	) {
		if (this.paused) return { error: 107 };
		if (!this.isAdmin(caller)) return { error: 100 };
		if (recipients.length > Number(this.MAX_BATCH_SIZE)) return { error: 106 };
		if (
			recipients.length !== credentialTypes.length ||
			recipients.length !== issuers.length ||
			recipients.length !== recipientNames.length ||
			recipients.length !== metadataUris.length
		) {
			return { error: 105 };
		}
		for (let i = 0; i < recipients.length; i++) {
			if (recipients[i] === "SP000000000000000000002Q6VF78")
				return { error: 104 };
			if (
				credentialTypes[i].length === 0 ||
				issuers[i].length === 0 ||
				recipientNames[i].length === 0 ||
				metadataUris[i].length === 0
			) {
				return { error: 105 };
			}
			const credentialId = this.lastCredentialId + 1n;
			this.credentials.set(credentialId, {
				credentialType: credentialTypes[i],
				issuer: issuers[i],
				recipientName: recipientNames[i],
				issueDate: BigInt(100), // Mock block height
				revoked: false,
				metadataUri: metadataUris[i],
			});
			this.credentialOwners.set(credentialId, recipients[i]);
			this.lastCredentialId = credentialId;
			this.totalCredentials += 1n;
		}
		return { value: true };
	},

	revokeCredential(caller: string, credentialId: bigint) {
		if (this.paused) return { error: 107 };
		if (!this.isAdmin(caller)) return { error: 100 };
		if (!this.credentials.has(credentialId)) return { error: 103 };
		const credential = this.credentials.get(credentialId)!;
		this.credentials.set(credentialId, { ...credential, revoked: true });
		return { value: true };
	},

	transferCredential(caller: string, credentialId: bigint, recipient: string) {
		if (this.paused) return { error: 107 };
		if (!this.credentials.has(credentialId)) return { error: 103 };
		if (this.credentialOwners.get(credentialId) !== caller)
			return { error: 100 };
		if (recipient === "SP000000000000000000002Q6VF78") return { error: 104 };
		const credential = this.credentials.get(credentialId)!;
		if (credential.revoked) return { error: 102 };
		this.credentialOwners.set(credentialId, recipient);
		return { value: true };
	},

	verifyCredential(caller: string, credentialId: bigint) {
		if (!this.credentials.has(credentialId)) return { error: 103 };
		const credential = this.credentials.get(credentialId)!;
		if (credential.revoked) return { error: 102 };
		// Mock access control check (assume always true for simplicity)
		return { value: credential };
	},

	getCredential(credentialId: bigint) {
		return { value: this.credentials.get(credentialId) };
	},

	getCredentialOwner(credentialId: bigint) {
		return { value: this.credentialOwners.get(credentialId) };
	},

	getTotalCredentials() {
		return { value: this.totalCredentials };
	},
};

describe("VeriDegree CredentialNFT Contract", () => {
	const ADMIN = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
	const USER1 = "ST2CY5V39N7V71J3X4H8E3T63Z84Y5P3W6Z8G3";
	const USER2 = "ST3NBRSFKX28F3V56Z1XJ3X4H8E3T63Z84Y5P3W6Z8G3";
	const ZERO_ADDRESS = "SP000000000000000000002Q6VF78";

	beforeEach(() => {
		mockContract.admin = ADMIN;
		mockContract.paused = false;
		mockContract.totalCredentials = 0n;
		mockContract.lastCredentialId = 0n;
		mockContract.credentials = new Map();
		mockContract.credentialOwners = new Map();
		mockContract.accessControlContract = null;
	});

	it("should issue a single credential when called by admin", () => {
		const result = mockContract.issueCredential(
			ADMIN,
			USER1,
			"Diploma",
			"University XYZ",
			"John Doe",
			"ipfs://metadata123"
		);
		expect(result).toEqual({ value: 1n });
		expect(mockContract.credentials.get(1n)).toEqual({
			credentialType: "Diploma",
			issuer: "University XYZ",
			recipientName: "John Doe",
			issueDate: 100n,
			revoked: false,
			metadataUri: "ipfs://metadata123",
		});
		expect(mockContract.credentialOwners.get(1n)).toBe(USER1);
		expect(mockContract.getTotalCredentials()).toEqual({ value: 1n });
	});

	it("should prevent non-admin from issuing credentials", () => {
		const result = mockContract.issueCredential(
			USER1,
			USER2,
			"Diploma",
			"University XYZ",
			"John Doe",
			"ipfs://metadata123"
		);
		expect(result).toEqual({ error: 100 });
	});

	it("should prevent issuing to zero address", () => {
		const result = mockContract.issueCredential(
			ADMIN,
			ZERO_ADDRESS,
			"Diploma",
			"University XYZ",
			"John Doe",
			"ipfs://metadata123"
		);
		expect(result).toEqual({ error: 104 });
	});

	it("should prevent issuing with empty metadata", () => {
		const result = mockContract.issueCredential(
			ADMIN,
			USER1,
			"",
			"University XYZ",
			"John Doe",
			"ipfs://metadata123"
		);
		expect(result).toEqual({ error: 105 });
	});

	it("should issue batch credentials when called by admin", () => {
		const result = mockContract.issueBatchCredentials(
			ADMIN,
			[USER1, USER2],
			["Diploma", "Certificate"],
			["University XYZ", "Institute ABC"],
			["John Doe", "Jane Smith"],
			["ipfs://metadata123", "ipfs://metadata456"]
		);
		expect(result).toEqual({ value: true });
		expect(mockContract.credentials.get(1n)).toEqual({
			credentialType: "Diploma",
			issuer: "University XYZ",
			recipientName: "John Doe",
			issueDate: 100n,
			revoked: false,
			metadataUri: "ipfs://metadata123",
		});
		expect(mockContract.credentials.get(2n)).toEqual({
			credentialType: "Certificate",
			issuer: "Institute ABC",
			recipientName: "Jane Smith",
			issueDate: 100n,
			revoked: false,
			metadataUri: "ipfs://metadata456",
		});
		expect(mockContract.credentialOwners.get(1n)).toBe(USER1);
		expect(mockContract.credentialOwners.get(2n)).toBe(USER2);
		expect(mockContract.getTotalCredentials()).toEqual({ value: 2n });
	});

	it("should prevent batch issuance with mismatched list lengths", () => {
		const result = mockContract.issueBatchCredentials(
			ADMIN,
			[USER1, USER2],
			["Diploma"],
			["University XYZ"],
			["John Doe"],
			["ipfs://metadata123"]
		);
		expect(result).toEqual({ error: 105 });
	});

	it("should prevent batch issuance exceeding max batch size", () => {
		const result = mockContract.issueBatchCredentials(
			ADMIN,
			Array(Number(mockContract.MAX_BATCH_SIZE) + 1).fill(USER1),
			Array(Number(mockContract.MAX_BATCH_SIZE) + 1).fill("Diploma"),
			Array(Number(mockContract.MAX_BATCH_SIZE) + 1).fill("University XYZ"),
			Array(Number(mockContract.MAX_BATCH_SIZE) + 1).fill("John Doe"),
			Array(Number(mockContract.MAX_BATCH_SIZE) + 1).fill("ipfs://metadata123")
		);
		expect(result).toEqual({ error: 106 });
	});

	it("should revoke a credential when called by admin", () => {
		mockContract.issueCredential(
			ADMIN,
			USER1,
			"Diploma",
			"University XYZ",
			"John Doe",
			"ipfs://metadata123"
		);
		const result = mockContract.revokeCredential(ADMIN, 1n);
		expect(result).toEqual({ value: true });
		expect(mockContract.credentials.get(1n)?.revoked).toBe(true);
	});

	it("should prevent non-admin from revoking credentials", () => {
		mockContract.issueCredential(
			ADMIN,
			USER1,
			"Diploma",
			"University XYZ",
			"John Doe",
			"ipfs://metadata123"
		);
		const result = mockContract.revokeCredential(USER2, 1n);
		expect(result).toEqual({ error: 100 });
	});

	it("should prevent revoking non-existent credential", () => {
		const result = mockContract.revokeCredential(ADMIN, 1n);
		expect(result).toEqual({ error: 103 });
	});

	it("should transfer a credential", () => {
		mockContract.issueCredential(
			ADMIN,
			USER1,
			"Diploma",
			"University XYZ",
			"John Doe",
			"ipfs://metadata123"
		);
		const result = mockContract.transferCredential(USER1, 1n, USER2);
		expect(result).toEqual({ value: true });
		expect(mockContract.credentialOwners.get(1n)).toBe(USER2);
	});

	it("should prevent transfer by non-owner", () => {
		mockContract.issueCredential(
			ADMIN,
			USER1,
			"Diploma",
			"University XYZ",
			"John Doe",
			"ipfs://metadata123"
		);
		const result = mockContract.transferCredential(USER2, 1n, USER2);
		expect(result).toEqual({ error: 100 });
	});

	it("should prevent transfer of revoked credential", () => {
		mockContract.issueCredential(
			ADMIN,
			USER1,
			"Diploma",
			"University XYZ",
			"John Doe",
			"ipfs://metadata123"
		);
		mockContract.revokeCredential(ADMIN, 1n);
		const result = mockContract.transferCredential(USER1, 1n, USER2);
		expect(result).toEqual({ error: 102 });
	});

	it("should verify a credential", () => {
		mockContract.issueCredential(
			ADMIN,
			USER1,
			"Diploma",
			"University XYZ",
			"John Doe",
			"ipfs://metadata123"
		);
		const result = mockContract.verifyCredential(USER2, 1n);
		expect(result).toEqual({
			value: {
				credentialType: "Diploma",
				issuer: "University XYZ",
				recipientName: "John Doe",
				issueDate: 100n,
				revoked: false,
				metadataUri: "ipfs://metadata123",
			},
		});
	});

	it("should prevent verification of revoked credential", () => {
		mockContract.issueCredential(
			ADMIN,
			USER1,
			"Diploma",
			"University XYZ",
			"John Doe",
			"ipfs://metadata123"
		);
		mockContract.revokeCredential(ADMIN, 1n);
		const result = mockContract.verifyCredential(USER2, 1n);
		expect(result).toEqual({ error: 102 });
	});

	it("should prevent verification of non-existent credential", () => {
		const result = mockContract.verifyCredential(USER2, 1n);
		expect(result).toEqual({ error: 103 });
	});

	it("should return total credentials", () => {
		mockContract.issueCredential(
			ADMIN,
			USER1,
			"Diploma",
			"University XYZ",
			"John Doe",
			"ipfs://metadata123"
		);
		mockContract.issueCredential(
			ADMIN,
			USER2,
			"Certificate",
			"Institute ABC",
			"Jane Smith",
			"ipfs://metadata456"
		);
		const result = mockContract.getTotalCredentials();
		expect(result).toEqual({ value: 2n });
	});
});
