;; VeriDegree CredentialNFT Contract
;; Clarity v2
;; Manages issuance, revocation, and verification of digital credentials as NFTs

;; Error codes
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-ALREADY-ISSUED u101)
(define-constant ERR-CREDENTIAL-REVOKED u102)
(define-constant ERR-CREDENTIAL-NOT-FOUND u103)
(define-constant ERR-ZERO-ADDRESS u104)
(define-constant ERR-INVALID-METADATA u105)
(define-constant ERR-BATCH-LIMIT-EXCEEDED u106)
(define-constant ERR-PAUSED u107)

;; Contract metadata
(define-constant CONTRACT-NAME "VeriDegree Credential NFT")
(define-constant CONTRACT-SYMBOL "VDNFT")
(define-constant MAX-BATCH-SIZE u10) ;; Max credentials issued in one batch

;; Admin and contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var total-credentials uint u0)
(define-data-var access-control-contract (optional principal) none)

;; Credential metadata structure
(define-map credentials uint
  {
    credential-type: (string-ascii 50), ;; e.g., "Diploma", "Certificate"
    issuer: (string-ascii 100), ;; Issuing institution
    recipient-name: (string-ascii 100), ;; Recipient's name
    issue-date: uint, ;; Block height of issuance
    revoked: bool, ;; Revocation status
    metadata-uri: (string-ascii 256) ;; URI for additional metadata (e.g., IPFS)
  }
)

;; Ownership mapping
(define-map credential-owners uint principal)

;; Events for external tracking
(define-data-var last-credential-id uint u0)

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: ensure not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Private helper: validate metadata
(define-private (validate-metadata (credential-type (string-ascii 50)) (issuer (string-ascii 100)) (recipient-name (string-ascii 100)) (metadata-uri (string-ascii 256)))
  (and
    (> (len credential-type) u0)
    (> (len issuer) u0)
    (> (len recipient-name) u0)
    (> (len metadata-uri) u0)
  )
)

;; Set access control contract
(define-public (set-access-control (contract (optional principal)))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set access-control-contract contract)
    (ok true)
  )
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-admin 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set admin new-admin)
    (ok true)
  )
)

;; Pause/unpause the contract
(define-public (set-paused (pause bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set paused pause)
    (ok pause)
  )
)

;; Issue a single credential
(define-public (issue-credential
  (recipient principal)
  (credential-type (string-ascii 50))
  (issuer (string-ascii 100))
  (recipient-name (string-ascii 100))
  (metadata-uri (string-ascii 256)))
  (begin
    (ensure-not-paused)
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (validate-metadata credential-type issuer recipient-name metadata-uri) (err ERR-INVALID-METADATA))
    (let
      (
        (credential-id (+ (var-get last-credential-id) u1))
      )
      (map-set credentials credential-id
        {
          credential-type: credential-type,
          issuer: issuer,
          recipient-name: recipient-name,
          issue-date: block-height,
          revoked: false,
          metadata-uri: metadata-uri
        }
      )
      (map-set credential-owners credential-id recipient)
      (var-set last-credential-id credential-id)
      (var-set total-credentials (+ (var-get total-credentials) u1))
      (print { event: "credential-issued", credential-id: credential-id, recipient: recipient })
      (ok credential-id)
    )
  )
)

;; Issue multiple credentials in a batch
(define-public (issue-batch-credentials
  (recipients (list 10 principal))
  (credential-types (list 10 (string-ascii 50)))
  (issuers (list 10 (string-ascii 100)))
  (recipient-names (list 10 (string-ascii 100)))
  (metadata-uris (list 10 (string-ascii 256))))
  (begin
    (ensure-not-paused)
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (<= (len recipients) MAX-BATCH-SIZE) (err ERR-BATCH-LIMIT-EXCEEDED))
    (asserts!
      (and
        (is-eq (len recipients) (len credential-types))
        (is-eq (len recipients) (len issuers))
        (is-eq (len recipients) (len recipient-names))
        (is-eq (len recipients) (len metadata-uris))
      )
      (err ERR-INVALID-METADATA)
    )
    (fold issue-batch-credential-iter recipients
      {
        credential-id: (var-get last-credential-id),
        types: credential-types,
        issuers: issuers,
        names: recipient-names,
        uris: metadata-uris,
        success: true
      }
    )
  )
)

