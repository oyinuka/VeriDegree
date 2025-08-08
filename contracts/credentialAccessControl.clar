 
;; VeriDegree CredentialAccessControl Contract
;; Clarity v2
;; Manages access permissions for sharing credentials with verifiers

;; Error codes
(define-constant ERR-NOT-AUTHORIZED u200)
(define-constant ERR-CREDENTIAL-NOT-FOUND u201)
(define-constant ERR-ZERO-ADDRESS u202)
(define-constant ERR-PAUSED u203)
(define-constant ERR-BATCH-LIMIT-EXCEEDED u204)
(define-constant ERR-INVALID-NFT-CONTRACT u205)

;; Contract metadata
(define-constant CONTRACT-NAME "VeriDegree Credential Access Control")
(define-constant MAX-BATCH-SIZE u10) ;; Max access changes in one batch

;; Admin and contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var nft-contract principal 'SP000000000000000000002Q6VF78) ;; Default to zero address, must be set

;; Access control mappings
(define-map access-list
  { credential-id: uint, verifier: principal }
  { allowed: bool }
)
(define-map access-history
  { credential-id: uint, verifier: principal }
  { granted-at: uint, revoked-at: (optional uint) }
)

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: ensure not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Private helper: is-credential-owner
(define-private (is-credential-owner (credential-id uint) (caller principal))
  (let
    (
      (owner (unwrap! (contract-call? (var-get nft-contract) get-credential-owner credential-id) (err ERR-CREDENTIAL-NOT-FOUND)))
    )
    (is-eq caller owner)
  )
)

;; Set NFT contract address
(define-public (set-nft-contract (contract principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq contract 'SP000000000000000000002Q6VF78)) (err ERR-INVALID-NFT-CONTRACT))
    (var-set nft-contract contract)
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

;; Grant access to a verifier for a specific credential
(define-public (grant-access (credential-id uint) (verifier principal))
  (begin
    (ensure-not-paused)
    (asserts! (is-credential-owner credential-id tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq verifier 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (is-some (contract-call? (var-get nft-contract) get-credential credential-id)) (err ERR-CREDENTIAL-NOT-FOUND))
    (map-set access-list
      { credential-id: credential-id, verifier: verifier }
      { allowed: true }
    )
    (map-set access-history
      { credential-id: credential-id, verifier: verifier }
      { granted-at: block-height, revoked-at: none }
    )
    (print { event: "access-granted", credential-id: credential-id, verifier: verifier, granted-by: tx-sender })
    (ok true)
  )
)

;; Revoke access from a verifier for a specific credential
(define-public (revoke-access (credential-id uint) (verifier principal))
  (begin
    (ensure-not-paused)
    (asserts! (is-credential-owner credential-id tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-some (contract-call? (var-get nft-contract) get-credential credential-id)) (err ERR-CREDENTIAL-NOT-FOUND))
    (map-set access-list
      { credential-id: credential-id, verifier: verifier }
      { allowed: false }
    )
    (map-set access-history
      { credential-id: credential-id, verifier: verifier }
      (merge
        (unwrap! (map-get? access-history { credential-id: credential-id, verifier: verifier }) (err ERR-NOT-AUTHORIZED))
        { revoked-at: (some block-height) }
      )
    )
    (print { event: "access-revoked", credential-id: credential-id, verifier: verifier, revoked-by: tx-sender })
    (ok true)
  )
)

;; Batch grant access to multiple verifiers
(define-public (batch-grant-access (credential-id uint) (verifiers (list 10 principal)))
  (begin
    (ensure-not-paused)
    (asserts! (is-credential-owner credential-id tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (<= (len verifiers) MAX-BATCH-SIZE) (err ERR-BATCH-LIMIT-EXCEEDED))
    (asserts! (is-some (contract-call? (var-get nft-contract) get-credential credential-id)) (err ERR-CREDENTIAL-NOT-FOUND))
    (fold batch-grant-access-iter verifiers
      { credential-id: credential-id, success: true }
    )
  )
)

;; Private helper for batch grant
(define-private (batch-grant-access-iter
  (verifier principal)
  (state { credential-id: uint, success: bool }))
  (begin
    (asserts! (get success state) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq verifier 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (map-set access-list
      { credential-id: (get credential-id state), verifier: verifier }
      { allowed: true }
    )
    (map-set access-history
      { credential-id: (get credential-id state), verifier: verifier }
      { granted-at: block-height, revoked-at: none }
    )
    (print { event: "access-granted", credential-id: (get credential-id state), verifier: verifier, granted-by: tx-sender })
    { credential-id: (get credential-id state), success: true }
  )
)

;; Batch revoke access from multiple verifiers
(define-public (batch-revoke-access (credential-id uint) (verifiers (list 10 principal)))
  (begin
    (ensure-not-paused)
    (asserts! (is-credential-owner credential-id tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (<= (len verifiers) MAX-BATCH-SIZE) (err ERR-BATCH-LIMIT-EXCEEDED))
    (asserts! (is-some (contract-call? (var-get nft-contract) get-credential credential-id)) (err ERR-CREDENTIAL-NOT-FOUND))
    (fold batch-revoke-access-iter verifiers
      { credential-id: credential-id, success: true }
    )
  )
)

;; Private helper for batch revoke
(define-private (batch-revoke-access-iter
  (verifier principal)
  (state { credential-id: uint, success: bool }))
  (begin
    (asserts! (get success state) (err ERR-NOT-AUTHORIZED))
    (map-set access-list
      { credential-id: (get credential-id state), verifier: verifier }
      { allowed: false }
    )
    (map-set access-history
      { credential-id: (get credential-id state), verifier: verifier }
      (merge
        (unwrap! (map-get? access-history { credential-id: (get credential-id state), verifier: verifier }) (err ERR-NOT-AUTHORIZED))
        { revoked-at: (some block-height) }
      )
    )
    (print { event: "access-revoked", credential-id: (get credential-id state), verifier: verifier, revoked-by: tx-sender })
    { credential-id: (get credential-id state), success: true }
  )
)

;; Check if a verifier has access to a credential
(define-public (has-access (credential-id uint) (verifier principal))
  (begin
    (asserts! (is-some (contract-call? (var-get nft-contract) get-credential credential-id)) (err ERR-CREDENTIAL-NOT-FOUND))
    (ok (default-to false (get allowed (map-get? access-list { credential-id: credential-id, verifier: verifier }))))
  )
)

;; Read-only: get access history
(define-read-only (get-access-history (credential-id uint) (verifier principal))
  (ok (map-get? access-history { credential-id: credential-id, verifier: verifier }))
)

;; Read-only: get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: get nft contract
(define-read-only (get-nft-contract)
  (ok (var-get nft-contract))
)

;; Read-only: check if paused
(define-read-only (is-paused)
  (ok (var-get paused))
)