;; Private helper for batch issuance
(define-private (issue-batch-credential-iter
  (recipient principal)
  (state { credential-id: uint, types: (list 10 (string-ascii 50)), issuers: (list 10 (string-ascii 100)), names: (list 10 (string-ascii 100)), uris: (list 10 (string-ascii 256)), success: bool }))
  (let
    (
      (credential-id (+ (get credential-id state) u1))
      (index (- (len (get types state)) (len (get types state))))
      (credential-type (unwrap-panic (element-at (get types state) index)))
      (issuer (unwrap-panic (element-at (get issuers state) index)))
      (recipient-name (unwrap-panic (element-at (get names state) index)))
      (metadata-uri (unwrap-panic (element-at (get uris state) index)))
    )
    (asserts! (get success state) (err ERR-INVALID-METADATA))
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (validate-metadata credential-type issuer recipient-name metadata-uri) (err ERR-INVALID-METADATA))
    (map-set credentials credential-id
      {
        credential-type: credential-type,
        issuer: issuer,
        recipient-name: recipient-name,
        issue-date: block-height,
        revoked: false,
        metadata-uri: metadata-uri
      }
    )
    (map-set credential-owners credential-id recipient)
    (var-set last-credential-id credential-id)
    (var-set total-credentials (+ (var-get total-credentials) u1))
    (print { event: "credential-issued", credential-id: credential-id, recipient: recipient })
    {
      credential-id: credential-id,
      types: (get types state),
      issuers: (get issuers state),
      names: (get names state),
      uris: (get uris state),
      success: true
    }
  )
)

;; Revoke a credential
(define-public (revoke-credential (credential-id uint))
  (begin
    (ensure-not-paused)
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-some (map-get? credentials credential-id)) (err ERR-CREDENTIAL-NOT-FOUND))
    (map-set credentials credential-id
      (merge (unwrap-panic (map-get? credentials credential-id)) { revoked: true })
    )
    (print { event: "credential-revoked", credential-id: credential-id })
    (ok true)
  )
)

;; Transfer a credential
(define-public (transfer-credential (credential-id uint) (recipient principal))
  (begin
    (ensure-not-paused)
    (asserts! (is-eq tx-sender (unwrap-panic (map-get? credential-owners credential-id))) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (is-some (map-get? credentials credential-id)) (err ERR-CREDENTIAL-NOT-FOUND))
    (asserts! (not (get revoked (unwrap-panic (map-get? credentials credential-id)))) (err ERR-CREDENTIAL-REVOKED))
    (map-set credential-owners credential-id recipient)
    (print { event: "credential-transferred", credential-id: credential-id, recipient: recipient })
    (ok true)
  )
)

;; Verify a credential
(define-public (verify-credential (credential-id uint))
  (begin
    (asserts! (is-some (map-get? credentials credential-id)) (err ERR-CREDENTIAL-NOT-FOUND))
    (let
      (
        (credential (unwrap-panic (map-get? credentials credential-id)))
        (access-control (var-get access-control-contract))
      )
      (asserts! (not (get revoked credential)) (err ERR-CREDENTIAL-REVOKED))
      (if (is-some access-control)
        (asserts!
          (contract-call? (unwrap-panic access-control) has-access credential-id tx-sender)
          (err ERR-NOT-AUTHORIZED)
        )
        true
      )
      (print { event: "credential-verified", credential-id: credential-id, verifier: tx-sender })
      (ok credential)
    )
  )
)

;; Read-only: get credential details
(define-read-only (get-credential (credential-id uint))
  (ok (map-get? credentials credential-id))
)

;; Read-only: get credential owner
(define-read-only (get-credential-owner (credential-id uint))
  (ok (map-get? credential-owners credential-id))
)

;; Read-only: get total credentials
(define-read-only (get-total-credentials)
  (ok (var-get total-credentials))
)

;; Read-only: get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: check if paused
(define-read-only (is-paused)
  (ok (var-get paused))
)